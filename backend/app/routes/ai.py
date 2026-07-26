from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.ai_service import AIService
from app.schemas.ai_schemas import (
    ParsedResumeDetailedSchema,
    CandidateMatchSchema,
    InterviewQuestionsListSchema,
    CandidateRankResponseSchema,
    RecruiterChatResponseSchema
)
from app.repositories.candidate import CandidateRepository
from app.repositories.job import JobRepository
from app.repositories.activity_log import ActivityLogRepository
from app.routes.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Copilot Services"])

# =========================================================================
# SCHEMA PAYLOADS FOR API ENDPOINTS
# =========================================================================

class StandaloneParserRequest(BaseModel):
    resume_text: str = Field(..., description="Raw text of the resume to be parsed")

class StandaloneMatchRequest(BaseModel):
    candidate_id: int = Field(..., description="ID of the candidate profile")
    job_id: int = Field(..., description="ID of the job opening")

class QuestionsRequest(BaseModel):
    candidate_id: int = Field(..., description="ID of the candidate")
    count: int = Field(5, description="Number of questions to generate", ge=1, le=15)

class CandidateRankRequest(BaseModel):
    job_id: int = Field(..., description="ID of the job role to rank candidates against")
    candidate_ids: List[int] = Field(..., description="List of registered candidate IDs to evaluate and rank")
    limit: int = Field(10, description="Max candidates to return in rankings", ge=1)

class RecruiterChatRequest(BaseModel):
    conversation_history: List[Dict[str, str]] = Field(
        default_factory=list, 
        description="Chronological discussion history, list of dicts with keys 'role' and 'content'"
    )
    user_message: str = Field(..., description="Recruiter's latest conversational question")
    candidate_id: int = Field(..., description="ID of the candidate profile under review")


# =========================================================================
# ENDPOINTS IMPLEMENTATION
# =========================================================================

@router.post("/parser", response_model=ParsedResumeDetailedSchema)
def parse_resume_detailed(
    payload: StandaloneParserRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parses raw resume text directly into structured JSON blocks including Full Contact Info,
    extracted Skills, Work Experience timelines, Education credentials, and Project details.
    """
    try:
        parsed_resume = AIService.parse_resume_detailed(payload.resume_text)
        
        ActivityLogRepository.log(
            db,
            action="PARSE_RESUME_DETAILED",
            details=f"Executed detailed multi-modal resume parsing with Gemini for recruiter: '{current_user.email}'",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        return parsed_resume
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini AI resume parsing service failed: {str(e)}"
        )


@router.post("/match", response_model=CandidateMatchSchema)
def match_candidate_role(
    payload: StandaloneMatchRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Screens and matches a candidate's resume with a specified job.
    Computes detailed scores, performs a complete Skill Gap Analysis, generates an AI summary,
    and returns a precise hiring recommendation.
    """
    # 1. Retrieve Candidate
    candidate = CandidateRepository.get_by_id_and_recruiter(
        db, candidate_id=payload.candidate_id, recruiter_id=current_user.id
    )
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found or unauthorized"
        )
        
    # 2. Retrieve Job
    job = JobRepository.get_by_id_and_recruiter(
        db, job_id=payload.job_id, recruiter_id=current_user.id
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found or unauthorized"
        )
        
    # 3. Match candidate via AIService
    try:
        match_result = AIService.match_candidate_detailed(
            resume_text=candidate.resume_text,
            job_title=job.title,
            job_description=job.description,
            job_skills=job.skills
        )
        
        # Link candidate to job in DB if not already set
        if candidate.job_id != job.id:
            candidate.job_id = job.id
            db.commit()

        ActivityLogRepository.log(
            db,
            action="RUN_ADVANCED_AI_MATCHING",
            details=f"Completed advanced AI matching for candidate '{candidate.name}' (ID: {candidate.id}) and job '{job.title}' (ID: {job.id}). Overall Fit Score: {match_result.overall_score}%",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return match_result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini AI screening/matching evaluation failed: {str(e)}"
        )


@router.post("/generate-questions", response_model=InterviewQuestionsListSchema)
def generate_interview_questions(
    payload: QuestionsRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates tailored, expert-level behavioral and technical interview questions based
    on a candidate's specific background and identified skill gaps.
    """
    # 1. Retrieve Candidate
    candidate = CandidateRepository.get_by_id_and_recruiter(
        db, candidate_id=payload.candidate_id, recruiter_id=current_user.id
    )
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found or unauthorized"
        )
        
    # 2. Verify Candidate has a linked job
    if not candidate.job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate must be assigned to a job profile before generating customized questions."
        )
        
    # 3. Retrieve Job
    job = JobRepository.get_by_id_and_recruiter(
        db, job_id=candidate.job_id, recruiter_id=current_user.id
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated job role not found or unauthorized"
        )
        
    # 4. Generate custom questions
    try:
        questions_list = AIService.generate_interview_questions_detailed(
            candidate_name=candidate.name,
            candidate_skills=candidate.skills,
            job_title=job.title,
            job_description=job.description,
            count=payload.count
        )
        
        ActivityLogRepository.log(
            db,
            action="GENERATE_CUSTOM_QUESTIONS",
            details=f"Generated {payload.count} tailormade questions for candidate '{candidate.name}' (ID: {candidate.id})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return questions_list
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini custom question generation failed: {str(e)}"
        )


@router.post("/rank", response_model=CandidateRankResponseSchema)
def rank_candidates(
    payload: CandidateRankRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes advanced candidate ranking against a target job profile using a Vector Database (ChromaDB),
    Sentence Transformers, and Gemini reasoning.
    """
    # 1. Retrieve the Job Profile
    job = JobRepository.get_by_id_and_recruiter(
        db, job_id=payload.job_id, recruiter_id=current_user.id
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target job opening not found or unauthorized"
        )

    # 2. Gather candidate details
    candidates_data = []
    for cid in payload.candidate_ids:
        candidate = CandidateRepository.get_by_id_and_recruiter(
            db, candidate_id=cid, recruiter_id=current_user.id
        )
        if candidate:
            candidates_data.append({
                "id": candidate.id,
                "name": candidate.name,
                "email": candidate.email,
                "phone": candidate.phone,
                "skills": candidate.skills,
                "experience_summary": candidate.experience_summary,
                "education_summary": candidate.education_summary,
                "resume_text": candidate.resume_text
            })

    if not candidates_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid candidate profiles identified matching the provided IDs."
        )

    # 3. Perform Vector Ranking
    try:
        rank_response = AIService.rank_candidates(
            job_title=job.title,
            job_description=job.description,
            job_skills=job.skills,
            candidates_list=candidates_data,
            limit=payload.limit
        )

        ActivityLogRepository.log(
            db,
            action="RANK_CANDIDATES_VECTOR",
            details=f"Ranked {len(candidates_data)} candidates for Job ID: {job.id} using ChromaDB vector matching.",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )

        return rank_response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Semantic candidate ranking failed: {str(e)}"
        )


@router.post("/chat", response_model=RecruiterChatResponseSchema)
def chat_with_copilot(
    payload: RecruiterChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enables recruiters to converse naturally with the AI Recruiting Copilot regarding a candidate's background,
    matching criteria, specific skills, or suitability for the associated job role.
    """
    # 1. Retrieve Candidate
    candidate = CandidateRepository.get_by_id_and_recruiter(
        db, candidate_id=payload.candidate_id, recruiter_id=current_user.id
    )
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found or unauthorized"
        )

    # 2. Compile candidate profile context
    candidate_profile = f"""
    Candidate Name: {candidate.name}
    Contact Details: Email: {candidate.email}, Phone: {candidate.phone}
    Extracted Skills: {', '.join(candidate.skills)}
    Education Summary: {candidate.education_summary or "N/A"}
    Experience Summary: {candidate.experience_summary or "N/A"}
    Full Raw Resume Content:
    {candidate.resume_text}
    """

    # 3. Retrieve Job profile context if assigned
    job_profile = "No associated job profile assigned yet."
    if candidate.job_id:
        job = JobRepository.get_by_id_and_recruiter(
            db, job_id=candidate.job_id, recruiter_id=current_user.id
        )
        if job:
            job_profile = f"""
            Job Title: {job.title}
            Location: {job.location}, Salary: {job.salary or "Confidential"}, Mode: {job.employment_type}
            Required Skills: {', '.join(job.skills)}
            Required Education: {job.education}
            Job Description:
            {job.description}
            """

    # 4. Dispatch query to AI Copilot
    try:
        chat_response = AIService.chat_with_recruiter(
            conversation_history=payload.conversation_history,
            user_message=payload.user_message,
            candidate_profile_text=candidate_profile,
            job_profile_text=job_profile
        )

        ActivityLogRepository.log(
            db,
            action="RECRUITER_COPILOT_CHAT",
            details=f"Recruiter chatted with AI co-pilot regarding candidate '{candidate.name}' (ID: {candidate.id})",
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )

        return chat_response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Recruiter chat assistant service failed: {str(e)}"
        )
