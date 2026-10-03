"""Persistence of analysis runs (optional; active only when DATABASE_URL is set).

The analyzer and routes call these functions at fixed points: run started,
phase changed, run finished / failed, roles computed. Every function swallows
and logs its own errors: a database problem must never break an analysis,
it only means the result is not kept.

Retention per repository: summary numbers are kept for every run (trends);
the full result for the last KEEP_RESULTS runs; the cleaned dataframes (only
needed to re-slice date ranges of the latest result) for the last
KEEP_CLEANED runs.
"""
import json
import logging
import os
import pickle
import zlib
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

KEEP_RESULTS = 30
KEEP_CLEANED = 2
STALE_RUNNING = timedelta(minutes=30)   # a "running" row older than this was interrupted


def enabled():
    if os.environ.get("GA_LOCAL_MODE") == "1":     # desktop / VS Code bridge
        return False
    try:
        import db
        return db.enabled()
    except Exception:
        return False


def _utc(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _now():
    return datetime.now(timezone.utc)


def _json_default(o):
    try:
        import numpy as np
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
    except Exception:
        pass
    return str(o)


def pack_json(obj):
    return zlib.compress(json.dumps(obj, default=_json_default).encode(), 6)


def unpack_json(blob):
    return json.loads(zlib.decompress(blob)) if blob else None


def pack_pickle(obj):
    return zlib.compress(pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL), 6)


def unpack_pickle(blob):
    # Only ever written by this server into its own database.
    return pickle.loads(zlib.decompress(blob)) if blob else None


def _provider_and_name(url):
    for prefix, provider in (("https://github.com/", "github"), ("https://gitlab.com/", "gitlab"),
                             ("https://bitbucket.org/", "bitbucket")):
        if url.startswith(prefix):
            return provider, url[len(prefix):].rstrip("/").removesuffix(".git")
    return None, None


def _summary(results):
    ps = results.get("project_summary") or {}
    summ = results.get("summary") or {}
    abf = results.get("active_bus_factor") or {}
    ok = results.get("orphaned_knowledge") or {}

    def num(v, cast):
        try:
            return cast(v) if v is not None else None
        except (TypeError, ValueError):
            return None
    return {
        "health_score": num(ps.get("health_score"), int),
        "risk_level": ps.get("risk_level"),
        "bus_factor": num(results.get("bus_factor"), int),
        "active_bus_factor": num(abf.get("active_bus_factor"), int),
        "gini": num(results.get("gini"), float),
        "orphaned_pct": num(ok.get("orphaned_pct"), float),
        "total_commits": num(summ.get("total_commits"), int),
        "total_developers": num(summ.get("total_developers"), int),
        "total_files": num(summ.get("total_files"), int),
    }


def _get_or_create_repo(s, url, private=None):
    from models import Repository
    repo = s.query(Repository).filter_by(url=url).one_or_none()
    if repo is None:
        provider, name = _provider_and_name(url)
        repo = Repository(url=url, provider=provider, full_name=name, private=bool(private))
        s.add(repo)
        s.flush()
    elif private is not None and repo.private != bool(private):
        repo.private = bool(private)
    return repo


# ── writes ──────────────────────────────────────────────────────────────────

def run_started(url, trigger="manual", engine_version=None, private=None):
    """Create a 'running' row; returns its id (or None when not persisting)."""
    if not enabled():
        return None
    try:
        import db
        from models import AnalysisRun
        with db.session() as s, s.begin():
            repo = _get_or_create_repo(s, url, private)
            run = AnalysisRun(repository_id=repo.id, status="running", trigger=trigger,
                              phase="cloning", engine_version=engine_version, started_at=_now())
            s.add(run)
            s.flush()
            return run.id
    except Exception:
        logger.exception("store: could not record run start for %s", url)
        return None


def run_phase(run_id, phase):
    if not run_id:
        return
    try:
        import db
        from models import AnalysisRun
        with db.session() as s, s.begin():
            s.query(AnalysisRun).filter_by(id=run_id).update({"phase": phase})
    except Exception:
        logger.exception("store: could not record phase")


def run_finished(run_id, results, cleaned=None, head_sha=None):
    if not run_id:
        return
    try:
        import db
        from models import AnalysisRun, Repository
        with db.session() as s, s.begin():
            run = s.get(AnalysisRun, run_id)
            if run is None:
                return
            for k, v in _summary(results).items():
                setattr(run, k, v)
            run.status = "done"
            run.phase = None
            run.finished_at = _now()
            run.head_sha = head_sha
            run.result_gz = pack_json(results)
            run.cleaned_gz = pack_pickle(cleaned) if cleaned is not None else None
            repo = s.get(Repository, run.repository_id)
            repo.last_analyzed_at = run.finished_at
            repo.last_head_sha = head_sha
            _apply_retention(s, run.repository_id)
    except Exception:
        logger.exception("store: could not save finished run %s", run_id)


def run_failed(run_id, error):
    if not run_id:
        return
    try:
        import db
        from models import AnalysisRun
        with db.session() as s, s.begin():
            s.query(AnalysisRun).filter_by(id=run_id).update(
                {"status": "error", "error": str(error)[:4000], "phase": None, "finished_at": _now()})
    except Exception:
        logger.exception("store: could not record failure of run %s", run_id)


def save_skills(url, skills):
    """Attach a finished roles result to the latest done run, once."""
    if not enabled():
        return False
    try:
        import db
        from models import AnalysisRun, Repository
        with db.session() as s, s.begin():
            run = (s.query(AnalysisRun).join(Repository)
                   .filter(Repository.url == url, AnalysisRun.status == "done")
                   .order_by(AnalysisRun.finished_at.desc(), AnalysisRun.id.desc()).first())
            if run is None or run.skills_gz is not None:
                return False
            run.skills_gz = pack_json({k: v for k, v in skills.items() if k != "status"})
            return True
    except Exception:
        logger.exception("store: could not save roles for %s", url)
        return False


def _apply_retention(s, repository_id):
    from models import AnalysisRun
    ids = [r.id for r in s.query(AnalysisRun.id)
           .filter_by(repository_id=repository_id, status="done")
           .order_by(AnalysisRun.finished_at.desc(), AnalysisRun.id.desc())]
    if len(ids) > KEEP_CLEANED:
        s.query(AnalysisRun).filter(AnalysisRun.id.in_(ids[KEEP_CLEANED:])).update(
            {"cleaned_gz": None}, synchronize_session=False)
    if len(ids) > KEEP_RESULTS:
        s.query(AnalysisRun).filter(AnalysisRun.id.in_(ids[KEEP_RESULTS:])).update(
            {"result_gz": None, "skills_gz": None}, synchronize_session=False)


# ── reads ───────────────────────────────────────────────────────────────────

def is_private(url):
    if not enabled():
        return None
    try:
        import db
        from models import Repository
        with db.session() as s:
            repo = s.query(Repository).filter_by(url=url).one_or_none()
            return None if repo is None else bool(repo.private)
    except Exception:
        logger.exception("store: could not read privacy flag for %s", url)
        return None


def latest_state(url):
    """Latest run for the repo as a light dict (no blobs), or None.

    A 'running' row that has not moved for STALE_RUNNING is reported (and
    stored) as an interrupted error, e.g. after a server restart mid-run.
    """
    if not enabled():
        return None
    try:
        import db
        from models import AnalysisRun, Repository
        with db.session() as s, s.begin():
            run = (s.query(AnalysisRun).join(Repository).filter(Repository.url == url)
                   .order_by(AnalysisRun.started_at.desc(), AnalysisRun.id.desc()).first())
            if run is None:
                return None
            if run.status == "running" and _now() - _utc(run.started_at) > STALE_RUNNING:
                run.status, run.error, run.finished_at = "error", "Analysis was interrupted.", _now()
            return {"id": run.id, "status": run.status, "phase": run.phase, "error": run.error,
                    "started_at": _utc(run.started_at), "finished_at": _utc(run.finished_at)}
    except Exception:
        logger.exception("store: could not read latest state for %s", url)
        return None


def load_latest_done(url):
    """Latest finished run with its data: {results, cleaned, skills, finished_at, head_sha}."""
    if not enabled():
        return None
    try:
        import db
        from models import AnalysisRun, Repository
        with db.session() as s:
            run = (s.query(AnalysisRun).join(Repository)
                   .filter(Repository.url == url, AnalysisRun.status == "done",
                           AnalysisRun.result_gz.isnot(None), AnalysisRun.cleaned_gz.isnot(None))
                   .order_by(AnalysisRun.finished_at.desc(), AnalysisRun.id.desc()).first())
            if run is None:
                return None
            return {
                "run_id": run.id,
                "results": unpack_json(run.result_gz),
                "cleaned": unpack_pickle(run.cleaned_gz),
                "skills": unpack_json(run.skills_gz),
                "finished_at": _utc(run.finished_at),
                "head_sha": run.head_sha,
            }
    except Exception:
        logger.exception("store: could not load stored result for %s", url)
        return None


HISTORY_FIELDS = ("health_score", "risk_level", "bus_factor", "active_bus_factor", "gini",
                  "orphaned_pct", "total_commits", "total_developers", "total_files")


def history(url, limit=60):
    """Finished runs of a repository, newest first, as summary rows."""
    if not enabled():
        return []
    try:
        import db
        from models import AnalysisRun, Repository
        with db.session() as s:
            runs = (s.query(AnalysisRun).join(Repository)
                    .filter(Repository.url == url, AnalysisRun.status == "done")
                    .order_by(AnalysisRun.finished_at.desc(), AnalysisRun.id.desc())
                    .limit(limit).all())
            return [{
                "id": r.id, "trigger": r.trigger, "head_sha": r.head_sha,
                "finished_at": _utc(r.finished_at).isoformat(),
                **{f: getattr(r, f) for f in HISTORY_FIELDS},
            } for r in runs]
    except Exception:
        logger.exception("store: could not read history for %s", url)
        return []
