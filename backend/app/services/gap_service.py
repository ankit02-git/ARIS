from __future__ import annotations

"""
Research Gap Engine — identifies underrepresented topics, frequent limitations,
methodological gaps, and generates evidence-based research suggestions.

Every finding is labelled with:
- gap_type: limitation_pattern | underrepresented_topic | methodology_gap | emerging_topic
- evidence_strength: based on paper count
- supporting_papers: actual paper records

Findings are strictly evidence-based. We never claim a topic has never been studied
merely because it is absent from the current dataset.
"""

import re
from collections import Counter
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Domain vocabulary
# ---------------------------------------------------------------------------

AFFECTIVE_TOPICS = [
    "emotion recognition", "facial expression", "speech emotion", "sentiment analysis",
    "stress detection", "physiological signals", "eeg", "ecg", "heart rate",
    "multimodal", "fusion", "deep learning", "convolutional neural network",
    "transformer", "attention mechanism", "transfer learning", "bert",
    "real-time", "real world", "deployment", "clinical", "healthcare",
    "education", "children", "elderly", "cross-cultural", "multilingual",
    "interpretability", "explainability", "bias", "fairness",
    "human-computer interaction", "affective computing",
]

LIMITATION_KEYWORDS = [
    "limitation", "limitations", "limited", "challenge", "challenges",
    "drawback", "drawbacks", "constraint", "weakness", "weaknesses",
    "future work", "future research", "remains", "lack of",
    "small dataset", "insufficient data", "overfitting", "generalization",
    "computational cost", "real-world", "not generalize", "biased",
    "privacy", "subjective", "annotation", "inter-annotator",
]

METHODOLOGY_TYPES = {
    "Convolutional Neural Network (CNN)": ["cnn", "convolutional neural"],
    "Recurrent Neural Network (RNN/LSTM)": ["lstm", "rnn", "gru", "recurrent"],
    "Transformer / Attention": ["transformer", "attention mechanism", "bert", "vit"],
    "Support Vector Machine (SVM)": ["svm", "support vector"],
    "Random Forest / Ensemble": ["random forest", "ensemble", "boosting"],
    "Multimodal Fusion": ["multimodal", "audio-visual", "fusion"],
    "Transfer Learning": ["transfer learning", "fine-tuning", "pretrained"],
    "Graph Neural Network": ["graph neural", "gcn", "gnn"],
    "Generative Models (GAN/VAE)": ["gan", "generative adversarial", "vae", "variational"],
    "Rule-Based / Feature Engineering": ["hand-crafted", "feature engineering", "hog", "lbp", "mfcc"],
}

RESEARCH_DOMAINS = {
    "Emotion Recognition": ["emotion recogni", "emotion detect", "emotion classif"],
    "Facial Expression Recognition": ["facial expression", "face expression", "facial action unit"],
    "Speech Emotion Recognition": ["speech emotion", "vocal emotion", "audio emotion"],
    "Sentiment Analysis": ["sentiment", "opinion mining"],
    "Stress Detection": ["stress detect", "stress recogni", "stress monitor"],
    "Multimodal": ["multimodal", "multi-modal"],
    "Physiological Signals": ["physiological", "eeg", "ecg", "emg", "galvanic"],
    "HCI": ["human-computer", "hci"],
    "Healthcare": ["healthcare", "clinical", "medical", "therapy"],
    "Education": ["education", "e-learning", "student"],
}

# Topics that should be represented but may be absent
EMERGING_TOPICS = [
    ("Explainability / Interpretability", ["explainabl", "interpretab", "xai", "explain"]),
    ("Cross-Cultural Emotion Recognition", ["cross-cultural", "cultural difference", "multicultural"]),
    ("Privacy-Preserving Methods", ["privacy", "federated", "differential privacy", "anonymi"]),
    ("Bias and Fairness", ["bias", "fairness", "fair", "demographic", "equity"]),
    ("Real-World / In-the-Wild", ["real-world", "in-the-wild", "naturalistic", "uncontrolled"]),
    ("Elderly / Special Populations", ["elderly", "older adult", "children", "autism", "dementia"]),
    ("Edge Deployment / Mobile", ["edge device", "mobile", "embedded", "iot", "low-power"]),
    ("Continual / Online Learning", ["continual learning", "online learning", "incremental"]),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _evidence_strength(count: int) -> str:
    if count >= 10:
        return "Strong"
    if count >= 5:
        return "Moderate"
    if count >= 2:
        return "Emerging"
    return "Weak"


def _extract_limitation_sentences(abstract: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', abstract)
    return [
        s.strip() for s in sentences
        if any(kw in s.lower() for kw in LIMITATION_KEYWORDS)
    ]


def _paper_stub(paper) -> dict:
    return {
        "id": paper.id,
        "title": paper.title,
        "source": paper.source,
        "year": paper.publication_year,
        "url": paper.url,
        "doi": paper.doi,
    }


# ---------------------------------------------------------------------------
# Gap analysis functions
# ---------------------------------------------------------------------------

def _limitation_patterns(papers) -> list[dict]:
    """Find the most frequently reported limitations."""
    # Collect limitation sentences per category
    pattern_papers: dict[str, list] = {}
    excerpts: dict[str, list[str]] = {}

    for paper in papers:
        text = f"{paper.abstract or ''}"
        if not text.strip():
            continue
        sentences = _extract_limitation_sentences(text)
        for sentence in sentences:
            sl = sentence.lower()
            # Categorize
            if any(kw in sl for kw in ["small dataset", "insufficient data", "lack of data", "limited data"]):
                cat = "Limited training data"
            elif any(kw in sl for kw in ["generali", "not generalize", "domain gap"]):
                cat = "Limited generalizability"
            elif any(kw in sl for kw in ["real-world", "real world", "controlled", "lab setting"]):
                cat = "Lab-controlled conditions only"
            elif any(kw in sl for kw in ["computational", "real-time", "latency", "cost"]):
                cat = "Computational constraints"
            elif any(kw in sl for kw in ["annotation", "subjectiv", "label", "inter-annotator"]):
                cat = "Annotation subjectivity"
            elif any(kw in sl for kw in ["privacy", "ethical", "consent"]):
                cat = "Privacy and ethics"
            elif any(kw in sl for kw in ["cross-cultural", "cultural", "language"]):
                cat = "Cultural / linguistic limitations"
            else:
                cat = "General limitations"

            pattern_papers.setdefault(cat, [])
            if paper not in pattern_papers[cat]:
                pattern_papers[cat].append(paper)
            excerpts.setdefault(cat, [])
            if sentence not in excerpts[cat]:
                excerpts[cat].append(sentence[:300])

    results = []
    for cat, cat_papers in pattern_papers.items():
        if len(cat_papers) < 1:
            continue
        results.append({
            "gap_type": "limitation_pattern",
            "title": cat,
            "description": (
                f"Researchers in {len(cat_papers)} paper(s) explicitly report this limitation. "
                "This represents a recurring constraint in the collected evidence base."
            ),
            "evidence_strength": _evidence_strength(len(cat_papers)),
            "supporting_paper_count": len(cat_papers),
            "supporting_papers": [_paper_stub(p) for p in cat_papers[:5]],
            "excerpts": excerpts[cat][:3],
            "research_suggestion": _suggest_for_limitation(cat),
        })

    return sorted(results, key=lambda x: -x["supporting_paper_count"])[:8]


def _suggest_for_limitation(category: str) -> str:
    suggestions = {
        "Limited training data": "Explore data augmentation, semi-supervised learning, or synthetic data generation techniques.",
        "Limited generalizability": "Evaluate models on diverse, cross-domain, or out-of-distribution datasets.",
        "Lab-controlled conditions only": "Design field studies or collect naturalistic (in-the-wild) data to validate findings.",
        "Computational constraints": "Investigate model compression, quantization, or knowledge distillation for edge deployment.",
        "Annotation subjectivity": "Apply inter-annotator agreement measures and develop clearer annotation protocols.",
        "Privacy and ethics": "Investigate federated learning, differential privacy, or on-device processing approaches.",
        "Cultural / linguistic limitations": "Develop cross-cultural datasets and evaluate on multilingual or diverse populations.",
        "General limitations": "A systematic review of recurring constraints could help define priority directions.",
    }
    return suggestions.get(category, "Further investigation of this constraint is warranted.")


def _underrepresented_topics(papers) -> list[dict]:
    """Find affective computing topics not well covered in the current corpus."""
    domain_counts: Counter = Counter()
    domain_papers: dict[str, list] = {d: [] for d in RESEARCH_DOMAINS}

    for paper in papers:
        text = f"{paper.title or ''} {paper.abstract or ''}".lower()
        for domain, patterns in RESEARCH_DOMAINS.items():
            if any(p in text for p in patterns):
                domain_counts[domain] += 1
                domain_papers[domain].append(paper)

    if not domain_counts:
        return []

    max_count = max(domain_counts.values())
    results = []
    for domain, count in domain_counts.items():
        if count == 0:
            # Completely absent
            results.append({
                "gap_type": "underrepresented_topic",
                "title": f"{domain} — not represented in current corpus",
                "description": (
                    f"No papers in the current collection explicitly address {domain}. "
                    "Note: absence from this dataset does not mean this area is unstudied in the broader literature."
                ),
                "evidence_strength": "Weak",
                "supporting_paper_count": 0,
                "supporting_papers": [],
                "excerpts": [],
                "research_suggestion": f"Search for {domain} research to determine whether this is a genuine gap or a collection bias.",
            })
        elif count < max_count * 0.2:
            # Underrepresented relative to dominant topics
            results.append({
                "gap_type": "underrepresented_topic",
                "title": f"{domain} — underrepresented relative to dominant topics",
                "description": (
                    f"Only {count} paper(s) in the current collection address {domain}, "
                    f"compared to up to {max_count} for the dominant topic. "
                    "This may reflect a gap in the collected literature."
                ),
                "evidence_strength": _evidence_strength(count),
                "supporting_paper_count": count,
                "supporting_papers": [_paper_stub(p) for p in domain_papers[domain][:3]],
                "excerpts": [],
                "research_suggestion": f"Expand the literature corpus on {domain} to verify whether this is a genuine research gap.",
            })

    return results[:6]


def _methodology_gaps(papers) -> list[dict]:
    """Find methodological combinations that are absent or rare."""
    method_counts: Counter = Counter()
    method_papers: dict[str, list] = {m: [] for m in METHODOLOGY_TYPES}

    for paper in papers:
        text = f"{paper.title or ''} {paper.abstract or ''}".lower()
        for method, patterns in METHODOLOGY_TYPES.items():
            if any(p in text for p in patterns):
                method_counts[method] += 1
                method_papers[method].append(paper)

    if not method_counts:
        return []

    dominant = [m for m, c in method_counts.most_common(3)]
    absent_methods = [m for m in METHODOLOGY_TYPES if method_counts[m] == 0]

    results = []
    # Highlight absent methodologies
    for method in absent_methods[:4]:
        results.append({
            "gap_type": "methodology_gap",
            "title": f"{method} — not used in current collection",
            "description": (
                f"No papers in the current collection use {method}. "
                "This may represent an unexplored methodological direction for affective computing research."
            ),
            "evidence_strength": "Weak",
            "supporting_paper_count": 0,
            "supporting_papers": [],
            "excerpts": [],
            "research_suggestion": f"Investigate whether {method} could offer advantages in affective computing tasks.",
        })

    # Dominant vs rare combination gap
    if dominant and absent_methods:
        gap = {
            "gap_type": "methodology_gap",
            "title": f"Methodological concentration: {', '.join(dominant[:2])}",
            "description": (
                f"The current collection is dominated by {', '.join(dominant[:2])} ({method_counts[dominant[0]]} papers). "
                f"Alternative approaches ({', '.join(absent_methods[:3])}) are absent, "
                "suggesting possible methodological diversity opportunities."
            ),
            "evidence_strength": _evidence_strength(method_counts[dominant[0]]),
            "supporting_paper_count": method_counts[dominant[0]],
            "supporting_papers": [_paper_stub(p) for p in method_papers[dominant[0]][:3]],
            "excerpts": [],
            "research_suggestion": "Comparative studies across methodological families may reveal under-explored trade-offs.",
        }
        results.append(gap)

    return results[:5]


def _emerging_topic_gaps(papers) -> list[dict]:
    """Check for emerging/important topics absent from the corpus."""
    results = []

    for topic_name, patterns in EMERGING_TOPICS:
        matching = [
            p for p in papers
            if any(pat in f"{p.title or ''} {p.abstract or ''}".lower() for pat in patterns)
        ]
        if len(matching) == 0:
            results.append({
                "gap_type": "emerging_topic",
                "title": f"{topic_name} — not found in current collection",
                "description": (
                    f"No papers in the current collection explicitly address {topic_name}. "
                    "This is an active area of concern in affective computing research generally."
                ),
                "evidence_strength": "Weak",
                "supporting_paper_count": 0,
                "supporting_papers": [],
                "excerpts": [],
                "research_suggestion": f"Search for {topic_name} research in affective computing to identify relevant work.",
            })
        elif len(matching) < 3:
            results.append({
                "gap_type": "emerging_topic",
                "title": f"{topic_name} — limited representation ({len(matching)} paper(s))",
                "description": (
                    f"Only {len(matching)} paper(s) in the current collection address {topic_name}. "
                    "This is an increasingly important direction in the field."
                ),
                "evidence_strength": _evidence_strength(len(matching)),
                "supporting_paper_count": len(matching),
                "supporting_papers": [_paper_stub(p) for p in matching],
                "excerpts": [],
                "research_suggestion": f"Broader coverage of {topic_name} would strengthen the evidence base.",
            })

    return results[:6]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def analyze_research_gaps(db: "Session", user_id: int) -> dict:
    """
    Full gap analysis for a user's saved library.
    Returns a structured gap report.
    """
    from app.models.paper import ResearchPaper, SavedPaper

    papers = (
        db.query(ResearchPaper)
        .join(SavedPaper, SavedPaper.paper_id == ResearchPaper.id)
        .filter(SavedPaper.user_id == user_id)
        .all()
    )

    if len(papers) < 3:
        return {
            "total_papers": len(papers),
            "sufficient_data": False,
            "message": "At least 3 saved papers are needed for gap analysis. Save more papers to your library.",
            "gaps": [],
        }

    gaps = []
    gaps.extend(_limitation_patterns(papers))
    gaps.extend(_underrepresented_topics(papers))
    gaps.extend(_methodology_gaps(papers))
    gaps.extend(_emerging_topic_gaps(papers))

    # Sort: high evidence first, then by type priority
    type_priority = {"limitation_pattern": 0, "methodology_gap": 1, "underrepresented_topic": 2, "emerging_topic": 3}
    strength_priority = {"Strong": 0, "Moderate": 1, "Emerging": 2, "Weak": 3}
    gaps.sort(key=lambda g: (type_priority.get(g["gap_type"], 9), strength_priority.get(g["evidence_strength"], 9)))

    return {
        "total_papers": len(papers),
        "sufficient_data": True,
        "message": f"Gap analysis based on {len(papers)} saved papers.",
        "gaps": gaps[:20],
        "disclaimer": (
            "Findings are based solely on the current collection of saved papers. "
            "Absence of a topic from this dataset does not mean it is unstudied in the broader literature. "
            "Limitation patterns come from explicit researcher statements in abstracts."
        ),
    }
