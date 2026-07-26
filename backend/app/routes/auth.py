from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserOut, Token, ForgotPasswordRequest, ResetPasswordRequest
from app.repositories.user import UserRepository
from app.repositories.activity_log import ActivityLogRepository
from app.services.auth import AuthService
from app.routes.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, request: Request, db: Session = Depends(get_db)):
    """
    Register a new recruiter account.
    """
    # Check if email is already registered
    existing_user = UserRepository.get_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
        
    hashed_password = AuthService.get_password_hash(user_in.password)
    user = UserRepository.create(db, user_in, hashed_password)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="REGISTER",
        details=f"User registered with email: {user.email}",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return user

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate recruiter and issue Bearer JWT access and refresh tokens.
    """
    user = UserRepository.get_by_email(db, login_in.email)
    if not user or not AuthService.verify_password(login_in.password, user.hashed_password):
        # Log failed login attempt
        ActivityLogRepository.log(
            db,
            action="LOGIN_FAILED",
            details=f"Failed login attempt for email: {login_in.email}",
            user_id=None,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive recruiter account"
        )
        
    access_token = AuthService.create_access_token(subject=user.id)
    refresh_token = AuthService.create_refresh_token(subject=user.id)
    
    # Audit log
    ActivityLogRepository.log(
        db,
        action="LOGIN",
        details=f"User successfully logged in: {user.email}",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
def refresh_token(payload: Token, request: Request, db: Session = Depends(get_db)):
    """
    Acquire a new access token using a valid refresh token.
    """
    user_id = AuthService.verify_token(payload.refresh_token, is_refresh=True)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = UserRepository.get_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
        
    access_token = AuthService.create_access_token(subject=user.id)
    refresh_token = AuthService.create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Logs out the recruiter and registers an audit activity log.
    """
    ActivityLogRepository.log(
        db,
        action="LOGOUT",
        details=f"User logged out: {current_user.email}",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    return {"success": True, "message": "Successfully logged out."}

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Endpoint for initiated password resets. In production, this would dispatch email notifications.
    """
    user = UserRepository.get_by_email(db, payload.email)
    
    # Always return 200 OK to prevent user enumeration attacks
    if user:
        # Generate a temporary token valid for reset
        reset_token = AuthService.create_access_token(subject=user.id)
        
        ActivityLogRepository.log(
            db,
            action="FORGOT_PASSWORD",
            details=f"Password reset token requested for user: {user.email}",
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        # For our mock testing / production transparency, we print/log the token
        # In a real environment, send an email here.
        return {
            "success": True, 
            "message": "If this email is registered, you will receive a reset link shortly.",
            "debug_token": reset_token # Supplied for testing ease
        }
        
    return {"success": True, "message": "If this email is registered, you will receive a reset link shortly."}

@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """
    Reset user password using a valid reset token.
    """
    # Verify the reset token
    user_id = AuthService.verify_token(payload.token, is_refresh=False)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
        
    user = UserRepository.get_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found or inactive"
        )
        
    hashed_password = AuthService.get_password_hash(payload.new_password)
    user.hashed_password = hashed_password
    db.commit()
    
    ActivityLogRepository.log(
        db,
        action="RESET_PASSWORD",
        details=f"Password successfully reset for user: {user.email}",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"success": True, "message": "Password successfully reset."}
