from typing import Optional

from pydantic import BaseModel, Field


class PaperOut(BaseModel):
    id: Optional[int] = None
    doi: Optional[str] = None
    title: str
    authors: Optional[str] = None
    abstract: Optional[str] = None
    source: str = "arxiv"
    url: Optional[str] = None
    publication_year: Optional[int] = None
    external_id: Optional[str] = None


class SearchResponse(BaseModel):
    results: list[PaperOut]
    query: str
    count: int = Field(default=0)
