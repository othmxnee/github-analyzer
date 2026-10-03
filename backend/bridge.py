"""Engine bridge for the desktop app and the VS Code extension.

One long-lived process per app window. It serves the website's own Flask
routes (same code, same JSON) over stdin/stdout instead of HTTP, so the
offline clients can never drift from the website again:

    request : {"id": 1, "method": "GET", "path": "/analyze/result",
               "query": {"repo_url": "local:/abs/path"}, "body": null}
    response: {"id": 1, "status": 200, "body": {...}}

    {"id": 2, "op": "ping"}      -> {"id": 2, "ok": true, ...}
    {"id": 3, "op": "shutdown"}  -> exits

Why a persistent process: importing the scientific stack and JIT-compiling
UMAP costs ~15-20 s. The old one-shot bridges paid that on every analysis;
here it is paid once, in the background, while the user picks a folder.

Repositories are addressed as "local:<absolute path>". Results are also
kept on disk (GA_CACHE_DIR), keyed by path and HEAD commit, so reopening an
unchanged repository after a restart is instant.
"""
import hashlib
import json
import os
import pickle
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

# Must be set before the app (and routes) are imported.
os.environ["GA_LOCAL_MODE"] = "1"
os.environ.setdefault("FLASK_ENV", "local")

# Keep the protocol channel clean: anything printed by libraries (numba,
# warnings, stray prints) goes to stderr, the JSON protocol to the saved fd.
_proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
os.dup2(2, 1)
sys.stdout = sys.stderr

BASE = os.path.dirname(os.path.abspath(__file__))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from app import app  # noqa: E402  (starts the UMAP warm-up thread)
from extensions import limiter  # noqa: E402
from routes import analyze as analyze_routes  # noqa: E402
from services import analyzer, skill_service, timeline_service  # noqa: E402

VERSION = "2.0.0"
CACHE_DIR = os.environ.get("GA_CACHE_DIR") or os.path.join(
    os.path.expanduser("~"), ".cache", "github-analyzer")
CACHE_KEEP = 12  # most recent repositories kept on disk

# Single local user: no rate limits, and results stay valid until the
# checked-out commit changes (routes/analyze.py re-runs on a new HEAD).
limiter.enabled = False
analyzer.CACHE_TTL = 10 ** 9
analyzer.CACHE_MAX_AGE = 10 ** 9

_client = app.test_client()
_write_lock = threading.Lock()
_persist_lock = threading.Lock()
_persisted = {}   # key -> (head, has_skills)


def _send(msg):
    line = json.dumps(msg, separators=(",", ":"), default=str)
    with _write_lock:
        _proto.write(line + "\n")
        _proto.flush()


def _cache_file(key):
    return os.path.join(CACHE_DIR, hashlib.sha1(key.encode()).hexdigest() + ".pkl")


def _load_from_disk(key):
    """Restore a finished analysis for an unchanged HEAD. True on success."""
    path = analyze_routes._local_path(key)
    if not path or analyzer._ANALYSIS_STATUS.get(key) in ("running", "done"):
        return False
    try:
        with open(_cache_file(key), "rb") as f:
            blob = pickle.load(f)
    except Exception:
        return False
    head = analyze_routes._local_head(path)
    if not head or blob.get("head") != head or blob.get("version") != VERSION:
        return False
    analyzer._ANALYSIS_CACHE[key] = blob["results"]
    analyzer._CLEANED_CACHE[key] = blob["cleaned"]
    analyzer._ANALYSIS_TIMESTAMPS[key] = time.time()
    analyzer._ANALYSIS_STATUS[key] = "done"
    if blob.get("prebuilt"):
        skill_service._commits_cache[key] = blob["prebuilt"]
    if blob.get("skills"):
        skill_service._cache[key] = blob["skills"]
        skill_service._status[key] = "done"
    timeline_service.invalidate_for_repo(key)
    analyze_routes._LOCAL_HEADS[key] = head
    _persisted[key] = (head, bool(blob.get("skills")))
    return True


def _persist(key):
    """Write the finished analysis (and skills, once ready) to disk."""
    head = analyze_routes._LOCAL_HEADS.get(key)
    if not head or analyzer._ANALYSIS_STATUS.get(key) != "done":
        return
    has_skills = skill_service._status.get(key) == "done"
    if _persisted.get(key) == (head, has_skills):
        return
    with _persist_lock:
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            blob = {
                "version": VERSION,
                "head": head,
                "results": analyzer._ANALYSIS_CACHE.get(key),
                "cleaned": analyzer._CLEANED_CACHE.get(key),
                "prebuilt": skill_service._commits_cache.get(key),
                "skills": skill_service._cache.get(key) if has_skills else None,
            }
            tmp = _cache_file(key) + ".tmp"
            with open(tmp, "wb") as f:
                pickle.dump(blob, f, protocol=pickle.HIGHEST_PROTOCOL)
            os.replace(tmp, _cache_file(key))
            _persisted[key] = (head, has_skills)
            files = sorted(
                (os.path.join(CACHE_DIR, n) for n in os.listdir(CACHE_DIR) if n.endswith(".pkl")),
                key=os.path.getmtime, reverse=True)
            for old in files[CACHE_KEEP:]:
                os.remove(old)
        except Exception as exc:  # caching is an optimisation only
            print(f"[bridge] could not persist {key}: {exc}", file=sys.stderr)


def _handle(msg):
    rid = msg.get("id")
    op = msg.get("op")
    if op == "ping":
        return {"id": rid, "ok": True, "version": VERSION, "pid": os.getpid(),
                "git": shutil.which("git") is not None}
    method = (msg.get("method") or "GET").upper()
    path = msg.get("path") or "/"
    query = msg.get("query") or {}
    body = msg.get("body")
    key = (query.get("repo_url") if isinstance(query, dict) else None) or \
          (body.get("repo_url") if isinstance(body, dict) else None)

    if method == "POST" and path == "/analyze" and key and not (body or {}).get("force"):
        _load_from_disk(key)

    resp = _client.open(path, method=method, query_string=query,
                        json=body if body is not None else None)
    data = resp.get_json(silent=True)
    if data is None:
        data = {"error": resp.get_data(as_text=True)[:500]}

    if key and isinstance(data, dict) and data.get("status") == "done" and \
            path in ("/analyze/result", "/analyze/skills/result"):
        threading.Thread(target=_persist, args=(key,), daemon=True).start()
    return {"id": rid, "status": resp.status_code, "body": data}


def main():
    _send({"event": "ready", "version": VERSION, "pid": os.getpid(),
           "git": shutil.which("git") is not None})
    pool = ThreadPoolExecutor(max_workers=8)

    def run(msg):
        try:
            _send(_handle(msg))
        except Exception as exc:
            _send({"id": msg.get("id"), "status": 500, "body": {"error": str(exc)}})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        if msg.get("op") == "shutdown":
            break
        pool.submit(run, msg)
    pool.shutdown(wait=False, cancel_futures=True)
    os._exit(0)


if __name__ == "__main__":
    main()
