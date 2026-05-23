"""Verification and admin routes."""
from typing import Literal
from fastapi import APIRouter, HTTPException, Depends, Query
import time as _t

from app.models import VerificationRequestIn, ReportIn, CompanyRequestDecisionIn, SuspendUserIn, ReportResolveIn
from app.security import get_current_user, require_admin
from app.utils import uid, now_iso, create_notification, fetch_user_brief
from app.database import db
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
import cloudinary.utils
import os

# Verification router
verification_router = APIRouter(prefix="/verification", tags=["verification"])

# Admin router
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# يجب أن يكون بعد تعريف admin_router مباشرة
@admin_router.post("/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, data: SuspendUserIn, admin=Depends(require_admin)):
    """Suspend (ban) a user with a reason."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"suspended": True, "suspend_reason": data.reason}})
    await create_notification(
        user_id=user_id,
        actor_id=admin["id"],
        ntype="account_suspended",
        text=f"تم تعليق حسابك: {data.reason}",
        target_id=user_id,
    )
    return {"ok": True, "suspended": True}
from app.security import get_current_user, require_admin
from app.utils import uid, now_iso, create_notification, fetch_user_brief
from app.database import db
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
import cloudinary.utils
import os

# Verification router
verification_router = APIRouter(prefix="/verification", tags=["verification"])


@verification_router.post("/request")
async def submit_verification(data: VerificationRequestIn, current=Depends(get_current_user)):
    """Submit a verification request."""
    existing = await db.verification_requests.find_one({"user_id": current["id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending verification request")
    
    doc = {
        "id": uid(),
        "user_id": current["id"],
        "document_url": data.document_url,
        "document_type": data.document_type,
        "note": data.note or "",
        "status": "pending",
        "created_at": now_iso(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.verification_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@verification_router.get("/me")
async def my_verification(current=Depends(get_current_user)):
    """Get current user's verification status."""
    req = await db.verification_requests.find_one(
        {"user_id": current["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return req or {"status": "none"}


# Admin router
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/stats")
async def admin_stats(admin=Depends(require_admin)):
    """Get platform statistics."""
    return {
        "users": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "jobs": await db.jobs.count_documents({}),
        "verified_users": await db.users.count_documents({"verified": True}),
        "pending_verifications": await db.verification_requests.count_documents({"status": "pending"}),
        "connections": await db.connections.count_documents({"status": "accepted"}),
    }


@admin_router.get("/users")
async def admin_list_users(q: str = "", admin=Depends(require_admin)):
    """List users (for admin)."""
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return users


@admin_router.post("/users/{user_id}/verify")
async def admin_toggle_verify(user_id: str, admin=Depends(require_admin)):
    """Toggle verification status for a user."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_val = not user.get("verified", False)
    await db.users.update_one({"id": user_id}, {"$set": {"verified": new_val}})
    if new_val:
        await create_notification(
            user_id=user_id, actor_id=admin["id"], ntype="verification",
            text="Your account has been verified ✓", target_id=user_id,
        )
    return {"verified": new_val}


@admin_router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, admin=Depends(require_admin)):
    """Delete a user (for admin)."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await db.posts.delete_many({"author_id": user_id})
    return {"ok": True}


@admin_router.get("/verification-requests")
async def admin_list_verifications(status: str = "pending", admin=Depends(require_admin)):
    """List verification requests."""
    reqs = await db.verification_requests.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in reqs:
        u = await fetch_user_brief(r["user_id"])
        r["user"] = u
    return reqs


@admin_router.post("/verification-requests/{req_id}/approve")
async def admin_approve_verification(req_id: str, admin=Depends(require_admin)):
    """Approve a verification request."""
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "approved", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"verified": True}})
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text="Your verification request was approved ✓ — you now have a blue badge!", target_id=req_id,
    )
    return {"ok": True}


@admin_router.post("/verification-requests/{req_id}/reject")
async def admin_reject_verification(req_id: str, admin=Depends(require_admin)):
    """Reject a verification request."""
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "rejected", "reviewed_at": now_iso(), "reviewed_by": admin["id"]}},
    )
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text="Your verification request was reviewed — please contact support for more info.", target_id=req_id,
    )
    return {"ok": True}


@admin_router.get("/company-requests")
async def admin_list_company_requests(status: str = "pending", admin=Depends(require_admin)):
    """List company creation requests."""
    reqs = await db.company_requests.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in reqs:
        u = await fetch_user_brief(r["user_id"])
        r["user"] = u
    return reqs


@admin_router.post("/company-requests/{req_id}/decide")
async def admin_decide_company(req_id: str, data: CompanyRequestDecisionIn, admin=Depends(require_admin)):
    """Approve or reject a company creation request."""
    try:
        req = await db.company_requests.find_one({"id": req_id})
        if not req:
            raise HTTPException(status_code=404, detail="Company request not found")
        
        if data.action == "approve":
            # Create the company
            company = {
                "id": uid(),
                "user_id": req["user_id"],
                "name": req["name"],
                "industry": req["industry"],
                "location": req.get("location", ""),
                "website": req.get("website", ""),
                "about": req.get("about", ""),
                "employees_count": req["employees_count"],
                "logo": req.get("logo") or f"https://api.dicebear.com/7.x/initials/svg?seed={req['name']}",
                "cover": req.get("cover", ""),
                "registration_number": req["registration_number"],
                "owner_name": req["owner_name"],
                "ceo_name": req["ceo_name"],
                "commercial_registry_image": req["commercial_registry_image"],
                "is_looking_for_investors": req.get("is_looking_for_investors", False),
                "valuation": req.get("valuation"),
                "investment_type": req.get("investment_type", ""),
                "funding_amount": req.get("funding_amount"),
                "company_status": req.get("company_status", ""),
                "available_equity": req.get("available_equity"),
                "funding_round_status": req.get("funding_round_status", ""),
                "status": "approved",
                "employees": [],
                "created_at": now_iso(),
            }
            await db.companies.insert_one(company)
            
            # Update request status
            await db.company_requests.update_one(
                {"id": req_id},
                {"$set": {
                    "status": "approved",
                    "reviewed_at": now_iso(),
                    "reviewed_by": admin["id"],
                    "decision_reason": data.reason or ""
                }},
            )
            
            # Notify user
            await create_notification(
                user_id=req["user_id"],
                actor_id=admin["id"],
                ntype="company_approved",
                text=f"✓ شركتك '{req['name']}' تم الموافقة عليها!",
                target_id=company["id"],
            )
            return {"ok": True, "status": "approved"}
        
        else:  # reject
            await db.company_requests.update_one(
                {"id": req_id},
                {"$set": {
                    "status": "rejected",
                    "reviewed_at": now_iso(),
                    "reviewed_by": admin["id"],
                    "decision_reason": data.reason or "تم رفض الطلب"
                }},
            )
            
            await create_notification(
                user_id=req["user_id"],
                actor_id=admin["id"],
                ntype="company_rejected",
                text=f"تم رفض طلب شركتك '{req['name']}'. السبب: {data.reason or 'معلومات غير كاملة'}",
                target_id=req_id,
            )
            return {"ok": True, "status": "rejected"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@admin_router.post("/company-requests/{req_id}/approve")
async def admin_approve_company(req_id: str, admin=Depends(require_admin)):
    """Approve a company creation request (legacy endpoint)."""
    return await admin_decide_company(req_id, CompanyRequestDecisionIn(action="approve"), admin)


@admin_router.post("/company-requests/{req_id}/reject")
async def admin_reject_company(req_id: str, admin=Depends(require_admin)):
    """Reject a company creation request (legacy endpoint)."""
    return await admin_decide_company(req_id, CompanyRequestDecisionIn(action="reject"), admin)


# Reports router
reports_router = APIRouter(prefix="/reports", tags=["reports"])


@reports_router.post("/")
async def create_report(data: ReportIn, current=Depends(get_current_user)):
    """Submit an abuse report."""
    report = {
        "id": uid(),
        "reporter_id": current["id"],
        "target_type": data.target_type,
        "target_id": data.target_id,
        "reason": data.reason,
        "details": data.details or "",
        "status": "pending",
        "created_at": now_iso(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.reports.insert_one(report)
    report.pop("_id", None)
    return {"ok": True, "report_id": report["id"]}


@reports_router.get("/")
async def get_reports(status: str = "pending", admin=Depends(require_admin)):
    """Get reports (admin only)."""
    query = {"status": status} if status else {}
    reports = await db.reports.find(query, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    
    # Enrich reports with target and reporter info
    for r in reports:
        r["reporter"] = await fetch_user_brief(r["reporter_id"])
        
        if r["target_type"] == "post":
            target = await db.posts.find_one({"id": r["target_id"]}, {"_id": 0})
            if target:
                target["author"] = await fetch_user_brief(target.get("author_id"))
                r["target"] = target
        elif r["target_type"] == "profile":
            r["target"] = await fetch_user_brief(r["target_id"])
        elif r["target_type"] == "company":
            r["target"] = await db.companies.find_one({"id": r["target_id"]}, {"_id": 0})
        elif r["target_type"] == "job":
            r["target"] = await db.jobs.find_one({"id": r["target_id"]}, {"_id": 0})
    
    return reports



# دعم تعليق المستخدم ورفض البلاغ مع سبب وإشعارات

@reports_router.post("/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    action: str = "dismiss",
    data: ReportResolveIn = None,
    admin=Depends(require_admin)
):
    """Resolve a report (admin only). action: dismiss, remove_content, remove_user, suspend, reject"""
    reason = data.reason if data else ""
    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.reports.update_one(
        {"id": report_id},
        {"$set": {"status": "resolved", "reviewed_at": now_iso(), "reviewed_by": admin["id"], "resolve_reason": reason}}
    )

    # إشعار لصاحب البلاغ
    if action == "remove_content":
        # حذف منشور أو شركة
        if report["target_type"] == "post":
            await db.posts.delete_one({"id": report["target_id"]})
        elif report["target_type"] == "company":
            await db.companies.delete_one({"id": report["target_id"]})
        await create_notification(
            user_id=report["reporter_id"],
            actor_id=admin["id"],
            ntype="report_accepted",
            text="شكرًا، تم حذف المحتوى المبلغ عنه.",
            target_id=report["target_id"]
        )
    elif action == "suspend":
        # تعليق المستخدم المستهدف
        await db.users.update_one({"id": report["target_id"]}, {"$set": {"suspended": True, "suspend_reason": reason}})
        await create_notification(
            user_id=report["target_id"],
            actor_id=admin["id"],
            ntype="account_suspended",
            text=f"تم تعليق حسابك: {reason}",
            target_id=report["target_id"]
        )
        await create_notification(
            user_id=report["reporter_id"],
            actor_id=admin["id"],
            ntype="report_accepted",
            text="تم تعليق الحساب المبلغ عنه.",
            target_id=report["target_id"]
        )
    elif action == "reject":
        # رفض البلاغ مع سبب
        await create_notification(
            user_id=report["reporter_id"],
            actor_id=admin["id"],
            ntype="report_rejected",
            text=f"تم رفض البلاغ: {reason}",
            target_id=report["target_id"]
        )
    elif action == "dismiss":
        # تجاهل البلاغ مع سبب - إرسال إشعار للمستخدم المبلغ
        await create_notification(
            user_id=report["reporter_id"],
            actor_id=admin["id"],
            ntype="report_rejected",
            text=f"تم رفض البلاغ. السبب: {reason}" if reason else "تم رفض البلاغ.",
            target_id=report["target_id"]
        )
    elif action == "remove_user":
        await db.users.delete_one({"id": report["target_id"]})
        await create_notification(
            user_id=report["reporter_id"],
            actor_id=admin["id"],
            ntype="report_accepted",
            text="تم حذف الحساب المبلغ عنه.",
            target_id=report["target_id"]
        )
    return {"ok": True}


# Company requests for users
companies_requests_router = APIRouter(prefix="/company-requests", tags=["companies"])


@companies_requests_router.get("/me")
async def my_company_requests(current=Depends(get_current_user)):
    """Get current user's company requests and their status."""
    reqs = await db.company_requests.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return reqs


# Utility routes
util_router = APIRouter(tags=["utilities"])


@util_router.get("/news")
async def news():
    """Get news feed."""
    return [
        {"id": "nw1", "title": "إعادة إعمار سوريا تبدأ بمشاريع تقنية ضخمة", "meta": "4h ago · 12,453 readers"},
        {"id": "nw2", "title": "ارتفاع الطلب على المهندسين السوريين عن بُعد", "meta": "6h ago · 8,221 readers"},
        {"id": "nw3", "title": "Damascus emerging as MENA's new tech hub", "meta": "1d ago · 5,109 readers"},
        {"id": "nw4", "title": "أبرز الشركات الناشئة في حلب لعام 2026", "meta": "1d ago · 14,322 readers"},
        {"id": "nw5", "title": "SyrLink hits 100K users in first month", "meta": "2d ago · 22,540 readers"},
    ]


@admin_router.get("/companies")
async def admin_list_companies(status: str = "approved", admin=Depends(require_admin)):
    """List companies (for admin). Default shows approved companies."""
    query = {"status": status} if status else {}
    companies = await db.companies.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return companies


@admin_router.delete("/companies/{company_id}")
async def admin_delete_company(company_id: str, admin=Depends(require_admin)):
    """Delete a company (for admin)."""
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Delete company
    await db.companies.delete_one({"id": company_id})
    
    # Delete associated job postings
    await db.jobs.delete_many({"company_id": company_id})
    
    # Create notification to company creator
    await create_notification(
        user_id=company.get("user_id") or company.get("founder_id"),
        actor_id=admin["id"],
        ntype="company_deleted",
        text=f"Your company '{company['name']}' has been removed.",
        target_id=company_id,
    ) if (company.get("user_id") or company.get("founder_id")) else None
    
    return {"ok": True}


@util_router.get("/cloudinary/signature")
async def cloudinary_signature(folder: str = Query("uploads/"), resource_type: str = Query("image"), current=Depends(get_current_user)):
    """Get Cloudinary signed upload credentials."""
    allowed_prefixes = ("users/", "posts/", "uploads/", "verification/", "companies/")
    
    # Normalize folder path
    folder = folder.strip()
    if not folder.endswith("/"):
        folder += "/"
    
    # Check if folder starts with any allowed prefix
    is_allowed = any(folder.startswith(prefix) for prefix in allowed_prefixes)
    if not is_allowed:
        raise HTTPException(status_code=400, detail=f"Invalid folder path: {folder}")
    
    # Validate resource_type
    if resource_type not in ("image", "video", "auto"):
        raise HTTPException(status_code=400, detail="Invalid resource_type")
    
    timestamp = int(_t.time())
    # Only include timestamp and folder in signature params - resource_type is optional
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET)
    return {
        "signature": signature, 
        "timestamp": timestamp,
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "folder": folder, 
        "resource_type": resource_type,
    }


@util_router.get("/")
async def root():
    """API health check."""
    return {"name": "SyrLink API", "status": "ok"}
