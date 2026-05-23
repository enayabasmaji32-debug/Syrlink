"""Notifications routes."""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends

from app.security import get_current_user
from app.utils import time_ago, fetch_user_brief, uid, now_iso
from app.database import db

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def batch_fetch_users(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch multiple users to avoid N+1 queries."""
    unique_ids = list(set(user_ids))
    users = await db.users.find(
        {"id": {"$in": unique_ids}}, 
        {"_id": 0, "id": 1, "name": 1, "avatar": 1}
    ).to_list(len(unique_ids))
    user_map = {u["id"]: u for u in users}
    # Add defaults for missing users
    for _uid in unique_ids:
        if _uid not in user_map:
            user_map[_uid] = {"id": _uid, "name": "Unknown", "avatar": ""}
    return user_map


@router.get("")
async def list_notifications(filter: str = "all", current=Depends(get_current_user)):
    """List notifications for the current user."""
    query = {"user_id": current["id"]}
    if filter == "mentions":
        query["type"] = "mention"
    elif filter == "jobs":
        query["type"] = "job"
    elif filter == "posts":
        query["type"] = {"$in": ["like", "comment"]}
    
    notifs = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    if not notifs:
        return []
    
    # Batch fetch all actors at once
    actor_ids = [n["actor_id"] for n in notifs]
    user_map = await batch_fetch_users(actor_ids)
    
    out = [
        {
            "id": n["id"],
            "actor": user_map[n["actor_id"]],
            "type": n["type"],
            "text": n["text"],
            "read": n["read"],
            "timeAgo": time_ago(n["created_at"]),
            "created_at": n["created_at"],
        }
        for n in notifs
    ]
    return out


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, current=Depends(get_current_user)):
    """Mark a notification as read."""
    await db.notifications.update_one(
        {"id": notif_id, "user_id": current["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(current=Depends(get_current_user)):
    """Mark all notifications as read."""
    await db.notifications.update_many({"user_id": current["id"]}, {"$set": {"read": True}})
    return {"ok": True}
