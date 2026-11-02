# Software Requirements Specification (SRS)

## ARIS — Affective Research Intelligence System

**Version:** 1.0  
**Date:** November 2026  
**Status:** Active Development — Milestone 4 Complete  

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for ARIS (Affective Research Intelligence System), a web-based academic research intelligence platform. ARIS enables researchers to discover, collect, analyze, and generate insights from affective computing literature.

### 1.2 Project Tagline

*Transforming Affective Computing Research into Actionable Intelligence.*

### 1.3 Scope

ARIS is a full-stack web application that:

- Collects academic research papers from arXiv, Semantic Scholar, Crossref, and PubMed
- Enables users to upload and process research PDFs
- Extracts structured information from papers using AI/NLP
- Provides semantic search and retrieval-augmented generation (RAG)
- Generates research gap analysis and trend analytics
- Supports multi-user workspaces with private data isolation

ARIS is specifically scoped to **academic research discovery and analysis**. It is not a social media monitoring tool or a real-time human emotion detection system.

### 1.4 Problem Statement

*"Extracting Information on Affective Computing Research from Data Analysis of Known Digital Platforms."*

Affective computing researchers face challenges in:
- Systematically discovering relevant papers across multiple academic platforms
- Extracting structured insights from large paper collections
- Identifying research gaps and emerging topics
- Synthesizing findings across multiple publications

ARIS directly addresses these challenges.

---

## 2. Definitions and Terminology

| Term | Definition |
|------|------------|
| Affective Computing | The field of AI concerned with recognizing, interpreting and processing human emotions |
| RAG | Retrieval-Augmented Generation — an AI technique that retrieves relevant documents before generating answers |
| FAISS | Facebook AI Similarity Search — a library for efficient vector similarity search |
| Embedding | A dense numerical vector representation of text for semantic similarity calculation |
| Research Gap | An area of underrepresentation, methodological absence, or frequently reported limitation in a body of literature |
| Evidence Brief | A structured synthesis of key themes, methods, and patterns from a user's saved paper library |
| Chunk | A fixed-size text segment extracted from a paper, used as the retrieval unit in RAG |
| all-MiniLM-L6-v2 | A lightweight 384-dimensional sentence-transformers embedding model |
| Ollama | A local LLM inference framework supporting open-weight models |

---

## 3. System Description

### 3.1 User Classes

| Class | Description |
|-------|-------------|
| Student Researcher | Uses ARIS to discover literature, save papers, generate summaries and research questions |
| Academic | Performs systematic literature reviews, gap analysis, and evidence synthesis |
| System Administrator | Manages taxonomy updates, monitors processing jobs |

### 3.2 Assumptions

1. The system runs on a Windows 11 machine with at least 8 GB RAM available.
2. PostgreSQL 15+ is installed and accessible locally.
3. Internet access is available for academic API calls.
4. Ollama is optionally available — the system remains functional without it.
5. All academic API services are used within their stated rate limits and terms of service.
6. Users upload only legally accessible research PDFs.

### 3.3 Constraints

1. No NVIDIA GPU — all AI inference runs on CPU.
2. No paid external API dependencies (OpenAI, Gemini, Anthropic, etc.).
3. All models must be freely available under permissive licenses.
4. Storage budget for models and data: 50 GB maximum.
5. AI model concurrency limited to 1 inference request at a time.

---

## 4. Functional Requirements

### 4.1 Authentication and User Management

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | Users shall register with full name, email, and password |
| FR-AUTH-02 | Passwords shall be hashed using Argon2 |
| FR-AUTH-03 | Sessions shall use JWT tokens with configurable expiry |
| FR-AUTH-04 | Protected routes shall reject unauthenticated requests with HTTP 401 |
| FR-AUTH-05 | Each user shall have a private workspace isolated from other users |

### 4.2 Academic Research Discovery

| ID | Requirement |
|----|-------------|
| FR-SEARCH-01 | The system shall search arXiv, Semantic Scholar, Crossref, and PubMed simultaneously |
| FR-SEARCH-02 | Results from all sources shall be normalized into a common paper schema |
| FR-SEARCH-03 | Duplicate papers shall be detected by DOI, external_id, URL, or title |
| FR-SEARCH-04 | Search shall support a `mode` parameter: `external`, `semantic`, `hybrid` |
| FR-SEARCH-05 | The system shall return results when any subset of APIs is available |

### 4.3 Research Library

| ID | Requirement |
|----|-------------|
| FR-LIB-01 | Users shall be able to save papers from search results |
| FR-LIB-02 | Users shall be able to remove papers from their library |
| FR-LIB-03 | Saved papers shall persist in PostgreSQL |
| FR-LIB-04 | Academic paper records shall be shared across users (deduplication) |
| FR-LIB-05 | SavedPaper records shall be private per user |

### 4.4 PDF Upload and Processing

| ID | Requirement |
|----|-------------|
| FR-PDF-01 | Users shall be able to upload PDF files up to 50 MB |
| FR-PDF-02 | The system shall reject files that are not valid PDFs |
| FR-PDF-03 | PDF text extraction shall run as a background task |
| FR-PDF-04 | Processing status shall be visible (pending, processing, completed, failed) |
| FR-PDF-05 | Uploaded PDFs shall be stored in user-private storage |
| FR-PDF-06 | Users shall be able to delete their uploaded documents |

### 4.5 Embeddings and Semantic Search

| ID | Requirement |
|----|-------------|
| FR-EMB-01 | Embeddings shall be generated using all-MiniLM-L6-v2 (384 dimensions) |
| FR-EMB-02 | Embeddings shall be stored as raw bytes in PostgreSQL |
| FR-EMB-03 | A FAISS flat index shall be built from stored embeddings for fast retrieval |
| FR-EMB-04 | The FAISS index shall be rebuilable from the database without data loss |
| FR-EMB-05 | Embedding generation shall be queued as a background task when a paper is saved |

### 4.6 RAG-Based AI Assistant

| ID | Requirement |
|----|-------------|
| FR-RAG-01 | The assistant shall retrieve relevant document chunks before generating answers |
| FR-RAG-02 | Retrieved chunks shall be scored by combined semantic and keyword overlap |
| FR-RAG-03 | The system shall call Ollama when available; fall back to rule-based extraction otherwise |
| FR-RAG-04 | Every answer shall include citations identifying supporting source papers |
| FR-RAG-05 | The assistant shall never fabricate citations or page numbers |
| FR-RAG-06 | Users shall be able to restrict context to specific selected papers |
| FR-RAG-07 | Conversation history shall be passed to the LLM for contextual continuity |

### 4.7 Research Analytics

| ID | Requirement |
|----|-------------|
| FR-ANAL-01 | The system shall compute publications by year from saved paper metadata |
| FR-ANAL-02 | The system shall classify papers into affective computing domains |
| FR-ANAL-03 | The system shall extract keyword frequencies from titles and abstracts |
| FR-ANAL-04 | The system shall compute source distribution across academic providers |
| FR-ANAL-05 | All analytics shall use real database records — no fabricated statistics |

### 4.8 Research Gap Engine

| ID | Requirement |
|----|-------------|
| FR-GAP-01 | The system shall extract limitation sentences from abstracts |
| FR-GAP-02 | Limitations shall be categorized (data, generalizability, deployment, etc.) |
| FR-GAP-03 | The system shall detect underrepresented research domains |
| FR-GAP-04 | The system shall identify absent or rare methodologies |
| FR-GAP-05 | The system shall flag emerging topics with limited coverage |
| FR-GAP-06 | Every gap finding shall include supporting papers and evidence excerpts |
| FR-GAP-07 | Gap analysis shall require at least 3 saved papers |
| FR-GAP-08 | All findings shall include a disclaimer about collection bias |

### 4.9 Recommendations

| ID | Requirement |
|----|-------------|
| FR-REC-01 | The system shall recommend papers not already in the user's library |
| FR-REC-02 | Recommendations shall be ranked by Jaccard similarity to the user's library profile |
| FR-REC-03 | Every recommendation shall include a human-readable explanation |

### 4.10 Report Generation

| ID | Requirement |
|----|-------------|
| FR-REP-01 | Users shall be able to generate library summary reports |
| FR-REP-02 | Reports shall be exportable as PDF, CSV, and JSON |
| FR-REP-03 | Generated reports shall be stored per user and downloadable |
| FR-REP-04 | Reports shall include actual paper data — no fabricated references |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | Search responses shall complete within 15 seconds for 20 results |
| NFR-PERF-02 | Dashboard loading shall complete within 3 seconds |
| NFR-PERF-03 | AI assistant responses shall complete within 90 seconds |
| NFR-PERF-04 | The system shall support a working corpus of up to 500 saved papers |
| NFR-PERF-05 | Only one LLM inference request shall run concurrently |

### 5.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All API routes shall validate JWT tokens |
| NFR-SEC-02 | File uploads shall be validated for type, size, and content |
| NFR-SEC-03 | SQL injection shall be prevented through SQLAlchemy ORM parameterization |
| NFR-SEC-04 | No secrets, passwords, or tokens shall be committed to the repository |
| NFR-SEC-05 | User A shall never be able to access User B's private documents or conversations |
| NFR-SEC-06 | Stack traces shall never be exposed in API responses |

### 5.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | The system shall remain functional when Ollama is unavailable |
| NFR-REL-02 | The system shall remain functional when any single academic API is unreachable |
| NFR-REL-03 | Background processing failures shall not corrupt already-extracted data |
| NFR-REL-04 | The FAISS index shall be rebuildable from the database at any time |

### 5.4 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MAIN-01 | Backend shall follow modular architecture with separate service, repository, and route layers |
| NFR-MAIN-02 | Academic source adapters shall implement a common interface |
| NFR-MAIN-03 | Configuration shall use environment variables — no hardcoded secrets |
| NFR-MAIN-04 | Database changes shall use Alembic migrations |

---

## 6. Technology Stack

### 6.1 Frontend

| Technology | Version | Purpose | License |
|------------|---------|---------|---------|
| React | 19.x | UI framework | MIT |
| TypeScript | 7.x | Type safety | Apache 2.0 |
| Vite | 8.x | Build tool | MIT |
| React Router | 7.x | Client-side routing | MIT |
| Recharts | 3.x | Data visualisation | MIT |
| Lucide React | 1.x | Icons | ISC |
| TanStack Query | 5.x | Server state | MIT |

### 6.2 Backend

| Technology | Version | Purpose | License |
|------------|---------|---------|---------|
| Python | 3.12 | Runtime | PSF |
| FastAPI | 0.115+ | Web framework | MIT |
| SQLAlchemy | 2.x | ORM | MIT |
| Alembic | 1.x | Migrations | MIT |
| Pydantic | 2.x | Validation | MIT |
| python-jose | 3.x | JWT | MIT |
| passlib[argon2] | 1.7+ | Password hashing | BSD |
| httpx | 0.28+ | HTTP client | BSD |

### 6.3 AI / NLP

| Technology | Version | Purpose | License |
|------------|---------|---------|---------|
| sentence-transformers | 6.x | Embedding generation | Apache 2.0 |
| all-MiniLM-L6-v2 | — | 384-dim embeddings | Apache 2.0 |
| faiss-cpu | 1.15+ | Vector similarity search | MIT |
| PyMuPDF (fitz) | 2.x | PDF text extraction | AGPL-3.0† |
| ReportLab | 5.x | PDF generation | BSD |
| Ollama | — | Local LLM inference | MIT |
| llama3.2 / Qwen 2.5 | — | Language model | Meta LLAMA / Apache 2.0 |

† PyMuPDF (fitz) is licensed under AGPL-3.0. For commercial use, a commercial license from Artifex is required. For academic research use, AGPL applies.

### 6.4 Database

| Technology | Version | Purpose | License |
|------------|---------|---------|---------|
| PostgreSQL | 15+ | Primary database | PostgreSQL |
| psycopg | 3.x | PostgreSQL driver | LGPL |

---

## 7. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ARIS Architecture                     │
├──────────────────────┬──────────────────────────────────┤
│   Frontend (React)   │        Backend (FastAPI)          │
│   localhost:5173     │        localhost:8001             │
│                      │                                   │
│  AuthPage            │  /api/auth     ← JWT + Argon2     │
│  DashboardPage       │  /api/search   ← 4 source adapters│
│  ExplorePage         │  /api/library  ← Save/remove      │
│  LibraryPage         │  /api/documents← PDF upload       │
│  AnalysisPage        │  /api/analytics← Real DB stats    │
│  AssistantPage       │  /api/assistant← RAG + Ollama     │
│  RecommendationsPage │  /api/gaps     ← Gap engine       │
│  ReportsPage         │  /api/reports  ← PDF/CSV/JSON     │
│  SettingsPage        │  /api/recommendations             │
└──────────────────────┴──────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       PostgreSQL         Ollama          FAISS Index
    (primary store)   (llama3.2/qwen)  (in-memory, from DB)
    - research_papers
    - saved_papers
    - paper_embeddings
    - document_chunks
    - uploaded_documents
    - reports
    - users
```

### 7.1 Data Flow — Save Paper

```
User clicks "Save" → POST /api/library/save-paper
  → Dedup check (DOI / external_id / URL / title)
  → Upsert ResearchPaper record
  → Create SavedPaper link
  → Background: generate embedding → store PaperEmbedding
  → Background: create DocumentChunk from abstract
  → Invalidate FAISS index (rebuilt on next search)
```

### 7.2 Data Flow — RAG Chat

```
User sends message → POST /api/assistant/chat
  → Check Ollama availability
  → retrieve_relevant_chunks():
      → semantic_search() via FAISS (or fallback to keyword)
      → Score chunks by semantic + keyword overlap
      → Return top-6 chunks with paper metadata
  → build_rag_prompt() → numbered evidence context
  → call_ollama() → Ollama generates answer
  → Attach citations from retrieved chunks
  → Return {content, citations[]}
```

### 7.3 Data Flow — Research Gap Analysis

```
GET /api/gaps
  → Fetch all saved papers for user
  → _limitation_patterns(): extract + categorize limitation sentences
  → _underrepresented_topics(): count domain coverage
  → _methodology_gaps(): detect absent/rare methodologies
  → _emerging_topic_gaps(): check 8 emerging area patterns
  → Sort by evidence strength + gap type priority
  → Return gaps[] with supporting papers, excerpts, suggestions
```

---

## 8. Database Design

### 8.1 Entity Summary

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `research_papers` | Academic paper metadata (shared, deduped) |
| `saved_papers` | User↔paper link (private per user) |
| `paper_embeddings` | Float32 embedding vector per paper |
| `document_chunks` | Text chunks from abstracts/PDFs |
| `uploaded_documents` | User-uploaded PDF files |
| `reports` | Generated report records |

### 8.2 Key Constraints

- `research_papers.doi` — UNIQUE (nullable)
- `research_papers.external_id` — UNIQUE (nullable)
- `saved_papers (user_id, paper_id)` — UNIQUE composite
- `paper_embeddings.paper_id` — UNIQUE (one embedding per paper)
- All foreign keys use `CASCADE` on delete

---

## 9. API Specification

### 9.1 Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register: `{name, email, password}` → `{message}` |
| POST | /api/auth/login | Login: `{email, password}` → `{access_token}` |
| GET | /api/auth/me | Current user: → `{id, name, email}` |

### 9.2 Search

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/search?q=&limit=&mode= | Search academic papers |

### 9.3 Library

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/library | List saved papers |
| POST | /api/library/save-paper | Save a paper |
| DELETE | /api/library/remove/{id} | Remove from library |

### 9.4 Documents

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/documents/upload | Upload PDF |
| GET | /api/documents | List user's documents |
| DELETE | /api/documents/{id} | Delete document |

### 9.5 AI Assistant

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/assistant/status | Ollama availability |
| POST | /api/assistant/chat | RAG-powered chat |
| POST | /api/assistant/embed-library | Queue embedding for all saved papers |

### 9.6 Analytics and Gaps

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics | Charts data (year, domain, keywords, sources) |
| GET | /api/gaps | Research gap analysis |
| POST | /api/gaps/rebuild-index | Rebuild FAISS vector index |

### 9.7 Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports | List user's reports |
| POST | /api/reports/generate | Generate report |
| GET | /api/reports/{id}/download | Download report file |

---

## 10. AI/ML Methodology

### 10.1 Embedding Model

- **Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions:** 384
- **License:** Apache 2.0
- **Input:** Paper title + abstract concatenated
- **Storage:** Raw float32 bytes in PostgreSQL (`paper_embeddings.vector_bytes`)
- **Index:** FAISS `IndexFlatIP` (inner product on L2-normalized vectors = cosine similarity)

### 10.2 Language Model

- **Primary:** Ollama (local inference) — llama3.2 or Qwen 2.5 1.5B/3B
- **Fallback:** Rule-based extraction (no LLM required)
- **Context window:** ~4096 tokens (model-dependent)
- **Temperature:** 0.25 (low for factual answers)
- **Max tokens:** 600 per response

### 10.3 RAG Pipeline

1. **Chunking:** 400-character overlapping chunks (80-char overlap) from paper abstracts
2. **Retrieval:** FAISS semantic search → keyword overlap hybrid scoring (70% semantic, 30% keyword)
3. **Deduplication:** Best chunk per paper selected by score
4. **Top-k:** 6 chunks passed to LLM context
5. **Prompt:** Zero-shot instruction with numbered evidence citations

### 10.4 Gap Analysis

- **Limitation extraction:** Regex sentence splitting + keyword classification
- **Domain coverage:** Pattern matching against 10 affective computing domains
- **Methodology detection:** Pattern matching against 10 methodology families
- **Emerging topic check:** 8 predefined emerging areas (explainability, privacy, cross-cultural, etc.)
- **Evidence strength:** Weak (<2 papers), Emerging (2-4), Moderate (5-9), Strong (10+)

---

## 11. Security Requirements

1. JWT secrets stored in `.env` — never hardcoded or committed
2. Argon2 password hashing (not bcrypt or MD5)
3. File upload validation: extension check, magic bytes check (PDF header), size limit
4. All file storage paths are server-generated UUIDs — user cannot control path
5. Authorization checks on every document/report endpoint verify `user_id` ownership
6. SQL injection prevention through SQLAlchemy parameterized queries
7. CORS restricted to localhost development origins
8. Error responses never expose stack traces or internal paths

---

## 12. Testing Strategy

### 12.1 Implemented Tests

| File | Tests | Coverage |
|------|-------|---------|
| `tests/test_auth.py` | 1 | Register + login flow |
| `tests/test_library.py` | 1 | Save + deduplication |
| `tests/test_analysis.py` | 13 | Dashboard, brief, insights, comparison |
| `tests/test_academic_search.py` | 1 | Dedup + normalization |

### 12.2 Testing Approach

- **Unit tests:** Service-layer functions tested in isolation with in-memory SQLite
- **Integration tests:** HTTP endpoints tested with FastAPI `TestClient`
- **Mock strategy:** External APIs mocked; embedding model monkeypatched
- **Assertion style:** Specific field value assertions, not just status code checks

### 12.3 Acceptance Criteria

- All 15 existing tests pass on fresh database
- Backend imports without errors
- Frontend builds with `tsc --noEmit` returning no errors
- API health check returns `{"status": "ok"}`
- Register → Login → Search → Save → Dashboard flow completes without errors

---

## 13. Known Limitations

1. **PDF OCR:** Scanned PDFs without text layer return minimal extraction. OCR is not implemented in v1.
2. **FAISS persistence:** The FAISS index is in-memory and must be rebuilt on server restart (automated via `build_faiss_index` on first search).
3. **Concurrent inference:** Only one Ollama request at a time — parallel requests queue sequentially.
4. **Collection bias:** Research gap analysis is relative to the user's saved library, not the entire literature.
5. **Embedding model download:** `all-MiniLM-L6-v2` (~22 MB) is downloaded from HuggingFace on first use.
6. **Windows symlinks:** HuggingFace Hub warns about symlink limitations on Windows — caching works but may use more disk space.

---

## 14. Future Enhancements

1. Alembic migration scripts for all new models
2. Full OCR support for scanned PDFs (Tesseract)
3. pgvector extension for persistent semantic search without FAISS rebuild
4. Paper collections and tagging
5. Literature review generation (multi-paper synthesis)
6. BibTeX export
7. Email notifications for background job completion
8. Saved searches
9. Multi-user paper collections / collaborative workspaces
10. API rate limiting and abuse protection
