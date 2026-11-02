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


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return [c for c in chunks if c.strip()]


def _process_pdf_extraction(doc_id: int, file_path: str, db_url: str) -> None:
    """Background task: extract text from PDF using PyMuPDF, then create DocumentChunks."""
    from datetime import datetime as dt
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.embedding import DocumentChunk

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
            try:
                import pymupdf as fitz  # PyMuPDF ≥ 1.24
            except ImportError:
                import fitz  # PyMuPDF < 1.24 fallback
            pdf = fitz.open(file_path)
            text_parts: list[str] = []
            page_texts: list[tuple[int, str]] = []   # (page_number, text)
            for i, page in enumerate(pdf, start=1):
                t = page.get_text()
                text_parts.append(t)
                page_texts.append((i, t))
            pdf.close()
            full_text = "\n".join(text_parts)

            if len(full_text.strip()) < 50:
                doc.status = "failed"
                db.commit()
                return

            # Extract metadata heuristics
            title = _extract_title_from_text(full_text)
            authors = _extract_authors_from_text(full_text)
            doc.extracted_title = title
            doc.extracted_authors = authors

            # Delete old chunks if re-processing
            db.query(DocumentChunk).filter_by(document_id=doc_id).delete()
            db.commit()

            # Build chunks per page so we preserve page numbers
            chunk_index = 0
            for page_num, page_text in page_texts:
                if not page_text.strip():
                    continue
                for chunk_text in _chunk_text(page_text):
                    db.add(DocumentChunk(
                        document_id=doc_id,
                        paper_id=doc.paper_id,
                        chunk_index=chunk_index,
                        chunk_text=chunk_text,
                        page_number=page_num,
                        source_type="pdf",
                        created_at=dt.utcnow(),
                    ))
                    chunk_index += 1

            doc.status = "completed"

        except Exception as exc:
            doc.status = "failed"
            print(f"[PDF extraction] doc_id={doc_id} failed: {exc}")

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


@router.get("/{doc_id}/analysis")
def analyse_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return keyword frequencies, page distribution, top sentences and stats for an uploaded PDF."""
    import re as _re
    from collections import Counter

    doc = db.query(UploadedDocument).filter_by(id=doc_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "completed":
        raise HTTPException(status_code=400, detail="Document extraction not completed yet")

    from app.models.embedding import DocumentChunk
    chunks = db.query(DocumentChunk).filter_by(document_id=doc_id).order_by(DocumentChunk.chunk_index).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks found. Re-upload the document.")

    # --- Full text assembly ---
    full_text = " ".join(c.chunk_text for c in chunks)
    words_all = _re.findall(r"\b[a-zA-Z]{3,}\b", full_text.lower())
    total_words = len(words_all)
    total_chunks = len(chunks)
    page_numbers = [c.page_number for c in chunks if c.page_number]
    total_pages = max(page_numbers) if page_numbers else 0

    # --- Stop-word removal ---
    STOPWORDS = {
        "the","and","for","with","this","that","from","are","was","were","have","has","been","which",
        "they","their","there","into","also","such","can","its","more","will","but","not","any","all",
        "our","these","about","than","when","some","each","most","may","use","used","using","based",
        "two","one","new","paper","show","shows","propose","proposed","however","while","between",
        "both","other","data","results","research","approach","methods","method","model","models",
        "learning","deep","neural","network","networks","system","systems","different","study",
        "studies","work","works","high","low","large","small","number","set","using","present",
        "through","show","found","significant","analysis","propose","task","approach","training",
        "test","performance","evaluation","dataset","datasets","feature","features","attention",
        "human","recognition","emotion","emotions","facial","expression","expressions","affective",
    }
    filtered = [w for w in words_all if w not in STOPWORDS and len(w) > 3]

    # --- Keyword frequencies (top 20) ---
    kw_counter = Counter(filtered)
    top_keywords = [{"keyword": w, "count": c} for w, c in kw_counter.most_common(20)]

    # --- Page-wise chunk/word distribution ---
    page_counter: Counter = Counter()
    page_words: Counter = Counter()
    for chunk in chunks:
        pn = chunk.page_number or 0
        page_counter[pn] += 1
        page_words[pn] += len(_re.findall(r"\b\w+\b", chunk.chunk_text))
    page_distribution = [
        {"page": p, "chunks": page_counter[p], "words": page_words[p]}
        for p in sorted(page_counter)
        if p > 0
    ][:50]   # cap at 50 pages for chart readability

    # --- Section distribution (from section_heading column) ---
    section_counter: Counter = Counter()
    for chunk in chunks:
        heading = (chunk.section_heading or "").strip()
        if heading:
            section_counter[heading] += 1
        else:
            section_counter["(unlabelled)"] += 1
    section_distribution = [
        {"section": s, "count": c}
        for s, c in section_counter.most_common(10)
    ]

    # --- Top key sentences (longest, most informative chunks) ---
    def _sentence_score(text: str) -> float:
        words = _re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
        unique = len(set(words))
        return unique / max(len(words), 1) * len(words)

    scored = sorted(chunks, key=lambda c: _sentence_score(c.chunk_text), reverse=True)
    top_sentences = []
    seen_starts: set[str] = set()
    for chunk in scored:
        start = chunk.chunk_text[:40]
        if start in seen_starts:
            continue
        seen_starts.add(start)
        # Pick first full sentence from chunk
        sentences = _re.split(r"(?<=[.!?])\s+", chunk.chunk_text.strip())
        best = max(sentences, key=len) if sentences else chunk.chunk_text
        best = best.strip()
        if len(best) > 60:
            top_sentences.append({
                "text": best[:300],
                "page": chunk.page_number,
                "section": chunk.section_heading or None,
            })
        if len(top_sentences) >= 8:
            break

    return {
        "document_id": doc_id,
        "original_filename": doc.original_filename,
        "extracted_title": doc.extracted_title,
        "extracted_authors": doc.extracted_authors,
        "stats": {
            "total_pages": total_pages,
            "total_chunks": total_chunks,
            "total_words": total_words,
            "unique_keywords": len(kw_counter),
        },
        "top_keywords": top_keywords,
        "page_distribution": page_distribution,
        "section_distribution": section_distribution,
        "top_sentences": top_sentences,
    }
