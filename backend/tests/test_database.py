import pytest
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.repositories.user import UserRepository
from app.schemas.auth import UserRegister

def test_user_model_mapping(db_session):
    # Test model insertion and query
    user_in = UserRegister(
        email="db_tester@company.com",
        password="TestPassword123!",
        full_name="Database Tester",
        company_name="SQL Labs"
    )
    user = UserRepository.create(db_session, user_in, "fake_hashed_pwd")
    
    assert user.id is not None
    assert user.email == "db_tester@company.com"
    assert user.full_name == "Database Tester"
    
    # Query database directly using SQLAlchemy
    fetched_user = db_session.query(User).filter_by(email="db_tester@company.com").first()
    assert fetched_user is not None
    assert fetched_user.id == user.id

def test_user_job_relationship(db_session):
    # Create user
    user_in = UserRegister(
        email="job_owner@recruiter.com",
        password="Password1!",
        full_name="Job Owner"
    )
    user = UserRepository.create(db_session, user_in, "fake_hash")
    
    # Create job associated with user
    job = Job(
        recruiter_id=user.id,
        title="Solutions Architect",
        description="Design secure cloud infrastructures",
        experience="8+ years",
        skills=["GCP", "Kubernetes", "Terraform"],
        education="Bachelor",
        salary="$180,000",
        location="Austin, TX",
        employment_type="Full-time",
        status="active"
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    
    assert job.id is not None
    assert job.recruiter_id == user.id
    
    # Test relationship back_populates
    db_session.refresh(user)
    assert len(user.jobs) == 1
    assert user.jobs[0].title == "Solutions Architect"

def test_cascade_delete(db_session):
    # Setup - user and job
    user_in = UserRegister(
        email="cascade@recruiter.com",
        password="Password1!",
        full_name="Cascade Admin"
    )
    user = UserRepository.create(db_session, user_in, "fake_hash")
    
    job = Job(
        recruiter_id=user.id,
        title="Temporary Assistant",
        description="Temp help",
        experience="None",
        skills=[],
        education="Highschool",
        salary="$20/hr",
        location="Chicago",
        employment_type="Part-time",
        status="active"
    )
    db_session.add(job)
    db_session.commit()
    
    # Delete recruiter user
    db_session.delete(user)
    db_session.commit()
    
    # Assert associated job is cascaded and deleted as well
    remaining_jobs = db_session.query(Job).filter_by(recruiter_id=user.id).all()
    assert len(remaining_jobs) == 0
