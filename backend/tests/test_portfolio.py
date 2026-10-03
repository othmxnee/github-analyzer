"""Company-wide view: the signed-in user's watched repositories and people."""
import os

import pytest

import db
from services import store, watches

A, B, C = (f"https://github.com/acme/{n}" for n in ("api", "web", "other"))


def results(health, bus, owners, last=None):
    last = last or {}
    return {
        "project_summary": {"health_score": health, "risk_level": "High"},
        "bus_factor": bus, "gini": 0.5,
        "summary": {"total_commits": 100, "total_developers": len(owners), "total_files": 10},
        "active_bus_factor": {"active_bus_factor": bus},
        "orphaned_knowledge": {"orphaned_pct": 0.1},
        "busfactor_simulation": {"developers": [{"name": d, "ownership": s} for d, s in owners]},
        "dev_stats": {d: {"last_commit": last.get(d, "2024-01-01")} for d, _ in owners},
    }


def store_run(url, res):
    rid = store.run_started(url)
    store.run_finished(rid, res, cleaned={"cleaned": {}, "prebuilt": None}, head_sha="a" * 40)
    return rid


@pytest.fixture
def database(tmp_path):
    db.configure(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/p.db")
    if db.engine().dialect.name == "postgresql":
        from sqlalchemy import text
        with db.engine().begin() as c:
            c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    db.upgrade()
    yield
    db.configure(None)


@pytest.fixture
def client():
    os.environ.pop("GA_LOCAL_MODE", None)
    from app import app
    return app.test_client()


def sign_in(client, login):
    with client.session_transaction() as s:
        s["github_user"] = {"login": login}


def test_requires_sign_in(database, client):
    assert client.get("/portfolio").status_code == 401
    assert client.get("/portfolio/people").status_code == 401


def test_repositories_riskiest_first_with_changes(database, client):
    store_run(A, results(70, 3, [("ann@acme.io", 0.6), ("bo@acme.io", 0.4)]))
    store_run(A, results(55, 2, [("ann@acme.io", 0.6), ("bo@acme.io", 0.4)]))       # got worse
    rid_b = store_run(B, results(30, 1, [("bo@acme.io", 0.3), ("cy@acme.io", 0.25)]))
    store_run(C, results(10, 1, [("zed@else.io", 1.0)]))
    watches.create(A, "github", "alice", slack_webhook_url="https://hooks.slack.com/services/x")
    watches.create(B, "github", "alice", slack_webhook_url="https://hooks.slack.com/services/x")
    watches.create(C, "github", "mallory", slack_webhook_url="https://hooks.slack.com/services/x")
    repo_b_id = watches.watched_repositories()[1]["id"]
    watches.record(repo_b_id, rid_b, [{"kind": "health_drop", "severity": "medium",
                                       "title": "t", "message": "m"}])
    sign_in(client, "alice")

    rows = client.get("/portfolio").get_json()["repositories"]
    assert [r["repo_url"] for r in rows] == [B, A]                # C belongs to someone else
    b, a = rows
    assert (b["health_score"], b["bus_factor"], b["alerts_30d"]) == (30, 1, 1)
    assert (a["health_change"], a["bus_factor_change"]) == (-15, -1)
    assert b["health_change"] is None                             # only one run so far


def test_people_ranked_by_critical_repositories(database, client):
    store_run(A, results(50, 2, [("ann@acme.io", 0.6), ("bo@acme.io", 0.4)]))
    store_run(B, results(40, 1, [("bo@acme.io", 0.3), ("cy@acme.io", 0.25), ("ann@acme.io", 0.2)]))
    for url in (A, B):
        watches.create(url, "github", "alice", slack_webhook_url="https://hooks.slack.com/services/x")
    sign_in(client, "alice")

    people = client.get("/portfolio/people").get_json()["people"]
    by = {p["developer"]: p for p in people}
    assert by["ann@acme.io"]["critical_repos"] == 1               # 60 % of api
    assert by["bo@acme.io"]["critical_repos"] == 1                # top owner of web, bus factor 1
    assert by["cy@acme.io"]["critical_repos"] == 0
    assert by["ann@acme.io"]["repo_count"] == 2
    assert people[-1]["developer"] == "cy@acme.io"
