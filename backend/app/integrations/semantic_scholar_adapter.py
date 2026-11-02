from __future__ import annotations

import httpx

from app.integrations.utils import normalize_record


def search_semantic_scholar(query: str, limit: int = 5) -> list[dict]:
    params = {
        "query": query,
        "fields": "title,authors,abstract,year,url,externalIds,venue",
        "limit": limit,
    }
    try:
        response = httpx.get(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            params=params,
            timeout=20,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    payload = response.json()
    papers = payload.get("data", [])
    results: list[dict] = []
    for item in papers:
        authors = item.get("authors") or []
        author_names = [author.get("name") for author in authors if author.get("name")]
        record = normalize_record(
            title=item.get("title"),
            authors=", ".join(author_names),
            abstract=item.get("abstract"),
            source="Semantic Scholar",
            url=item.get("url"),
            publication_year=item.get("year"),
            doi=(item.get("externalIds") or {}).get("DOI") if item.get("externalIds") else None,
            external_id=(item.get("externalIds") or {}).get("DOI") if item.get("externalIds") else None,
            venue=item.get("venue"),
        )
        if record:
            results.append(record)
    return results
