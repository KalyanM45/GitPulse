"""Email notifications to the owner: a new access request arrived.

Sent over SMTP (see the SMTP_* settings in config.py) from a background task,
after the visitor's response has gone out, so a slow or failing mail server never
delays or breaks the request form. Requests are always saved in the database and
shown on /admin; the email is a convenience on top.
"""

import logging
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from html import escape

from .config import APP_URL, NOTIFY_EMAILS, SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER

log = logging.getLogger(__name__)


def email_enabled() -> bool:
    return bool(SMTP_HOST and NOTIFY_EMAILS)


def _send(msg: EmailMessage) -> None:
    context = ssl.create_default_context()
    if SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20, context=context)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
        server.starttls(context=context)
    with server:
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def access_request_received(email: str, description: str) -> None:
    """Tell the owner someone asked for access. Reply-To is the requester, so
    replying to the email answers them directly."""
    if not email_enabled():
        log.info("Access request from %s saved (email notifications are off).", email)
        return

    when = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    admin_url = f"{APP_URL}/admin"
    description = description or "(no description)"

    msg = EmailMessage()
    msg["Subject"] = f"GitPulse access request from {email}"
    msg["From"] = formataddr(("GitPulse", SMTP_FROM))
    msg["To"] = ", ".join(NOTIFY_EMAILS)
    msg["Reply-To"] = email
    msg.set_content(
        f"New request for GitPulse access.\n\n"
        f"Email: {email}\n"
        f"When:  {when}\n\n"
        f"Why they're interested:\n{description}\n\n"
        f"Approve or reject: {admin_url}\n"
        f"(Reply to this email to answer them directly.)\n"
    )
    msg.add_alternative(
        f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;color:#111827">
  <p style="margin:0 0 16px;font-weight:700;color:#4f46e5">GitPulse</p>
  <h2 style="margin:0 0 12px;font-size:18px">New access request</h2>
  <p style="margin:0 0 4px"><b>Email:</b> <a href="mailto:{escape(email)}">{escape(email)}</a></p>
  <p style="margin:0 0 16px;color:#6b7280">{escape(when)}</p>
  <p style="margin:0 0 6px"><b>Why they're interested</b></p>
  <blockquote style="margin:0 0 20px;padding:10px 14px;border-left:3px solid #6366f1;background:#f4f5f7;white-space:pre-wrap">{escape(description)}</blockquote>
  <a href="{escape(admin_url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none">Review on GitPulse</a>
  <p style="margin:20px 0 0;font-size:12px;color:#6b7280">Reply to this email to answer them directly.</p>
</div>""",
        subtype="html",
    )
    try:
        _send(msg)
        log.info("Emailed access request from %s to %s", email, ", ".join(NOTIFY_EMAILS))
    except Exception:
        log.exception("Couldn't email access request from %s (it's still saved on /admin).", email)
