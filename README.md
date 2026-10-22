# Algorithms course

A helper for my tutoring of two groups on osu.cz. Accessible on https://garncarz.github.io/algo/.
Done with GitHub Copilot, using prompts discussed with ChatGPT.

## Java code-tracing quiz

[quiz.html](https://garncarz.github.io/algo/quiz.html) is a multiple-choice
"trace this Java code" quiz with an optional live classroom voting mode.

- **Standalone:** everything works without a backend; questions live in
  [questions.js](questions.js) (see its header comment for how to add more;
  `node --test questions.test.mjs` verifies every answer key by executing the
  snippets with a real Java).
- **Live mode:** an optional Flask backend in [backend/](backend/README.md)
  synchronizes one question across the class, collects anonymous votes, and
  lets the teacher reveal a histogram and the answer. The teacher authenticates
  via the ⚙ button in the footer; the projected screen never shows answers or
  results unless they are explicitly revealed.

## Backend deployment (VPS, Docker)

The live-voting backend runs on the VPS as a Docker container behind the
global Nginx reverse proxy, serving https://algo.garncarz.cz/.

Prerequisites on the VPS: Docker + the Compose plugin, this repo checked out,
and `backend/.env` present (git-ignored; contains `TEACHER_PASSWORD` — see
[backend/.env.example](backend/.env.example)).

### First deploy

```bash
cd /path/to/algo

# 1. Stop the old manually running Gunicorn process (frees port 8099):
pkill -f 'gunicorn.*app:app'   # adjust if it was started differently

# 2. Build and start the container:
docker compose up -d --build

# 3. Copy the existing quiz history into the container's volume
#    (only when migrating an existing quiz_state.sqlite3; the container must
#    be stopped first so SQLite is not written concurrently):
docker compose stop
docker run --rm -v algo-backend-data:/data -v "$PWD/backend:/host:ro" alpine \
    sh -c 'cp /host/quiz_state.sqlite3 /data/ && chown 10001 /data/quiz_state.sqlite3'
docker compose up -d

# 4. Attach the container to the global Nginx project's network so the proxy
#    can reach http://algo-backend:8000 (the container name acts as the DNS
#    alias; `docker network ls` shows the network name):
docker network connect --alias algo-backend <nginx-network> algo-backend
```

Nothing is published to the host — the container is reachable only through
Docker networks.

### Nginx upstream (global proxy project, outside this repo)

```nginx
server {
    listen 443 ssl;
    server_name algo.garncarz.cz;

    ssl_certificate /etc/letsencrypt/live/geo.garncarz.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geo.garncarz.cz/privkey.pem;

    location / {
        resolver 127.0.0.11 valid=10s ipv6=off;
        set $algo_upstream algo-backend;
        proxy_pass http://$algo_upstream:8000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `resolver` + variable `proxy_pass` resolves `algo-backend` at request
time via Docker's DNS (127.0.0.11), so nginx starts and keeps serving its
other vhosts even when the backend container is stopped (502 until it is
back). Paths and query strings are forwarded unchanged.

### Day-to-day

```bash
docker compose logs -f              # inspect logs
docker compose ps                   # health status (healthy/unhealthy)
docker inspect --format '{{.State.Health.Status}}' algo-backend

# Update after git pull:
git pull && docker compose up -d --build
# re-attach to the proxy network only if the container was recreated:
docker network connect --alias algo-backend <nginx-network> algo-backend

docker compose restart              # plain restart
docker compose down                 # stop (volume with quiz history survives)
```

### Verify

```bash
curl https://algo.garncarz.cz/api/health   # {"ok":true,...}
docker inspect algo-backend --format '{{json .HostConfig.PortBindings}}'
# → null/{} : nothing is published on the host
```

Quiz round history lives in the Docker volume `algo-backend-data`
(`/data/quiz_state.sqlite3` inside the container) and survives rebuilds and
`docker compose down`. Backup: `docker run --rm -v algo-backend-data:/data
-v "$PWD:/backup" alpine tar czf /backup/quiz_state.tgz -C /data .`

