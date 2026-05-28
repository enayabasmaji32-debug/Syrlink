import asyncio
import html
import random
import smtplib
import ssl
from email.message import EmailMessage

from app.config import GMAIL_PASS, GMAIL_USER, log

GMAIL_SMTP_SERVER = "smtp.gmail.com"
GMAIL_SMTP_PORT = 587


def _generate_otp(length: int = 6) -> str:
    """Return a random numeric OTP of the requested length."""
    return "".join(random.choices("0123456789", k=length))


def _build_email_message(to: str, subject: str, plain_text: str, html_body: str | None = None) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = GMAIL_USER
    message["To"] = to
    message.set_content(plain_text)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    return message


def _send_email_smtp(to: str, subject: str, plain_text: str, html_body: str | None = None) -> None:
    """Send an email through Gmail SMTP using environment credentials."""
    if not GMAIL_USER or not GMAIL_PASS:
        log.error("GMAIL_USER or GMAIL_PASS environment variables are not configured")
        raise RuntimeError("Gmail SMTP credentials are not configured")

    email_message = _build_email_message(to, subject, plain_text, html_body)
    context = ssl.create_default_context()

    log.info(f"[email_smtp] Sending email to {to} via Gmail SMTP")
    with smtplib.SMTP(GMAIL_SMTP_SERVER, GMAIL_SMTP_PORT, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(GMAIL_USER, GMAIL_PASS)
        server.send_message(email_message)
    log.info(f"[email_smtp] Email sent successfully to {to}")


async def sendOTP(to: str, code: str = "", name: str = "", link: str | None = None) -> str:
    """Generate a 6-digit OTP if needed and send it via Gmail SMTP."""
    if not code:
        code = _generate_otp()

    escaped_name = html.escape(name or "User")
    escaped_code = html.escape(code)
    log.info(f"[sendOTP] Generated OTP for {to}: {code}")

    plain_text = (
        f"Hello {escaped_name},\n\n"
        f"Your verification code is: {escaped_code}\n\n"
    )
    html_body = (
        f"<p>Hello {escaped_name},</p>"
        f"<p>Your verification code is: <strong>{escaped_code}</strong></p>"
    )
    if link:
        escaped_link = html.escape(link)
        plain_text += f"Verify your email: {escaped_link}\n\n"
        html_body += f"<p><a href=\"{escaped_link}\">Verify your email</a></p>"

    plain_text += "If you did not request this, please ignore this email.\n"
    html_body += "<p>If you did not request this, please ignore this email.</p>"

    await asyncio.to_thread(_send_email_smtp, to, "Your SyrLink verification code", plain_text, html_body)
    return code


async def send_verification_email(to: str, code: str, name: str = "", link: str | None = None):
    """Send a verification email to the user via Gmail SMTP."""
    return await sendOTP(to, code, name, link)


async def send_password_reset_email(to: str, reset_link: str, name: str = ""):
    """Send a password reset email via Gmail SMTP."""
    escaped_name = html.escape(name or "User")
    escaped_link = html.escape(reset_link)

    plain_text = (
        f"Hello {escaped_name},\n\n"
        "You requested a password reset. Use the link below to reset your password:\n"
        f"{escaped_link}\n\n"
        "If you did not request this, please ignore this email.\n"
    )
    html_body = (
        f"<p>Hello {escaped_name},</p>"
        "<p>You requested a password reset. Use the link below to reset your password:</p>"
        f"<p><a href=\"{escaped_link}\">Reset password</a></p>"
        "<p>If you did not request this, please ignore this email.</p>"
    )

    await asyncio.to_thread(_send_email_smtp, to, "SyrLink password reset request", plain_text, html_body)
    log.info(f"[email_smtp] Password reset email sent successfully to {to}")
