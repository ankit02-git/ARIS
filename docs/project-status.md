# ARIS Project Status

## Milestone 1: Foundation ✅ COMPLETE
- Workspace, Vite + React + TypeScript frontend, FastAPI backend, PostgreSQL
- Auth (JWT + Argon2), user model, DB schema bootstrapping
- Passing auth tests

## Milestone 2: Academic Discovery ✅ COMPLETE
- All four academic source adapters: arXiv, Semantic Scholar, Crossref, PubMed
- Unified search with deduplication (DOI, external_id, URL, title)
- Save-paper flow with library persistence
- Dashboard with real stats, insights, evidence brief, semantic paper comparison
- CSV export of comparison results

## Milestone 3: Multi-Page Frontend + Document Intelligence ✅ COMPLETE
- React Router with 10 functional pages
- AuthContext with JWT persistence
- Recharts analytics charts from real DB data
- PDF upload with PyMuPDF background extraction
- Analytics, Recommendations, Reports, Documents endpoints

## Milestone 4: Advanced AI Capabilities ✅ COMPLETE
- Embedding service: `all-MiniLM-L6-v2` (384-dim, stored in PostgreSQL as float32 bytes)
- FAISS flat inner-product index (in-memory, auto-rebuilt from DB)
- Hybrid search: external APIs + semantic DB retrieval
- Full RAG pipeline: chunking → FAISS retrieval → Ollama (llama3.2) → citation-backed answers
- Research gap engine: limitation extraction, domain underrepresentation, methodology gaps, emerging topics
- Gap analysis frontend (expandable gap cards with evidence, excerpts, suggestions)

## Milestone 5: Documentation ✅ COMPLETE
- SRS.md: comprehensive requirements specification (480+ lines)
- README.md: professional with architecture diagram, full setup guide
- 38/38 pytest tests passing (23 new Milestone 4 tests)

## Milestone 6: Completion ✅ COMPLETE
- ComparisonPage.tsx — dedicated paper comparison UI with pairwise scores, evidence excerpts, progress bars
- CollectionsPage.tsx — full collections CRUD with paper management + Analysis tab (keywords, domains, year chart)
- Persistent conversations — ai_conversations + ai_messages DB tables, history sidebar in AssistantPage
- DOCX export — python-docx integration in reports.py (PDF/DOCX/CSV/JSON/BibTeX)
- BibTeX export — academic citation format generation
- Analytics filters — year_from, year_to, source, domain query params on /api/analytics
- SavedSearch model + /api/saved-searches CRUD (save, list, delete)
- PaperTag model + /api/tags system (add, remove, list, by-tag, paper-tags)
- ExplorePage — saved searches dropdown (clock icon), "Save search" button after results
- /api/auth/change-password — verified with correct cross-session DB handling
- /api/auth/request-reset + /api/auth/confirm-reset — token-based password reset
- /api/search — author and year filter params
- /api/documents/search — full-text search within user uploads
- /api/collections/{id}/analyze — keyword/domain/year analysis for any collection
- CSS variable theme system — --bg/--surface/--surface-active aliases for dark/light mode
- ThemeContext + AppLayout theme toggle (localStorage-persisted dark/light mode)
- SettingsPage — Appearance section + Change Password form
- LibraryPage — smart tags (add/remove inline), PDF preview panel, Document Search tab
- 21 new tests in test_milestone6b.py (tags, saved searches, password, collection analysis)
- conftest.py updated to include all new models for test isolation
- TypeScript: 0 errors, Vite build: success
- **79/79 pytest tests passing**

---

## Current State

### Running services
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8001 |
| API docs | http://localhost:8001/docs |

### Test results
```
79 passed (38 original + 20 Milestone 6 + 21 Milestone 6b)
```

### End-to-end verification (latest)
- ✅ Register + Login
- ✅ Dashboard with real stats
- ✅ Save paper → Library
- ✅ Collections CRUD (create, add paper, remove paper, delete)
- ✅ Analytics (keywords, domains, years) with year/source filters
- ✅ Ollama connected (llama3.2)
- ✅ AI chat creates persistent conversation
- ✅ Conversation history sidebar loads past chats
- ✅ Research gap analysis (14 findings from 3 papers)
- ✅ Paper comparison (ComparisonPage with pairwise scores)
- ✅ Recommendations
- ✅ Report generation (PDF/DOCX/CSV/JSON/BibTeX)
- ✅ Documents endpoint
- ✅ Saved searches (save, load, delete from Explore page)
- ✅ Smart tags on library papers (add/remove inline)
- ✅ Collection analysis (keywords, domains, year chart)
- ✅ Password change from Settings page
- ✅ Light/dark theme toggle (persisted in localStorage)
- ✅ TypeScript: no errors
- ✅ Vite build: success

---

## Full API Endpoint List

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| /api/auth/register | POST | ❌ | Register |
| /api/auth/login | POST | ❌ | Login → JWT |
| /api/auth/me | GET | ✅ | Current user |
| /api/search | GET | ✅ | Multi-source + semantic search |
| /api/library | GET | ✅ | List saved papers |
| /api/library/save-paper | POST | ✅ | Save paper + queue embedding |
| /api/library/remove/{id} | DELETE | ✅ | Remove from library |
| /api/dashboard | GET | ✅ | Dashboard stats |
| /api/insights | GET | ✅ | Research insights |
| /api/brief | GET | ✅ | Evidence brief |
| /api/compare | POST | ✅ | Semantic paper comparison |
| /api/analytics | GET | ✅ | Charts data (filterable) |
| /api/gaps | GET | ✅ | Research gap analysis |
| /api/gaps/rebuild-index | POST | ✅ | Rebuild FAISS index |
| /api/assistant/status | GET | ✅ | Ollama status |
| /api/assistant/chat | POST | ✅ | RAG chat + persist conversation |
| /api/assistant/embed-library | POST | ✅ | Queue all embeddings |
| /api/conversations | GET | ✅ | List conversations |
| /api/conversations/{id} | GET | ✅ | Get conversation + messages |
| /api/conversations/{id} | DELETE | ✅ | Delete conversation |
| /api/collections | GET | ✅ | List collections |
| /api/collections | POST | ✅ | Create collection |
| /api/collections/{id} | GET | ✅ | Collection detail + papers |
| /api/collections/{id} | PATCH | ✅ | Update collection |
| /api/collections/{id} | DELETE | ✅ | Delete collection |
| /api/collections/{id}/papers | POST | ✅ | Add paper to collection |
| /api/collections/{id}/papers/{pid} | DELETE | ✅ | Remove paper from collection |
| /api/collections/{id}/analyze | GET | ✅ | Keyword/domain/year analysis for collection |
| /api/saved-searches | GET | ✅ | List saved searches |
| /api/saved-searches | POST | ✅ | Save search query |
| /api/saved-searches/{id} | DELETE | ✅ | Delete saved search |
| /api/tags | GET | ✅ | List all user tags |
| /api/tags | POST | ✅ | Add tag to paper |
| /api/tags | DELETE | ✅ | Remove tag from paper |
| /api/tags/paper/{id} | GET | ✅ | Tags for specific paper |
| /api/tags/by-tag/{tag} | GET | ✅ | Papers with given tag |
| /api/auth/change-password | POST | ✅ | Change password (logged-in) |
| /api/auth/request-reset | POST | ❌ | Request password reset token |
| /api/auth/confirm-reset | POST | ❌ | Confirm password reset with token |
| /api/documents | GET | ✅ | List uploads (filterable by ?q=) |
| /api/documents/search | GET | ✅ | Full-text search across uploads |
| /api/documents/upload | POST | ✅ | Upload PDF |
| /api/documents/{id} | DELETE | ✅ | Delete upload |
| /api/documents/{id}/file | GET | ✅ | Serve raw PDF file |
| /api/recommendations | GET | ✅ | Recommended papers |
| /api/reports | GET | ✅ | List reports |
| /api/reports/generate | POST | ✅ | Generate PDF/DOCX/CSV/JSON/BibTeX |
| /api/reports/{id}/download | GET | ✅ | Download report |

---

## Database Tables

| Table | Description |
|-------|-------------|
| users | User accounts |
| research_papers | Normalized academic paper metadata |
| saved_papers | User ↔ paper saves (many-to-many) |
| uploaded_documents | User PDF uploads |
| collections | User-created paper collections |
| collection_papers | Collection ↔ paper membership |
| ai_conversations | Persistent chat sessions |
| ai_messages | Individual messages in conversations |
| paper_embeddings | 384-dim float32 vectors for semantic search |
| document_chunks | Text chunks for RAG retrieval |
| reports | Generated report metadata + file paths |
| saved_searches | User-saved search queries |
| paper_tags | User-assigned tags on saved papers |

---

## Development Checklist

- [x] Environment validation
- [x] PostgreSQL readiness
- [x] Backend project setup
- [x] Auth model and JWT flow
- [x] Database schema bootstrapping
- [x] Auth tests passing
- [x] Browser login/search flow verified
- [x] Four academic source adapters (arXiv, Semantic Scholar, Crossref, PubMed)
- [x] Unified search + deduplication
- [x] Save-paper flow with library persistence
- [x] Dashboard with real data
- [x] Evidence brief and insights
- [x] Semantic paper comparison (ComparisonPage)
- [x] React Router multi-page frontend (10 pages)
- [x] Explore Research page (filters, saves)
- [x] My Library page (saved papers + PDF uploads)
- [x] Research Analysis page (Recharts charts + gap analysis + filters)
- [x] AI Research Assistant page (chat + Ollama + RAG + persistent history)
- [x] Collections page (CRUD + paper management)
- [x] Recommendations page
- [x] Reports page (PDF/DOCX/CSV/JSON/BibTeX)
- [x] Settings page
- [x] PDF upload + background extraction (PyMuPDF)
- [x] Analytics endpoint from real DB (with filters)
- [x] AI assistant with Ollama + fallback
- [x] Semantic embeddings (all-MiniLM-L6-v2, stored in PostgreSQL)
- [x] FAISS in-memory vector index (rebuilt from DB on demand)
- [x] Hybrid search (external APIs + semantic DB retrieval)
- [x] Full RAG pipeline (document chunking + retrieval + Ollama generation + citations)
- [x] Research gap engine (limitation patterns, methodology gaps, emerging topics)
- [x] Collections CRUD with paper management
- [x] Persistent conversation storage (ai_conversations + ai_messages)
- [x] DOCX + BibTeX export formats
- [x] Analytics filters (year range, source)
- [x] Saved searches (save/load/delete)
- [x] Smart tags on library papers
- [x] Collection analysis tab (keywords, domains, years)
- [x] Password change from Settings
- [x] Light/dark theme toggle with localStorage persistence
- [x] CSS variable theme system (dark default + light toggle)
- [x] SRS.md documentation
- [x] Professional README.md
- [x] 79 pytest tests passing
- [x] TypeScript: 0 errors
- [x] Vite production build: success
- [x] End-to-end project verification
- [ ] GitHub publish (awaiting developer authorization)
- [x] Alembic migration scripts for all new models
- [ ] pgvector persistent index (future enhancement)

---

## How to run

### Start backend
```bash
cd backend
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Start frontend
```bash
cd frontend
npm run dev
```

### Run tests
```bash
cd backend
.venv\Scripts\python -m pytest tests/ -v
```

### Create DB tables (if needed)
```bash
cd backend
.venv\Scripts\python -c "
from app.db.base import Base
from app.db.session import engine
from app.models.user import User
from app.models.paper import ResearchPaper, SavedPaper
from app.models.document import UploadedDocument
from app.models.report import Report
from app.models.embedding import PaperEmbedding, DocumentChunk
from app.models.collection import Collection, CollectionPaper
from app.models.conversation import Conversation, ConversationMessage
Base.metadata.create_all(bind=engine)
print('Done')
"
```
