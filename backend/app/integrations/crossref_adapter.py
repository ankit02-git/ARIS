from __future__ import annotations

import httpx

from app.integrations.utils import normalize_record


def search_crossref(query: str, limit: int = 5) -> list[dict]:
    params = {
        "query.title": query,
        "select": "title,author,abstract,issued,DOI,URL,container-title",
        "rows": limit,
        "sort": "relevance",
    }
    try:
        response = httpx.get("https://api.crossref.org/works", params=params, timeout=20)
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    payload = response.json()
    items = payload.get("message", {}).get("items", [])
    results: list[dict] = []
    for item in items:
        titles = item.get("title") or []
        authors = item.get("author") or []
        author_names = [author.get("given", "") + " " + author.get("family", "") for author in authors]
        abstract = item.get("abstract")
        doi = item.get("DOI")
        year = None
        issued = item.get("issued")
        if issued and issued.get("date-parts"):
            year = issued["date-parts"][0][0]
        record = normalize_record(
            title=titles[0] if titles else "",
            authors=", ".join(filter(None, author_names)),
            abstract=abstract.replace("\n", " ").replace("<jats:p>", "") if isinstance(abstract, str) else None,
            source="Crossref",
            url=item.get("URL"),
            publication_year=year,
            doi=doi,
            external_id=doi,
            venue=item.get("container-title", [None])[0] if item.get("container-title") else None,
        )
        if record:
            results.append(record)
    return results
