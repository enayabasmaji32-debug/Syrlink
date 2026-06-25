"""OTP Storage and Management
Prefer Redis (async) with an in-memory fallback.
Provides simple async helpers and a sync-friendly `store_otp` wrapper
so existing call sites in the codebase keep working.
"""
from typing import Optional
import time
import asyncio
import logging
from app.config import REDIS_URL

log = logging.getLogger("syrlink.otp")

# Default expiry 10 minutes
OTP_EXPIRY_SECONDS = 10 * 60

# Rate limiting: max 5 OTP requests per hour per email
OTP_REQUEST_MAX = 5
OTP_REQUEST_WINDOW = 60 * 60  # 1 hour

# Brute force: lock after 3 failed verification attempts per email
OTP_ATTEMPT_MAX = 3
OTP_ATTEMPT_WINDOW = 60 * 60  # 1 hour
OTP_LOCK_DURATION = 60 * 60  # 1 hour lock

# In-memory fallback stores
_otp_cache = {}
_otp_request_log = {}  # email -> list of timestamps
_otp_attempt_log = {}  # email -> list of timestamps
_otp_lock = {}  # email -> lock_until timestamp

# Try to import redis.asyncio if available
try:
    import redis.asyncio as aioredis
    _redis_client = aioredis.from_url(REDIS_URL) if REDIS_URL else None
except Exception:
    _redis_client = None


async def _store_otp_async(email: str, otp_code: str) -> None:
    email_key = f"otp:{email.lower()}"
    if _redis_client:
        try:
            await _redis_client.set(email_key, otp_code, ex=OTP_EXPIRY_SECONDS)
            return
        except Exception as e:
            log.warning(f"Redis OTP set failed, falling back to memory: {e}")

    # fallback
    _otp_cache[email.lower()] = {"code": otp_code, "expires_at": time.time() + OTP_EXPIRY_SECONDS}


def _is_rate_limited(email: str) -> bool:
    """Check if email has exceeded OTP request rate limit."""
    email = email.lower()
    now = time.time()
    requests = _otp_request_log.get(email, [])
    # Remove old requests outside the window
    requests = [ts for ts in requests if now - ts < OTP_REQUEST_WINDOW]
    _otp_request_log[email] = requests
    return len(requests) >= OTP_REQUEST_MAX


def _is_locked(email: str) -> bool:
    """Check if email is locked due to too many failed attempts."""
    email = email.lower()
    lock_until = _otp_lock.get(email, 0)
    if lock_until and time.time() < lock_until:
        return True
    if lock_until and time.time() >= lock_until:
        del _otp_lock[email]
    return False


def _record_request(email: str) -> None:
    email = email.lower()
    now = time.time()
    requests = _otp_request_log.get(email, [])
    requests.append(now)
    _otp_request_log[email] = requests


def _record_attempt(email: str) -> None:
    email = email.lower()
    now = time.time()
    attempts = _otp_attempt_log.get(email, [])
    attempts = [ts for ts in attempts if now - ts < OTP_ATTEMPT_WINDOW]
    attempts.append(now)
    _otp_attempt_log[email] = attempts
    if len(attempts) >= OTP_ATTEMPT_MAX:
        _otp_lock[email] = now + OTP_LOCK_DURATION


def store_otp(email: str, otp_code: str) -> None:
    """Sync-friendly wrapper that stores locally immediately and schedules async storage.
    Raises ValueError if rate limit or lock is active."""
    email = email.lower()
    if _is_locked(email):
        raise ValueError("Too many failed attempts. Please try again in 1 hour.")
    if _is_rate_limited(email):
        raise ValueError("Too many OTP requests. Please try again later.")
    _record_request(email)
    _otp_cache[email] = {"code": otp_code, "expires_at": time.time() + OTP_EXPIRY_SECONDS}
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_store_otp_async(email, otp_code))
    except RuntimeError:
        pass


async def verify_otp_async(email: str, otp_code: str) -> bool:
    """Async verify against Redis or in-memory fallback.
    Returns True if valid, False otherwise. Locks email after 3 failed attempts."""
    email = email.lower()
    if _is_locked(email):
        return False

    email_key = f"otp:{email}"
    if _redis_client:
        try:
            val = await _redis_client.get(email_key)
            if val is not None:
                stored_code = val.decode("utf-8") if isinstance(val, (bytes, bytearray)) else str(val)
                if stored_code.strip() == otp_code.strip():
                    await _redis_client.delete(email_key)
                    _otp_cache.pop(email, None)
                    return True
                _record_attempt(email)
                return False
        except Exception as e:
            log.warning(f"Redis OTP verify failed, falling back to memory: {e}")

    # fallback
    if email not in _otp_cache:
        _record_attempt(email)
        return False
    stored = _otp_cache[email]
    if time.time() > stored["expires_at"]:
        del _otp_cache[email]
        _record_attempt(email)
        return False
    if stored["code"] != otp_code.strip():
        _record_attempt(email)
        return False
    del _otp_cache[email]
    return True


def clear_otp(email: str) -> None:
    """Clear OTP from both stores (async for redis)."""
    email = email.lower()
    if _redis_client:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_redis_client.delete(f"otp:{email}"))
        except RuntimeError:
            pass
    if email in _otp_cache:
        del _otp_cache[email]


async def get_otp_expiry_async(email: str) -> Optional[int]:
    """Return remaining seconds until OTP expiry, or None if none."""
    email = email.lower()
    if _redis_client:
        try:
            ttl = await _redis_client.ttl(f"otp:{email}")
            return ttl if ttl >= 0 else None
        except Exception:
            pass

    if email not in _otp_cache:
        return None
    remaining = int(_otp_cache[email]["expires_at"] - time.time())
    return max(0, remaining)


# Backwards-compatible alias used by tests and other code
otp_cache = _otp_cache
