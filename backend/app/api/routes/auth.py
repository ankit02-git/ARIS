from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import authenticate_user, create_access_token, get_current_user, get_password_hash

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

class GoogleTokenPayload(BaseModel):
    credential: str   # Google ID token (JWT) from Google Identity Services


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleTokenPayload, db: Session = Depends(get_db)) -> dict[str, str]:
    """
    Verify a Google ID token from the frontend and return an ARIS JWT.
    Creates a new user account on first sign-in.
    """
    from app.core.config import settings

    if not settings.google_client_id:
        raise HTTPException(
            status_code=501,
            detail="Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID in .env"
        )

    # Verify the Google ID token
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        id_info = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")

    google_sub = id_info["sub"]        # unique Google user ID
    email = id_info.get("email", "").lower()
    name = id_info.get("name") or email.split("@")[0]
    avatar_url = id_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email address")

    # Find existing user by google_id, fall back to email match
    user = db.query(User).filter(User.google_id == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    if user:
        # Link google_id to existing email account if not already linked
        if not user.google_id:
            user.google_id = google_sub
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        db.commit()
    else:
        # First-time Google sign-in — create account
        user = User(
            name=name,
            email=email,
            password_hash=None,   # Google users have no password
            google_id=google_sub,
            avatar_url=avatar_url,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.email)
    return {"access_token": token, "token_type": "bearer"}

# In-memory reset tokens (token -> user email). For production: use DB table + expiry.
_reset_tokens: dict[str, str] = {}


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> dict[str, str]:
    user = authenticate_user(db, payload.email.lower(), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.email)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/request-reset")
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    """
    Generate a password reset token. In this local deployment, the token is
    returned directly in the response (no email). In production, send via email.
    """
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        # Don't reveal whether email exists
        return {"message": "If that email is registered, a reset token has been generated.", "token": None}

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = user.email
    # Return token directly since we have no email service
    return {
        "message": "Reset token generated. Use this token with /api/auth/confirm-reset.",
        "token": token,
        "note": "In production this would be sent by email. Store this token securely.",
    }


@router.post("/confirm-reset")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict:
    email = _reset_tokens.get(payload.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    del _reset_tokens[payload.token]
    return {"message": "Password reset successfully. You can now log in with your new password."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Change password for logged-in user."""
    from app.services.auth_service import verify_password
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    # Reload user in this request's session to avoid cross-session mutation issues
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
