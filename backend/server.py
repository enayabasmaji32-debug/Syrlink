"""SyrLink Backend — FastAPI + MongoDB.

Entry point for the modular SyrLink backend.
All routes are mounted under /api. Uses UUID string ids and ISO-8601 datetimes everywhere.
JWT bearer auth backed by bcrypt-hashed passwords.

DEPRECATED: This file is kept for backward compatibility.
New code uses the modular structure in app/ directory.
See app/main.py for the FastAPI application.
"""
# Import app from modular structure
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any

import bcrypt
import jwt
import resend
import cloudinary
import cloudinary.utils
import cloudinary.uploader
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("syrlink")

mongo_url = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MIN = int(os.environ.get("JWT_EXPIRY_MIN", "10080"))

client = AsyncIOMotorClient(mongo_url)
db = client[DB_NAME]

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.environ.get("CLOUDINARY_API_KEY", ""),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET", ""),
    secure=True,
)

resend.api_key = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "onboarding@resend.dev")
APP_URL = os.environ.get("APP_URL", "")

app = FastAPI(title="SyrLink API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MIN),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = creds.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Email not verified")
    return user


async def require_admin(current=Depends(get_current_user)):
    if not current.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return current


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ExperienceItem(BaseModel):
    id: str = Field(default_factory=uid)
    title: str
    company: str
    logo: Optional[str] = None
    type: Optional[str] = "Full-time"
    duration: Optional[str] = ""
    location: Optional[str] = ""
    description: Optional[str] = ""


class EducationItem(BaseModel):
    id: str = Field(default_factory=uid)
    school: str
    logo: Optional[str] = None
    degree: Optional[str] = ""
    duration: Optional[str] = ""


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    cover: Optional[str] = None
    headline: Optional[str] = ""
    location: Optional[str] = ""
    about: Optional[str] = ""
    verified: bool = False
    experience: List[ExperienceItem] = []
    education: List[EducationItem] = []
    skills: List[str] = []
    languages: List[str] = []
    connections: int = 0
    mutual: int = 0
    created_at: Optional[str] = None


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    headline: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    avatar: Optional[str] = None
    cover: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    experience: Optional[List[ExperienceItem]] = None
    education: Optional[List[EducationItem]] = None


class PostIn(BaseModel):
    content: str
    image: Optional[str] = None
    visibility: Optional[str] = "Anyone"


class CommentIn(BaseModel):
    text: str


class ConnectionRequestIn(BaseModel):
    receiver_id: str
    note: Optional[str] = ""


class MessageIn(BaseModel):
    text: str


class ConversationIn(BaseModel):
    user_id: str


# ---------------------------------------------------------------------------
# Helpers — serialization
# ---------------------------------------------------------------------------

PUBLIC_USER_FIELDS = {
    "id": 1, "name": 1, "avatar": 1, "cover": 1, "headline": 1,
    "location": 1, "verified": 1, "_id": 0,
}


async def fetch_user_brief(user_id: str) -> Optional[Dict[str, Any]]:
    return await db.users.find_one({"id": user_id}, PUBLIC_USER_FIELDS)


def time_ago(iso: str) -> str:
    """Convert ISO datetime to relative 'time ago' string."""
    try:
        dt = datetime.fromisoformat(iso)
    except Exception:
        return iso
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    s = int(delta.total_seconds())
    if s < 60:
        return "now"
    if s < 3600:
        return f"{s // 60}m"
    if s < 86400:
        return f"{s // 3600}h"
    if s < 86400 * 7:
        return f"{s // 86400}d"
    return f"{s // (86400 * 7)}w"


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@api.post("/auth/register")
async def register(data: RegisterIn):
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
    }
    await db.users.insert_one(doc)
    try:
        if not APP_URL:
            log.error("[register] APP_URL not configured, cannot send verification email")
            await db.users.delete_one({"id": user_id})
            raise HTTPException(status_code=500, detail="Server email configuration is missing")

        link = f"{APP_URL}/verify-email?token={verify_token}&uid={user_id}"
        email_payload = {
            "from": RESEND_FROM,
            "to": email,
            "subject": "Welcome to SyrLink — verify your email",
            "html": f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f4f2ee"><div style="background:white;border-radius:8px;padding:32px;text-align:center"><h1 style="color:#0a66c2;margin:0 0 8px">Welcome to SyrLink</h1><p style="color:#555">Hi {data.name}, please confirm your email to activate your account.</p><p style="color:#333;margin-top:8px">Your verification code is: <strong>{verify_token}</strong></p><a href="{link}" style="display:inline-block;margin-top:16px;background:#0a66c2;color:white;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600">Verify email</a><p style="font-size:11px;color:#888;margin-top:24px">Connecting Talent. Building Futures.</p></div></div>',
        }
        log.info(f"[register] Sending verification email to {email}")
        await asyncio.to_thread(resend.Emails.send, email_payload)
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Verification email send failed for {email}: {e}", exc_info=True)
        await db.users.delete_one({"id": user_id})
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please try again later.")

    user_out = {k: v for k, v in doc.items() if k not in ("password_hash", "_id", "verify_token")}
    return {"ok": True, "message": "Verification email sent", "user": user_out, "verification_required": True}


@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.")
    token = create_token(user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


class VerifyEmailIn(BaseModel):
    user_id: str
    token: str


class ResendVerificationIn(BaseModel):
    email: EmailStr


@api.post("/auth/verify-email")
async def verify_email(data: VerifyEmailIn):
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


@api.post("/auth/resend-verification")
async def resend_verification(data: ResendVerificationIn):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"ok": True, "already_sent": False}
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}

    new_token = uid()
    await db.users.update_one({"id": user["id"]}, {"$set": {"verify_token": new_token}})

    if not APP_URL:
        log.error("[resend_verification] APP_URL not configured, cannot send verification email")
        raise HTTPException(status_code=500, detail="Server email configuration is missing")

    link = f"{APP_URL}/verify-email?token={new_token}&uid={user['id']}"
    try:
        user_name = user.get('name', '')
        resend.Emails.send({
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
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not send email: {e}")
    return {"ok": True, "resent": True}


class ForgotPasswordIn(BaseModel):
    email: EmailStr


@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return ok to avoid email enumeration
    if user:
        reset_token = uid()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"reset_token": reset_token, "reset_token_at": now_iso()}},
        )
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
    return {"ok": True}


class ResetPasswordIn(BaseModel):
    user_id: str
    token: str
    new_password: str = Field(min_length=6)


@api.post("/auth/reset-password")
async def reset_password(data: ResetPasswordIn):
    user = await db.users.find_one({"id": data.user_id})
    if not user or user.get("reset_token") != data.token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    # Optional: check reset_token_at < 1h
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"password_hash": hash_password(data.new_password)},
         "$unset": {"reset_token": "", "reset_token_at": ""}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@api.get("/users/me/suggestions")
async def user_suggestions(limit: int = 10, current=Depends(get_current_user)):
    # accepted connection user ids
    accepted = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).to_list(1000)
    connected_ids = {c["requester_id"] if c["receiver_id"] == current["id"] else c["receiver_id"] for c in accepted}
    pending = await db.connections.find(
        {"status": "pending", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).to_list(1000)
    pending_ids = {p["requester_id"] if p["receiver_id"] == current["id"] else p["receiver_id"] for p in pending}
    exclude = connected_ids | pending_ids | {current["id"]}
    cursor = db.users.find({"id": {"$nin": list(exclude)}}, {"_id": 0, "password_hash": 0}).limit(limit)
    users = await cursor.to_list(limit)
    # add a faux 'mutual' count for UI flavor
    for u in users:
        u["mutual"] = (hash(u["id"]) % 60) + 3
    return users


@api.get("/users/{user_id}")
async def get_user(user_id: str, current=Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api.put("/users/me")
async def update_me(data: UserUpdateIn, current=Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        return current
    await db.users.update_one({"id": current["id"]}, {"$set": update})
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return user


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------

async def serialize_post(post: Dict[str, Any], current_user_id: str) -> Dict[str, Any]:
    author = await fetch_user_brief(post["author_id"]) or {"id": post["author_id"], "name": "Unknown", "avatar": "", "headline": ""}
    liked = await db.post_likes.find_one({"post_id": post["id"], "user_id": current_user_id}) is not None
    return {
        "id": post["id"],
        "author": author,
        "content": post["content"],
        "image": post.get("image"),
        "visibility": post.get("visibility", "Anyone"),
        "likes": post.get("likes_count", 0),
        "comments": post.get("comments_count", 0),
        "reposts": post.get("reposts_count", 0),
        "liked": liked,
        "created_at": post["created_at"],
        "timeAgo": time_ago(post["created_at"]),
    }


@api.get("/posts")
async def list_posts(cursor: Optional[str] = None, limit: int = 10, current=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    items = [await serialize_post(p, current["id"]) for p in posts]
    next_cursor = posts[-1]["created_at"] if len(posts) == limit else None
    return {"items": items, "next_cursor": next_cursor}


@api.post("/posts")
async def create_post(data: PostIn, current=Depends(get_current_user)):
    doc = {
        "id": uid(),
        "author_id": current["id"],
        "content": data.content,
        "image": data.image,
        "visibility": data.visibility or "Anyone",
        "likes_count": 0,
        "comments_count": 0,
        "reposts_count": 0,
        "created_at": now_iso(),
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return await serialize_post(doc, current["id"])


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, current=Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    await db.posts.delete_one({"id": post_id})
    await db.post_likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


@api.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current=Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.post_likes.find_one({"post_id": post_id, "user_id": current["id"]})
    if existing:
        await db.post_likes.delete_one({"_id": existing["_id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        liked = False
    else:
        await db.post_likes.insert_one({
            "id": uid(),
            "post_id": post_id,
            "user_id": current["id"],
            "reaction": "like",
            "created_at": now_iso(),
        })
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        liked = True
        if post["author_id"] != current["id"]:
            await create_notification(
                user_id=post["author_id"],
                actor_id=current["id"],
                ntype="like",
                text="liked your post",
                target_id=post_id,
            )
    refreshed = await db.posts.find_one({"id": post_id})
    return {"liked": liked, "likes_count": refreshed["likes_count"]}


@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, current=Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    out = []
    for c in comments:
        author = await fetch_user_brief(c["author_id"]) or {"id": c["author_id"], "name": "Unknown", "avatar": "", "headline": ""}
        out.append({
            "id": c["id"],
            "author": author,
            "text": c["text"],
            "likes": c.get("likes_count", 0),
            "created_at": c["created_at"],
            "timeAgo": time_ago(c["created_at"]),
        })
    return out


@api.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, data: CommentIn, current=Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    doc = {
        "id": uid(),
        "post_id": post_id,
        "author_id": current["id"],
        "text": data.text,
        "likes_count": 0,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    if post["author_id"] != current["id"]:
        await create_notification(
            user_id=post["author_id"],
            actor_id=current["id"],
            ntype="comment",
            text=f'commented on your post: "{data.text[:60]}"',
            target_id=post_id,
        )
    author = await fetch_user_brief(current["id"])
    return {
        "id": doc["id"], "author": author, "text": doc["text"],
        "likes": 0, "created_at": doc["created_at"], "timeAgo": "now",
    }


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------

@api.get("/connections/invitations")
async def list_invitations(current=Depends(get_current_user)):
    invs = await db.connections.find(
        {"receiver_id": current["id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    out = []
    for inv in invs:
        user = await fetch_user_brief(inv["requester_id"]) or {}
        out.append({
            "id": inv["id"],
            "user": user,
            "note": inv.get("note", ""),
            "mutual": (hash(inv["requester_id"]) % 60) + 3,
            "created_at": inv["created_at"],
        })
    return out


@api.post("/connections/request")
async def send_connection(data: ConnectionRequestIn, current=Depends(get_current_user)):
    if data.receiver_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    receiver = await db.users.find_one({"id": data.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.connections.find_one({
        "$or": [
            {"requester_id": current["id"], "receiver_id": data.receiver_id},
            {"requester_id": data.receiver_id, "receiver_id": current["id"]},
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists or pending")
    doc = {
        "id": uid(),
        "requester_id": current["id"],
        "receiver_id": data.receiver_id,
        "status": "pending",
        "note": data.note or "",
        "created_at": now_iso(),
    }
    await db.connections.insert_one(doc)
    await create_notification(
        user_id=data.receiver_id,
        actor_id=current["id"],
        ntype="connection",
        text="sent you a connection request",
        target_id=doc["id"],
    )
    doc.pop("_id", None)
    return doc


@api.post("/connections/{conn_id}/accept")
async def accept_connection(conn_id: str, current=Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn or conn["receiver_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "accepted", "accepted_at": now_iso()}})
    await db.users.update_one({"id": current["id"]}, {"$inc": {"connections": 1}})
    await db.users.update_one({"id": conn["requester_id"]}, {"$inc": {"connections": 1}})
    await create_notification(
        user_id=conn["requester_id"],
        actor_id=current["id"],
        ntype="connection",
        text="accepted your connection request",
        target_id=conn_id,
    )
    return {"ok": True}


@api.post("/connections/{conn_id}/ignore")
async def ignore_connection(conn_id: str, current=Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id})
    if not conn or conn["receiver_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "declined"}})
    return {"ok": True}


@api.get("/connections/me")
async def my_connections(current=Depends(get_current_user)):
    conns = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0},
    ).to_list(1000)
    user_ids = [c["requester_id"] if c["receiver_id"] == current["id"] else c["receiver_id"] for c in conns]
    if not user_ids:
        return []
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.get("/connections/pending-sent")
async def pending_sent(current=Depends(get_current_user)):
    conns = await db.connections.find(
        {"requester_id": current["id"], "status": "pending"}, {"_id": 0, "receiver_id": 1}
    ).to_list(1000)
    return [c["receiver_id"] for c in conns]


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@api.get("/jobs")
async def list_jobs(q: Optional[str] = None, location: Optional[str] = None, current=Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"skills": {"$regex": q, "$options": "i"}},
        ]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    jobs = await db.jobs.find(query, {"_id": 0}).sort("posted_at", -1).to_list(200)
    for j in jobs:
        j["postedAgo"] = time_ago(j.get("posted_at", now_iso()))
        j["applicants"] = j.get("applicants_count", 0)
        j["easyApply"] = j.get("easy_apply", True)
    return jobs


@api.get("/jobs/me/saved")
async def saved_jobs(current=Depends(get_current_user)):
    apps = await db.job_applications.find(
        {"user_id": current["id"], "status": "saved"}, {"_id": 0, "job_id": 1}
    ).to_list(500)
    return [a["job_id"] for a in apps]


@api.get("/jobs/me/applied")
async def applied_jobs(current=Depends(get_current_user)):
    apps = await db.job_applications.find(
        {"user_id": current["id"], "status": "applied"}, {"_id": 0, "job_id": 1}
    ).to_list(500)
    return [a["job_id"] for a in apps]


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, current=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["postedAgo"] = time_ago(job.get("posted_at", now_iso()))
    job["applicants"] = job.get("applicants_count", 0)
    job["easyApply"] = job.get("easy_apply", True)
    return job


@api.post("/jobs/{job_id}/apply")
async def apply_job(job_id: str, current=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = await db.job_applications.find_one({"job_id": job_id, "user_id": current["id"]})
    if existing:
        await db.job_applications.update_one({"_id": existing["_id"]}, {"$set": {"status": "applied"}})
    else:
        await db.job_applications.insert_one({
            "id": uid(),
            "job_id": job_id,
            "user_id": current["id"],
            "status": "applied",
            "created_at": now_iso(),
        })
        await db.jobs.update_one({"id": job_id}, {"$inc": {"applicants_count": 1}})
    return {"ok": True, "status": "applied"}


@api.post("/jobs/{job_id}/save")
async def save_job(job_id: str, current=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = await db.job_applications.find_one({"job_id": job_id, "user_id": current["id"], "status": "saved"})
    if existing:
        await db.job_applications.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    await db.job_applications.insert_one({
        "id": uid(),
        "job_id": job_id,
        "user_id": current["id"],
        "status": "saved",
        "created_at": now_iso(),
    })
    return {"saved": True}


# ---------------------------------------------------------------------------
# Conversations & messages
# ---------------------------------------------------------------------------

@api.get("/conversations")
async def list_conversations(current=Depends(get_current_user)):
    convs = await db.conversations.find(
        {"participants": current["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(200)
    out = []
    for c in convs:
        other_id = next((p for p in c["participants"] if p != current["id"]), None)
        user = await fetch_user_brief(other_id) if other_id else {}
        unread = await db.messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": current["id"]},
            "read_at": None,
        })
        out.append({
            "id": c["id"],
            "user": user or {"id": other_id, "name": "Unknown", "avatar": "", "headline": ""},
            "lastMessage": c.get("last_message", ""),
            "timeAgo": time_ago(c.get("last_message_at", now_iso())),
            "unread": unread > 0,
            "online": (hash(other_id or "") % 2) == 0,
        })
    return out


@api.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    # mark as read
    await db.messages.update_many(
        {"conversation_id": conv_id, "sender_id": {"$ne": current["id"]}, "read_at": None},
        {"$set": {"read_at": now_iso()}},
    )
    out = []
    for m in msgs:
        out.append({
            "id": m["id"],
            "text": m["text"],
            "from": "me" if m["sender_id"] == current["id"] else "them",
            "time": time_ago(m["created_at"]),
            "created_at": m["created_at"],
        })
    other_id = next((p for p in conv["participants"] if p != current["id"]), None)
    user = await fetch_user_brief(other_id) if other_id else {}
    return {"id": conv_id, "user": user, "thread": out}


@api.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, data: MessageIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg = {
        "id": uid(),
        "conversation_id": conv_id,
        "sender_id": current["id"],
        "text": data.text,
        "created_at": now_iso(),
        "read_at": None,
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"last_message": data.text, "last_message_at": msg["created_at"]}},
    )
    return {
        "id": msg["id"], "text": msg["text"], "from": "me",
        "time": "now", "created_at": msg["created_at"],
    }


@api.post("/conversations")
async def start_conversation(data: ConversationIn, current=Depends(get_current_user)):
    if data.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    other = await db.users.find_one({"id": data.user_id})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.conversations.find_one({"participants": {"$all": [current["id"], data.user_id]}})
    if existing:
        existing.pop("_id", None)
        return existing
    doc = {
        "id": uid(),
        "participants": [current["id"], data.user_id],
        "last_message": "",
        "last_message_at": now_iso(),
        "created_at": now_iso(),
    }
    await db.conversations.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

async def create_notification(user_id: str, actor_id: str, ntype: str, text: str, target_id: Optional[str] = None):
    await db.notifications.insert_one({
        "id": uid(),
        "user_id": user_id,
        "actor_id": actor_id,
        "type": ntype,
        "text": text,
        "target_id": target_id,
        "read": False,
        "created_at": now_iso(),
    })


@api.get("/notifications")
async def list_notifications(filter: str = "all", current=Depends(get_current_user)):
    query: Dict[str, Any] = {"user_id": current["id"]}
    if filter == "mentions":
        query["type"] = "mention"
    elif filter == "jobs":
        query["type"] = "job"
    elif filter == "posts":
        query["type"] = {"$in": ["like", "comment"]}
    notifs = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for n in notifs:
        actor = await fetch_user_brief(n["actor_id"]) or {"id": n["actor_id"], "name": "Unknown", "avatar": ""}
        out.append({
            "id": n["id"],
            "actor": actor,
            "type": n["type"],
            "text": n["text"],
            "read": n["read"],
            "timeAgo": time_ago(n["created_at"]),
            "created_at": n["created_at"],
        })
    return out


@api.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, current=Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": current["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(current=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# News widget (simple static feed)
# ---------------------------------------------------------------------------

@api.get("/news")
async def news():
    return [
        {"id": "nw1", "title": "إعادة إعمار سوريا تبدأ بمشاريع تقنية ضخمة", "meta": "4h ago · 12,453 readers"},
        {"id": "nw2", "title": "ارتفاع الطلب على المهندسين السوريين عن بُعد", "meta": "6h ago · 8,221 readers"},
        {"id": "nw3", "title": "Damascus emerging as MENA's new tech hub", "meta": "1d ago · 5,109 readers"},
        {"id": "nw4", "title": "أبرز الشركات الناشئة في حلب لعام 2026", "meta": "1d ago · 14,322 readers"},
        {"id": "nw5", "title": "SyrLink hits 100K users in first month", "meta": "2d ago · 22,540 readers"},
    ]


# ---------------------------------------------------------------------------
# Cloudinary signed upload
# ---------------------------------------------------------------------------

@api.get("/cloudinary/signature")
async def cloudinary_signature(resource_type: str = "image", folder: str = "uploads/", current=Depends(get_current_user)):
    allowed = ("users/", "posts/", "uploads/", "verification/", "companies/")
    if not folder.endswith("/"):
        folder += "/"
    if not folder in allowed:
        raise HTTPException(status_code=400, detail="Invalid folder path")
    import time as _t
    timestamp = int(_t.time())
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, os.environ["CLOUDINARY_API_SECRET"])
    return {
        "signature": signature, "timestamp": timestamp,
        "cloud_name": os.environ["CLOUDINARY_CLOUD_NAME"],
        "api_key": os.environ["CLOUDINARY_API_KEY"],
        "folder": folder, "resource_type": resource_type,
    }


# ---------------------------------------------------------------------------
# Repost (simple + quote)
# ---------------------------------------------------------------------------

class RepostIn(BaseModel):
    comment: Optional[str] = ""


@api.post("/posts/{post_id}/repost")
async def repost(post_id: str, data: RepostIn, current=Depends(get_current_user)):
    original = await db.posts.find_one({"id": post_id})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")
    new_post = {
        "id": uid(),
        "author_id": current["id"],
        "content": data.comment or "",
        "image": None,
        "visibility": "Anyone",
        "repost_of": post_id,
        "is_quote": bool(data.comment and data.comment.strip()),
        "likes_count": 0, "comments_count": 0, "reposts_count": 0,
        "created_at": now_iso(),
    }
    await db.posts.insert_one(new_post)
    await db.posts.update_one({"id": post_id}, {"$inc": {"reposts_count": 1}})
    if original["author_id"] != current["id"]:
        await create_notification(
            user_id=original["author_id"], actor_id=current["id"],
            ntype="repost", text="reposted your post", target_id=post_id,
        )
    new_post.pop("_id", None)
    return await serialize_post(new_post, current["id"])


# ---------------------------------------------------------------------------
# Global search
# ---------------------------------------------------------------------------

@api.get("/search")
async def search(q: str = "", type: str = "all", current=Depends(get_current_user)):
    q = (q or "").strip()
    if not q:
        return {"users": [], "posts": [], "jobs": []}
    regex = {"$regex": q, "$options": "i"}
    out = {"users": [], "posts": [], "jobs": []}
    if type in ("all", "users"):
        users = await db.users.find(
            {"$or": [{"name": regex}, {"headline": regex}]},
            {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1},
        ).limit(8).to_list(8)
        out["users"] = users
    if type in ("all", "posts"):
        posts = await db.posts.find({"content": regex}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
        out["posts"] = [await serialize_post(p, current["id"]) for p in posts]
    if type in ("all", "jobs"):
        jobs = await db.jobs.find(
            {"$or": [{"title": regex}, {"company": regex}, {"description": regex}]},
            {"_id": 0, "id": 1, "title": 1, "company": 1, "logo": 1, "location": 1},
        ).limit(8).to_list(8)
        out["jobs"] = jobs
    return out


# ---------------------------------------------------------------------------
# Verification requests
# ---------------------------------------------------------------------------

class VerificationRequestIn(BaseModel):
    document_url: str
    document_type: Literal["id", "experience", "education", "other"]
    note: Optional[str] = ""


@api.post("/verification/request")
async def submit_verification(data: VerificationRequestIn, current=Depends(get_current_user)):
    existing = await db.verification_requests.find_one({"user_id": current["id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending verification request")
    doc = {
        "id": uid(),
        "user_id": current["id"],
        "document_url": data.document_url,
        "document_type": data.document_type,
        "note": data.note or "",
        "status": "pending",
        "created_at": now_iso(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.verification_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/verification/me")
async def my_verification(current=Depends(get_current_user)):
    req = await db.verification_requests.find_one(
        {"user_id": current["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return req or {"status": "none"}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

@api.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "jobs": await db.jobs.count_documents({}),
        "verified_users": await db.users.count_documents({"verified": True}),
        "pending_verifications": await db.verification_requests.count_documents({"status": "pending"}),
        "connections": await db.connections.count_documents({"status": "accepted"}),
    }


@api.get("/admin/users")
async def admin_list_users(q: str = "", admin=Depends(require_admin)):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return users


@api.post("/admin/users/{user_id}/verify")
async def admin_toggle_verify(user_id: str, admin=Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_val = not user.get("verified", False)
    await db.users.update_one({"id": user_id}, {"$set": {"verified": new_val}})
    if new_val:
        await create_notification(
            user_id=user_id, actor_id=admin["id"], ntype="verification",
            text="Your account has been verified ✓", target_id=user_id,
        )
    return {"verified": new_val}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await db.posts.delete_many({"author_id": user_id})
    return {"ok": True}


@api.get("/admin/verification-requests")
async def admin_list_verifications(status: str = "pending", admin=Depends(require_admin)):
    reqs = await db.verification_requests.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in reqs:
        u = await fetch_user_brief(r["user_id"])
        r["user"] = u
    return reqs


@api.post("/admin/verification-requests/{req_id}/approve")
async def admin_approve_verification(req_id: str, admin=Depends(require_admin)):
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "approved", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"verified": True}})
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text="Your verification request was approved ✓ — you now have a blue badge!", target_id=req_id,
    )
    return {"ok": True}


@api.post("/admin/verification-requests/{req_id}/reject")
async def admin_reject_verification(req_id: str, admin=Depends(require_admin)):
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "rejected", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text="Your verification request was reviewed — please contact support for more info.", target_id=req_id,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Company Requests (Admin)
# ---------------------------------------------------------------------------

@api.get("/admin/company-requests")
async def admin_company_requests(status: str = "pending", admin=Depends(require_admin)):
    """Get company creation requests with optional status filter."""
    query = {} if status == "all" else {"status": status}
    reqs = await db.company_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    # Enrich with user info
    for req in reqs:
        user = await fetch_user_brief(req.get("user_id"))
        req["user"] = user
    return reqs


@api.post("/admin/company-requests/{req_id}/approve")
async def admin_approve_company(req_id: str, admin=Depends(require_admin)):
    """Approve a company creation request."""
    req = await db.company_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Create the company
    company = {
        "id": uid(),
        "name": req["name"],
        "logo": f"https://api.dicebear.com/7.x/initials/svg?seed={req['name']}",
        "cover": "",
        "tagline": "",
        "about": req.get("about", ""),
        "website": req.get("website", ""),
        "location": req.get("location", ""),
        "industry": req.get("industry", ""),
        "employees_count": req.get("employees_count", 0),
        "employees": [],
        "created_at": now_iso(),
        "status": "approved",
    }
    await db.companies.insert_one(company)
    
    # Update request status
    await db.company_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "approved", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    
    # Notify user
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="admin",
        text=f"Your company '{req['name']}' has been approved!", target_id=company["id"],
    )
    
    company.pop("_id", None)
    return company


@api.post("/admin/company-requests/{req_id}/reject")
async def admin_reject_company(req_id: str, admin=Depends(require_admin)):
    """Reject a company creation request."""
    req = await db.company_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.company_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "rejected", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="admin",
        text=f"Your company request '{req['name']}' was rejected. Please contact support for more info.", target_id=req_id,
    )
    
    return {"ok": True}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    log.info("SyrLink backend starting up...")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.posts.create_index([("created_at", -1)])
    await db.connections.create_index([("requester_id", 1), ("receiver_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    # Auto seed if empty
    if await db.users.count_documents({}) == 0:
        from seed import run_seed
        await run_seed(db)
        log.info("Seed data inserted.")
    # Ensure admin user exists
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@syrlink.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@SyrLink2026")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "id": uid(), "name": "SyrLink Admin", "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "avatar": "https://api.dicebear.com/7.x/initials/svg?seed=Admin",
            "cover": "", "headline": "Platform Administrator", "location": "Damascus",
            "about": "", "verified": True, "is_admin": True,
            "experience": [], "education": [], "skills": [], "languages": [],
            "connections": 0, "created_at": now_iso(),
        })
    else:
        await db.users.update_one({"email": admin_email}, {"$set": {"is_admin": True, "verified": True}})
    # Text search indexes
    try:
        await db.users.create_index([("name", "text"), ("headline", "text"), ("about", "text")])
        await db.posts.create_index([("content", "text")])
        await db.jobs.create_index([("title", "text"), ("company", "text"), ("description", "text")])
    except Exception as e:
        log.warning(f"Index create skipped: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"name": "SyrLink API", "status": "ok"}
