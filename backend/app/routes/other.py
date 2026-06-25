"""Verification and admin routes."""
from typing import Annotated, Literal
from fastapi import APIRouter, HTTPException, Depends, Query, status
import time as _t
import datetime
import random

from app.models import VerificationRequestIn, ReportIn, CompanyRequestDecisionIn, SuspendUserIn, ReportResolveIn
from app.security import get_current_user, require_admin
from app.utils import uid, now_iso, create_notification, fetch_user_brief, time_ago
from app.news_utils import rewriteHeadline, summarizePost, detectCategory
from app.database import db
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
import cloudinary.utils
import os

NEWS_CACHE = None
NEWS_CACHE_UPDATED = 0


async def generateSyrLinkNews(limit: int = 10, refresh: bool = False):
    global NEWS_CACHE, NEWS_CACHE_UPDATED
    now = _t.time()
    if NEWS_CACHE and not refresh and (now - NEWS_CACHE_UPDATED) < 3600:
        return NEWS_CACHE

    posts = await db.posts.find(
        {},
        {
            '_id': 0,
            'id': 1,
            'content': 1,
            'created_at': 1,
            'likes_count': 1,
            'comments_count': 1,
            'views': 1,
        },
    ).to_list(500)

    news_items = []
    for post in posts:
        score = post.get('views', 0) + (post.get('likes_count', 0) * 2) + (post.get('comments_count', 0) * 3)
        if score <= 0:
            continue
        title = rewriteHeadline(post.get('content', ''))
        summary = summarizePost(post.get('content', ''))
        category = detectCategory(post.get('content', ''))
        readers = random.randint(5000, 30000)
        relative_time = time_ago(post.get('created_at', ''))
        news_items.append({
            'id': f'news-{post["id"]}',
            'post_id': post['id'],
            'title': title,
            'summary': summary,
            'category': category,
            'readers': readers,
            'relative_time': relative_time,
            'score': score,
        })

    news_items.sort(key=lambda item: item['score'], reverse=True)
    NEWS_CACHE = news_items[:limit]
    NEWS_CACHE_UPDATED = now
    return NEWS_CACHE

# Verification router
verification_router = APIRouter(prefix="/verification", tags=["verification"])

# Admin router
admin_router = APIRouter(prefix="/admin", tags=["admin"])

# يجب أن يكون بعد تعريف admin_router مباشرة
@admin_router.post(
    "/users/{user_id}/suspend",
    responses={404: {"description": "User not found"}},
)
async def admin_suspend_user(
    user_id: str,
    data: SuspendUserIn,
    admin: Annotated[dict, Depends(require_admin)],
):
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


@verification_router.post(
    "/request",
    responses={400: {"description": "You already have a pending verification request"}},
)
async def submit_verification(
    data: VerificationRequestIn,
    current: Annotated[dict, Depends(get_current_user)],
):
    """Submit a verification request."""
    existing = await db.verification_requests.find_one({"user_id": current["id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending verification request")
    
    # Generate global request ID (e.g., VR-2026-05-31-ABC123)
    request_id = f"VR-{uid()[:8].upper()}"
    
    id_front_url = data.id_front or data.document_url
    if not id_front_url:
        raise HTTPException(status_code=400, detail="Missing front ID image URL")
    if not data.id_back or not data.selfie:
        raise HTTPException(status_code=400, detail="Missing ID back or selfie image URL")

    doc = {
        "id": uid(),
        "request_id": request_id,  # Global request ID for tracking
        "user_id": current["id"],
        "id_front": id_front_url,
        "document_url": id_front_url,
        "document_type": data.document_type,
        "id_back": data.id_back,
        "selfie": data.selfie,
        "note": data.note or "",
        "status": "pending",
        "current_stage": "identity_check",  # Global stage: identity_check → face_match → under_review → final_decision
        "stages_completed": [],
        "created_at": now_iso(),
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None,
    }
    await db.verification_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@verification_router.get("/me")
async def my_verification(current: Annotated[dict, Depends(get_current_user)]):
    """Get current user's verification status."""
    req = await db.verification_requests.find_one(
        {"user_id": current["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    return req or {"status": "none"}


@admin_router.get("/stats")
async def admin_stats(admin: Annotated[dict, Depends(require_admin)]):
    """Get platform statistics."""
    return {
        "users": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "jobs": await db.jobs.count_documents({}),
        "verified_users": await db.users.count_documents({"verified": True}),
        "pending_verifications": await db.verification_requests.count_documents({"status": "pending"}),
        "connections": await db.connections.count_documents({"status": "accepted"}),
    }


@admin_router.get(
    "/users",
    responses={404: {"description": "User not found"}},
)
async def admin_list_users(
    admin: Annotated[dict, Depends(require_admin)],
    q: str = "",
):
    """List users (for admin)."""
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return users


@admin_router.post(
    "/users/{user_id}/verify",
    responses={404: {"description": "User not found"}},
)
async def admin_toggle_verify(
    user_id: str,
    admin: Annotated[dict, Depends(require_admin)],
):
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


@admin_router.delete(
    "/users/{user_id}",
    responses={400: {"description": "Cannot delete yourself"}, 404: {"description": "User not found"}},
)
async def admin_delete_user(
    user_id: str,
    admin: Annotated[dict, Depends(require_admin)],
):
    """Delete a user and all related data (for admin)."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await db.posts.delete_many({"author_id": user_id})
    await db.messages.delete_many({"sender_id": user_id})
    await db.conversations.delete_many({"participants": user_id})
    await db.connections.delete_many({"$or": [{"requester_id": user_id}, {"receiver_id": user_id}]})
    await db.followers.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    await db.notifications.delete_many({"$or": [{"user_id": user_id}, {"actor_id": user_id}]})
    await db.job_applications.delete_many({"user_id": user_id})
    await db.job_seeker_requests.delete_many({"user_id": user_id})
    await db.recommendations.delete_many({"$or": [{"from_id": user_id}, {"to_id": user_id}]})
    await db.endorsements.delete_many({"$or": [{"from_id": user_id}, {"user_id": user_id}]})
    await db.reports.delete_many({"reporter_id": user_id})
    await db.verification_requests.delete_many({"user_id": user_id})
    await db.blocked_users.delete_many({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]})
    await db.companies.update_many(
        {"employees.id": user_id},
        {"$pull": {"employees": {"id": user_id}}}
    )
    return {"ok": True}


@admin_router.get(
    "/verification-requests",
    responses={404: {"description": "No verification requests found"}},
)
async def admin_list_verifications(
    admin: Annotated[dict, Depends(require_admin)],
    status: str = "pending",
):
    """List verification requests."""
    reqs = await db.verification_requests.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in reqs:
        u = await fetch_user_brief(r["user_id"])
        r["user"] = u
    return reqs


@admin_router.post(
    "/verification-requests/{req_id}/approve",
    responses={404: {"description": "Request not found"}},
)
async def admin_approve_verification(
    req_id: str,
    admin: Annotated[dict, Depends(require_admin)],
):
    """Approve a verification request."""
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "approved",
            "current_stage": "final_decision",
            "stages_completed": ["identity_check", "face_match", "under_review", "final_decision"],
            "reviewed_at": now_iso(),
            "reviewed_by": admin["id"],
        }},
    )
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"verified": True}})
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text="Your verification request was approved ✓ — you now have a blue badge!", target_id=req_id,
    )
    return {"ok": True}


@admin_router.post(
    "/verification-requests/{req_id}/reject",
    responses={404: {"description": "Request not found"}},
)
async def admin_reject_verification(
    req_id: str,
    admin: Annotated[dict, Depends(require_admin)],
    reason: str = "",
):
    """Reject a verification request."""
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "rejected",
            "reviewed_at": now_iso(),
            "reviewed_by": admin["id"],
            "rejection_reason": reason or "Request did not meet requirements",
        }},
    )
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text=f"Your verification request was reviewed — {reason or 'Please contact support for more info.'}", target_id=req_id,
    )
    return {"ok": True}


@admin_router.post(
    "/verification-requests/{req_id}/stage",
    responses={404: {"description": "Request not found"}},
)
async def admin_update_verification_stage(
    req_id: str,
    new_stage: str,
    admin: Annotated[dict, Depends(require_admin)],
):
    """Update verification request stage."""
    req = await db.verification_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    valid_stages = ["identity_check", "face_match", "under_review", "final_decision"]
    if new_stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    stages_completed = req.get("stages_completed", [])
    if new_stage not in stages_completed:
        stages_completed.append(new_stage)
    
    await db.verification_requests.update_one(
        {"id": req_id},
        {"$set": {
            "current_stage": new_stage,
            "stages_completed": stages_completed,
        }},
    )
    
    stage_labels = {
        "identity_check": "Identity Verification",
        "face_match": "Face Matching",
        "under_review": "Under Review",
        "final_decision": "Final Decision",
    }
    
    await create_notification(
        user_id=req["user_id"], actor_id=admin["id"], ntype="verification",
        text=f"Your verification request is now at: {stage_labels.get(new_stage, new_stage)}", target_id=req_id,
    )
    return {"ok": True, "stage": new_stage}


@admin_router.get(
    "/company-requests",
    responses={404: {"description": "No company requests found"}},
)
async def admin_list_company_requests(
    admin: Annotated[dict, Depends(require_admin)],
    status: str = "pending",
):
    """List company creation requests."""
    reqs = await db.company_requests.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in reqs:
        u = await fetch_user_brief(r["user_id"])
        r["user"] = u
    return reqs


@admin_router.post(
    "/company-requests/{req_id}/decide",
    responses={
        404: {"description": "Company request not found"},
        500: {"description": "Server error while processing company decision"},
    },
)
async def admin_decide_company(
    req_id: str,
    data: CompanyRequestDecisionIn,
    admin: Annotated[dict, Depends(require_admin)],
):
    """Approve or reject a company creation request."""
    try:
        req = await db.company_requests.find_one({"id": req_id})
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company request not found")
        
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error: {str(e)}")


@admin_router.post(
    "/company-requests/{req_id}/approve",
    responses={
        404: {"description": "Company request not found"},
        500: {"description": "Server error while approving company request"},
    },
)
async def admin_approve_company(req_id: str, admin: Annotated[dict, Depends(require_admin)]):
    """Approve a company creation request (legacy endpoint)."""
    return await admin_decide_company(req_id, CompanyRequestDecisionIn(action="approve"), admin)


@admin_router.post(
    "/company-requests/{req_id}/reject",
    responses={
        404: {"description": "Company request not found"},
        500: {"description": "Server error while rejecting company request"},
    },
)
async def admin_reject_company(req_id: str, admin: Annotated[dict, Depends(require_admin)]):
    """Reject a company creation request (legacy endpoint)."""
    return await admin_decide_company(req_id, CompanyRequestDecisionIn(action="reject"), admin)


# Reports router
reports_router = APIRouter(prefix="/reports", tags=["reports"])


@reports_router.post("/")
async def create_report(data: ReportIn, current: Annotated[dict, Depends(get_current_user)]):
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


@reports_router.get(
    "/",
    responses={404: {"description": "Report not found"}},
)
async def get_reports(admin: Annotated[dict, Depends(require_admin)], status: str = "pending"):
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

@reports_router.post(
    "/{report_id}/resolve",
    responses={
        404: {"description": "Report not found"},
        500: {"description": "Server error while resolving report"},
    },
)
async def resolve_report(
    report_id: str,
    admin: Annotated[dict, Depends(require_admin)],
    action: str = "dismiss",
    data: ReportResolveIn = None,
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
async def my_company_requests(current: Annotated[dict, Depends(get_current_user)]):
    """Get current user's company requests and their status."""
    reqs = await db.company_requests.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return reqs


# Utility routes
util_router = APIRouter(tags=["utilities"])


@util_router.get("/news")
async def news():
    """Get news feed based on top circulating posts."""
    return await generateSyrLinkNews()


@admin_router.get("/companies")
async def admin_list_companies(admin: Annotated[dict, Depends(require_admin)], status: str = "approved"):
    """List companies (for admin). Default shows approved companies."""
    query = {"status": status} if status else {}
    companies = await db.companies.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return companies


@admin_router.delete(
    "/companies/{company_id}",
    responses={
        404: {"description": "Company not found"},
        500: {"description": "Server error while deleting company"},
    },
)
async def admin_delete_company(company_id: str, admin: Annotated[dict, Depends(require_admin)]):
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


@util_router.get(
    "/cloudinary/signature",
    responses={400: {"description": "Invalid folder path or resource type"}},
)
async def cloudinary_signature(
    current: Annotated[dict, Depends(get_current_user)],
    folder: Annotated[str, Query] = Query("uploads/"),
    resource_type: Annotated[str, Query] = Query("image"),
):
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
