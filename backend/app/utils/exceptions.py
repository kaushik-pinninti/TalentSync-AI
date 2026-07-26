from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError
from app.utils.logger import logger

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Format standard FastAPI HTTPExceptions.
    """
    logger.warning(f"HTTPException: {exc.status_code} - {exc.detail} on {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_type": "HTTPException",
            "message": exc.detail,
        },
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Format request schema validation failures.
    """
    logger.warning(f"Validation Error on {request.url.path}: {exc.errors()}")
    # Simplify the pydantic errors for front-end consumption
    formatted_errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error.get("loc", []))
        formatted_errors.append({
            "field": field,
            "issue": error.get("msg"),
            "type": error.get("type")
        })
        
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error_type": "ValidationError",
            "message": "Input validation failed. Please check required fields.",
            "details": formatted_errors
        },
    )

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Catch-all database operation issues (integrity, connection pool exhaustion, syntax).
    """
    logger.error(f"Database Exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": "DatabaseError",
            "message": "A database operation failed. This may be due to foreign key conflicts, unique email constraints, or server timeout.",
        },
    )

async def general_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled server issues, preventing raw traceback leakage.
    """
    logger.error(f"Unhandled Server Error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_type": "InternalServerError",
            "message": "An unexpected error occurred. Our engineering team has been notified.",
        },
    )
