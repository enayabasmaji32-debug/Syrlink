"""Main FastAPI application."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import CORS_ORIGINS, log, ADMIN_EMAIL, ADMIN_PASSWORD
from app.database import client
from app.security import hash_password
from app.utils import uid, now_iso

# Import routers
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.posts import router as posts_router
from app.routes.connections import router as connections_router
from app.routes.relationships import router as relationships_router
from app.routes.jobs import router as jobs_router
from app.routes.messages import router as messages_router
from app.routes.notifications import router as notifications_router
from app.routes.search import router as search_router
from app.routes.database import router as database_router
from app.routes.other import verification_router, admin_router, util_router, reports_router, companies_requests_router
from app.routes.professional import companies_router, recommendations_router, endorsements_router, position_requests_router
from app.routes.websocket import router as websocket_router
from app.database import db

# Create FastAPI app
app = FastAPI(title="SyrLink API", version="1.0.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Add CORS middleware with timeout
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add timeout middleware to prevent hanging connections
from fastapi.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
import time

class TimeoutMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, timeout=30):
        super().__init__(app)
        self.timeout = timeout

    async def dispatch(self, request, call_next):
        try:
            start_time = time.time()
            response = await asyncio.wait_for(call_next(request), timeout=self.timeout)
            return response
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={"detail": "Request timeout - gateway timeout"}
            )

# Add rate limit exception handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again later."})

# MongoDB connection error handler
from pymongo.errors import AutoReconnect
import asyncio

@app.exception_handler(AutoReconnect)
async def mongodb_reconnect_handler(request, exc):
    """Handle MongoDB reconnection errors by retrying once."""
    log.warning(f"MongoDB connection lost, will retry: {exc}")
    # Give the connection pool a moment to recover
    await asyncio.sleep(1)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please try again."}
    )

# Register routers with /api prefix
api_prefix = "/api"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(posts_router, prefix=api_prefix)
app.include_router(connections_router, prefix=api_prefix)
app.include_router(relationships_router, prefix=api_prefix)
app.include_router(jobs_router, prefix=api_prefix)
app.include_router(messages_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(search_router, prefix=api_prefix)
app.include_router(database_router, prefix=api_prefix)
app.include_router(verification_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)
app.include_router(companies_requests_router, prefix=api_prefix)
app.include_router(companies_router, prefix=api_prefix)
app.include_router(recommendations_router, prefix=api_prefix)
app.include_router(endorsements_router, prefix=api_prefix)
app.include_router(position_requests_router, prefix=api_prefix)
app.include_router(util_router, prefix=api_prefix)
app.include_router(websocket_router, prefix=api_prefix)

# Serve frontend build if it exists
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_BUILD_DIR = ROOT_DIR / "frontend" / "build"
if FRONTEND_BUILD_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_BUILD_DIR / "static"),
        name="static",
    )

    @app.get("/", include_in_schema=False)
    async def spa_index():
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        requested_path = FRONTEND_BUILD_DIR / full_path
        if requested_path.exists() and requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")


@app.on_event("startup")
async def startup():
    """Initialize database and seed data."""
    log.info("SyrLink backend starting up...")
    log.info("Initializing database collections and indexes...")
    
    # USERS indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.users.create_index([("created_at", -1)])
        await db.users.create_index([("name", "text"), ("headline", "text"), ("about", "text")])
        log.info("✓ Users collection indexes created")
    except Exception as e:
        log.warning(f"Users indexes: {e}")
    
    # POSTS indexes
    try:
        await db.posts.create_index([("created_at", -1)])
        await db.posts.create_index([("author_id", 1)])
        await db.posts.create_index([("author_id", 1), ("created_at", -1)])
        await db.posts.create_index([("content", "text")])
        log.info("✓ Posts collection indexes created")
    except Exception as e:
        log.warning(f"Posts indexes: {e}")
    
    # CONNECTIONS indexes
    try:
        await db.connections.create_index([("requester_id", 1), ("receiver_id", 1)])
        await db.connections.create_index([("status", 1), ("created_at", -1)])
        log.info("✓ Connections collection indexes created")
    except Exception as e:
        log.warning(f"Connections indexes: {e}")
    
    # FOLLOWERS collection (unidirectional follow)
    try:
        await db.followers.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
        await db.followers.create_index([("following_id", 1), ("created_at", -1)])
        await db.followers.create_index([("follower_id", 1)])
        log.info("✓ Followers collection indexes created")
    except Exception as e:
        log.warning(f"Followers indexes: {e}")
    
    # BLOCKED_USERS collection
    try:
        await db.blocked_users.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
        await db.blocked_users.create_index([("blocked_id", 1)])
        log.info("✓ Blocked users collection indexes created")
    except Exception as e:
        log.warning(f"Blocked users indexes: {e}")
    
    # MESSAGES indexes
    try:
        await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        await db.messages.create_index([("sender_id", 1)])
        await db.messages.create_index([("conversation_id", 1), ("sender_id", 1), ("read_at", 1)])
        log.info("✓ Messages collection indexes created")
    except Exception as e:
        log.warning(f"Messages indexes: {e}")
    
    # CONVERSATIONS indexes
    try:
        await db.conversations.create_index([("participants", 1)])
        await db.conversations.create_index([("participants", 1), ("last_message_at", -1)])
        log.info("✓ Conversations collection indexes created")
    except Exception as e:
        log.warning(f"Conversations indexes: {e}")
    
    # NOTIFICATIONS indexes
    try:
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("read", 1)])
        log.info("✓ Notifications collection indexes created")
    except Exception as e:
        log.warning(f"Notifications indexes: {e}")
    
    # JOBS indexes
    try:
        await db.jobs.create_index([("created_at", -1)])
        await db.jobs.create_index([("company", 1)])
        await db.jobs.create_index([("title", "text"), ("company", "text"), ("description", "text")])
        log.info("✓ Jobs collection indexes created")
    except Exception as e:
        log.warning(f"Jobs indexes: {e}")
    
    # COMPANIES indexes
    try:
        await db.companies.create_index("id", unique=True)
        await db.companies.create_index([("name", "text")])
        log.info("✓ Companies collection indexes created")
    except Exception as e:
        log.warning(f"Companies indexes: {e}")
    
    # RECOMMENDATIONS indexes
    try:
        await db.recommendations.create_index([("from_id", 1), ("to_id", 1)], unique=True)
        await db.recommendations.create_index([("to_id", 1), ("created_at", -1)])
        log.info("✓ Recommendations collection indexes created")
    except Exception as e:
        log.warning(f"Recommendations indexes: {e}")
    
    # ENDORSEMENTS indexes
    try:
        await db.endorsements.create_index([("from_id", 1), ("user_id", 1), ("skill", 1)], unique=True)
        await db.endorsements.create_index([("user_id", 1), ("skill", 1)])
        log.info("✓ Endorsements collection indexes created")
    except Exception as e:
        log.warning(f"Endorsements indexes: {e}")
    
    # VERIFICATION_REQUESTS indexes
    try:
        await db.verification_requests.create_index([("user_id", 1)])
        await db.verification_requests.create_index([("status", 1), ("created_at", -1)])
        log.info("✓ Verification requests collection indexes created")
    except Exception as e:
        log.warning(f"Verification requests indexes: {e}")
    
    # REPORTS indexes
    try:
        await db.reports.create_index([("status", 1), ("created_at", -1)])
        await db.reports.create_index([("reporter_id", 1)])
        await db.reports.create_index([("target_type", 1), ("target_id", 1)])
        log.info("✓ Reports collection indexes created")
    except Exception as e:
        log.warning(f"Reports indexes: {e}")
    
    # COMPANY REQUESTS indexes
    try:
        await db.company_requests.create_index([("status", 1), ("created_at", -1)])
        await db.company_requests.create_index([("user_id", 1)])
        log.info("✓ Company requests collection indexes created")
    except Exception as e:
        log.warning(f"Company requests indexes: {e}")
    
    # POSITION REQUESTS indexes
    try:
        await db.position_requests.create_index([("company_id", 1), ("employee_id", 1), ("status", 1)], unique=False)
        await db.position_requests.create_index([("employee_id", 1), ("status", 1), ("created_at", -1)])
        await db.position_requests.create_index([("company_id", 1), ("status", 1), ("created_at", -1)])
        await db.position_requests.create_index([("created_at", -1)])
        log.info("✓ Position requests collection indexes created")
    except Exception as e:
        log.warning(f"Position requests indexes: {e}")
    
    # Auto seed if empty
    try:
        if await db.users.count_documents({}) == 0:
            try:
                from seed import run_seed
                await run_seed(db)
                log.info("✓ Seed data inserted.")
            except Exception as e:
                log.warning(f"Seed failed: {e}")
    except Exception as e:
        log.warning(f"Could not check if database is empty (MongoDB may be initializing): {e}")
    
    # Ensure admin user exists
    try:
        existing_admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not existing_admin:
            await db.users.insert_one({
                "id": uid(), "name": "SyrLink Admin", "email": ADMIN_EMAIL,
                "password_hash": hash_password(ADMIN_PASSWORD),
                "avatar": "https://api.dicebear.com/7.x/initials/svg?seed=Admin",
                "cover": "", "headline": "Platform Administrator", "location": "Damascus",
                "about": "", "verified": True, "is_admin": True, "email_verified": True,
                "experience": [], "education": [], "skills": [], "languages": [],
                "connections": 0, "created_at": now_iso(),
            })
            log.info("✓ Admin user created")
        else:
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"is_admin": True, "verified": True}})
            log.info("✓ Admin user verified")
    except Exception as e:
        log.warning(f"Could not ensure admin user exists: {e}")
    
    log.info("✓ SyrLink backend ready!")


@app.on_event("shutdown")
async def shutdown():
    """Close database connection."""
    log.info("Shutting down...")
    client.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
