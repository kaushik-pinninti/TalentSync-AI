from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import Base, engine
from app.routes.auth import router as auth_router
from app.routes.jobs import router as jobs_router
from app.routes.candidates import router as candidates_router
from app.routes.ai import router as ai_router
from app.routes.analytics import router as analytics_router

from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.utils.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    general_exception_handler
)
from app.utils.logger import logger

# Automatically bootstrap database tables on start-up (robust automatic schema execution)
try:
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schemas initialized successfully.")
except Exception as e:
    logger.error(f"Error initializing database schemas on startup: {str(e)}", exc_info=True)

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise AI Resume Screening Platform robust JSON REST API backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 1. Register CORS Middleware (important for Frontend-Backend communications)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific frontend URL origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Register Request Logging Middleware
app.add_middleware(RequestLoggingMiddleware)

# 3. Register Custom Exception Handlers
app.exception_handler(StarletteHTTPException)(http_exception_handler)
app.exception_handler(RequestValidationError)(validation_exception_handler)
app.exception_handler(SQLAlchemyError)(sqlalchemy_exception_handler)
app.exception_handler(Exception)(general_exception_handler)

# 4. Mount API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(candidates_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")

@app.get("/", include_in_schema=False)
def root_redirect():
    """
    Redirect root requests to the interactive API Swagger Documentation.
    """
    return RedirectResponse(url="/docs")

@app.get("/api/health", tags=["System Health"])
def health_check():
    """
    Simple system health check probe.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }
