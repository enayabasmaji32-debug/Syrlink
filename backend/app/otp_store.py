"""
OTP Storage and Management
Stores generated OTPs temporarily with expiration
"""
import time
from typing import Optional, Dict

# In-memory OTP store: {email: {"code": str, "expires_at": timestamp}}
otp_cache: Dict[str, dict] = {}
OTP_EXPIRY_SECONDS = 10 * 60  # 10 minutes


def store_otp(email: str, otp_code: str) -> None:
    """Store OTP with expiration time"""
    otp_cache[email.lower()] = {
        "code": otp_code,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS
    }


def verify_otp(email: str, otp_code: str) -> bool:
    """Verify OTP and return True if valid, False otherwise"""
    email = email.lower()
    
    if email not in otp_cache:
        return False
    
    stored = otp_cache[email]
    
    # Check if expired
    if time.time() > stored["expires_at"]:
        del otp_cache[email]
        return False
    
    # Check code
    if stored["code"] != otp_code.strip():
        return False
    
    # Valid - delete the used OTP
    del otp_cache[email]
    return True


def clear_otp(email: str) -> None:
    """Clear OTP for an email"""
    email = email.lower()
    if email in otp_cache:
        del otp_cache[email]


def get_otp_expiry(email: str) -> Optional[int]:
    """Get remaining seconds until OTP expires"""
    email = email.lower()
    if email not in otp_cache:
        return None
    
    remaining = int(otp_cache[email]["expires_at"] - time.time())
    return max(0, remaining)
