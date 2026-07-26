from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base

class MatchReport(Base):
    __tablename__ = "match_reports"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"), unique=True, nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    
    overall_score = Column(Integer, nullable=False) # e.g. 85
    skills_match_score = Column(Integer, nullable=False)
    experience_match_score = Column(Integer, nullable=False)
    education_match_score = Column(Integer, nullable=False)
    
    matched_skills = Column(JSON, nullable=False, default=list) # Skills candidate has that job requires
    missing_skills = Column(JSON, nullable=False, default=list) # Required skills candidate is missing
    
    summary = Column(Text, nullable=False) # Concise high level summary
    recommendation = Column(Text, nullable=False) # Hiring recommendation
    explanation = Column(Text, nullable=False) # Detailed score explanation
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    candidate = relationship("Candidate", back_populates="match_report")
    job = relationship("Job", back_populates="match_reports")
