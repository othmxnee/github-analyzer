"""Windowed metric computation.

Reuses the cleaned dataframes cached by services.analyzer so that picking a
date range on the dashboard never re-clones or re-mines the repo. Each
function takes the cached snapshot + (start, end) and returns the metric
shape the frontend already expects.
"""
from collections import OrderedDict
from datetime import datetime, timezone, timedelta

import pandas as pd

from services.analyzer import get_cleaned_data
from utils.metrics import compute_gini, compute_lorenz
from utils.voronoi_treemap import build_voronoi_data


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _to_utc(ts):
    """Parse an ISO-ish string to a UTC pandas.Timestamp, or None."""
    if ts is None or ts == "":
        return None
    t = pd.to_datetime(ts, utc=True, errors="coerce")
    if pd.isna(t):
        return None
    return t


def _slice_by_date(df, start, end):
    """Return df rows with start <= author_date < end.

    Either bound can be None (open-ended). Uses pandas timestamps; tolerant of
    NaT rows by dropping them.
    """
    if df is None or len(df) == 0:
        return df
    mask = df["author_date"].notna()
    if start is not None:
        mask &= df["author_date"] >= start
    if end is not None:
        mask &= df["author_date"] < end
    return df.loc[mask]


def _previous_window(start, end, fallback_days=30):
    """Symmetric previous period: same length, ending at `start`.

    If the window is open-ended on either side we fall back to fallback_days.
    """
    if start is None or end is None:
        delta = timedelta(days=fallback_days)
    else:
        delta = end - start
        if delta.total_seconds() <= 0:
            delta = timedelta(days=fallback_days)
    prev_end = start if start is not None else datetime.now(timezone.utc)
    prev_start = prev_end - delta
    return prev_start, prev_end


def _pct_delta(current, previous):
    """Percentage change from previous→current. Returns None if previous==0."""
    if previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100.0


def _shift_one_year(start, end):
    """Same calendar window, one year earlier. Handles Feb 29 by clamping."""
    if start is None or end is None:
        return None, None
    def _back_one_year(ts):
        try:
            return ts.replace(year=ts.year - 1)
        except ValueError:
            # Feb 29 in a non-leap year → fall back to Feb 28
            return ts.replace(month=2, day=28, year=ts.year - 1)
    return _back_one_year(start), _back_one_year(end)


def _project_bounds(snapshot):
    """First and last commit date across the cleaned snapshot (UTC)."""
    df = snapshot.get("df_commits")
    if df is None or len(df) == 0:
        return None, None
    return df["author_date"].min(), df["author_date"].max()


def _slide_windows(repo_start, repo_end, window_days, stride_days=None):
    """Yield non-overlapping equivalent-length windows across the repo's lifetime.

    stride defaults to window_days (no overlap). Caps at 60 windows so very
    long-lived repos don't blow up the computation.
    """
    if repo_start is None or repo_end is None or window_days <= 0:
        return
    stride = stride_days or window_days
    delta  = timedelta(days=window_days)
    step   = timedelta(days=stride)
    MAX_WINDOWS = 60

    cur = repo_start
    n = 0
    while cur + delta <= repo_end and n < MAX_WINDOWS:
        yield cur, cur + delta
        cur += step
        n += 1


def _average_windows(snapshot, fn, start_ts, end_ts):
    """Compute the metric over each equivalent-length window in the repo's
    history, then return an "averaged" version that matches the same shape.

    For list-style payloads (items/series) the per-key value is averaged
    across all windows (treating missing keys as 0). For scalar fields
    (gini, bus_factor) we plain-mean. For nested totals dicts we mean by
    field. For treemap/voronoi we return the union of nodes with averaged
    `value`s — good enough for the aggregate delta strip.
    """
    if start_ts is None or end_ts is None:
        return None  # can't average without a finite window length

    window_days = max(1, int((end_ts - start_ts).total_seconds() // 86400))
    repo_start, repo_end = _project_bounds(snapshot)
    windows = list(_slide_windows(repo_start, repo_end, window_days))
    if not windows:
        return None

    samples = [fn(snapshot, ws, we) for ws, we in windows]
    return _mean_payload(samples)


def _mean_payload(samples):
    """Mean numeric leaves of a list of payloads with the same shape."""
    if not samples:
        return None
    first = samples[0]
    if first is None:
        return None

    # Items-based (top_developers, top_devs_mods, hotspots)
    if isinstance(first, dict) and "items" in first:
        key_field = next((k for k in ("developer", "file") if first["items"] and k in first["items"][0]), None)
        value_field = next((k for k in ("commits", "modifications") if first["items"] and k in first["items"][0]), None)
        if not key_field or not value_field:
            return first  # fallback

        from collections import defaultdict
        totals = defaultdict(float)
        for sample in samples:
            for it in sample.get("items", []):
                totals[it[key_field]] += it.get(value_field, 0)
        n = len(samples)
        averaged_items = sorted(
            [{key_field: k, value_field: round(v / n, 2)} for k, v in totals.items()],
            key=lambda x: x[value_field],
            reverse=True,
        )[:10]

        # Mean the totals dict
        totals_avg = {}
        for k in (first.get("totals") or {}):
            totals_avg[k] = round(sum(s.get("totals", {}).get(k, 0) for s in samples) / n, 2)

        return {"items": averaged_items, "totals": totals_avg}

    # Points (activity timeline) — return mean of counts as a single-point summary
    if isinstance(first, dict) and "points" in first:
        n = len(samples)
        all_counts = [p["count"] for s in samples for p in s.get("points", [])]
        mean_per_month = sum(all_counts) / max(1, len(all_counts)) if all_counts else 0
        totals_avg = {}
        for k in (first.get("totals") or {}):
            totals_avg[k] = round(sum(s.get("totals", {}).get(k, 0) for s in samples) / n, 2)
        return {"points": [], "totals": totals_avg, "summary_mean": round(mean_per_month, 2)}

    # Series (commit_frequency)
    if isinstance(first, dict) and "series" in first:
        n = len(samples)
        totals_avg = {}
        for k in (first.get("totals") or {}):
            totals_avg[k] = round(sum(s.get("totals", {}).get(k, 0) for s in samples) / n, 2)
        return {"series": [], "totals": totals_avg}

    # Gini / Lorenz
    if isinstance(first, dict) and "gini" in first:
        n = len(samples)
        return {
            "gini":   round(sum(s.get("gini", 0) for s in samples) / n, 4),
            "lorenz": first.get("lorenz", {"x": [0, 1], "y": [0, 1]}),  # not meaningfully averageable
            "totals": {"developers": round(sum(s.get("totals", {}).get("developers", 0) for s in samples) / n, 2)},
        }

    # Bus factor
    if isinstance(first, dict) and "bus_factor" in first:
        n = len(samples)
        return {
            "bus_factor": round(sum(s.get("bus_factor", 0) for s in samples) / n, 2),
            "developers": [],
            "simulation": [],
            "approx":     True,
        }

    # New vs returning
    if isinstance(first, dict) and "new" in first and "returning" in first:
        n = len(samples)
        return {
            "new":       round(sum(s.get("new", 0) for s in samples) / n, 2),
            "returning": round(sum(s.get("returning", 0) for s in samples) / n, 2),
            "totals":    {"developers": round(sum(s.get("totals", {}).get("developers", 0) for s in samples) / n, 2)},
        }

    # Treemap / Voronoi — average node values by id/label
    if isinstance(first, dict) and "nodes" in first:
        from collections import defaultdict
        totals = defaultdict(float)
        labels = {}
        n = len(samples)
        for sample in samples:
            for node in sample.get("nodes", []):
                key = node.get("id") or node.get("label")
                totals[key] += node.get("value", 0)
                labels[key] = node
        avg_nodes = []
        for k, v in totals.items():
            node = dict(labels[k])
            node["value"] = round(v / n, 2)
            avg_nodes.append(node)
        return {"nodes": avg_nodes, "edges": []}

    return first


# ─────────────────────────────────────────────────────────────────────
# Per-metric computations — each returns a JSON-serialisable dict
# ─────────────────────────────────────────────────────────────────────

def _summary_for_window(df_files, df_commits):
    return {
        "total_commits":       int(df_commits["commit_hash"].nunique()) if len(df_commits) else 0,
        "total_developers":    int(df_commits["developer_id"].nunique()) if len(df_commits) else 0,
        "total_files":         int(df_files["path"].nunique()) if len(df_files) else 0,
        "total_modifications": int(len(df_files)),
    }


def _metric_top_developers(snapshot, start, end, top_n=10):
    df_commits = _slice_by_date(snapshot["df_commits"], start, end)
    counts = df_commits.groupby("developer_id").size().sort_values(ascending=False).head(top_n)
    items = [{"developer": dev, "commits": int(c)} for dev, c in counts.items()]
    return {
        "items": items,
        "totals": _summary_for_window(_slice_by_date(snapshot["df_files"], start, end), df_commits),
    }


def _metric_top_devs_mods(snapshot, start, end, top_n=10):
    df_files = _slice_by_date(snapshot["df_files"], start, end)
    counts = df_files.groupby("developer_id").size().sort_values(ascending=False).head(top_n)
    items = [{"developer": dev, "modifications": int(c)} for dev, c in counts.items()]
    return {
        "items": items,
        "totals": _summary_for_window(df_files, _slice_by_date(snapshot["df_commits"], start, end)),
    }


def _metric_hotspots(snapshot, start, end, top_n=10):
    df_files = _slice_by_date(snapshot["df_files"], start, end).copy()
    if len(df_files) == 0:
        return {"items": [], "totals": _summary_for_window(df_files, _slice_by_date(snapshot["df_commits"], start, end))}
    df_files["file_id"] = df_files["path"].astype(str)
    counts = df_files.groupby("file_id").size().sort_values(ascending=False).head(top_n)
    items = [{"file": f, "modifications": int(c)} for f, c in counts.items()]
    return {
        "items": items,
        "totals": _summary_for_window(df_files, _slice_by_date(snapshot["df_commits"], start, end)),
    }


def _metric_activity_timeline(snapshot, start, end):
    """Monthly commit-volume buckets across the window."""
    df_files = _slice_by_date(snapshot["df_files"], start, end)
    if len(df_files) == 0:
        return {"points": [], "totals": {"total_modifications": 0}}
    series = df_files.set_index("author_date").resample("ME").size()
    points = [{"date": str(idx), "count": int(c)} for idx, c in series.items()]
    return {
        "points": points,
        "totals": {"total_modifications": int(len(df_files))},
    }


def _metric_commit_frequency(snapshot, start, end, top_n=5):
    """Per-developer monthly activity, top-N devs in the window."""
    df_files = _slice_by_date(snapshot["df_files"], start, end)
    if len(df_files) == 0:
        return {"series": [], "totals": {"developers": 0}}
    top_devs = df_files["developer_id"].value_counts().head(top_n).index
    sub = df_files[df_files["developer_id"].isin(top_devs)]
    grouped = (sub.set_index("author_date")
                  .groupby("developer_id")
                  .resample("ME")
                  .size()
                  .reset_index(name="activity"))
    series = []
    for dev in top_devs:
        rows = grouped[grouped["developer_id"] == dev]
        series.append({
            "developer": dev,
            "points": [{"date": str(r["author_date"]), "count": int(r["activity"])} for _, r in rows.iterrows()],
        })
    return {"series": series, "totals": {"developers": int(len(top_devs))}}


def _metric_gini_lorenz(snapshot, start, end):
    df_files = _slice_by_date(snapshot["df_files"], start, end)
    if len(df_files) == 0:
        return {"gini": 0.0, "lorenz": {"x": [0, 1], "y": [0, 1]}, "totals": {"developers": 0}}
    dev_activity = df_files.groupby("developer_id").size().sort_values(ascending=False)
    gini = compute_gini(dev_activity.values)
    lorenz = compute_lorenz(dev_activity)
    return {
        "gini":   float(gini),
        "lorenz": lorenz,
        "totals": {"developers": int(len(dev_activity))},
    }


def _metric_new_returning(snapshot, start, end):
    """New contributors in window vs returning contributors.

    A developer is "new" if their first ever commit (across full history)
    falls inside the window. "Returning" if their first commit predates
    the window but they committed inside it.
    """
    df_commits = snapshot["df_commits"]
    if len(df_commits) == 0 or start is None and end is None:
        return {"new": 0, "returning": 0, "totals": {"developers": 0}}

    # Global first-commit per developer
    first_seen = df_commits.groupby("developer_id")["author_date"].min()
    active_in_window = set(_slice_by_date(df_commits, start, end)["developer_id"].unique())

    new = 0
    returning = 0
    for dev in active_in_window:
        ts = first_seen.get(dev)
        if ts is None:
            continue
        is_new = True
        if start is not None and ts < start:
            is_new = False
        if end is not None and ts >= end:
            is_new = False
        if is_new:
            new += 1
        else:
            returning += 1
    return {
        "new": int(new),
        "returning": int(returning),
        "totals": {"developers": int(new + returning)},
    }


def _metric_bus_factor(snapshot, start, end):
    """Bus factor for a window, approximated from churn-based ownership.

    Note: the global bus factor uses git-blame line ownership against the
    final tree. That can't be recomputed for an arbitrary window (the repo
    is gone after analysis), so we substitute churn-based ownership which is
    a reasonable proxy: per-developer share of total lines added+deleted in
    the window. Bus factor = smallest set of devs whose combined share >=50%.
    """
    df_files = _slice_by_date(snapshot["df_files"], start, end)
    if len(df_files) == 0 or "churn" not in df_files.columns:
        return {"bus_factor": 0, "developers": [], "simulation": [], "approx": True}

    dev_churn = df_files.groupby("developer_id")["churn"].sum().sort_values(ascending=False)
    total = float(dev_churn.sum())
    if total <= 0:
        return {"bus_factor": 0, "developers": [], "simulation": [], "approx": True}

    developers = [{"name": d, "ownership": float(v / total)} for d, v in dev_churn.items()]
    simulation = []
    cumulative = 0.0
    bus = len(dev_churn)
    found = False
    for i, (_, v) in enumerate(dev_churn.items(), start=1):
        cumulative += v / total
        simulation.append({"removed": i, "knowledge_lost": float(min(cumulative, 1.0))})
        if not found and cumulative >= 0.5:
            bus = i
            found = True
    return {
        "bus_factor":  int(bus),
        "developers":  developers[:20],
        "simulation":  simulation,
        "approx":      True,
    }


def _metric_voronoi(snapshot, start, end):
    """Windowed Voronoi: file activity comes from the window; KCI/ownership
    overlays come from the global snapshot (line ownership can't be windowed
    without re-running git blame)."""
    df_files = _slice_by_date(snapshot["df_files"], start, end).copy()
    if len(df_files) == 0:
        return {"nodes": [], "edges": []}
    df_files["file_id"] = df_files["path"].astype(str)
    return build_voronoi_data(
        df_files,
        snapshot.get("architecture", {"nodes": [], "edges": []}),
        snapshot.get("kci_data", {}),
        snapshot.get("ownership_results", {}),
        repo_root=None,  # repo is gone; build_voronoi_data tolerates this
    )


# ─────────────────────────────────────────────────────────────────────
# Comparison wrapping + LRU cache
# ─────────────────────────────────────────────────────────────────────

_METRICS = {
    "top_developers":   {"fn": _metric_top_developers, "warn_min_days": 0},
    "top_devs_mods":    {"fn": _metric_top_devs_mods,  "warn_min_days": 0},
    "hotspots":         {"fn": _metric_hotspots,       "warn_min_days": 0},
    "activity":         {"fn": _metric_activity_timeline, "warn_min_days": 0},
    "commit_frequency": {"fn": _metric_commit_frequency,  "warn_min_days": 0},
    "gini_lorenz":      {"fn": _metric_gini_lorenz,    "warn_min_days": 30},
    "new_returning":    {"fn": _metric_new_returning,  "warn_min_days": 14},
    "bus_factor":       {"fn": _metric_bus_factor,     "warn_min_days": 30},
    "voronoi":          {"fn": _metric_voronoi,        "warn_min_days": 0},
}


def list_metrics():
    return sorted(_METRICS.keys())


# Small process-local LRU. Keys are (repo_url, metric, start_iso, end_iso, compare).
_LRU = OrderedDict()
_LRU_MAX = 256


def _cache_get(key):
    if key in _LRU:
        _LRU.move_to_end(key)
        return _LRU[key]
    return None


def _cache_set(key, value):
    _LRU[key] = value
    _LRU.move_to_end(key)
    while len(_LRU) > _LRU_MAX:
        _LRU.popitem(last=False)


def invalidate_for_repo(repo_url):
    """Drop every cached entry tied to a repo (called on re-analysis)."""
    keys = [k for k in _LRU if k[0] == repo_url]
    for k in keys:
        _LRU.pop(k, None)


COMPARE_MODES = ("previous", "last_year", "average")


def compute_metric(repo_url, metric, start=None, end=None, compare=False, compare_mode="previous"):
    if metric not in _METRICS:
        raise ValueError(f"Unknown metric '{metric}'. Available: {', '.join(list_metrics())}")
    if compare_mode not in COMPARE_MODES:
        raise ValueError(f"Unknown compare_mode '{compare_mode}'. Available: {', '.join(COMPARE_MODES)}")

    start_ts = _to_utc(start)
    end_ts   = _to_utc(end)

    cache_key = (repo_url, metric, start, end, bool(compare), compare_mode if compare else None)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    snapshot = get_cleaned_data(repo_url)
    spec     = _METRICS[metric]
    fn       = spec["fn"]

    current = fn(snapshot, start_ts, end_ts)

    # Warning when the window is too small for a metric that needs density
    warning = None
    if spec["warn_min_days"] > 0 and start_ts is not None and end_ts is not None:
        days = (end_ts - start_ts).total_seconds() / 86400.0
        if days < spec["warn_min_days"]:
            warning = (
                f"Window is {int(days)} days — this metric is noisy below "
                f"{spec['warn_min_days']} days. Interpret with caution."
            )

    payload = {
        "metric":  metric,
        "window":  {"start": start, "end": end},
        "current": current,
        "warning": warning,
    }

    if compare:
        prev_start, prev_end, mode_label, mode_warning = _resolve_compare_window(
            snapshot, start_ts, end_ts, compare_mode
        )
        if mode_warning:
            # Comparison not possible (e.g. repo younger than 1 year for last_year);
            # surface a warning but still return current data so the chart renders.
            payload["compare_unavailable"] = mode_warning
        else:
            if compare_mode == "average":
                previous = _average_windows(snapshot, fn, start_ts, end_ts)
            else:
                previous = fn(snapshot, prev_start, prev_end)
            if previous is not None:
                payload["previous"] = previous
                payload["compare_window"] = {
                    "start": prev_start.isoformat() if prev_start else None,
                    "end":   prev_end.isoformat()   if prev_end   else None,
                    "mode":  compare_mode,
                    "label": mode_label,
                }
                payload["delta"] = _build_delta(metric, current, previous)
            else:
                payload["compare_unavailable"] = "Not enough history to compute this comparison."

    _cache_set(cache_key, payload)
    return payload


def _resolve_compare_window(snapshot, start_ts, end_ts, mode):
    """Return (prev_start, prev_end, label, warning). Warning is set if the
    requested comparison isn't possible given the repo's history."""
    repo_start, repo_end = _project_bounds(snapshot)

    if mode == "previous":
        prev_start, prev_end = _previous_window(start_ts, end_ts)
        if start_ts and end_ts:
            days = int((end_ts - start_ts).total_seconds() // 86400) or 1
            label = f"previous {days} days"
        else:
            label = "previous period"
        return prev_start, prev_end, label, None

    if mode == "last_year":
        if start_ts is None or end_ts is None:
            return None, None, None, "Pick a finite window to enable yearly comparison."
        prev_start, prev_end = _shift_one_year(start_ts, end_ts)
        if repo_start is not None and prev_end < repo_start:
            return None, None, None, "Repository has no data from 1 year before this window."
        return prev_start, prev_end, "same period, last year", None

    if mode == "average":
        if start_ts is None or end_ts is None:
            return None, None, None, "Pick a finite window to enable average comparison."
        days = int((end_ts - start_ts).total_seconds() // 86400) or 1
        return None, None, f"avg {days}-day window across project history", None

    return None, None, None, f"Unknown compare mode: {mode}"


# ─────────────────────────────────────────────────────────────────────
# Delta builders — per-metric, since the shape differs
# ─────────────────────────────────────────────────────────────────────

def _build_delta(metric, current, previous):
    """Return per-metric delta summary: aggregate + per-item where applicable."""
    if metric in ("top_developers", "top_devs_mods", "hotspots"):
        # Aggregate from totals + per-item by key
        key_field, value_field = {
            "top_developers": ("developer", "commits"),
            "top_devs_mods":  ("developer", "modifications"),
            "hotspots":       ("file", "modifications"),
        }[metric]

        prev_map = {it[key_field]: it[value_field] for it in previous.get("items", [])}
        per_item = []
        for it in current.get("items", []):
            prev_val = prev_map.get(it[key_field])
            per_item.append({
                "key":      it[key_field],
                "current":  it[value_field],
                "previous": prev_val,
                "pct":      _pct_delta(it[value_field], prev_val),
            })

        cur_total  = current.get("totals", {}).get("total_modifications", 0) or current.get("totals", {}).get("total_commits", 0)
        prev_total = previous.get("totals", {}).get("total_modifications", 0) or previous.get("totals", {}).get("total_commits", 0)
        return {
            "aggregate": {"current": cur_total, "previous": prev_total, "pct": _pct_delta(cur_total, prev_total)},
            "per_item":  per_item,
        }

    if metric == "activity":
        cur = current.get("totals", {}).get("total_modifications", 0)
        prev = previous.get("totals", {}).get("total_modifications", 0)
        return {"aggregate": {"current": cur, "previous": prev, "pct": _pct_delta(cur, prev)}}

    if metric == "gini_lorenz":
        cur = current.get("gini", 0.0)
        prev = previous.get("gini", 0.0)
        return {
            "aggregate": {
                "current":  cur,
                "previous": prev,
                "pct":      _pct_delta(cur, prev),
                "abs_diff": float(cur - prev),
            },
        }

    if metric == "new_returning":
        return {
            "new":       {"current": current["new"],       "previous": previous["new"],       "pct": _pct_delta(current["new"], previous["new"])},
            "returning": {"current": current["returning"], "previous": previous["returning"], "pct": _pct_delta(current["returning"], previous["returning"])},
        }

    if metric == "bus_factor":
        cur = current.get("bus_factor", 0)
        prev = previous.get("bus_factor", 0)
        return {"aggregate": {"current": cur, "previous": prev, "pct": _pct_delta(cur, prev), "abs_diff": int(cur - prev)}}

    if metric == "voronoi":
        # Aggregate = total nodes / total value
        def _sum_values(data):
            nodes = data.get("nodes") if isinstance(data, dict) else None
            if nodes:
                return sum((n.get("value", 0) for n in nodes), 0)
            vals = data.get("values") if isinstance(data, dict) else None
            return int(sum(vals)) if vals else 0
        cur = _sum_values(current)
        prev = _sum_values(previous)
        return {"aggregate": {"current": cur, "previous": prev, "pct": _pct_delta(cur, prev)}}

    if metric == "commit_frequency":
        cur = current.get("totals", {}).get("developers", 0)
        prev = previous.get("totals", {}).get("developers", 0)
        return {"aggregate": {"current": cur, "previous": prev, "pct": _pct_delta(cur, prev)}}

    return {}
