"""Database management and initialization routes."""
from fastapi import APIRouter, HTTPException, Depends
from app.database import db
from app.security import get_current_user
from app.config import log

router = APIRouter(prefix="/db", tags=["database"])


async def check_is_admin(current=Depends(get_current_user)):
    """Check if user is admin."""
    if not current.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current


@router.post("/init")
async def init_database(current=Depends(check_is_admin)):
    """Initialize database collections and indexes."""
    try:
        collections_info = {}

        # USERS Collection
        try:
            await db.users.create_index("email", unique=True)
            await db.users.create_index("id", unique=True)
            await db.users.create_index([("created_at", -1)])
            await db.users.create_index([("name", "text"), ("headline", "text"), ("about", "text")])
            collections_info["users"] = {
                "status": "initialized",
                "count": await db.users.count_documents({}),
                "indexes": ["email (unique)", "id (unique)", "created_at", "text search"],
            }
        except Exception as e:
            collections_info["users"] = {"status": "error", "message": str(e)}

        # POSTS Collection
        try:
            await db.posts.create_index([("created_at", -1)])
            await db.posts.create_index([("user_id", 1)])
            await db.posts.create_index([("content", "text")])
            collections_info["posts"] = {
                "status": "initialized",
                "count": await db.posts.count_documents({}),
                "indexes": ["created_at", "user_id", "text search"],
            }
        except Exception as e:
            collections_info["posts"] = {"status": "error", "message": str(e)}

        # CONNECTIONS Collection
        try:
            await db.connections.create_index([("requester_id", 1), ("receiver_id", 1)])
            await db.connections.create_index([("status", 1), ("created_at", -1)])
            await db.connections.create_index([("requester_id", 1), ("status", 1)])
            collections_info["connections"] = {
                "status": "initialized",
                "count": await db.connections.count_documents({}),
                "indexes": ["requester/receiver", "status/date", "requester/status"],
            }
        except Exception as e:
            collections_info["connections"] = {"status": "error", "message": str(e)}

        # MESSAGES Collection
        try:
            await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
            await db.messages.create_index([("from_id", 1)])
            await db.messages.create_index([("to_id", 1)])
            collections_info["messages"] = {
                "status": "initialized",
                "count": await db.messages.count_documents({}),
                "indexes": ["conversation_id/date", "from_id", "to_id"],
            }
        except Exception as e:
            collections_info["messages"] = {"status": "error", "message": str(e)}

        # CONVERSATIONS Collection
        try:
            await db.conversations.create_index([("participants", 1)])
            await db.conversations.create_index([("updated_at", -1)])
            collections_info["conversations"] = {
                "status": "initialized",
                "count": await db.conversations.count_documents({}),
                "indexes": ["participants", "updated_at"],
            }
        except Exception as e:
            collections_info["conversations"] = {"status": "error", "message": str(e)}

        # NOTIFICATIONS Collection
        try:
            await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
            await db.notifications.create_index([("user_id", 1), ("read", 1)])
            collections_info["notifications"] = {
                "status": "initialized",
                "count": await db.notifications.count_documents({}),
                "indexes": ["user_id/date", "user_id/read"],
            }
        except Exception as e:
            collections_info["notifications"] = {"status": "error", "message": str(e)}

        # JOBS Collection
        try:
            await db.jobs.create_index([("created_at", -1)])
            await db.jobs.create_index([("company", 1)])
            await db.jobs.create_index([("title", "text"), ("company", "text"), ("description", "text")])
            collections_info["jobs"] = {
                "status": "initialized",
                "count": await db.jobs.count_documents({}),
                "indexes": ["created_at", "company", "text search"],
            }
        except Exception as e:
            collections_info["jobs"] = {"status": "error", "message": str(e)}

        # COMPANIES Collection
        try:
            await db.companies.create_index("id", unique=True)
            await db.companies.create_index([("name", "text")])
            collections_info["companies"] = {
                "status": "initialized",
                "count": await db.companies.count_documents({}),
                "indexes": ["id (unique)", "name (text search)"],
            }
        except Exception as e:
            collections_info["companies"] = {"status": "error", "message": str(e)}

        # RECOMMENDATIONS Collection
        try:
            await db.recommendations.create_index([("from_id", 1), ("to_id", 1)], unique=True)
            await db.recommendations.create_index([("to_id", 1), ("created_at", -1)])
            collections_info["recommendations"] = {
                "status": "initialized",
                "count": await db.recommendations.count_documents({}),
                "indexes": ["from_id/to_id (unique)", "to_id/date"],
            }
        except Exception as e:
            collections_info["recommendations"] = {"status": "error", "message": str(e)}

        # ENDORSEMENTS Collection
        try:
            await db.endorsements.create_index([("from_id", 1), ("user_id", 1), ("skill", 1)], unique=True)
            await db.endorsements.create_index([("user_id", 1), ("skill", 1)])
            collections_info["endorsements"] = {
                "status": "initialized",
                "count": await db.endorsements.count_documents({}),
                "indexes": ["from/user/skill (unique)", "user/skill"],
            }
        except Exception as e:
            collections_info["endorsements"] = {"status": "error", "message": str(e)}

        # VERIFICATION_REQUESTS Collection
        try:
            await db.verification_requests.create_index([("user_id", 1)])
            await db.verification_requests.create_index([("status", 1), ("created_at", -1)])
            collections_info["verification_requests"] = {
                "status": "initialized",
                "count": await db.verification_requests.count_documents({}),
                "indexes": ["user_id", "status/date"],
            }
        except Exception as e:
            collections_info["verification_requests"] = {"status": "error", "message": str(e)}

        # COMPANY_REQUESTS Collection
        try:
            await db.company_requests.create_index([("user_id", 1)])
            await db.company_requests.create_index([("status", 1), ("created_at", -1)])
            collections_info["company_requests"] = {
                "status": "initialized",
                "count": await db.company_requests.count_documents({}),
                "indexes": ["user_id", "status/date"],
            }
        except Exception as e:
            collections_info["company_requests"] = {"status": "error", "message": str(e)}

        log.info(f"Database initialization complete: {collections_info}")
        return {
            "status": "success",
            "message": "Database initialized with all collections and indexes",
            "collections": collections_info,
        }

    except Exception as e:
        log.error(f"Database initialization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {str(e)}")


@router.get("/status")
async def db_status(current=Depends(check_is_admin)):
    """Get database status and collection info."""
    try:
        collections = {}
        collections_list = await db.list_collection_names()
        
        for coll_name in collections_list:
            coll = db[coll_name]
            try:
                count = await coll.count_documents({})
                indexes = await coll.list_indexes()
                index_names = [idx.get("name") for idx in indexes]
                collections[coll_name] = {
                    "documents": count,
                    "indexes": index_names,
                }
            except Exception as e:
                collections[coll_name] = {"error": str(e)}

        return {
            "status": "connected",
            "collections": collections,
            "total_collections": len(collections_list),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")


@router.post("/clear-all")
async def clear_all_data(current=Depends(check_is_admin)):
    """Clear all collections (DESTRUCTIVE - Admin only)."""
    try:
        collections_list = await db.list_collection_names()
        cleared = []
        
        for coll_name in collections_list:
            try:
                result = await db[coll_name].delete_many({})
                cleared.append({
                    "collection": coll_name,
                    "deleted_count": result.deleted_count,
                })
            except Exception as e:
                cleared.append({
                    "collection": coll_name,
                    "error": str(e),
                })

        log.warning(f"All database collections cleared by {current.get('email')}")
        return {
            "status": "cleared",
            "details": cleared,
            "message": "All data has been deleted",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clear operation failed: {str(e)}")
