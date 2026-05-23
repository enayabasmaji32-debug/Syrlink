"""WebSocket for real-time online status updates."""
from fastapi import WebSocket, APIRouter, Depends, HTTPException
from typing import Set, Dict, List
import json
from app.security import get_current_user
from app.utils import uid

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


@router.websocket("/online/{token}")
async def websocket_online_status(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time online status.
    
    Usage:
        ws://localhost:8000/api/ws/online/YOUR_JWT_TOKEN
    """
    # Authenticate user
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    user_id = user["id"]
    
    await websocket.accept()
    active_connections[user_id] = websocket
    
    try:
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
        del active_connections[user_id]
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


async def get_online_users() -> Set[str]:
    """Get set of all currently online user IDs."""
    return set(active_connections.keys())
