from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.analytics import DashboardStats, ScoreDistribution, ActivityLogOut
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.match import MatchReport
from app.models.activity_log import ActivityLog
from app.repositories.activity_log import ActivityLogRepository
from app.routes.dependencies import get_current_user
from app.models.user import User
from typing import List

router = APIRouter(prefix="/analytics", tags=["Analytics and Auditing"])

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve aggregated pipeline metrics, score distributions, and recent audit logs.
    """
    # 1. Total active job counts
    total_jobs = db.query(Job).filter(Job.recruiter_id == current_user.id, Job.is_archived == False).count()
    
    # 2. Total candidate profiles screened
    total_candidates = db.query(Candidate).filter(Candidate.recruiter_id == current_user.id).count()
    
    # 3. Retrieve all match reports for average and distributions
    reports = db.query(MatchReport).join(Candidate).filter(Candidate.recruiter_id == current_user.id).all()
    
    average_match_score = 0.0
    if reports:
        total_score = sum(report.overall_score for report in reports)
        average_match_score = round(total_score / len(reports), 1)
        
    # 4. Score distribution bands
    bands = {
        "90-100 (Strong Fit)": 0,
        "80-89 (High Match)": 0,
        "70-79 (Moderate Fit)": 0,
        "50-69 (Needs Evaluation)": 0,
        "0-49 (Unmatched)": 0
    }
    
    for report in reports:
        score = report.overall_score
        if 90 <= score <= 100:
            bands["90-100 (Strong Fit)"] += 1
        elif 80 <= score < 90:
            bands["80-89 (High Match)"] += 1
        elif 70 <= score < 80:
            bands["70-79 (Moderate Fit)"] += 1
        elif 50 <= score < 70:
            bands["50-69 (Needs Evaluation)"] += 1
        else:
            bands["0-49 (Unmatched)"] += 1
            
    distribution = [
        ScoreDistribution(range=key, count=val) for key, val in bands.items()
    ]
    
    # 5. Fetch recent recruiter activity audit logs
    recent_logs = ActivityLogRepository.get_recent_audit_logs(db, user_id=current_user.id, limit=10)
    recent_logs_out = [
        ActivityLogOut.model_validate(log) for log in recent_logs
    ]
    
    return DashboardStats(
        total_jobs=total_jobs,
        total_candidates=total_candidates,
        average_match_score=average_match_score,
        match_distribution=distribution,
        recent_activity=recent_logs_out
    )

@router.get("/activity-logs", response_model=List[ActivityLogOut])
def get_activity_audit_logs(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve full historical user activity and system audit logs for security transparency.
    """
    logs = ActivityLogRepository.list_by_user(db, user_id=current_user.id, limit=limit)
    return [ActivityLogOut.model_validate(log) for log in logs]
