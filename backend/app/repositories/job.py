from sqlalchemy.orm import Session
from app.models.job import Job
from app.schemas.job import JobCreate, JobUpdate
from typing import List, Optional

class JobRepository:
    @staticmethod
    def get_by_id(db: Session, job_id: int) -> Optional[Job]:
        return db.query(Job).filter(Job.id == job_id).first()

    @staticmethod
    def get_by_id_and_recruiter(db: Session, job_id: int, recruiter_id: int) -> Optional[Job]:
        return db.query(Job).filter(Job.id == job_id, Job.recruiter_id == recruiter_id).first()

    @staticmethod
    def list_by_recruiter(db: Session, recruiter_id: int, include_archived: bool = True) -> List[Job]:
        query = db.query(Job).filter(Job.recruiter_id == recruiter_id)
        if not include_archived:
            query = query.filter(Job.is_archived == False)
        return query.order_by(Job.created_at.desc()).all()

    @staticmethod
    def create(db: Session, job_in: JobCreate, recruiter_id: int) -> Job:
        db_job = Job(
            title=job_in.title,
            description=job_in.description,
            employment_type=job_in.employment_type,
            location=job_in.location,
            salary=job_in.salary,
            experience=job_in.experience,
            education=job_in.education,
            skills=job_in.skills,
            is_archived=False,
            recruiter_id=recruiter_id
        )
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        return db_job

    @staticmethod
    def update(db: Session, db_job: Job, job_in: JobUpdate) -> Job:
        update_data = job_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_job, key, value)
        
        db.commit()
        db.refresh(db_job)
        return db_job

    @staticmethod
    def delete(db: Session, db_job: Job) -> bool:
        db.delete(db_job)
        db.commit()
        return True
