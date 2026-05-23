"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import resend
import time

from app.models import (
    RegisterIn, LoginIn, VerifyEmailIn, ForgotPasswordIn, ResetPasswordIn
)
from app.security import hash_password, verify_password, create_token, get_current_user
from app.utils import uid, now_iso
from app.database import db
from app.config import APP_URL, RESEND_FROM, log

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register")
async def register(data: RegisterIn):
    """Register a new user."""
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = uid()
    verify_token = uid()
    doc = {
        "id": user_id,
        "name": data.name,
        "email": email,
        "password_hash": hash_password(data.password),
        "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={data.name}",
        "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
        "headline": data.headline or "",
        "location": "",
        "about": "",
        "verified": False,
        "email_verified": False,
        "verify_token": verify_token,
        "experience": [],
        "education": [],
        "skills": [],
        "languages": [],
        "connections": 0,
        "created_at": now_iso(),
        "last_seen": now_iso(),
    }
    await db.users.insert_one(doc)
    
    # Send verification email in background (don't block registration)
    async def send_email():
        try:
            link = f"{APP_URL}/verify-email?token={verify_token}&uid={user_id}"
            resend.Emails.send({
                "from": RESEND_FROM,
                "to": email,
                "subject": "Welcome to SyrLink — verify your email",
                "html": f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f4f2ee"><div style="background:white;border-radius:8px;padding:32px;text-align:center"><h1 style="color:#0a66c2;margin:0 0 8px">Welcome to SyrLink</h1><p style="color:#555">Hi {data.name}, please confirm your email to activate your account.</p><a href="{link}" style="display:inline-block;margin-top:16px;background:#0a66c2;color:white;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600">Verify email</a><p style="font-size:11px;color:#888;margin-top:24px">Connecting Talent. Building Futures.</p></div></div>',
            })
        except Exception as e:
            log.warning(f"Resend send failed: {e}")
    
    # Don't await - send in background
    import asyncio
    asyncio.create_task(send_email())
    
    token = create_token(user_id, email)
    user_out = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "verify_token")}
    return {"token": token, "user": user_out}


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginIn):
    """Login a user."""
    start_time = time.time()
    email = data.email.lower()
    
    # Find user in database
    db_start = time.time()
    user = await db.users.find_one({"email": email})
    db_time = time.time() - db_start
    

    if not user:
        log.warning(f"Login failed: user not found - {email} (DB query: {db_time:.3f}s)")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if user is suspended
    if user.get("suspended", False):
        reason = user.get("suspend_reason", "تم تعليق حسابك من قبل الإدارة.")
        raise HTTPException(status_code=403, detail=f"لقد قمنا بتعليق حسابك: {reason}")

    # Verify password
    pwd_start = time.time()
    password_valid = await verify_password(data.password, user.get("password_hash", ""))
    pwd_time = time.time() - pwd_start

    if not password_valid:
        log.warning(f"Login failed: invalid password - {email} (DB: {db_time:.3f}s, PWD: {pwd_time:.3f}s)")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last_seen on login
    update_start = time.time()
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso()}})
    update_time = time.time() - update_start
    user["last_seen"] = now_iso()

    # Create token
    token_start = time.time()
    token = create_token(user["id"], email)
    token_time = time.time() - token_start

    total_time = time.time() - start_time
    log.info(f"✓ Login successful - {email} (Total: {total_time:.3f}s | DB: {db_time:.3f}s | PWD: {pwd_time:.3f}s | Update: {update_time:.3f}s | Token: {token_time:.3f}s)")

    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@router.get("/me")
async def me(current=Depends(get_current_user)):
    """Get current user profile (slim version for fast loading)."""
    # Return slim user from token - UI loads full profile from /users/{id} when needed
    return current


@router.post("/verify-email")
async def verify_email(data: VerifyEmailIn):
    """Verify email address."""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    if user.get("verify_token") != data.token:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"email_verified": True}, "$unset": {"verify_token": ""}},
    )
    return {"ok": True}


@router.post("/resend-verification")
async def resend_verification(current=Depends(get_current_user)):
    """Resend verification email."""
    if current.get("email_verified"):
        return {"ok": True, "already_verified": True}
    
    new_token = uid()
    await db.users.update_one({"id": current["id"]}, {"$set": {"verify_token": new_token}})
    
    # Send verification email in background (don't block)
    async def send_email():
        try:
            link = f"{APP_URL}/verify-email?token={new_token}&uid={current['id']}"
            resend.Emails.send({
                "from": RESEND_FROM,
                "to": current["email"],
                "subject": "Verify your SyrLink email",
                "html": f'<p>Hi {current["name"]},</p><p>Confirm your email: <a href="{link}">Verify now</a></p>',
            })
        except Exception as e:
            log.warning(f"Resend verification failed: {e}")
    
    # Don't await - send in background
    import asyncio
    asyncio.create_task(send_email())
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordIn):
    """Request password reset."""
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return ok to avoid email enumeration
    if user:
        reset_token = uid()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"reset_token": reset_token, "reset_token_at": now_iso()}},
        )
        
        # Send reset email in background (don't block)
        async def send_email():
            try:
                link = f"{APP_URL}/reset-password?token={reset_token}&uid={user['id']}"
                resend.Emails.send({
                    "from": RESEND_FROM,
                    "to": email,
                    "subject": "Reset your SyrLink password",
                    "html": f'<p>Hi {user["name"]},</p><p>Reset your password: <a href="{link}">Click here</a></p><p>This link expires in 1 hour. If you did not request this, ignore.</p>',
                })
            except Exception as e:
                log.warning(f"Reset email failed: {e}")
        
        # Don't await - send in background
        import asyncio
        asyncio.create_task(send_email())
    
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordIn):
    """Reset password with token."""
    user = await db.users.find_one({"id": data.user_id})
    if not user or user.get("reset_token") != data.token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"password_hash": hash_password(data.new_password)},
         "$unset": {"reset_token": "", "reset_token_at": ""}},
    )
    return {"ok": True}
