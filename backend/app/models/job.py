from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    employment_type = Column(String, nullable=False) # e.g. Full-time, Part-time, Contract, Remote
    location = Column(String, nullable=False)
    salary = Column(String, nullable=True)
    experience = Column(String, nullable=False) # Target experience description
    education = Column(String, nullable=False) # Required education
    skills = Column(JSON, nullable=False, default=list) # Comma-separated or array of required skills
    is_archived = Column(Boolean, default=False)
    
    recruiter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    recruiter = relationship("User", back_populates="jobs")
    candidates = relationship("Candidate", back_populates="job", cascade="all, delete-orphan")
    match_reports = relationship("MatchReport", back_populates="job", cascade="all, delete-orphan")
