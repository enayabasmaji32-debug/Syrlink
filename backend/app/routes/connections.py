"""Connection and networking routes."""
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends

from app.models import ConnectionRequestIn
from app.security import get_current_user
from app.utils import uid, now_iso, create_notification, batch_fetch_users
from app.database import db
from app.config import log

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/invitations")
async def list_invitations(current=Depends(get_current_user)):
    """List pending connection requests for the current user."""
    log.info("[/invitations] Fetching pending invitations")
    
    # Get pending invitations (limited to 50)
    invs = await db.connections.find(
        {"receiver_id": current["id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    log.info(f"[/invitations] Found {len(invs)} invitations")
    
    if not invs:
        return []
    
    # Batch fetch all requester users
    requester_ids = [inv["requester_id"] for inv in invs]
    log.debug(f"[/invitations] Fetching {len(requester_ids)} requester profiles")
    
    user_map = await batch_fetch_users(requester_ids)
    
    # Get current user's connections for mutual count calculation (limited to 300)
    current_conns = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0, "requester_id": 1, "receiver_id": 1},
    ).limit(300).to_list(300)
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
    ).limit(500).to_list(500)
    
    # Count mutual per requester
    mutual_map = {}
    for conn in mutual_connections:
        requester = conn["requester_id"] if conn["requester_id"] in requester_ids else conn["receiver_id"]
        mutual_map[requester] = mutual_map.get(requester, 0) + 1
    
    out = [
        {
            "id": inv["id"],
            "user": user_map.get(inv["requester_id"], {"id": inv["requester_id"], "name": "Unknown", "avatar": "", "headline": ""}),
            "note": inv.get("note", ""),
            "mutual": mutual_map.get(inv["requester_id"], 0),
            "created_at": inv["created_at"],
        }
        for inv in invs
    ]
    log.info(f"[/invitations] Returning {len(out)} invitations")
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
    """Get all connections for current user (limited to 200 for performance)."""
    conns = await db.connections.find(
        {"status": "accepted", "$or": [{"requester_id": current["id"]}, {"receiver_id": current["id"]}]},
        {"_id": 0},
    ).limit(200).to_list(200)
    
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
async def network_users(current=Depends(get_current_user)):
    """Get network discovery suggestions (limited to 50 for performance)."""
    log.debug("[/network] Fetching network data for current user")
    
    # Get relationship statuses (limit to 500 to avoid scanning too much)
    relations = await db.connections.find(
        {
            "status": {"$in": ["accepted", "pending"]},
            "$or": [
                {"requester_id": current["id"]},
                {"receiver_id": current["id"]},
            ],
        },
        {"_id": 0, "id": 1, "requester_id": 1, "receiver_id": 1, "status": 1}
    ).to_list(500)

    status_map = {}
    exclude_ids = {current["id"]}
    for relation in relations:
        other_id = relation["receiver_id"] if relation["requester_id"] == current["id"] else relation["requester_id"]
        exclude_ids.add(other_id)
        if relation["status"] == "accepted":
            status_map[other_id] = {"relationship": "connected", "connection_id": relation["id"]}
        elif relation["status"] == "pending":
            if relation["requester_id"] == current["id"]:
                status_map[other_id] = {"relationship": "pending_sent", "connection_id": relation["id"]}
            else:
                status_map[other_id] = {"relationship": "pending_received", "connection_id": relation["id"]}

    log.debug(f"[/network] Found {len(status_map)} relationships, excluding {len(exclude_ids)} users")

    # Fetch only 50 users NOT connected/pending (OPTIMIZED - no full scan)
    all_users = await db.users.find(
        {"id": {"$nin": list(exclude_ids)}},
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1, "verified": 1}
    ).limit(50).to_list(50)

    log.debug(f"[/network] Found {len(all_users)} network suggestions")

    out = []
    for user in all_users:
        out.append({
            **user,
            "relationship": "not_connected",
            "connection_id": None,
        })
    
    log.info(f"[/network] Returning {len(out)} network suggestions")
    return out


@router.get("/pending-sent")
async def pending_sent(current=Depends(get_current_user)):
    """Get list of pending connection requests sent by current user (limited to 200)."""
    conns = await db.connections.find(
        {"requester_id": current["id"], "status": "pending"}, {"_id": 0, "receiver_id": 1}
    ).limit(200).to_list(200)
    return [c["receiver_id"] for c in conns]
