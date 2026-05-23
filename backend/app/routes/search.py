"""Search routes."""
from fastapi import APIRouter, Depends

from app.security import get_current_user
from app.database import db

router = APIRouter(prefix="/search", tags=["search"])


async def serialize_post(post, current_user_id):
    """Serialize post for search results."""
    from app.utils import fetch_user_brief
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
        "liked": liked,
        "created_at": post["created_at"],
    }


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
        out["posts"] = [await serialize_post(p, current["id"]) for p in posts]
    
    if type in ("all", "jobs"):
        jobs = await db.jobs.find(
            {"$or": [{"title": regex}, {"company": regex}, {"description": regex}]},
            {"_id": 0, "id": 1, "title": 1, "company": 1, "logo": 1, "location": 1},
        ).limit(8).to_list(8)
        out["jobs"] = jobs
    
    return out
