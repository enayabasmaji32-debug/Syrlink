"""Authentication routes."""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
import resend
import time
import httpx
import asyncio
import random
import string
from urllib.parse import urlencode

from app.models import (
    RegisterIn, LoginIn, VerifyEmailIn, VerifyOtpIn, ResendVerificationIn, ForgotPasswordIn, ResetPasswordIn
)
from app.security import hash_password, verify_password, create_token, get_current_user
from app.utils import uid, now_iso
from app.email_smtp import send_verification_email
from app.otp_store import store_otp, verify_otp, clear_otp
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
async def register(data: RegisterIn, request: Request, background_tasks: BackgroundTasks):
    """
    Register a new user and send OTP.
    
    الخطوات:
    1. التحقق من صحة البيانات المدخلة
    2. التحقق من وجود الإيميل في قاعدة البيانات
       - إذا موجود وتم التحقق منه → خطأ (استخدم login)
       - إذا موجود ولم يتم التحقق → أرسل OTP جديد
       - إذا جديد → أنشئ المستخدم وأرسل OTP
    3. إرسال OTP عبر الإيميل
    4. إرجاع رسالة نجاح مع بيانات المستخدم
    """
    try:
        # ========== خطوة 1: التحقق من صحة البيانات ==========
        if not data.name or not data.name.strip():
            log.warning("[register] ❌ Missing or empty name")
            raise HTTPException(status_code=422, detail="Name is required and cannot be empty")
        
        if not data.password or len(data.password) < 6:
            log.warning("[register] ❌ Password too short")
            raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
        
        if not data.email or not data.email.strip():
            log.warning("[register] ❌ Missing or empty email")
            raise HTTPException(status_code=422, detail="Email is required")
        
        email = data.email.lower().strip()
        name = data.name.strip()
        log.info(f"[register] 📨 Starting registration for: {email}")
        
        # ========== خطوة 2: التحقق من وجود الإيميل ==========
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            log.info(f"[register] ℹ️ Email already exists in database: {email}")
            
            # الحالة أ: الإيميل موجود والبريد مفعّل بالفعل
            if existing_user.get("email_verified"):
                log.warning(f"[register] ❌ Email already verified: {email}")
                raise HTTPException(
                    status_code=400, 
                    detail="This email is already registered and verified. Please login instead."
                )
            
            # الحالة ب: الإيميل موجود لكن البريد لم يتم التحقق منه
            log.info(f"[register] ℹ️ Email exists but not verified, resending OTP: {email}")
            otp_code = ''.join(random.choices(string.digits, k=6))
            store_otp(email, otp_code)
            log.info(f"[register] 🔐 Generated new OTP for unverified user: {otp_code}")
            
            background_tasks.add_task(
                send_verification_email,
                email,
                otp_code,
                existing_user.get("name", "User"),
                ""
            )
            log.info(f"[register] 🔄 Scheduled OTP resend in background for {email}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "ok": True,
                    "message": "This email is already registered but not verified. We've resent your verification code.",
                    "user": {k: v for k, v in existing_user.items() if k not in ("password_hash", "_id")},
                    "verification_required": True,
                    "already_registered": True
                }
            )
        
        # ========== الحالة ج: الإيميل جديد تماماً - أنشئ المستخدم ==========
        log.info(f"[register] ✓ Email is new, creating user: {email}")
        
        user_id = uid()
        doc = {
            "id": user_id,
            "name": name,
            "email": email,
            "password_hash": hash_password(data.password),
            "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={name}",
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": (data.headline or "").strip(),
            "location": "",
            "about": "",
            "verified": False,
            "email_verified": False,  # يجب التحقق من البريد
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "connections": 0,
            "created_at": now_iso(),
            "last_seen": now_iso(),
        }
        
        # محاولة إدراج المستخدم
        try:
            await db.users.insert_one(doc)
            log.info(f"[register] ✓ User created in database: {email}")
        except Exception as db_err:
            error_msg = str(db_err).lower()
            
            # إذا حدث خطأ duplicate أثناء الإدراج
            if "duplicate" in error_msg or "e11000" in error_msg:
                log.warning(f"[register] ⚠️ Duplicate key error (race condition): {email}")
                # جرّب مرة أخرى: قد يكون هناك سباق مع طلب آخر
                existing = await db.users.find_one({"email": email})
                if existing:
                    if existing.get("email_verified"):
                        raise HTTPException(
                            status_code=400, 
                            detail="Email already registered. Please login instead."
                        )
                    else:
                        # أرسل OTP للمستخدم الموجود
                        try:
                            otp_code = ''.join(random.choices(string.digits, k=6))
                            store_otp(email, otp_code)
                            background_tasks.add_task(
                                send_verification_email,
                                email,
                                otp_code,
                                existing.get("name", ""),
                                ""
                            )
                            return JSONResponse(
                                status_code=200,
                                content={
                                    "ok": True,
                                    "message": "Email already registered. OTP has been resent.",
                                    "verification_required": True,
                                    "already_registered": True
                                }
                            )
                        except Exception as email_err:
                            log.error(f"[register] failed to schedule duplicate resend email: {email_err}")
                            pass
                raise HTTPException(
                    status_code=400, 
                    detail="Email already registered. Please try to verify or login."
                )
            else:
                log.error(f"[register] ❌ Database error: {db_err}")
                raise HTTPException(
                    status_code=500, 
                    detail="Failed to create account. Please try again later."
                )
        
        # ========== إرسال OTP ==========
        otp_code = ''.join(random.choices(string.digits, k=6))
        store_otp(email, otp_code)
        log.info(f"[register] 🔐 Generated OTP: {otp_code}")
        
        background_tasks.add_task(send_verification_email, email, otp_code, name, "")
        log.info(f"[register] 🔄 Scheduled OTP send in background for {email}")
        
        user_out = {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}
        log.info(f"[register] ✅ Registration completed successfully: {email}")
        
        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "message": "Registration successful! Please verify your email to complete signup.",
                "user": user_out,
                "verification_required": True
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[register] ❌ Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Registration failed. Please try again later."
        )


@router.post("/verify-otp")
async def verify_email_otp(data: VerifyOtpIn):
    """
    Verify OTP and mark email as verified.
    
    الخطوات:
    1. التحقق من صحة الرمز المدخل
    2. البحث عن المستخدم بالإيميل
    3. تحديث حالة البريد (email_verified = True)
    4. إرجاع بيانات المستخدم
    """
    try:
        email = data.email.lower().strip()
        otp_code = data.otp.strip()
        
        log.info(f"[verify-otp] 🔐 Verifying OTP for: {email}")
        
        # ========== خطوة 1: التحقق من الرمز ==========
        if not verify_otp(email, otp_code):
            log.warning(f"[verify-otp] ❌ Invalid or expired OTP for {email}")
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired OTP. Please request a new one."
            )
        
        log.info(f"[verify-otp] ✓ OTP is valid for {email}")
        
        # ========== خطوة 2: البحث عن المستخدم ==========
        user = await db.users.find_one({"email": email})
        if not user:
            log.error(f"[verify-otp] ❌ User not found for email {email}")
            raise HTTPException(
                status_code=404, 
                detail="User not found. Please register first."
            )
        
        # ========== خطوة 3: تحديث حالة البريد ==========
        result = await db.users.update_one(
            {"email": email},
            {"$set": {
                "email_verified": True,
                "verified": True,
                "last_seen": now_iso()
            }}
        )
        
        if result.matched_count == 0:
            log.error(f"[verify-otp] ❌ Failed to update user: {email}")
            raise HTTPException(
                status_code=404, 
                detail="User not found"
            )
        
        log.info(f"[verify-otp] ✅ Email verified successfully: {email}")
        
        # ========== خطوة 4: إرجاع بيانات المستخدم المحدثة وإنشاء الجلسة ==========
        user = await db.users.find_one({"email": email})
        user_out = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
        token = create_token(user["id"], email)
        response = JSONResponse({
            "ok": True,
            "message": "Email verified successfully! You are now logged in.",
            "token": token,
            "user": user_out
        })
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
    
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[verify-otp] ❌ Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Verification failed. Please try again later."
        )


@router.post("/resend-otp")
async def resend_otp(data: ResendVerificationIn, background_tasks: BackgroundTasks):
    """
    Resend OTP to email.
    
    الحالات:
    1. إذا المستخدم موجود والبريد لم يتم التحقق منه → أرسل OTP جديد
    2. إذا المستخدم موجود والبريد تم التحقق منه → أخبره أنه مفعّل بالفعل
    3. إذا المستخدم غير موجود → خطأ 404
    """
    try:
        email = data.email.lower().strip()
        
        log.info(f"[resend-otp] 📨 Resending OTP for: {email}")
        
        # ========== البحث عن المستخدم ==========
        user = await db.users.find_one({"email": email})
        if not user:
            log.warning(f"[resend-otp] ❌ User not found: {email}")
            raise HTTPException(
                status_code=404, 
                detail="User not found. Please register first."
            )
        
        # ========== الحالة 1: البريد مفعّل بالفعل ==========
        if user.get("email_verified"):
            log.info(f"[resend-otp] ℹ️ Email already verified: {email}")
            return JSONResponse({
                "ok": True,
                "message": "Your email is already verified! You can login now.",
                "already_verified": True
            })
        
        # ========== الحالة 2: البريد غير مفعّل، أرسل OTP جديد ==========
        log.info(f"[resend-otp] 🔐 Generating new OTP for unverified user: {email}")
        otp_code = ''.join(random.choices(string.digits, k=6))
        store_otp(email, otp_code)
        log.info(f"[resend-otp] 🔐 Generated OTP: {otp_code}")
        
        # إرسال الإيميل في الخلفية
        background_tasks.add_task(
            send_verification_email,
            email,
            otp_code,
            user.get("name", "User"),
            ""
        )
        log.info(f"[resend-otp] 🔄 Scheduled OTP send in background for {email}")
        
        return JSONResponse({
            "ok": True,
            "message": "New verification code sent to your email!",
            "already_verified": False
        })
    
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[resend-otp] ❌ Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to resend OTP. Please try again later."
        )


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

    # Check email verification status BEFORE allowing login
    if not user.get("email_verified"):
        log.warning(f"Login blocked: email not verified - {email}")
        # Provide helpful message with link to verify
        raise HTTPException(
            status_code=403,
            detail="Please verify your email to complete login. Check your inbox for a verification code."
        )

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
    # Deprecated endpoint: token-based verify-email removed in favor of OTP flow.
    raise HTTPException(status_code=410, detail="Deprecated endpoint. Use /auth/verify-otp instead.")


@router.post("/resend-verification")
async def resend_verification(data: ResendVerificationIn, request: Request):
    """Resend verification email to an unverified account."""
    # Deprecated endpoint: use /auth/resend-otp for OTP-based flows.
    raise HTTPException(status_code=410, detail="Deprecated endpoint. Use /auth/resend-otp instead.")


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
