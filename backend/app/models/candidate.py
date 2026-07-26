from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    education_summary = Column(Text, nullable=True)
    experience_summary = Column(Text, nullable=True)
    skills = Column(JSON, nullable=False, default=list) # List of parsed skills
    resume_text = Column(Text, nullable=False) # Extracted raw text from PDF/TXT
    
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True)
    recruiter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    job = relationship("Job", back_populates="candidates")
    recruiter = relationship("User", back_populates="candidates")
    match_report = relationship("MatchReport", back_populates="candidate", uselist=False, cascade="all, delete-orphan")
