from __future__ import annotations

import re
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api", tags=["recommendations"])

AFFECTIVE_KEYWORDS = [
    "emotion", "sentiment", "facial", "speech", "stress", "multimodal",
    "affective", "physiological", "recognition", "detection", "classification",
    "deep learning", "neural", "transformer", "cnn", "lstm", "attention",
    "eeg", "ecg", "expression", "valence", "arousal", "hci",
]


def _extract_terms(text: str) -> set[str]:
    words = set(re.findall(r'\b[a-z][a-z]{2,}\b', text.lower()))
    return words


def _similarity(terms_a: set[str], terms_b: set[str]) -> float:
    if not terms_a or not terms_b:
        return 0.0
    intersection = terms_a & terms_b
    union = terms_a | terms_b
    return len(intersection) / len(union)


def _reason(score: float, shared_terms: list[str], target_source: str) -> str:
    if not shared_terms:
        return "This paper covers related affective computing topics based on keyword analysis."
    top_terms = shared_terms[:4]
    reason_parts = [f"Shares research focus on: {', '.join(top_terms)}."]
    if score >= 0.3:
        reason_parts.append("Strong conceptual overlap with your saved research.")
    elif score >= 0.15:
        reason_parts.append("Moderate thematic similarity to your library.")
    else:
        reason_parts.append("Covers complementary affective computing topics.")
    return " ".join(reason_parts)


@router.get("/recommendations")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    # Saved papers (user's library)
    saved_papers = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
        .all()
    )

    if not saved_papers:
        return []

    saved_ids = {p.id for p in saved_papers}

    # Build combined user interest profile
    combined_text = " ".join(
        f"{p.title or ''} {p.abstract or ''}" for p in saved_papers
    )
    user_terms = _extract_terms(combined_text)

    # Candidate papers: from global pool (not in user's library)
    candidates = (
        db.query(ResearchPaper)
        .filter(~ResearchPaper.id.in_(saved_ids))
        .order_by(ResearchPaper.created_at.desc())
        .limit(200)
        .all()
    )

    if not candidates:
        return []

    # Score each candidate
    scored: list[tuple[float, ResearchPaper, list[str]]] = []
    for candidate in candidates:
        text = f"{candidate.title or ''} {candidate.abstract or ''}"
        candidate_terms = _extract_terms(text)
        shared = list(user_terms & candidate_terms)
        # Boost for affective computing terms
        affective_boost = sum(1 for kw in AFFECTIVE_KEYWORDS if kw in text.lower()) * 0.02
        score = min(1.0, _similarity(user_terms, candidate_terms) + affective_boost)
        if score > 0.05:
            scored.append((score, candidate, shared))

    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for score, paper, shared in scored[:12]:
        results.append({
            "paper": {
                "id": paper.id,
                "title": paper.title,
                "authors": paper.authors,
                "abstract": paper.abstract,
                "source": paper.source,
                "url": paper.url,
                "publication_year": paper.publication_year,
                "external_id": paper.external_id,
                "doi": paper.doi,
            },
            "reason": _reason(score, shared, paper.source),
            "score": round(score, 3),
        })

    return results
