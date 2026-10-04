"""History of analyses for the desktop app and VS Code (no database there).

The engine bridge keeps one small JSON file per repository in GA_CACHE_DIR
with the headline numbers of each analyzed commit (same fields as the
website's stored history), so the offline dashboards can show a trend.
One entry per HEAD commit: re-analyzing the same commit replaces its entry.
"""
import hashlib
import json
import os
import threading
from datetime import datetime, timezone

from services.store import HISTORY_FIELDS, _summary

MAX_ENTRIES = 200
_lock = threading.Lock()


def enabled():
    return os.environ.get("GA_LOCAL_MODE") == "1" and bool(os.environ.get("GA_CACHE_DIR"))


def _file(repo_key):
    folder = os.path.join(os.environ["GA_CACHE_DIR"], "history")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, hashlib.sha1(repo_key.encode()).hexdigest() + ".json")


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def record(repo_key, results, head_sha):
    if not enabled() or not head_sha:
        return
    entry = {"head_sha": head_sha, "trigger": "manual",
             "finished_at": datetime.now(timezone.utc).isoformat(),
             **{k: v for k, v in _summary(results).items() if k in HISTORY_FIELDS}}
    with _lock:
        path = _file(repo_key)
        runs = [r for r in _read(path) if r.get("head_sha") != head_sha] + [entry]
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(runs[-MAX_ENTRIES:], f)
        os.replace(tmp, path)


def history(repo_key, limit=60):
    """Newest first, like the website's /history."""
    if not enabled():
        return []
    runs = _read(_file(repo_key))
    return [dict(r, id=i) for i, r in reversed(list(enumerate(runs)))][:limit]
