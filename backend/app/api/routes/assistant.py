from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.rag_service import rag_answer, get_ollama_model

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class ChatRequest(BaseModel):
    message: str
    paper_ids: list[int] | None = None
    conversation_id: int | None = None


def _background_embed(paper_id: int, title: str, abstract: str | None, db_url: str) -> None:
    """Generate and store embedding for a paper in the background."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.services.embedding_service import ensure_paper_embedding

    engine = create_engine(db_url)
    with sessionmaker(bind=engine)() as db:
        ensure_paper_embedding(paper_id, title, abstract, db)


@router.get("/status")
def assistant_status() -> dict:
    model = get_ollama_model()
    return {"available": model is not None, "model": model}


@router.post("/chat")
def chat(
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Determine paper context scope
    if payload.paper_ids:
        valid_ids = [
            row[0] for row in
            db.query(SavedPaper.paper_id)
            .filter_by(user_id=current_user.id)
            .filter(SavedPaper.paper_id.in_(payload.paper_ids))
            .all()
        ]
        context_ids = valid_ids if valid_ids else None
    else:
        context_ids = None

    # Resolve or create conversation
    conversation: Conversation | None = None
    if payload.conversation_id:
        conversation = db.query(Conversation).filter_by(
            id=payload.conversation_id, user_id=current_user.id
        ).first()

    if conversation is None:
        # Auto-create a conversation titled from the first message
        title = payload.message[:80] + ("…" if len(payload.message) > 80 else "")
        conversation = Conversation(
            user_id=current_user.id,
            title=title,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(conversation)
        db.flush()  # get the id without full commit

    # Load prior messages from DB for context
    prior_messages = (
        db.query(ConversationMessage)
        .filter_by(conversation_id=conversation.id)
        .order_by(ConversationMessage.created_at)
        .all()
    )
    conversation_history = [
        {"role": m.role, "content": m.content}
        for m in prior_messages[-10:]
    ]

    # Save user message
    user_msg = ConversationMessage(
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
        created_at=datetime.utcnow(),
    )
    db.add(user_msg)

    answer, chunks = rag_answer(
        question=payload.message,
        paper_ids=context_ids,
        db=db,
        conversation_history=conversation_history,
    )

    # Ensure non-empty response (defensive fallback for Ollama offline + no chunks)
    if not answer or not answer.strip():
        answer = (
            "I don't have enough context to answer this question. "
            "Try saving some papers to your library first, or check that the AI service (Ollama) is running."
        )

    # Build citations from retrieved chunks
    citations = []
    seen_pids: set[int] = set()
    for chunk in chunks:
        if chunk.paper_id not in seen_pids:
            seen_pids.add(chunk.paper_id)
            paper = db.query(ResearchPaper).filter_by(id=chunk.paper_id).first()
            if paper:
                citations.append({
                    "paper_id": paper.id,
                    "title": paper.title,
                    "authors": paper.authors,
                    "year": paper.publication_year,
                    "url": paper.url,
                    "excerpt": chunk.chunk_text[:200] if chunk.chunk_text else None,
                })

    # Save assistant message
    assistant_msg = ConversationMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        citations_json=json.dumps(citations) if citations else None,
        created_at=datetime.utcnow(),
    )
    db.add(assistant_msg)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_msg)

    return {
        "id": str(assistant_msg.id),
        "role": "assistant",
        "content": answer,
        "citations": citations,
        "conversation_id": conversation.id,
        "created_at": assistant_msg.created_at.isoformat(),
    }


@router.post("/embed-library")
def embed_library(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Trigger background embedding generation for all saved papers."""
    from app.core.config import settings

    papers = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
        .all()
    )

    count = 0
    for paper in papers:
        background_tasks.add_task(
            _background_embed,
            paper.id,
            paper.title,
            paper.abstract,
            settings.database_url,
        )
        count += 1

    return {"queued": count, "message": f"Embedding generation queued for {count} papers."}
