from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_save_and_list_library_papers_are_deduplicated_by_title_and_source():
    email = f"{uuid4().hex[:8]}@example.com"
    password = "Password123!"
    client.post(
        "/api/auth/register",
        json={"name": "Library User", "email": email, "password": password},
    )
    token = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    first_payload = {
        "title": "Emotion Recognition in the Wild",
        "authors": "Alice Brown",
        "abstract": "A paper about emotion recognition.",
        "source": "Crossref",
        "url": "https://example.org/1",
        "publication_year": 2024,
        "external_id": None,
    }
    second_payload = {
        "title": "Emotion Recognition in the Wild",
        "authors": "Alice Brown",
        "abstract": "A paper about emotion recognition.",
        "source": "arXiv",
        "url": "https://arxiv.org/abs/2401.00001",
        "publication_year": 2024,
        "external_id": "https://arxiv.org/abs/2401.00001",
    }

    first_response = client.post("/api/library/save-paper", json=first_payload, headers=headers)
    second_response = client.post("/api/library/save-paper", json=second_payload, headers=headers)
    saved_response = client.get("/api/library", headers=headers)

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert saved_response.status_code == 200
    assert len(saved_response.json()) == 1
    assert saved_response.json()[0]["title"] == "Emotion Recognition in the Wild"
