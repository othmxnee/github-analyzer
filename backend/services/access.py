"""Who may see the results of a private repository.

Results used to be served to anyone who knew a repository URL. For private
repositories that leaked analysis data (developer names, ownership, file
paths) to strangers, and storing results in a database would have made the
leak permanent. Now:

* a repository analyzed with a sign-in token is checked once with the host;
  if it is private, that is remembered (memory + database);
* any later read of a private repository's results requires the caller's own
  session token to have read access, verified with the host's API and cached
  for ACCESS_TTL (keyed by a hash of the token, never the token itself).

Fails closed: if the host cannot be asked, a private repository stays hidden.
"""
import hashlib
import logging
import threading
import time
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)

ACCESS_TTL = 10 * 60
_TIMEOUT = 8
_cache = {}            # (sha256(token), repo_url) -> (allowed, expires_at)
_lock = threading.Lock()


def _parts(repo_url):
    for prefix, provider in (("https://github.com/", "github"), ("https://gitlab.com/", "gitlab"),
                             ("https://bitbucket.org/", "bitbucket")):
        if repo_url.startswith(prefix):
            path = repo_url[len(prefix):].strip("/").removesuffix(".git")
            return provider, path
    return None, None


def _lookup(repo_url, token):
    """(status_code, private_flag) from the host's API, or (None, None) on failure."""
    provider, path = _parts(repo_url)
    if not provider or not path:
        return None, None
    try:
        if provider == "github":
            r = requests.get(f"https://api.github.com/repos/{path}", timeout=_TIMEOUT,
                             headers={"Authorization": f"Bearer {token}",
                                      "Accept": "application/vnd.github+json"} if token else {})
            return r.status_code, (r.json().get("private") if r.ok else None)
        if provider == "gitlab":
            r = requests.get(f"https://gitlab.com/api/v4/projects/{quote(path, safe='')}", timeout=_TIMEOUT,
                             headers={"Authorization": f"Bearer {token}"} if token else {})
            return r.status_code, ((r.json().get("visibility") != "public") if r.ok else None)
        r = requests.get(f"https://api.bitbucket.org/2.0/repositories/{path}", timeout=_TIMEOUT,
                         headers={"Authorization": f"Bearer {token}"} if token else {})
        return r.status_code, (r.json().get("is_private") if r.ok else None)
    except Exception as exc:
        logger.warning("access: could not reach %s for %s: %s", provider, repo_url, exc)
        return None, None


def is_private_repo(repo_url, token):
    """Privacy of a repository being analyzed with a token. Unknown -> True (fail closed)."""
    if not token:
        return False          # cloned anonymously, so it is public
    status, private = _lookup(repo_url, token)
    if status == 200 and private is not None:
        return bool(private)
    return True


def can_read(repo_url, token):
    if not token:
        return False
    key = (hashlib.sha256(token.encode()).hexdigest(), repo_url)
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[1] > now:
            return hit[0]
    status, _ = _lookup(repo_url, token)
    allowed = status == 200
    if status is not None:            # don't cache network failures
        with _lock:
            _cache[key] = (allowed, now + ACCESS_TTL)
            if len(_cache) > 5000:
                for k in [k for k, v in _cache.items() if v[1] <= now]:
                    _cache.pop(k, None)
    return allowed
