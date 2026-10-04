"""Git Analyzer GitHub App: read-only access to the private repositories of
the accounts and organizations that install it.

Credentials come from env vars (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY,
GITHUB_APP_WEBHOOK_SECRET, GITHUB_APP_HTML_URL) or, if absent, from the
github_app table filled by the manifest flow (/github-app/setup).

Permissions requested: Contents read, Metadata read. Nothing is written to
GitHub. Clones use installation tokens that GitHub expires after one hour.
"""
import hashlib
import hmac
import logging
import os
import threading
import time

import requests

logger = logging.getLogger(__name__)
API = "https://api.github.com"
_TIMEOUT = 15
_token_cache = {}            # installation_id -> (token, expires_at_epoch)
_lock = threading.Lock()


# ── credentials ─────────────────────────────────────────────────────────────

def credentials():
    """{app_id, private_key, webhook_secret, html_url, slug} or None."""
    if os.environ.get("GITHUB_APP_ID") and os.environ.get("GITHUB_APP_PRIVATE_KEY"):
        return {
            "app_id": int(os.environ["GITHUB_APP_ID"]),
            "private_key": os.environ["GITHUB_APP_PRIVATE_KEY"].replace("\\n", "\n"),
            "webhook_secret": os.environ.get("GITHUB_APP_WEBHOOK_SECRET", ""),
            "html_url": os.environ.get("GITHUB_APP_HTML_URL", ""),
            "slug": os.environ.get("GITHUB_APP_SLUG", ""),
        }
    from services import store
    if not store.enabled():
        return None
    import db
    from models import GitHubApp
    with db.session() as s:
        row = s.query(GitHubApp).order_by(GitHubApp.id.desc()).first()
        if row is None:
            return None
        return {"app_id": row.app_id, "private_key": row.private_key, "webhook_secret": row.webhook_secret,
                "html_url": row.html_url, "slug": row.slug}


def configured():
    return credentials() is not None


def install_url():
    c = credentials()
    return f"{c['html_url'].rstrip('/')}/installations/new" if c and c.get("html_url") else None


def save_from_manifest(conversion):
    """Store what GitHub returns from POST /app-manifests/{code}/conversions."""
    import db
    from models import GitHubApp
    with db.session() as s, s.begin():
        s.add(GitHubApp(app_id=conversion["id"], slug=conversion["slug"], html_url=conversion["html_url"],
                        private_key=conversion["pem"], webhook_secret=conversion["webhook_secret"]))


def convert_manifest(code):
    r = requests.post(f"{API}/app-manifests/{code}/conversions", timeout=_TIMEOUT,
                      headers={"Accept": "application/vnd.github+json"})
    r.raise_for_status()
    return r.json()


# ── tokens ──────────────────────────────────────────────────────────────────

def app_jwt(creds=None):
    import jwt
    c = creds or credentials()
    now = int(time.time())
    # Backdated 60 s against clock drift; GitHub allows at most 10 minutes.
    return jwt.encode({"iat": now - 60, "exp": now + 540, "iss": str(c["app_id"])},
                      c["private_key"], algorithm="RS256")


def installation_token(installation_id):
    """A cached installation token, refreshed 5 minutes before it expires."""
    with _lock:
        hit = _token_cache.get(installation_id)
        if hit and hit[1] - 300 > time.time():
            return hit[0]
    r = requests.post(f"{API}/app/installations/{installation_id}/access_tokens", timeout=_TIMEOUT,
                      headers={"Authorization": f"Bearer {app_jwt()}", "Accept": "application/vnd.github+json"})
    r.raise_for_status()
    data = r.json()
    from datetime import datetime
    expires = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00")).timestamp()
    with _lock:
        _token_cache[installation_id] = (data["token"], expires)
    return data["token"]


def installation_repositories(installation_id):
    """[{url, private}] the installation can read (paginated)."""
    token = installation_token(installation_id)
    repos, page = [], 1
    while True:
        r = requests.get(f"{API}/installation/repositories", params={"per_page": 100, "page": page},
                         timeout=_TIMEOUT, headers={"Authorization": f"Bearer {token}",
                                                    "Accept": "application/vnd.github+json"})
        r.raise_for_status()
        batch = r.json().get("repositories", [])
        repos += [{"url": f"https://github.com/{x['full_name']}", "private": bool(x.get("private"))} for x in batch]
        if len(batch) < 100:
            return repos
        page += 1


def installation_info(installation_id):
    r = requests.get(f"{API}/app/installations/{installation_id}", timeout=_TIMEOUT,
                     headers={"Authorization": f"Bearer {app_jwt()}", "Accept": "application/vnd.github+json"})
    r.raise_for_status()
    acc = r.json().get("account") or {}
    return {"account_login": acc.get("login"), "account_type": acc.get("type")}


def verify_signature(body, signature_header):
    c = credentials()
    if not c or not c.get("webhook_secret") or not signature_header:
        return False
    expected = "sha256=" + hmac.new(c["webhook_secret"].encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ── installations and their repositories ────────────────────────────────────

def upsert_installation(installation_id, account_login, account_type=None, owner_login=None, active=True):
    import db
    from models import Installation
    with db.session() as s, s.begin():
        inst = s.query(Installation).filter_by(installation_id=installation_id).one_or_none()
        if inst is None:
            inst = Installation(installation_id=installation_id, account_login=account_login or "?",
                                account_type=account_type, active=active)
            s.add(inst)
        else:
            inst.active = active
            if account_login:
                inst.account_login = account_login
        if owner_login:
            inst.owner_login = owner_login


def link_repositories(installation_id, repos):
    """Mark repos as belonging to the installation (private flag from GitHub)."""
    import db
    from services.store import _get_or_create_repo
    with db.session() as s, s.begin():
        for r in repos:
            repo = _get_or_create_repo(s, r["url"], private=r["private"])
            repo.installation_id = installation_id


def unlink_repositories(installation_id, urls=None):
    import db
    from models import Repository
    with db.session() as s, s.begin():
        q = s.query(Repository).filter(Repository.installation_id == installation_id)
        if urls is not None:
            q = q.filter(Repository.url.in_(urls))
        q.update({"installation_id": None}, synchronize_session=False)


def sync_installation(installation_id, owner_login=None):
    info = installation_info(installation_id)
    upsert_installation(installation_id, info["account_login"], info["account_type"], owner_login=owner_login)
    repos = installation_repositories(installation_id)
    link_repositories(installation_id, repos)
    return {"account": info["account_login"], "repositories": len(repos)}


def installations_of(login):
    import db
    from models import Installation
    with db.session() as s:
        return [{"installation_id": i.installation_id, "account": i.account_login, "type": i.account_type}
                for i in s.query(Installation).filter_by(owner_login=login, active=True).all()]


def installation_for_repo(url):
    """Installation id that can clone this repository, or None."""
    import db
    from models import Installation, Repository
    with db.session() as s:
        row = (s.query(Repository.installation_id).join(
                   Installation, Installation.installation_id == Repository.installation_id)
               .filter(Repository.url == url, Installation.active.is_(True)).first())
        return row[0] if row else None


def user_owns_repo(login, url):
    """True when `login` installed the app on the account that holds `url`."""
    import db
    from models import Installation, Repository
    with db.session() as s:
        return s.query(Repository).join(Installation, Installation.installation_id == Repository.installation_id) \
            .filter(Repository.url == url, Installation.owner_login == login, Installation.active.is_(True)) \
            .count() > 0
