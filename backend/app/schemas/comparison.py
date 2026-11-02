from pydantic import BaseModel, Field


class PaperComparisonRequest(BaseModel):
    paper_ids: list[int] = Field(min_length=2, max_length=4)


class PaperSimilarity(BaseModel):
    paper_id: int
    title: str
    similarity: float


class PaperPairSimilarity(BaseModel):
    left_paper_id: int
    right_paper_id: int
    score: float
    left_evidence: str | None = None
    right_evidence: str | None = None
    evidence_score: float | None = None


class PaperComparisonResponse(BaseModel):
    method: str
    note: str
    papers: list[PaperSimilarity]
    pairwise: list[PaperPairSimilarity]
