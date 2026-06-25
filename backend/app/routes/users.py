"""User profile routes."""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta

from app.models import UserUpdateIn
from app.security import get_current_user
from app.utils import uid, now_iso
from app.database import db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_current_user_profile(current=Depends(get_current_user)):
    """Get current user profile and update last_seen timestamp."""
    # Update last_seen on every /me request
    await db.users.update_one({"id": current["id"]}, {"$set": {"last_seen": now_iso()}})
    
    # Fetch full user document
    user = await db.users.find_one(
        {"id": current["id"]},
        {"_id": 0, "password_hash": 0, "verify_token": 0, "reset_token": 0, "reset_token_at": 0},
    )
    return user or current


@router.get("/me/suggestions")
async def user_suggestions(limit: int = 10, current=Depends(get_current_user)):
    """Get connection suggestions for the current user (optimized)."""
    # Get accepted connections (limit to 300)
    accepted = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).limit(300).to_list(300)
    connected_ids = {c["requester_id"] if c["receiver_id"] == current["id"] else c["receiver_id"] for c in accepted}
    
    # Get pending connections (limit to 200)
    pending = await db.connections.find(
        {"status": "pending", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).limit(200).to_list(200)
    pending_ids = {p["requester_id"] if p["receiver_id"] == current["id"] else p["receiver_id"] for p in pending}
    
    exclude = connected_ids | pending_ids | {current["id"]}
    cursor = db.users.find(
        {"id": {"$nin": list(exclude)}}, 
        {"_id": 0, "password_hash": 0}
    ).limit(limit)
    users = await cursor.to_list(limit)
    
    if not users:
        return []
    
    # Batch calculate mutual connections for all suggestions (only if we have connected friends)
    if not connected_ids:
        for u in users:
            u["mutual"] = 0
        return users
    
    suggestion_ids = [u["id"] for u in users]
    mutual_connections = await db.connections.find(
        {
            "status": "accepted",
            "$or": [
                {"requester_id": {"$in": suggestion_ids}, "receiver_id": {"$in": list(connected_ids)}},
                {"receiver_id": {"$in": suggestion_ids}, "requester_id": {"$in": list(connected_ids)}},
            ]
        },
        {"_id": 0, "requester_id": 1, "receiver_id": 1}
    ).limit(500).to_list(500)
    
    # Count mutual per suggestion
    mutual_map = {}
    for conn in mutual_connections:
        suggestion = conn["requester_id"] if conn["requester_id"] in suggestion_ids else conn["receiver_id"]
        mutual_map[suggestion] = mutual_map.get(suggestion, 0) + 1
    
    # Add mutual count to users
    for u in users:
        u["mutual"] = mutual_map.get(u["id"], 0)
    
    return users


@router.get("/search")
async def search_users(q: str, current=Depends(get_current_user)):
    """Search users by name only (email is private)."""
    if not q:
        return []
    query = {
        "name": {"$regex": q, "$options": "i"}
    }
    users = await db.users.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).limit(20).to_list(20)
    return users


@router.get("/{user_id}")
async def get_user(user_id: str, current=Depends(get_current_user)):
    """Get a user profile by ID."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/me")
async def delete_my_account(current=Depends(get_current_user)):
    """Delete current user's own account (GDPR-style right to erasure)."""
    user_id = current["id"]
    # Cascade delete all user data
    await db.users.delete_one({"id": user_id})
    await db.posts.delete_many({"author_id": user_id})
    await db.messages.delete_many({"sender_id": user_id})
    await db.conversations.delete_many({"participants": user_id})
    await db.connections.delete_many({"$or": [{"requester_id": user_id}, {"receiver_id": user_id}]})
    await db.followers.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    await db.notifications.delete_many({"$or": [{"user_id": user_id}, {"actor_id": user_id}]})
    await db.job_applications.delete_many({"user_id": user_id})
    await db.job_seeker_requests.delete_many({"user_id": user_id})
    await db.recommendations.delete_many({"$or": [{"from_id": user_id}, {"to_id": user_id}]})
    await db.endorsements.delete_many({"$or": [{"from_id": user_id}, {"user_id": user_id}]})
    await db.reports.delete_many({"reporter_id": user_id})
    await db.verification_requests.delete_many({"user_id": user_id})
    await db.blocked_users.delete_many({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]})
    # Remove from company employees
    await db.companies.update_many(
        {"employees.id": user_id},
        {"$pull": {"employees": {"id": user_id}}}
    )
    return {"ok": True}


@router.put("/me")
async def update_me(data: UserUpdateIn, current=Depends(get_current_user)):
    """Update current user profile."""
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        return current
    
    await db.users.update_one({"id": current["id"]}, {"$set": update})
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return user
