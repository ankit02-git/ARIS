from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from app.integrations.utils import normalize_record


def search_pubmed(query: str, limit: int = 5) -> list[dict]:
    params = {
        "db": "pubmed",
        "retmode": "xml",
        "retmax": limit,
        "sort": "relevance",
        "term": query,
    }
    try:
        response = httpx.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params=params, timeout=20)
        response.raise_for_status()
    except httpx.HTTPError:
        return []

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError:
        return []

    ids = [item.text for item in root.findall("./IdList/Id") if item.text]
    if not ids:
        return []

    summary = httpx.get(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
        params={"db": "pubmed", "id": ",".join(ids), "retmode": "xml"},
        timeout=20,
    )
    if summary.status_code >= 400:
        return []

    try:
        summary_root = ET.fromstring(summary.text)
    except ET.ParseError:
        return []

    results: list[dict] = []
    for item in summary_root.findall("./DocSum"):
        title = item.findtext("./Item[@Name='Title']") or ""
        authors = item.findtext("./Item[@Name='AuthorList']") or ""
        pub_year = item.findtext("./Item[@Name='PubDate']") or ""
        url = f"https://pubmed.ncbi.nlm.nih.gov/{item.findtext('./Id')}/"
        record = normalize_record(
            title=title,
            authors=authors,
            abstract=None,
            source="PubMed",
            url=url,
            publication_year=pub_year,
            external_id=item.findtext("./Id"),
            venue="PubMed",
        )
        if record:
            results.append(record)
    return results
