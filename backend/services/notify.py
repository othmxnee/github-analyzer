"""Delivering alerts: email (any SMTP provider) and Slack incoming webhooks.

Email is configured with environment variables, so any provider works
(Resend, Postmark, Amazon SES, Mailgun, Gmail...):

    SMTP_HOST, SMTP_PORT (587), SMTP_USERNAME, SMTP_PASSWORD,
    SMTP_FROM ("Git Analyzer <alerts@yourdomain.com>"),
    SMTP_STARTTLS (default: on, except on port 1025 used by local test servers)

Without SMTP_HOST, emails are logged and not sent.

Slack webhook URLs come from users, so only Slack's own webhook host is
accepted: otherwise the server could be made to call internal addresses.
"""
import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid

import requests

logger = logging.getLogger(__name__)

SLACK_PREFIX = "https://hooks.slack.com/services/"


def email_enabled():
    return bool(os.environ.get("SMTP_HOST"))


def send_email(to, subject, text, html=None):
    if not email_enabled():
        logger.info("email disabled (no SMTP_HOST): would send %r to %s", subject, to)
        return False
    port = int(os.environ.get("SMTP_PORT", "587"))
    starttls = os.environ.get("SMTP_STARTTLS", "0" if port == 1025 else "1") not in ("0", "false", "no")
    sender = os.environ.get("SMTP_FROM", "Git Analyzer <alerts@localhost>")
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1].strip(">") or "localhost")
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as smtp:
            if starttls:
                smtp.starttls()
            if os.environ.get("SMTP_USERNAME"):
                smtp.login(os.environ["SMTP_USERNAME"], os.environ.get("SMTP_PASSWORD", ""))
            smtp.send_message(msg)
        return True
    except Exception:
        logger.exception("could not send email to %s", to)
        return False


def valid_slack_webhook(url):
    allowed = os.environ.get("GA_SLACK_PREFIX", SLACK_PREFIX)   # tests point this at a local server
    return isinstance(url, str) and url.startswith(allowed) and len(url) <= 500


def post_slack(url, text):
    if not valid_slack_webhook(url):
        logger.warning("refusing to post to a non-Slack webhook URL")
        return False
    try:
        r = requests.post(url, json={"text": text}, timeout=10)
        return r.status_code < 300
    except Exception:
        logger.exception("could not post to Slack")
        return False
