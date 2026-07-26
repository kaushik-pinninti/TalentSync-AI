from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.candidate import CandidateCreate, CandidateOut, CandidatePasteRequest
from app.schemas.match import MatchReportBase
from app.repositories.candidate import CandidateRepository
from app.repositories.job import JobRepository
from app.repositories.activity_log import ActivityLogRepository
from app.services.gemini_service import GeminiService
from app.utils.parser import DocumentParser
from app.routes.dependencies import get_current_user
from app.models.user import User
from typing import List, Optional

router = APIRouter(prefix="/candidates", tags=["Candidates Management"])

@router.get("/", response_model=List[CandidateOut])
def list_candidates(
    job_id: Optional[int] = None,
    search: Optional[str] = None,
    min_score: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all candidates with options for job filtering, search, and minimum match score.
    """
    return CandidateRepository.list_by_recruiter(
        db, 
        recruiter_id=current_user.id, 
        job_id=job_id, 
        search_query=search, 
        min_score=min_score
    )

@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(
    candidate_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve candidate profile details, parsed skills, education summary, and associated AI match reports.
    """
    candidate = CandidateRepository.get_by_id_and_recruiter(db, candidate_id=candidate_id, recruiter_id=current_user.id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found or unauthorized access"
        )
    return candidate

@router.post("/paste", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def paste_candidate(
    payload: CandidatePasteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Onboard a candidate by pasting their raw resume text directly.
    If a job_id is supplied, the profile will automatically run matching against the job specs.
    """
    # 1. Verify Job exists and belongs to the recruiter
    job = JobRepository.get_by_id_and_recruiter(db, job_id=payload.job_id, recruiter_id=current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target job opening not found or unauthorized"
        )
        
    # 2. Extract structured profile using Gemini Parser
    try:
        parsed_resume = GeminiService.parse_resume(payload.text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini resume parsing failed: {str(e)}"
        )
        
    # 3. Create Candidate
    candidate_in = CandidateCreate(
        name=payload.name if payload.name else parsed_resume.name,
        email=parsed_resume.email,
        phone=parsed_resume.phone,
        education_summary=parsed_resume.education_summary,
        experience_summary=parsed_resume.experience_summary,
        skills=parsed_resume.skills,
        resume_text=payload.text,
        job_id=payload.job_id
    )
    
    candidate = CandidateRepository.create(db, candidate_in, recruiter_id=current_user.id)
    
    # 4. Compile AI Match Report
    try:
        match_res = GeminiService.match_candidate(
            resume_text=payload.text,
            job_title=job.title,
            job_description=job.description,
            job_skills=job.skills
        )
        
        # Save matching scores in DB
        report_in = MatchReportBase(
            overall_score=match_res.overall_score,
            skills_match_score=match_res.skills_match_score,
            experience_match_score=match_res.experience_match_score,
            education_match_score=match_res.education_match_score,
            matched_skills=match_res.matched_skills,
            missing_skills=match_res.missing_skills,
            summary=match_res.summary,
            recommendation=match_res.recommendation,
            explanation=match_res.explanation
        )
        CandidateRepository.create_or_update_match_report(db, candidate_id=candidate.id, job_id=job.id, report_in=report_in)
        
    except Exception as e:
        # We don't fail candidate onboarding if AI matching hits a threshold limit, but we log the warning
        ActivityLogRepository.log(
            db,
            action="AI_MATCHING_FAILED",
            details=f"Matching failed for candidate {candidate.id} on job {job.id}: {str(e)}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
    # Audit log
    ActivityLogRepository.log(
        db,
        action="PASTE_RESUME",
        details=f"Onboarded candidate '{candidate.name}' (ID: {candidate.id}) via copy-paste for job role: {job.title}",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Force reload of relationship to include newly compiled match report
    db.refresh(candidate)
    return candidate

@router.post("/upload", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
async def upload_candidate(
    request: Request,
    job_id: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Onboard a candidate by uploading a PDF, Word, or plain text file.
    The resume text is automatically extracted, parsed, and matched against job specifications.
    """
    # 1. Verify Job exists and belongs to the recruiter
    job = JobRepository.get_by_id_and_recruiter(db, job_id=job_id, recruiter_id=current_user.id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target job opening not found or unauthorized"
        )
        
    # 2. Extract raw text from file
    try:
        file_bytes = await file.read()
        raw_text = DocumentParser.parse_document(file.filename, file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to extract text from document: {str(e)}"
        )
        
    # 3. Extract structured entities via Gemini Parser
    try:
        parsed_resume = GeminiService.parse_resume(raw_text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini resume parsing failed: {str(e)}"
        )
        
    # 4. Create Candidate
    candidate_name = parsed_resume.name if parsed_resume.name else file.filename.split(".")[0]
    candidate_in = CandidateCreate(
        name=candidate_name,
        email=parsed_resume.email,
        phone=parsed_resume.phone,
        education_summary=parsed_resume.education_summary,
        experience_summary=parsed_resume.experience_summary,
        skills=parsed_resume.skills,
        resume_text=raw_text,
        job_id=job_id
    )
    candidate = CandidateRepository.create(db, candidate_in, recruiter_id=current_user.id)
    
    # 5. Compile AI Match Report
    try:
        match_res = GeminiService.match_candidate(
            resume_text=raw_text,
            job_title=job.title,
            job_description=job.description,
            job_skills=job.skills
        )
        
        # Save matching scores in DB
        report_in = MatchReportBase(
            overall_score=match_res.overall_score,
            skills_match_score=match_res.skills_match_score,
            experience_match_score=match_res.experience_match_score,
            education_match_score=match_res.education_match_score,
            matched_skills=match_res.matched_skills,
            missing_skills=match_res.missing_skills,
            summary=match_res.summary,
            recommendation=match_res.recommendation,
            explanation=match_res.explanation
        )
        CandidateRepository.create_or_update_match_report(db, candidate_id=candidate.id, job_id=job.id, report_in=report_in)
        
    except Exception as e:
        # We don't fail candidate onboarding if AI matching fails, but we log the warning
        ActivityLogRepository.log(
            db,
            action="AI_MATCHING_FAILED",
            details=f"Matching failed for uploaded candidate {candidate.id} on job {job.id}: {str(e)}",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
    # Audit log
    ActivityLogRepository.log(
        db,
        action="UPLOAD_RESUME",
        details=f"Uploaded and parsed file '{file.filename}' for candidate '{candidate.name}' (ID: {candidate.id})",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    db.refresh(candidate)
    return candidate

@router.delete("/{candidate_id}", status_code=status.HTTP_200_OK)
def delete_candidate(
    candidate_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific candidate profile and their related AI reports.
    """
    candidate = CandidateRepository.get_by_id_and_recruiter(db, candidate_id=candidate_id, recruiter_id=current_user.id)
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found or unauthorized access"
        )
        
    CandidateRepository.delete(db, db_candidate=candidate)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="DELETE_CANDIDATE",
        details=f"Deleted candidate profile ID: {candidate_id} (Name: '{candidate.name}')",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"success": True, "message": "Candidate profile successfully deleted."}
