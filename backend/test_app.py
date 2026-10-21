"""Integration tests for the quiz live-voting backend.

Run with:  python3 -m unittest backend/test_app.py -v
Uses a temporary SQLite file and an in-process test client; no network needed.
"""

import os
import tempfile
import unittest

os.environ["TEACHER_PASSWORD"] = "test-password-123"
os.environ["QUIZ_DB"] = os.path.join(tempfile.mkdtemp(), "test.sqlite3")

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app as backend  # noqa: E402


def fresh_state():
    with backend.lock:
        backend.tokens.clear()
        backend.login_attempts.clear()
        backend.state.update(
            {
                "version": 0,
                "active": False,
                "question_id": None,
                "round": 0,
                "voting": "idle",
                "results_visible": False,
                "answer_visible": False,
                "deadline": None,
                "votes": {},
                "history": [],
            }
        )


class BackendTest(unittest.TestCase):
    def setUp(self):
        fresh_state()
        self.client = backend.app.test_client()

    def login(self, password="test-password-123"):
        return self.client.post("/api/login", json={"password": password})

    def auth(self):
        response = self.login()
        assert response.status_code == 200, response.get_json()
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    def start_session(self, headers):
        assert self.client.post("/api/session/start", headers=headers).status_code == 200
        assert self.client.post("/api/question", headers=headers, json={"question_id": "q1"}).status_code == 200

    # --- health & auth ---
    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ok"])

    def test_wrong_password_rejected(self):
        self.assertEqual(self.login("nope").status_code, 401)

    def test_login_rate_limited(self):
        for _ in range(backend.LOGIN_MAX_ATTEMPTS):
            self.login("wrong")
        self.assertEqual(self.login("test-password-123").status_code, 429)

    def test_teacher_endpoints_require_auth(self):
        for path in ["/api/session/start", "/api/session/end", "/api/question",
                     "/api/voting/open", "/api/voting/close", "/api/timer", "/api/reveal"]:
            response = self.client.post(path, json={"question_id": "q1", "kind": "answer", "action": "extend"})
            self.assertEqual(response.status_code, 401, path)

    def test_bad_token_rejected(self):
        headers = {"Authorization": "Bearer garbage"}
        self.assertEqual(self.client.post("/api/session/start", headers=headers).status_code, 401)

    # --- session flow ---
    def test_state_inactive_by_default(self):
        data = self.client.get("/api/state").get_json()
        self.assertFalse(data["active"])

    def test_full_question_lifecycle(self):
        headers = self.auth()
        self.start_session(headers)
        state = self.client.get("/api/state").get_json()
        self.assertTrue(state["active"])
        self.assertEqual(state["question_id"], "q1")
        self.assertEqual(state["voting"], "idle")

        # open voting with a long deadline
        state = self.client.post("/api/voting/open", headers=headers, json={"duration": 600}).get_json()
        self.assertEqual(state["voting"], "open")
        self.assertEqual(state["round"], 1)
        self.assertIsNotNone(state["deadline"])

        # two anonymous voters
        ok = self.client.post("/api/vote", json={"option": "A", "voter": "voter-one"})
        self.assertEqual(ok.status_code, 200)
        ok = self.client.post("/api/vote", json={"option": "B", "voter": "voter-two"})
        self.assertEqual(ok.status_code, 200)

        # students cannot see results before reveal
        state = self.client.get("/api/state").get_json()
        self.assertEqual(state["responses"], 2)
        self.assertIsNone(state["results"])
        self.assertFalse(state["answer_visible"])
        self.assertEqual(self.client.get("/api/results").status_code, 403)

        # close voting: must NOT auto-reveal anything
        state = self.client.post("/api/voting/close", headers=headers).get_json()
        self.assertEqual(state["voting"], "closed")
        self.assertFalse(state["results_visible"])
        self.assertFalse(state["answer_visible"])
        self.assertIsNone(self.client.get("/api/state").get_json()["results"])

        # late votes are rejected
        self.assertEqual(
            self.client.post("/api/vote", json={"option": "C", "voter": "voter-three"}).status_code, 409
        )

        # reveal results: histogram without answer flag
        state = self.client.post("/api/reveal", headers=headers, json={"kind": "results", "visible": True}).get_json()
        self.assertEqual(state["results"], {"A": 1, "B": 1, "C": 0, "D": 0, "?": 0})
        self.assertFalse(state["answer_visible"])

        # reveal answer (implies results)
        state = self.client.post("/api/reveal", headers=headers, json={"kind": "answer", "visible": True}).get_json()
        self.assertTrue(state["answer_visible"])
        self.assertTrue(state["results_visible"])

        # next question resets voting state
        state = self.client.post("/api/question", headers=headers, json={"question_id": "q2"}).get_json()
        self.assertEqual(state["question_id"], "q2")
        self.assertEqual(state["voting"], "idle")
        self.assertFalse(state["results_visible"])
        self.assertFalse(state["answer_visible"])
        self.assertEqual(state["responses"], 0)

    def test_duplicate_vote_replaces_not_duplicates(self):
        headers = self.auth()
        self.start_session(headers)
        self.client.post("/api/voting/open", headers=headers, json={})
        self.client.post("/api/vote", json={"option": "A", "voter": "same-person"})
        self.client.post("/api/vote", json={"option": "C", "voter": "same-person"})
        state = self.client.get("/api/state").get_json()
        self.assertEqual(state["responses"], 1)
        self.client.post("/api/voting/close", headers=headers)
        state = self.client.post("/api/reveal", headers=headers, json={"kind": "results", "visible": True}).get_json()
        self.assertEqual(state["results"]["C"], 1)
        self.assertEqual(state["results"]["A"], 0)

    def test_deadline_auto_closes_voting(self):
        headers = self.auth()
        self.start_session(headers)
        with backend.lock:
            # simulate a deadline already in the past
            self.client.post("/api/voting/open", headers=headers, json={"duration": 1})
            backend.state["deadline"] = 1  # epoch long gone
        state = self.client.get("/api/state").get_json()
        self.assertEqual(state["voting"], "closed")
        self.assertFalse(state["results_visible"], "deadline close must not reveal results")
        self.assertFalse(state["answer_visible"])

    def test_manual_close_overrides_timer(self):
        headers = self.auth()
        self.start_session(headers)
        self.client.post("/api/voting/open", headers=headers, json={"duration": 600})
        state = self.client.post("/api/voting/close", headers=headers).get_json()
        self.assertEqual(state["voting"], "closed")
        self.assertIsNone(state["deadline"])
        # timer expiry afterwards must not error or change anything
        state = self.client.get("/api/state").get_json()
        self.assertEqual(state["voting"], "closed")

    def test_extend_timer(self):
        headers = self.auth()
        self.start_session(headers)
        state = self.client.post("/api/voting/open", headers=headers, json={"duration": 60}).get_json()
        original = state["deadline"]
        state = self.client.post("/api/timer", headers=headers, json={"action": "extend", "seconds": 30}).get_json()
        self.assertAlmostEqual(state["deadline"] - original, 30, delta=2)

    def test_second_round_keeps_first_round_results(self):
        headers = self.auth()
        self.start_session(headers)
        self.client.post("/api/voting/open", headers=headers, json={})
        self.client.post("/api/vote", json={"option": "A", "voter": "person-one"})
        self.client.post("/api/vote", json={"option": "A", "voter": "person-two"})
        self.client.post("/api/voting/close", headers=headers)

        # second round on the same question
        state = self.client.post("/api/voting/open", headers=headers, json={}).get_json()
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["responses"], 0)
        self.client.post("/api/vote", json={"option": "B", "voter": "person-one"})
        self.client.post("/api/vote", json={"option": "B", "voter": "person-two"})
        self.client.post("/api/voting/close", headers=headers)

        state = self.client.post("/api/reveal", headers=headers, json={"kind": "results", "visible": True}).get_json()
        self.assertEqual(state["results"], {"A": 0, "B": 2, "C": 0, "D": 0, "?": 0})
        rounds = [(item["round"], item["counts"]) for item in state["history"]]
        self.assertIn((1, {"A": 2, "B": 0, "C": 0, "D": 0, "?": 0}), rounds)
        self.assertIn((2, {"A": 0, "B": 2, "C": 0, "D": 0, "?": 0}), rounds)

    def test_unknown_option_rejected_and_idk_accepted(self):
        headers = self.auth()
        self.start_session(headers)
        self.client.post("/api/voting/open", headers=headers, json={})
        self.assertEqual(self.client.post("/api/vote", json={"option": "E", "voter": "voter-x"}).status_code, 400)
        self.assertEqual(self.client.post("/api/vote", json={"option": "?", "voter": "voter-x"}).status_code, 200)

    def test_end_session_deactivates(self):
        headers = self.auth()
        self.start_session(headers)
        state = self.client.post("/api/session/end", headers=headers).get_json()
        self.assertFalse(state["active"])


if __name__ == "__main__":
    unittest.main()
