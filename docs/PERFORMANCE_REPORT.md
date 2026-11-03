# ARIS Performance Report

**Date:** 2026-11-02  
**Environment:** Local development — Windows 10 x64, PostgreSQL 16, Ollama llama3.2  
**Backend:** FastAPI + Uvicorn (single worker, --reload mode)  
**Measurement:** PowerShell `Stopwatch` measuring HTTP round-trip time

---

## Executive Summary

ARIS performs well for a local development deployment. Most endpoints respond in under 20ms after warm-up. The main performance bottleneck is external API search (3–4 seconds after parallel fix) and Ollama inference (30–60 seconds — inherent to local LLM). All improvements from the audit cycle are documented with before/after metrics.

---

## Benchmark Results

### Core API Latency (Warm, Single Request)

| Endpoint | Method | Latency | Rating |
|----------|--------|---------|--------|
| GET /api/dashboard | GET | 8ms | ✅ EXCELLENT |
| GET /api/analytics | GET | 6ms | ✅ EXCELLENT |
| GET /api/collections | GET | 7ms | ✅ EXCELLENT |
| GET /api/conversations | GET | 8ms | ✅ EXCELLENT |
| GET /api/recommendations | GET | 9ms | ✅ EXCELLENT |
| GET /api/gaps | GET | 6ms | ✅ EXCELLENT |
| GET /api/tags | GET | 5ms | ✅ EXCELLENT |
| GET /api/reports | GET | 7ms | ✅ EXCELLENT |
| GET /api/saved-searches | GET | 6ms | ✅ EXCELLENT |
| GET /api/documents | GET | 8ms | ✅ EXCELLENT |
| POST /api/collections (create) | POST | 22ms | ✅ GOOD |
| DELETE /api/collections/{id} | DELETE | 18ms | ✅ GOOD |

---

### Search Endpoint — Before vs After Optimization

| Condition | Latency | Change |
|-----------|---------|--------|
| Before fix (sequential 4 providers) | ~9,336ms | — |
| After fix (parallel ThreadPoolExecutor) | ~3,200ms | **-66%** |
| Cold start (model load included) | ~3,400ms | — |
| Warm subsequent calls | ~3,000ms | — |

**Fix applied:** `search_service.py` — sequential loop replaced with `ThreadPoolExecutor(max_workers=4)` with 8-second timeout.

The remaining ~3s is the latency of the slowest external provider (arXiv, CrossRef, Semantic Scholar, PubMed) — this is network I/O and cannot be eliminated without caching.

---

### Cold Start Latency

| Component | Cold Start | Warm |
|-----------|-----------|------|
| Dashboard (DB pool init) | 2,157ms | 8ms |
| First search (model lazy load) | 3,400ms | 3,200ms |
| First chat (Ollama, model cached) | ~45,000ms | ~30,000ms |

Cold start is acceptable for a development server. In production with a dedicated Uvicorn process (no --reload), this would be lower.

---

### AI Assistant (Ollama) Latency

| Query Complexity | Response Time |
|-----------------|---------------|
| Simple factual | ~30s |
| Document-context (291 chunks) | ~40–50s |
| Multi-turn (3 prev messages) | ~45–60s |

**Note:** Ollama llama3.2 is running on CPU (no GPU detected). GPU inference would reduce this to 2–5s.

---

## Bottleneck Analysis

### Bottleneck 1: External Search APIs (~3s)

**Root cause:** Even in parallel, the slowest provider determines total latency. PubMed and CrossRef often take 2–3s.

**Mitigation options:**
1. Cache search results in Redis (TTL: 30min) — would reduce to ~5ms on cache hit
2. Reduce provider count for faster queries (prioritize arXiv for speed)
3. Add per-provider timeout of 3s instead of 8s global

**Current status:** Not implemented (out of audit scope), documented for future work.

---

### Bottleneck 2: Ollama LLM Inference (~30–60s)

**Root cause:** llama3.2 on CPU — ~1–2 tokens/second generation speed.

**Mitigation options:**
1. GPU acceleration (CUDA/Metal)
2. Use smaller model (llama3.2:1b instead of 3b)
3. Add streaming response (user sees tokens as they're generated)
4. Add response timeout with partial display

**Current status:** Streaming not implemented. Users see a loading state until full response arrives.

---

### Bottleneck 3: PDF Processing (Background Task, ~2–5s per page)

**Root cause:** `PyMuPDF.open()` + text extraction per page + DB chunk inserts.

**For a 20-page paper:**
- Text extraction: ~0.5s
- 291 chunks × DB insert: ~2–3s total
- Background task, user not blocked

**Status:** Acceptable — background processing, not blocking.

---

## Database Query Performance

All frequently-accessed queries use indexed columns:
- `user_id` on all user-owned tables ✅
- `paper_id` on DocumentChunk ✅
- `document_id` on DocumentChunk ✅
- `chunk_index` ordering ✅

**No N+1 query problems identified** in audit — list endpoints do single queries, not per-item queries.

---

## Memory Usage

| Component | Est. Memory |
|-----------|-------------|
| Uvicorn process | ~150MB |
| all-MiniLM-L6-v2 model | ~90MB |
| FAISS index (empty) | ~1MB |
| FAISS index (1000 chunks) | ~5MB |
| PostgreSQL | ~50MB |
| Ollama llama3.2 | ~2–4GB (model weights) |

Total: **~2.5–4.5 GB RAM** (dominated by Ollama model)

---

## Performance Recommendations

| Priority | Recommendation | Expected Impact |
|----------|----------------|-----------------|
| HIGH | Cache search results (Redis, 30min TTL) | 3s → <10ms on cache hit |
| HIGH | Streaming Ollama responses | Perceived latency -70% |
| MEDIUM | GPU for Ollama | 30–60s → 2–5s |
| MEDIUM | Per-provider timeout (3s) | Max search latency capped at 3s |
| LOW | Preload embedding model on startup | Eliminate first-search 200ms overhead |
| LOW | Add pg indexes on `created_at` for pagination | Better for large libraries |

---

*Performance Report generated: 2026-11-02 | ARIS v1.0*
