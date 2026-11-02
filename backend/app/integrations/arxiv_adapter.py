from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from app.integrations.utils import normalize_record


def search_arxiv(query: str, limit: int = 5) -> list[dict]:
    params = {"search_query": f"all:{query}", "start": 0, "max_results": limit}
    try:
        response = httpx.get("https://export.arxiv.org/api/query", params=params, timeout=20)
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError:
        return []

    results: list[dict] = []
    for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
        title = entry.findtext("{http://www.w3.org/2005/Atom}title", default="")
        author_names = [
            author.findtext("{http://www.w3.org/2005/Atom}name", default="")
            for author in entry.findall("{http://www.w3.org/2005/Atom}author")
        ]
        published = entry.findtext("{http://www.w3.org/2005/Atom}published", default="")
        link = next(
            (
                item.get("href")
                for item in entry.findall("{http://www.w3.org/2005/Atom}link")
                if item.get("rel") == "alternate"
            ),
            None,
        )
        summary = entry.findtext("{http://www.w3.org/2005/Atom}summary", default="")
        record = normalize_record(
            title=title,
            authors=", ".join(filter(None, author_names)),
            abstract=summary,
            source="arXiv",
            url=link,
            publication_year=published,
            external_id=link,
        )
        if record:
            results.append(record)
    return results
