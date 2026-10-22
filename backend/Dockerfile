# Live-voting backend for the Algorithms quiz (see app.py).
# Single-stage runtime image; keeps the production footprint small.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # SQLite lives on the mounted volume, never inside the image layer.
    QUIZ_DB=/data/quiz_state.sqlite3

WORKDIR /app

# Dependencies first so the layer is cached unless requirements change.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

# Run as an unprivileged user; /data holds the SQLite state (volume mount).
RUN useradd --system --uid 10001 --create-home app \
    && mkdir -p /data \
    && chown -R app:app /data

USER app

EXPOSE 8000

# Exactly one worker: quiz/session state is in-memory per process (app.py).
# Gunicorn reaps dead workers; access log goes to stdout for `docker logs`.
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "--access-logfile", "-", "app:app"]
