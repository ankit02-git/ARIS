"""
Milestone 6b tests:
- Tags (add, remove, list, list by tag)
- Saved searches (save, list, delete, dedup)
- Password reset / change-password
- Document full-text search endpoint
- Collection analysis endpoint
- Author/year filter on search
"""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _register_and_login():
    email = f"{uuid4().hex[:8]}@aris-m6b.com"
    password = "TestPass123!"
    client.post("/api/auth/register", json={"name": "M6bUser", "email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"], email


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _save_paper(token, title="Test Paper", source="arXiv", year=2023):
    resp = client.post(
        "/api/library/save-paper",
        json={"title": title, "abstract": "Emotion recognition using deep learning.", "source": source, "publication_year": year},
        headers=_auth(token),
    )
    return resp.json()


# ─── Tags ─────────────────────────────────────────────────────────────────────

def test_add_tag_to_saved_paper():
    token, _ = _register_and_login()
    paper = _save_paper(token, title="Tagged Paper")
    resp = client.post(
        "/api/tags",
        json={"paper_id": paper["id"], "tag": "emotion-recognition"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["tag"] == "emotion-recognition"


def test_add_tag_normalizes_to_lowercase():
    token, _ = _register_and_login()
    paper = _save_paper(token, title="Case Tag Paper")
    resp = client.post(
        "/api/tags",
        json={"paper_id": paper["id"], "tag": "Deep Learning"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["tag"] == "deep learning"


def test_add_tag_to_unsaved_paper_returns_404():
    token, _ = _register_and_login()
    resp = client.post(
        "/api/tags",
        json={"paper_id": 999999, "tag": "test-tag"},
        headers=_auth(token),
    )
    assert resp.status_code == 404


def test_get_tags_for_paper():
    token, _ = _register_and_login()
    paper = _save_paper(token, title="Multi-tag Paper")
    client.post("/api/tags", json={"paper_id": paper["id"], "tag": "nlp"}, headers=_auth(token))
    client.post("/api/tags", json={"paper_id": paper["id"], "tag": "transformer"}, headers=_auth(token))

    resp = client.get(f"/api/tags/paper/{paper['id']}", headers=_auth(token))
    assert resp.status_code == 200
    tags = resp.json()
    assert "nlp" in tags
    assert "transformer" in tags


def test_list_all_user_tags():
    token, _ = _register_and_login()
    paper1 = _save_paper(token, title="Tag List Paper 1")
    paper2 = _save_paper(token, title="Tag List Paper 2")
    client.post("/api/tags", json={"paper_id": paper1["id"], "tag": "alpha"}, headers=_auth(token))
    client.post("/api/tags", json={"paper_id": paper2["id"], "tag": "beta"}, headers=_auth(token))

    resp = client.get("/api/tags", headers=_auth(token))
    assert resp.status_code == 200
    tags = resp.json()
    assert "alpha" in tags
    assert "beta" in tags


def test_remove_tag():
    token, _ = _register_and_login()
    paper = _save_paper(token, title="Remove Tag Paper")
    client.post("/api/tags", json={"paper_id": paper["id"], "tag": "to-remove"}, headers=_auth(token))

    resp = client.delete(f"/api/tags?paper_id={paper['id']}&tag=to-remove", headers=_auth(token))
    assert resp.status_code == 200

    tags = client.get(f"/api/tags/paper/{paper['id']}", headers=_auth(token)).json()
    assert "to-remove" not in tags


def test_duplicate_tag_is_idempotent():
    token, _ = _register_and_login()
    paper = _save_paper(token, title="Dedup Tag Paper")
    client.post("/api/tags", json={"paper_id": paper["id"], "tag": "duplicate"}, headers=_auth(token))
    resp = client.post("/api/tags", json={"paper_id": paper["id"], "tag": "duplicate"}, headers=_auth(token))
    assert resp.status_code == 200  # Should not error, idempotent

    tags = client.get(f"/api/tags/paper/{paper['id']}", headers=_auth(token)).json()
    assert tags.count("duplicate") == 1


def test_papers_by_tag():
    token, _ = _register_and_login()
    paper1 = _save_paper(token, title="Tagged Alpha 1")
    paper2 = _save_paper(token, title="Tagged Alpha 2")
    _save_paper(token, title="Untagged Paper")
    client.post("/api/tags", json={"paper_id": paper1["id"], "tag": "alpha-tag"}, headers=_auth(token))
    client.post("/api/tags", json={"paper_id": paper2["id"], "tag": "alpha-tag"}, headers=_auth(token))

    resp = client.get("/api/tags/by-tag/alpha-tag", headers=_auth(token))
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "Tagged Alpha 1" in titles
    assert "Tagged Alpha 2" in titles
    assert "Untagged Paper" not in titles


def test_tag_isolation_between_users():
    token1, _ = _register_and_login()
    token2, _ = _register_and_login()
    paper = _save_paper(token1, title="User1 Tagged Paper")
    client.post("/api/tags", json={"paper_id": paper["id"], "tag": "private-tag"}, headers=_auth(token1))

    # User2 should not see user1's tags
    resp = client.get("/api/tags", headers=_auth(token2))
    assert "private-tag" not in resp.json()


# ─── Saved Searches ───────────────────────────────────────────────────────────

def test_save_search():
    token, _ = _register_and_login()
    resp = client.post(
        "/api/saved-searches",
        json={"query": "emotion recognition deep learning", "mode": "hybrid", "result_count": 15},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "emotion recognition deep learning"
    assert data["result_count"] == 15
    assert "id" in data


def test_list_saved_searches():
    token, _ = _register_and_login()
    client.post("/api/saved-searches", json={"query": "sentiment analysis"}, headers=_auth(token))
    client.post("/api/saved-searches", json={"query": "facial expression"}, headers=_auth(token))

    resp = client.get("/api/saved-searches", headers=_auth(token))
    assert resp.status_code == 200
    queries = [s["query"] for s in resp.json()]
    assert "sentiment analysis" in queries
    assert "facial expression" in queries


def test_duplicate_search_save_is_idempotent():
    token, _ = _register_and_login()
    r1 = client.post("/api/saved-searches", json={"query": "multimodal fusion"}, headers=_auth(token)).json()
    r2 = client.post("/api/saved-searches", json={"query": "multimodal fusion"}, headers=_auth(token)).json()
    # Should return same record, not duplicate
    assert r1["id"] == r2["id"]


def test_delete_saved_search():
    token, _ = _register_and_login()
    saved = client.post("/api/saved-searches", json={"query": "to be deleted"}, headers=_auth(token)).json()

    resp = client.delete(f"/api/saved-searches/{saved['id']}", headers=_auth(token))
    assert resp.status_code == 200

    searches = client.get("/api/saved-searches", headers=_auth(token)).json()
    assert saved["id"] not in [s["id"] for s in searches]


def test_saved_search_isolation_between_users():
    token1, _ = _register_and_login()
    token2, _ = _register_and_login()
    client.post("/api/saved-searches", json={"query": "user1 private search"}, headers=_auth(token1))

    resp = client.get("/api/saved-searches", headers=_auth(token2))
    queries = [s["query"] for s in resp.json()]
    assert "user1 private search" not in queries


# ─── Password Change ───────────────────────────────────────────────────────────

def test_change_password_requires_correct_current_password():
    token, _ = _register_and_login()
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewPass456!"},
        headers=_auth(token),
    )
    assert resp.status_code == 400


def test_change_password_succeeds_with_correct_credentials():
    token, email = _register_and_login()
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "TestPass123!", "new_password": "NewPass456!"},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    # Verify old password no longer works
    old_login = client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    assert old_login.status_code == 401 or old_login.status_code == 400

    # Verify new password works
    new_login = client.post("/api/auth/login", json={"email": email, "password": "NewPass456!"})
    assert new_login.status_code == 200


# ─── Collection Analysis ──────────────────────────────────────────────────────

def test_collection_analyze_empty_collection():
    token, _ = _register_and_login()
    col = client.post("/api/collections", json={"name": "Empty Analyze Col"}, headers=_auth(token)).json()

    resp = client.get(f"/api/collections/{col['id']}/analyze", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_papers"] == 0
    assert "summary" in data


def test_collection_analyze_with_papers():
    token, _ = _register_and_login()
    col = client.post("/api/collections", json={"name": "Analyze Col"}, headers=_auth(token)).json()
    p1 = _save_paper(token, title="Emotion recognition via deep learning")
    p2 = _save_paper(token, title="Facial expression classification CNN")
    client.post(f"/api/collections/{col['id']}/papers", json={"paper_id": p1["id"]}, headers=_auth(token))
    client.post(f"/api/collections/{col['id']}/papers", json={"paper_id": p2["id"]}, headers=_auth(token))

    resp = client.get(f"/api/collections/{col['id']}/analyze", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_papers"] == 2
    assert len(data["top_keywords"]) > 0
    assert "summary" in data


def test_collection_analyze_unauthorized():
    token1, _ = _register_and_login()
    token2, _ = _register_and_login()
    col = client.post("/api/collections", json={"name": "Private Col"}, headers=_auth(token1)).json()

    resp = client.get(f"/api/collections/{col['id']}/analyze", headers=_auth(token2))
    assert resp.status_code == 404


# ─── Search Author/Year Filters ───────────────────────────────────────────────

def test_search_with_author_filter_returns_200():
    token, _ = _register_and_login()
    # The author filter narrows DB results; we just verify the endpoint accepts it
    resp = client.get("/api/search?q=emotion+recognition&author=Lecun&limit=5", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data


def test_search_with_year_filter_returns_200():
    token, _ = _register_and_login()
    resp = client.get("/api/search?q=sentiment+analysis&year=2023&limit=5", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
