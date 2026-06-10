"""Collaboration and co-change structure.

* :func:`build_collaboration_network` — a simple developer-to-developer graph
  where an edge means two people worked on the same files. Node size reflects
  activity. (Deliberately simple: no sub-team colouring, no broker scoring.)

* :func:`build_cochange_coupling` — files that repeatedly change together in the
  same commit. When such a pair is *not* linked by an import in the dependency
  graph, it is hidden/logical coupling — an implicit dependency the structural
  analysis can't see (cf. logical coupling, Gall/Zimmermann).

Both are derived from data already in the cleaned dataframe (commit -> files).
"""

import re as _re
from collections import defaultdict
from itertools import combinations

from utils.metrics import normalize_path

_NOREPLY_PREFIX = _re.compile(r'^\d+[-+]')  # GitHub/GitLab "12345+login" noreply ids


def _short(dev):
    s = str(dev)
    if "@" in s:
        s = s.split("@", 1)[0]
    return _NOREPLY_PREFIX.sub("", s)


def build_collaboration_network(df_files, top_n_devs=30, min_shared_files=2,
                                max_common_ratio=0.5):
    """Developer co-editing graph (simple version).

    Nodes are the ``top_n_devs`` most active developers; an edge connects two
    who both modified at least ``min_shared_files`` files, weighted by the count
    of shared files. Files touched by more than ``max_common_ratio`` of the
    shown developers (a CHANGES log, setup.py, a shared config) are ignored,
    since "everyone edits it" is not real collaboration and would make every
    node connect to every other.
    """
    empty = {"nodes": [], "edges": []}
    if df_files is None or len(df_files) == 0:
        return empty

    activity = df_files["developer_id"].value_counts()
    top_devs = set(activity.head(top_n_devs).index)
    if len(top_devs) < 2:
        return empty

    sub = df_files[df_files["developer_id"].isin(top_devs)]

    file_devs = defaultdict(set)
    for file_id, dev in zip(sub["path"].astype(str), sub["developer_id"]):
        file_devs[file_id].add(dev)

    max_common = max(5, round(max_common_ratio * len(top_devs)))
    pair_shared = defaultdict(int)
    for devs in file_devs.values():
        if len(devs) < 2 or len(devs) > max_common:
            continue
        for a, b in combinations(sorted(devs), 2):
            pair_shared[(a, b)] += 1

    edges = [
        {"source": a, "target": b, "weight": int(w)}
        for (a, b), w in pair_shared.items()
        if w >= min_shared_files
    ]
    connected = {n for e in edges for n in (e["source"], e["target"])}
    nodes = [
        {"id": dev, "label": _short(dev), "activity": int(activity.get(dev, 0))}
        for dev in top_devs if dev in connected
    ]
    return {"nodes": nodes, "edges": edges}


def build_cochange_coupling(df_files, architecture_edges=None,
                            min_support=5, min_confidence=0.5,
                            max_files_per_commit=50, top_n=15):
    """Files that change together but aren't linked by an import.

    For each commit we take its set of files; every co-occurring pair gets a
    support count. Confidence(A->B) = co-changes / changes(A). We keep pairs
    with enough support and confidence that are NOT already connected in the
    dependency graph — those are the hidden/logical couplings.
    """
    if df_files is None or len(df_files) == 0:
        return []

    # Set of import-linked normalized pairs to exclude (structural coupling).
    linked = set()
    for e in (architecture_edges or []):
        s = normalize_path(e.get("source", ""))
        t = normalize_path(e.get("target", ""))
        if s and t:
            linked.add(frozenset((s, t)))

    # commit -> set of normalized file paths
    commit_files = defaultdict(set)
    for h, path in zip(df_files["commit_hash"], df_files["path"].astype(str)):
        commit_files[h].add(normalize_path(path))

    changes = defaultdict(int)       # file -> #commits touching it
    cochange = defaultdict(int)      # frozenset(pair) -> #commits touching both
    for files in commit_files.values():
        if len(files) < 2 or len(files) > max_files_per_commit:
            # Single-file commits give no pair; huge commits (bulk reformat /
            # license headers) add noise, so skip them.
            for f in files:
                changes[f] += 1
            continue
        for f in files:
            changes[f] += 1
        for a, b in combinations(sorted(files), 2):
            cochange[frozenset((a, b))] += 1

    rows = []
    for pair, support in cochange.items():
        if support < min_support or pair in linked:
            continue
        a, b = tuple(pair)
        conf_a = support / changes[a] if changes[a] else 0.0
        conf_b = support / changes[b] if changes[b] else 0.0
        confidence = max(conf_a, conf_b)
        if confidence < min_confidence:
            continue
        rows.append({
            "file_a": a,
            "file_b": b,
            "co_changes": int(support),
            "confidence": round(float(confidence), 2),
        })

    rows.sort(key=lambda r: (r["confidence"], r["co_changes"]), reverse=True)
    return rows[:top_n]
