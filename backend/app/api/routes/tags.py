from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.tag import PaperTag
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


class AddTagPayload(BaseModel):
    paper_id: int
    tag: str = Field(min_length=1, max_length=100)


@router.get("")
def list_user_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Return all unique tags used by this user."""
    rows = (
        db.query(PaperTag.tag)
        .filter_by(user_id=current_user.id)
        .distinct()
        .all()
    )
    return sorted(row[0] for row in rows)


@router.get("/paper/{paper_id}")
def get_paper_tags(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Return tags for a specific paper in the user's library."""
    rows = (
        db.query(PaperTag.tag)
        .filter_by(user_id=current_user.id, paper_id=paper_id)
        .all()
    )
    return [row[0] for row in rows]


@router.post("")
def add_tag(
    payload: AddTagPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Verify paper is in user's library
    saved = db.query(SavedPaper).filter_by(user_id=current_user.id, paper_id=payload.paper_id).first()
    if not saved:
        raise HTTPException(status_code=404, detail="Paper not found in your library")

    tag_clean = payload.tag.strip().lower()
    if not tag_clean:
        raise HTTPException(status_code=422, detail="Tag cannot be empty")

    # Check not duplicate
    existing = db.query(PaperTag).filter_by(
        user_id=current_user.id, paper_id=payload.paper_id, tag=tag_clean
    ).first()
    if existing:
        return {"paper_id": payload.paper_id, "tag": tag_clean}

    pt = PaperTag(
        user_id=current_user.id,
        paper_id=payload.paper_id,
        tag=tag_clean,
        created_at=datetime.utcnow(),
    )
    db.add(pt)
    db.commit()
    return {"paper_id": payload.paper_id, "tag": tag_clean}


@router.delete("")
def remove_tag(
    paper_id: int,
    tag: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    pt = db.query(PaperTag).filter_by(
        user_id=current_user.id, paper_id=paper_id, tag=tag.strip().lower()
    ).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(pt)
    db.commit()
    return {"message": "Tag removed"}


@router.get("/by-tag/{tag}")
def papers_by_tag(
    tag: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return all papers with a given tag from the user's library."""
    rows = (
        db.query(PaperTag)
        .filter_by(user_id=current_user.id, tag=tag.strip().lower())
        .all()
    )
    paper_ids = [r.paper_id for r in rows]
    if not paper_ids:
        return []
    papers = db.query(ResearchPaper).filter(ResearchPaper.id.in_(paper_ids)).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "source": p.source,
            "publication_year": p.publication_year,
            "url": p.url,
        }
        for p in papers
    ]
