from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

class MatchReportBase(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    skills_match_score: int = Field(..., ge=0, le=100)
    experience_match_score: int = Field(..., ge=0, le=100)
    education_match_score: int = Field(..., ge=0, le=100)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    summary: str
    recommendation: str
    explanation: str

class MatchReportOut(MatchReportBase):
    id: int
    candidate_id: int
    job_id: int
    created_at: datetime

    class Config:
        from_attributes = True
