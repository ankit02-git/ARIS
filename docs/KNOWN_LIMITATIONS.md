# ARIS Known Limitations

**Version:** 1.0  
**Date:** 2026-11-02  
**Purpose:** Honest catalog of known gaps, design constraints, and non-implemented features

---

## Classification

- 🔴 **HIGH** — Affects core functionality or user experience significantly
- 🟡 **MEDIUM** — Noticeable limitation with workaround available
- 🟢 **LOW** — Minor, cosmetic, or edge-case only

---

## Active Limitations

### LIM-001 — Ollama Offline: Empty Response Instead of Error 🟡

**Description:**  
When the Ollama AI service is offline or times out, the assistant returns an empty `content` field instead of a human-readable error message. The frontend displays a blank assistant message bubble.

**File:** `backend/app/services/rag_service.py`  
**Affected:** AI Research Assistant page

**Workaround:** Restart Ollama (`ollama serve`), then retry.

**Fix:** Return `"AI assistant is currently unavailable. Please check Ollama is running."` when content is empty.

---

### LIM-002 — Search Silent Error Swallowing 🟡

**Description:**  
Semantic search exceptions are silently swallowed:
```python
except Exception:
    return []  # no log, no re-raise
```
If the embedding model fails to load, FAISS crashes, or any unexpected error occurs during semantic search, it returns an empty list without any log entry. Difficult to diagnose.

**File:** `backend/app/api/routes/search.py:85`

**Workaround:** Check Uvicorn logs manually.

**Fix:** At minimum, add `import logging; logger.exception("Semantic search failed")` in the except block.

---

### LIM-003 — Chunk Creation Failure Silent 🟡

**Description:**  
In `rag_service.py`, DocumentChunk creation commits happen inside a try/except that rolls back but doesn't re-raise. The caller (`_process_pdf_extraction`) may believe chunks were created when they weren't.

**File:** `backend/app/services/rag_service.py:72`

**Impact:** Documents may show status="completed" but have 0 chunks — analysis endpoint will return 400 "No text chunks found."

**Workaround:** Re-upload the document to trigger reprocessing.

---

### LIM-004 — Recommendations Empty for New Users 🟢

**Description:**  
Recommendations use Jaccard similarity against the last 200 papers globally. For new accounts with < 2 saved papers, recommendations are always empty.

**File:** `backend/app/api/routes/recommendations.py`

**Impact:** New users see "No recommendations" until they build a library.

**Workaround:** Save at least 3–5 papers to get recommendations.

---

### LIM-005 — Background PDF Processing: New Engine Per Call 🟢

**Description:**  
`_process_pdf_extraction` creates a new SQLAlchemy engine per PDF upload:
```python
engine = create_engine(db_url)
```
This bypasses the application's connection pool and creates a fresh connection each time.

**File:** `backend/app/api/routes/documents.py`

**Impact:** For high-volume uploading, connection overhead increases. Not an issue for typical single-user uploads.

**Workaround:** None needed for dev use.

**Fix:** Pass a DB session or use `get_db()` factory pattern with the app engine.

---

### LIM-006 — Dashboard `research_activity` Hardcoded 🟢

**Description:**  
The `research_activity` field on the dashboard is based on hardcoded string logic:
```python
if saved_count > 5: return "Trend review active"
elif saved_count > 0: return "Analysis active"
else: return "Ready"
```
It does not reflect actual recent user activity (timestamps, session data).

**File:** `backend/app/api/routes/dashboard.py`

**Impact:** Activity badge is not meaningful.

---

### LIM-007 — No Streaming for AI Responses 🟡

**Description:**  
Ollama responses are collected in full before returning to the client. Users see a loading spinner for 30–60 seconds before any text appears.

**File:** `backend/app/api/routes/assistant.py`

**Impact:** Poor perceived performance for AI chat.

**Fix:** Use `httpx` streaming + FastAPI `StreamingResponse` to send tokens incrementally.

---

### LIM-008 — No Search Result Caching 🟡

**Description:**  
Every search query hits all 4 external APIs in real time (~3s). Identical queries within a short window re-fetch everything.

**Fix:** Add Redis or in-memory cache with 30-minute TTL.

---

### LIM-009 — CORS Wildcard (Not Production Safe) 🔴

**Description:**  
`allow_origins=["*"]` must be changed before any public deployment.

**File:** `backend/app/main.py`

**Fix:** Set allowed origins to specific frontend domain.

---

### LIM-010 — No Rate Limiting 🔴

**Description:**  
No rate limiting on any endpoint. Login brute-force is possible. Search can be abused to hit external APIs repeatedly.

**Fix:** Add `slowapi` middleware or nginx-level rate limiting before production.

---

### LIM-011 — Conversation Context Window Not Managed 🟡

**Description:**  
All previous messages in a conversation are sent to the LLM without truncation. Very long conversations may exceed llama3.2's context window (~8K tokens), causing degraded or truncated responses.

**File:** `backend/app/api/routes/assistant.py`

**Fix:** Implement sliding window — send only last N messages (e.g., last 10).

---

### LIM-012 — Collections Rename Not Surfaced in Frontend 🟢

**Description:**  
`PATCH /api/collections/{id}` exists in the backend but `CollectionsPage.tsx` has no edit/rename UI.

**Impact:** Users cannot rename collections through the UI.

**Workaround:** Use the API directly.

---

### LIM-013 — Report Generation Topic Dependency 🟡

**Description:**  
Report generation requires specifying papers or a topic. With an empty library, generated reports will be generic or empty.

**Impact:** New users cannot generate meaningful reports until they build a library.

---

### LIM-014 — External APIs May Be Unavailable 🟡

**Description:**  
arXiv, CrossRef, PubMed, and Semantic Scholar are third-party services. They may be rate-limited, slow, or temporarily down.

**Impact:** Search returns fewer results or empty results.

**Current behavior:** Failures are silently ignored (`except Exception: continue`).

---

## Feature Gaps (Not Implemented)

| Feature | Description | Priority |
|---------|-------------|----------|
| Response streaming | Token-by-token AI response display | HIGH |
| Search result caching | Redis cache for external API results | HIGH |
| Password reset via email | `confirm-reset` endpoint exists but no email sender | MEDIUM |
| Bulk paper import | No batch upload via BibTeX/RIS/CSV | MEDIUM |
| Paper full-text indexing from URLs | Only PDFs can be indexed | MEDIUM |
| Export to Zotero/Mendeley | No reference manager export | LOW |
| DOI metadata auto-fetch | Upload PDF, auto-fill metadata via CrossRef | LOW |
| Mobile responsive UI | Frontend not tested on mobile | LOW |

---

## Fixed Limitations (This Audit Cycle)

| ID | Description | Fix Commit |
|----|-------------|-----------|
| BUG-001 | DELETE endpoints crashed frontend (204 No Content) | api.ts content-type check |
| BUG-002 | PDF title extraction picked metadata line | Skip-pattern heuristic |
| BUG-003 | Sequential search ~9s latency | ThreadPoolExecutor parallel |
| CRITICAL | Pydantic v2 500 crash on FileResponse annotation | Removed return annotations |

---

*Known Limitations document — ARIS v1.0 — 2026-11-02*
