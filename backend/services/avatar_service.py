"""Resolve real GitHub profile pictures for the developers mined from git history.

Git commits only carry a name + email, never an avatar. To show the real
GitHub photo we map each contributor's commit email -> a GitHub login ->
`avatar_url` on GitHub's CDN (avatars.githubusercontent.com).

Resolution runs as a background job, decoupled from the main analysis: the
dashboard kicks it off after analysis and polls for results, so photos fill in
progressively without ever delaying the analysis itself.

Matching strategy per email:
  1. The commits API maps a *git* email to its GitHub account directly:
       GET /repos/{owner}/{repo}/commits?author=<email>  -> author.avatar_url
     This works for plain personal emails and needs no token on public repos.
  2. Fallback for GitHub `noreply` emails (which encode the login), resolved
     via the user endpoint.

Everything is best-effort: any network/parse failure simply yields no avatar
for that developer and the frontend falls back to its initials circle.
"""

import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

logger = logging.getLogger(__name__)

_API = "https://api.github.com"
_TIMEOUT = 8
_MAX_WORKERS = 12          # parallel GitHub lookups per job

# 12345+login@users.noreply.github.com  or  login@users.noreply.github.com
_NOREPLY_RE = re.compile(
    r'^(?:\d+\+)?(?P<login>[A-Za-z0-9-]+)@users\.noreply\.github\.com$'
)

# Process-lifetime caches shared across jobs.
_login_avatar_cache = {}   # login (lower) -> avatar_url | None
_email_avatar_cache = {}   # email (lower) -> avatar_url | None

# Per-repo background-job state.
_avatar_results = {}       # repo_url -> {email: avatar_url}   (grows as it resolves)
_avatar_status = {}        # repo_url -> 'running' | 'done'
_avatar_lock = threading.Lock()


def _headers(token):
    h = {"Accept": "application/vnd.github+json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _parse_owner_repo(repo_url):
    """https://github.com/owner/repo(.git) -> ('owner', 'repo') or None."""
    m = re.match(r'https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$', repo_url.strip())
    if not m:
        return None
    return m.group(1), m.group(2)


def _login_from_noreply(email):
    m = _NOREPLY_RE.match(email)
    return m.group("login") if m else None


def _avatar_via_commit(owner, repo, email, token):
    """Resolve one git email -> avatar_url via the repo commits API.

    `GET /repos/{owner}/{repo}/commits?author=<email>` returns that author's
    commits with the linked GitHub account (`author.login` / `avatar_url`).
    This links a *git* email to its GitHub account even when the email is a
    plain personal address (not a `noreply`), works on public repos without a
    token, and is NOT the heavily rate-limited search endpoint.
    """
    if email in _email_avatar_cache:
        return _email_avatar_cache[email]
    avatar = None
    try:
        r = requests.get(
            f"{_API}/repos/{owner}/{repo}/commits",
            headers=_headers(token),
            params={"author": email, "per_page": 1},
            timeout=_TIMEOUT,
        )
        if r.status_code == 200:
            items = r.json()
            if items:
                author = items[0].get("author") or {}   # linked GitHub user (may be null)
                avatar = author.get("avatar_url")
                login = (author.get("login") or "").lower()
                if login and avatar:
                    _login_avatar_cache[login] = avatar
    except requests.RequestException as exc:
        logger.warning("avatar: commit lookup failed for %s: %s", email, exc)
    _email_avatar_cache[email] = avatar
    return avatar


def _avatar_for_login(login, token):
    """login -> avatar_url, falling back to the user endpoint if unknown."""
    key = login.lower()
    if key in _login_avatar_cache:
        return _login_avatar_cache[key]
    try:
        r = requests.get(f"{_API}/users/{login}", headers=_headers(token), timeout=_TIMEOUT)
        avatar = r.json().get("avatar_url") if r.status_code == 200 else None
    except requests.RequestException as exc:
        logger.warning("avatar: user fetch failed for %s: %s", login, exc)
        avatar = None
    _login_avatar_cache[key] = avatar
    return avatar


def _resolve_one(owner, repo, email, token):
    # 1) Primary: map the git email -> GitHub account via the commits API.
    avatar = _avatar_via_commit(owner, repo, email, token)
    if avatar:
        return avatar
    # 2) Fallback: GitHub `noreply` emails encode the login directly.
    login = _login_from_noreply(email)
    if login:
        return _avatar_for_login(login, token)
    return None


def _run_avatar_job(repo_url, emails, token):
    """Resolve every developer's avatar, writing results in as they arrive.

    No time cap: this runs in the background and the dashboard polls for the
    growing result map. Lookups are fanned out across a thread pool so GitHub's
    per-call latency doesn't serialize into a long wall-clock time.
    """
    owner_repo = _parse_owner_repo(repo_url)
    if not owner_repo:
        with _avatar_lock:
            _avatar_status[repo_url] = 'done'
        return
    owner, repo = owner_repo

    wanted = sorted({(e or "").strip().lower() for e in emails if e})
    try:
        with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, max(1, len(wanted)))) as pool:
            futures = {pool.submit(_resolve_one, owner, repo, e, token): e for e in wanted}
            for fut in as_completed(futures):
                email = futures[fut]
                try:
                    avatar = fut.result()
                except Exception:
                    avatar = None
                if avatar:
                    with _avatar_lock:
                        _avatar_results.setdefault(repo_url, {})[email] = avatar
    except Exception as exc:
        logger.warning("avatar job failed for %s: %s", repo_url, exc)
    finally:
        with _avatar_lock:
            n = len(_avatar_results.get(repo_url, {}))
            _avatar_status[repo_url] = 'done'
        logger.info("avatar job done for %s: resolved %d of %d", repo_url, n, len(wanted))


def start_avatar_job(repo_url, emails, token=None, force=False):
    """Idempotently start (or restart) the background avatar job for a repo."""
    with _avatar_lock:
        status = _avatar_status.get(repo_url)
        if status == 'running':
            return
        if status == 'done' and not force:
            return
        _avatar_status[repo_url] = 'running'
        _avatar_results.setdefault(repo_url, {})
    threading.Thread(
        target=_run_avatar_job, args=(repo_url, emails, token), daemon=True,
    ).start()


def get_avatar_result(repo_url):
    """Return {status: running|done|not_started, avatars: {email: url}}."""
    with _avatar_lock:
        status = _avatar_status.get(repo_url, 'not_started')
        avatars = dict(_avatar_results.get(repo_url, {}))
    return {'status': status, 'avatars': avatars}


def invalidate_for_repo(repo_url):
    """Drop a repo's avatar job so a re-analysis re-resolves from scratch."""
    with _avatar_lock:
        _avatar_results.pop(repo_url, None)
        _avatar_status.pop(repo_url, None)
