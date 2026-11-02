from __future__ import annotations

import re
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper, SavedPaper
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api", tags=["analytics"])

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "this", "that", "these",
    "those", "it", "its", "we", "our", "their", "they", "as", "not", "no",
    "using", "based", "via", "through", "into", "both", "which", "such",
    "also", "more", "most", "than", "about", "than", "up", "used", "use",
    "proposed", "approach", "method", "methods", "paper", "study", "results",
    "data", "model", "models", "system", "systems", "new", "different",
    "proposed", "present", "presents", "show", "shows", "two", "three",
    "while", "however", "furthermore", "thus", "hence", "therefore",
    "between", "among", "within", "across", "over", "under", "each",
    "work", "works", "performance", "high", "low", "large", "small",
}

AFFECTIVE_DOMAINS = {
    "Emotion Recognition": ["emotion recogni", "emotion detect"],
    "Facial Expression Recognition": ["facial expression", "face expression", "facial action"],
    "Speech Emotion Recognition": ["speech emotion", "vocal emotion", "audio emotion"],
    "Sentiment Analysis": ["sentiment analy", "opinion mining", "sentiment class"],
    "Stress Detection": ["stress detect", "stress recogni", "stress monitor"],
    "Multimodal Emotion Recognition": ["multimodal", "multi-modal", "fusion"],
    "Physiological Signal Analysis": ["physiological", "eeg", "ecg", "emg", "galvanic", "heart rate", "brainwave"],
    "Human-Computer Interaction": ["human-computer", "hci", "user interface", "affective computing"],
    "Healthcare Applications": ["healthcare", "clinical", "medical", "health", "patient", "therapy"],
    "Education Applications": ["education", "e-learning", "student", "learning", "classroom", "tutoring"],
}


def extract_keywords(text: str, top_n: int = 20) -> list[str]:
    words = re.findall(r'\b[a-z][a-z-]{2,}\b', text.lower())
    filtered = [w for w in words if w not in STOP_WORDS and len(w) > 3]
    counts = Counter(filtered)
    return [word for word, _ in counts.most_common(top_n)]


def classify_domain(text: str) -> list[str]:
    text_lower = text.lower()
    matched = []
    for domain, patterns in AFFECTIVE_DOMAINS.items():
        if any(p in text_lower for p in patterns):
            matched.append(domain)
    return matched


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    year_from: int | None = None,
    year_to: int | None = None,
    source: str | None = None,
    domain: str | None = None,
) -> dict:
    query = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == current_user.id)
    )
    if year_from is not None:
        query = query.filter(ResearchPaper.publication_year >= year_from)
    if year_to is not None:
        query = query.filter(ResearchPaper.publication_year <= year_to)
    if source:
        query = query.filter(ResearchPaper.source.ilike(f"%{source}%"))

    papers = query.all()

    # Optional domain filter: applied post-query on text
    if domain:
        papers = [
            p for p in papers
            if domain.lower() in f"{p.title or ''} {p.abstract or ''}".lower()
        ]

    if not papers:
        return {
            "total_papers": 0,
            "publications_by_year": [],
            "domain_distribution": [],
            "top_keywords": [],
            "source_distribution": [],
            "date_range": {"min_year": None, "max_year": None},
        }

    # Publications by year
    year_counts: Counter = Counter()
    years = []
    for p in papers:
        if p.publication_year:
            year_counts[p.publication_year] += 1
            years.append(p.publication_year)

    publications_by_year = [
        {"year": yr, "count": year_counts[yr]}
        for yr in sorted(year_counts.keys())
    ]

    # Source distribution
    source_counts: Counter = Counter(p.source for p in papers if p.source)
    source_distribution = [
        {"source": src, "count": cnt}
        for src, cnt in source_counts.most_common()
    ]

    # Domain distribution from titles + abstracts
    domain_counts: Counter = Counter()
    for p in papers:
        text = f"{p.title or ''} {p.abstract or ''}"
        for domain in classify_domain(text):
            domain_counts[domain] += 1

    domain_distribution = [
        {"domain": domain, "count": cnt}
        for domain, cnt in domain_counts.most_common()
    ]

    # Keyword extraction from all titles + abstracts
    all_text = " ".join(
        f"{p.title or ''} {p.abstract or ''}"
        for p in papers
    )
    top_keywords_list = extract_keywords(all_text, top_n=25)
    # Count how many papers each keyword appears in
    kw_paper_counts: Counter = Counter()
    for kw in top_keywords_list:
        for p in papers:
            text = f"{p.title or ''} {p.abstract or ''}".lower()
            if kw in text:
                kw_paper_counts[kw] += 1

    top_keywords = [
        {"keyword": kw, "count": kw_paper_counts.get(kw, 0)}
        for kw in top_keywords_list
        if kw_paper_counts.get(kw, 0) > 0
    ]
    top_keywords.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_papers": len(papers),
        "publications_by_year": publications_by_year,
        "domain_distribution": domain_distribution,
        "top_keywords": top_keywords[:20],
        "source_distribution": source_distribution,
        "date_range": {
            "min_year": min(years) if years else None,
            "max_year": max(years) if years else None,
        },
    }
