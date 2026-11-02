from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.schemas.comparison import PaperComparisonRequest, PaperComparisonResponse
from app.services.auth_service import get_current_user
from app.services.comparison_service import compare_papers

router = APIRouter(prefix="/api", tags=["comparison"])


@router.post("/compare", response_model=PaperComparisonResponse)
def compare_saved_papers(
    payload: PaperComparisonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if len(set(payload.paper_ids)) != len(payload.paper_ids):
        raise HTTPException(status_code=422, detail="Paper IDs must be unique")

    saved = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
        .filter(ResearchPaper.id.in_(payload.paper_ids))
        .all()
    )
    papers_by_id = {paper.id: paper for paper in saved}
    if len(papers_by_id) != len(payload.paper_ids):
        raise HTTPException(status_code=404, detail="One or more papers are not in your saved library")

    ordered_papers = [papers_by_id[paper_id] for paper_id in payload.paper_ids]
    return compare_papers(ordered_papers)
