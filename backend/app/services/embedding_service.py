from __future__ import annotations

"""
Embedding service using sentence-transformers all-MiniLM-L6-v2.

The model is loaded lazily on first use so it doesn't block startup.
Embeddings are stored in the DB as raw bytes (numpy float32 tobytes).
A FAISS index is built in memory and can be rebuilt at any time.
"""

import logging
import os
import struct
from threading import Lock
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Model singleton
_model = None
_model_lock = Lock()
_MODEL_NAME = "all-MiniLM-L6-v2"

# FAISS index singleton (in-memory, rebuilt from DB)
_faiss_index = None
_faiss_paper_ids: list[int] = []
_faiss_lock = Lock()

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "cache")


def _get_model():
    """Lazily load the sentence-transformers model."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from sentence_transformers import SentenceTransformer
                    os.makedirs(CACHE_DIR, exist_ok=True)
                    _model = SentenceTransformer(_MODEL_NAME, cache_folder=CACHE_DIR)
                    logger.info("Loaded embedding model: %s", _MODEL_NAME)
                except Exception as exc:
                    logger.warning("Could not load embedding model: %s", exc)
                    _model = None
    return _model


def embed_texts(texts: list[str]) -> np.ndarray | None:
    """Embed a list of texts; returns (N, dim) float32 array or None."""
    model = _get_model()
    if model is None:
        return None
    try:
        vectors = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return vectors.astype(np.float32)
    except Exception as exc:
        logger.warning("Embedding failed: %s", exc)
        return None


def vector_to_bytes(vec: np.ndarray) -> bytes:
    return vec.astype(np.float32).tobytes()


def bytes_to_vector(data: bytes, dim: int) -> np.ndarray:
    return np.frombuffer(data, dtype=np.float32).reshape(dim)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ---------------------------------------------------------------------------
# FAISS index management
# ---------------------------------------------------------------------------

def build_faiss_index(db: "Session") -> bool:
    """Build FAISS flat-L2 index from all stored embeddings. Returns True on success."""
    global _faiss_index, _faiss_paper_ids

    from app.models.embedding import PaperEmbedding

    rows = db.query(PaperEmbedding).all()
    if not rows:
        with _faiss_lock:
            _faiss_index = None
            _faiss_paper_ids = []
        return False

    try:
        import faiss  # type: ignore

        dim = rows[0].vector_dim
        vectors = np.stack([bytes_to_vector(r.vector_bytes, dim) for r in rows]).astype(np.float32)
        # Normalize for cosine similarity (inner product on unit vectors = cosine)
        faiss.normalize_L2(vectors)
        index = faiss.IndexFlatIP(dim)
        index.add(vectors)

        with _faiss_lock:
            _faiss_index = index
            _faiss_paper_ids = [r.paper_id for r in rows]

        logger.info("Built FAISS index with %d papers (dim=%d)", len(rows), dim)
        return True
    except Exception as exc:
        logger.warning("Failed to build FAISS index: %s", exc)
        return False


def semantic_search(
    query: str,
    top_k: int = 10,
    db: "Session | None" = None,
) -> list[tuple[int, float]]:
    """
    Search for papers by semantic similarity to query.
    Returns list of (paper_id, score) tuples sorted by descending score.
    Falls back to empty list if index not available.
    """
    global _faiss_index, _faiss_paper_ids

    if _faiss_index is None and db is not None:
        build_faiss_index(db)

    if _faiss_index is None:
        return []

    query_vec = embed_texts([query])
    if query_vec is None:
        return []

    try:
        import faiss  # type: ignore
        q = query_vec.copy()
        faiss.normalize_L2(q)
        scores, indices = _faiss_index.search(q, min(top_k, _faiss_index.ntotal))
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            paper_id = _faiss_paper_ids[idx]
            results.append((paper_id, float(score)))
        return results
    except Exception as exc:
        logger.warning("FAISS search failed: %s", exc)
        return []


def ensure_paper_embedding(paper_id: int, title: str, abstract: str | None, db: "Session") -> bool:
    """
    Generate and store embedding for a paper if not already present.
    Returns True if embedding is available (new or existing).
    """
    from app.models.embedding import PaperEmbedding

    existing = db.query(PaperEmbedding).filter_by(paper_id=paper_id).first()
    if existing:
        return True

    text = f"{title} {abstract or ''}".strip()
    if not text:
        return False

    vectors = embed_texts([text])
    if vectors is None:
        return False

    dim = vectors.shape[1]
    emb = PaperEmbedding(
        paper_id=paper_id,
        model_name=_MODEL_NAME,
        vector_bytes=vector_to_bytes(vectors[0]),
        vector_dim=dim,
    )
    db.add(emb)
    try:
        db.commit()
    except Exception:
        db.rollback()
        return False

    # Invalidate in-memory index so it gets rebuilt on next search
    with _faiss_lock:
        global _faiss_index
        _faiss_index = None

    return True
