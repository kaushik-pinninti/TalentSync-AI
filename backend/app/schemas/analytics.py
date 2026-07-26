from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class ActivityLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    details: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ScoreDistribution(BaseModel):
    range: str # e.g. "90-100", "80-89"
    count: int

class DashboardStats(BaseModel):
    total_jobs: int = Field(..., description="Total active job openings")
    total_candidates: int = Field(..., description="Total screened applicants")
    average_match_score: float = Field(..., description="Average match score across all pipeline candidates")
    match_distribution: List[ScoreDistribution] = Field(..., description="Distribution of match scores for metrics visualization")
    recent_activity: List[ActivityLogOut] = Field(default_factory=list, description="Recent audit logs of recruiter actions")

class QuestionsRequest(BaseModel):
    candidate_id: int
    count: int = Field(5, ge=1, le=15, description="Number of questions to generate (1-15)")

class QuestionOut(BaseModel):
    question: str
    expected_answer: str
    category: str # e.g., "Technical", "Behavioral", "Problem Solving"

class QuestionsResponse(BaseModel):
    candidate_name: str
    job_title: str
    questions: List[QuestionOut]
