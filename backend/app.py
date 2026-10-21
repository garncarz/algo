"""Optional live-voting backend for quiz.html (Java code tracing quiz).

Design notes:
  - The backend knows nothing about the actual Java questions. It only stores
    question IDs, voting rounds, and selected option letters (A-D, "?").
  - State lives in memory (plus an optional SQLite file for restart resilience
    of past-round results only); sessions are short-lived teacher tokens.
  - The teacher password is never in the repository. Provide it via the
    TEACHER_PASSWORD environment variable or a local .env file (see .env.example).
  - All teacher endpoints require the Authorization: Bearer <token> header.
  - Login attempts are rate limited per client IP.

Run locally:  python3 backend/app.py            (serves on http://127.0.0.1:8000)
Production:   behind an HTTPS reverse proxy, e.g. gunicorn -w 1 -b 127.0.0.1:8000 backend.app:app
              (single worker keeps the in-memory session store coherent)
"""

import os
import secrets
import sqlite3
import threading
import time
from collections import defaultdict
from pathlib import Path

from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent


def load_env_file():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

TEACHER_PASSWORD = os.environ.get("TEACHER_PASSWORD", "")
PASSWORD_HASH = os.environ.get("TEACHER_PASSWORD_HASH", "")
if not PASSWORD_HASH and TEACHER_PASSWORD:
    PASSWORD_HASH = generate_password_hash(TEACHER_PASSWORD)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://garncarz.github.io,http://localhost:8012,http://127.0.0.1:8012,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

TOKEN_TTL_SECONDS = 6 * 60 * 60          # teacher session length
LOGIN_WINDOW_SECONDS = 300                # rate-limit window
LOGIN_MAX_ATTEMPTS = 10                   # per IP per window
POLL_VERSION_FREEZE = False               # testing hook

OPTIONS = ("A", "B", "C", "D", "?")       # "?" = "I don't know"
DB_PATH = os.environ.get("QUIZ_DB", str(BASE_DIR / "quiz_state.sqlite3"))

app = Flask(__name__)
lock = threading.RLock()


def new_session_state():
    return {
        "version": 0,
        "active": False,
        "question_id": None,
        "round": 0,
        "voting": "idle",           # idle | open | closed
        "results_visible": False,
        "answer_visible": False,
        "deadline": None,           # epoch seconds while voting is open, else None
        "votes": {},                # voter token -> option (current round only)
        "history": [],              # [{question_id, round, counts, closed_at}]
    }


state = new_session_state()
tokens = {}                            # token -> expiry epoch
login_attempts = defaultdict(list)     # ip -> [timestamps]
db_lock = threading.Lock()


def init_db():
    with db_lock, sqlite3.connect(DB_PATH) as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS rounds (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   question_id TEXT NOT NULL,
                   round INTEGER NOT NULL,
                   counts TEXT NOT NULL,
                   closed_at REAL NOT NULL
               )"""
        )


init_db()


def persist_round(question_id, round_no, counts):
    try:
        with db_lock, sqlite3.connect(DB_PATH) as db:
            db.execute(
                "INSERT INTO rounds (question_id, round, counts, closed_at) VALUES (?, ?, ?, ?)",
                (question_id, round_no, ",".join(f"{k}:{v}" for k, v in counts.items()), time.time()),
            )
    except sqlite3.Error:
        app.logger.warning("Could not persist round results", exc_info=True)


def bump():
    state["version"] += 1


def counts_for_current_round():
    counts = {option: 0 for option in OPTIONS}
    for option in state["votes"].values():
        counts[option] = counts.get(option, 0) + 1
    return counts


def close_voting_locked(reason="manual"):
    if state["voting"] != "open":
        return False
    state["voting"] = "closed"
    state["deadline"] = None
    counts = counts_for_current_round()
    state["history"].append(
        {
            "question_id": state["question_id"],
            "round": state["round"],
            "counts": counts,
            "closed_at": time.time(),
        }
    )
    persist_round(state["question_id"] or "", state["round"], counts)
    bump()
    return True


def enforce_deadline():
    with lock:
        if (
            state["voting"] == "open"
            and state["deadline"] is not None
            and time.time() >= state["deadline"]
        ):
            close_voting_locked(reason="deadline")


def public_state():
    enforce_deadline()
    with lock:
        history = [
            {
                "question_id": item["question_id"],
                "round": item["round"],
                "counts": item["counts"],
                "total": sum(item["counts"].values()),
            }
            for item in state["history"]
            if item["question_id"] == state["question_id"]
        ]
        return {
            "version": state["version"],
            "active": state["active"],
            "question_id": state["question_id"],
            "round": state["round"],
            "voting": state["voting"],
            "results_visible": state["results_visible"],
            "answer_visible": state["answer_visible"],
            "deadline": state["deadline"],
            "server_time": time.time(),
            "responses": len(state["votes"]),
            "results": counts_for_current_round() if state["results_visible"] else None,
            "history": history if state["results_visible"] else None,
        }


def require_teacher():
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    with lock:
        expiry = tokens.get(token)
        if not token or expiry is None:
            return None
        if expiry < time.time():
            del tokens[token]
            return None
        tokens[token] = time.time() + TOKEN_TTL_SECONDS
    return token


def teacher_required(view):
    from functools import wraps

    @wraps(view)
    def wrapper(*args, **kwargs):
        if require_teacher() is None:
            return jsonify({"error": "unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapper


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "server_time": time.time()})


@app.route("/api/login", methods=["POST"])
def login():
    if not PASSWORD_HASH:
        return jsonify({"error": "teacher login is not configured on this server"}), 503
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    now = time.time()
    with lock:
        attempts = [t for t in login_attempts[ip] if now - t < LOGIN_WINDOW_SECONDS]
        login_attempts[ip] = attempts
        if len(attempts) >= LOGIN_MAX_ATTEMPTS:
            return jsonify({"error": "too many attempts, try again later"}), 429
        attempts.append(now)
    password = (request.get_json(silent=True) or {}).get("password", "")
    if not password or not check_password_hash(PASSWORD_HASH, password):
        return jsonify({"error": "wrong password"}), 401
    token = secrets.token_urlsafe(32)
    with lock:
        tokens[token] = time.time() + TOKEN_TTL_SECONDS
    return jsonify({"token": token, "expires_in": TOKEN_TTL_SECONDS})


@app.route("/api/logout", methods=["POST"])
def logout():
    token = require_teacher()
    if token:
        with lock:
            tokens.pop(token, None)
    return jsonify({"ok": True})


@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(public_state())


@app.route("/api/session/start", methods=["POST"])
@teacher_required
def session_start():
    with lock:
        state.update(
            {
                "active": True,
                "question_id": state["question_id"],
                "voting": "idle",
                "results_visible": False,
                "answer_visible": False,
                "deadline": None,
            }
        )
        bump()
    return jsonify(public_state())


@app.route("/api/session/end", methods=["POST"])
@teacher_required
def session_end():
    global state
    with lock:
        state = new_session_state()
        bump()
    return jsonify(public_state())


@app.route("/api/question", methods=["POST"])
@teacher_required
def set_question():
    question_id = (request.get_json(silent=True) or {}).get("question_id")
    if not isinstance(question_id, str) or not question_id:
        return jsonify({"error": "question_id required"}), 400
    with lock:
        state["question_id"] = question_id
        state["round"] = 0
        state["voting"] = "idle"
        state["results_visible"] = False
        state["answer_visible"] = False
        state["deadline"] = None
        state["votes"] = {}
        bump()
    return jsonify(public_state())


@app.route("/api/voting/open", methods=["POST"])
@teacher_required
def voting_open():
    data = request.get_json(silent=True) or {}
    duration = data.get("duration")  # seconds or None for unlimited
    if duration is not None:
        try:
            duration = int(duration)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid duration"}), 400
        if duration <= 0 or duration > 3600:
            return jsonify({"error": "invalid duration"}), 400
    with lock:
        if not state["active"] or not state["question_id"]:
            return jsonify({"error": "no active question"}), 409
        state["round"] += 1
        state["voting"] = "open"
        state["results_visible"] = False
        state["answer_visible"] = False
        state["votes"] = {}
        state["deadline"] = time.time() + duration if duration else None
        bump()
    return jsonify(public_state())


@app.route("/api/voting/close", methods=["POST"])
@teacher_required
def voting_close():
    with lock:
        close_voting_locked()
    return jsonify(public_state())


@app.route("/api/timer", methods=["POST"])
@teacher_required
def timer_update():
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    with lock:
        if action == "extend":
            seconds = int(data.get("seconds", 30))
            if state["voting"] == "open" and state["deadline"] is not None:
                state["deadline"] += seconds
                bump()
        elif action == "set":
            duration = data.get("duration")
            if state["voting"] == "open":
                state["deadline"] = time.time() + int(duration) if duration else None
                bump()
        else:
            return jsonify({"error": "unknown action"}), 400
    return jsonify(public_state())


@app.route("/api/reveal", methods=["POST"])
@teacher_required
def reveal():
    data = request.get_json(silent=True) or {}
    kind = data.get("kind")          # "results" | "answer"
    visible = bool(data.get("visible"))
    if kind not in ("results", "answer"):
        return jsonify({"error": "kind must be results or answer"}), 400
    with lock:
        if kind == "results":
            state["results_visible"] = visible
        else:
            state["answer_visible"] = visible
            if visible:
                state["results_visible"] = True
        bump()
    return jsonify(public_state())


@app.route("/api/vote", methods=["POST"])
def vote():
    data = request.get_json(silent=True) or {}
    option = data.get("option")
    voter = data.get("voter")
    if option not in OPTIONS:
        return jsonify({"error": "invalid option"}), 400
    if not is_valid_voter(voter):
        return jsonify({"error": "invalid voter token"}), 400
    with lock:
        enforce_deadline()
        if state["voting"] != "open":
            return jsonify({"error": "voting is closed"}), 409
        if state["deadline"] is not None and time.time() >= state["deadline"]:
            close_voting_locked(reason="deadline")
            return jsonify({"error": "voting is closed"}), 409
        already = voter in state["votes"]
        state["votes"][voter] = option
        bump()
    return jsonify({"ok": True, "changed": already, "responses": len(state["votes"])})


def is_valid_voter(voter):
    return isinstance(voter, str) and 4 <= len(voter) <= 128 and all(
        c in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_." for c in voter
    )


@app.route("/api/results", methods=["GET"])
def results():
    current = public_state()
    if not current["results_visible"]:
        return jsonify({"error": "results are not visible"}), 403
    return jsonify(current)


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "method not allowed"}), 405


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="127.0.0.1", port=port)
