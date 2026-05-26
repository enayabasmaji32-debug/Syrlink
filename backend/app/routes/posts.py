"""Posts and feed routes."""
from typing import Optional, Dict, Any, List, Literal
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models import PostIn, CommentIn, ReactionIn, RepostIn
from app.security import get_current_user
from app.utils import uid, now_iso, time_ago, fetch_user_brief, create_notification, log
from app.database import db

router = APIRouter(prefix="/posts", tags=["posts"])
limiter = Limiter(key_func=get_remote_address)


async def batch_fetch_companies(company_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch company author info for posts."""
    if not company_ids:
        return {}
    unique_ids = list(set(company_ids))
    companies = await db.companies.find(
        {"id": {"$in": unique_ids}},
        {"_id": 0, "id": 1, "name": 1, "logo": 1, "tagline": 1}
    ).to_list(len(unique_ids))
    company_map = {
        c["id"]: {
            "id": c["id"],
            "name": c["name"],
            "avatar": c.get("logo", ""),
            "headline": c.get("tagline", ""),
        }
        for c in companies
    }
    for cid in unique_ids:
        if cid not in company_map:
            company_map[cid] = {"id": cid, "name": "Unknown Company", "avatar": "", "headline": ""}
    return company_map



async def serialize_post_with_author(post: Dict[str, Any], author: Dict[str, Any], current_user_id: str, liked: bool) -> Dict[str, Any]:
    """Serialize a post with pre-fetched author and like status."""
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
        "company_id": post.get("company_id"),
    }


async def batch_fetch_users(author_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch multiple users by ID to avoid N+1 queries."""
    unique_ids = list(set(author_ids))
    users = await db.users.find({"id": {"$in": unique_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1}).to_list(len(unique_ids))
    user_map = {u["id"]: u for u in users}
    # Add default entries for missing users
    for _uid in unique_ids:
        if _uid not in user_map:
            user_map[_uid] = {"id": _uid, "name": "Unknown", "avatar": "", "headline": ""}
    return user_map


@router.get("")
async def list_posts(cursor: Optional[str] = None, limit: int = 5, company_id: Optional[str] = None, current=Depends(get_current_user)):
    """List posts with pagination (optimized for speed)."""
    # Cap limit to prevent slow queries
    limit = min(max(limit, 1), 20)
    
    query: Dict[str, Any] = {}
    if cursor:
        query["created_at"] = {"$lt": cursor}
    if company_id:
        query["company_id"] = company_id
    
    try:
        posts = await db.posts.find(query, {
            "_id": 0, 
            "id": 1, 
            "author_id": 1, 
            "company_id": 1,
            "content": 1, 
            "image": 1, 
            "visibility": 1,
            "likes_count": 1, 
            "comments_count": 1, 
            "reposts_count": 1,
            "created_at": 1,
        }).sort("created_at", -1).limit(limit).to_list(limit)
    except Exception as e:
        log.error(f"Error fetching posts: {e}")
        return {"items": [], "next_cursor": None}
    
    if not posts:
        return {"items": [], "next_cursor": None}
    
    company_ids = [p["company_id"] for p in posts if p.get("company_id")]
    user_ids = [p["author_id"] for p in posts if not p.get("company_id")]
    user_map = await batch_fetch_users(user_ids)
    company_map = await batch_fetch_companies(company_ids)
    
    # Batch fetch all likes at once (instead of N separate queries)
    post_ids = [p["id"] for p in posts]
    likes = await db.post_likes.find({"post_id": {"$in": post_ids}, "user_id": current["id"]}, {"post_id": 1}).to_list(limit)
    liked_post_ids = {like["post_id"] for like in likes}
    
    # Serialize all posts in parallel (not sequential)
    items = await asyncio.gather(*[
        serialize_post_with_author(
            p,
            company_map[p["company_id"]] if p.get("company_id") else user_map[p["author_id"]],
            current["id"],
            p["id"] in liked_post_ids,
        )
        for p in posts
    ])
    
    next_cursor = posts[-1]["created_at"] if len(posts) == limit else None
    return {"items": items, "next_cursor": next_cursor}


@router.post("")
@limiter.limit("100/minute")
async def create_post(request: Request, data: PostIn, current=Depends(get_current_user)):
    """Create a new post."""
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
    if data.company_id:
        company = await db.companies.find_one({"id": data.company_id, "status": "approved"})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        if company.get("user_id") != current["id"] and not current.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized to post as this company")
        doc["company_id"] = data.company_id

    await db.posts.insert_one(doc)
    doc.pop("_id", None)

    if doc.get("company_id"):
        company = await db.companies.find_one({"id": doc["company_id"]}, {"_id": 0, "id": 1, "name": 1, "logo": 1, "tagline": 1})
        author = {
            "id": company["id"],
            "name": company["name"],
            "avatar": company.get("logo", ""),
            "headline": company.get("tagline", ""),
            "verified": False,
        }
    else:
        author = {
            "id": current["id"],
            "name": current.get("name", "Unknown"),
            "avatar": current.get("avatar", ""),
            "headline": current.get("headline", ""),
            "verified": current.get("verified", False),
        }

    return {
        "id": doc["id"],
        "author": author,
        "content": doc["content"],
        "image": doc.get("image"),
        "visibility": doc.get("visibility", "Anyone"),
        "likes": 0,
        "comments": 0,
        "reposts": 0,
        "liked": False,
        "created_at": doc["created_at"],
        "timeAgo": time_ago(doc["created_at"]),
        "company_id": doc.get("company_id"),
    }


@router.delete("/{post_id}")
async def delete_post(post_id: str, current=Depends(get_current_user)):
    """Delete a post."""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    
    await db.posts.delete_one({"id": post_id})
    await db.post_likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


@router.put("/{post_id}")
async def update_post(post_id: str, data: PostIn, current=Depends(get_current_user)):
    """Update a post only if the current user is the author."""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["author_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not your post")

    update_data = {}
    if data.content is not None:
        update_data["content"] = data.content
    if data.image is not None:
        update_data["image"] = data.image
    if data.visibility is not None:
        update_data["visibility"] = data.visibility

    if update_data:
        await db.posts.update_one({"id": post_id}, {"$set": update_data})
        post = await db.posts.find_one({"id": post_id})

    return {
        "id": post["id"],
        "content": post["content"],
        "image": post.get("image"),
        "visibility": post.get("visibility", "Anyone"),
    }


@router.post("/{post_id}/like")
async def toggle_like(post_id: str, current=Depends(get_current_user)):
    """Toggle like on a post."""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.post_likes.find_one({"post_id": post_id, "user_id": current["id"]})
    if existing:
        await db.post_likes.delete_one({"_id": existing["_id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        liked = False
        new_count = post.get("likes_count", 0) - 1
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
        new_count = post.get("likes_count", 0) + 1
        
        # Notify post author on like
        if post["author_id"] != current["id"]:
            await create_notification(
                user_id=post["author_id"],
                actor_id=current["id"],
                ntype="like",
                text="liked your post",
                target_id=post_id,
            )
    
    return {
        "id": post_id,
        "liked": liked,
        "count": new_count,
    }


@router.post("/{post_id}/reaction")
async def add_reaction(post_id: str, data: ReactionIn, current=Depends(get_current_user)):
    """Add or update a reaction on a post (celebrate, support, insightful, etc)."""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    reaction_type = data.reaction_type or "like"
    
    # Check if user already has a reaction on this post
    existing = await db.post_likes.find_one({"post_id": post_id, "user_id": current["id"]})
    
    if existing:
        # Update existing reaction
        old_reaction = existing.get("reaction", "like")
        if old_reaction == reaction_type:
            # Same reaction clicked again - remove it
            await db.post_likes.delete_one({"_id": existing["_id"]})
            log.debug(f"[reaction] Removed {reaction_type} on post {post_id}")
            return {"id": post_id, "reaction": None, "count": post.get("likes_count", 0) - 1}
        else:
            # Different reaction - update it
            await db.post_likes.update_one(
                {"_id": existing["_id"]},
                {"$set": {"reaction": reaction_type, "updated_at": now_iso()}}
            )
            log.debug(f"[reaction] Updated reaction to {reaction_type} on post {post_id}")
    else:
        # New reaction
        await db.post_likes.insert_one({
            "id": uid(),
            "post_id": post_id,
            "user_id": current["id"],
            "reaction": reaction_type,
            "created_at": now_iso(),
        })
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        
        # Notify post author on any reaction
        if post["author_id"] != current["id"]:
            reaction_text = {
                "celebrate": "celebrated your post",
                "support": "showed support for your post",
                "insightful": "found your post insightful",
            }.get(reaction_type, "reacted to your post")
            
            await create_notification(
                user_id=post["author_id"],
                actor_id=current["id"],
                ntype=reaction_type,
                text=reaction_text,
                target_id=post_id,
            )
        
        log.debug(f"[reaction] Added {reaction_type} on post {post_id}")
    
    return {
        "id": post_id,
        "reaction": reaction_type,
        "count": post.get("likes_count", 0),
    }


@router.get("/{post_id}/comments")
async def list_comments(post_id: str, current=Depends(get_current_user)):
    """List comments on a post."""
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    if not comments:
        return []
    
    # Batch fetch all authors at once
    author_ids = [c["author_id"] for c in comments]
    user_map = await batch_fetch_users(author_ids)
    
    out = [
        {
            "id": c["id"],
            "author": user_map[c["author_id"]],
            "text": c["text"],
            "likes": c.get("likes_count", 0),
            "created_at": c["created_at"],
            "timeAgo": time_ago(c["created_at"]),
        }
        for c in comments
    ]
    return out


@router.post("/{post_id}/comments")
async def add_comment(post_id: str, data: CommentIn, current=Depends(get_current_user)):
    """Add a comment or reply to a post."""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # If this is a reply to another comment, verify parent exists
    parent_comment = None
    if data.parent_comment_id:
        parent_comment = await db.comments.find_one({"id": data.parent_comment_id, "post_id": post_id})
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    
    doc = {
        "id": uid(),
        "post_id": post_id,
        "author_id": current["id"],
        "text": data.text,
        "likes_count": 0,
        "parent_comment_id": data.parent_comment_id,  # None if top-level, comment ID if reply
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    # Send notifications
    # 1. Notify post author if this is a top-level comment
    if not data.parent_comment_id and post["author_id"] != current["id"]:
        await create_notification(
            user_id=post["author_id"],
            actor_id=current["id"],
            ntype="comment",
            text=f'commented on your post: "{data.text[:60]}"',
            target_id=post_id,
        )
    
    # 2. Notify parent comment author if this is a reply
    if data.parent_comment_id and parent_comment["author_id"] != current["id"]:
        await create_notification(
            user_id=parent_comment["author_id"],
            actor_id=current["id"],
            ntype="reply",
            text=f'replied to your comment: "{data.text[:60]}"',
            target_id=post_id,
        )
    
    # Use current user's data (they just commented)
    author = {
        "id": current["id"],
        "name": current["name"],
        "avatar": current.get("avatar", ""),
        "headline": current.get("headline", ""),
    }
    return {
        "id": doc["id"],
        "author": author,
        "text": doc["text"],
        "likes": 0,
        "parent_comment_id": doc.get("parent_comment_id"),
        "created_at": doc["created_at"],
        "timeAgo": "now",
    }


@router.post("/{post_id}/repost")
async def repost(post_id: str, data: RepostIn, current=Depends(get_current_user)):
    """Repost or quote a post."""
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
    # Use current user's data since they just created it
    author = {
        "id": current["id"],
        "name": current["name"],
        "avatar": current.get("avatar", ""),
        "headline": current.get("headline", ""),
    }
    return await serialize_post_with_author(new_post, author, current["id"], False)
