"""Utility functions."""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from app.database import db

# Configure logger
log = logging.getLogger(__name__)


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
    """Create a notification for a user and push via WebSocket if online."""
    from app.routes.websocket import send_notification_to_user
    doc = {
        "id": uid(),
        "user_id": user_id,
        "actor_id": actor_id,
        "type": ntype,
        "text": text,
        "target_id": target_id,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    await send_notification_to_user(user_id, doc)


async def create_admin_notification(actor_id: str, ntype: str, text: str, target_id: Optional[str] = None):
    """Create a system/admin notification not tied to a specific recipient."""
    await db.admin_notifications.insert_one({
        "id": uid(),
        "actor_id": actor_id,
        "type": ntype,
        "text": text,
        "target_id": target_id,
        "read": False,
        "created_at": now_iso(),
    })


from typing import List


async def batch_fetch_users(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch multiple users to avoid N+1 queries."""
    unique_ids = list(set([uid for uid in user_ids if uid]))
    if not unique_ids:
        return {}
    users = await db.users.find(
        {"id": {"$in": unique_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "last_seen": 1}
    ).to_list(len(unique_ids))
    user_map = {u["id"]: u for u in users}
    for _uid in unique_ids:
        if _uid not in user_map:
            user_map[_uid] = {"id": _uid, "name": "Unknown", "avatar": "", "headline": ""}
    return user_map


def is_user_online(last_seen: str) -> bool:
    """Check if user is online based on last_seen timestamp (within 5 minutes)."""
    try:
        last_seen_dt = datetime.fromisoformat(last_seen)
    except Exception:
        return False
    if last_seen_dt.tzinfo is None:
        last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = now - last_seen_dt
    return delta < timedelta(minutes=5)
