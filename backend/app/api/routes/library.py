from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.schemas.paper import PaperOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/library", tags=["library"])


def _background_embed(paper_id: int, title: str, abstract: str | None, db_url: str) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.services.embedding_service import ensure_paper_embedding
    engine = create_engine(db_url)
    with sessionmaker(bind=engine)() as session:
        ensure_paper_embedding(paper_id, title, abstract, session)


@router.delete("/remove/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_saved_paper(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    saved = db.query(SavedPaper).filter_by(user_id=current_user.id, paper_id=paper_id).first()
    if not saved:
        raise HTTPException(status_code=404, detail="Paper not in library")
    db.delete(saved)
    db.commit()


@router.post("/save-paper", status_code=status.HTTP_201_CREATED, response_model=PaperOut)
def save_paper(
    payload: PaperOut,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResearchPaper:
    title = (payload.title or "").strip()
    url = (payload.url or "").strip()
    doi = (payload.doi or "").strip()
    external_id = (payload.external_id or doi or url or title or "").strip()

    filters = []
    if payload.external_id:
        filters.append(ResearchPaper.external_id == payload.external_id)
    if payload.doi:
        filters.append(ResearchPaper.doi == payload.doi)
    if payload.url:
        filters.append(ResearchPaper.url == payload.url)
    if title:
        filters.append(ResearchPaper.title == title)

    paper = db.query(ResearchPaper).filter(or_(*filters)).first() if filters else None

    if not paper:
        paper = ResearchPaper(
            doi=payload.doi,
            title=title,
            authors=payload.authors,
            abstract=payload.abstract,
            source=payload.source,
            url=payload.url,
            publication_year=payload.publication_year,
            external_id=external_id,
        )
        db.add(paper)
        db.commit()
        db.refresh(paper)
    elif payload.external_id and not paper.external_id:
        conflicting = (
            db.query(ResearchPaper)
            .filter(ResearchPaper.external_id == payload.external_id)
            .filter(ResearchPaper.id != paper.id)
            .first()
        )
        if not conflicting:
            paper.external_id = payload.external_id
            db.add(paper)
            db.commit()

    existing = db.query(SavedPaper).filter_by(user_id=current_user.id, paper_id=paper.id).first()
    if existing:
        return paper

    saved = SavedPaper(user_id=current_user.id, paper_id=paper.id)
    db.add(saved)
    db.commit()

    # Queue background embedding generation
    from app.core.config import settings
    background_tasks.add_task(
        _background_embed,
        paper.id,
        paper.title,
        paper.abstract,
        settings.database_url,
    )

    return paper


@router.get("", response_model=list[PaperOut])
def list_saved_papers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ResearchPaper]:
    saved = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
        .order_by(ResearchPaper.created_at.desc())
        .all()
    )
    return saved
