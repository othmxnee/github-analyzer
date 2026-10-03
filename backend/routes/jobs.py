"""Scheduled work triggered over HTTP, for hosts without cron (Render free tier).

POST /jobs/nightly   with header  Authorization: Bearer <JOBS_TOKEN>

An external scheduler (cron-job.org, free) calls this every 10 minutes during
a nightly window. The first call of the day starts the nightly re-check in a
background thread and returns at once (the scheduler times out after 30 s);
later calls keep the free instance awake while it runs and report progress;
once it finished, calls the same day are no-ops. Disabled (404) unless
JOBS_TOKEN is set. The token is only accepted in the header, never the URL,
so it doesn't end up in access logs.
"""
import hmac
import logging
import os
import threading
import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)
jobs_bp = Blueprint('jobs', __name__)

_lock = threading.Lock()
_state = {"running": False, "day": None, "summary": None, "error": None, "started_at": None}


def _today():
    return datetime.now(timezone.utc).date().isoformat()


def _authorized():
    token = os.environ.get('JOBS_TOKEN')
    supplied = (request.headers.get('Authorization') or '').removeprefix('Bearer ').strip()
    return bool(token) and hmac.compare_digest(supplied.encode(), token.encode())


def _run_in_background():
    from jobs import nightly
    try:
        summary = nightly.run()
        with _lock:
            _state.update(day=_today(), summary=summary, error=None)
        logger.info("nightly job finished: %s", summary)
    except Exception as exc:                       # next call retries
        logger.exception("nightly job failed")
        with _lock:
            _state.update(error=str(exc))
    finally:
        with _lock:
            _state["running"] = False


@jobs_bp.route('/jobs/nightly', methods=['POST'])
def trigger_nightly():
    if not os.environ.get('JOBS_TOKEN'):
        return jsonify({'error': 'Not found'}), 404
    if not _authorized():
        return jsonify({'error': 'Forbidden'}), 403
    with _lock:
        if _state["running"]:
            return jsonify({'status': 'running', 'since': _state["started_at"]}), 202
        if _state["day"] == _today():
            return jsonify({'status': 'done', 'day': _state["day"], 'summary': _state["summary"]})
        _state.update(running=True, started_at=time.time(), error=None)
    threading.Thread(target=_run_in_background, daemon=True).start()
    return jsonify({'status': 'started'}), 202
