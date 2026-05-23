"""Utility functions."""
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.database import db


def now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


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


PUBLIC_USER_FIELDS = {
    "id": 1, "name": 1, "avatar": 1, "cover": 1, "headline": 1,
    "location": 1, "verified": 1, "_id": 0,
}


async def fetch_user_brief(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch brief user info (public fields only)."""
    return await db.users.find_one({"id": user_id}, PUBLIC_USER_FIELDS)


async def create_notification(user_id: str, actor_id: str, ntype: str, text: str, target_id: Optional[str] = None):
    """Create a notification for a user."""
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
