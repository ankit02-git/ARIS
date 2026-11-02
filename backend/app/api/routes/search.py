from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.paper import ResearchPaper
from app.schemas.paper import SearchResponse
from app.services.search_service import search_academic_papers
from app.services.auth_service import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=SearchResponse)
def search_papers(
    q: str = Query(..., min_length=2, description="A research topic or keyword"),
    limit: int = Query(20, ge=1, le=50),
    mode: str = Query("hybrid", description="Search mode: external | semantic | hybrid"),
    author: str | None = Query(None, description="Filter results by author name"),
    year: int | None = Query(None, description="Filter results by publication year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Search query is required")

    query = q.strip()

    if mode == "semantic":
        results = _semantic_search_db(query, limit, db)
        if not results:
            results = search_academic_papers(query, limit=limit)
    elif mode == "hybrid":
        external = search_academic_papers(query, limit=max(limit // 2, 5))
        semantic = _semantic_search_db(query, limit // 2, db)
        seen = {r["title"].lower() for r in external}
        for r in semantic:
            if r["title"].lower() not in seen:
                external.append(r)
                seen.add(r["title"].lower())
        results = external[:limit]
    else:
        results = search_academic_papers(query, limit=limit)

    # Apply author filter (post-fetch)
    if author:
        author_lower = author.lower()
        results = [r for r in results if r.get("authors") and author_lower in r["authors"].lower()]

    # Apply year filter (post-fetch)
    if year:
        results = [r for r in results if r.get("publication_year") == year]

    return SearchResponse(results=results, query=query, count=len(results))


def _semantic_search_db(query: str, limit: int, db: Session) -> list[dict]:
    """Search papers stored in DB using semantic similarity."""
    try:
        from app.services.embedding_service import semantic_search
        hits = semantic_search(query, top_k=limit, db=db)
        if not hits:
            return []
        paper_ids = [pid for pid, _ in hits]
        score_map = {pid: score for pid, score in hits}
        papers = db.query(ResearchPaper).filter(ResearchPaper.id.in_(paper_ids)).all()
        paper_map = {p.id: p for p in papers}
        results = []
        for pid in paper_ids:
            p = paper_map.get(pid)
            if p:
                results.append({
                    "id": p.id,
                    "doi": p.doi,
                    "title": p.title,
                    "authors": p.authors,
                    "abstract": p.abstract,
                    "source": p.source,
                    "url": p.url,
                    "publication_year": p.publication_year,
                    "external_id": p.external_id,
                    "_semantic_score": round(score_map.get(pid, 0.0), 3),
                })
        return results
    except Exception:
        return []
