from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class JobBase(BaseModel):
    title: str = Field(..., example="Senior Full Stack Engineer")
    description: str = Field(..., example="We are looking for a senior full stack engineer to join our team...")
    employment_type: str = Field(..., example="Full-time") # Full-time, Part-time, Contract, Remote
    location: str = Field(..., example="New York, NY")
    salary: Optional[str] = Field(None, example="$120,000 - $150,000")
    experience: str = Field(..., example="5+ years of experience in production environments")
    education: str = Field(..., example="Bachelor's in Computer Science or equivalent")
    skills: List[str] = Field(default_factory=list, example=["React", "TypeScript", "Node.js", "PostgreSQL"])

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    employment_type: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[List[str]] = None
    is_archived: Optional[bool] = None

class JobOut(JobBase):
    id: int
    is_archived: bool
    recruiter_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
