import asyncio
import html
import resend
from app.config import RESEND_API_KEY, RESEND_FROM, log

resend.api_key = RESEND_API_KEY


def _send_resend_email(to: str, subject: str, html: str, text: str | None = None):
    if not RESEND_API_KEY:
        raise RuntimeError("Resend API key not configured")

    payload = {
        "from": RESEND_FROM,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    resend.Emails.send(payload)


async def send_verification_email(to: str, code: str, name: str = "", link: str | None = None):
    """Send verification email via Resend API only.

    This is async-friendly by delegating to a thread so it doesn't block the event loop.
    """
    subject = "Verify your SyrLink email"
    safe_name = html.escape(name or "")
    text = f"Hi {name},\n\nYour verification code: {code}\n\n" + (f"Link: {link}\n\n" if link else "") + "Thanks."
    parts = []
    parts.append('<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f4f2ee">')
    parts.append('<div style="background:white;border-radius:8px;padding:32px;text-align:center">')
    parts.append('<h1 style="color:#0a66c2;margin:0 0 8px">Verify your email</h1>')
    parts.append(f'<p style="color:#555">Hi {safe_name}, please confirm your email to activate your account.</p>')
    parts.append(f'<p style="color:#333;margin-top:8px">Your verification code is: <strong>{html.escape(code)}</strong></p>')
    if link:
        parts.append(f'<a href="{link}" style="display:inline-block;margin-top:16px;background:#0a66c2;color:white;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600">Verify email</a>')
    parts.append('<p style="font-size:11px;color:#888;margin-top:24px">Connecting Talent. Building Futures.</p>')
    parts.append('</div></div>')
    html = "".join(parts)

    if not RESEND_API_KEY:
        raise RuntimeError("Resend API key not configured")

    await asyncio.to_thread(_send_resend_email, to, subject, html, text)
    log.debug(f"Sent verification email to {to} via Resend API")
