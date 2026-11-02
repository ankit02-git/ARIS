"""
Extended tests for Milestone 4 features:
- Embedding service
- RAG pipeline
- Research gap engine
- Documents endpoint
- Analytics endpoint
- Gaps endpoint
"""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.gap_service import analyze_research_gaps, _limitation_patterns, _methodology_gaps
from app.services.rag_service import chunk_text, get_or_create_chunks, rule_based_answer, RetrievedChunk

client = TestClient(app)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _register_and_login():
    email = f"{uuid4().hex[:8]}@aris-test.com"
    password = "TestPass123!"
    client.post("/api/auth/register", json={"name": "Test", "email": email, "password": password})
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["access_token"]
    return token


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _save_paper(token, title, abstract, source="arXiv", year=2023):
    return client.post(
        "/api/library/save-paper",
        json={"title": title, "abstract": abstract, "source": source, "publication_year": year},
        headers=_auth(token),
    )


# ─── Chunking ─────────────────────────────────────────────────────────────────

def test_chunk_text_returns_single_chunk_for_short_text():
    text = "This is a short abstract."
    chunks = chunk_text(text)
    assert chunks == [text]


def test_chunk_text_splits_long_text():
    text = "A" * 1200
    chunks = chunk_text(text, chunk_size=400, overlap=80)
    assert len(chunks) > 1
    # Each chunk is at most chunk_size
    for chunk in chunks:
        assert len(chunk) <= 400
    # Overlap: last chars of chunk[0] == first chars of chunk[1]
    assert chunks[0][-80:] == chunks[1][:80]


def test_chunk_text_covers_entire_text():
    text = "Word " * 200  # 1000 chars
    chunks = chunk_text(text, chunk_size=300, overlap=50)
    # Reassemble: every character in text should appear in at least one chunk
    all_chunk_text = " ".join(chunks)
    for word in text.split():
        assert word in all_chunk_text


# ─── Rule-based answer fallback ───────────────────────────────────────────────

def test_rule_based_answer_returns_message_when_no_chunks():
    answer = rule_based_answer("What methods are used?", [])
    assert "No relevant" in answer or "No papers" in answer or "context" in answer.lower()


def test_rule_based_answer_extracts_methodology_terms():
    chunks = [
        RetrievedChunk(
            paper_id=1,
            title="CNN for Emotion Recognition",
            source="arXiv",
            year=2023,
            url=None,
            chunk_text="We use a convolutional neural network (CNN) with transfer learning to classify facial expressions.",
            score=0.9,
            chunk_index=0,
        )
    ]
    answer = rule_based_answer("What methodologies are used?", chunks)
    assert "CNN" in answer or "Convolutional" in answer or "convolutional" in answer.lower()


def test_rule_based_answer_extracts_limitation_statements():
    chunks = [
        RetrievedChunk(
            paper_id=1,
            title="Speech Emotion Paper",
            source="Semantic Scholar",
            year=2022,
            url=None,
            chunk_text="A limitation is the small dataset size. Future work should address cross-corpus generalization.",
            score=0.8,
            chunk_index=0,
        )
    ]
    answer = rule_based_answer("What are the limitations?", chunks)
    assert "limitation" in answer.lower() or "small dataset" in answer.lower()


def test_rule_based_answer_includes_sources():
    chunks = [
        RetrievedChunk(
            paper_id=1, title="Test Paper", source="Crossref",
            year=2024, url="https://example.org/paper",
            chunk_text="We evaluate on the IEMOCAP dataset.", score=0.5, chunk_index=0,
        )
    ]
    answer = rule_based_answer("What datasets are used?", chunks)
    assert "Test Paper" in answer or "Sources" in answer


# ─── Gap service unit tests ───────────────────────────────────────────────────

class _MockPaper:
    def __init__(self, id, title, abstract, source, publication_year=None, url=None, doi=None):
        self.id = id
        self.title = title
        self.abstract = abstract
        self.source = source
        self.publication_year = publication_year
        self.url = url
        self.doi = doi


def test_limitation_patterns_detects_small_dataset():
    papers = [
        _MockPaper(1, "Emotion CNN", "A limitation is the small dataset size which prevents generalization.", "arXiv"),
        _MockPaper(2, "Speech Model", "Limited data availability is a significant challenge for this approach.", "Semantic Scholar"),
    ]
    results = _limitation_patterns(papers)
    titles = [r["title"] for r in results]
    assert any("data" in t.lower() or "generali" in t.lower() for t in titles)
    assert all(r["supporting_paper_count"] >= 1 for r in results)


def test_limitation_patterns_provides_research_suggestions():
    papers = [
        _MockPaper(1, "Paper A", "A limitation is the limited dataset and lack of generalizability.", "arXiv"),
    ]
    results = _limitation_patterns(papers)
    assert all(r.get("research_suggestion") for r in results)


def test_methodology_gaps_detects_absent_methods():
    papers = [
        _MockPaper(1, "CNN Paper", "We use a convolutional neural network for emotion recognition.", "arXiv"),
        _MockPaper(2, "LSTM Paper", "We use an LSTM recurrent neural network for speech emotion.", "Crossref"),
    ]
    results = _methodology_gaps(papers)
    absent_titles = [r["title"] for r in results if r["supporting_paper_count"] == 0]
    # Several methodologies like GAN, GNN, etc. should be absent
    assert len(absent_titles) > 0


def test_gap_engine_requires_minimum_papers():
    token = _register_and_login()
    headers = _auth(token)
    # No papers saved — should indicate insufficient data
    resp = client.get("/api/gaps", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sufficient_data"] is False
    assert "3" in data["message"] or "paper" in data["message"].lower()


def test_gap_engine_with_3_papers_returns_findings():
    token = _register_and_login()
    papers = [
        ("CNN for Facial Expression Recognition",
         "We propose a CNN model for facial expression recognition. A limitation is the small dataset. Future work should generalize to real-world settings.", "arXiv", 2022),
        ("LSTM Speech Emotion Recognition",
         "This paper uses an LSTM recurrent neural network for speech emotion. The model is evaluated on RAVDESS.", "Semantic Scholar", 2023),
        ("Multimodal Emotion with Transformers",
         "We combine audio-visual fusion with transformer attention. A drawback is computational cost in deployment.", "Crossref", 2024),
    ]
    for title, abstract, source, year in papers:
        _save_paper(token, title, abstract, source, year)

    resp = client.get("/api/gaps", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["sufficient_data"] is True
    assert data["total_papers"] == 3
    assert len(data["gaps"]) > 0
    # Should have disclaimer
    assert "disclaimer" in data
    # All gaps should have required fields
    for gap in data["gaps"]:
        assert "gap_type" in gap
        assert "title" in gap
        assert "evidence_strength" in gap
        assert "research_suggestion" in gap


# ─── Analytics endpoint ───────────────────────────────────────────────────────

def test_analytics_returns_empty_when_no_papers():
    token = _register_and_login()
    resp = client.get("/api/analytics", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_papers"] == 0
    assert data["publications_by_year"] == []
    assert data["top_keywords"] == []


def test_analytics_computes_real_data_from_saved_papers():
    token = _register_and_login()
    papers = [
        ("Deep Learning for Emotion Recognition", "Convolutional neural network for emotion detection.", "arXiv", 2022),
        ("BERT Sentiment Analysis", "BERT transformer for sentiment classification.", "Semantic Scholar", 2023),
        ("Multimodal Fusion for Affective Computing", "Audio-visual fusion for emotion recognition.", "Crossref", 2023),
    ]
    for title, abstract, source, year in papers:
        _save_paper(token, title, abstract, source, year)

    resp = client.get("/api/analytics", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_papers"] == 3
    # Source distribution
    sources = {item["source"] for item in data["source_distribution"]}
    assert "arXiv" in sources
    # Keywords extracted
    assert len(data["top_keywords"]) > 0
    # Years
    years = [item["year"] for item in data["publications_by_year"]]
    assert 2022 in years and 2023 in years


# ─── Documents endpoint ───────────────────────────────────────────────────────

def test_documents_list_is_empty_initially():
    token = _register_and_login()
    resp = client.get("/api/documents", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_document_upload_rejects_non_pdf():
    token = _register_and_login()
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("test.txt", b"This is a text file", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_document_upload_rejects_fake_pdf():
    token = _register_and_login()
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("fake.pdf", b"Not a real PDF", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


def test_document_upload_accepts_valid_minimal_pdf():
    token = _register_and_login()
    # Minimal valid PDF header
    minimal_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n%%EOF"
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("research.pdf", minimal_pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["original_filename"] == "research.pdf"
    assert doc["status"] == "pending"
    assert doc["file_size"] == len(minimal_pdf)
    assert doc["id"] is not None


def test_document_delete_removes_from_list():
    token = _register_and_login()
    minimal_pdf = b"%PDF-1.4\n%%EOF"
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("del_test.pdf", minimal_pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload.status_code == 201
    doc_id = upload.json()["id"]

    delete = client.delete(f"/api/documents/{doc_id}", headers=_auth(token))
    assert delete.status_code == 204

    docs = client.get("/api/documents", headers=_auth(token)).json()
    assert all(d["id"] != doc_id for d in docs)


def test_document_isolation_between_users():
    token_a = _register_and_login()
    token_b = _register_and_login()
    minimal_pdf = b"%PDF-1.4\n%%EOF"

    upload = client.post(
        "/api/documents/upload",
        files={"file": ("private.pdf", minimal_pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    doc_id = upload.json()["id"]

    # User B cannot delete User A's document
    delete = client.delete(f"/api/documents/{doc_id}", headers=_auth(token_b))
    assert delete.status_code == 404

    # User B's document list is empty
    docs_b = client.get("/api/documents", headers=_auth(token_b)).json()
    assert all(d["id"] != doc_id for d in docs_b)


# ─── Assistant endpoint ───────────────────────────────────────────────────────

def test_assistant_status_endpoint_returns_availability():
    token = _register_and_login()
    resp = client.get("/api/assistant/status", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "available" in data
    assert isinstance(data["available"], bool)


def test_assistant_chat_returns_answer_and_citations():
    token = _register_and_login()
    _save_paper(token, "Emotion Recognition with CNN", "We use a convolutional neural network for emotion recognition on the FER2013 dataset.", "arXiv")
    _save_paper(token, "LSTM Speech Emotion", "LSTM recurrent neural network detects emotion from speech audio features.", "Semantic Scholar")

    resp = client.post(
        "/api/assistant/chat",
        json={"message": "What methods are used?"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "content" in data
    assert len(data["content"]) > 10
    assert "citations" in data
    assert "role" in data
    assert data["role"] == "assistant"


def test_assistant_chat_without_papers_returns_informative_message():
    token = _register_and_login()
    resp = client.post(
        "/api/assistant/chat",
        json={"message": "What are the limitations?"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["content"]) > 0
    # Should mention no papers / context
    content_lower = data["content"].lower()
    assert any(kw in content_lower for kw in ["no", "library", "paper", "context", "save"])
