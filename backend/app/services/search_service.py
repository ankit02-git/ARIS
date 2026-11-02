from __future__ import annotations

import re

from app.integrations.arxiv_adapter import search_arxiv
from app.integrations.crossref_adapter import search_crossref
from app.integrations.pubmed_adapter import search_pubmed
from app.integrations.semantic_scholar_adapter import search_semantic_scholar


def dedupe_records(records: list[dict]) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []

    for record in records:
        if not record.get("title"):
            continue
        key = (
            str(record.get("doi") or "")
            or str(record.get("external_id") or "")
            or re.sub(r"\s+", " ", record["title"]).lower()
        )
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(record)
    return merged


def search_academic_papers(query: str, limit: int = 5) -> list[dict]:
    providers = [
        search_arxiv,
        search_crossref,
        search_semantic_scholar,
        search_pubmed,
    ]
    results: list[dict] = []
    per_provider = max(1, int(limit / len(providers)))

    for provider in providers:
        try:
            results.extend(provider(query, limit=per_provider))
        except Exception:
            continue

    ordered = sorted(
        dedupe_records(results),
        key=lambda item: (item.get("publication_year") or 0, item.get("source", "")),
        reverse=True,
    )
    return ordered[:limit]
