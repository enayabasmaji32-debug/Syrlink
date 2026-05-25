"""Relationships: followers, following, and blocked users."""
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends

from app.models import ConnectionRequestIn
from app.security import get_current_user
from app.utils import uid, now_iso, create_notification
from app.database import db

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.post("/follow/{user_id}")
async def follow_user(user_id: str, current=Depends(get_current_user)):
    """Follow a user (unidirectional)."""
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.followers.find_one({"follower_id": current["id"], "following_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    doc = {
        "id": uid(),
        "follower_id": current["id"],
        "following_id": user_id,
        "created_at": now_iso(),
    }
    await db.followers.insert_one(doc)
    
    # Notify followed user
    await create_notification(
        user_id=user_id,
        actor_id=current["id"],
        ntype="follow",
        text="started following you",
        target_id=doc["id"],
    )
    
    return {"ok": True, "id": doc["id"]}


@router.delete("/follow/{user_id}")
async def unfollow_user(user_id: str, current=Depends(get_current_user)):
    """Unfollow a user."""
    result = await db.followers.delete_one({
        "follower_id": current["id"],
        "following_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not following this user")
    
    return {"ok": True}


@router.get("/followers/{user_id}")
async def get_followers(user_id: str, limit: int = 50, current=Depends(get_current_user)):
    """Get list of followers for a user."""
    followers = await db.followers.find(
        {"following_id": user_id},
        {"_id": 0, "follower_id": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    follower_ids = [f["follower_id"] for f in followers]
    users = await db.users.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).to_list(len(follower_ids))
    
    return users


@router.get("/following/{user_id}")
async def get_following(user_id: str, limit: int = 50, current=Depends(get_current_user)):
    """Get list of users that a user is following."""
    following = await db.followers.find(
        {"follower_id": user_id},
        {"_id": 0, "following_id": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    following_ids = [f["following_id"] for f in following]
    users = await db.users.find(
        {"id": {"$in": following_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).to_list(len(following_ids))
    
    return users


@router.get("/me/followers")
async def my_followers(limit: int = 50, current=Depends(get_current_user)):
    """Get current user's followers."""
    followers = await db.followers.find(
        {"following_id": current["id"]},
        {"_id": 0, "follower_id": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    follower_ids = [f["follower_id"] for f in followers]
    if not follower_ids:
        return []
    
    users = await db.users.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).to_list(len(follower_ids))
    
    return users


@router.get("/me/following")
async def my_following(limit: int = 50, current=Depends(get_current_user)):
    """Get users current user is following."""
    following = await db.followers.find(
        {"follower_id": current["id"]},
        {"_id": 0, "following_id": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    following_ids = [f["following_id"] for f in following]
    if not following_ids:
        return []
    
    users = await db.users.find(
        {"id": {"$in": following_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).to_list(len(following_ids))
    
    return users


# ============== BLOCKED USERS ==============

@router.post("/block/{user_id}")
async def block_user(user_id: str, current=Depends(get_current_user)):
    """Block a user."""
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.blocked_users.find_one({"blocker_id": current["id"], "blocked_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already blocked this user")
    
    doc = {
        "id": uid(),
        "blocker_id": current["id"],
        "blocked_id": user_id,
        "created_at": now_iso(),
    }
    await db.blocked_users.insert_one(doc)
    
    # Remove connection if exists
    await db.connections.delete_many({
        "$or": [
            {"requester_id": current["id"], "receiver_id": user_id},
            {"requester_id": user_id, "receiver_id": current["id"]},
        ]
    })
    
    # Remove follow if exists
    await db.followers.delete_many({
        "$or": [
            {"follower_id": current["id"], "following_id": user_id},
            {"follower_id": user_id, "following_id": current["id"]},
        ]
    })
    
    return {"ok": True, "id": doc["id"]}


@router.delete("/block/{user_id}")
async def unblock_user(user_id: str, current=Depends(get_current_user)):
    """Unblock a user."""
    result = await db.blocked_users.delete_one({
        "blocker_id": current["id"],
        "blocked_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not blocked")
    
    return {"ok": True}


@router.get("/me/blocked")
async def my_blocked_users(limit: int = 100, current=Depends(get_current_user)):
    """Get list of blocked users."""
    blocked = await db.blocked_users.find(
        {"blocker_id": current["id"]},
        {"_id": 0, "blocked_id": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    blocked_ids = [b["blocked_id"] for b in blocked]
    if not blocked_ids:
        return []
    
    users = await db.users.find(
        {"id": {"$in": blocked_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1}
    ).to_list(len(blocked_ids))
    
    return users


@router.get("/check-blocked/{user_id}")
async def is_user_blocked(user_id: str, current=Depends(get_current_user)):
    """Check if current user has blocked another user or is blocked by them."""
    blocked_by_me = await db.blocked_users.find_one({
        "blocker_id": current["id"],
        "blocked_id": user_id
    })
    blocked_by_them = await db.blocked_users.find_one({
        "blocker_id": user_id,
        "blocked_id": current["id"]
    })
    
    return {
        "blocked_by_me": blocked_by_me is not None,
        "blocked_by_them": blocked_by_them is not None,
    }
