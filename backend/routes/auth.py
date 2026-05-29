import logging
import os
import secrets
import traceback

import requests
from flask import Blueprint, jsonify, redirect, request, session

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5000')

# ───────────────────────── Provider configuration ─────────────────────────
# Each provider exposes the same interface so the route handlers stay generic.
# Adding a new provider = adding one entry here + an OAuth app on that platform.

PROVIDERS = {
    'github': {
        'client_id':     os.environ.get('GITHUB_CLIENT_ID', ''),
        'client_secret': os.environ.get('GITHUB_CLIENT_SECRET', ''),
        'authorize_url': 'https://github.com/login/oauth/authorize',
        'token_url':     'https://github.com/login/oauth/access_token',
        'user_url':      'https://api.github.com/user',
        'scope':         'repo',
    },
    'gitlab': {
        'client_id':     os.environ.get('GITLAB_CLIENT_ID', ''),
        'client_secret': os.environ.get('GITLAB_CLIENT_SECRET', ''),
        'authorize_url': 'https://gitlab.com/oauth/authorize',
        'token_url':     'https://gitlab.com/oauth/token',
        'user_url':      'https://gitlab.com/api/v4/user',
        'scope':         'read_api read_repository',
    },
    'bitbucket': {
        'client_id':     os.environ.get('BITBUCKET_CLIENT_ID', ''),
        'client_secret': os.environ.get('BITBUCKET_CLIENT_SECRET', ''),
        'authorize_url': 'https://bitbucket.org/site/oauth2/authorize',
        'token_url':     'https://bitbucket.org/site/oauth2/access_token',
        'user_url':      'https://api.bitbucket.org/2.0/user',
        # Bitbucket scopes are configured on the OAuth consumer page, not in URL
        'scope':         None,
    },
}


def _callback_url(provider):
    return f'{BACKEND_URL}/auth/{provider}/callback'


def _token_key(provider):
    return f'{provider}_token'


def _user_key(provider):
    return f'{provider}_user'


# ───────────────────────── Per-provider helpers ─────────────────────────

def _exchange_code_github(cfg, code):
    resp = requests.post(
        cfg['token_url'],
        json={
            'client_id': cfg['client_id'],
            'client_secret': cfg['client_secret'],
            'code': code,
        },
        headers={'Accept': 'application/json'},
        timeout=10,
    )
    return resp.json().get('access_token')


def _exchange_code_gitlab(cfg, code, redirect_uri):
    resp = requests.post(
        cfg['token_url'],
        data={
            'client_id': cfg['client_id'],
            'client_secret': cfg['client_secret'],
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri,
        },
        timeout=10,
    )
    return resp.json().get('access_token')


def _exchange_code_bitbucket(cfg, code, redirect_uri):
    # Bitbucket uses HTTP Basic auth with client_id:client_secret
    resp = requests.post(
        cfg['token_url'],
        auth=(cfg['client_id'], cfg['client_secret']),
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
        },
        timeout=10,
    )
    if resp.status_code != 200:
        logger.error('Bitbucket token exchange failed: %s %s', resp.status_code, resp.text)
    return resp.json().get('access_token')


def _fetch_user_github(token):
    r = requests.get(
        PROVIDERS['github']['user_url'],
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'},
        timeout=10,
    )
    u = r.json()
    return {
        'login': u.get('login'),
        'name': u.get('name') or u.get('login'),
        'avatar_url': u.get('avatar_url'),
    }


def _fetch_user_gitlab(token):
    r = requests.get(
        PROVIDERS['gitlab']['user_url'],
        headers={'Authorization': f'Bearer {token}'},
        timeout=10,
    )
    u = r.json()
    return {
        'login': u.get('username'),
        'name': u.get('name') or u.get('username'),
        'avatar_url': u.get('avatar_url'),
    }


def _fetch_user_bitbucket(token):
    r = requests.get(
        PROVIDERS['bitbucket']['user_url'],
        headers={'Authorization': f'Bearer {token}'},
        timeout=10,
    )
    u = r.json()
    avatar = (u.get('links') or {}).get('avatar', {}).get('href')
    return {
        'login': u.get('username'),
        'name': u.get('display_name') or u.get('username'),
        'avatar_url': avatar,
    }


# ───────────────────────── OAuth flow ─────────────────────────

@auth_bp.route('/auth/<provider>')
def oauth_login(provider):
    if provider not in PROVIDERS:
        return jsonify({'error': 'Unknown provider'}), 404
    cfg = PROVIDERS[provider]
    if not cfg['client_id']:
        return jsonify({'error': f'{provider} OAuth not configured'}), 500

    state = secrets.token_urlsafe(16)
    session['oauth_state'] = state
    session['oauth_provider'] = provider

    redirect_uri = _callback_url(provider)
    params = [
        f"client_id={cfg['client_id']}",
        f'state={state}',
        f'redirect_uri={redirect_uri}',
        'response_type=code',
    ]
    if cfg.get('scope'):
        # space-separated scopes; requests will percent-encode in URL builder, but we build manually here
        params.append(f"scope={cfg['scope'].replace(' ', '+')}")
    return redirect(f"{cfg['authorize_url']}?{'&'.join(params)}")


@auth_bp.route('/auth/<provider>/callback')
def oauth_callback(provider):
    if provider not in PROVIDERS:
        return redirect(f'{FRONTEND_URL}?auth_error=unknown_provider')

    code = request.args.get('code')
    state = request.args.get('state')
    expected_state = session.pop('oauth_state', None)
    expected_provider = session.pop('oauth_provider', None)

    if not code or state != expected_state or expected_provider != provider:
        return redirect(f'{FRONTEND_URL}?auth_error=invalid_state')

    cfg = PROVIDERS[provider]
    try:
        if provider == 'github':
            token = _exchange_code_github(cfg, code)
        elif provider == 'gitlab':
            token = _exchange_code_gitlab(cfg, code, _callback_url(provider))
        else:
            token = _exchange_code_bitbucket(cfg, code, _callback_url(provider))

        if not token:
            logger.error('%s OAuth: no token returned by provider', provider)
            return redirect(f'{FRONTEND_URL}?auth_error=no_token')

        if provider == 'github':
            user = _fetch_user_github(token)
        elif provider == 'gitlab':
            user = _fetch_user_gitlab(token)
        else:
            user = _fetch_user_bitbucket(token)

        session[_token_key(provider)] = token
        session[_user_key(provider)] = user
        return redirect(FRONTEND_URL)
    except Exception as exc:
        logger.error('%s OAuth callback failed: %s\n%s', provider, exc, traceback.format_exc())
        return redirect(f'{FRONTEND_URL}?auth_error=server_error')


# ───────────────────────── Status / logout ─────────────────────────

@auth_bp.route('/auth/status')
def auth_status():
    """Return per-provider connection state. Frontend uses this to render badges."""
    providers = {p: session.get(_user_key(p)) for p in PROVIDERS}
    any_authed = any(providers.values())
    # Legacy fields (kept so older frontend builds don't break mid-deploy)
    return jsonify({
        'authenticated': any_authed,
        'user': providers.get('github'),
        'providers': providers,
    })


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    """Logout from one provider (?provider=…) or all if none specified."""
    provider = request.args.get('provider')
    if provider:
        session.pop(_token_key(provider), None)
        session.pop(_user_key(provider), None)
    else:
        for p in PROVIDERS:
            session.pop(_token_key(p), None)
            session.pop(_user_key(p), None)
    return jsonify({'ok': True})


# ───────────────────────── Repo listing ─────────────────────────

def _list_repos_github(token):
    repos = []
    headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
    for page in range(1, 11):  # cap at 1000 repos
        resp = requests.get(
            'https://api.github.com/user/repos',
            headers=headers,
            params={
                'affiliation': 'owner,collaborator,organization_member',
                'per_page': 100, 'page': page,
                'sort': 'full_name', 'direction': 'asc',
            },
            timeout=15,
        )
        if resp.status_code != 200:
            raise RuntimeError(f'GitHub API error: {resp.status_code}')
        batch = resp.json()
        if not batch:
            break
        for r in batch:
            repos.append({
                'full_name': r.get('full_name'),
                'name': r.get('name'),
                'private': r.get('private', False),
                'html_url': r.get('html_url'),
                'description': r.get('description'),
                'language': r.get('language'),
                'updated_at': r.get('updated_at'),
            })
        if len(batch) < 100:
            break
    return repos


def _list_repos_gitlab(token):
    repos = []
    headers = {'Authorization': f'Bearer {token}'}
    for page in range(1, 11):
        resp = requests.get(
            'https://gitlab.com/api/v4/projects',
            headers=headers,
            params={
                'membership': 'true',
                'per_page': 100, 'page': page,
                'order_by': 'path', 'sort': 'asc',
                'simple': 'true',
            },
            timeout=15,
        )
        if resp.status_code != 200:
            raise RuntimeError(f'GitLab API error: {resp.status_code}')
        batch = resp.json()
        if not batch:
            break
        for r in batch:
            repos.append({
                'full_name': r.get('path_with_namespace'),
                'name': r.get('name'),
                'private': r.get('visibility') != 'public',
                'html_url': r.get('web_url'),
                'description': r.get('description'),
                'language': None,  # GitLab doesn't return language in simple listing
                'updated_at': r.get('last_activity_at'),
            })
        if len(batch) < 100:
            break
    return repos


def _bitbucket_paged_get(url, headers, params=None):
    """Iterate Bitbucket cursor-paginated responses, yielding each `values` item."""
    import time
    next_url = url
    next_params = params
    while next_url:
        t0 = time.time()
        resp = requests.get(next_url, headers=headers, params=next_params, timeout=20)
        logger.info('Bitbucket GET %s: %d in %.2fs', next_url, resp.status_code, time.time() - t0)
        if resp.status_code != 200:
            raise RuntimeError(f'Bitbucket API error: {resp.status_code} {resp.text[:200]}')
        data = resp.json()
        for item in data.get('values', []):
            yield item
        next_url = data.get('next')
        next_params = None  # next URL already carries query


def _list_repos_bitbucket(token):
    """List repos by walking each workspace.

    Bitbucket has deprecated the unscoped enumeration endpoints (returns 410):
      - /2.0/repositories?role=member
      - /2.0/user/permissions/repositories
    The supported path now is: list the user's workspaces, then list repos
    inside each workspace.
    """
    headers = {'Authorization': f'Bearer {token}'}

    # Step 1: list workspaces the user belongs to.
    workspace_slugs = []
    for ws in _bitbucket_paged_get(
        'https://api.bitbucket.org/2.0/workspaces',
        headers,
        params={'pagelen': 100, 'fields': 'next,values.slug'},
    ):
        slug = ws.get('slug')
        if slug:
            workspace_slugs.append(slug)
    logger.info('Bitbucket workspaces: %s', workspace_slugs)

    # Step 2: list repos in each workspace.
    fields = (
        'next,'
        'values.full_name,values.name,values.is_private,'
        'values.description,values.language,values.updated_on,'
        'values.links.html.href'
    )
    repos = []
    for slug in workspace_slugs:
        try:
            for r in _bitbucket_paged_get(
                f'https://api.bitbucket.org/2.0/repositories/{slug}',
                headers,
                params={'pagelen': 100, 'sort': 'full_name', 'fields': fields},
            ):
                links = r.get('links') or {}
                repos.append({
                    'full_name': r.get('full_name'),
                    'name': r.get('name'),
                    'private': r.get('is_private', False),
                    'html_url': (links.get('html') or {}).get('href'),
                    'description': r.get('description'),
                    'language': r.get('language') or None,
                    'updated_at': r.get('updated_on'),
                })
        except Exception as exc:
            # One bad workspace shouldn't kill the whole listing.
            logger.warning('Skipping Bitbucket workspace %s: %s', slug, exc)

    repos.sort(key=lambda x: (x['full_name'] or '').lower())
    logger.info('Bitbucket repos: %d total across %d workspace(s)', len(repos), len(workspace_slugs))
    return repos


@auth_bp.route('/auth/<provider>/repos')
def list_repos(provider):
    if provider not in PROVIDERS:
        return jsonify({'error': 'Unknown provider'}), 404
    token = session.get(_token_key(provider))
    if not token:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        if provider == 'github':
            repos = _list_repos_github(token)
        elif provider == 'gitlab':
            repos = _list_repos_gitlab(token)
        else:
            repos = _list_repos_bitbucket(token)
        return jsonify({'repos': repos, 'count': len(repos)})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 502


# ───────────────────────── Legacy GitHub-only route (compat) ─────────────────────────
# Older frontend builds call /auth/repos without a provider. Keep working.

@auth_bp.route('/auth/repos')
def list_repos_legacy():
    return list_repos('github')
