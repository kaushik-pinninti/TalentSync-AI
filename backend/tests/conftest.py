import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
# Add the backend folder to the python path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__))))

from app.database import Base, get_db
from app.main import app
from app.config import settings

# In-memory SQLite for high-performance isolated tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionLocal()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def auth_headers(client):
    # Register and login a mock user to get valid JWT token
    user_data = {
        "email": "tester@enterprise.com",
        "password": "SecurePassword123!",
        "full_name": "Test Engineer",
        "company_name": "QA Labs"
    }
    client.post("/api/auth/register", json=user_data)
    
    login_res = client.post("/api/auth/login", json={
        "email": "tester@enterprise.com",
        "password": "SecurePassword123!"
    })
    
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
