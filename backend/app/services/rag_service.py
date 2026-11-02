from __future__ import annotations

"""
RAG (Retrieval-Augmented Generation) pipeline for the AI Research Assistant.

Flow:
1. Embed the user question.
2. Retrieve top-k similar paper chunks from FAISS / DB fallback.
3. Build a context prompt from retrieved evidence.
4. Send to Ollama (or fall back to rule-based extraction).
5. Return answer with citations.
"""

import logging
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

CHUNK_SIZE = 400   # characters per chunk
CHUNK_OVERLAP = 80


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character chunks."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def get_or_create_chunks(
    paper_id: int,
    title: str,
    abstract: str | None,
    db: "Session",
    source_type: str = "abstract",
) -> list[str]:
    """Return existing chunks or create them for a paper's abstract."""
    from app.models.embedding import DocumentChunk

    existing = db.query(DocumentChunk).filter_by(paper_id=paper_id, source_type=source_type).all()
    if existing:
        return [c.chunk_text for c in existing]

    text = f"Title: {title}\n\n{abstract or ''}".strip()
    if not text or len(text) < 50:
        return []

    chunks = chunk_text(text)
    for i, chunk in enumerate(chunks):
        db.add(DocumentChunk(
            paper_id=paper_id,
            chunk_index=i,
            chunk_text=chunk,
            source_type=source_type,
        ))
    try:
        db.commit()
    except Exception:
        db.rollback()
    return chunks


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

@dataclass
class RetrievedChunk:
    paper_id: int
    title: str
    source: str
    year: int | None
    url: str | None
    chunk_text: str
    score: float
    chunk_index: int


def retrieve_relevant_chunks(
    query: str,
    paper_ids: list[int] | None,
    db: "Session",
    top_k: int = 6,
) -> list[RetrievedChunk]:
    """
    Retrieve the most relevant chunks for a query.
    If paper_ids is given, restrict to those papers.
    Uses semantic search when FAISS index is available, falls back to keyword overlap.
    """
    from app.models.embedding import DocumentChunk
    from app.models.paper import ResearchPaper
    from app.services.embedding_service import semantic_search, embed_texts
    import numpy as np

    # Get papers to search over
    papers_query = db.query(ResearchPaper)
    if paper_ids:
        papers_query = papers_query.filter(ResearchPaper.id.in_(paper_ids))
    papers = papers_query.all()

    if not papers:
        return []

    # Ensure chunks exist
    for paper in papers:
        get_or_create_chunks(paper.id, paper.title, paper.abstract, db)

    # Try semantic retrieval
    semantic_results: dict[int, float] = {}

    candidate_ids = [p.id for p in papers]
    sem_hits = semantic_search(query, top_k=top_k * 3, db=db)
    for pid, score in sem_hits:
        if pid in candidate_ids or not paper_ids:
            semantic_results[pid] = score

    # Get chunks for ranked papers
    ranked_paper_ids = sorted(semantic_results, key=semantic_results.get, reverse=True)[:top_k]  # type: ignore
    if not ranked_paper_ids:
        # Fall back to all candidate papers
        ranked_paper_ids = candidate_ids[:top_k]

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.paper_id.in_(ranked_paper_ids))
        .order_by(DocumentChunk.paper_id, DocumentChunk.chunk_index)
        .all()
    )

    # Score chunks by keyword overlap when no semantic score
    query_words = set(re.findall(r'\b[a-z]{3,}\b', query.lower()))
    paper_map = {p.id: p for p in papers}

    results: list[RetrievedChunk] = []
    for chunk in chunks:
        paper = paper_map.get(chunk.paper_id)
        if not paper:
            continue
        sem_score = semantic_results.get(chunk.paper_id, 0.0)
        # Keyword boost
        chunk_words = set(re.findall(r'\b[a-z]{3,}\b', chunk.chunk_text.lower()))
        overlap = len(query_words & chunk_words) / max(1, len(query_words))
        score = sem_score * 0.7 + overlap * 0.3

        results.append(RetrievedChunk(
            paper_id=chunk.paper_id,
            title=paper.title,
            source=paper.source,
            year=paper.publication_year,
            url=paper.url,
            chunk_text=chunk.chunk_text,
            score=score,
            chunk_index=chunk.chunk_index,
        ))

    # Keep best chunk per paper, then sort
    best_by_paper: dict[int, RetrievedChunk] = {}
    for rc in results:
        if rc.paper_id not in best_by_paper or rc.score > best_by_paper[rc.paper_id].score:
            best_by_paper[rc.paper_id] = rc

    return sorted(best_by_paper.values(), key=lambda x: x.score, reverse=True)[:top_k]


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

def build_rag_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        year_str = f", {chunk.year}" if chunk.year else ""
        context_parts.append(
            f"[{i}] {chunk.title} ({chunk.source}{year_str})\n{chunk.chunk_text}"
        )

    context = "\n\n".join(context_parts)
    return (
        "You are an expert academic research assistant specializing in affective computing. "
        "Answer the following research question using ONLY the provided paper excerpts below. "
        "Cite papers by their [number] when you reference them. "
        "If the answer is not supported by the provided excerpts, clearly state that.\n\n"
        f"RESEARCH PAPERS:\n{context}\n\n"
        f"QUESTION: {question}\n\n"
        "ANSWER:"
    )


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def call_ollama(prompt: str, model: str, max_tokens: int = 600) -> str | None:
    try:
        import httpx
        resp = httpx.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.25, "num_predict": max_tokens},
            },
            timeout=90,
        )
        if resp.status_code == 200:
            return resp.json().get("response", "").strip()
    except Exception as exc:
        logger.warning("Ollama call failed: %s", exc)
    return None


def get_ollama_model() -> str | None:
    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=3)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            preferred = ["qwen2.5:1.5b", "qwen2.5:3b", "qwen2.5", "llama3.2:1b", "llama3.2"]
            for pref in preferred:
                if any(pref in m for m in models):
                    return pref
            return models[0] if models else None
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

_SIGNAL_PATTERNS = {
    "methodology": [
        "deep learning", "cnn", "convolutional", "lstm", "rnn", "transformer",
        "attention", "bert", "svm", "random forest", "neural network",
        "transfer learning", "ensemble", "hybrid", "gru", "resnet", "vgg",
    ],
    "dataset": [
        "ck+", "ck+48", "fer2013", "ravdess", "cremad", "iemocap", "aff-wild",
        "deap", "mahnob", "semeval", "sst", "meld", "emory", "affectnet",
    ],
    "limitation": [
        "limitation", "drawback", "challenge", "difficult", "future work",
        "lack of", "insufficient", "small dataset", "computational cost",
    ],
    "metric": [
        "accuracy", "f1 score", "precision", "recall", "auc", "rmse", "uar",
        "weighted accuracy", "mean opinion score", "concordance",
    ],
}


def rule_based_answer(question: str, chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return (
            "No relevant research content found. Save some papers to your library "
            "and select them as context to ask questions about them."
        )

    q = question.lower()
    lines = [f"Based on {len(chunks)} paper excerpt(s) retrieved:\n"]

    # Detect question type and extract relevant signals
    if any(kw in q for kw in ["method", "approach", "technique", "algorithm", "how"]):
        lines.append("**Methodologies found:**")
        found: dict[str, list[str]] = {}
        for chunk in chunks:
            text = chunk.chunk_text.lower()
            for method in _SIGNAL_PATTERNS["methodology"]:
                if method in text:
                    found.setdefault(method.title(), []).append(chunk.title)
        if found:
            for method, titles in list(found.items())[:8]:
                lines.append(f"- **{method}**: {'; '.join(set(titles))[:2]}")
        else:
            lines.append("No explicit methodology terms found in retrieved excerpts.")

    elif any(kw in q for kw in ["dataset", "data", "corpus", "benchmark"]):
        lines.append("**Datasets mentioned:**")
        found = {}
        for chunk in chunks:
            text = chunk.chunk_text.lower()
            for ds in _SIGNAL_PATTERNS["dataset"]:
                if ds in text:
                    found.setdefault(ds.upper(), []).append(chunk.title)
        if found:
            for ds, titles in list(found.items())[:6]:
                lines.append(f"- **{ds}**: {'; '.join(set(titles))}")
        else:
            lines.append("No well-known dataset names found in retrieved excerpts.")

    elif any(kw in q for kw in ["limitation", "challenge", "weakness", "drawback"]):
        lines.append("**Reported limitations:**")
        for chunk in chunks:
            text = chunk.chunk_text
            sentences = re.split(r'[.!?]\s+', text)
            for s in sentences:
                if any(kw in s.lower() for kw in _SIGNAL_PATTERNS["limitation"]):
                    lines.append(f"- [{chunk.title}]: {s.strip()}.")
                    break
        if len(lines) == 2:
            lines.append("No explicit limitation statements found in retrieved excerpts.")

    elif any(kw in q for kw in ["summary", "summarize", "overview", "what is"]):
        lines.append("**Paper summaries:**")
        for chunk in chunks[:4]:
            lines.append(f"\n**{chunk.title}** ({chunk.source}, {chunk.year or 'n.d.'})")
            lines.append(chunk.chunk_text[:300] + ("..." if len(chunk.chunk_text) > 300 else ""))

    elif any(kw in q for kw in ["compar", "differ", "contrast", "versus"]):
        lines.append("**Comparative overview:**")
        for chunk in chunks[:4]:
            lines.append(f"\n**{chunk.title}** ({chunk.source})")
            lines.append(chunk.chunk_text[:200] + "...")

    elif any(kw in q for kw in ["future", "research gap", "direction", "recommend"]):
        lines.append("**Future directions and gaps:**")
        for chunk in chunks:
            text = chunk.chunk_text
            sentences = re.split(r'[.!?]\s+', text)
            for s in sentences:
                if any(kw in s.lower() for kw in ["future", "gap", "further", "could", "should", "open question"]):
                    lines.append(f"- [{chunk.title}]: {s.strip()}.")
                    break

    else:
        lines.append("**Retrieved evidence:**")
        for chunk in chunks[:4]:
            lines.append(f"\n[{chunk.title} · {chunk.source}]")
            lines.append(chunk.chunk_text[:250] + "...")

    # Add citations
    lines.append("\n**Sources:**")
    seen = set()
    for chunk in chunks:
        if chunk.title not in seen:
            seen.add(chunk.title)
            url_part = f" — {chunk.url}" if chunk.url else ""
            lines.append(f"- {chunk.title} ({chunk.source}, {chunk.year or 'n.d.'}){url_part}")

    lines.append(
        "\n> *Rule-based extraction — install Ollama for AI-powered answers.*"
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main RAG entry point
# ---------------------------------------------------------------------------

def rag_answer(
    question: str,
    paper_ids: list[int] | None,
    db: "Session",
    conversation_history: list[dict] | None = None,
) -> tuple[str, list[RetrievedChunk]]:
    """
    Full RAG pipeline.
    Returns (answer_text, retrieved_chunks).
    """
    # Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(question, paper_ids, db, top_k=6)

    # Try Ollama
    model = get_ollama_model()
    if model and chunks:
        prompt = build_rag_prompt(question, chunks)
        answer = call_ollama(prompt, model)
        if answer:
            return answer, chunks

    # Fallback
    return rule_based_answer(question, chunks), chunks
