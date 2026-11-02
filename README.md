# ARIS — Affective Research Intelligence System

> **Transforming Affective Computing Research into Actionable Intelligence**

ARIS is a full-stack academic research intelligence platform that collects, analyzes, and synthesizes research publications in the Affective Computing domain. It integrates four academic APIs, local AI models, semantic search, and a RAG-based research assistant into a single professional-grade web application.

---

## Features

| Module | Capabilities |
|---|---|
| **Academic Discovery** | Search arXiv, Semantic Scholar, Crossref, PubMed simultaneously with deduplication |
| **Research Library** | Save papers, organize into collections, upload PDFs |
| **Document Intelligence** | PDF text extraction (PyMuPDF), structured section parsing |
| **AI Research Assistant** | RAG-based Q&A with Ollama (llama3.2), citation-backed answers, persistent conversation history |
| **Semantic Search** | all-MiniLM-L6-v2 embeddings + FAISS vector index + lexical hybrid |
| **Research Analysis** | Publication trends, domain distribution, keyword analytics, methodology analysis (Recharts) |
| **Analytics Filters** | Filter charts by year range, academic source |
| **Research Gap Engine** | Limitation patterns, underrepresented topics, methodology gaps, emerging topics with evidence |
| **Paper Comparison** | Semantic pairwise similarity scoring with evidence excerpts |
| **Collections** | Custom paper collections with CRUD management |
| **Recommendations** | Jaccard similarity + embedding-based paper recommendations |
| **Report Generation** | Export as PDF, DOCX, CSV, JSON, BibTeX |
| **Multi-user Auth** | JWT + Argon2 password hashing, strict data isolation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│   Vite + TypeScript + Tailwind + Recharts + shadcn/ui   │
│   10 pages: Dashboard, Explore, Assistant, Analysis,    │
│   Comparison, Collections, Library, Reports, Recs,      │
│   Settings                                               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST (port 8001)
┌────────────────────────▼────────────────────────────────┐
│                  FastAPI Backend                         │
│   Python 3.12 · SQLAlchemy 2 · Pydantic · Alembic       │
│   JWT Auth · Argon2 · Background tasks                  │
├──────────┬──────────────────────┬───────────────────────┤
│ Academic │   Document           │   AI / ML             │
│ Sources  │   Intelligence       │   Services            │
│ arXiv    │   PyMuPDF extraction │   sentence-transformers│
│ Semantic │   Section parsing    │   all-MiniLM-L6-v2    │
│ Scholar  │   Chunk generation   │   FAISS vector index  │
│ Crossref │   Embedding storage  │   Ollama (llama3.2)   │
│ PubMed   │                      │   LangChain RAG       │
└──────────┴──────────┬───────────┴───────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               PostgreSQL Database                        │
│  users · research_papers · saved_papers                 │
│  uploaded_documents · collections · collection_papers   │
│  ai_conversations · ai_messages · paper_embeddings      │
│  document_chunks · reports · processing logs            │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS · React Router v7 · Recharts · Lucide React

**Backend:** Python 3.12 · FastAPI · SQLAlchemy 2 · Pydantic v2 · Alembic · python-jose · passlib (Argon2)

**Database:** PostgreSQL 16

**AI / ML:** sentence-transformers (all-MiniLM-L6-v2) · FAISS-cpu · Ollama (llama3.2) · LangChain · PyMuPDF · fastembed

**Reports:** ReportLab · python-docx · Pandas

**Testing:** pytest · pytest-cov (58 passing tests)

---

## Model Licenses

| Model | License | Usage |
|---|---|---|
| all-MiniLM-L6-v2 | Apache 2.0 | Sentence embeddings, semantic search |
| llama3.2 (via Ollama) | Meta Llama 3.2 Community License | Local AI inference, RAG |
| fastembed BAAI/bge-small | MIT | Alternative embedding model |

> ⚠️ Academic API services (arXiv, Semantic Scholar, Crossref, PubMed) are currently free but their terms may change. Always respect their rate limits and terms of service.

---

## Prerequisites

- Windows 10/11 (x64)
- Python 3.11 or 3.12
- Node.js 20+
- PostgreSQL 15+
- Git
- Ollama (optional but recommended)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/affective-research-intelligence-system.git
cd affective-research-intelligence-system
```

### 2. Database setup

```sql
-- In psql or pgAdmin:
CREATE DATABASE aris;
```

### 3. Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your values:

```powershell
copy .env.example .env
```

Edit `.env`:

```env
APP_ENV=development
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/aris
JWT_SECRET=your-secret-key-at-least-32-characters
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

Start the backend:

```powershell
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Tables are created automatically on first startup.

### 4. Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### 5. Ollama setup (optional — enables AI answers)

Download from https://ollama.com and install. Then:

```bash
ollama pull llama3.2
ollama serve
```

The AI assistant will show "Ollama connected" when available. Without Ollama, rule-based extraction is used as fallback.

---

## Running Tests

```powershell
cd backend
.venv\Scripts\python -m pytest tests/ -v
```

**58 tests pass** covering authentication, academic search, document intelligence, AI/RAG pipeline, collections, conversations, analytics filters, and export formats.

---

## API Documentation

Once the backend is running, visit:

- **Swagger UI:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc

### Key Endpoints

| Route | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login → JWT |
| `/api/search` | GET | Multi-source academic search |
| `/api/library` | GET | List saved papers |
| `/api/library/save-paper` | POST | Save paper + queue embedding |
| `/api/analytics` | GET | Charts data with filters |
| `/api/gaps` | GET | Research gap analysis |
| `/api/assistant/chat` | POST | RAG chat with citations |
| `/api/conversations` | GET | List conversation history |
| `/api/collections` | GET/POST | Manage collections |
| `/api/documents/upload` | POST | Upload PDF |
| `/api/recommendations` | GET | Similar paper recommendations |
| `/api/reports/generate` | POST | Generate PDF/DOCX/CSV/JSON/BibTeX |
| `/api/compare` | POST | Semantic paper comparison |

---

## Project Structure

```
ARIS/
├── frontend/
│   └── src/
│       ├── pages/          # 10 page components
│       ├── layouts/        # Sidebar navigation
│       ├── contexts/       # Auth context
│       ├── services/       # API client
│       └── types/          # TypeScript interfaces
├── backend/
│   ├── app/
│   │   ├── api/routes/     # 15 route modules
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── integrations/   # 4 academic API adapters
│   ├── tests/              # 58 pytest tests
│   └── storage/            # uploads, reports (gitignored)
└── docs/
    ├── SRS.md              # Software Requirements Specification
    └── project-status.md   # Development tracker
```

---

## Screenshots

> Register → Login → Dashboard → Search → Save → Analyze → Chat → Report

---

## Known Limitations

- FAISS index is in-memory: rebuilt from DB on each server restart
- Ollama must be running for AI-powered responses; rule-based fallback is available
- PDF extraction depends on PDF quality; scanned PDFs without embedded text will extract minimal content
- Large PDF collections (500+) may require batch processing patience

---

## License

This project is developed as a final-year engineering major project.

Academic API usage is subject to each provider's terms:
- arXiv API: https://arxiv.org/help/api/
- Semantic Scholar API: https://www.semanticscholar.org/product/api
- Crossref API: https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- PubMed E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25500/

---

## Contributing

This repository represents an academic engineering project. Issues and pull requests are welcome for bug fixes and improvements.
