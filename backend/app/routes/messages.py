"""Messages and conversations routes."""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends

from app.models import MessageIn, ConversationIn
from app.security import get_current_user
from app.utils import uid, now_iso, time_ago, fetch_user_brief, create_notification, batch_fetch_users, is_user_online
from app.database import db

router = APIRouter(prefix="/conversations", tags=["messages"])


@router.get("")
async def list_conversations(current=Depends(get_current_user)):
    """List all conversations for the current user - SIMPLIFIED."""
    # Limit to 20 to reduce query time
    convs = await db.conversations.find(
        {"participants": current["id"]}, {"_id": 0}
    ).sort("last_message_at", -1).limit(20).to_list(20)
    
    if not convs:
        return []
    
    # Get all other participant IDs
    other_ids = [next((p for p in c["participants"] if p != current["id"]), None) for c in convs]
    user_map = await batch_fetch_users(other_ids)
    
    # Build output WITHOUT expensive unread count query
    out = []
    for c in convs:
        other_id = next((p for p in c["participants"] if p != current["id"]), None)
        user = user_map.get(other_id) or {"id": other_id, "name": "Unknown", "avatar": "", "headline": ""}
        online = is_user_online(user.get("last_seen", ""))
        
        out.append({
            "id": c["id"],
            "user": user,
            "lastMessage": c.get("last_message", ""),
            "timeAgo": time_ago(c.get("last_message_at", now_iso())),
            "unread": False,  # Disabled for speed
            "online": online,
        })
    return out


@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str, cursor: Optional[str] = None, limit: int = 50, current=Depends(get_current_user)):
    """Get messages in a conversation with cursor-based pagination."""
    limit = min(max(limit, 1), 50)
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv or current["id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    query = {"conversation_id": conv_id}
    if cursor:
        query["created_at"] = {"$gt": cursor}  # after cursor for ascending
    
    msgs = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Mark as read
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
    next_cursor = msgs[-1]["created_at"] if len(msgs) == limit else None
    return {"id": conv_id, "user": user, "thread": out, "next_cursor": next_cursor}


@router.post("/{conv_id}/messages")
async def send_message(conv_id: str, data: MessageIn, current=Depends(get_current_user)):
    """Send a message in a conversation."""
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


@router.post("")
async def start_conversation(data: ConversationIn, current=Depends(get_current_user)):
    """Start a new conversation with another user."""
    if data.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    other = await db.users.find_one({"id": data.user_id})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.conversations.find_one({"participants": {"$all": [current["id"], data.user_id]}})
    if existing:
        existing.pop("_id", None)
        # Get user info for existing conversation too
        user = await fetch_user_brief(data.user_id)
        return {
            "id": existing["id"],
            "user": user,
            "lastMessage": existing.get("last_message", ""),
            "timeAgo": time_ago(existing.get("last_message_at", now_iso())),
            "unread": False,
            "online": is_user_online(user.get("last_seen", "")),
        }
    
    doc = {
        "id": uid(),
        "participants": [current["id"], data.user_id],
        "last_message": "",
        "last_message_at": now_iso(),
        "created_at": now_iso(),
    }
    await db.conversations.insert_one(doc)
    
    # Return with user info
    user = await fetch_user_brief(data.user_id)
    return {
        "id": doc["id"],
        "user": user,
        "lastMessage": "",
        "timeAgo": "now",
        "unread": False,
        "online": is_user_online(user.get("last_seen", "")),
    }
