"""
Milestone 6 tests:
- Collections CRUD
- Conversation persistence
- DOCX / BibTeX export
- Analytics filters
- ComparisonPage backend
"""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _register_and_login():
    email = f"{uuid4().hex[:8]}@aris-m6.com"
    password = "TestPass123!"
    client.post("/api/auth/register", json={"name": "M6User", "email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _save_paper(token, title="Test Paper", source="arXiv", year=2023):
    resp = client.post(
        "/api/library/save-paper",
        json={"title": title, "abstract": "Emotion recognition using deep learning.", "source": source, "publication_year": year},
        headers=_auth(token),
    )
    return resp.json()


# ─── Collections ──────────────────────────────────────────────────────────────

def test_create_collection_returns_collection():
    token = _register_and_login()
    resp = client.post("/api/collections", json={"name": "My Test Collection"}, headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Test Collection"
    assert data["paper_count"] == 0
    assert "id" in data


def test_list_collections_returns_user_collections():
    token = _register_and_login()
    client.post("/api/collections", json={"name": "Col A"}, headers=_auth(token))
    client.post("/api/collections", json={"name": "Col B"}, headers=_auth(token))
    resp = client.get("/api/collections", headers=_auth(token))
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Col A" in names
    assert "Col B" in names


def test_collection_isolation_between_users():
    token1 = _register_and_login()
    token2 = _register_and_login()
    client.post("/api/collections", json={"name": "User1 Col"}, headers=_auth(token1))
    resp = client.get("/api/collections", headers=_auth(token2))
    names = [c["name"] for c in resp.json()]
    assert "User1 Col" not in names


def test_add_paper_to_collection():
    token = _register_and_login()
    paper = _save_paper(token, title="FER Paper")
    col = client.post("/api/collections", json={"name": "FER Collection"}, headers=_auth(token)).json()

    resp = client.post(
        f"/api/collections/{col['id']}/papers",
        json={"paper_id": paper["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["paper_count"] == 1


def test_remove_paper_from_collection():
    token = _register_and_login()
    paper = _save_paper(token, title="SER Paper")
    col = client.post("/api/collections", json={"name": "SER Collection"}, headers=_auth(token)).json()
    client.post(f"/api/collections/{col['id']}/papers", json={"paper_id": paper["id"]}, headers=_auth(token))

    resp = client.delete(f"/api/collections/{col['id']}/papers/{paper['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["paper_count"] == 0


def test_get_collection_detail_includes_papers():
    token = _register_and_login()
    paper = _save_paper(token, title="Detail Paper")
    col = client.post("/api/collections", json={"name": "Detail Col"}, headers=_auth(token)).json()
    client.post(f"/api/collections/{col['id']}/papers", json={"paper_id": paper["id"]}, headers=_auth(token))

    resp = client.get(f"/api/collections/{col['id']}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "papers" in data
    assert len(data["papers"]) == 1
    assert data["papers"][0]["title"] == "Detail Paper"


def test_delete_collection():
    token = _register_and_login()
    col = client.post("/api/collections", json={"name": "To Delete"}, headers=_auth(token)).json()
    resp = client.delete(f"/api/collections/{col['id']}", headers=_auth(token))
    assert resp.status_code == 200
    # Verify gone
    list_resp = client.get("/api/collections", headers=_auth(token))
    assert col["id"] not in [c["id"] for c in list_resp.json()]


def test_cannot_add_unsaved_paper_to_collection():
    token = _register_and_login()
    col = client.post("/api/collections", json={"name": "Test Col"}, headers=_auth(token)).json()
    resp = client.post(f"/api/collections/{col['id']}/papers", json={"paper_id": 999999}, headers=_auth(token))
    assert resp.status_code == 404


# ─── Conversation Persistence ─────────────────────────────────────────────────

def test_chat_creates_conversation():
    token = _register_and_login()
    _save_paper(token, title="Conv Test Paper")
    resp = client.post(
        "/api/assistant/chat",
        json={"message": "What methods are used in emotion recognition?"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "conversation_id" in data
    assert data["conversation_id"] is not None
    assert data["role"] == "assistant"


def test_list_conversations_returns_history():
    token = _register_and_login()
    # Create two chats
    client.post("/api/assistant/chat", json={"message": "First question about emotions"}, headers=_auth(token))
    client.post("/api/assistant/chat", json={"message": "Second question about datasets"}, headers=_auth(token))

    resp = client.get("/api/conversations", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_conversation_continues_with_id():
    token = _register_and_login()
    first = client.post(
        "/api/assistant/chat",
        json={"message": "Tell me about deep learning"},
        headers=_auth(token),
    ).json()
    conv_id = first["conversation_id"]

    second = client.post(
        "/api/assistant/chat",
        json={"message": "What about CNNs?", "conversation_id": conv_id},
        headers=_auth(token),
    ).json()
    assert second["conversation_id"] == conv_id


def test_get_conversation_includes_messages():
    token = _register_and_login()
    first = client.post(
        "/api/assistant/chat",
        json={"message": "Explain affective computing"},
        headers=_auth(token),
    ).json()
    conv_id = first["conversation_id"]

    resp = client.get(f"/api/conversations/{conv_id}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
    # Should have user + assistant messages
    assert len(data["messages"]) >= 2


def test_delete_conversation():
    token = _register_and_login()
    first = client.post(
        "/api/assistant/chat",
        json={"message": "Test delete conversation"},
        headers=_auth(token),
    ).json()
    conv_id = first["conversation_id"]

    resp = client.delete(f"/api/conversations/{conv_id}", headers=_auth(token))
    assert resp.status_code == 200
    # Should be gone
    resp2 = client.get(f"/api/conversations/{conv_id}", headers=_auth(token))
    assert resp2.status_code == 404


def test_conversation_isolation_between_users():
    token1 = _register_and_login()
    token2 = _register_and_login()
    first = client.post(
        "/api/assistant/chat",
        json={"message": "User1 private question"},
        headers=_auth(token1),
    ).json()
    conv_id = first["conversation_id"]

    # User2 cannot access User1's conversation
    resp = client.get(f"/api/conversations/{conv_id}", headers=_auth(token2))
    assert resp.status_code == 404


# ─── Analytics Filters ────────────────────────────────────────────────────────

def test_analytics_filter_by_year():
    token = _register_and_login()
    _save_paper(token, title="Old Paper 2018", year=2018)
    _save_paper(token, title="New Paper 2023", year=2023)

    resp = client.get("/api/analytics?year_from=2020", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    years = [e["year"] for e in data["publications_by_year"]]
    assert 2018 not in years
    assert 2023 in years


def test_analytics_filter_by_source():
    token = _register_and_login()
    _save_paper(token, title="arXiv paper", source="arXiv")
    _save_paper(token, title="PubMed paper", source="pubmed")

    resp = client.get("/api/analytics?source=arxiv", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    for src in data["source_distribution"]:
        assert "arxiv" in src["source"].lower()


def test_analytics_empty_filters_return_all():
    token = _register_and_login()
    _save_paper(token, title="Paper A", year=2021)
    _save_paper(token, title="Paper B", year=2022)

    resp_all = client.get("/api/analytics", headers=_auth(token))
    resp_filtered = client.get("/api/analytics?year_from=2019&year_to=2025", headers=_auth(token))
    # Both should return same count when date range covers all papers
    assert resp_all.json()["total_papers"] == resp_filtered.json()["total_papers"]


# ─── Report Formats ───────────────────────────────────────────────────────────

def test_generate_bibtex_report():
    token = _register_and_login()
    _save_paper(token, title="BibTeX Test Paper")
    resp = client.post(
        "/api/reports/generate",
        json={"report_type": "library_summary", "title": "BibTeX Export", "format": "bibtex"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["format"] == "bibtex"


def test_generate_docx_report():
    token = _register_and_login()
    _save_paper(token, title="DOCX Test Paper")
    resp = client.post(
        "/api/reports/generate",
        json={"report_type": "library_summary", "title": "DOCX Export", "format": "docx"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["format"] == "docx"


def test_invalid_report_format_returns_400():
    token = _register_and_login()
    resp = client.post(
        "/api/reports/generate",
        json={"report_type": "library_summary", "title": "Bad Format", "format": "xlsx"},
        headers=_auth(token),
    )
    assert resp.status_code == 400
