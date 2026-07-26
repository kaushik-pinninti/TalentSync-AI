from app.routes.auth import router as auth_router
from app.routes.jobs import router as jobs_router
from app.routes.candidates import router as candidates_router
from app.routes.ai import router as ai_router
from app.routes.analytics import router as analytics_router

__all__ = [
    "auth_router",
    "jobs_router",
    "candidates_router",
    "ai_router",
    "analytics_router"
]
