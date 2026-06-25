"""Companies, recommendations, and endorsements routes."""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from app.models import CompanyIn, CompanyRequestIn, CompanyEmployeeIn, EmployeePositionRequestIn, RecommendationIn, EndorsementIn
from app.security import get_current_user
from app.utils import uid, now_iso, fetch_user_brief, create_notification, create_admin_notification
from app.database import db

# Companies router
companies_router = APIRouter(prefix="/companies", tags=["companies"])


@companies_router.post("/request")
async def request_company(data: CompanyRequestIn, current=Depends(get_current_user)):
    """Submit a company creation request for admin approval."""
    # Check if user already has pending company request
    existing = await db.company_requests.find_one({
        "user_id": current["id"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending company request")
    
    doc = {
        "id": uid(),
        "user_id": current["id"],
        "name": data.name,
        "industry": data.industry,
        "registration_number": data.registration_number,
        "employees_count": data.employees_count,
        "owner_name": data.owner_name,
        "ceo_name": data.ceo_name,
        "website": data.website or "",
        "location": data.location or "",
        "tagline": data.tagline or "",
        "about": data.about or "",
        "logo": data.logo or "",
        "cover": data.cover or "",
        "commercial_registry_image": data.commercial_registry_image,
        # Investment fields
        "is_looking_for_investors": data.is_looking_for_investors or False,
        "valuation": data.valuation,
        "investment_type": data.investment_type or "",
        "funding_amount": data.funding_amount,
        "company_status": data.company_status or "",
        "available_equity": data.available_equity,
        "funding_round_status": data.funding_round_status or "",
        "status": "pending",  # pending, approved, rejected
        "created_at": now_iso(),
    }
    await db.company_requests.insert_one(doc)
    
    await create_admin_notification(
        actor_id=current["id"],
        ntype="admin",
        text=f"New company request from {current['name']}: {data.name}",
        target_id=doc["id"],
    )
    
    doc.pop("_id", None)
    return doc


@companies_router.post("")
async def create_company(data: CompanyIn, current=Depends(get_current_user)):
    """Create a new company (admin only)."""
    if not current.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    
    doc = {
        "id": uid(),
        "user_id": current["id"],
        "name": data.name,
        "logo": data.logo or f"https://api.dicebear.com/7.x/initials/svg?seed={data.name}",
        "cover": data.cover or "",
        "tagline": data.tagline or "",
        "about": data.about or "",
        "website": data.website or "",
        "location": data.location or "",
        "industry": data.industry or "",
        "employees_count": data.employees_count or 0,
        "employees": data.employees or [],
        # Investment fields
        "is_looking_for_investors": data.is_looking_for_investors or False,
        "valuation": data.valuation,
        "investment_type": data.investment_type or "",
        "funding_amount": data.funding_amount,
        "company_status": data.company_status or "",
        "available_equity": data.available_equity,
        "funding_round_status": data.funding_round_status or "",
        "created_at": now_iso(),
        "status": "approved",
    }
    await db.companies.insert_one(doc)
    doc.pop("_id", None)
    return doc


@companies_router.get("")
async def list_companies(q: Optional[str] = None, skip: int = 0, limit: int = 20, seeking_investment: Optional[bool] = None, current=Depends(get_current_user)):
    """List approved companies with optional search and investment filter."""
    query = {"status": "approved"}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"industry": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
        ]
    if seeking_investment is not None:
        query["is_looking_for_investors"] = seeking_investment
    
    projection = {
        "_id": 0,
        "id": 1,
        "name": 1,
        "logo": 1,
        "tagline": 1,
        "location": 1,
        "industry": 1,
        "is_looking_for_investors": 1,
        "valuation": 1,
        "investment_type": 1,
        "funding_amount": 1,
        "available_equity": 1,
        "funding_round_status": 1,
        "created_at": 1,
        "employees_count": 1,
    }
    
    total = await db.companies.count_documents(query)
    companies = await db.companies.find(query, projection).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"data": companies, "total": total, "skip": skip, "limit": limit}


@companies_router.get("/me")
async def my_companies(current=Depends(get_current_user)):
    """Get approved companies owned by the current user. Must come before /{company_id}."""
    projection = {
        "_id": 0,
        "id": 1,
        "name": 1,
        "logo": 1,
        "cover": 1,
        "tagline": 1,
        "about": 1,
        "location": 1,
        "industry": 1,
        "website": 1,
        "employees_count": 1,
        "created_at": 1,
        "is_looking_for_investors": 1,
        "valuation": 1,
        "funding_amount": 1,
        "available_equity": 1,
        "investment_type": 1,
        "company_status": 1,
        "funding_round_status": 1,
    }
    companies = await db.companies.find(
        {"user_id": current["id"], "status": "approved"},
        projection
    ).sort("created_at", -1).to_list(50)
    return companies


@companies_router.get("/{company_id}")
async def get_company(company_id: str, current=Depends(get_current_user)):
    """Get company profile with all fields including investment data."""
    company = await db.companies.find_one({"id": company_id, "status": "approved"}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # Ensure all investment fields are present with defaults if needed
    company.setdefault("is_looking_for_investors", False)
    company.setdefault("valuation", None)
    company.setdefault("funding_amount", None)
    company.setdefault("available_equity", None)
    company.setdefault("investment_type", "")
    company.setdefault("company_status", "")
    company.setdefault("funding_round_status", "")
    return company


@companies_router.put("/{company_id}")
async def update_company(company_id: str, data: CompanyIn, current=Depends(get_current_user)):
    """Update company profile."""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not current.get("is_admin") and company.get("user_id") != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this company")

    update_data = {
        "name": data.name,
        "logo": data.logo or f"https://api.dicebear.com/7.x/initials/svg?seed={data.name}",
        "cover": data.cover or "",
        "tagline": data.tagline or "",
        "about": data.about or "",
        "website": data.website or "",
        "location": data.location or "",
        "industry": data.industry or "",
        "employees_count": data.employees_count or 0,
        "is_looking_for_investors": data.is_looking_for_investors or False,
        "valuation": data.valuation,
        "investment_type": data.investment_type or "",
        "funding_amount": data.funding_amount,
        "company_status": data.company_status or "",
        "available_equity": data.available_equity,
        "funding_round_status": data.funding_round_status or "",
    }
    if data.employees is not None:
        update_data["employees"] = data.employees

    await db.companies.update_one({"id": company_id}, {"$set": update_data})
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company


@companies_router.post("/{company_id}/employees")
async def add_company_employee(company_id: str, data: CompanyEmployeeIn, current=Depends(get_current_user)):
    """Add an employee to a company."""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not current.get("is_admin") and company.get("user_id") != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage employees")

    existing_user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "name": 1, "avatar": 1, "headline": 1})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    if any(emp["id"] == data.user_id for emp in company.get("employees", [])):
        raise HTTPException(status_code=400, detail="User is already an employee")

    employee = {
        "id": existing_user["id"],
        "name": existing_user["name"],
        "avatar": existing_user.get("avatar", ""),
        "headline": existing_user.get("headline", ""),
        "role": data.role,
    }
    await db.companies.update_one(
        {"id": company_id},
        {"$push": {"employees": employee}, "$inc": {"employees_count": 1}}
    )
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company


@companies_router.put("/{company_id}/employees/{employee_id}")
async def update_company_employee(company_id: str, employee_id: str, data: CompanyEmployeeIn, current=Depends(get_current_user)):
    """Update an employee role in a company."""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not current.get("is_admin") and company.get("user_id") != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage employees")

    result = await db.companies.update_one(
        {"id": company_id, "employees.id": employee_id},
        {"$set": {"employees.$.role": data.role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company


@companies_router.delete("/{company_id}/employees/{employee_id}")
async def remove_company_employee(company_id: str, employee_id: str, current=Depends(get_current_user)):
    """Remove an employee from a company."""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not current.get("is_admin") and company.get("user_id") != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage employees")

    result = await db.companies.update_one(
        {"id": company_id},
        {"$pull": {"employees": {"id": employee_id}}, "$inc": {"employees_count": -1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company


# Recommendations router
recommendations_router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@recommendations_router.post("")
async def give_recommendation(data: RecommendationIn, current=Depends(get_current_user)):
    """Give a recommendation to a user."""
    if data.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot recommend yourself")
    
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already recommended
    existing = await db.recommendations.find_one({
        "from_id": current["id"],
        "to_id": data.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already recommended this user")
    
    doc = {
        "id": uid(),
        "from_id": current["id"],
        "to_id": data.user_id,
        "text": data.text,
        "visible": True,
        "created_at": now_iso(),
    }
    await db.recommendations.insert_one(doc)
    
    await create_notification(
        user_id=data.user_id,
        actor_id=current["id"],
        ntype="recommendation",
        text="recommended you",
        target_id=doc["id"],
    )
    
    doc.pop("_id", None)
    return doc


@recommendations_router.get("/user/{user_id}")
async def get_user_recommendations(user_id: str, current=Depends(get_current_user)):
    """Get recommendations for a user."""
    recs = await db.recommendations.find(
        {"to_id": user_id, "visible": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    out = []
    for r in recs:
        from_user = await fetch_user_brief(r["from_id"]) or {}
        out.append({
            "id": r["id"],
            "from_user": from_user,
            "text": r["text"],
            "created_at": r["created_at"],
        })
    return out


@recommendations_router.get("/me")
async def my_recommendations(current=Depends(get_current_user)):
    """Get recommendations given by current user."""
    recs = await db.recommendations.find(
        {"from_id": current["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    out = []
    for r in recs:
        to_user = await fetch_user_brief(r["to_id"]) or {}
        out.append({
            "id": r["id"],
            "to_user": to_user,
            "text": r["text"],
            "visible": r["visible"],
            "created_at": r["created_at"],
        })
    return out


@recommendations_router.delete("/{rec_id}")
async def delete_recommendation(rec_id: str, current=Depends(get_current_user)):
    """Delete a recommendation (only by giver)."""
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec or rec["from_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    await db.recommendations.delete_one({"id": rec_id})
    return {"ok": True}


# Endorsements router
endorsements_router = APIRouter(prefix="/endorsements", tags=["endorsements"])


@endorsements_router.post("")
async def endorse_skill(data: EndorsementIn, current=Depends(get_current_user)):
    """Endorse a skill for a user."""
    if data.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot endorse yourself")
    
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.skill not in (user.get("skills") or []):
        raise HTTPException(status_code=400, detail="User doesn't have this skill")
    
    # Check if already endorsed
    existing = await db.endorsements.find_one({
        "from_id": current["id"],
        "user_id": data.user_id,
        "skill": data.skill
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already endorsed this skill")
    
    doc = {
        "id": uid(),
        "from_id": current["id"],
        "user_id": data.user_id,
        "skill": data.skill,
        "created_at": now_iso(),
    }
    await db.endorsements.insert_one(doc)
    
    # Count endorsements for this skill
    count = await db.endorsements.count_documents({
        "user_id": data.user_id,
        "skill": data.skill
    })
    
    await create_notification(
        user_id=data.user_id,
        actor_id=current["id"],
        ntype="endorsement",
        text=f"endorsed your {data.skill} skill",
        target_id=doc["id"],
    )
    
    doc.pop("_id", None)
    doc["count"] = count
    return doc


@endorsements_router.get("/user/{user_id}")
async def get_user_endorsements(user_id: str, current=Depends(get_current_user)):
    """Get endorsements for a user's skills."""
    skills = (await db.users.find_one({"id": user_id})).get("skills") or []
    
    out = {}
    for skill in skills:
        endorsements = await db.endorsements.find(
            {"user_id": user_id, "skill": skill}, {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        
        count = len(endorsements)
        givers = []
        for e in endorsements[:3]:  # Show top 3 givers
            giver = await fetch_user_brief(e["from_id"]) or {}
            givers.append(giver)
        
        out[skill] = {
            "count": count,
            "givers": givers,
        }
    
    return out


@endorsements_router.delete("/{endorsement_id}")
async def remove_endorsement(endorsement_id: str, current=Depends(get_current_user)):
    """Remove an endorsement (only by endorser)."""
    endorsement = await db.endorsements.find_one({"id": endorsement_id})
    if not endorsement or endorsement["from_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Endorsement not found")
    
    await db.endorsements.delete_one({"id": endorsement_id})
    return {"ok": True}


# ===========================================================================
# Employee Position Requests Router
# ===========================================================================

position_requests_router = APIRouter(prefix="/position-requests", tags=["position-requests"])


@companies_router.post("/{company_id}/position-requests")
async def send_position_request(
    company_id: str, 
    data: EmployeePositionRequestIn, 
    current=Depends(get_current_user)
):
    """Send a position request to an employee from a company.
    
    Only the company owner can send position requests.
    """
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Only company owner can send position requests
    if company.get("user_id") != current["id"] and not current.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only company owner can send position requests")
    
    # Check if employee exists
    employee = await db.users.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if employee is already in company
    if any(emp["id"] == data.employee_id for emp in company.get("employees", [])):
        raise HTTPException(status_code=400, detail="Employee already in company")
    
    # Check for existing pending request
    existing = await db.position_requests.find_one({
        "company_id": company_id,
        "employee_id": data.employee_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Position request already sent to this employee")
    
    doc = {
        "id": uid(),
        "company_id": company_id,
        "employee_id": data.employee_id,
        "position": data.position,
        "department": data.department or "",
        "description": data.description or "",
        "status": "pending",  # pending, accepted, rejected
        "created_at": now_iso(),
        "responded_at": None,
    }
    
    await db.position_requests.insert_one(doc)
    
    # Notify employee
    company_brief = {
        "id": company["id"],
        "name": company["name"],
        "avatar": company.get("logo", ""),
    }
    
    await create_notification(
        user_id=data.employee_id,
        actor_id=company["user_id"],
        ntype="position_request",
        text=f"invited you to join as {data.position} at {company['name']}",
        target_id=doc["id"],
    )
    
    doc.pop("_id", None)
    return {
        **doc,
        "company": company_brief,
        "employee": {
            "id": employee["id"],
            "name": employee["name"],
            "avatar": employee.get("avatar", ""),
        }
    }


@position_requests_router.get("/received")
async def get_received_position_requests(
    status: str = "pending",
    current=Depends(get_current_user)
):
    """Get position requests received by the current user.
    
    Filter by status: 'pending', 'accepted', 'rejected', or 'all'
    """
    query = {"employee_id": current["id"]}
    
    if status != "all":
        query["status"] = status
    
    requests = await db.position_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    out = []
    for req in requests:
        company = await db.companies.find_one(
            {"id": req["company_id"]},
            {"_id": 0, "id": 1, "name": 1, "logo": 1, "tagline": 1}
        )
        company_brief = {
            "id": company["id"],
            "name": company["name"],
            "avatar": company.get("logo", ""),
            "headline": company.get("tagline", ""),
        } if company else None
        
        out.append({
            **req,
            "company": company_brief,
        })
    
    return out


@position_requests_router.get("/sent/{company_id}")
async def get_sent_position_requests(
    company_id: str,
    status: str = "pending",
    current=Depends(get_current_user)
):
    """Get position requests sent by a company.
    
    Only company owner can view this.
    Filter by status: 'pending', 'accepted', 'rejected', or 'all'
    """
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.get("user_id") != current["id"] and not current.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to view these requests")
    
    query = {"company_id": company_id}
    
    if status != "all":
        query["status"] = status
    
    requests = await db.position_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    out = []
    for req in requests:
        employee = await db.users.find_one(
            {"id": req["employee_id"]},
            {"_id": 0, "id": 1, "name": 1, "avatar": 1, "headline": 1}
        )
        employee_brief = {
            "id": employee["id"],
            "name": employee["name"],
            "avatar": employee.get("avatar", ""),
            "headline": employee.get("headline", ""),
        } if employee else None
        
        out.append({
            **req,
            "employee": employee_brief,
        })
    
    return out


@position_requests_router.put("/{request_id}/accept")
async def accept_position_request(
    request_id: str,
    current=Depends(get_current_user)
):
    """Accept a position request and join the company with the offered position."""
    req = await db.position_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Position request not found")
    
    # Only the targeted employee can accept
    if req["employee_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")
    
    # Check company still exists
    company = await db.companies.find_one({"id": req["company_id"]})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Add employee to company
    employee_data = {
        "id": current["id"],
        "name": current["name"],
        "avatar": current.get("avatar", ""),
        "headline": current.get("headline", ""),
        "role": req["position"],
        "department": req.get("department", ""),
    }
    
    # Update company
    await db.companies.update_one(
        {"id": req["company_id"]},
        {"$push": {"employees": employee_data}, "$inc": {"employees_count": 1}}
    )
    
    # Update position request
    await db.position_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "accepted",
            "responded_at": now_iso(),
        }}
    )
    
    # Notify company owner
    company_owner = await db.users.find_one({"id": company["user_id"]})
    
    await create_notification(
        user_id=company["user_id"],
        actor_id=current["id"],
        ntype="position_accepted",
        text=f"accepted position request to join {company['name']} as {req['position']}",
        target_id=request_id,
    )
    
    return {
        **req,
        "status": "accepted",
        "responded_at": now_iso(),
    }


@position_requests_router.put("/{request_id}/reject")
async def reject_position_request(
    request_id: str,
    current=Depends(get_current_user)
):
    """Reject a position request."""
    req = await db.position_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Position request not found")
    
    # Only the targeted employee can reject
    if req["employee_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to reject this request")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {req['status']}")
    
    # Update position request
    await db.position_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "responded_at": now_iso(),
        }}
    )
    
    # Notify company owner
    company = await db.companies.find_one({"id": req["company_id"]})
    
    if company:
        await create_notification(
            user_id=company["user_id"],
            actor_id=current["id"],
            ntype="position_rejected",
            text=f"declined position request at {company['name']}",
            target_id=request_id,
        )
    
    return {
        **req,
        "status": "rejected",
        "responded_at": now_iso(),
    }

