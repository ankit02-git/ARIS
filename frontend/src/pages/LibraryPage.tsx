import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper, UploadedDocument } from '../types'
import { Bookmark, Trash2, Upload, FileText, ExternalLink, Loader2, CheckCircle, XCircle, Clock, Tag, Eye, EyeOff, Search } from 'lucide-react'
import React from 'react'

type Tab = 'saved' | 'uploads' | 'search-docs'

export default function LibraryPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('saved')
  const [savedPapers, setSavedPapers] = useState<Paper[]>([])
  const [uploads, setUploads] = useState<UploadedDocument[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [loadingUploads, setLoadingUploads] = useState(false)
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Tags
  const [paperTags, setPaperTags] = useState<Record<number, string[]>>({})
  const [newTagInput, setNewTagInput] = useState<Record<number, string>>({})
  // PDF preview
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null)
  // Doc search
  const [docSearchQ, setDocSearchQ] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<any[]>([])
  const [docSearchLoading, setDocSearchLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoadingSaved(true)
    api.get<Paper[]>('/api/library', token)
      .then((papers) => {
        setSavedPapers(papers)
        // Load tags for each paper
        papers.forEach((p) => {
          if (p.id) {
            api.get<string[]>(`/api/tags/paper/${p.id}`, token)
              .then((tags) => setPaperTags((prev) => ({ ...prev, [p.id!]: tags })))
              .catch(() => {})
          }
        })
      })
      .catch(() => {})
      .finally(() => setLoadingSaved(false))
  }, [token])

  useEffect(() => {
    if (tab !== 'uploads' || !token) return
    setLoadingUploads(true)
    api.get<UploadedDocument[]>('/api/documents', token)
      .then(setUploads)
      .catch(() => {})
      .finally(() => setLoadingUploads(false))
  }, [tab, token])

  const handleRemoveSaved = async (paperId: number | undefined) => {
    if (!paperId || !token) return
    try {
      await api.delete(`/api/library/remove/${paperId}`, token)
      setSavedPapers((prev) => prev.filter((p) => p.id !== paperId))
      toast('Paper removed from library.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || !token) return
    setUploading(true)
    setMessage('')
    let successCount = 0
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const doc = await api.upload<UploadedDocument>('/api/documents/upload', formData, token)
        setUploads((prev) => [doc, ...prev])
        successCount++
      } catch (err) {
        toast(err instanceof Error ? err.message : `Upload failed for ${file.name}`)
      }
    }
    if (successCount > 0) {
      toast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded. Processing in background.`)
    }
    setUploading(false)
  }

  const handleDeleteUpload = async (docId: number) => {
    if (!token) return
    try {
      await api.delete(`/api/documents/${docId}`, token)
      setUploads((prev) => prev.filter((d) => d.id !== docId))
      if (previewDoc?.id === docId) setPreviewDoc(null)
      toast('Document deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleAddTag = async (paperId: number) => {
    const tag = (newTagInput[paperId] || '').trim()
    if (!tag || !token) return
    try {
      await api.post('/api/tags', { paper_id: paperId, tag }, token)
      setPaperTags((prev) => ({ ...prev, [paperId]: [...(prev[paperId] || []), tag] }))
      setNewTagInput((prev) => ({ ...prev, [paperId]: '' }))
    } catch {}
  }

  const handleRemoveTag = async (paperId: number, tag: string) => {
    if (!token) return
    try {
      await api.delete(`/api/tags?paper_id=${paperId}&tag=${encodeURIComponent(tag)}`, token)
      setPaperTags((prev) => ({ ...prev, [paperId]: (prev[paperId] || []).filter((t) => t !== tag) }))
    } catch {}
  }

  const handleDocSearch = async () => {
    if (!docSearchQ.trim() || !token) return
    setDocSearchLoading(true)
    try {
      const results = await api.get<any[]>(`/api/documents/search?q=${encodeURIComponent(docSearchQ)}`, token)
      setDocSearchResults(results)
    } catch {
      setDocSearchResults([])
    } finally {
      setDocSearchLoading(false)
    }
  }

  const toast = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 4 }}>Personal workspace</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: 0 }}>My Library</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {([
          { key: 'saved' as Tab, label: `Saved papers (${savedPapers.length})`, icon: Bookmark },
          { key: 'uploads' as Tab, label: 'Uploaded PDFs', icon: FileText },
          { key: 'search-docs' as Tab, label: 'Search documents', icon: Search },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
              color: tab === key ? 'var(--accent)' : 'var(--text-faint)',
              cursor: 'pointer', fontSize: 14, fontWeight: tab === key ? 500 : 400,
              transition: 'all 0.15s', marginBottom: -1,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* Saved papers */}
      {tab === 'saved' && (
        <>
          {loadingSaved ? <LoadingState /> : savedPapers.length === 0 ? (
            <EmptyState icon={<Bookmark size={32} />} title="No saved papers" desc="Search for papers in Explore Research and save them to your library." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {savedPapers.map((paper) => (
                <SavedPaperRow
                  key={paper.id}
                  paper={paper}
                  tags={paper.id ? (paperTags[paper.id] || []) : []}
                  tagInput={paper.id ? (newTagInput[paper.id] || '') : ''}
                  onRemove={handleRemoveSaved}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onTagInputChange={(id, val) => setNewTagInput((prev) => ({ ...prev, [id]: val }))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Uploads */}
      {tab === 'uploads' && (
        <div style={{ display: 'grid', gridTemplateColumns: previewDoc ? '1fr 400px' : '1fr', gap: 20 }}>
          <div>
            {/* Upload area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 12, padding: '32px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 20,
                background: 'var(--bg-surface)',
              }}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
              <Upload size={28} color="var(--text-dim)" style={{ marginBottom: 10 }} />
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...
                </div>
              ) : (
                <>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 4px' }}>Drop PDF files here or click to upload</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0 }}>Supports multiple PDFs · Max 50 MB each</p>
                </>
              )}
            </div>

            {loadingUploads ? <LoadingState /> : uploads.length === 0 ? (
              <EmptyState icon={<FileText size={32} />} title="No uploaded documents" desc="Upload research PDFs for full-text extraction and AI analysis." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploads.map((doc) => (
                  <UploadRow key={doc.id} doc={doc} isPreview={previewDoc?.id === doc.id} onDelete={handleDeleteUpload} onPreview={setPreviewDoc} />
                ))}
              </div>
            )}
          </div>

          {/* PDF Preview Panel */}
          {previewDoc && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 20, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                  {previewDoc.extracted_title || previewDoc.original_filename}
                </div>
                <button onClick={() => setPreviewDoc(null)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {previewDoc.status === 'completed' ? (
                  <object
                    data={`${api.base}/api/documents/${previewDoc.id}/file`}
                    type="application/pdf"
                    style={{ width: '100%', height: '100%', minHeight: 500 }}
                  >
                    <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                      PDF preview not supported in your browser.
                      <a href={`${api.base}/api/documents/${previewDoc.id}/file`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', marginLeft: 6 }}>
                        Open in new tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    Document is {previewDoc.status}. Preview available after extraction completes.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search within documents */}
      {tab === 'search-docs' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              value={docSearchQ}
              onChange={(e) => setDocSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDocSearch()}
              placeholder="Search within your uploaded documents..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={handleDocSearch}
              disabled={docSearchLoading || !docSearchQ.trim()}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: !docSearchQ.trim() ? 'var(--bg-elevated)' : 'var(--accent)', color: !docSearchQ.trim() ? 'var(--text-faint)' : '#fff', cursor: !docSearchQ.trim() ? 'not-allowed' : 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {docSearchLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
              Search
            </button>
          </div>
          {docSearchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {docSearchResults.map((result, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {result.document?.extracted_title || result.document?.original_filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
                    {result.match_count} matching excerpt{result.match_count !== 1 ? 's' : ''}
                  </div>
                  {result.excerpts?.map((ex: any, j: number) => (
                    <div key={j} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 6, borderLeft: '2px solid var(--accent)' }}>
                      {ex.section && <div style={{ fontSize: 10, color: 'var(--accent-text)', marginBottom: 3 }}>§ {ex.section}</div>}
                      {ex.page && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>Page {ex.page}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>…{ex.excerpt}…</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {!docSearchLoading && docSearchQ && docSearchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: 13 }}>
              No results found in your documents for "{docSearchQ}".
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function SavedPaperRow({
  paper, tags, tagInput, onRemove, onAddTag, onRemoveTag, onTagInputChange,
}: {
  paper: Paper
  tags: string[]
  tagInput: string
  onRemove: (id?: number) => void
  onAddTag: (id: number) => void
  onRemoveTag: (id: number, tag: string) => void
  onTagInputChange: (id: number, val: string) => void
}) {
  const [showTagInput, setShowTagInput] = useState(false)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--accent)', fontSize: 11, fontWeight: 500 }}>
              {paper.source}
            </span>
            {paper.publication_year && (
              <span style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: '20px' }}>{paper.publication_year}</span>
            )}
            {tags.map((tag) => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: '#1e1a3a', color: 'var(--purple)', fontSize: 11, cursor: 'pointer' }}
                onClick={() => paper.id && onRemoveTag(paper.id, tag)}
                title="Click to remove tag"
              >
                #{tag} ×
              </span>
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{paper.title}</div>
          {paper.authors && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{paper.authors}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            title="Add tag"
            style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer' }}
          >
            <Tag size={12} />
          </button>
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: 12, textDecoration: 'none' }}
            >
              <ExternalLink size={12} />
            </a>
          )}
          <button
            onClick={() => onRemove(paper.id)}
            style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6, border: '1px solid #2d1a1a', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showTagInput && paper.id && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            value={tagInput}
            onChange={(e) => onTagInputChange(paper.id!, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTag(paper.id!)}
            placeholder="Add tag (e.g. cnn, fer, review)"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12, outline: 'none' }}
          />
          <button
            onClick={() => { onAddTag(paper.id!); setShowTagInput(false) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

function UploadRow({ doc, isPreview, onDelete, onPreview }: {
  doc: UploadedDocument
  isPreview: boolean
  onDelete: (id: number) => void
  onPreview: (doc: UploadedDocument | null) => void
}) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'var(--amber)', icon: <Clock size={14} />, label: 'Pending' },
    processing: { color: 'var(--accent)', icon: <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Processing' },
    completed: { color: 'var(--green)', icon: <CheckCircle size={14} />, label: 'Completed' },
    failed: { color: 'var(--red)', icon: <XCircle size={14} />, label: 'Failed' },
  }
  const status = statusConfig[doc.status] || statusConfig.pending
  const sizeKb = (doc.file_size / 1024).toFixed(0)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 18px', background: isPreview ? 'var(--bg-hover)' : 'var(--bg-surface)', border: `1px solid ${isPreview ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10 }}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileText size={18} color="var(--text-faint)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.extracted_title || doc.original_filename}
        </div>
        {doc.extracted_title && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{doc.original_filename}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: status.color, fontSize: 12 }}>{status.icon} {status.label}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{sizeKb} KB</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{new Date(doc.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onPreview(isPreview ? null : doc)}
          title={isPreview ? 'Close preview' : 'Preview PDF'}
          style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: isPreview ? 'var(--accent-muted)' : 'transparent', color: isPreview ? 'var(--accent-text)' : 'var(--text-faint)', cursor: 'pointer' }}
        >
          {isPreview ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          onClick={() => onDelete(doc.id)}
          style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6, border: '1px solid #2d1a1a', background: 'transparent', color: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map((i) => <div key={i} style={{ height: 70, background: 'var(--bg-elevated)', borderRadius: 10, opacity: 0.4 }} />)}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ marginBottom: 16, opacity: 0.4, color: 'var(--text-dim)' }}>{icon}</div>
      <div style={{ color: 'var(--text-faint)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{desc}</div>
    </div>
  )
}
