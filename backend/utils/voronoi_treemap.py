"""
voronoi_treemap.py
------------------
Computes 2-D positions for files using a spring / force-directed layout so
that files connected by import relationships are placed close together.

Each node now carries a `kci` field (0.0 – 1.0) representing knowledge
concentration (max single-owner share from git blame). This is rendered
as a small coloured dot on the frontend.
"""

from __future__ import annotations

import fnmatch
import math
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# Filter rules
# ---------------------------------------------------------------------------

_IGNORED_DIR_PREFIXES = (
    "test", "tests", "example", "examples",
    "doc", "docs", "fixture", "fixtures",
)

_IGNORED_FILENAME_PATTERNS = (
    "run-*", "run_*",
    "make-*", "make_*",
    "*-upgrade*", "*_upgrade*",
    "*migrate*", "*tester*",
    "setup.py", "setup_*.py",
    "conftest*.py",
    "manage.py", "wsgi.py", "asgi.py",
)

_MIN_MODS = 5


def _is_ignored(path: str) -> bool:
    parts = [p.strip().lower() for p in path.split("/") if p.strip()]
    if not parts:
        return True
    if any(
        any(part.startswith(prefix) for prefix in _IGNORED_DIR_PREFIXES)
        for part in parts
    ):
        return True
    return any(fnmatch.fnmatch(parts[-1], pat) for pat in _IGNORED_FILENAME_PATTERNS)


# ---------------------------------------------------------------------------
# Path normalisation
# ---------------------------------------------------------------------------

def _normalize(path: str) -> str:
    p = str(path or "").replace("\\", "/").strip().lstrip("./").strip("/")
    while "//" in p:
        p = p.replace("//", "/")
    if p.startswith("src/"):
        p = p[4:]
    return p


# ---------------------------------------------------------------------------
# Label builder
# ---------------------------------------------------------------------------

def _make_label(full_path: str) -> str:
    parts = [p for p in full_path.split("/") if p]
    filename = parts[-1] if parts else full_path
    if filename == "__init__.py" and len(parts) >= 2:
        return f"{parts[-2]}/__init__.py"
    return filename


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_voronoi_data(
    df_files,
    architecture_data: dict[str, Any],
    kci_data: dict[str, float] | None = None,
    top_n: int = 80,
) -> dict[str, Any]:
    """
    Parameters
    ----------
    df_files          : pandas DataFrame with 'file_id' and 'commit_hash'
    architecture_data : {'nodes': [...], 'edges': [...]}
    kci_data          : {raw_file_path: kci_float}  — from compute_kci()
                        Keys are normalized internally so path format doesn't matter.
    top_n             : max number of nodes

    Returns
    -------
    {
        'nodes': [{'id', 'label', 'path', 'x', 'y', 'value', 'kci'}, ...],
        'edges': [{'source', 'target'}, ...]
    }
    """
    if df_files is None or len(df_files) == 0:
        return {"nodes": [], "edges": []}

    # Build KCI lookup with multiple key variants so path format never causes a miss.
    # For each raw key we store: normalized full path, basename, and last-2-parts.
    # When looking up, we try all three variants in order.
    kci_norm:      dict[str, float] = {}   # normalized full path  → score
    kci_by_name:   dict[str, float] = {}   # bare filename         → score
    kci_by_tail2:  dict[str, float] = {}   # parent/filename       → score

    if kci_data:
        for raw_path, score in kci_data.items():
            norm  = _normalize(raw_path)
            parts = [p for p in norm.split("/") if p]
            name  = parts[-1] if parts else norm
            tail2 = "/".join(parts[-2:]) if len(parts) >= 2 else norm

            kci_norm[norm]       = float(score)
            kci_by_name[name]    = float(score)
            kci_by_tail2[tail2]  = float(score)

    def _lookup_kci(file_id: str) -> float:
        parts = [p for p in file_id.split("/") if p]
        name  = parts[-1] if parts else file_id
        tail2 = "/".join(parts[-2:]) if len(parts) >= 2 else file_id
        return (
            kci_norm.get(file_id)
            or kci_by_tail2.get(tail2)
            or kci_by_name.get(name)
            or -1.0
        )

    # ── 1. Modification counts ────────────────────────────────────────────
    files = df_files[["file_id", "commit_hash"]].dropna().drop_duplicates().copy()
    files["file_id"] = files["file_id"].apply(_normalize)
    files = files[files["file_id"] != ""]
    files = files[~files["file_id"].apply(_is_ignored)]

    if files.empty:
        return {"nodes": [], "edges": []}

    mod_counts = (
        files.groupby("file_id")["commit_hash"]
        .nunique()
        .sort_values(ascending=False)
    )
    mod_counts = mod_counts[mod_counts >= _MIN_MODS].head(top_n)

    if mod_counts.empty:
        return {"nodes": [], "edges": []}

    file_set = set(mod_counts.index)

    # ── 2. Import edges ───────────────────────────────────────────────────
    raw_edges: list[tuple[str, str]] = []
    seen_edges: set[frozenset] = set()

    for edge in architecture_data.get("edges", []):
        src = _normalize(edge.get("source", "") or "")
        tgt = _normalize(edge.get("target", "") or "")
        key = frozenset({src, tgt})
        if (
            src and tgt
            and src != tgt
            and src in file_set
            and tgt in file_set
            and key not in seen_edges
        ):
            raw_edges.append((src, tgt))
            seen_edges.add(key)

    # ── 3. Force layout ───────────────────────────────────────────────────
    node_list = list(mod_counts.index)
    n = len(node_list)
    idx = {node: i for i, node in enumerate(node_list)}
    positions = _fruchterman_reingold(n, raw_edges, idx, iterations=300)

    # ── 4. Normalise positions to [0, 1] ─────────────────────────────────
    def norm_axis(arr):
        lo, hi = arr.min(), arr.max()
        span = hi - lo if hi != lo else 1.0
        return 0.05 + (arr - lo) / span * 0.90

    xs_n = norm_axis(positions[:, 0])
    ys_n = norm_axis(positions[:, 1])

    # ── 5. Build output ───────────────────────────────────────────────────
    nodes = []
    for i, file_id in enumerate(node_list):
        kci_score = _lookup_kci(file_id)

        nodes.append({
            "id":    file_id,
            "label": _make_label(file_id),
            "path":  file_id,
            "x":     float(round(xs_n[i], 6)),
            "y":     float(round(ys_n[i], 6)),
            "value": int(mod_counts[file_id]),
            "kci":   round(kci_score, 3),   # -1.0 means "no data"
        })

    edges = [{"source": s, "target": t} for s, t in raw_edges]
    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Fruchterman-Reingold — division-by-zero safe
# ---------------------------------------------------------------------------

def _fruchterman_reingold(
    n: int,
    edges: list[tuple[str, str]],
    idx: dict[str, int],
    iterations: int = 300,
    seed: int = 42,
) -> np.ndarray:
    rng = np.random.default_rng(seed)

    angles = np.linspace(0, 2 * math.pi, n, endpoint=False)
    pos = np.column_stack([np.cos(angles), np.sin(angles)]).astype(float)
    pos += rng.uniform(-0.01, 0.01, pos.shape)

    k       = math.sqrt(4.0 / max(n, 1))
    temp    = 1.0
    cooling = temp / (iterations + 1)

    adj: list[list[int]] = [[] for _ in range(n)]
    for src, tgt in edges:
        si, ti = idx.get(src, -1), idx.get(tgt, -1)
        if si >= 0 and ti >= 0:
            adj[si].append(ti)
            adj[ti].append(si)

    for _ in range(iterations):
        disp = np.zeros_like(pos)

        # Repulsion
        diff     = pos[:, None, :] - pos[None, :, :]
        dist     = np.linalg.norm(diff, axis=2)
        dist_safe = np.where(dist < 1e-9, 1e-9, dist)
        np.fill_diagonal(dist_safe, 1e-9)
        rep_mag  = (k * k) / dist_safe
        unit     = diff / dist_safe[:, :, None]
        disp    += (rep_mag[:, :, None] * unit).sum(axis=1)

        # Attraction
        for i, neighbours in enumerate(adj):
            for j in neighbours:
                if j <= i:
                    continue
                d       = pos[j] - pos[i]
                dist_ij = max(float(np.linalg.norm(d)), 1e-9)
                force   = dist_ij * dist_ij / k
                unit_ij = d / dist_ij
                disp[i] += force * unit_ij
                disp[j] -= force * unit_ij

        # Cap to temperature
        disp_len = np.linalg.norm(disp, axis=1, keepdims=True)
        disp_len = np.where(disp_len < 1e-9, 1e-9, disp_len)
        pos += disp / disp_len * np.minimum(disp_len, temp)
        pos  = np.clip(pos, -2.0, 2.0)
        temp = max(temp - cooling, 0.001)

    return pos