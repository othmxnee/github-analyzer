"""HTTP trigger for the nightly job (hosts without cron, e.g. Render free)."""
import os
import threading
import time

import pytest


@pytest.fixture
def client(monkeypatch):
    os.environ.pop("GA_LOCAL_MODE", None)
    from app import app
    from routes import jobs as jobs_routes
    jobs_routes._state.update(running=False, day=None, summary=None, error=None, started_at=None)
    return app.test_client()


def call(client, token="s3cret"):
    return client.post("/jobs/nightly", headers={"Authorization": f"Bearer {token}"} if token else {})


def test_disabled_without_token(client, monkeypatch):
    monkeypatch.delenv("JOBS_TOKEN", raising=False)
    assert call(client).status_code == 404


def test_rejects_wrong_or_missing_token(client, monkeypatch):
    monkeypatch.setenv("JOBS_TOKEN", "s3cret")
    assert call(client, "nope").status_code == 403
    assert call(client, None).status_code == 403
    assert client.post("/jobs/nightly?token=s3cret").status_code == 403   # never via the URL


def test_runs_once_per_day_and_reports_progress(client, monkeypatch):
    from jobs import nightly
    monkeypatch.setenv("JOBS_TOKEN", "s3cret")
    gate, runs = threading.Event(), []

    def fake_run():
        runs.append(1)
        gate.wait(5)
        return {"analyzed": 2, "alerts": 1}
    monkeypatch.setattr(nightly, "run", fake_run)

    r = call(client)
    assert r.status_code == 202 and r.get_json()["status"] == "started"
    assert call(client).get_json()["status"] == "running"
    gate.set()
    for _ in range(50):
        r = call(client)
        if r.status_code == 200:
            break
        time.sleep(0.05)
    assert r.get_json() == {"status": "done", "day": r.get_json()["day"], "summary": {"analyzed": 2, "alerts": 1}}
    assert len(runs) == 1


def test_a_failed_run_is_retried_on_the_next_call(client, monkeypatch):
    from jobs import nightly
    monkeypatch.setenv("JOBS_TOKEN", "s3cret")
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database asleep")
        return {"analyzed": 0}
    monkeypatch.setattr(nightly, "run", flaky)
    call(client)
    for _ in range(50):
        if call(client).get_json()["status"] == "started":
            break
        time.sleep(0.05)
    for _ in range(50):
        if call(client).status_code == 200:
            break
        time.sleep(0.05)
    assert len(calls) == 2
