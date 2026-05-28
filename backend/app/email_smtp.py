import asyncio
import html
import httpx
from app.config import EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_USER_ID, log

EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send"


def _send_emailjs(to: str, params: dict):
    payload = {
        "service_id": EMAILJS_SERVICE_ID,
        "template_id": EMAILJS_TEMPLATE_ID,
        "user_id": EMAILJS_USER_ID,
        "template_params": params,
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        response = httpx.post(EMAILJS_ENDPOINT, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response
    except httpx.HTTPStatusError as exc:
        log.error(f"[emailjs] HTTP error sending email to {to}: {exc}")
        log.error("EmailJS response: %s", exc.response.text if exc.response is not None else "<no response>")
        log.debug("EmailJS request payload: %s", payload)
        raise
    except httpx.RequestError as exc:
        log.error(f"[emailjs] Request error sending email to {to}: {exc}")
        log.debug("EmailJS request payload: %s", payload)
        raise


async def send_verification_email(to: str, code: str, name: str = "", link: str | None = None):
    """Send verification email via EmailJS only."""
    if not EMAILJS_SERVICE_ID or not EMAILJS_TEMPLATE_ID or not EMAILJS_USER_ID:
        raise RuntimeError("EmailJS configuration is missing")

    params = {
        "email": to,
        "passcode": code,
        "name": html.escape(name or ""),
        "link": link or "",
    }
    await asyncio.to_thread(_send_emailjs, to, params)
    log.debug(f"Sent verification email to {to} via EmailJS")


async def send_password_reset_email(to: str, reset_link: str, name: str = ""):
    """Send password reset email via EmailJS only."""
    if not EMAILJS_SERVICE_ID or not EMAILJS_TEMPLATE_ID or not EMAILJS_USER_ID:
        raise RuntimeError("EmailJS configuration is missing")

    params = {
        "email": to,
        "reset_link": reset_link,
        "name": html.escape(name or ""),
    }
    await asyncio.to_thread(_send_emailjs, to, params)
    log.debug(f"Sent password reset email to {to} via EmailJS")
