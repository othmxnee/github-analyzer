"""GitHub App routes.

GET  /github-app/status             configured? install link, my installations
GET  /github-app/setup              one-time creation of the app (admin only)
GET  /github-app/manifest-callback  GitHub returns here with the new app's credentials
GET  /github-app/installed          GitHub returns here after someone installs the app
POST /github-app/webhook            installation / repository events (signed)
"""
import json
import logging
import os
import secrets
from html import escape

import requests
from flask import Blueprint, jsonify, redirect, request, session

from services import github_app, store

logger = logging.getLogger(__name__)
github_app_bp = Blueprint('github_app', __name__)


def _frontend():
    return os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _backend():
    return os.environ.get('BACKEND_URL', 'http://localhost:5000').rstrip('/')


def _github_login():
    user = session.get('github_user') or {}
    return user.get('login')


def _is_admin():
    admin = os.environ.get('ADMIN_GITHUB_LOGIN', '').lower()
    return bool(admin) and (_github_login() or '').lower() == admin


@github_app_bp.route('/github-app/status', methods=['GET'])
def status():
    login = _github_login()
    configured = store.enabled() and github_app.configured()
    return jsonify({
        'enabled': store.enabled(),
        'configured': configured,
        'install_url': github_app.install_url() if configured else None,
        'is_admin': _is_admin(),
        'signed_in': bool(login),
        'installations': github_app.installations_of(login) if (configured and login) else [],
    })


@github_app_bp.route('/github-app/setup', methods=['GET'])
def setup():
    if not store.enabled():
        return jsonify({'error': 'A database is required.'}), 503
    if not _is_admin():
        return jsonify({'error': 'Only the site administrator can create the GitHub App. Sign in with GitHub first.'}), 403
    if github_app.configured():
        return redirect(github_app.install_url())
    state = secrets.token_urlsafe(24)
    session['gh_app_state'] = state
    manifest = {
        "name": os.environ.get('GITHUB_APP_NAME', 'Git Analyzer'),
        "url": _frontend(),
        "description": "Knowledge-risk analysis for your repositories: bus factor, ownership, "
                       "orphaned code and nightly alerts. Read-only access.",
        "hook_attributes": {"url": f"{_backend()}/github-app/webhook", "active": True},
        "redirect_url": f"{_backend()}/github-app/manifest-callback",
        "setup_url": f"{_backend()}/github-app/installed",
        "setup_on_update": True,
        "public": True,
        "default_permissions": {"contents": "read", "metadata": "read"},
        "default_events": ["push"],
    }
    # GitHub creates apps from a manifest POSTed by the browser: auto-submit.
    return f"""<!doctype html><meta charset="utf-8"><title>Create the Git Analyzer GitHub App</title>
<body style="font-family:system-ui;background:#07090F;color:#EEE;padding:40px">
<p>Sending you to GitHub to create the app (read-only access to repository contents)…</p>
<form id="f" method="post" action="https://github.com/settings/apps/new?state={escape(state)}">
<input type="hidden" name="manifest" value="{escape(json.dumps(manifest))}">
<button type="submit">Continue to GitHub</button></form>
<script>document.getElementById('f').submit()</script></body>"""


@github_app_bp.route('/github-app/manifest-callback', methods=['GET'])
def manifest_callback():
    if not _is_admin() or request.args.get('state') != session.pop('gh_app_state', None):
        return jsonify({'error': 'Invalid or expired setup request. Start again from /github-app/setup.'}), 400
    try:
        conversion = github_app.convert_manifest(request.args.get('code', ''))
        github_app.save_from_manifest(conversion)
    except Exception as exc:
        logger.exception("GitHub App manifest conversion failed")
        return jsonify({'error': f'GitHub did not return the app credentials: {exc}'}), 502
    return redirect(github_app.install_url())


def _user_can_access_installation(installation_id):
    """The signed-in user's own GitHub token must list this installation."""
    token = session.get('github_token')
    if not token:
        return False
    page = 1
    while page <= 10:
        r = requests.get('https://api.github.com/user/installations', params={'per_page': 100, 'page': page},
                         headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'},
                         timeout=15)
        if r.status_code != 200:
            return False
        items = r.json().get('installations', [])
        if any(int(i['id']) == installation_id for i in items):
            return True
        if len(items) < 100:
            return False
        page += 1
    return False


@github_app_bp.route('/github-app/installed', methods=['GET'])
def installed():
    try:
        installation_id = int(request.args.get('installation_id', ''))
    except ValueError:
        return redirect(f"{_frontend()}/portfolio?installed=invalid")
    login = _github_login()
    if not login:
        # Sign in first, then come back here to link the installation.
        session['after_login'] = f"{_backend()}/github-app/installed?installation_id={installation_id}"
        return redirect(f"{_backend()}/auth/github")
    if not _user_can_access_installation(installation_id):
        return redirect(f"{_frontend()}/portfolio?installed=forbidden")
    try:
        result = github_app.sync_installation(installation_id, owner_login=login)
    except Exception:
        logger.exception("could not sync installation %s", installation_id)
        return redirect(f"{_frontend()}/portfolio?installed=error")
    return redirect(f"{_frontend()}/portfolio?installed={result['account']}&repos={result['repositories']}")


@github_app_bp.route('/github-app/webhook', methods=['POST'])
def webhook():
    body = request.get_data()
    if not github_app.verify_signature(body, request.headers.get('X-Hub-Signature-256')):
        return jsonify({'error': 'bad signature'}), 401
    event = request.headers.get('X-GitHub-Event', '')
    payload = request.get_json(silent=True) or {}
    inst = payload.get('installation') or {}
    iid = inst.get('id')
    action = payload.get('action')
    try:
        if event == 'installation' and iid:
            account = (inst.get('account') or {})
            if action in ('created', 'new_permissions_accepted', 'unsuspend'):
                github_app.upsert_installation(iid, account.get('login'), account.get('type'), active=True)
                repos = payload.get('repositories') or []
                github_app.link_repositories(iid, [{"url": f"https://github.com/{r['full_name']}",
                                                    "private": bool(r.get('private'))} for r in repos])
            elif action in ('deleted', 'suspend'):
                github_app.upsert_installation(iid, account.get('login'), account.get('type'), active=False)
                if action == 'deleted':
                    github_app.unlink_repositories(iid)
        elif event == 'installation_repositories' and iid:
            added = payload.get('repositories_added') or []
            removed = payload.get('repositories_removed') or []
            github_app.link_repositories(iid, [{"url": f"https://github.com/{r['full_name']}",
                                                "private": bool(r.get('private'))} for r in added])
            github_app.unlink_repositories(iid, [f"https://github.com/{r['full_name']}" for r in removed])
    except Exception:
        logger.exception("webhook %s/%s failed", event, action)
        return jsonify({'error': 'processing failed'}), 500
    return jsonify({'ok': True, 'event': event})
