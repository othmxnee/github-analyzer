"""Every metric, role and timeline value must match the saved snapshot.

The snapshot (tests/golden/sample_repo.json) was produced by the engine as
it was before the 2026-10 performance work, so this test proves those
changes altered no number. If a change is meant to alter results, it must
be agreed first; then regenerate with UPDATE_GOLDEN=1 and review the diff.
"""
import json
import os
import shutil

import pytest
from conftest import TESTS, diff, run_pipeline

GOLDEN = os.path.join(TESTS, "golden", "sample_repo.json")


def test_outputs_match_golden(sample_repo, tmp_path):
    actual = run_pipeline(sample_repo, str(tmp_path / "out.json"))
    if os.environ.get("UPDATE_GOLDEN") == "1" or not os.path.exists(GOLDEN):
        shutil.copy(str(tmp_path / "out.json"), GOLDEN)
        pytest.skip("golden snapshot written; review and commit it")
    with open(GOLDEN) as f:
        expected = json.load(f)
    problems = diff(expected, actual)
    assert not problems, "metric outputs changed:\n  " + "\n  ".join(problems)


def test_snapshot_is_meaningful():
    """Guard against a degenerate fixture silently weakening the test above."""
    with open(GOLDEN) as f:
        g = json.load(f)
    r, s = g["results"], g["skills"]
    assert r["summary"]["total_commits"] >= 60
    assert r["summary"]["merged_aliases"] >= 1                 # alice's two emails
    assert r["orphaned_knowledge"]["orphaned_pct"] > 0         # gary left
    assert r["architecture"]["edges"]                          # imports found
    assert len(set(s["role_distribution"])) >= 3
    assert not any("dependabot" in d["developer"] for d in s["developers"])
