from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.candidate import Candidate
from app.models.match import MatchReport
from app.schemas.candidate import CandidateCreate
from app.schemas.match import MatchReportBase
from typing import List, Optional

class CandidateRepository:
    @staticmethod
    def get_by_id(db: Session, candidate_id: int) -> Optional[Candidate]:
        return db.query(Candidate).filter(Candidate.id == candidate_id).first()

    @staticmethod
    def get_by_id_and_recruiter(db: Session, candidate_id: int, recruiter_id: int) -> Optional[Candidate]:
        return db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.recruiter_id == recruiter_id).first()

    @staticmethod
    def list_by_recruiter(
        db: Session, 
        recruiter_id: int, 
        job_id: Optional[int] = None,
        search_query: Optional[str] = None,
        min_score: Optional[int] = None
    ) -> List[Candidate]:
        query = db.query(Candidate).filter(Candidate.recruiter_id == recruiter_id)
        
        if job_id is not None:
            query = query.filter(Candidate.job_id == job_id)
            
        if search_query:
            search_pattern = f"%{search_query.lower()}%"
            query = query.filter(
                or_(
                    Candidate.name.ilike(search_pattern),
                    Candidate.email.ilike(search_pattern),
                    Candidate.resume_text.ilike(search_pattern)
                )
            )
            
        if min_score is not None and min_score > 0:
            query = query.join(Candidate.match_report).filter(MatchReport.overall_score >= min_score)
            
        return query.order_by(Candidate.created_at.desc()).all()

    @staticmethod
    def create(db: Session, candidate_in: CandidateCreate, recruiter_id: int) -> Candidate:
        db_candidate = Candidate(
            name=candidate_in.name,
            email=candidate_in.email,
            phone=candidate_in.phone,
            education_summary=candidate_in.education_summary,
            experience_summary=candidate_in.experience_summary,
            skills=candidate_in.skills,
            resume_text=candidate_in.resume_text,
            job_id=candidate_in.job_id,
            recruiter_id=recruiter_id
        )
        db.add(db_candidate)
        db.commit()
        db.refresh(db_candidate)
        return db_candidate

    @staticmethod
    def create_or_update_match_report(
        db: Session, 
        candidate_id: int, 
        job_id: int, 
        report_in: MatchReportBase
    ) -> MatchReport:
        # Check if match report already exists
        db_report = db.query(MatchReport).filter(MatchReport.candidate_id == candidate_id).first()
        
        if db_report:
            db_report.job_id = job_id
            db_report.overall_score = report_in.overall_score
            db_report.skills_match_score = report_in.skills_match_score
            db_report.experience_match_score = report_in.experience_match_score
            db_report.education_match_score = report_in.education_match_score
            db_report.matched_skills = report_in.matched_skills
            db_report.missing_skills = report_in.missing_skills
            db_report.summary = report_in.summary
            db_report.recommendation = report_in.recommendation
            db_report.explanation = report_in.explanation
        else:
            db_report = MatchReport(
                candidate_id=candidate_id,
                job_id=job_id,
                overall_score=report_in.overall_score,
                skills_match_score=report_in.skills_match_score,
                experience_match_score=report_in.experience_match_score,
                education_match_score=report_in.education_match_score,
                matched_skills=report_in.matched_skills,
                missing_skills=report_in.missing_skills,
                summary=report_in.summary,
                recommendation=report_in.recommendation,
                explanation=report_in.explanation
            )
            db.add(db_report)
            
        db.commit()
        db.refresh(db_report)
        return db_report

    @staticmethod
    def delete(db: Session, db_candidate: Candidate) -> bool:
        db.delete(db_candidate)
        db.commit()
        return True
