import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise AI Resume Screening Platform"
    ENVIRONMENT: str = "development"
    PORT: int = 3000
    
    # Database
    DATABASE_URL: str = "sqlite:///./talentsync.db"
    
    # JWT
    JWT_SECRET_KEY: str = "supersecretjwtkeyforresume-screening-platform-access-token"
    JWT_REFRESH_SECRET_KEY: str = "supersecretjwtkeyforresume-screening-platform-refresh-token"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Gemini API
    GEMINI_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
