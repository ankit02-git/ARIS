from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class ResearchPaper(Base):
    __tablename__ = "research_papers"

    id = Column(Integer, primary_key=True, index=True)
    doi = Column(String(255), nullable=True, unique=True)
    title = Column(String(500), nullable=False)
    authors = Column(String(1000), nullable=True)
    abstract = Column(String, nullable=True)
    source = Column(String(100), nullable=False)
    url = Column(String(500), nullable=True)
    publication_year = Column(Integer, nullable=True)
    external_id = Column(String(255), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    saved_by = relationship("SavedPaper", back_populates="paper")


class SavedPaper(Base):
    __tablename__ = "saved_papers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(Integer, ForeignKey("research_papers.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "paper_id", name="uq_saved_papers_user_paper"),
    )

    paper = relationship("ResearchPaper", back_populates="saved_by")
