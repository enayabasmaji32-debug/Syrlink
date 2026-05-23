"""Jobs and career routes."""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends

from app.models import JobPostingIn, JobSeekerRequestIn, JobApplicationDecisionIn
from app.security import get_current_user
from app.utils import uid, now_iso, time_ago, create_notification
from app.database import db

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(q: Optional[str] = None, location: Optional[str] = None, current=Depends(get_current_user)):
    """List jobs with optional filtering."""
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"skills": {"$regex": q, "$options": "i"}},
        ]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    jobs = await db.jobs.find(query, {"_id": 0}).sort("posted_at", -1).to_list(200)
    for j in jobs:
        j["postedAgo"] = time_ago(j.get("posted_at", now_iso()))
        j["applicants"] = j.get("applicants_count", 0)
        j["easyApply"] = j.get("easy_apply", True)
    return jobs


@router.get("/me/saved")
async def saved_jobs(current=Depends(get_current_user)):
    """Get saved jobs for current user."""
    apps = await db.job_applications.find(
        {"user_id": current["id"], "status": "saved"}, {"_id": 0, "job_id": 1}
    ).to_list(500)
    return [a["job_id"] for a in apps]


@router.get("/me/applied")
async def applied_jobs(current=Depends(get_current_user)):
    """Get applied jobs for current user."""
    apps = await db.job_applications.find(
        {"user_id": current["id"], "status": "applied"}, {"_id": 0, "job_id": 1}
    ).to_list(500)
    return [a["job_id"] for a in apps]


@router.get("/{job_id}")
async def get_job(job_id: str, current=Depends(get_current_user)):
    """Get a single job details."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["postedAgo"] = time_ago(job.get("posted_at", now_iso()))
    job["applicants"] = job.get("applicants_count", 0)
    job["easyApply"] = job.get("easy_apply", True)
    return job


@router.post("/{job_id}/apply")
async def apply_job(job_id: str, current=Depends(get_current_user)):
    """Apply to a job with CV."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    user = await db.users.find_one({"id": current["id"]})
    cv_url = user.get("cv", "") if user else ""
    
    existing = await db.job_applications.find_one({"job_id": job_id, "user_id": current["id"]})
    if existing:
        await db.job_applications.update_one(
            {"_id": existing["_id"]}, 
            {"$set": {"status": "applied", "cv_url": cv_url, "applied_at": now_iso()}}
        )
    else:
        await db.job_applications.insert_one({
            "id": uid(),
            "job_id": job_id,
            "user_id": current["id"],
            "status": "applied",
            "cv_url": cv_url,
            "applicant_name": current.get("name", ""),
            "applicant_email": current.get("email", ""),
            "created_at": now_iso(),
            "applied_at": now_iso(),
        })
        await db.jobs.update_one({"id": job_id}, {"$inc": {"applicants_count": 1}})
        
        # إشعار لصاحب الوظيفة
        await create_notification(
            user_id=job["posted_by"],
            actor_id=current["id"],
            ntype="job_application",
            text=f"{current.get('name', 'Someone')} applied to {job['title']}",
            target_id=job_id
        )
    
    return {"ok": True, "status": "applied"}


@router.post("/{job_id}/save")
async def save_job(job_id: str, current=Depends(get_current_user)):
    """Save or unsave a job."""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    existing = await db.job_applications.find_one({"job_id": job_id, "user_id": current["id"], "status": "saved"})
    if existing:
        await db.job_applications.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    
    await db.job_applications.insert_one({
        "id": uid(),
        "job_id": job_id,
        "user_id": current["id"],
        "status": "saved",
        "created_at": now_iso(),
    })
    return {"saved": True}


# ============================================================================
# Job Postings (Companies posting jobs)
# ============================================================================

@router.post("/postings")
async def create_job_posting(data: JobPostingIn, current=Depends(get_current_user)):
    """Create a job posting (company representatives only)."""
    # Verify company exists
    company = await db.companies.find_one({"id": data.company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if user is admin or company representative
    # For now, allow any logged-in user to post; you can add company_id to users later
    
    doc = {
        "id": uid(),
        "company_id": data.company_id,
        "company_name": company.get("name", ""),
        "company_logo": company.get("logo", ""),
        "title": data.title,
        "requirements": data.requirements,
        "details": data.details,
        "salary": data.salary,
        "salary_currency": data.salary_currency or "USD",
        "location": data.location or "",
        "job_type": data.job_type or "Full-time",
        "posted_by": current["id"],
        "posted_at": now_iso(),
        "applicants_count": 0,
        "type": "company_posting",
    }
    await db.jobs.insert_one(doc)
    
    doc.pop("_id", None)
    return doc


@router.get("/postings/{company_id}")
async def get_company_postings(company_id: str, current=Depends(get_current_user)):
    """Get all job postings by a company."""
    postings = await db.jobs.find(
        {"company_id": company_id, "type": "company_posting"}, {"_id": 0}
    ).sort("posted_at", -1).to_list(100)
    
    for p in postings:
        p["postedAgo"] = time_ago(p.get("posted_at", now_iso()))
    
    return postings


# ============================================================================
# Job Seeker Requests
# ============================================================================

@router.post("/seeker-requests")
async def create_seeker_request(data: JobSeekerRequestIn, current=Depends(get_current_user)):
    """Create a job seeker request."""
    doc = {
        "id": uid(),
        "user_id": current["id"],
        "user_name": current["name"],
        "user_avatar": current.get("avatar", ""),
        "title": data.title,
        "skills": data.skills,
        "qualifications": data.qualifications,
        "contact_number": data.contact_number,
        "desired_salary": data.desired_salary,
        "salary_currency": data.salary_currency or "USD",
        "location": data.location or "",
        "created_at": now_iso(),
        "type": "seeker_request",
        "active": True,
    }
    await db.job_seeker_requests.insert_one(doc)
    
    doc.pop("_id", None)
    return doc


@router.get("/seeker-requests")
async def list_seeker_requests(q: Optional[str] = None, current=Depends(get_current_user)):
    """List active job seeker requests."""
    query = {"active": True}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"skills": {"$regex": q, "$options": "i"}},
        ]
    
    requests = await db.job_seeker_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for r in requests:
        r["postedAgo"] = time_ago(r.get("created_at", now_iso()))
    
    return requests


@router.get("/seeker-requests/me")
async def my_seeker_requests(current=Depends(get_current_user)):
    """Get current user's job seeker requests."""
    requests = await db.job_seeker_requests.find(
        {"user_id": current["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@router.put("/seeker-requests/{request_id}")
async def update_seeker_request(request_id: str, data: JobSeekerRequestIn, current=Depends(get_current_user)):
    """Update a job seeker request."""
    req = await db.job_seeker_requests.find_one({"id": request_id})
    if not req or req["user_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    
    update_data = {
        "title": data.title,
        "skills": data.skills,
        "qualifications": data.qualifications,
        "contact_number": data.contact_number,
        "desired_salary": data.desired_salary,
        "salary_currency": data.salary_currency or "USD",
        "location": data.location or "",
    }
    
    await db.job_seeker_requests.update_one({"id": request_id}, {"$set": update_data})
    updated = await db.job_seeker_requests.find_one({"id": request_id}, {"_id": 0})
    return updated


@router.delete("/seeker-requests/{request_id}")
async def delete_seeker_request(request_id: str, current=Depends(get_current_user)):
    """Delete a job seeker request."""
    req = await db.job_seeker_requests.find_one({"id": request_id})
    if not req or req["user_id"] != current["id"]:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.job_seeker_requests.delete_one({"id": request_id})
    return {"ok": True}


# ============================================================================
# Job Applications Management (للشركات لعرض وإدارة المتقدمين)
# ============================================================================

@router.get("/posting/{job_id}/applicants")
async def get_job_applicants(job_id: str, current=Depends(get_current_user)):
    """Get all applicants for a job posting (only job poster can access)."""
    job = await db.jobs.find_one({"id": job_id})
    if not job or job["posted_by"] != current["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    applications = await db.job_applications.find(
        {"job_id": job_id, "status": "applied"}, {"_id": 0}
    ).sort("applied_at", -1).to_list(500)
    
    # Enrich with user info
    result = []
    for app in applications:
        user = await db.users.find_one({"id": app["user_id"]}, {"_id": 0, "name": 1, "avatar": 1, "email": 1, "headline": 1})
        result.append({
            **app,
            "applicant": user or {"id": app["user_id"], "name": "Unknown", "avatar": "", "email": app.get("applicant_email", "")},
        })
    
    return result


@router.post("/application/{application_id}/decide")
async def decide_application(application_id: str, data: dict, current=Depends(get_current_user)):
    """Accept or reject an application (only job poster can decide)."""
    from app.models import JobApplicationDecisionIn
    
    app = await db.job_applications.find_one({"id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    job = await db.jobs.find_one({"id": app["job_id"]})
    if not job or job["posted_by"] != current["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    action = data.get("action", "reject")
    reason = data.get("reason", "")
    
    # تحديث حالة التطبيق
    new_status = "accepted" if action == "accept" else "rejected"
    await db.job_applications.update_one(
        {"id": application_id},
        {"$set": {"status": new_status, "decided_at": now_iso(), "decision_reason": reason}}
    )
    
    # إرسال إشعار للمتقدم
    notification_text = ""
    notification_type = ""
    
    if action == "accept":
        notification_text = f"تم قبول طلبك للوظيفة: {job['title']}"
        notification_type = "application_accepted"
    else:
        notification_text = f"تم رفض طلبك للوظيفة: {job['title']}"
        if reason:
            notification_text += f". السبب: {reason}"
        notification_type = "application_rejected"
    
    await create_notification(
        user_id=app["user_id"],
        actor_id=current["id"],
        ntype=notification_type,
        text=notification_text,
        target_id=app["job_id"]
    )
    
    return {"ok": True, "status": new_status}
