FROM python:3.13-slim

# git is not optional: the analysis pipeline shells out to `git clone`,
# `git rev-list`, `git log` and `git blame`.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    GIT_TERMINAL_PROMPT=0

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Single worker is a correctness requirement, not a tuning choice: analysis
# state lives in module-level dicts (_ANALYSIS_CACHE / _ANALYSIS_STATUS), so a
# second worker would poll a process that never saw the job and hang forever.
# Threads are what let /analyze return while the background thread works.
# The timeout covers a full clone + PyDriller traversal of a large repo.
CMD gunicorn app:app \
    --bind 0.0.0.0:${PORT:-5000} \
    --workers 1 \
    --threads 8 \
    --timeout 600 \
    --access-logfile - \
    --error-logfile -
