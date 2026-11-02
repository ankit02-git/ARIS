import pytest

from app.db.base import Base
from app.db.session import engine
# Import all models so Base.metadata includes every table
from app.models.paper import ResearchPaper, SavedPaper  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.document import UploadedDocument  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.embedding import PaperEmbedding, DocumentChunk  # noqa: F401
from app.models.collection import Collection, CollectionPaper  # noqa: F401
from app.models.conversation import Conversation, ConversationMessage  # noqa: F401


@pytest.fixture(scope="session", autouse=True)
def create_test_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
