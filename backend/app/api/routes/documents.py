from __future__ import annotations

import os
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.document import UploadedDocument
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage", "uploads")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def ensure_upload_dir() -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    return UPLOAD_DIR


def _extract_title_from_text(text: str) -> str | None:
    """Heuristic: first non-empty line that looks like a title (< 200 chars)."""
    for line in text.splitlines()[:20]:
        stripped = line.strip()
        if 10 < len(stripped) < 200 and not stripped.startswith("http"):
            return stripped
    return None


def _extract_authors_from_text(text: str) -> str | None:
    """Find lines near top that look like author names."""
    lines = [l.strip() for l in text.splitlines()[:40] if l.strip()]
    # Look for lines with multiple commas and capital words (author-like)
    for line in lines[1:10]:
        if re.search(r'[A-Z][a-z]+ [A-Z][a-z]+', line) and len(line) < 300:
            # Filter out obvious non-authors
            if not any(kw in line.lower() for kw in ['abstract', 'introduction', 'university', 'http', 'doi']):
                if re.search(r',\s*[A-Z]', line) or re.search(r'\band\b', line):
                    return line[:500]
    return None


def _process_pdf_extraction(doc_id: int, file_path: str, db_url: str) -> None:
    """Background task: extract text from PDF using PyMuPDF."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        doc = db.query(UploadedDocument).filter_by(id=doc_id).first()
        if not doc:
            return

        doc.status = "processing"
        db.commit()

        try:
            import fitz  # PyMuPDF
            pdf = fitz.open(file_path)
            text_parts = []
            for page in pdf:
                text_parts.append(page.get_text())
            pdf.close()
            full_text = "\n".join(text_parts)

            if len(full_text.strip()) < 50:
                doc.status = "failed"
                db.commit()
                return

            title = _extract_title_from_text(full_text)
            authors = _extract_authors_from_text(full_text)
            doc.extracted_title = title
            doc.extracted_authors = authors
            doc.status = "completed"

        except Exception:
            doc.status = "failed"

        db.commit()
    finally:
        db.close()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")
    if len(content) < 4 or content[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    upload_dir = ensure_upload_dir()
    safe_name = f"{uuid.uuid4().hex}.pdf"
    file_path = os.path.join(upload_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    doc = UploadedDocument(
        user_id=current_user.id,
        filename=safe_name,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Kick off background extraction
    from app.core.config import settings
    background_tasks.add_task(
        _process_pdf_extraction,
        doc.id,
        file_path,
        settings.database_url,
    )

    return _doc_out(doc)


@router.get("")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: str | None = None,
) -> list[dict]:
    query = (
        db.query(UploadedDocument)
        .filter_by(user_id=current_user.id)
    )
    docs = query.order_by(UploadedDocument.created_at.desc()).all()

    # Full-text search within extracted document content via DocumentChunks
    if q and q.strip():
        from app.models.embedding import DocumentChunk
        q_lower = q.strip().lower()
        # Get document IDs that have matching chunks
        matching_doc_ids: set[int] = set()
        for doc in docs:
            chunks = (
                db.query(DocumentChunk)
                .filter_by(document_id=doc.id)
                .all()
            )
            for chunk in chunks:
                if chunk.chunk_text and q_lower in chunk.chunk_text.lower():
                    matching_doc_ids.add(doc.id)
                    break
            # Also search extracted title/authors
            if (doc.extracted_title and q_lower in doc.extracted_title.lower()) or \
               (doc.original_filename and q_lower in doc.original_filename.lower()):
                matching_doc_ids.add(doc.id)
        docs = [d for d in docs if d.id in matching_doc_ids]

    return [_doc_out(d) for d in docs]


@router.get("/search")
def search_within_documents(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Search within the text content of uploaded documents."""
    from app.models.embedding import DocumentChunk
    if not q.strip():
        return []

    q_lower = q.strip().lower()
    docs = (
        db.query(UploadedDocument)
        .filter_by(user_id=current_user.id, status="completed")
        .all()
    )
    results = []
    for doc in docs:
        chunks = (
            db.query(DocumentChunk)
            .filter_by(document_id=doc.id)
            .all()
        )
        matching_excerpts = []
        for chunk in chunks:
            if chunk.chunk_text and q_lower in chunk.chunk_text.lower():
                # Find position and extract context
                idx = chunk.chunk_text.lower().find(q_lower)
                start = max(0, idx - 80)
                end = min(len(chunk.chunk_text), idx + len(q_lower) + 80)
                excerpt = chunk.chunk_text[start:end]
                matching_excerpts.append({
                    "page": chunk.page_number,
                    "section": chunk.section_heading,
                    "excerpt": excerpt,
                })
        if matching_excerpts:
            results.append({
                "document": _doc_out(doc),
                "match_count": len(matching_excerpts),
                "excerpts": matching_excerpts[:5],  # top 5 excerpts per doc
            })

    results.sort(key=lambda x: x["match_count"], reverse=True)
    return results


@router.get("/{doc_id}/file")
def serve_document_file(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Serve the raw PDF file for browser preview."""
    from fastapi.responses import FileResponse
    doc = db.query(UploadedDocument).filter_by(id=doc_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(doc.file_path, media_type="application/pdf", filename=doc.original_filename)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    doc = db.query(UploadedDocument).filter_by(id=doc_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Remove file if it exists
    if doc.file_path and os.path.isfile(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass
    db.delete(doc)
    db.commit()


def _doc_out(doc: UploadedDocument) -> dict:
    return {
        "id": doc.id,
        "filename": doc.filename,
        "original_filename": doc.original_filename,
        "status": doc.status,
        "file_size": doc.file_size,
        "created_at": doc.created_at.isoformat(),
        "paper_id": doc.paper_id,
        "extracted_title": doc.extracted_title,
        "extracted_authors": doc.extracted_authors,
    }
