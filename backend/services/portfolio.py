"""Company-wide view over the repositories a user watches.

repositories(): one row per watched repository with its latest stored
headline numbers, the change since the previous analysis and recent alerts.

people(): developers seen across those repositories, joined by email (each
repository's aliases are already merged by the engine). A developer is a
*critical owner* of a repository when they hold at least CRITICAL_SHARE of
its lines, or hold the most lines in a repository whose bus factor is 1.
These are display rules over existing metrics, not new metrics.
"""
from datetime import datetime, timedelta, timezone

from services.store import unpack_json

CRITICAL_SHARE = 0.50
ALERT_WINDOW_DAYS = 30
_results_cache = {}       # run_id -> results (finished runs never change)


def _latest_two(s, repository_id):
    from models import AnalysisRun
    return (s.query(AnalysisRun)
            .filter_by(repository_id=repository_id, status="done")
            .order_by(AnalysisRun.finished_at.desc(), AnalysisRun.id.desc()).limit(2).all())


def _watched(s, provider, login):
    from models import Repository, Watch
    return (s.query(Repository).join(Watch, Watch.repository_id == Repository.id)
            .filter(Watch.provider == provider, Watch.login == login, Watch.active.is_(True))
            .distinct().order_by(Repository.url).all())


def repositories(provider, login):
    import db
    from models import Alert
    since = datetime.now(timezone.utc) - timedelta(days=ALERT_WINDOW_DAYS)
    rows = []
    with db.session() as s:
        for repo in _watched(s, provider, login):
            runs = _latest_two(s, repo.id)
            cur = runs[0] if runs else None
            prev = runs[1] if len(runs) > 1 else None

            def delta(field):
                if not cur or not prev or getattr(cur, field) is None or getattr(prev, field) is None:
                    return None
                return getattr(cur, field) - getattr(prev, field)
            alerts = (s.query(Alert).filter(Alert.repository_id == repo.id, Alert.created_at >= since)
                      .count())
            rows.append({
                "repo_url": repo.url,
                "name": repo.full_name or repo.url,
                "private": repo.private,
                "analyzed_at": cur.finished_at.isoformat() if cur and cur.finished_at else None,
                "health_score": cur.health_score if cur else None,
                "risk_level": cur.risk_level if cur else None,
                "bus_factor": cur.bus_factor if cur else None,
                "active_bus_factor": cur.active_bus_factor if cur else None,
                "gini": cur.gini if cur else None,
                "orphaned_pct": cur.orphaned_pct if cur else None,
                "total_developers": cur.total_developers if cur else None,
                "health_change": delta("health_score"),
                "bus_factor_change": delta("bus_factor"),
                "alerts_30d": alerts,
            })
    # Riskiest first: lowest health, then lowest bus factor; never-analyzed last.
    rows.sort(key=lambda r: (r["health_score"] is None,
                             r["health_score"] if r["health_score"] is not None else 0,
                             r["bus_factor"] if r["bus_factor"] is not None else 0))
    return rows


def _results(run):
    if run.id not in _results_cache and run.result_gz:
        _results_cache[run.id] = unpack_json(run.result_gz)
        if len(_results_cache) > 200:
            _results_cache.pop(next(iter(_results_cache)))
    return _results_cache.get(run.id)


def people(provider, login, limit=100):
    import db
    by_dev = {}
    with db.session() as s:
        for repo in _watched(s, provider, login):
            runs = _latest_two(s, repo.id)
            res = _results(runs[0]) if runs else None
            if not res:
                continue
            owners = (res.get("busfactor_simulation") or {}).get("developers") or []
            stats = res.get("dev_stats") or {}
            bus = res.get("bus_factor")
            top = owners[0]["name"] if owners else None
            for o in owners:
                share = float(o.get("ownership") or 0)
                if share < 0.01:
                    continue
                dev = o["name"]
                critical = share >= CRITICAL_SHARE or (dev == top and bus == 1)
                entry = by_dev.setdefault(dev, {"developer": dev, "repos": [], "critical_repos": 0,
                                                "total_share": 0.0})
                entry["repos"].append({
                    "repo_url": repo.url, "name": repo.full_name or repo.url,
                    "share": round(share, 4), "critical": critical,
                    "last_commit": (stats.get(dev) or {}).get("last_commit"),
                })
                entry["critical_repos"] += int(critical)
                entry["total_share"] += share
    rows = list(by_dev.values())
    for r in rows:
        r["repos"].sort(key=lambda x: -x["share"])
        r["repo_count"] = len(r["repos"])
        r["total_share"] = round(r["total_share"], 4)
    rows.sort(key=lambda r: (-r["critical_repos"], -r["repo_count"], -r["total_share"]))
    return rows[:limit]
