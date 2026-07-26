from sqlalchemy.orm import Session
from app.models.activity_log import ActivityLog
from typing import List, Optional

class ActivityLogRepository:
    @staticmethod
    def log(
        db: Session, 
        action: str, 
        details: str, 
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> ActivityLog:
        log_entry = ActivityLog(
            user_id=user_id,
            action=action.upper(),
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

    @staticmethod
    def list_by_user(db: Session, user_id: int, limit: int = 100) -> List[ActivityLog]:
        return db.query(ActivityLog)\
                 .filter(ActivityLog.user_id == user_id)\
                 .order_by(ActivityLog.created_at.desc())\
                 .limit(limit)\
                 .all()

    @staticmethod
    def get_recent_audit_logs(db: Session, user_id: int, limit: int = 10) -> List[ActivityLog]:
        return db.query(ActivityLog)\
                 .filter(ActivityLog.user_id == user_id)\
                 .order_by(ActivityLog.created_at.desc())\
                 .limit(limit)\
                 .all()
