import json
import math
import os
import subprocess
import sys

import pytest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(BACKEND, "tests")
sys.path.insert(0, BACKEND)
sys.path.insert(0, os.path.join(TESTS, "fixtures"))

from make_repo import GIT_ENV, build  # noqa: E402

# Hermetic git for the whole session (no user hooks, signing, diff drivers).
os.environ.update(GIT_ENV)

# Values that depend on the wall clock, not on the repository.
VOLATILE_KEYS = {"compare_window", "window", "analyzed_at", "last_commit_days_ago"}  # relative to today
# 2-D projections: tiny float differences across BLAS/numba builds are fine.
LOOSE_KEYS = {"pca_x", "pca_y", "umap_x", "umap_y"}


@pytest.fixture(scope="session")
def sample_repo(tmp_path_factory):
    return build(str(tmp_path_factory.mktemp("repo") / "sample"))


def run_pipeline(repo, out, backend=BACKEND):
    env = {**os.environ, "PYTHONHASHSEED": "0"}
    subprocess.run([sys.executable, os.path.join(TESTS, "run_pipeline.py"), backend, repo, out],
                   check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with open(out) as f:
        return json.load(f)


def diff(expected, actual, path="", out=None, limit=20):
    """Exact structural comparison; returns a list of human-readable differences."""
    out = [] if out is None else out
    if len(out) >= limit:
        return out
    key = path.rsplit(".", 1)[-1]
    if key in VOLATILE_KEYS:
        return out
    if isinstance(expected, dict) and isinstance(actual, dict):
        if list(expected) != list(actual):
            out.append(f"{path}: keys {sorted(set(expected) ^ set(actual)) or 'reordered'}")
        for k in expected:
            if k in actual:
                diff(expected[k], actual[k], f"{path}.{k}", out, limit)
    elif isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            out.append(f"{path}: length {len(expected)} != {len(actual)}")
        for i, (e, a) in enumerate(zip(expected, actual)):
            diff(e, a, f"{path}[{i}]", out, limit)
    elif isinstance(expected, float) and isinstance(actual, (int, float)):
        tol = 1e-4 if key in LOOSE_KEYS else 1e-9
        if not math.isclose(expected, actual, rel_tol=tol, abs_tol=tol):
            out.append(f"{path}: {expected} != {actual}")
    elif expected != actual:
        out.append(f"{path}: {str(expected)[:80]!r} != {str(actual)[:80]!r}")
    return out
