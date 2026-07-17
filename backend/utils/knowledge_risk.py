"""Time-aware knowledge-risk metrics.

The activity pipeline computes ownership, KCI, bus factor and a risk score, but
all of them are *time-blind*: a developer who left three years ago counts
exactly like today's lead, and a critical file nobody has touched in two years
scores like one being changed every day. These helpers fold the time dimension
back in, using data the pipeline already has (per-developer last-commit dates
and per-file last-modified dates).

Two outputs:

* :func:`compute_orphaned_knowledge` — how much of the codebase is owned by
  developers who are no longer active ("knowledge already lost", not just at
  risk). Directly relevant to turnover (cf. Nassif et al. 2017).
* :func:`compute_active_bus_factor` — the bus factor counting only currently
  active developers. The gap to the historical bus factor is the story.

"inactive" / "stale" is defined relative to the repository's most recent commit
(not the wall clock), so the metrics are meaningful for long-dormant repos too.
"""


def _months_between(later, earlier):
    """Approximate whole-ish months between two timestamps (>= 0)."""
    if later is None or earlier is None:
        return 0.0
    seconds = (later - earlier).total_seconds()
    return max(0.0, seconds / (30.4375 * 86400.0))


def compute_dev_last_active(df_commits):
    """Return ({developer_id: last_commit_ts}, reference_ts).

    reference_ts is the repo's most recent commit — the clock against which
    "inactive" is judged.
    """
    if df_commits is None or len(df_commits) == 0:
        return {}, None
    last = df_commits.groupby("developer_id")["author_date"].max()
    reference = df_commits["author_date"].max()
    return {dev: ts for dev, ts in last.items()}, reference


def _inactive_set(dev_last_active, reference, inactive_months):
    if reference is None:
        return set()
    return {
        dev for dev, ts in dev_last_active.items()
        if _months_between(reference, ts) >= inactive_months
    }


def compute_orphaned_knowledge(ownership_results, line_counts,
                               dev_last_active, reference,
                               inactive_months=12, top_n=10):
    """Share of the codebase whose authors are no longer active.

    For each file, the orphaned share is the summed line-ownership of its
    inactive authors. Aggregated over files (weighted by file size) this gives
    the fraction of the codebase that has no remaining active author.
    """
    inactive = _inactive_set(dev_last_active, reference, inactive_months)

    total_lines = 0.0
    orphaned_lines = 0.0
    file_rows = []

    for file_id, owners in ownership_results.items():
        flines = float(line_counts.get(file_id, 0))
        if flines <= 0 or not owners:
            continue
        total_lines += flines
        orphan_share = sum(share for dev, share in owners.items() if dev in inactive)
        orphaned_lines += orphan_share * flines

        dominant_owner, dominant_share = max(owners.items(), key=lambda x: x[1])
        if dominant_owner in inactive and dominant_share >= 0.5:
            file_rows.append({
                "file": file_id,
                "owner": dominant_owner,
                "ownership": round(float(dominant_share), 3),
                "lines": int(flines),
                "last_active": _fmt(dev_last_active.get(dominant_owner)),
                "months_inactive": round(_months_between(reference, dev_last_active.get(dominant_owner)), 1),
            })

    orphaned_files = sorted(
        file_rows, key=lambda r: (r["ownership"], r["lines"]), reverse=True
    )[:top_n]

    pct = (orphaned_lines / total_lines) if total_lines > 0 else 0.0
    return {
        "orphaned_pct": round(pct, 4),
        "orphaned_lines": int(orphaned_lines),
        "total_lines": int(total_lines),
        "inactive_months": inactive_months,
        "inactive_developers": len(inactive),
        "orphaned_files": orphaned_files,
    }


def compute_active_bus_factor(ownership_results, line_counts,
                              dev_last_active, reference,
                              historical_bus_factor=None, inactive_months=12):
    """Bus factor counting only currently-active developers.

    Each developer's ownership is their line-weighted share of the *whole*
    codebase. The active bus factor is the smallest number of active developers
    whose combined ownership reaches 50% of the codebase. If the active team
    together owns less than 50% (the rest is orphaned), the bus factor is the
    full active team and ``reaches_half`` is False — itself an alarming signal.
    """
    inactive = _inactive_set(dev_last_active, reference, inactive_months)

    dev_lines = {}
    total_lines = 0.0
    for file_id, owners in ownership_results.items():
        flines = float(line_counts.get(file_id, 0))
        if flines <= 0:
            continue
        total_lines += flines
        for dev, share in owners.items():
            dev_lines[dev] = dev_lines.get(dev, 0.0) + share * flines

    if total_lines <= 0:
        return {
            "active_bus_factor": 0,
            "historical_bus_factor": historical_bus_factor,
            "active_developers": 0,
            "knowledge_held_by_active_pct": 0.0,
            "reaches_half": False,
            "inactive_months": inactive_months,
            "developers": [],
        }

    active = sorted(
        ((dev, lines) for dev, lines in dev_lines.items() if dev not in inactive),
        key=lambda x: x[1], reverse=True,
    )
    active_share_total = sum(lines for _, lines in active) / total_lines

    cumulative = 0.0
    bus = len(active)
    reaches_half = False
    developers = []
    for i, (dev, lines) in enumerate(active, start=1):
        cumulative += lines / total_lines
        developers.append({"name": dev, "ownership": round(float(lines / total_lines), 3)})
        if not reaches_half and cumulative >= 0.5:
            bus = i
            reaches_half = True

    if not reaches_half:
        bus = len(active)

    return {
        "active_bus_factor": int(bus),
        "historical_bus_factor": historical_bus_factor,
        "active_developers": len(active),
        "knowledge_held_by_active_pct": round(float(active_share_total), 4),
        "reaches_half": reaches_half,
        "inactive_months": inactive_months,
        "developers": developers[:20],
    }


def _fmt(ts):
    if ts is None:
        return None
    try:
        return str(ts.date())
    except Exception:
        return str(ts)[:10]
