# ARIS Manual Test Cases

**Purpose:** Step-by-step manual verification procedures for ARIS QA cycles  
**Last Updated:** 2026-11-02  
**Target Tester:** QA Engineer / Developer  
**Prerequisites:** ARIS running locally (backend port 8001, frontend port 5173)

---

## Setup

1. Start backend: `cd backend && .venv/Scripts/uvicorn app.main:app --port 8001 --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser: `http://localhost:5173`
4. Create test account or use existing

---

## Module 1: Authentication

### TC-AUTH-01: Register
1. Navigate to `/register`
2. Enter name: `Test User`, email: `test@example.com`, password: `Test1234!`
3. Click Register
4. **Expected:** Redirected to dashboard, user name shown in nav

### TC-AUTH-02: Login / Logout
1. Navigate to `/login`
2. Enter valid credentials
3. Click Login
4. **Expected:** Dashboard loads
5. Click profile/logout
6. **Expected:** Redirected to login page, protected routes inaccessible

### TC-AUTH-03: Wrong Password
1. Navigate to `/login`
2. Enter wrong password
3. **Expected:** Error message shown, no redirect

### TC-AUTH-04: Change Password (Settings)
1. Navigate to `/settings`
2. Enter current password and new password (min 8 chars)
3. Click Save
4. **Expected:** Success toast
5. Login with new password to verify

### TC-AUTH-05: JWT Persistence
1. Login, note you are on Dashboard
2. Close and reopen browser tab
3. **Expected:** Still logged in (JWT in localStorage)

---

## Module 2: Document Library

### TC-DOC-01: Upload PDF
1. Navigate to `/library`
2. Click Upload / drag-drop a PDF file (< 50MB)
3. **Expected:** Document appears with status "pending" or "processing"
4. Wait 10–30 seconds (polling every 3s)
5. **Expected:** Status changes to "completed", extracted title populated

### TC-DOC-02: Upload Non-PDF
1. Try to upload a `.docx` or `.txt` file
2. **Expected:** Error message "Only PDF files are supported"

### TC-DOC-03: Search Documents
1. Upload at least one PDF
2. In the search bar, type a keyword present in that document
3. **Expected:** Document appears in filtered list

### TC-DOC-04: Document Analysis
1. Upload and process a PDF (status: completed)
2. Click "Analyse" button
3. **Expected:** Navigated to `/document-analysis/{id}` page
4. **Expected:** Charts displayed: keyword frequency bar, page distribution line, section pie, key sentences list

### TC-DOC-05: View PDF
1. Click the "View" or PDF icon on a completed document
2. **Expected:** PDF opens in browser viewer (served from `/api/documents/{id}/file`)

### TC-DOC-06: Delete Document
1. Click delete on a document
2. **Expected:** Confirmation or immediate removal
3. **Expected:** Document gone from list (file deleted from disk)

---

## Module 3: Search & Explore

### TC-SEARCH-01: Basic Keyword Search
1. Navigate to `/explore`
2. Type "emotion recognition" in search box
3. Press Enter
4. **Expected:** Results list with titles, authors, year, source badges

### TC-SEARCH-02: Search with Filters
1. Search "affective computing"
2. Apply author filter or year filter
3. **Expected:** Results filtered accordingly

### TC-SEARCH-03: Save to Library
1. Perform a search
2. Click "Save" on a result
3. Navigate to `/library` → Library tab
4. **Expected:** Paper appears in saved papers list

### TC-SEARCH-04: Save Search Query
1. Perform a search
2. Click "Save Search"
3. Navigate to Saved Searches section
4. **Expected:** Saved search appears with the query string

### TC-SEARCH-05: Empty Query
1. Submit empty search
2. **Expected:** Validation message or no results (not crash)

---

## Module 4: AI Research Assistant

### TC-AI-01: Basic Chat
1. Navigate to `/assistant`
2. Type "What is sentiment analysis?"
3. Press Enter or click Send
4. **Expected:** Thinking/loading indicator, then AI response with content

### TC-AI-02: Citation in Response
1. Upload a PDF and save it to library
2. Chat: "Summarize the uploaded paper"
3. **Expected:** Response references the paper, citations panel shows source

### TC-AI-03: Conversation Continuity
1. Send a message, wait for response
2. Send follow-up: "Can you explain more?"
3. **Expected:** Context maintained, response is relevant

### TC-AI-04: New Chat
1. In assistant page, click "New Chat"
2. **Expected:** Messages cleared, new conversation starts

### TC-AI-05: Conversation History
1. After chats, navigate to conversations list
2. **Expected:** Previous conversations listed with timestamps

### TC-AI-06: Ollama Offline Behavior
1. Stop Ollama service
2. Send a chat message
3. **Expected:** Graceful error message, not blank response or crash

---

## Module 5: Collections

### TC-COL-01: Create Collection
1. Navigate to `/collections`
2. Click "New Collection"
3. Enter name, description, select color
4. **Expected:** Collection created, appears in list

### TC-COL-02: Add Paper to Collection
1. Open a collection
2. Search for papers and add
3. **Expected:** Paper appears in collection paper list

### TC-COL-03: Remove Paper from Collection
1. Open a collection with papers
2. Remove a paper
3. **Expected:** Paper removed, collection count updated

### TC-COL-04: Delete Collection
1. Click delete on a collection
2. **Expected:** Collection removed from list

### TC-COL-05: Collection Analysis
1. Create collection with 2+ papers
2. Click "Analyze"
3. **Expected:** Analysis summary displayed

---

## Module 6: Analytics

### TC-ANA-01: Overview Charts
1. Navigate to `/analysis`
2. **Expected:** Charts populated: papers by year, domain distribution, top keywords, source distribution

### TC-ANA-02: Empty State
1. With no library papers, open analytics
2. **Expected:** Graceful empty state message, not crash

---

## Module 7: Gap Analysis

### TC-GAP-01: Gap Detection
1. Save 3+ papers to library
2. Navigate to gap analysis section
3. **Expected:** List of identified research gaps

### TC-GAP-02: Empty Library
1. With no saved papers
2. Open gap analysis
3. **Expected:** "Insufficient data" message, not crash

---

## Module 8: Recommendations

### TC-REC-01: Paper Recommendations
1. Save 2+ papers to library
2. Navigate to `/recommendations`
3. **Expected:** Recommended papers with similarity scores

### TC-REC-02: Empty Library
1. No saved papers
2. Open recommendations
3. **Expected:** "No recommendations yet" or empty list, not crash

---

## Module 9: Reports

### TC-REP-01: Generate Report
1. Navigate to `/reports`
2. Click "Generate Report"
3. Select a topic or papers
4. **Expected:** Report generated, appears in list

### TC-REP-02: Download Report
1. Open a generated report
2. Click Download
3. **Expected:** File downloaded (PDF or MD)

### TC-REP-03: Delete Report
1. Click delete on a report
2. **Expected:** Report removed from list

---

## Module 10: Settings

### TC-SET-01: Profile Update
1. Navigate to `/settings`
2. Change display name
3. **Expected:** Name updated in nav/header

### TC-SET-02: Change Password
1. Change password (see TC-AUTH-04)
2. **Expected:** Success; old password no longer works

---

## Security Test Cases

### TC-SEC-01: Direct URL Access
1. Copy a URL with another user's resource ID (e.g., `/collections/99`)
2. **Expected:** 404 or Access Denied

### TC-SEC-02: JWT Tampering
1. Modify localStorage token value
2. Reload page
3. **Expected:** Logged out or authentication error

### TC-SEC-03: XSS in Search
1. Search for `<script>alert('xss')</script>`
2. **Expected:** Displayed as text, no alert popup

### TC-SEC-04: File Upload Validation
1. Rename a `.exe` to `.pdf`, try to upload
2. **Expected:** Rejected (magic byte check: `%PDF`)

---

## Regression Tests (Post Bug Fixes)

### TC-REG-01: DELETE returns no crash (BUG-001 fix)
1. Create then delete a saved search or collection
2. **Expected:** No "Unexpected end of JSON" error in console

### TC-REG-02: Search parallel providers (BUG-003 fix)
1. Perform search, observe response time
2. **Expected:** < 5 seconds

### TC-REG-03: Title extraction (BUG-002 fix)
1. Upload a research PDF
2. Check `extracted_title` in document list
3. **Expected:** Actual paper title, not a metadata line like "Received 5 June 2024..."

---

*Manual test cases version 1.0 — 2026-11-02*
