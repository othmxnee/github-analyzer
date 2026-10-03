"""Storing analyses (DATABASE_URL set): runs survive restarts, history, privacy.

Runs on SQLite by default. Point TEST_DATABASE_URL at a PostgreSQL database
to run the same tests there (CI does both).
"""
import json
import os
import time

import pytest
from sqlalchemy import text

import db
from services import access, analyzer, skill_service, store, timeline_service

URL = "https://github.com/example/sample"


@pytest.fixture
def database(tmp_path):
    url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/test.db"
    db.configure(url)
    if db.engine().dialect.name == "postgresql":
        with db.engine().begin() as c:
            c.execute(text("DROP TABLE IF EXISTS analysis_runs, repositories, alembic_version CASCADE"))
    db.upgrade()
    forget(URL)
    yield db
    forget(URL)
    db.configure(None)


@pytest.fixture(scope="module")
def client():
    os.environ.pop("GA_LOCAL_MODE", None)
    from app import app
    return app.test_client()


def forget(url):
    """Simulate a server restart: drop everything this process holds in memory."""
    for d in (analyzer._ANALYSIS_CACHE, analyzer._ANALYSIS_STATUS, analyzer._ANALYSIS_PHASE,
              analyzer._ANALYSIS_TIMESTAMPS, analyzer._CLEANED_CACHE, analyzer._RUN_IDS,
              analyzer._REPO_PRIVATE):
        d.pop(url, None)
    skill_service.invalidate_for_repo(url)
    timeline_service.invalidate_for_repo(url)


def analyze(url, repo, timeout=300, **kw):
    analyzer.start_analysis(url, local_path=repo, **kw)
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = analyzer.get_analysis_result(url)
        if r["status"] in ("done", "error"):
            return r
        time.sleep(0.2)
    raise TimeoutError


def norm(x):
    return json.loads(json.dumps(x, sort_keys=True, default=str))


def runs(**filters):
    from models import AnalysisRun
    with db.session() as s:
        return s.query(AnalysisRun).filter_by(**filters).order_by(AnalysisRun.id).all()


def test_run_is_stored_and_survives_a_restart(database, sample_repo):
    first = analyze(URL, sample_repo)
    assert first["status"] == "done", first.get("error")
    metric_before = timeline_service.compute_metric(URL, "bus_factor", compare=True)

    [run] = runs(status="done")
    assert run.head_sha and len(run.head_sha) == 40
    assert run.bus_factor == first["bus_factor"]
    assert run.health_score == first["project_summary"]["health_score"]
    assert run.total_commits == first["summary"]["total_commits"]
    assert run.gini == pytest.approx(first["gini"])

    forget(URL)
    again = analyzer.get_analysis_result(URL)
    assert again["status"] == "done"
    strip = lambda r: {k: v for k, v in r.items() if k != "analyzed_at"}  # noqa: E731
    assert norm(strip(again)) == norm(strip(first))
    metric_after = timeline_service.compute_metric(URL, "bus_factor", compare=True)
    assert norm({k: v for k, v in metric_after.items() if k != "compare_window"}) == \
           norm({k: v for k, v in metric_before.items() if k != "compare_window"})


def test_restart_respects_the_cache_ttl(database, sample_repo):
    analyze(URL, sample_repo)
    forget(URL)
    assert analyzer.start_analysis(URL, local_path=sample_repo)["status"] == "done"  # fresh: reused
    assert len(runs()) == 1


def test_roles_are_stored_once_and_restored(database, sample_repo, client):
    analyze(URL, sample_repo)
    client.post("/analyze/skills", json={"repo_url": URL})
    t0 = time.time()
    while True:
        res = client.get(f"/analyze/skills/result?repo_url={URL}").get_json()
        if res["status"] in ("done", "error") or time.time() - t0 > 300:
            break
        time.sleep(0.3)
    assert res["status"] == "done"
    [run] = runs(status="done")
    assert run.skills_gz is not None

    forget(URL)
    restored = client.get(f"/analyze/skills/result?repo_url={URL}").get_json()
    assert restored["status"] == "done"
    assert {d["developer"]: d["role"] for d in restored["developers"]} == \
           {d["developer"]: d["role"] for d in res["developers"]}


def test_history_lists_every_run_newest_first(database, sample_repo, client):
    analyze(URL, sample_repo)
    analyze(URL, sample_repo, force=True, trigger="scheduled")
    body = client.get(f"/history?repo_url={URL}").get_json()
    assert body["enabled"] is True
    assert [r["trigger"] for r in body["runs"]] == ["scheduled", "manual"]
    assert all(r["bus_factor"] is not None and r["health_score"] is not None for r in body["runs"])


def test_retention_drops_old_blobs_but_keeps_numbers(database, sample_repo, monkeypatch):
    monkeypatch.setattr(store, "KEEP_CLEANED", 1)
    monkeypatch.setattr(store, "KEEP_RESULTS", 1)
    analyze(URL, sample_repo)
    analyze(URL, sample_repo, force=True)
    old, new = runs(status="done")
    assert old.cleaned_gz is None and old.result_gz is None
    assert old.bus_factor == new.bus_factor
    assert new.cleaned_gz is not None and new.result_gz is not None


def test_failed_run_is_recorded(database, tmp_path):
    url = "https://github.com/example/missing"
    forget(url)
    r = analyze(url, str(tmp_path / "does-not-exist"))
    assert r["status"] == "error"
    from models import AnalysisRun, Repository
    with db.session() as s:
        run = s.query(AnalysisRun).join(Repository).filter(Repository.url == url).one()
        assert run.status == "error" and run.error
    forget(url)


def test_private_results_need_read_access(database, sample_repo, client, monkeypatch):
    analyze(URL, sample_repo, private=True)
    assert client.get(f"/analyze/result?repo_url={URL}").status_code == 403
    assert client.get(f"/history?repo_url={URL}").status_code == 403
    assert client.post("/analyze", json={"repo_url": URL}).status_code == 403

    forget(URL)                                  # after a restart the flag comes from the DB
    assert client.get(f"/analyze/result?repo_url={URL}").status_code == 403
    assert client.get(f"/metric/bus_factor?repo_url={URL}").status_code == 403

    monkeypatch.setattr(access, "can_read", lambda url, token: True)
    assert client.get(f"/analyze/result?repo_url={URL}").get_json()["status"] == "done"


def test_database_errors_never_break_an_analysis(sample_repo, tmp_path):
    db.configure(f"sqlite:///{tmp_path}/no/such/dir/x.db")      # cannot be opened
    try:
        forget(URL)
        assert analyze(URL, sample_repo)["status"] == "done"
    finally:
        forget(URL)
        db.configure(None)


def test_without_a_database_nothing_is_stored(sample_repo, client):
    db.configure(None)
    forget(URL)
    assert not store.enabled()
    assert analyze(URL, sample_repo)["status"] == "done"
    assert client.get(f"/history?repo_url={URL}").get_json() == {"repo_url": URL, "enabled": False, "runs": []}
    forget(URL)


def test_migrations_match_the_models(database):
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    import models  # noqa: F401
    with db.engine().connect() as conn:
        diffs = compare_metadata(MigrationContext.configure(conn), db.Base.metadata)
    assert diffs == []
