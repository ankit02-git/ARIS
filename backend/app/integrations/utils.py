from __future__ import annotations

import re
from typing import Any


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_year(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    if isinstance(value, str) and len(value) >= 4 and value[:4].isdigit():
        return int(value[:4])
    if isinstance(value, list) and value:
        return parse_year(value[0])
    if isinstance(value, dict):
        return parse_year(value.get("date-parts", [[None]])[0][0])
    return None


def normalize_record(
    *,
    title: Any,
    authors: Any = None,
    abstract: Any = None,
    source: str,
    url: Any = None,
    publication_year: Any = None,
    doi: Any = None,
    external_id: Any = None,
    venue: Any = None,
) -> dict:
    cleaned_title = clean_text(title)
    if not cleaned_title:
        return {}
    return {
        "title": cleaned_title,
        "authors": clean_text(authors),
        "abstract": clean_text(abstract),
        "source": source,
        "url": clean_text(url) or None,
        "publication_year": parse_year(publication_year),
        "doi": clean_text(doi) or None,
        "external_id": clean_text(external_id) or clean_text(url) or None,
        "venue": clean_text(venue) or None,
    }
