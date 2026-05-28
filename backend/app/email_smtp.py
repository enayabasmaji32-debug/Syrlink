import asyncio
import html
import httpx
from app.config import RESEND_API_KEY, RESEND_FROM, log

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _send_resend_email(to: str, subject: str, text_body: str, html_body: str | None = None):
    payload = {
        "from": RESEND_FROM,
        "to": [to],
        "subject": subject,
        "text": text_body,
    }
    if html_body is not None:
        payload["html"] = html_body

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(RESEND_ENDPOINT, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response
    except httpx.HTTPStatusError as exc:
        log.error(f"[resend] HTTP error sending email to {to}: {exc}")
        log.error("Resend response: %s", exc.response.text if exc.response is not None else "<no response>")
        log.debug("Resend request payload: %s", payload)
        raise
    except httpx.RequestError as exc:
        log.error(f"[resend] Request error sending email to {to}: {exc}")
        log.debug("Resend request payload: %s", payload)
        raise


async def sendOTP(to: str, code: str, name: str = "", link: str | None = None):
    """Send OTP email via Resend only."""
    if not RESEND_API_KEY:
        raise RuntimeError("Resend API key is missing")

    escaped_name = html.escape(name or "User")
    escaped_code = html.escape(code)
    plain_text = f"Hello {escaped_name},\n\nYour verification code is: {escaped_code}\n"
    html_text = f"<p>Hello {escaped_name},</p><p>Your verification code is: <strong>{escaped_code}</strong></p>"
    if link:
        escaped_link = html.escape(link)
        plain_text += f"\nVerify your email: {escaped_link}\n"
        html_text += f"<p><a href=\"{escaped_link}\">Verify your email</a></p>"
    plain_text += "\nIf you did not request this, please ignore this email.\n"
    html_text += "<p>If you did not request this, please ignore this email.</p>"

    await asyncio.to_thread(_send_resend_email, to, "Your SyrLink verification code", plain_text, html_text)
    log.debug(f"Sent verification email to {to} via Resend")


async def sendVerificationEmail(to: str, code: str, name: str = "", link: str | None = None):
    """Alias for sendOTP, using Resend only."""
    return await sendOTP(to, code, name, link)


async def send_verification_email(to: str, code: str, name: str = "", link: str | None = None):
    """Send verification email via Resend only."""
    return await sendOTP(to, code, name, link)


async def send_password_reset_email(to: str, reset_link: str, name: str = ""):
    """Send password reset email via Resend only."""
    if not RESEND_API_KEY:
        raise RuntimeError("Resend API key is missing")

    escaped_name = html.escape(name or "User")
    escaped_link = html.escape(reset_link)
    plain_text = (
        f"Hello {escaped_name},\n\n"
        f"You requested a password reset. Use the link below to reset your password:\n{escaped_link}\n\n"
        "If you did not request this, please ignore this email.\n"
    )
    html_text = (
        f"<p>Hello {escaped_name},</p>"
        f"<p>You requested a password reset. Use the link below to reset your password:</p>"
        f"<p><a href=\"{escaped_link}\">Reset password</a></p>"
        "<p>If you did not request this, please ignore this email.</p>"
    )
    await asyncio.to_thread(_send_resend_email, to, "SyrLink password reset request", plain_text, html_text)
    log.debug(f"Sent password reset email to {to} via Resend")
