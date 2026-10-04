"""Watches (who wants alerts for which repository) and stored alerts.

A watch is created by a signed-in user for a public repository, with an
email address (confirmed through a link before anything is sent to it)
and/or a Slack incoming webhook. Every alert email carries a signed
one-click unsubscribe link.
"""
import hashlib
import logging
import os
import secrets
from datetime import datetime, timezone

from itsdangerous import BadSignature, URLSafeSerializer

from services import notify
from services.store import _get_or_create_repo, unpack_json

logger = logging.getLogger(__name__)

MAX_WATCHES_PER_USER = 10


def _now():
    return datetime.now(timezone.utc)


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _serializer():
    return URLSafeSerializer(os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-in-production"),
                             salt="watch-unsubscribe")


def unsubscribe_token(watch_id):
    return _serializer().dumps(watch_id)


def frontend_url():
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def backend_url():
    return os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")


def dashboard_link(repo_url):
    from urllib.parse import quote
    return f"{frontend_url()}/?repo={quote(repo_url, safe='')}"


# ── watches ─────────────────────────────────────────────────────────────────

def count_for_owner(provider, login):
    import db
    from models import Watch
    with db.session() as s:
        return s.query(Watch).filter_by(provider=provider, login=login, active=True).count()


def create(repo_url, provider, login, email=None, slack_webhook_url=None):
    """Returns (watch_id, confirm_token or None)."""
    import db
    from models import Watch
    token = secrets.token_urlsafe(32)
    with db.session() as s, s.begin():
        repo = _get_or_create_repo(s, repo_url)
        w = Watch(repository_id=repo.id, provider=provider, login=login,
                  email=email or None, slack_webhook_url=slack_webhook_url or None,
                  token_hash=_hash(token), active=True, created_at=_now())
        s.add(w)
        s.flush()
        return w.id, (token if email else None)


def confirm(token):
    import db
    from models import Watch
    with db.session() as s, s.begin():
        w = s.query(Watch).filter_by(token_hash=_hash(token or "")).one_or_none()
        if w is None or not w.active:
            return None
        if w.email_confirmed_at is None:
            w.email_confirmed_at = _now()
        return w.repository.url


def unsubscribe(token):
    try:
        watch_id = _serializer().loads(token or "")
    except BadSignature:
        return None
    import db
    from models import Watch
    with db.session() as s, s.begin():
        w = s.get(Watch, int(watch_id))
        if w is None:
            return None
        w.active = False
        return w.repository.url


def list_for_owner(provider, login):
    import db
    from models import Watch
    with db.session() as s:
        rows = (s.query(Watch).filter_by(provider=provider, login=login, active=True)
                .order_by(Watch.created_at.desc()).all())
        return [{
            "id": w.id, "repo_url": w.repository.url, "email": w.email,
            "email_confirmed": w.email_confirmed_at is not None,
            "slack": bool(w.slack_webhook_url),
            "created_at": w.created_at.isoformat() if w.created_at else None,
        } for w in rows]


def delete(watch_id, provider, login):
    import db
    from models import Watch
    with db.session() as s, s.begin():
        w = s.get(Watch, watch_id)
        if w is None or w.provider != provider or w.login != login:
            return False
        w.active = False
        return True


def watched_repositories():
    """Repositories with at least one watch that can receive something."""
    import db
    from models import Repository, Watch
    with db.session() as s:
        q = (s.query(Repository).join(Watch, Watch.repository_id == Repository.id)
             .filter(Watch.active.is_(True))
             .filter((Watch.email_confirmed_at.isnot(None)) | (Watch.slack_webhook_url.isnot(None)))
             .distinct().order_by(Repository.id))
        return [{"id": r.id, "url": r.url, "private": r.private, "last_head_sha": r.last_head_sha}
                for r in q.all()]


def nightly_repositories():
    """What the nightly job re-checks: every watched repository, plus every
    repository of an active GitHub App installation (installing the app is
    the opt-in; alerts still go only to watchers)."""
    import db
    from models import Installation, Repository
    by_id = {r["id"]: dict(r, installation_id=None) for r in watched_repositories()}
    with db.session() as s:
        rows = (s.query(Repository.id, Repository.url, Repository.private, Repository.last_head_sha,
                        Repository.installation_id)
                .join(Installation, Installation.installation_id == Repository.installation_id)
                .filter(Installation.active.is_(True)).all())
        for rid, url, private, head, iid in rows:
            by_id[rid] = {"id": rid, "url": url, "private": private, "last_head_sha": head, "installation_id": iid}
    return [by_id[k] for k in sorted(by_id)]


def _deliverable(s, repository_id):
    from models import Watch
    return (s.query(Watch).filter_by(repository_id=repository_id, active=True)
            .filter((Watch.email_confirmed_at.isnot(None)) | (Watch.slack_webhook_url.isnot(None)))
            .all())


# ── alerts ──────────────────────────────────────────────────────────────────

def previous_results(repository_id, before_run_id):
    """Full result of the finished run just before `before_run_id`, if still stored."""
    import db
    from models import AnalysisRun
    with db.session() as s:
        run = (s.query(AnalysisRun)
               .filter(AnalysisRun.repository_id == repository_id, AnalysisRun.status == "done",
                       AnalysisRun.id < before_run_id, AnalysisRun.result_gz.isnot(None))
               .order_by(AnalysisRun.id.desc()).first())
        return unpack_json(run.result_gz) if run else None


def record(repository_id, run_id, alerts):
    if not alerts:
        return []
    import db
    from models import Alert
    with db.session() as s, s.begin():
        rows = [Alert(repository_id=repository_id, run_id=run_id, kind=a["kind"], severity=a["severity"],
                      title=a["title"][:300], message=a["message"], created_at=_now()) for a in alerts]
        s.add_all(rows)
        s.flush()
        return [r.id for r in rows]


def recent(repo_url, limit=20):
    import db
    from models import Alert, Repository
    with db.session() as s:
        rows = (s.query(Alert).join(Repository, Alert.repository_id == Repository.id)
                .filter(Repository.url == repo_url)
                .order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit).all())
        return [{"id": a.id, "kind": a.kind, "severity": a.severity, "title": a.title,
                 "message": a.message, "created_at": a.created_at.isoformat()} for a in rows]


# ── messages ────────────────────────────────────────────────────────────────

def _repo_name(url):
    return url.rstrip("/").split("/", 3)[-1]


def send_confirmation(watch_id, token, email, repo_url):
    link = f"{backend_url()}/watch/confirm?token={token}"
    name = _repo_name(repo_url)
    text = (f"Confirm that you want knowledge-risk alerts for {name}.\n\n{link}\n\n"
            "Git Analyzer re-checks the repository every night and emails you when its bus factor, "
            "health score or knowledge ownership gets worse. If you didn't ask for this, ignore this email.")
    html = (f"<p>Confirm that you want knowledge-risk alerts for <b>{name}</b>.</p>"
            f"<p><a href=\"{link}\">Confirm alerts</a></p>"
            "<p>Git Analyzer re-checks the repository every night and emails you when its bus factor, "
            "health score or knowledge ownership gets worse. If you didn't ask for this, ignore this email.</p>")
    return notify.send_email(email, f"Confirm alerts for {name}", text, html)


def _alert_text(repo_url, alerts):
    lines = [f"Changes in {_repo_name(repo_url)} since the last analysis:", ""]
    for a in alerts:
        lines.append(f"{'[!] ' if a['severity'] == 'high' else '- '}{a['title']}")
        lines.append(f"    {a['message']}")
    lines += ["", f"Dashboard: {dashboard_link(repo_url)}"]
    return "\n".join(lines)


def notify_watchers(repository_id, repo_url, alerts):
    """Send one message per watcher and channel. Returns (emails_sent, slack_posts)."""
    if not alerts:
        return 0, 0
    import db
    emails = posts = 0
    name = _repo_name(repo_url)
    high = sum(a["severity"] == "high" for a in alerts)
    subject = f"{'⚠ ' if high else ''}{name}: {len(alerts)} knowledge-risk change{'s' if len(alerts) != 1 else ''}"
    body = _alert_text(repo_url, alerts)
    with db.session() as s, s.begin():
        for w in _deliverable(s, repository_id):
            sent = False
            if w.email and w.email_confirmed_at:
                unsub = f"{backend_url()}/watch/unsubscribe?token={unsubscribe_token(w.id)}"
                html = ("<p>Changes in <b>{}</b> since the last analysis:</p><ul>{}</ul>"
                        "<p><a href=\"{}\">Open the dashboard</a></p>"
                        "<p style=\"color:#888;font-size:12px\"><a href=\"{}\">Stop these alerts</a></p>").format(
                    name,
                    "".join(f"<li><b>{a['title']}</b><br>{a['message']}</li>" for a in alerts),
                    dashboard_link(repo_url), unsub)
                if notify.send_email(w.email, subject, body + f"\n\nStop these alerts: {unsub}", html):
                    emails += 1
                    sent = True
            if w.slack_webhook_url and notify.post_slack(
                    w.slack_webhook_url, f"*{subject}*\n{body}"):
                posts += 1
                sent = True
            if sent:
                w.last_notified_at = _now()
    return emails, posts
