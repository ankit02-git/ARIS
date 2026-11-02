from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.insight_service import build_research_summary

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/insights")
def get_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    papers = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
        .order_by(ResearchPaper.created_at.desc())
        .all()
    )

    return build_research_summary([
        {
            "title": paper.title,
            "abstract": paper.abstract,
            "source": paper.source,
            "url": paper.url,
        }
        for paper in papers
    ])
