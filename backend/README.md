# Live voting backend for quiz.html

Optional companion server for the Java code-tracing quiz. The static
[quiz.html](../quiz.html) works fully without it; this backend only adds
synchronized live classroom voting.

## Local run

```bash
cd backend
cp .env.example .env        # set TEACHER_PASSWORD inside
python3 app.py              # serves http://127.0.0.1:8000
```

Then open `http://localhost:8012/quiz.html?backend=http://127.0.0.1:8000`
(the `?backend=` override is remembered in `sessionStorage` for the tab).

## Production (algo.geo.garncarz.cz)

Run a single worker so the in-memory session stays coherent:

```bash
gunicorn -w 1 -b 127.0.0.1:8000 backend.app:app
```

Put it behind an HTTPS reverse proxy (nginx example):

```nginx
server {
    server_name algo.geo.garncarz.cz;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
    # TLS via certbot / Let's Encrypt
}
```

## Configuration (environment or `.env`)

| Variable | Purpose |
| --- | --- |
| `TEACHER_PASSWORD` | Teacher password (hashed at startup, never stored plain). |
| `TEACHER_PASSWORD_HASH` | Pre-computed Werkzeug hash; wins if both are set. |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (defaults include `https://garncarz.github.io` and localhost). |
| `QUIZ_DB` | SQLite path for persisting closed-round tallies. |
| `PORT` | Listen port for `python3 app.py` (default 8000). |

`.env` is git-ignored — never commit the password.

## API overview

All teacher endpoints need `Authorization: Bearer <token>` from `/api/login`
(rate limited: 10 attempts / 5 min / IP). Sessions last 6 hours.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | – | Availability check. |
| `POST /api/login` / `logout` | – / ✓ | Teacher session. |
| `GET /api/state` | – | Public state: question id, round, voting status, deadline, server time, response count; results/history only once revealed. |
| `POST /api/session/start` / `end` | ✓ | Activate / reset the classroom. |
| `POST /api/question` | ✓ | `{question_id}` — changes question, resets round & reveals. |
| `POST /api/voting/open` | ✓ | `{duration}` (seconds or `null`) — starts a **new round**. |
| `POST /api/voting/close` | ✓ | Manual close; never auto-reveals, never advances. |
| `POST /api/timer` | ✓ | `{action: "extend", seconds: 30}` on an active timer. |
| `POST /api/reveal` | ✓ | `{kind: "results" \| "answer", visible: bool}`. |
| `POST /api/vote` | – | `{option: "A".."D" \| "?", voter: <random token>}` — one vote per voter per round; re-voting replaces. |
| `GET /api/results` | – | 403 until results are revealed. |

The deadline is enforced server-side on every request, so voting closes even
if the teacher's browser disconnects.

## Tests

```bash
python3 -m unittest backend/test_app.py -v
node --test questions.test.mjs   # verifies Java answer keys with a real JDK
```
