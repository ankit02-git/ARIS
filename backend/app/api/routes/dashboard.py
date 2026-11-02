from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    saved_count = db.query(SavedPaper).filter(SavedPaper.user_id == current_user.id).count()
    papers_count = db.query(ResearchPaper).count()

    if saved_count == 0:
        activity = "Ready"
        analyzed_count = 0
    elif saved_count == 1:
        activity = "Analysis active"
        analyzed_count = 1
    else:
        activity = "Trend review active"
        analyzed_count = saved_count

    return {
        "welcome": f"Welcome back, {current_user.name}!",
        "papers_collected": papers_count,
        "saved_papers": saved_count,
        "papers_analyzed": analyzed_count,
        "research_activity": activity,
    }
