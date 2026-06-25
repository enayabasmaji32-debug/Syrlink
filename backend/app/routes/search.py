"""Search routes."""
from fastapi import APIRouter, Depends

from app.security import get_current_user
from app.database import db

from app.utils import batch_fetch_users

router = APIRouter(prefix="/search", tags=["search"])


async def serialize_posts(posts, current_user_id):
    """Batch serialize posts for search results."""
    if not posts:
        return []
    author_ids = [p["author_id"] for p in posts]
    user_map = await batch_fetch_users(author_ids)
    post_ids = [p["id"] for p in posts]
    likes = await db.post_likes.find({"post_id": {"$in": post_ids}, "user_id": current_user_id}, {"post_id": 1}).to_list(len(post_ids))
    liked_ids = {like["post_id"] for like in likes}
    return [
        {
            "id": p["id"],
            "author": user_map.get(p["author_id"], {"id": p["author_id"], "name": "Unknown", "avatar": "", "headline": ""}),
            "content": p["content"],
            "image": p.get("image"),
            "visibility": p.get("visibility", "Anyone"),
            "likes": p.get("likes_count", 0),
            "comments": p.get("comments_count", 0),
            "liked": p["id"] in liked_ids,
            "created_at": p["created_at"],
        }
        for p in posts
    ]


@router.get("")
async def search(q: str = "", type: str = "all", current=Depends(get_current_user)):
    """Global search across users, posts, and jobs."""
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
        out["posts"] = await serialize_posts(posts, current["id"])
    
    if type in ("all", "jobs"):
        jobs = await db.jobs.find(
            {"$or": [{"title": regex}, {"company": regex}, {"description": regex}]},
            {"_id": 0, "id": 1, "title": 1, "company": 1, "logo": 1, "location": 1},
        ).limit(8).to_list(8)
        out["jobs"] = jobs
    
    return out
