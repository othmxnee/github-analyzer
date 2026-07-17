"""Collaboration structure.

* :func:`build_collaboration_network` — a simple developer-to-developer graph
  where an edge means two people worked on the same files. Node size reflects
  activity. (Deliberately simple: no sub-team colouring, no broker scoring.)

Derived from data already in the cleaned dataframe (commit -> files).
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
