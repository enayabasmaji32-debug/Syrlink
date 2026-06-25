"""WebSocket for real-time online status updates."""
from fastapi import WebSocket, APIRouter, Depends, HTTPException
from typing import Set, Dict, List
import json
from app.security import get_current_user
from app.utils import uid
from app.database import db

router = APIRouter(prefix="/ws", tags=["websocket"])

# Store active connections: {user_id: websocket}
active_connections: Dict[str, WebSocket] = {}


async def get_user_from_token(token: str) -> Dict:
    """Extract user info from JWT token (simplified)."""
    from app.security import get_current_user as get_user
    from fastapi.security import HTTPAuthorizationCredentials
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        return await get_user(creds)
    except:
        return None


@router.websocket("/online")
async def websocket_online_status(websocket: WebSocket):
    """WebSocket endpoint for real-time online status.
    
    Authenticates via httpOnly JWT cookie sent in the handshake.
    """
    await websocket.accept()
    
    # Authenticate user from httpOnly cookie
    from app.config import JWT_COOKIE_NAME, JWT_SECRET, JWT_ALGORITHM
    import jwt as pyjwt
    
    token = websocket.cookies.get(JWT_COOKIE_NAME)
    if not token:
        await websocket.close(code=4001, reason="Unauthorized: missing token")
        return
    
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    active_connections[user_id] = websocket
    
    try:
        # Send unread notifications on connect
        notifs = await db.notifications.find(
            {"user_id": user_id, "read": False},
            {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(20)
        if notifs:
            await websocket.send_text(json.dumps({"type": "notifications", "data": notifs}))
        
        # Broadcast that user is online
        await broadcast_user_status(user_id, "online")
        
        # Keep connection alive and listen for pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except Exception as e:
        print(f"WebSocket error for {user_id}: {e}")
    finally:
        active_connections.pop(user_id, None)
        # Broadcast that user is offline
        await broadcast_user_status(user_id, "offline")


async def broadcast_user_status(user_id: str, status: str):
    """Broadcast user online/offline status to all connected clients."""
    message = json.dumps({
        "type": "status_change",
        "user_id": user_id,
        "status": status,  # "online" or "offline"
    })
    
    for conn_user_id, connection in active_connections.items():
        try:
            await connection.send_text(message)
        except Exception as e:
            print(f"Failed to send to {conn_user_id}: {e}")


async def send_notification_to_user(user_id: str, notification: dict):
    """Send a notification to a specific connected user."""
    conn = active_connections.get(user_id)
    if conn:
        try:
            await conn.send_text(json.dumps({"type": "notification", "data": notification}))
        except Exception as e:
            print(f"Failed to send notification to {user_id}: {e}")


async def get_online_users() -> Set[str]:
    """Get set of all currently online user IDs."""
    return set(active_connections.keys())
