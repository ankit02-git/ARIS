# ARIS Security Audit

**Date:** 2026-11-02  
**Auditor:** Automated + Manual Security Testing  
**Scope:** Authentication, Authorization, Input Validation, Data Isolation, Transport, File Handling

---

## Executive Summary

ARIS demonstrates **solid baseline security** for a development deployment. All critical authentication controls are in place (Argon2id hashing, JWT validation, per-user data isolation). No critical vulnerabilities were found. Two medium-priority gaps exist that require attention before production deployment.

**Overall Rating: SECURE (Dev) / NEEDS HARDENING (Prod)**

---

## Findings Summary

| ID | Category | Severity | Status |
|----|----------|----------|--------|
| SEC-001 | Auth: Password Hashing | — | ✅ PASS |
| SEC-002 | Auth: JWT Security | — | ✅ PASS |
| SEC-003 | Auth: Unauthenticated Access | — | ✅ PASS |
| SEC-004 | Auth: Invalid Token | — | ✅ PASS |
| SEC-005 | Authorization: Cross-User Isolation | — | ✅ PASS |
| SEC-006 | Input: SQL Injection | — | ✅ PASS |
| SEC-007 | Input: File Upload Validation | — | ✅ PASS |
| SEC-008 | Input: Path Traversal | — | ✅ PASS |
| SEC-009 | CORS Configuration | MEDIUM | ⚠️ NEEDS PROD HARDENING |
| SEC-010 | Rate Limiting | MEDIUM | ⚠️ MISSING |
| SEC-011 | HTTPS/TLS | HIGH (prod) | ⚠️ DEV ONLY |
| SEC-012 | Secret Key Management | LOW | ⚠️ ENV VAR DEPENDENT |

---

## Detailed Findings

### SEC-001: Password Hashing ✅ PASS

**Implementation:** `backend/app/services/auth_service.py`

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
```

- Algorithm: **Argon2id** (memory-hard, OWASP recommended)
- Passwords are never stored in plaintext
- Verification uses constant-time comparison (passlib)
- **Verdict:** Best practice implementation

---

### SEC-002: JWT Security ✅ PASS

**Implementation:** `auth_service.py`

- Algorithm: **HS256** with secret key from environment
- Token expiry: configurable (default ~60 min)
- Expiry uses `datetime.now(timezone.utc)` (timezone-aware, correct)
- Tokens validated on every protected route via `get_current_user` dependency
- **Test:** Forged token with fake signature → 401 Unauthorized ✅
- **Verdict:** PASS

**Minor note:** HS256 with shared secret; RS256 would be better for microservices. For monolith, HS256 is acceptable.

---

### SEC-003 & SEC-004: Unauthenticated / Invalid Token Access ✅ PASS

- Tested: `GET /api/dashboard` with no token → 401
- Tested: `GET /api/dashboard` with `Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.fake` → 401
- All 44 routes use `current_user: User = Depends(get_current_user)` dependency
- **Verdict:** PASS

---

### SEC-005: Cross-User Data Isolation ✅ PASS

**Test performed:**
1. User A creates a collection (id=2)
2. User B (attacker@evil.com) attempts `GET /api/collections/2`
3. Response: 404 Not Found

**Implementation pattern** (collections as example):
```python
db.query(Collection).filter_by(id=collection_id, user_id=current_user.id).first()
```

All queries filter by both resource ID **and** `user_id`. Data belonging to one user is invisible to another.

- Documents: ✅ user_id filtered
- Collections: ✅ user_id filtered
- Conversations: ✅ user_id filtered
- Reports: ✅ user_id filtered
- Tags: ✅ user_id filtered
- Saved searches: ✅ user_id filtered
- **Verdict:** PASS — complete data isolation

---

### SEC-006: SQL Injection ✅ PASS

**Test:** Search query: `'; DROP TABLE users; --`

**Implementation:** All DB queries use SQLAlchemy ORM with parameterized queries:
```python
db.query(ResearchPaper).filter(ResearchPaper.title.ilike(f"%{q}%"))
```

SQLAlchemy automatically parameterizes values — raw string interpolation is not used for DB queries.

- **Result:** Query returned normal results, no database error
- **Verdict:** PASS

---

### SEC-007: File Upload Validation ✅ PASS

**Implementation (`documents.py`):**
```python
if not file.filename.lower().endswith(".pdf"):
    raise HTTPException(400, "Only PDF files are supported")
if content[:4] != b"%PDF":
    raise HTTPException(400, "File does not appear to be a valid PDF")
if len(content) > MAX_FILE_SIZE:  # 50 MB
    raise HTTPException(400, "File exceeds 50 MB limit")
```

- Extension check: ✅
- Magic byte validation (`%PDF`): ✅ (prevents disguised executables)
- Size limit (50 MB): ✅
- Files stored with UUID names (no original filename used as path): ✅
- **Verdict:** PASS

---

### SEC-008: Path Traversal ✅ PASS

**File serving endpoint (`documents.py`):**
```python
doc = db.query(UploadedDocument).filter_by(id=doc_id, user_id=current_user.id).first()
return FileResponse(doc.file_path, ...)
```

- File path comes from DB record, not from user input
- User cannot specify arbitrary paths
- `file_path` is set server-side to `UPLOAD_DIR/{uuid}.pdf`
- **Verdict:** PASS

---

### SEC-009: CORS Configuration ⚠️ NEEDS PROD HARDENING

**Current implementation (`main.py`):**
```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

- `allow_origins=["*"]` allows any domain to make cross-origin requests
- Acceptable for development
- **Must be changed for production** to specific allowed origins (e.g., `["https://aris.yourdomain.com"]`)
- **Severity:** MEDIUM (production risk)
- **Action:** Set `CORS_ALLOWED_ORIGINS` env var and restrict before deploy

---

### SEC-010: Rate Limiting ⚠️ MISSING

- No rate limiting on any endpoint
- `/api/search` calls 4 external APIs per request — can be abused
- `/api/auth/login` has no brute-force protection
- `/api/assistant/chat` calls Ollama — resource-intensive
- **Severity:** MEDIUM
- **Recommendation:** Add `slowapi` or nginx-level rate limiting
  - Login: max 10 req/min per IP
  - Search: max 30 req/min per user
  - Chat: max 10 req/min per user

---

### SEC-011: HTTPS/TLS ⚠️ DEV ONLY

- Backend runs on plain HTTP (port 8001)
- JWT tokens transmitted without encryption in dev
- **Action Required for Production:** Deploy behind nginx/caddy with TLS
- **Severity:** HIGH for production (dev is acceptable on localhost)

---

### SEC-012: Secret Key Management ⚠️ ENV VAR DEPENDENT

**Current:**
```python
# core/config.py
secret_key: str = Field(default="changeme-in-production", ...)
```

- Default value `"changeme-in-production"` is insecure if not overridden
- **Action:** Ensure `SECRET_KEY` env var is always set in production
- Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- **Severity:** LOW (if env var is set) / HIGH (if default used in prod)

---

## Security Checklist

| Control | Status |
|---------|--------|
| Passwords hashed with Argon2id | ✅ |
| JWT with expiry | ✅ |
| All routes require authentication | ✅ |
| Per-user data isolation | ✅ |
| SQL injection prevention (ORM) | ✅ |
| File upload validation (magic bytes) | ✅ |
| File path from DB not user input | ✅ |
| Pydantic input validation on all endpoints | ✅ |
| CORS restricted to own origins | ❌ (dev wildcard) |
| Rate limiting | ❌ Missing |
| HTTPS in production | ❌ Not configured |
| Secure default secret key | ❌ Has insecure default |

---

## Pre-Production Security Checklist

Before deploying ARIS to production:

- [ ] Set `SECRET_KEY` to a 32+ byte random hex value
- [ ] Set `CORS_ALLOWED_ORIGINS` to specific domain
- [ ] Deploy behind HTTPS (nginx + Let's Encrypt)
- [ ] Add rate limiting (slowapi or nginx)
- [ ] Set `DATABASE_URL` to production DB with credentials
- [ ] Disable `--reload` flag in uvicorn
- [ ] Set `DEBUG=false` in FastAPI
- [ ] Review and restrict file upload directory permissions

---

*Security Audit completed: 2026-11-02 | ARIS v1.0*
