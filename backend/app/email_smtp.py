import smtplib
import asyncio
from email.message import EmailMessage
from app.config import BREVO_HOST, BREVO_PORT, BREVO_USER, BREVO_PASS, BREVO_FROM, log


def _send_smtp_sync(to: str, subject: str, html: str, text: str | None = None):
    msg = EmailMessage()
    msg["From"] = BREVO_FROM
    msg["To"] = to
    msg["Subject"] = subject
    if text:
        msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    if not BREVO_HOST or not BREVO_PORT:
        raise RuntimeError("SMTP server not configured (BREVO_HOST/BREVO_PORT)")

    with smtplib.SMTP(BREVO_HOST, BREVO_PORT, timeout=30) as s:
        s.starttls()
        if BREVO_USER and BREVO_PASS:
            s.login(BREVO_USER, BREVO_PASS)
        s.send_message(msg)


async def send_verification_email(to: str, code: str, name: str = "", link: str | None = None):
    """Send verification email via configured SMTP server (Brevo).

    This is async-friendly by delegating to a thread so it doesn't block the event loop.
    """
    subject = "Verify your SyrLink email"
    text = f"Hi {name},\n\nYour verification code: {code}\n\n" + (f"Link: {link}\n\n" if link else "") + "Thanks."
    html = (
        f"<div style=\"font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f4f2ee\">"
        f"<div style=\"background:white;border-radius:8px;padding:32px;text-align:center\">"
        f"<h1 style=\"color:#0a66c2;margin:0 0 8px\">Verify your email</h1>"
        f"<p style=\"color:#555\">Hi {name}, please confirm your email to activate your account.</p>"
        f"<p style=\"color:#333;margin-top:8px\">Your verification code is: <strong>{code}</strong></p>"
        + (f"<a href=\"{link}\" style=\"display:inline-block;margin-top:16px;background:#0a66c2;color:white;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600\">Verify email</a>" if link else "")
        f"<p style=\"font-size:11px;color:#888;margin-top:24px\">Connecting Talent. Building Futures.</p>"
        f"</div></div>"
    )

    try:
        await asyncio.to_thread(_send_smtp_sync, to, subject, html, text)
        log.debug(f"Sent verification email to {to} via SMTP")
    except Exception as e:
        log.error(f"SMTP send failed for {to}: {e}")
        raise
