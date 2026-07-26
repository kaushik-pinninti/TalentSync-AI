from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth import AuthService
from app.repositories.user import UserRepository

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Extracts the current authenticated recruiter from the Bearer token.
    Raises HTTP 401 if token is expired, invalid, or user doesn't exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Verify token signature and type
    user_id = AuthService.verify_token(token, is_refresh=False)
    if user_id is None:
        raise credentials_exception
        
    # Retrieve user from database
    user = UserRepository.get_by_id(db, user_id)
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated."
        )
        
    return user
