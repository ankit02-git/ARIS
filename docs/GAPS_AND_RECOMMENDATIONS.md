# ARIS — Gaps & Recommendations Audit

> This document is part of the formal 7-document audit package for ARIS v1.0.  
> See also: `SYSTEM_AUDIT.md`, `TEST_RESULTS.md`, `MANUAL_TEST_CASES.md`,  
> `AI_VALIDATION.md`, `SECURITY_AUDIT.md`, `PERFORMANCE_REPORT.md`, `KNOWN_LIMITATIONS.md`

**Date:** 2026-11-02  
**Based on:** Full codebase static analysis + live API testing

---

## Gap Registry

This document catalogs every identified gap between specification (`SRS.md`) and implementation, ranked by user impact.

---

### GAP-001: AI Response Streaming 🔴 HIGH IMPACT

**SRS requirement:** "AI Research Assistant shall respond with contextual answers"  
**Current state:** Full response buffered before sending (~30–60s wait)  
**User experience:** Blank screen for 30–60 seconds, then full text appears suddenly  

**Recommended fix:**
```python
# assistant.py — use StreamingResponse
from fastapi.responses import StreamingResponse
import httpx

async def stream_ollama(prompt, model):
    async with httpx.AsyncClient() as client:
        async with client.stream("POST", "http://localhost:11434/api/generate",
                                  json={"model": model, "prompt": prompt, "stream": True}) as r:
            async for chunk in r.aiter_lines():
                data = json.loads(chunk)
                yield data.get("response", "")
```

**Priority:** Implement before user-facing deployment.

---

### GAP-002: Search Result Caching 🔴 HIGH IMPACT

**SRS requirement:** "Search shall return results from multiple academic databases"  
**Current state:** Every search re-fetches all 4 external APIs (~3s per query)  
**Impact:** Identical queries in the same session are slow with no benefit  

**Recommended fix:**
- Add `cachetools.TTLCache` or Redis cache
- Key: `sha256(query + provider)`
- TTL: 30 minutes

```python
from cachetools import TTLCache
_search_cache: TTLCache = TTLCache(maxsize=200, ttl=1800)

def search_academic_papers(query: str, limit: int = 5) -> list[dict]:
    key = f"{query.lower()}:{limit}"
    if key in _search_cache:
        return _search_cache[key]
    results = ... # parallel fetch
    _search_cache[key] = results
    return results
```

---

### GAP-003: Password Reset Email 🟡 MEDIUM IMPACT

**SRS requirement:** "Users shall be able to reset forgotten passwords"  
**Current state:** `POST /api/auth/request-reset` and `/confirm-reset` endpoints exist, but no email sender is implemented. Tokens are generated but never sent.  
**Impact:** Users cannot recover forgotten passwords  

**Recommended fix:**
- Add `sendgrid` or `smtp` integration
- Store reset tokens in DB with expiry
- Send reset link via email

---

### GAP-004: Ollama Unavailable: User-Facing Error 🟡 MEDIUM IMPACT

**Current state:** When Ollama is offline, `rag_answer()` falls through to `rule_based_answer()` which returns meaningful text. However, if `rule_based_answer()` is also empty (no chunks), the frontend shows a blank bubble.  
**Note:** The rule-based fallback IS present and working — this gap applies only to the case with 0 chunks.  

**Recommended enhancement:** In `assistant.py`, if `content` is empty string after RAG, substitute a fallback message before saving to DB.

```python
if not content:
    content = "I don't have enough context to answer this question. Try saving some papers to your library first."
```

---

### GAP-005: Collections Edit/Rename UI 🟢 LOW IMPACT

**Current state:** `PATCH /api/collections/{id}` implemented in backend. Frontend `CollectionsPage.tsx` has no edit button or modal.  
**Impact:** Users cannot rename collections through UI.

**Recommended fix:** Add an edit icon to each collection card that opens an inline input or modal with the current name pre-filled.

---

### GAP-006: Bulk Paper Import (BibTeX/RIS) 🟢 LOW IMPACT

**Current state:** Papers can only be added one at a time via search-and-save.  
**Impact:** Researchers with existing libraries in Zotero/Mendeley cannot migrate their data.

**Recommended fix:** Add `POST /api/library/import` endpoint that accepts BibTeX text and creates `ResearchPaper` + `SavedPaper` records in bulk.

---

### GAP-007: Conversation Context Window Truncation 🟡 MEDIUM IMPACT

**Current state:** All conversation messages are passed to the LLM without truncation.  
**Impact:** Long conversations may exceed model context window, causing degraded responses.  

**Recommended fix:**
```python
# assistant.py — limit to last 10 messages
history = messages[-10:] if len(messages) > 10 else messages
```

---

### GAP-008: Rate Limiting 🔴 HIGH IMPACT (Production)

**Current state:** No rate limiting on any endpoint.  
**Affected endpoints:**
- `POST /api/auth/login` — brute force vulnerable
- `GET /api/search` — each call triggers 4 external APIs
- `POST /api/assistant/chat` — each call triggers Ollama inference

**Recommended fix:**
```bash
pip install slowapi
```
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("10/minute")
def login(...): ...
```

---

## Implementation Roadmap

### Sprint 1 — Before User Demo (High Priority)
| Task | Effort | Impact |
|------|--------|--------|
| Streaming Ollama responses | 4h | UX: perceived speed |
| Empty content fallback message | 30min | UX: no blank bubbles |
| Conversation window truncation | 1h | Stability |

### Sprint 2 — Before Public Release (Medium Priority)
| Task | Effort | Impact |
|------|--------|--------|
| Search result caching (TTLCache) | 2h | Performance |
| Rate limiting (slowapi) | 2h | Security |
| CORS restriction for prod | 30min | Security |
| Password reset email (SMTP) | 4h | Feature completeness |

### Sprint 3 — Enhancement (Low Priority)
| Task | Effort | Impact |
|------|--------|--------|
| Collections edit/rename UI | 2h | UX polish |
| BibTeX/RIS bulk import | 6h | Power users |
| GPU Ollama (if hardware available) | 1h | Performance |
| DOI metadata auto-fetch | 3h | UX polish |

---

## Audit Completion Status

All 7 audit documents have been written:

| Document | Status |
|----------|--------|
| `SYSTEM_AUDIT.md` | ✅ Complete |
| `TEST_RESULTS.md` | ✅ Complete |
| `MANUAL_TEST_CASES.md` | ✅ Complete |
| `AI_VALIDATION.md` | ✅ Complete |
| `SECURITY_AUDIT.md` | ✅ Complete |
| `PERFORMANCE_REPORT.md` | ✅ Complete |
| `KNOWN_LIMITATIONS.md` | ✅ Complete |

All critical bugs fixed:
- ✅ BUG-001: api.ts 204 crash
- ✅ BUG-002: document title extraction
- ✅ BUG-003: sequential search latency
- ✅ CRITICAL: Pydantic v2 FileResponse annotation crash

---

*Gaps & Recommendations Audit — ARIS v1.0 — 2026-11-02*
