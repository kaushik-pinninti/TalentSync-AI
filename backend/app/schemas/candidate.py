from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
from app.schemas.match import MatchReportOut

class CandidateBase(BaseModel):
    name: str = Field(..., example="Jane Doe")
    email: Optional[EmailStr] = Field(None, example="jane.doe@example.com")
    phone: Optional[str] = Field(None, example="+1-555-0199")
    education_summary: Optional[str] = Field(None, example="B.S. in Computer Science, Stanford University")
    experience_summary: Optional[str] = Field(None, example="3 years as Backend Engineer at Stripe")
    skills: List[str] = Field(default_factory=list, example=["Python", "FastAPI", "SQLAlchemy", "AWS"])
    resume_text: str = Field(..., description="Full raw extracted resume text")
    job_id: Optional[int] = Field(None, description="Optional target job ID for screening")

class CandidateCreate(CandidateBase):
    pass

class CandidatePasteRequest(BaseModel):
    name: str = Field(..., example="Jane Doe")
    text: str = Field(..., example="Full text of resume...")
    job_id: int = Field(..., description="Target job ID for candidate screening")

class CandidateOut(CandidateBase):
    id: int
    recruiter_id: int
    created_at: datetime
    updated_at: datetime
    match_report: Optional[MatchReportOut] = None

    class Config:
        from_attributes = True
