from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.saved_search import SavedSearch
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/saved-searches", tags=["saved-searches"])


class SaveSearchPayload(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    mode: str = "hybrid"
    result_count: int | None = None


def _out(s: SavedSearch) -> dict:
    return {
        "id": s.id,
        "query": s.query,
        "mode": s.mode,
        "result_count": s.result_count,
        "created_at": s.created_at.isoformat(),
    }


@router.get("")
def list_saved_searches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    searches = (
        db.query(SavedSearch)
        .filter_by(user_id=current_user.id)
        .order_by(SavedSearch.created_at.desc())
        .limit(50)
        .all()
    )
    return [_out(s) for s in searches]


@router.post("")
def save_search(
    payload: SaveSearchPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Avoid duplicate saves of same query
    existing = (
        db.query(SavedSearch)
        .filter_by(user_id=current_user.id, query=payload.query.strip())
        .first()
    )
    if existing:
        return _out(existing)

    s = SavedSearch(
        user_id=current_user.id,
        query=payload.query.strip(),
        mode=payload.mode,
        result_count=payload.result_count,
        created_at=datetime.utcnow(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _out(s)


@router.delete("/{search_id}")
def delete_saved_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    s = db.query(SavedSearch).filter_by(id=search_id, user_id=current_user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Saved search not found")
    db.delete(s)
    db.commit()
    return {"message": "Saved search deleted"}
