"""Connection and networking routes."""
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends

from app.models import ConnectionRequestIn
from app.security import get_current_user
from app.utils import uid, now_iso, create_notification
from app.database import db

router = APIRouter(prefix="/connections", tags=["connections"])


async def batch_fetch_users(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch multiple users to avoid N+1 queries."""
    unique_ids = list(set(user_ids))
    users = await db.users.find(
        {"id": {"$in": unique_ids}}, 
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1}
    ).to_list(len(unique_ids))
    user_map = {u["id"]: u for u in users}
    # Add defaults for missing users
    for _uid in unique_ids:
        if _uid not in user_map:
            user_map[_uid] = {"id": _uid, "name": "Unknown", "avatar": "", "headline": ""}
    return user_map


@router.get("/invitations")
async def list_invitations(current=Depends(get_current_user)):
    """List pending connection requests for the current user."""
    # Get pending invitations
    invs = await db.connections.find(
        {"receiver_id": current["id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    if not invs:
        return []
    
    # Batch fetch all requester users
    requester_ids = [inv["requester_id"] for inv in invs]
    user_map = await batch_fetch_users(requester_ids)
    
    # Get current user's connections for mutual count calculation
    current_conns = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).to_list(1000)
    connected_ids = {c["requester_id"] if c["receiver_id"] == current["id"] else c["receiver_id"] for c in current_conns}
    
    # Fetch all mutual connections in one query
    mutual_connections = await db.connections.find(
        {
            "status": "accepted",
            "$or": [
                {"requester_id": {"$in": requester_ids}, "receiver_id": {"$in": list(connected_ids)}},
                {"receiver_id": {"$in": requester_ids}, "requester_id": {"$in": list(connected_ids)}},
            ]
        },
        {"_id": 0, "requester_id": 1, "receiver_id": 1}
    ).to_list(1000)
    
    # Count mutual per requester
    mutual_map = {}
    for conn in mutual_connections:
        requester = conn["requester_id"] if conn["requester_id"] in requester_ids else conn["receiver_id"]
        mutual_map[requester] = mutual_map.get(requester, 0) + 1
    
    out = [
        {
            "id": inv["id"],
            "user": user_map[inv["requester_id"]],
            "note": inv.get("note", ""),
            "mutual": mutual_map.get(inv["requester_id"], 0),
            "created_at": inv["created_at"],
        }
        for inv in invs
    ]
    return out


@router.post("/request")
async def send_connection(data: ConnectionRequestIn, current=Depends(get_current_user)):
    """Send a connection request."""
    if data.receiver_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    
    receiver = await db.users.find_one({"id": data.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.connections.find_one({
        "$or": [
            {"requester_id": current["id"], "receiver_id": data.receiver_id},
            {"requester_id": data.receiver_id, "receiver_id": current["id"]},
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists or pending")
    
    doc = {
        "id": uid(),
        "requester_id": current["id"],
        "receiver_id": data.receiver_id,
        "status": "pending",
        "note": data.note or "",
        "created_at": now_iso(),
    }
    await db.connections.insert_one(doc)
    await create_notification(
        user_id=data.receiver_id,
        actor_id=current["id"],
        ntype="connection",
        text="sent you a connection request",
        target_id=doc["id"],
    )
    doc.pop("_id", None)
    return doc


@router.post("/{conn_id}/accept")
async def accept_connection(conn_id: str, current=Depends(get_current_user)):
    """Accept a connection request."""
    conn = await db.connections.find_one({"id": conn_id})
    if not conn or conn["receiver_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "accepted", "accepted_at": now_iso()}})
    await db.users.update_one({"id": current["id"]}, {"$inc": {"connections": 1}})
    await db.users.update_one({"id": conn["requester_id"]}, {"$inc": {"connections": 1}})
    await create_notification(
        user_id=conn["requester_id"],
        actor_id=current["id"],
        ntype="connection",
        text="accepted your connection request",
        target_id=conn_id,
    )
    return {"ok": True}


@router.post("/{conn_id}/ignore")
async def ignore_connection(conn_id: str, current=Depends(get_current_user)):
    """Ignore/decline a connection request."""
    conn = await db.connections.find_one({"id": conn_id})
    if not conn or conn["receiver_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "declined"}})
    return {"ok": True}


@router.get("/me")
async def my_connections(current=Depends(get_current_user)):
    """Get all connections for current user."""
    conns = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0},
    ).limit(1000).to_list(1000)
    
    if not conns:
        return []
    
    user_ids = [c["requester_id"] if c["receiver_id"] == current["id"] else c["receiver_id"] for c in conns]
    # Only fetch necessary fields
    users = await db.users.find(
        {"id": {"$in": user_ids}}, 
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).to_list(len(user_ids))
    return users


@router.get("/network")
async def network_users(limit: int = 20, current=Depends(get_current_user)):
    """Get users with current relationship status for network/friend discovery."""
    relations = await db.connections.find(
        {
            "status": {"$in": ["accepted", "pending"]},
            "$or": [
                {"requester_id": current["id"]},
                {"receiver_id": current["id"]},
            ],
        },
        {"_id": 0, "id": 1, "requester_id": 1, "receiver_id": 1, "status": 1}
    ).limit(1000).to_list(1000)

    status_map = {}
    for relation in relations:
        other_id = relation["receiver_id"] if relation["requester_id"] == current["id"] else relation["requester_id"]
        if relation["status"] == "accepted":
            status_map[other_id] = {"relationship": "connected", "connection_id": relation["id"]}
        elif relation["status"] == "pending":
            if relation["requester_id"] == current["id"]:
                status_map[other_id] = {"relationship": "pending_sent", "connection_id": relation["id"]}
            else:
                status_map[other_id] = {"relationship": "pending_received", "connection_id": relation["id"]}

    users = await db.users.find(
        {"id": {"$ne": current["id"]}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "cover": 1, "verified": 1}
    ).limit(limit).to_list(limit)

    out = []
    for user in users:
        const_status = status_map.get(user["id"], {})
        out.append({
            **user,
            "relationship": const_status.get("relationship", "none"),
            "connection_id": const_status.get("connection_id"),
        })
    return out


@router.get("/pending-sent")
async def pending_sent(current=Depends(get_current_user)):
    """Get list of pending connection requests sent by current user."""
    conns = await db.connections.find(
        {"requester_id": current["id"], "status": "pending"}, {"_id": 0, "receiver_id": 1}
    ).limit(1000).to_list(1000)
    return [c["receiver_id"] for c in conns]
