from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analytics import router as analytics_router
from app.api.routes.assistant import router as assistant_router
from app.api.routes.auth import router as auth_router
from app.api.routes.collections import router as collections_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.gaps import router as gaps_router
from app.api.routes.briefs import router as briefs_router
from app.api.routes.comparison import router as comparison_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.documents import router as documents_router
from app.api.routes.insights import router as insights_router
from app.api.routes.library import router as library_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.reports import router as reports_router
from app.api.routes.search import router as search_router
from app.db.base import Base
from app.db.session import engine
from app.core.config import settings
from app.models.collection import Collection, CollectionPaper  # noqa: F401
from app.models.conversation import Conversation, ConversationMessage  # noqa: F401
from app.models.document import UploadedDocument  # noqa: F401
from app.models.embedding import DocumentChunk, PaperEmbedding  # noqa: F401
from app.models.paper import ResearchPaper, SavedPaper  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.user import User  # noqa: F401

app = FastAPI(title="ARIS API", version="1.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    if settings.app_env == "development":
        Base.metadata.create_all(bind=engine)


app.include_router(auth_router)
app.include_router(search_router)
app.include_router(library_router)
app.include_router(dashboard_router)
app.include_router(insights_router)
app.include_router(briefs_router)
app.include_router(comparison_router)
app.include_router(analytics_router)
app.include_router(assistant_router)
app.include_router(conversations_router)
app.include_router(documents_router)
app.include_router(gaps_router)
app.include_router(collections_router)
app.include_router(recommendations_router)
app.include_router(reports_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
