"""GitHub App: creation, tokens, webhook, installations, private-repo access."""
import hashlib
import hmac
import json
import os
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import db
from services import github_app, store

PRIVATE = "https://github.com/acme/secret"
OTHER = "https://github.com/acme/other"


class Resp:
    def __init__(self, status, data):
        self.status_code, self._d, self.ok = status, data, status < 300
        self.text = json.dumps(data)

    def json(self):
        return self._d

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


@pytest.fixture(scope="module")
def keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption()).decode()
    return pem, key.public_key()


@pytest.fixture
def database(tmp_path, monkeypatch):
    db.configure(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/gh.db")
    if db.engine().dialect.name == "postgresql":
        from sqlalchemy import text
        with db.engine().begin() as c:
            c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    db.upgrade()
    for k in ("GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET"):
        monkeypatch.delenv(k, raising=False)
    github_app._token_cache.clear()
    yield
    db.configure(None)


@pytest.fixture
def app_creds(database, keypair):
    pem, _ = keypair
    github_app.save_from_manifest({"id": 4242, "slug": "git-analyzer", "pem": pem, "webhook_secret": "whsec",
                                   "html_url": "https://github.com/apps/git-analyzer"})
    return pem


@pytest.fixture
def client(monkeypatch):
    os.environ.pop("GA_LOCAL_MODE", None)
    monkeypatch.setenv("ADMIN_GITHUB_LOGIN", "othmxnee")
    from app import app
    return app.test_client()


def sign_in(client, login, token="user-oauth-token"):
    with client.session_transaction() as s:
        s["github_user"] = {"login": login}
        s["github_token"] = token


def fake_github(monkeypatch, user_installations=(77,), repos=None):
    repos = repos or [{"full_name": "acme/secret", "private": True}, {"full_name": "acme/other", "private": False}]
    calls = []

    def post(url, **kw):
        calls.append(("POST", url))
        if url.endswith("/access_tokens"):
            return Resp(201, {"token": "ghs_installation", "expires_at": "2099-01-01T00:00:00Z"})
        if "/app-manifests/" in url:
            return Resp(201, {"id": 99, "slug": "git-analyzer", "pem": kw.get("_pem", "PEM"),
                              "webhook_secret": "s", "html_url": "https://github.com/apps/git-analyzer"})
        raise AssertionError(url)

    def get(url, **kw):
        calls.append(("GET", url))
        if url.endswith("/user/installations"):
            return Resp(200, {"installations": [{"id": i} for i in user_installations]})
        if "/app/installations/" in url:
            return Resp(200, {"account": {"login": "acme", "type": "Organization"}})
        if url.endswith("/installation/repositories"):
            return Resp(200, {"repositories": repos})
        raise AssertionError(url)
    from routes import github_app as routes_mod
    monkeypatch.setattr(github_app.requests, "post", post)
    monkeypatch.setattr(github_app.requests, "get", get)
    monkeypatch.setattr(routes_mod.requests, "get", get)
    return calls


def signed(body, secret="whsec"):
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


# ── credentials and tokens ──────────────────────────────────────────────────

def test_jwt_is_signed_with_the_app_key(app_creds, keypair):
    _, public = keypair
    claims = jwt.decode(github_app.app_jwt(), public, algorithms=["RS256"])
    assert claims["iss"] == "4242" and claims["exp"] - claims["iat"] <= 600
    assert github_app.install_url() == "https://github.com/apps/git-analyzer/installations/new"


def test_installation_tokens_are_cached(app_creds, monkeypatch):
    calls = fake_github(monkeypatch)
    assert github_app.installation_token(77) == "ghs_installation"
    assert github_app.installation_token(77) == "ghs_installation"
    assert sum(1 for c in calls if c[1].endswith("/access_tokens")) == 1


def test_env_vars_override_the_database(database, keypair, monkeypatch):
    pem, _ = keypair
    monkeypatch.setenv("GITHUB_APP_ID", "7")
    monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", pem.replace("\n", "\\n"))
    assert github_app.credentials()["app_id"] == 7 and github_app.credentials()["private_key"] == pem


# ── one-time creation (manifest flow) ───────────────────────────────────────

def test_only_the_admin_can_create_the_app(database, client, monkeypatch, keypair):
    sign_in(client, "mallory")
    assert client.get("/github-app/setup").status_code == 403
    sign_in(client, "othmxnee")
    page = client.get("/github-app/setup").get_data(as_text=True)
    assert 'action="https://github.com/settings/apps/new?state=' in page
    manifest = json.loads(page.split('name="manifest" value="')[1].split('"')[0].replace("&quot;", '"'))
    assert manifest["default_permissions"] == {"contents": "read", "metadata": "read"}
    assert manifest["hook_attributes"]["url"].endswith("/github-app/webhook")
    assert client.get("/github-app/manifest-callback?code=c&state=forged").status_code == 400
    client.get("/github-app/setup")          # a forged callback burns the state: start again

    with client.session_transaction() as s:
        state = s["gh_app_state"]
    fake_github(monkeypatch)
    monkeypatch.setattr(github_app, "convert_manifest", lambda code: {
        "id": 99, "slug": "git-analyzer", "pem": keypair[0], "webhook_secret": "s",
        "html_url": "https://github.com/apps/git-analyzer"})
    r = client.get(f"/github-app/manifest-callback?code=c&state={state}")
    assert r.status_code == 302 and r.headers["Location"].endswith("/installations/new")
    assert github_app.credentials()["app_id"] == 99


# ── installing ──────────────────────────────────────────────────────────────

def test_installing_links_repositories_to_the_user(app_creds, client, monkeypatch):
    fake_github(monkeypatch, user_installations=(77,))
    r = client.get("/github-app/installed?installation_id=77")              # not signed in yet
    assert r.status_code == 302 and "/auth/github" in r.headers["Location"]

    sign_in(client, "alice")
    r = client.get("/github-app/installed?installation_id=77")
    assert r.status_code == 302 and r.headers["Location"].endswith("/portfolio?installed=acme&repos=2")
    assert github_app.installations_of("alice") == [{"installation_id": 77, "account": "acme", "type": "Organization"}]
    assert github_app.user_owns_repo("alice", PRIVATE) and store.is_private(PRIVATE) is True
    names = [r["repo_url"] for r in client.get("/portfolio").get_json()["repositories"]]
    assert names == [OTHER, PRIVATE]


def test_cannot_claim_someone_elses_installation(app_creds, client, monkeypatch):
    fake_github(monkeypatch, user_installations=(1, 2))
    sign_in(client, "mallory")
    r = client.get("/github-app/installed?installation_id=77")
    assert r.headers["Location"].endswith("/portfolio?installed=forbidden")
    assert github_app.installations_of("mallory") == []


# ── private repository access ───────────────────────────────────────────────

def test_private_results_for_installation_owners_only(app_creds, client, monkeypatch):
    fake_github(monkeypatch)
    sign_in(client, "alice")
    client.get("/github-app/installed?installation_id=77")
    assert client.get(f"/analyze/result?repo_url={PRIVATE}").status_code == 200
    sign_in(client, "mallory", token=None)
    assert client.get(f"/analyze/result?repo_url={PRIVATE}").status_code == 403


def test_owner_analysis_clones_with_the_installation_token(app_creds, client, monkeypatch):
    fake_github(monkeypatch)
    sign_in(client, "alice")
    client.get("/github-app/installed?installation_id=77")
    seen = {}
    from routes import analyze as analyze_routes
    monkeypatch.setattr(analyze_routes, "start_analysis", lambda url, **kw: seen.update(kw) or {"status": "running"})
    sign_in(client, "alice", token=None)            # no personal token: the app's token is used
    client.post("/analyze", json={"repo_url": PRIVATE})
    assert seen["token"] == "ghs_installation" and seen["provider"] == "github-app" and seen["private"] is True


# ── webhook ─────────────────────────────────────────────────────────────────

def test_webhook_requires_a_valid_signature(app_creds, client):
    body = json.dumps({"action": "created"}).encode()
    assert client.post("/github-app/webhook", data=body, headers={
        "X-GitHub-Event": "installation", "X-Hub-Signature-256": "sha256=bad",
        "Content-Type": "application/json"}).status_code == 401


def test_webhook_tracks_installations_and_repositories(app_creds, client):
    def send(event, payload):
        body = json.dumps(payload).encode()
        return client.post("/github-app/webhook", data=body, headers={
            "X-GitHub-Event": event, "X-Hub-Signature-256": signed(body), "Content-Type": "application/json"})
    inst = {"id": 88, "account": {"login": "beta", "type": "User"}}
    assert send("installation", {"action": "created", "installation": inst,
                                 "repositories": [{"full_name": "beta/a", "private": True}]}).status_code == 200
    assert github_app.installation_for_repo("https://github.com/beta/a") == 88
    send("installation_repositories", {"action": "added", "installation": inst,
                                       "repositories_added": [{"full_name": "beta/b", "private": False}],
                                       "repositories_removed": [{"full_name": "beta/a"}]})
    assert github_app.installation_for_repo("https://github.com/beta/a") is None
    assert github_app.installation_for_repo("https://github.com/beta/b") == 88
    send("installation", {"action": "deleted", "installation": inst})
    assert github_app.installation_for_repo("https://github.com/beta/b") is None


# ── nightly job ─────────────────────────────────────────────────────────────

@pytest.mark.slow
def test_nightly_checks_installed_private_repositories(app_creds, client, monkeypatch, sample_repo):
    fake_github(monkeypatch, repos=[{"full_name": "acme/secret", "private": True}])
    sign_in(client, "alice")
    client.get("/github-app/installed?installation_id=77")
    from jobs import nightly
    from services import analyzer
    seen = {}
    real = analyzer._run_analysis

    def spy(url, **kw):
        seen.update(kw)
        return real(url, **kw)
    monkeypatch.setattr(analyzer, "_run_analysis", spy)
    summary = nightly.run(resolve_source={PRIVATE: sample_repo}.get)
    assert summary["analyzed"] == 1 and summary["skipped_private"] == 0
    assert seen["token"] == "ghs_installation" and seen["provider"] == "github-app"
    assert store.history(PRIVATE)[0]["trigger"] == "scheduled"
