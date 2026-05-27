"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
import resend
import time
import httpx
import asyncio
from urllib.parse import urlencode

from app.models import (
    RegisterIn, LoginIn, VerifyEmailIn, ResendVerificationIn, ForgotPasswordIn, ResetPasswordIn
)
from app.security import hash_password, verify_password, create_token, get_current_user
from app.utils import uid, now_iso
from app.email_smtp import send_verification_email
from app.database import db
from app.config import (
    APP_URL,
    RESEND_FROM,
    log,
    JWT_COOKIE_NAME,
    JWT_COOKIE_MAX_AGE,
    COOKIE_SECURE,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(data: RegisterIn, request: Request):
    """Register a new user."""
    try:
        # Validate input
        if not data.name or not data.name.strip():
            log.warning("[register] Missing or empty name")
            raise HTTPException(status_code=422, detail="Name is required and cannot be empty")
        
        if not data.password or len(data.password) < 6:
            log.warning("[register] Password too short")
            raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
        
        email = data.email.lower().strip()
        
        # Check if email already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            log.info(f"[register] Email already registered: {email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = uid()
        verify_token = uid()
        doc = {
            "id": user_id,
            "name": data.name.strip(),
            "email": email,
            "password_hash": hash_password(data.password),
            "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={data.name.strip()}",
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": (data.headline or "").strip(),
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
        
        # Insert user with error handling
        try:
            await db.users.insert_one(doc)
            log.info(f"[register] ✓ User registered: {email}")
        except Exception as db_err:
            # Handle duplicate key error or other DB errors
            if "duplicate" in str(db_err).lower():
                log.warning(f"[register] Duplicate key error for {email}: {db_err}")
                raise HTTPException(status_code=400, detail="Email already registered")
            else:
                log.error(f"[register] Database error: {db_err}")
                raise HTTPException(status_code=500, detail="Failed to create account. Please try again later.")
    
        app_url = APP_URL or str(request.base_url).rstrip("/")
        if not app_url:
            log.error("[register] APP_URL not configured and request URL unavailable, cannot send verification email")
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=500, detail="Server email configuration is missing")

        link = f"{app_url}/verify-email?token={verify_token}&uid={user_id}"
        log.info(f"[register] Attempting to send verification email to {email} via SMTP/Brevo")
        try:
            await send_verification_email(email, verify_token, name=data.name.strip(), link=link)
            log.debug(f"[register] Verification email sent to {email} via SMTP/Brevo")
        except Exception as e:
            # On failure: log but do not delete the user or raise 500 — allow registration to complete
            log.error(f"[register] Failed to send verification email to {email}: {e}")

        user_out = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "verify_token")}
        return JSONResponse({"ok": True, "message": "Verification email sent", "user": user_out, "verification_required": True})
    
    except HTTPException:
        # Re-raise HTTPException (already has proper status code)
        raise
    except Exception as e:
        log.error(f"[register] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again later.")


@router.post("/login")
async def login(data: LoginIn):
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

    if not user.get("email_verified"):
        log.warning(f"Login blocked: email not verified - {email}")
        raise HTTPException(status_code=403, detail="يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.")

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
    response = JSONResponse({"token": token, "user": user})
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=JWT_COOKIE_MAX_AGE,
        path="/",
    )
    return response


@router.get("/me")
async def me(current=Depends(get_current_user)):
    """Get current user profile (slim version for fast loading)."""
    # Return slim user from token - UI loads full profile from /users/{id} when needed
    return current


@router.post("/logout")
async def logout() -> JSONResponse:
    """Clear the auth cookie and log the user out."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(
        key=JWT_COOKIE_NAME,
        path="/",
    )
    return response


@router.get("/google/login")
async def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_OAUTH_REDIRECT,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Missing Google authorization code")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_OAUTH_REDIRECT,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=20,
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
        token_data = token_resp.json()

        userinfo_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
            timeout=20,
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        google_user = userinfo_resp.json()

    email = google_user.get("email")
    if not email or not google_user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google account email is required and must be verified")

    user = await db.users.find_one({"email": email.lower()})
    if not user:
        user_id = uid()
        user = {
            "id": user_id,
            "name": google_user.get("name", "Unnamed User"),
            "email": email.lower(),
            "password_hash": "",
            "avatar": google_user.get("picture", f"https://api.dicebear.com/7.x/initials/svg?seed={google_user.get('name', 'user')}"),
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": "",
            "location": google_user.get("locale", ""),
            "about": "",
            "verified": False,
            "email_verified": True,
            "verify_token": "",
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "connections": 0,
            "created_at": now_iso(),
            "last_seen": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso(), "email_verified": True}})

    token = create_token(user["id"], email.lower())
    user.pop("_id", None)
    user.pop("password_hash", None)

    redirect_target = APP_URL or "/"
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=JWT_COOKIE_MAX_AGE,
        path="/",
    )
    return response


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
async def resend_verification(data: ResendVerificationIn, request: Request):
    """Resend verification email to an unverified account."""
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal whether the email exists
        return {"ok": True, "already_sent": False}
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}

    new_token = uid()
    await db.users.update_one({"id": user["id"]}, {"$set": {"verify_token": new_token}})

    app_url = APP_URL or str(request.base_url).rstrip("/")
    if not app_url:
        log.error("[resend_verification] APP_URL not configured and request URL unavailable, cannot send verification email")
        raise HTTPException(status_code=500, detail="Server email configuration is missing")

    link = f"{app_url}/verify-email?token={new_token}&uid={user['id']}"
    user_name = user.get('name', '')
    email_payload = {
        "from": RESEND_FROM,
        "to": email,
        "subject": "Verify your SyrLink email",
        "text": f"Hi {user_name},\n\nPlease verify your SyrLink account by visiting the link below:\n{link}\n\nIf the link does not work, use this code: {new_token}\n\nThank you.",
        "html": (
            '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f4f2ee">'
            '<div style="background:white;border-radius:8px;padding:32px;text-align:center">'
            '<h1 style="color:#0a66c2;margin:0 0 8px">Verify your email</h1>'
            '<p style="color:#555">Hi {name}, please confirm your email to activate your account.</p>'
            '<p style="color:#333;margin-top:8px">Your verification code is: <strong>{code}</strong></p>'
            '<a href="{link}" style="display:inline-block;margin-top:16px;background:#0a66c2;color:white;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600">Verify email</a>'
            '<p style="font-size:11px;color:#888;margin-top:24px">Connecting Talent. Building Futures.</p>'
            '</div></div>'
        ).format(name=user_name, code=new_token, link=link),
    }

    try:
        await send_verification_email(email, new_token, name=user_name, link=link)
    except Exception as e:
        log.error(f"[resend_verification] Failed to send verification email to {email}: {e}")
        # Do not raise; return success semantics to the client
        return {"ok": True, "resent": False}

    return {"ok": True, "resent": True}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordIn, request: Request):
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
                app_url = APP_URL or str(request.base_url).rstrip("/")
                link = f"{app_url}/reset-password?token={reset_token}&uid={user['id']}"
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
