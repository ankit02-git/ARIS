from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _msg_out(m: ConversationMessage) -> dict:
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "citations": json.loads(m.citations_json) if m.citations_json else [],
        "created_at": m.created_at.isoformat(),
    }


def _conv_out(c: Conversation, message_count: int) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "message_count": message_count,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


@router.get("")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    convs = (
        db.query(Conversation)
        .filter_by(user_id=current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for c in convs:
        count = db.query(ConversationMessage).filter_by(conversation_id=c.id).count()
        result.append(_conv_out(c, count))
    return result


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    conv = db.query(Conversation).filter_by(id=conversation_id, user_id=current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(ConversationMessage)
        .filter_by(conversation_id=conv.id)
        .order_by(ConversationMessage.created_at)
        .all()
    )
    return {
        **_conv_out(conv, len(messages)),
        "messages": [_msg_out(m) for m in messages],
    }


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    conv = db.query(Conversation).filter_by(id=conversation_id, user_id=current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}
