from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, DeclarativeBase
from typing import Generator
from app.config import settings

# In production, Neon DB requires sslmode=require or similar depending on environment
# We make sure the database engine is configured correctly
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Create database engine
# Pass dialect-specific pool options to avoid exceptions with SQLite
engine_args = {
    "pool_recycle": 3600,
    "pool_pre_ping": True
}

if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20
elif SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_args
)

# SessionLocal is the class we use to instantiate database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Standard base class for our models using SQLAlchemy 2.0 style
class Base(DeclarativeBase):
    pass

# Dependency to get db session in endpoints
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
