from __future__ import annotations

import re
from collections import Counter

from app.services.insight_service import _keyword_candidates


THEME_KEYWORDS = {
    "Emotion recognition": ("emotion", "affective", "affect"),
    "Multimodal sensing": ("multimodal", "fusion", "vision", "speech", "audio"),
    "Context-aware sentiment": ("sentiment", "interaction", "context", "engagement"),
    "Human-centered design": ("design", "human", "interface", "user"),
}
METHOD_SIGNALS = {
    "Deep learning": ("deep learning", "neural network", "transformer"),
    "Multimodal fusion": ("multimodal", "audio-visual", "audio visual", "fusion"),
    "Benchmark evaluation": ("benchmark", "dataset", "corpus"),
    "Human-participant evaluation": ("user study", "participants", "participant", "human subjects", "usability study"),
    "Deployment evaluation": ("real-world", "real world", "deployment", "field study", "in-the-wild"),
}
STUDY_SIGNAL_TERMS = {
    "Approach": ("we propose", "we present", "we introduce", "we develop", "model", "algorithm", "transformer", "neural network", "architecture"),
    "Data": ("dataset", "data set", "corpus", "benchmark", "iemocap", "ravdess", "meld"),
    "Evaluation": ("evaluate", "evaluation", "f1 score", "accuracy", "precision", "recall", "auc", "participants", "user study"),
    "Deployment": ("real-world", "real world", "deployment", "field study", "in-the-wild", "laboratory", "lab setting"),
    "Limitations": ("limitation", "limitations", "limited", "challenge", "challenges", "future work", "remains unclear"),
}


def _evidence_strength(paper_count: int, source_count: int) -> str:
    if paper_count >= 5 and source_count >= 2:
        return "High"
    if paper_count >= 3:
        return "Moderate"
    return "Emerging"


def _build_themes(papers: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {name: [] for name in THEME_KEYWORDS}
    for paper in papers:
        combined = f"{paper.get('title') or ''} {paper.get('abstract') or ''}".lower()
        for theme_name, terms in THEME_KEYWORDS.items():
            if any(term in combined for term in terms):
                grouped[theme_name].append({
                    "title": paper.get("title") or "Untitled paper",
                    "source": paper.get("source") or "Unknown",
                    "publication_year": paper.get("publication_year"),
                    "url": paper.get("url"),
                })

    themes = []
    for name, supporting_papers in grouped.items():
        if not supporting_papers:
            continue
        sources = sorted({paper["source"] for paper in supporting_papers})
        publication_activity, publication_momentum, momentum_comparison = _publication_activity(supporting_papers)
        themes.append({
            "name": name,
            "paper_count": len(supporting_papers),
            "sources": sources,
            "evidence_strength": _evidence_strength(len(supporting_papers), len(sources)),
            "publication_activity": publication_activity,
            "publication_momentum": publication_momentum,
            "momentum_comparison": momentum_comparison,
            "papers": supporting_papers[:5],
        })

    return sorted(themes, key=lambda theme: (-theme["paper_count"], theme["name"]))


def _publication_activity(papers: list[dict]) -> tuple[list[dict], str, dict | None]:
    year_counts: Counter[int] = Counter()
    for paper in papers:
        year = paper.get("publication_year")
        if isinstance(year, int) and not isinstance(year, bool):
            year_counts[year] += 1

    activity = [
        {"year": year, "count": count}
        for year, count in sorted(year_counts.items())
    ]
    if len(activity) < 2:
        return activity, "Insufficient dated papers", None

    previous, latest = activity[-2:]
    if latest["count"] > previous["count"]:
        momentum = "Increasing"
    elif latest["count"] < previous["count"]:
        momentum = "Decreasing"
    else:
        momentum = "Stable"

    comparison = {
        "latest_year": latest["year"],
        "latest_count": latest["count"],
        "previous_year": previous["year"],
        "previous_count": previous["count"],
    }
    return activity, momentum, comparison


def _method_coverage(papers: list[dict]) -> list[dict]:
    coverage = []
    for name, terms in METHOD_SIGNALS.items():
        supporting_papers = []
        for paper in papers:
            combined = f"{paper.get('title') or ''} {paper.get('abstract') or ''}".lower()
            if any(term in combined for term in terms):
                supporting_papers.append({
                    "title": paper.get("title") or "Untitled paper",
                    "source": paper.get("source") or "Unknown",
                    "publication_year": paper.get("publication_year"),
                    "url": paper.get("url"),
                })
        if supporting_papers:
            coverage.append({
                "name": name,
                "paper_count": len(supporting_papers),
                "papers": supporting_papers[:5],
            })

    return sorted(coverage, key=lambda method: (-method["paper_count"], method["name"]))


def _study_extractions(papers: list[dict]) -> list[dict]:
    extractions = []
    for paper in papers:
        abstract = paper.get("abstract") or ""
        sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", abstract) if sentence.strip()]
        signals = []
        for category, terms in STUDY_SIGNAL_TERMS.items():
            evidence = [
                sentence
                for sentence in sentences
                if any(term in sentence.lower() for term in terms)
            ]
            if evidence:
                signals.append({"category": category, "evidence": evidence[:3]})

        if signals:
            extractions.append({
                "paper": {
                    "title": paper.get("title") or "Untitled paper",
                    "source": paper.get("source") or "Unknown",
                    "publication_year": paper.get("publication_year"),
                    "url": paper.get("url"),
                },
                "signals": signals,
            })

    return extractions


def _next_actions(papers: list[dict], method_coverage: list[dict]) -> list[str]:
    observed_methods = {method["name"] for method in method_coverage}
    actions = []
    gaps = [
        (
            "Deployment evaluation",
            "Check full texts for deployment evaluation; no explicit signal appeared in saved titles or abstracts.",
        ),
        (
            "Human-participant evaluation",
            "Check full texts for participant-based evaluation; no explicit signal appeared in saved titles or abstracts.",
        ),
        (
            "Benchmark evaluation",
            "Compare results on shared datasets or benchmarks; no explicit signal appeared in saved titles or abstracts.",
        ),
    ]
    actions.extend(action for name, action in gaps if name not in observed_methods)

    source_count = len({paper.get("source") for paper in papers if paper.get("source")})
    if source_count < 2:
        actions.append("Cross-check the current pattern against another academic source.")
    if not actions:
        actions = [
            "Validate the reported approaches across independent datasets and deployment settings.",
            "Compare findings across sources before treating the leading pattern as established.",
        ]

    return actions[:3]


def build_research_brief(papers: list[dict]) -> dict:
    if not papers:
        return {
            "title": "Evidence brief is waiting for saved papers.",
            "summary": "Save a few papers to start building a concise research brief for this topic.",
            "themes": [],
            "method_coverage": [],
            "study_extractions": [],
            "evidence_strength": "Emerging",
            "publication_activity": [],
            "publication_momentum": "Insufficient dated papers",
            "momentum_comparison": None,
            "next_actions": [
                "Collect at least three papers in the same research area.",
                "Compare methods used across publications before forming conclusions.",
            ],
        }

    themes = _build_themes(papers)
    method_coverage = _method_coverage(papers)
    study_extractions = _study_extractions(papers)
    publication_activity, publication_momentum, momentum_comparison = _publication_activity(papers)
    keywords = _keyword_candidates(papers)
    summary = (
        "The current evidence base points to a concentrated focus on emotion recognition, multimodal sensing, "
        "and adaptive interface design, with emerging support for context-aware affective systems."
    )
    next_actions = _next_actions(papers, method_coverage)
    if "emotion" not in " ".join(keywords).lower():
        next_actions.insert(0, "Rebalance the library toward emotion and affective-state papers to strengthen the evidence base.")

    return {
        "title": f"Evidence brief: {themes[0]['name']}" if themes else "Evidence brief: emerging research",
        "summary": summary,
        "themes": themes,
        "method_coverage": method_coverage,
        "study_extractions": study_extractions,
        "evidence_strength": _evidence_strength(len(papers), len({paper.get('source') for paper in papers if paper.get('source')})),
        "publication_activity": publication_activity,
        "publication_momentum": publication_momentum,
        "momentum_comparison": momentum_comparison,
        "next_actions": next_actions[:3],
    }
