from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, LargeBinary

from app.db.base import Base


class PaperEmbedding(Base):
    """Stores the dense embedding vector for a paper (title + abstract)."""
    __tablename__ = "paper_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("research_papers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    model_name = Column(String(200), nullable=False)
    # Serialized float32 vector as bytes (numpy tobytes)
    vector_bytes = Column(LargeBinary, nullable=False)
    vector_dim = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentChunk(Base):
    """A text chunk from a paper (from abstract or uploaded PDF)."""
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("research_papers.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("uploaded_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    chunk_text = Column(Text, nullable=False)
    section_heading = Column(String(300), nullable=True)
    page_number = Column(Integer, nullable=True)
    source_type = Column(String(50), nullable=False, default="abstract")  # abstract | pdf
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
