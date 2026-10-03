"""The fast `git log` reader must return exactly what PyDriller returned."""
import os
import subprocess

from services import analyzer
from services.git_extract import extract_with_git


def _pydriller(path, monkeypatch):
    monkeypatch.setenv("GA_EXTRACTOR", "pydriller")
    return analyzer.extract_data(path)


def _normalise(rows):
    out = []
    for r in rows:
        d = dict(r)
        d["author_date"] = (d["author_date"], str(d["author_date"]), d["author_date"].utcoffset())
        out.append(d)
    return out


def _assert_same(a, b):
    assert len(a) == len(b)
    for x, y in zip(_normalise(a), _normalise(b)):
        assert list(x) == list(y)
        assert x == y


def test_full_history_matches_pydriller(sample_repo, monkeypatch):
    commits_pd, files_pd = _pydriller(sample_repo, monkeypatch)
    commits_git, files_git = extract_with_git(sample_repo, None)
    _assert_same(commits_pd, commits_git)
    _assert_same(files_pd, files_git)
    assert any(c["is_merge"] for c in commits_git)          # merge covered
    assert any(f["change_type"] == "RENAME" for f in files_git)
    assert any(f["change_type"] == "DELETE" for f in files_git)


def test_commit_window_matches_pydriller(sample_repo, monkeypatch, tmp_path):
    # Shallow clone + a small MAX_COMMITS exercises the "N most recent" path.
    shallow = str(tmp_path / "shallow")
    subprocess.run(["git", "clone", "-q", "--no-local", "--depth=41", "--single-branch",
                    sample_repo, shallow], check=True)
    monkeypatch.setattr(analyzer, "MAX_COMMITS", 40)
    commits_pd, files_pd = _pydriller(shallow, monkeypatch)
    monkeypatch.delenv("GA_EXTRACTOR")
    commits_fast, files_fast = analyzer.extract_data(shallow)   # default path = fast reader
    assert len(commits_fast) == 40
    _assert_same(commits_pd, commits_fast)
    _assert_same(files_pd, files_fast)


def test_falls_back_to_pydriller_on_reader_error(sample_repo, monkeypatch):
    import services.git_extract as ge

    def boom(*a, **k):
        raise RuntimeError("simulated reader failure")
    monkeypatch.setattr(ge, "extract_with_git", boom)
    commits, files = analyzer.extract_data(sample_repo)
    assert len(commits) == int(subprocess.run(
        ["git", "-C", sample_repo, "rev-list", "--count", "HEAD"],
        capture_output=True, text=True, check=True).stdout)
    assert files
