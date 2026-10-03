"""Alerts: rules, the watch API, notifications and the nightly job."""
import copy
import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

import db
from services import alerts as rules
from services import notify, watches

URL = "https://github.com/example/watched"


# ── rules ───────────────────────────────────────────────────────────────────

def results(bus=3, health=60, orphaned=0.10, owners=None, last_commits=None, end="2024-06-01",
            risky=None):
    owners = owners or {"alice@x.org": 0.5, "bob@x.org": 0.3}
    last_commits = last_commits or {"alice@x.org": "2024-06-01", "bob@x.org": "2024-05-30"}
    return {
        "bus_factor": bus,
        "project_summary": {"health_score": health},
        "orphaned_knowledge": {"orphaned_pct": orphaned},
        "busfactor_simulation": {"developers": [{"name": d, "ownership": s} for d, s in owners.items()]},
        "dev_stats": {d: {"last_commit": c} for d, c in last_commits.items()},
        "summary": {"date_range": {"end": end + " 10:00:00+00:00"}},
        "risk_files": [{"file": f, "risk_score": r} for f, r in (risky or {}).items()],
    }


def kinds(found):
    return sorted(a["kind"] for a in found)


def test_first_analysis_is_a_baseline():
    assert rules.evaluate(None, results()) == []


def test_no_change_no_alert():
    assert rules.evaluate(results(), results()) == []


def test_each_rule_fires():
    before = results(risky={"a.py": 0.75})
    after = results(bus=1, health=45, orphaned=0.20,
                    last_commits={"alice@x.org": "2024-03-01", "bob@x.org": "2024-05-30"},
                    risky={"a.py": 0.8, "core/db.py": 0.9})
    found = rules.evaluate(before, after)
    assert kinds(found) == ["bus_factor_drop", "health_drop", "key_person_quiet",
                            "new_high_risk_file", "orphaned_rise"]
    by = {a["kind"]: a for a in found}
    assert by["bus_factor_drop"]["severity"] == "high"
    assert "alice owns 50%" in by["key_person_quiet"]["title"] and "92 days" in by["key_person_quiet"]["title"]
    assert by["new_high_risk_file"]["title"].startswith("core/db.py")   # a.py was already high


def test_thresholds_are_respected():
    before = results()
    after = results(health=51, orphaned=0.149,                       # -9 points, +4.9 pp
                    last_commits={"alice@x.org": "2024-04-18", "bob@x.org": "2024-05-30"},  # 44 days
                    risky={"x.py": 0.69})
    assert rules.evaluate(before, after) == []
    small = results(owners={"alice@x.org": 0.19, "bob@x.org": 0.3},
                    last_commits={"alice@x.org": "2023-01-01", "bob@x.org": "2024-05-30"})
    assert rules.evaluate(results(), small) == []                     # quiet but owns < 20 %


def test_quiet_owner_is_reported_once():
    quiet = results(last_commits={"alice@x.org": "2024-03-01", "bob@x.org": "2024-05-30"})
    assert kinds(rules.evaluate(results(), quiet)) == ["key_person_quiet"]
    assert rules.evaluate(quiet, copy.deepcopy(quiet)) == []


# ── notifications ───────────────────────────────────────────────────────────

class SlackSink:
    def __init__(self):
        self.posts = []
        sink = self

        class H(BaseHTTPRequestHandler):
            def do_POST(self):
                sink.posts.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                self.send_response(200)
                self.end_headers()

            def log_message(self, *a):
                pass
        self.server = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.prefix = f"http://127.0.0.1:{self.server.server_port}/services/"

    def close(self):
        self.server.shutdown()


@pytest.fixture
def slack(monkeypatch):
    sink = SlackSink()
    monkeypatch.setenv("GA_SLACK_PREFIX", sink.prefix)
    yield sink
    sink.close()


@pytest.fixture
def mailbox(monkeypatch):
    sent = []
    monkeypatch.setenv("SMTP_HOST", "smtp.test")
    monkeypatch.setattr(notify, "send_email",
                        lambda to, subject, text, html=None: sent.append(
                            {"to": to, "subject": subject, "text": text, "html": html}) or True)
    return sent


def test_slack_urls_are_restricted(monkeypatch):
    monkeypatch.delenv("GA_SLACK_PREFIX", raising=False)
    assert notify.valid_slack_webhook("https://hooks.slack.com/services/T1/B2/abc")
    for bad in ("http://hooks.slack.com/services/x", "https://evil.example/services/",
                "http://169.254.169.254/latest/meta-data", None):
        assert not notify.valid_slack_webhook(bad)
        assert notify.post_slack(bad, "x") is False


def test_smtp_delivery_uses_starttls_and_login(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            calls.append(("starttls",))

        def login(self, u, p):
            calls.append(("login", u))

        def send_message(self, msg):
            calls.append(("send", msg["To"], msg["Subject"]))
    monkeypatch.setattr(notify.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USERNAME", "apikey")
    monkeypatch.setenv("SMTP_FROM", "Git Analyzer <alerts@example.com>")
    assert notify.send_email("a@b.co", "Hi", "text", "<p>html</p>")
    assert calls == [("connect", "smtp.example.com", 587), ("starttls",), ("login", "apikey"),
                     ("send", "a@b.co", "Hi")]


# ── watch API ───────────────────────────────────────────────────────────────

@pytest.fixture
def database(tmp_path):
    db.configure(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/alerts.db")
    if db.engine().dialect.name == "postgresql":
        from sqlalchemy import text
        with db.engine().begin() as c:
            c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))   # fresh test database
    db.upgrade()
    yield
    db.configure(None)


@pytest.fixture
def client(monkeypatch):
    os.environ.pop("GA_LOCAL_MODE", None)
    from app import app
    from routes import watch as watch_routes
    monkeypatch.setattr(watch_routes, "_publicly_readable", lambda url: True)
    return app.test_client()


def sign_in(client, login="alice"):
    with client.session_transaction() as s:
        s["github_user"] = {"login": login, "name": login}


def test_watch_requires_sign_in_and_valid_input(database, client, mailbox):
    assert client.post("/watch", json={"repo_url": URL, "email": "a@b.co"}).status_code == 401
    sign_in(client)
    assert client.post("/watch", json={"repo_url": "https://example.com/x", "email": "a@b.co"}).status_code == 400
    assert client.post("/watch", json={"repo_url": URL}).status_code == 400
    assert client.post("/watch", json={"repo_url": URL, "email": "not-an-email"}).status_code == 400
    assert client.post("/watch", json={"repo_url": URL,
                                       "slack_webhook_url": "https://evil.example/x"}).status_code == 400


def test_email_watch_needs_confirmation(database, client, mailbox):
    sign_in(client)
    r = client.post("/watch", json={"repo_url": URL, "email": "Alice@Example.com"}).get_json()
    assert r["status"] == "pending_confirmation"
    [mail] = mailbox
    assert mail["to"] == "alice@example.com"
    link = next(w for w in mail["text"].split() if "/watch/confirm?token=" in w)
    assert watches.watched_repositories() == []                 # nothing is sent before confirming
    token = parse_qs(urlparse(link).query)["token"][0]
    resp = client.get(f"/watch/confirm?token={token}")
    assert resp.status_code == 302 and resp.headers["Location"].endswith("/?watch=confirmed")
    assert [w["url"] for w in watches.watched_repositories()] == [URL]
    assert client.get("/watch/confirm?token=wrong").headers["Location"].endswith("?watch=invalid")
    [w] = client.get("/watches").get_json()["watches"]
    assert w["email_confirmed"] is True


def test_watch_limits_and_ownership(database, client, mailbox, slack, monkeypatch):
    monkeypatch.setattr(watches, "MAX_WATCHES_PER_USER", 2)
    sign_in(client, "alice")
    for i in range(2):
        assert client.post("/watch", json={"repo_url": f"{URL}{i}",
                                           "slack_webhook_url": slack.prefix + "x"}).status_code == 200
    assert client.post("/watch", json={"repo_url": URL + "9",
                                       "slack_webhook_url": slack.prefix + "x"}).status_code == 400
    wid = client.get("/watches").get_json()["watches"][0]["id"]
    sign_in(client, "mallory")
    assert client.delete(f"/watch/{wid}").status_code == 404
    sign_in(client, "alice")
    assert client.delete(f"/watch/{wid}").status_code == 200


def test_email_without_smtp_is_refused(database, client, monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    sign_in(client)
    assert client.post("/watch", json={"repo_url": URL, "email": "a@b.co"}).status_code == 503


# ── nightly job, end to end ─────────────────────────────────────────────────

def _git(path, *args, date=None, who=("Bob Frontend", "bob@example.com")):
    env = {**os.environ, "GIT_AUTHOR_NAME": who[0], "GIT_AUTHOR_EMAIL": who[1],
           "GIT_COMMITTER_NAME": who[0], "GIT_COMMITTER_EMAIL": who[1]}
    if date:
        env["GIT_AUTHOR_DATE"] = env["GIT_COMMITTER_DATE"] = date
    subprocess.run(["git", "-C", path, *args], check=True, env=env, stdout=subprocess.DEVNULL)


@pytest.mark.slow
def test_nightly_job_alerts_then_stays_quiet(database, client, mailbox, slack, sample_repo, tmp_path):
    from jobs import nightly

    remote = str(tmp_path / "remote")
    subprocess.run(["git", "clone", "-q", sample_repo, remote], check=True)
    sign_in(client)
    client.post("/watch", json={"repo_url": URL, "email": "alice@example.com"})
    token = parse_qs(urlparse(next(w for w in mailbox[0]["text"].split() if "token=" in w)).query)["token"][0]
    client.get(f"/watch/confirm?token={token}")
    client.post("/watch", json={"repo_url": URL, "slack_webhook_url": slack.prefix + "T/B/x"})
    source = {URL: remote}.get

    first = nightly.run(resolve_source=source)
    assert first["analyzed"] == 1 and first["alerts"] == 0          # baseline
    assert nightly.run(resolve_source=source)["unchanged"] == 1      # same HEAD: skipped

    # Two months later only Bob commits: Alice (the main owner) has gone quiet.
    with open(os.path.join(remote, "web/src/styles/app.css"), "a") as f:
        f.write("/* later */\n")
    _git(remote, "add", "-A")
    _git(remote, "commit", "-q", "--no-gpg-sign", "-m", "Later UI work", date="1704880800 +0000")  # 2024-01-10, 61 days after Alice

    second = nightly.run(resolve_source=source)
    assert second["analyzed"] == 1 and second["alerts"] >= 1
    titles = [a["title"] for a in watches.recent(URL)]
    assert any("alice owns" in t and "hasn't committed" in t for t in titles)
    alert_mail = mailbox[-1]
    assert alert_mail["to"] == "alice@example.com" and "alice owns" in alert_mail["text"]
    assert slack.posts and "alice owns" in slack.posts[-1]["text"]
    assert client.get(f"/alerts?repo_url={URL}").get_json()["alerts"][0]["title"] == titles[0]

    # The unsubscribe link in the email switches off that email watch only.
    unsub = next(w for w in alert_mail["text"].split() if "/watch/unsubscribe?token=" in w)
    resp = client.get(urlparse(unsub).path + "?" + urlparse(unsub).query)
    assert resp.headers["Location"].endswith("/?watch=unsubscribed")
    remaining = client.get("/watches").get_json()["watches"]
    assert [w["slack"] for w in remaining] == [True] and remaining[0]["email"] is None
    assert client.get("/watch/unsubscribe?token=forged").headers["Location"].endswith("?watch=invalid")
