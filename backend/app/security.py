"""Security utilities: password hashing, JWT, auth dependencies."""
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
import jwt
from concurrent.futures import ThreadPoolExecutor
import asyncio

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_MIN, JWT_COOKIE_NAME, log
from app.database import db

security = HTTPBearer(auto_error=False)
# Thread pool for CPU-intensive bcrypt operations
_thread_pool = ThreadPoolExecutor(max_workers=4)


def hash_password(plain: str) -> str:
    """Hash a plain text password using bcrypt."""
    # Use rounds=10 instead of default 12 for faster login (still very secure)
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def _verify_password_sync(plain: str, hashed: str) -> bool:
    """Synchronous password verification (runs in thread pool)."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain text password against a bcrypt hash (async wrapper)."""
    # Run CPU-intensive bcrypt operation in thread pool
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, _verify_password_sync, plain, hashed)


def create_token(user_id: str, email: str) -> str:
    """Create a JWT token for a user."""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MIN),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """Get the current authenticated user from JWT token.

    Preference order: Authorization bearer header, then httpOnly cookie.
    """
    bearer_token = creds.credentials if creds and creds.credentials else None
    cookie_token = request.cookies.get(JWT_COOKIE_NAME) if JWT_COOKIE_NAME in request.cookies else None
    token = bearer_token or cookie_token

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        if bearer_token and cookie_token and bearer_token != cookie_token:
            try:
                payload = jwt.decode(cookie_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
            except jwt.InvalidTokenError:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        if bearer_token and cookie_token and bearer_token != cookie_token:
            try:
                payload = jwt.decode(cookie_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
            except jwt.InvalidTokenError:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    # Slim projection: skip heavy fields (cover/about/experience/education) on every
    # authenticated request. Legacy users may have base64-encoded avatars/covers
    # stored in MongoDB which can be several MB — loading them on every API call
    # makes endpoints like POST /posts hang for many seconds.
    user = await db.users.find_one(
        {"id": payload["sub"]},
        {
            "_id": 0,
            "password_hash": 0,
            "cover": 0,
            "about": 0,
            "experience": 0,
            "education": 0,
            "verify_token": 0,
            "reset_token": 0,
            "reset_token_at": 0,
        },
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
    return user


async def require_admin(current=Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure the current user is an admin."""
    if not current.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current
