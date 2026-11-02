from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.collection import Collection, CollectionPaper
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CreateCollectionPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class UpdateCollectionPayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class AddPaperPayload(BaseModel):
    paper_id: int


def _collection_out(col: Collection, paper_count: int) -> dict:
    return {
        "id": col.id,
        "name": col.name,
        "description": col.description,
        "paper_count": paper_count,
        "created_at": col.created_at.isoformat(),
        "updated_at": col.updated_at.isoformat(),
    }


def _paper_out(paper: ResearchPaper) -> dict:
    return {
        "id": paper.id,
        "title": paper.title,
        "authors": paper.authors,
        "source": paper.source,
        "publication_year": paper.publication_year,
        "doi": paper.doi,
        "url": paper.url,
        "abstract": paper.abstract,
    }


@router.get("")
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    cols = (
        db.query(Collection)
        .filter_by(user_id=current_user.id)
        .order_by(Collection.updated_at.desc())
        .all()
    )
    result = []
    for col in cols:
        count = db.query(CollectionPaper).filter_by(collection_id=col.id).count()
        result.append(_collection_out(col, count))
    return result


@router.post("")
def create_collection(
    payload: CreateCollectionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = Collection(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return _collection_out(col, 0)


@router.get("/{collection_id}")
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    cp_entries = db.query(CollectionPaper).filter_by(collection_id=col.id).all()
    paper_ids = [cp.paper_id for cp in cp_entries]
    papers = db.query(ResearchPaper).filter(ResearchPaper.id.in_(paper_ids)).all() if paper_ids else []

    return {
        **_collection_out(col, len(papers)),
        "papers": [_paper_out(p) for p in papers],
    }


@router.patch("/{collection_id}")
def update_collection(
    collection_id: int,
    payload: UpdateCollectionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if payload.name is not None:
        col.name = payload.name
    if payload.description is not None:
        col.description = payload.description
    col.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(col)
    count = db.query(CollectionPaper).filter_by(collection_id=col.id).count()
    return _collection_out(col, count)


@router.delete("/{collection_id}")
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(col)
    db.commit()
    return {"message": "Collection deleted"}


@router.post("/{collection_id}/papers")
def add_paper_to_collection(
    collection_id: int,
    payload: AddPaperPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Verify paper is in user's saved library
    saved = (
        db.query(SavedPaper)
        .filter_by(user_id=current_user.id, paper_id=payload.paper_id)
        .first()
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Paper not found in your library")

    # Check not already in collection
    exists = db.query(CollectionPaper).filter_by(
        collection_id=collection_id, paper_id=payload.paper_id
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Paper already in collection")

    cp = CollectionPaper(collection_id=collection_id, paper_id=payload.paper_id)
    db.add(cp)
    col.updated_at = datetime.utcnow()
    db.commit()
    count = db.query(CollectionPaper).filter_by(collection_id=col.id).count()
    return _collection_out(col, count)


@router.delete("/{collection_id}/papers/{paper_id}")
def remove_paper_from_collection(
    collection_id: int,
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    col = db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    cp = db.query(CollectionPaper).filter_by(collection_id=collection_id, paper_id=paper_id).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Paper not in this collection")

    db.delete(cp)
    col.updated_at = datetime.utcnow()
    db.commit()
    count = db.query(CollectionPaper).filter_by(collection_id=col.id).count()
    return _collection_out(col, count)
