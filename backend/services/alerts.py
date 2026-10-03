"""Alert rules: what changed between two consecutive analyses of a repository.

The rules only *compare* numbers the engine already produces (bus factor,
health score, orphaned knowledge, per-developer line ownership and last
commit, per-file risk). They never change how a metric is computed.

The thresholds below are alert settings, separate from the metrics. They
decide when a change is worth an email:

    HEALTH_DROP       10 points of health score lost since the last analysis
    ORPHANED_RISE     5 percentage points more code owned by inactive people
    KEY_OWNER_SHARE   20 % of all lines: a developer who owns this much ...
    QUIET_DAYS        45 days without a commit (relative to the repository's
                      latest commit, the same reference the engine uses) ...
                      ... triggers "key person going quiet"
    HIGH_RISK         0.70 risk score (KCI x in-degree): a file newly above it
"""
from datetime import datetime

HEALTH_DROP = 10
ORPHANED_RISE = 0.05
KEY_OWNER_SHARE = 0.20
QUIET_DAYS = 45
HIGH_RISK = 0.70
MAX_RISK_ALERTS = 5


def _short(dev):
    return str(dev).split("@")[0]


def _date(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _quiet_owners(results):
    """{developer: (share, quiet_days)} for big owners who stopped committing."""
    owners = (results.get("busfactor_simulation") or {}).get("developers") or []
    stats = results.get("dev_stats") or {}
    ref = _date(((results.get("summary") or {}).get("date_range") or {}).get("end"))
    out = {}
    if not ref:
        return out
    for o in owners:
        share = float(o.get("ownership") or 0)
        if share < KEY_OWNER_SHARE:
            continue
        last = _date((stats.get(o.get("name")) or {}).get("last_commit"))
        if last is None:
            continue
        quiet = (ref - last).days
        if quiet >= QUIET_DAYS:
            out[o["name"]] = (share, quiet)
    return out


def _high_risk_files(results):
    return {f["file"]: float(f["risk_score"]) for f in (results.get("risk_files") or [])
            if f.get("risk_score") is not None and float(f["risk_score"]) >= HIGH_RISK}


def evaluate(previous, current):
    """Alerts for `current` compared with `previous` (both full results dicts).

    Returns a list of {kind, severity, title, message}. The first analysis of
    a repository (previous is None) is the baseline and raises nothing.
    """
    if not previous or not current:
        return []
    alerts = []

    bf_old, bf_new = previous.get("bus_factor"), current.get("bus_factor")
    if bf_old is not None and bf_new is not None and bf_new < bf_old:
        alerts.append({
            "kind": "bus_factor_drop", "severity": "high" if bf_new <= 1 else "medium",
            "title": f"Bus factor fell from {bf_old} to {bf_new}",
            "message": (f"If {bf_new} developer{'s' if bf_new != 1 else ''} left, half of what the team "
                        "knows about this code would leave too. Spread ownership of the most "
                        "concentrated files."),
        })

    h_old = (previous.get("project_summary") or {}).get("health_score")
    h_new = (current.get("project_summary") or {}).get("health_score")
    if h_old is not None and h_new is not None and h_old - h_new >= HEALTH_DROP:
        alerts.append({
            "kind": "health_drop", "severity": "medium",
            "title": f"Health score fell {h_old - h_new} points ({h_old} → {h_new})",
            "message": "Open the dashboard to see which dimensions got worse.",
        })

    o_old = (previous.get("orphaned_knowledge") or {}).get("orphaned_pct")
    o_new = (current.get("orphaned_knowledge") or {}).get("orphaned_pct")
    if o_old is not None and o_new is not None and o_new - o_old >= ORPHANED_RISE:
        alerts.append({
            "kind": "orphaned_rise", "severity": "medium",
            "title": f"Orphaned knowledge rose to {o_new:.0%} (was {o_old:.0%})",
            "message": "More of the code now belongs to people who stopped contributing.",
        })

    before = _quiet_owners(previous)
    for dev, (share, quiet) in sorted(_quiet_owners(current).items(), key=lambda kv: -kv[1][0]):
        if dev in before:
            continue                      # already reported
        alerts.append({
            "kind": "key_person_quiet", "severity": "high",
            "title": f"{_short(dev)} owns {share:.0%} of the code and hasn't committed in {quiet} days",
            "message": ("If this person is leaving or moving teams, plan a handover now: "
                        "their files are listed on the dashboard's Developers page."),
        })

    risky_before = _high_risk_files(previous)
    new_risky = [(f, r) for f, r in _high_risk_files(current).items() if f not in risky_before]
    for f, r in sorted(new_risky, key=lambda x: -x[1])[:MAX_RISK_ALERTS]:
        alerts.append({
            "kind": "new_high_risk_file", "severity": "medium",
            "title": f"{f} became high risk ({r:.2f})",
            "message": "Knowledge of this widely imported file is concentrated in very few people.",
        })
    return alerts
