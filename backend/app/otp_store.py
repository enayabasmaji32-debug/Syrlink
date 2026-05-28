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

# In-memory fallback store
_otp_cache = {}

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


def store_otp(email: str, otp_code: str) -> None:
    """Sync-friendly wrapper that schedules async storage."""
    try:
        # schedule background task to store otp
        asyncio.create_task(_store_otp_async(email, otp_code))
    except RuntimeError:
        # if there is no running loop (unlikely in FastAPI), perform sync fallback
        _otp_cache[email.lower()] = {"code": otp_code, "expires_at": time.time() + OTP_EXPIRY_SECONDS}


async def verify_otp_async(email: str, otp_code: str) -> bool:
    """Async verify against Redis or in-memory fallback."""
    email = email.lower()
    email_key = f"otp:{email}"

    if _redis_client:
        try:
            val = await _redis_client.get(email_key)
            if val is None:
                return False
            # redis returns bytes/str depending on client
            stored_code = val.decode("utf-8") if isinstance(val, (bytes, bytearray)) else str(val)
            if stored_code.strip() != otp_code.strip():
                return False
            await _redis_client.delete(email_key)
            return True
        except Exception as e:
            log.warning(f"Redis OTP verify failed, falling back to memory: {e}")

    # fallback
    if email not in _otp_cache:
        return False
    stored = _otp_cache[email]
    if time.time() > stored["expires_at"]:
        del _otp_cache[email]
        return False
    if stored["code"] != otp_code.strip():
        return False
    del _otp_cache[email]
    return True


def clear_otp(email: str) -> None:
    """Clear OTP from both stores (async for redis)."""
    email = email.lower()
    if _redis_client:
        try:
            asyncio.create_task(_redis_client.delete(f"otp:{email}"))
            return
        except Exception:
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
