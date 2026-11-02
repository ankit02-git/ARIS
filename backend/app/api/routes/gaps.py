from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.gap_service import analyze_research_gaps

router = APIRouter(prefix="/api/gaps", tags=["gaps"])


@router.get("")
def get_research_gaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return analyze_research_gaps(db=db, user_id=current_user.id)


@router.post("/rebuild-index")
def rebuild_embedding_index(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Rebuild FAISS index from all stored embeddings."""
    def _rebuild(db_url: str) -> None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.services.embedding_service import build_faiss_index
        engine = create_engine(db_url)
        with sessionmaker(bind=engine)() as session:
            build_faiss_index(session)

    from app.core.config import settings
    background_tasks.add_task(_rebuild, settings.database_url)
    return {"status": "queued", "message": "FAISS index rebuild has been queued."}
