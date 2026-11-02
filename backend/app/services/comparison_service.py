from __future__ import annotations

import re
from collections import Counter
from math import log1p, sqrt
from pathlib import Path
from typing import Any

from app.core.config import settings

_STOP_WORDS = {
    "about", "across", "after", "also", "among", "and", "are", "based", "been", "between", "both",
    "can", "data", "during", "each", "from", "have", "into", "its", "more", "most", "not", "our",
    "paper", "papers", "results", "study", "studies", "their", "these", "this", "those", "through",
    "using", "was", "were", "with", "within", "without", "which", "while", "will", "would",
}
_embedding_model: Any | None = None


def _normalize(vector: list[float]) -> list[float]:
    norm = sqrt(sum(value * value for value in vector))
    if not norm:
        return vector
    return [value / norm for value in vector]


def _lexical_vectors(texts: list[str]) -> list[list[float]]:
    tokens_by_text = [
        [token for token in re.findall(r"[a-z][a-z-]{2,}", text.lower()) if token not in _STOP_WORDS]
        for text in texts
    ]
    document_frequency: Counter[str] = Counter()
    for tokens in tokens_by_text:
        document_frequency.update(set(tokens))
    vocabulary = sorted(document_frequency)
    if not vocabulary:
        return [[] for _ in texts]

    vectors = []
    for tokens in tokens_by_text:
        term_counts = Counter(tokens)
        vectors.append(_normalize([
            log1p(term_counts[token]) * log1p(len(texts) / (1 + document_frequency[token]))
            if term_counts[token] else 0.0
            for token in vocabulary
        ]))
    return vectors


def _get_embedding_model() -> Any:
    global _embedding_model
    if _embedding_model is None:
        from fastembed import TextEmbedding

        cache_dir = settings.semantic_cache_dir or str(Path.home() / ".cache" / "aris" / "fastembed")
        _embedding_model = TextEmbedding(model_name=settings.semantic_model, cache_dir=cache_dir)
    return _embedding_model


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right))))


def _split_sentences(abstract: str | None) -> list[str]:
    return [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+|\n+", abstract or "") if sentence.strip()]


def _build_result(
    papers: list[Any],
    vectors: list[list[float]],
    sentences_by_paper: list[list[str]],
    sentence_vectors: list[list[list[float]]],
    method: str,
    note: str,
) -> dict:
    vectors = [_normalize(vector) for vector in vectors]
    mean_vector = _normalize([
        sum(vector[index] for vector in vectors) / len(vectors)
        for index in range(len(vectors[0]))
    ]) if vectors and vectors[0] else []

    papers_result = []
    for paper, vector in zip(papers, vectors):
        papers_result.append({
            "paper_id": paper.id,
            "title": paper.title,
            "similarity": round(_cosine(vector, mean_vector), 4),
        })

    pairwise = []
    for left_index, left in enumerate(papers):
        for right_index in range(left_index + 1, len(papers)):
            pair = {
                "left_paper_id": left.id,
                "right_paper_id": papers[right_index].id,
                "score": round(_cosine(vectors[left_index], vectors[right_index]), 4),
                "left_evidence": None,
                "right_evidence": None,
                "evidence_score": None,
            }
            best_sentence_score = 0.0
            for left_sentence, left_sentence_vector in zip(sentences_by_paper[left_index], sentence_vectors[left_index]):
                if not any(left_sentence_vector):
                    continue
                for right_sentence, right_sentence_vector in zip(sentences_by_paper[right_index], sentence_vectors[right_index]):
                    if not any(right_sentence_vector):
                        continue
                    sentence_score = _cosine(left_sentence_vector, right_sentence_vector)
                    if sentence_score > best_sentence_score:
                        best_sentence_score = sentence_score
                        pair["left_evidence"] = left_sentence
                        pair["right_evidence"] = right_sentence
                        pair["evidence_score"] = round(sentence_score, 4)
            pairwise.append(pair)

    return {"method": method, "note": note, "papers": papers_result, "pairwise": pairwise}


def compare_papers(papers: list[Any]) -> dict:
    texts = [f"{paper.title}. {paper.abstract or ''}".strip() for paper in papers]
    sentences_by_paper = [_split_sentences(paper.abstract) for paper in papers]
    all_texts = texts + [sentence for sentences in sentences_by_paper for sentence in sentences]
    try:
        embeddings = list(_get_embedding_model().embed(all_texts))
        all_vectors = [list(map(float, embedding.tolist())) for embedding in embeddings]
        vectors = all_vectors[:len(papers)]
        offset = len(papers)
        sentence_vectors = []
        for sentences in sentences_by_paper:
            sentence_vectors.append(all_vectors[offset:offset + len(sentences)])
            offset += len(sentences)
        return _build_result(
            papers,
            vectors,
            sentences_by_paper,
            sentence_vectors,
            "local-semantic-embeddings",
            "Cosine similarity from a local sentence-embedding model. Closest sentence pairs are illustrative text matches, not proof of agreement or evidence quality.",
        )
    except Exception:
        all_vectors = _lexical_vectors(all_texts)
        vectors = all_vectors[:len(papers)]
        offset = len(papers)
        sentence_vectors = []
        for sentences in sentences_by_paper:
            sentence_vectors.append(all_vectors[offset:offset + len(sentences)])
            offset += len(sentences)
        return _build_result(
            papers,
            vectors,
            sentences_by_paper,
            sentence_vectors,
            "lexical-fallback",
            "Local semantic embeddings were unavailable; scores and closest sentence pairs use lexical overlap only, not semantic similarity or evidence quality.",
        )
