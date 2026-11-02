from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_register_and_login_flow():
    unique_email = f"{uuid4().hex[:8]}@example.com"
    user_data = {
        "name": "Test User",
        "email": unique_email,
        "password": "Password123!",
    }

    register_response = client.post("/api/auth/register", json=user_data)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        json={"email": user_data["email"], "password": user_data["password"]},
    )
    assert login_response.status_code == 200
    body = login_response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
