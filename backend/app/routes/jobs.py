from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.job import JobCreate, JobUpdate, JobOut
from app.repositories.job import JobRepository
from app.repositories.activity_log import ActivityLogRepository
from app.routes.dependencies import get_current_user
from app.models.user import User
from typing import List

router = APIRouter(prefix="/jobs", tags=["Jobs Management"])

@router.get("/", response_model=List[JobOut])
def list_jobs(
    include_archived: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all job roles created by the authenticated recruiter.
    """
    return JobRepository.list_by_recruiter(db, recruiter_id=current_user.id, include_archived=include_archived)

@router.post("/", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    job_in: JobCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new job posting role.
    """
    job = JobRepository.create(db, job_in, recruiter_id=current_user.id)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="CREATE_JOB",
        details=f"Created job role: '{job.title}' (ID: {job.id})",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return job

@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve specific job posting details.
    """
    job = JobRepository.get_by_id_and_recruiter(db, job_id=job_id, recruiter_id=current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found or unauthorized access"
        )
    return job

@router.put("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    job_in: JobUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a specific job posting details.
    """
    job = JobRepository.get_by_id_and_recruiter(db, job_id=job_id, recruiter_id=current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found or unauthorized access"
        )
        
    updated_job = JobRepository.update(db, db_job=job, job_in=job_in)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="UPDATE_JOB",
        details=f"Updated job role: '{updated_job.title}' (ID: {updated_job.id})",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return updated_job

@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_job(
    job_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific job posting. This recursively deletes all associated candidates and matches.
    """
    job = JobRepository.get_by_id_and_recruiter(db, job_id=job_id, recruiter_id=current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found or unauthorized access"
        )
        
    JobRepository.delete(db, db_job=job)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="DELETE_JOB",
        details=f"Deleted job role ID: {job_id} (Title: '{job.title}')",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"success": True, "message": "Job posting and related records deleted."}
