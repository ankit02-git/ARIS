from __future__ import annotations

import re
from collections import Counter


def _source_breakdown(papers: list[dict]) -> list[dict[str, int | str]]:
    counts: Counter[str] = Counter()
    for paper in papers:
        source = (paper.get("source") or "Unknown").strip() or "Unknown"
        counts[source] += 1

    return [
        {"source": source, "count": count}
        for source, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]

STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "into",
    "using",
    "study",
    "studies",
    "paper",
    "papers",
    "research",
    "system",
    "systems",
    "based",
    "analysis",
    "model",
    "models",
    "data",
    "more",
    "than",
    "have",
    "over",
    "their",
    "there",
    "been",
    "within",
    "under",
    "across",
    "through",
    "after",
    "during",
    "between",
    "without",
    "about",
    "among",
    "which",
    "where",
    "when",
    "what",
    "how",
    "are",
    "was",
    "were",
    "will",
    "into",
    "out",
    "our",
    "your",
    "also",
    "such",
    "these",
    "those",
    "shows",
    "show",
    "used",
    "use",
    "results",
    "result",
    "methods",
    "method",
    "approach",
    "approaches",
    "new",
    "novel",
}


def _tokenize(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    tokens = [token for token in cleaned.split() if len(token) > 2 and token not in STOP_WORDS]
    return tokens


def _keyword_candidates(papers: list[dict]) -> list[str]:
    return [entry["term"] for entry in _keyword_evidence(papers)]


def _keyword_evidence(papers: list[dict]) -> list[dict]:
    supporting: dict[str, list[dict]] = {}
    for paper in papers:
        combined = f"{paper.get('title') or ''} {paper.get('abstract') or ''}"
        for term in set(_tokenize(combined)):
            supporting.setdefault(term, []).append({
                "title": paper.get("title") or "Untitled paper",
                "source": paper.get("source") or "Unknown",
                "url": paper.get("url"),
            })

    ranked_terms = sorted(supporting, key=lambda term: (-len(supporting[term]), term))[:8]
    return [
        {"term": term, "paper_count": len(supporting[term]), "papers": supporting[term][:5]}
        for term in ranked_terms
    ]


def _method_focus(keyword_evidence: list[dict]) -> list[str]:
    term_counts = {entry["term"]: entry["paper_count"] for entry in keyword_evidence}
    focus = []
    if "multimodal" in term_counts or "fusion" in term_counts:
        count = max(term_counts.get("multimodal", 0), term_counts.get("fusion", 0))
        focus.append(f"Multimodal/fusion terms appear in {count} saved papers")
    if "emotion" in term_counts or "affective" in term_counts:
        count = max(term_counts.get("emotion", 0), term_counts.get("affective", 0))
        focus.append(f"Emotion/affective terms appear in {count} saved papers")
    if "sentiment" in term_counts or "interaction" in term_counts:
        count = max(term_counts.get("sentiment", 0), term_counts.get("interaction", 0))
        focus.append(f"Sentiment/interaction terms appear in {count} saved papers")
    return focus[:3]


def _research_gaps(keywords: list[str]) -> list[str]:
    gaps = []
    if "multimodal" not in keywords:
        gaps.append("No explicit 'multimodal' term appeared in the saved titles/abstracts; verify full text before treating this as a gap.")
    if "emotion" not in keywords and "affective" not in keywords:
        gaps.append("No explicit emotion/affective term appeared in the saved titles/abstracts; review the query scope and full text.")
    if "real" not in keywords and "context" not in keywords:
        gaps.append("No explicit real-world/context term appeared in the saved titles/abstracts; inspect study settings before inferring a coverage gap.")
    return gaps[:3]


def _build_summary(keyword_evidence: list[dict], papers: list[dict]) -> dict:
    keywords = [entry["term"] for entry in keyword_evidence]
    source_breakdown = _source_breakdown(papers)
    source_count = len(source_breakdown)
    top_terms = keyword_evidence[:3]
    if top_terms:
        term_summary = ", ".join(
            f"{entry['term']} ({entry['paper_count']}/{len(papers)} papers)"
            for entry in top_terms
        )
        headline = f"Observed terms: {', '.join(entry['term'] for entry in top_terms)}"
        overview = (
            f"Across {len(papers)} saved papers from {source_count} sources, the most frequent title/abstract terms are {term_summary}. "
            "Term frequency describes this saved sample only; it does not establish publication momentum, study quality, or a causal finding."
        )
        trend_focus = f"Most frequent terms in the saved sample: {term_summary}. This is term frequency, not a time trend."
        recommendations = [
            f"Review the {entry['paper_count']} papers containing '{entry['term']}' to verify how consistently the term is used."
            for entry in top_terms[:2]
        ]
        recommendations.append("Compare original methods and evaluation sections before drawing conclusions from abstract-level patterns.")
    else:
        headline = "No recurring terms found in the saved research sample."
        overview = f"The library contains {len(papers)} saved papers, but no usable title or abstract terms were extracted."
        trend_focus = "No term-frequency signal is available for this saved sample."
        recommendations = [
            "Check whether saved records include titles and abstracts.",
            "Refine the search query to match the intended research topic.",
            "Review papers directly before drawing conclusions.",
        ]

    method_focus = _method_focus(keyword_evidence)
    research_gaps = _research_gaps(keywords)

    return {
        "headline": headline,
        "overview": overview,
        "keywords": [term.title() if term.isalpha() else term for term in keywords[:6]],
        "keyword_evidence": keyword_evidence[:6],
        "paper_count": len(papers),
        "source_count": source_count,
        "recommendations": recommendations,
        "source_breakdown": source_breakdown,
        "trend_focus": trend_focus,
        "method_focus": method_focus,
        "research_gaps": research_gaps,
    }


def build_research_summary(papers: list[dict]) -> dict:
    if not papers:
        return {
            "headline": "Your research library is still empty.",
            "overview": "Add a few papers to begin synthesizing the dominant themes across affective computing research.",
            "keywords": ["Emotion", "Affective", "Multimodal"],
            "recommendations": [
                "Save relevant papers with abstracts to establish an analyzable research sample.",
                "Compare original methods and evaluation sections before drawing conclusions.",
                "Use cited abstracts and source metadata to check whether the sample covers the topic you intend.",
            ],
            "keyword_evidence": [],
            "paper_count": 0,
            "source_count": 0,
            "source_breakdown": [{"source": "No data", "count": 0}],
            "trend_focus": "No term-frequency signal is available for this saved sample.",
            "method_focus": [],
            "research_gaps": [],
        }

    keyword_evidence = _keyword_evidence(papers)
    return _build_summary(keyword_evidence, papers)
