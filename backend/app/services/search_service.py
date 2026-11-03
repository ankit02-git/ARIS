from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError

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
    """Search all academic providers in parallel to reduce latency."""
    providers = [
        search_arxiv,
        search_crossref,
        search_semantic_scholar,
        search_pubmed,
    ]
    per_provider = max(1, int(limit / len(providers)))
    results: list[dict] = []

    # Run all providers concurrently with a 8-second hard timeout
    with ThreadPoolExecutor(max_workers=len(providers)) as executor:
        futures = {
            executor.submit(provider, query, per_provider): provider.__name__
            for provider in providers
        }
        for future in as_completed(futures, timeout=8):
            try:
                results.extend(future.result())
            except Exception:
                continue

    ordered = sorted(
        dedupe_records(results),
        key=lambda item: (item.get("publication_year") or 0, item.get("source", "")),
        reverse=True,
    )
    return ordered[:limit]
