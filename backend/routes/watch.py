"""Alerts API: watch a repository, confirm / unsubscribe, list alerts.

POST   /watch                    {repo_url, email?, slack_webhook_url?}  (signed in)
GET    /watches                  the signed-in user's watches
DELETE /watch/<id>               stop one of them
GET    /watch/confirm?token=     link from the confirmation email
GET    /watch/unsubscribe?token= link in every alert email
GET    /alerts?repo_url=         recent alerts for a repository
"""
import os
import re
import subprocess

from flask import Blueprint, jsonify, redirect, request, session

from extensions import limiter
from routes.analyze import _forbidden, _provider_for_url
from services import analyzer, notify, store, watches

watch_bp = Blueprint('watch', __name__)

_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")


def _current_user():
    for provider in ('github', 'gitlab', 'bitbucket'):
        user = session.get(f'{provider}_user')
        if user and user.get('login'):
            return provider, user['login']
    return None, None


def _publicly_readable(repo_url):
    """Nightly re-checks clone anonymously, so only public repositories for now."""
    if analyzer.is_private(repo_url):
        return False
    try:
        r = subprocess.run(['git', 'ls-remote', repo_url, 'HEAD'], capture_output=True, text=True,
                           timeout=25, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
        return r.returncode == 0 and bool(r.stdout.strip())
    except Exception:
        return False


@watch_bp.route('/watch', methods=['POST'])
@limiter.limit('20 per hour')
def create_watch():
    if not store.enabled():
        return jsonify({'error': 'Alerts need a database on the server (DATABASE_URL).'}), 503
    provider, login = _current_user()
    if not login:
        return jsonify({'error': 'Sign in to get alerts.'}), 401
    data = request.get_json() or {}
    repo_url = (data.get('repo_url') or '').strip()
    email = (data.get('email') or '').strip().lower() or None
    slack = (data.get('slack_webhook_url') or '').strip() or None
    if not _provider_for_url(repo_url):
        return jsonify({'error': 'Invalid repository URL.'}), 400
    if not email and not slack:
        return jsonify({'error': 'Give an email address or a Slack webhook.'}), 400
    if email and not _EMAIL_RE.match(email):
        return jsonify({'error': 'That email address does not look right.'}), 400
    if email and not notify.email_enabled():
        return jsonify({'error': 'Email alerts are not configured on this server yet. Use Slack.'}), 503
    if slack and not notify.valid_slack_webhook(slack):
        return jsonify({'error': 'Use a Slack incoming-webhook URL (https://hooks.slack.com/services/...).'}), 400
    if watches.count_for_owner(provider, login) >= watches.MAX_WATCHES_PER_USER:
        return jsonify({'error': f'You can watch up to {watches.MAX_WATCHES_PER_USER} repositories.'}), 400
    if not _publicly_readable(repo_url):
        return jsonify({'error': 'Nightly alerts work for public repositories for now. '
                                 'Private repositories need the Git Analyzer GitHub App (coming soon).'}), 400

    watch_id, token = watches.create(repo_url, provider, login, email=email, slack_webhook_url=slack)
    if email:
        watches.send_confirmation(watch_id, token, email, repo_url)
    return jsonify({
        'id': watch_id,
        'status': 'pending_confirmation' if email else 'active',
        'message': (f'Check {email} and click the link to start alerts.' if email
                    else 'Alerts will be posted to Slack.'),
    })


@watch_bp.route('/watches', methods=['GET'])
def list_watches():
    provider, login = _current_user()
    if not login or not store.enabled():
        return jsonify({'watches': []})
    return jsonify({'watches': watches.list_for_owner(provider, login)})


@watch_bp.route('/watch/<int:watch_id>', methods=['DELETE'])
def delete_watch(watch_id):
    provider, login = _current_user()
    if not login:
        return jsonify({'error': 'Sign in first.'}), 401
    if not watches.delete(watch_id, provider, login):
        return jsonify({'error': 'Not found.'}), 404
    return jsonify({'ok': True})


@watch_bp.route('/watch/confirm', methods=['GET'])
def confirm_watch():
    url = watches.confirm(request.args.get('token')) if store.enabled() else None
    return redirect(f"{watches.frontend_url()}/?watch={'confirmed' if url else 'invalid'}")


@watch_bp.route('/watch/unsubscribe', methods=['GET'])
def unsubscribe_watch():
    url = watches.unsubscribe(request.args.get('token')) if store.enabled() else None
    return redirect(f"{watches.frontend_url()}/?watch={'unsubscribed' if url else 'invalid'}")


@watch_bp.route('/alerts', methods=['GET'])
def list_alerts():
    repo_url = request.args.get('repo_url') or ''
    if not _provider_for_url(repo_url):
        return jsonify({'error': 'Invalid repository URL.'}), 400
    denied = _forbidden(repo_url)
    if denied:
        return denied
    if not store.enabled():
        return jsonify({'enabled': False, 'alerts': []})
    return jsonify({'enabled': True, 'alerts': watches.recent(repo_url)})
