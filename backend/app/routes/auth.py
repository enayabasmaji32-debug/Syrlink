"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
import httpx
import secrets
from urllib.parse import urlencode

from app.security import create_token, get_current_user
from app.utils import uid, now_iso
from app.database import db
from app.config import (
    APP_URL,
    log,
    JWT_COOKIE_NAME,
    JWT_COOKIE_MAX_AGE,
    COOKIE_SECURE,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_OAUTH_REDIRECT,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_github_auth_url(state: str) -> str:
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_OAUTH_REDIRECT,
        "scope": "read:user user:email",
        "state": state,
        "allow_signup": "true",
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


def _build_google_auth_url(state: str) -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_OAUTH_REDIRECT,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


@router.get("/github/login")
async def github_login(request: Request):
    if not GITHUB_CLIENT_ID or not GITHUB_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")

    state = secrets.token_urlsafe(16)
    auth_url = _build_github_auth_url(state)

    response = RedirectResponse(auth_url)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=300,
        path="/",
    )
    return response


@router.get("/google/login")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    state = secrets.token_urlsafe(16)
    auth_url = _build_google_auth_url(state)

    response = RedirectResponse(auth_url)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=300,
        path="/",
    )
    return response


@router.get("/github/callback")
async def github_callback(request: Request, code: str | None = None, state: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Missing GitHub authorization code")
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET or not GITHUB_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured")

    cookie_state = request.cookies.get("oauth_state")
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_OAUTH_REDIRECT,
                "state": state,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitHub code")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="GitHub token exchange returned no access token")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub user profile")
        github_user = user_resp.json()

        email = github_user.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
            )
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                primary = next((item for item in emails if item.get("primary") and item.get("verified")), None)
                if primary:
                    email = primary.get("email")
                else:
                    verified = next((item for item in emails if item.get("verified")), None)
                    email = verified.get("email") if verified else None

    if not email:
        raise HTTPException(status_code=400, detail="Unable to determine a verified GitHub email address")

    email = email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = uid()
        created_at = now_iso()
        user = {
            "id": user_id,
            "name": github_user.get("name") or github_user.get("login") or "GitHub User",
            "email": email,
            "avatar": github_user.get("avatar_url", f"https://api.dicebear.com/7.x/initials/svg?seed={email}"),
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": "",
            "location": github_user.get("location", ""),
            "about": "",
            "verified": True,
            "email_verified": True,
            "oauth_provider": "github",
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "connections": 0,
            "created_at": created_at,
            "last_seen": created_at,
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_seen": now_iso(), "email_verified": True, "verified": True}},
        )

    token = create_token(user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)

    redirect_target = APP_URL or "/"
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=JWT_COOKIE_MAX_AGE,
        path="/",
    )
    response.delete_cookie(key="oauth_state", path="/")
    return response


@router.get("/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Missing Google authorization code")
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_OAUTH_REDIRECT:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    cookie_state = request.cookies.get("oauth_state")
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient(timeout=20) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_OAUTH_REDIRECT,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google token exchange returned no access token")

        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user profile")
        google_user = user_resp.json()

    email = google_user.get("email")
    verified_email = google_user.get("verified_email")
    if not email or not verified_email:
        raise HTTPException(status_code=400, detail="Unable to determine a verified Google email address")

    email = email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = uid()
        created_at = now_iso()
        user = {
            "id": user_id,
            "name": google_user.get("name") or google_user.get("given_name") or "Google User",
            "email": email,
            "avatar": google_user.get("picture", f"https://api.dicebear.com/7.x/initials/svg?seed={email}"),
            "cover": "https://images.unsplash.com/photo-1497215728101-856f4ea42174",
            "headline": "",
            "location": google_user.get("locale", ""),
            "about": "",
            "verified": True,
            "email_verified": True,
            "oauth_provider": "google",
            "experience": [],
            "education": [],
            "skills": [],
            "languages": [],
            "connections": 0,
            "created_at": created_at,
            "last_seen": created_at,
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_seen": now_iso(), "email_verified": True, "verified": True}},
        )

    token = create_token(user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)

    redirect_target = APP_URL or "/"
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=JWT_COOKIE_MAX_AGE,
        path="/",
    )
    response.delete_cookie(key="oauth_state", path="/")
    return response


@router.get("/me")
async def me(current=Depends(get_current_user)):
    return current


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.delete_cookie(
        key=JWT_COOKIE_NAME,
        path="/",
    )
    response.delete_cookie(key="oauth_state", path="/")
    return response
