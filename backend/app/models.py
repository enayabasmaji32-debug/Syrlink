"""Pydantic models for request/response validation."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import uuid as _uuid


def uid() -> str:
    return str(_uuid.uuid4())


# ===========================================================================
# User & Profile
# ===========================================================================

class ExperienceItem(BaseModel):
    id: str = Field(default_factory=uid)
    title: str
    company: str
    logo: Optional[str] = None
    type: Optional[str] = "Full-time"
    duration: Optional[str] = ""
    location: Optional[str] = ""
    description: Optional[str] = ""


class EducationItem(BaseModel):
    id: str = Field(default_factory=uid)
    school: str
    logo: Optional[str] = None
    degree: Optional[str] = ""
    duration: Optional[str] = ""


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    cover: Optional[str] = None
    headline: Optional[str] = ""
    location: Optional[str] = ""
    about: Optional[str] = ""
    github: Optional[str] = None
    verified: bool = False
    experience: List[ExperienceItem] = []
    education: List[EducationItem] = []
    skills: List[str] = []
    languages: List[str] = []
    connections: int = 0
    mutual: int = 0
    created_at: Optional[str] = None

    # Suspension/ban fields
    suspended: bool = False
    suspend_reason: Optional[str] = None


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    headline: Optional[str] = Field(default="", max_length=200)


# ===============================
# Admin: Suspend User
# ===============================

class SuspendUserIn(BaseModel):
    reason: str
    headline: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    about: Optional[str] = None
    avatar: Optional[str] = None
    cover: Optional[str] = None
    cv: Optional[str] = None
    github: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    experience: Optional[List[ExperienceItem]] = None
    education: Optional[List[EducationItem]] = None


class VerifyEmailIn(BaseModel):
    user_id: str
    token: str


class VerifyOtpIn(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResendVerificationIn(BaseModel):
    email: EmailStr


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    # API now accepts the reset token (no user_id) and the new password.
    token: str
    new_password: str = Field(min_length=8)


# ===========================================================================
# Posts
# ===========================================================================

class PostIn(BaseModel):
    content: str
    image: Optional[str] = None
    visibility: Optional[str] = "Anyone"
    company_id: Optional[str] = None


class CommentIn(BaseModel):
    text: str
    parent_comment_id: Optional[str] = None  # For threaded comments


class ReactionIn(BaseModel):
    reaction_type: Literal["like", "celebrate", "support", "insightful"] = "like"


class RepostIn(BaseModel):
    comment: Optional[str] = ""


# ===========================================================================
# Connections
# ===========================================================================

class ConnectionRequestIn(BaseModel):
    receiver_id: str
    note: Optional[str] = ""


# ===========================================================================
# Messages
# ===========================================================================

class MessageIn(BaseModel):
    text: str


class ConversationIn(BaseModel):
    user_id: str


# ===========================================================================
# Verification - Global Professional System
# ===========================================================================

class VerificationRequestIn(BaseModel):
    id_front: Optional[str] = None
    document_url: Optional[str] = None
    document_type: Literal["id_front", "id", "experience", "education", "other"]
    id_back: Optional[str] = None
    selfie: Optional[str] = None
    note: Optional[str] = ""


# Global verification stages: Identity Check → Face Match → Under Review → Final Decision
VERIFICATION_STAGES = ["identity_check", "face_match", "under_review", "final_decision"]
VERIFICATION_STATUSES = ["pending", "approved", "rejected"]


# ===========================================================================
# Companies
# ===========================================================================

class CompanyEmployeeItem(BaseModel):
    id: str
    role: str
    name: str
    avatar: Optional[str] = None
    headline: Optional[str] = ""


class CompanyIn(BaseModel):
    name: str
    logo: Optional[str] = None
    cover: Optional[str] = None
    tagline: Optional[str] = ""
    about: Optional[str] = ""
    website: Optional[str] = None
    location: Optional[str] = ""
    industry: Optional[str] = ""
    employees_count: Optional[int] = None
    employees: Optional[List[CompanyEmployeeItem]] = []
    # Investment fields
    is_looking_for_investors: Optional[bool] = False
    valuation: Optional[float] = None
    investment_type: Optional[str] = ""
    funding_amount: Optional[float] = None
    company_status: Optional[str] = ""
    available_equity: Optional[float] = None
    funding_round_status: Optional[str] = ""


class CompanyEmployeeIn(BaseModel):
    user_id: str
    role: str


class EmployeePositionRequestIn(BaseModel):
    """Request to assign a position to an employee within a company."""
    employee_id: str
    position: str
    department: Optional[str] = ""
    description: Optional[str] = ""


class CompanyRequestIn(BaseModel):
    name: str
    industry: str
    registration_number: str
    employees_count: int
    owner_name: str
    ceo_name: str
    website: Optional[str] = None
    location: Optional[str] = ""
    tagline: Optional[str] = ""
    about: Optional[str] = ""
    logo: Optional[str] = None
    cover: Optional[str] = None
    commercial_registry_image: str  # base64 or URL
    # Investment fields
    is_looking_for_investors: Optional[bool] = False
    valuation: Optional[float] = None
    investment_type: Optional[str] = ""
    funding_amount: Optional[float] = None
    company_status: Optional[str] = ""
    available_equity: Optional[float] = None
    funding_round_status: Optional[str] = ""


# ===========================================================================
# Jobs
# ===========================================================================

class JobPostingIn(BaseModel):
    title: str
    company_id: str
    requirements: str
    details: str
    salary: Optional[float] = None
    salary_currency: Optional[Literal["LBP", "USD"]] = "USD"
    location: Optional[str] = ""
    job_type: Optional[str] = "Full-time"


class JobSeekerRequestIn(BaseModel):
    title: str
    skills: List[str]
    qualifications: str
    contact_number: str
    desired_salary: Optional[float] = None
    salary_currency: Optional[Literal["LBP", "USD"]] = "USD"
    location: Optional[str] = ""


# ===========================================================================
# Recommendations & Endorsements
# ===========================================================================

class RecommendationIn(BaseModel):
    user_id: str
    text: str


class EndorsementIn(BaseModel):
    user_id: str
    skill: str


# ===========================================================================
# Reports (abuse reporting)
# ===========================================================================

class ReportIn(BaseModel):
    target_type: Literal["post", "profile", "company", "job", "message"]
    target_id: str
    reason: Literal[
        "abusive_content",
        "harassment",
        "hate_speech",
        "violence_threat",
        "sexual_content",
        "fraud_suspicious_links",
        "impersonation",
        "spam",
        "misinformation",
        "illegal_content",
        "fake_company",
        "fake_job",
        "job_exploitation",
        "misleading_company_info"
    ]
    details: Optional[str] = ""


class ReportResolveIn(BaseModel):
    reason: str = ""


class CompanyRequestDecisionIn(BaseModel):
    action: Literal["approve", "reject"]
    reason: Optional[str] = ""


class JobApplicationDecisionIn(BaseModel):
    action: Literal["accept", "reject"]
    reason: Optional[str] = ""
