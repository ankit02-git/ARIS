import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper, UploadedDocument } from '../types'
import { Bookmark, Trash2, Upload, FileText, ExternalLink, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'

type Tab = 'saved' | 'uploads'

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

  useEffect(() => {
    if (!token) return
    setLoadingSaved(true)
    api.get<Paper[]>('/api/library', token)
      .then(setSavedPapers)
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
      setMessage('Paper removed from library.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Remove failed')
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
        setMessage(err instanceof Error ? err.message : `Upload failed for ${file.name}`)
      }
    }
    if (successCount > 0) {
      setMessage(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully. Processing in background.`)
      setTimeout(() => setMessage(''), 5000)
    }
    setUploading(false)
  }

  const handleDeleteUpload = async (docId: number) => {
    if (!token) return
    try {
      await api.delete(`/api/documents/${docId}`, token)
      setUploads((prev) => prev.filter((d) => d.id !== docId))
      setMessage('Document deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Personal workspace</p>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>My Library</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
        {([
          { key: 'saved' as Tab, label: `Saved papers (${savedPapers.length})`, icon: Bookmark },
          { key: 'uploads' as Tab, label: 'Uploaded PDFs', icon: FileText },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#3b82f6' : 'transparent'}`,
              color: tab === key ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === key ? 500 : 400,
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: '#1e293b',
          color: '#94a3b8',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {message}
        </div>
      )}

      {/* Saved papers */}
      {tab === 'saved' && (
        <>
          {loadingSaved ? (
            <LoadingState />
          ) : savedPapers.length === 0 ? (
            <EmptyState
              icon={<Bookmark size={32} color="#334155" />}
              title="No saved papers"
              desc="Search for papers in Explore Research and save them to your library."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {savedPapers.map((paper) => (
                <SavedPaperRow key={paper.id} paper={paper} onRemove={handleRemoveSaved} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Uploads */}
      {tab === 'uploads' && (
        <>
          {/* Upload area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #1e293b',
              borderRadius: 12,
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 20,
              background: '#0b1120',
              transition: 'border-color 0.15s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Upload size={28} color="#334155" style={{ marginBottom: 10 }} />
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#3b82f6' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading...
              </div>
            ) : (
              <>
                <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 4px' }}>Drop PDF files here or click to upload</p>
                <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>Supports multiple PDF files · Max 50 MB each</p>
              </>
            )}
          </div>

          {/* Upload list */}
          {loadingUploads ? (
            <LoadingState />
          ) : uploads.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} color="#334155" />}
              title="No uploaded documents"
              desc="Upload research PDFs for full-text extraction and analysis."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {uploads.map((doc) => (
                <UploadRow key={doc.id} doc={doc} onDelete={handleDeleteUpload} />
              ))}
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function SavedPaperRow({ paper, onRemove }: { paper: Paper; onRemove: (id?: number) => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      padding: '16px 20px',
      background: '#0b1120',
      border: '1px solid #1e293b',
      borderRadius: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: '#1e293b', color: '#3b82f6', fontSize: 11, fontWeight: 500 }}>
            {paper.source}
          </span>
          {paper.publication_year && (
            <span style={{ color: '#64748b', fontSize: 12, lineHeight: '20px' }}>{paper.publication_year}</span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>
          {paper.title}
        </div>
        {paper.authors && (
          <div style={{ fontSize: 12, color: '#64748b' }}>{paper.authors}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid #1e293b',
              color: '#64748b',
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
          </a>
        )}
        <button
          onClick={() => onRemove(paper.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid #2d1a1a',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function UploadRow({ doc, onDelete }: { doc: UploadedDocument; onDelete: (id: number) => void }) {
  const statusConfig = {
    pending: { color: '#f59e0b', icon: <Clock size={14} />, label: 'Pending' },
    processing: { color: '#3b82f6', icon: <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Processing' },
    completed: { color: '#10b981', icon: <CheckCircle size={14} />, label: 'Completed' },
    failed: { color: '#ef4444', icon: <XCircle size={14} />, label: 'Failed' },
  }
  const status = statusConfig[doc.status as keyof typeof statusConfig] || statusConfig.pending
  const sizeKb = (doc.file_size / 1024).toFixed(0)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      padding: '14px 18px',
      background: '#0b1120',
      border: '1px solid #1e293b',
      borderRadius: 10,
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: 8,
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <FileText size={18} color="#64748b" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.extracted_title || doc.original_filename}
        </div>
        {doc.extracted_title && (
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{doc.original_filename}</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: status.color, fontSize: 12 }}>
            {status.icon} {status.label}
          </span>
          <span style={{ color: '#334155', fontSize: 11 }}>{sizeKb} KB</span>
          <span style={{ color: '#334155', fontSize: 11 }}>{new Date(doc.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 10px',
          borderRadius: 6,
          border: '1px solid #2d1a1a',
          background: 'transparent',
          color: '#ef4444',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 70, background: '#1e293b', borderRadius: 10, opacity: 0.4 }} />
      ))}
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <div style={{ color: '#64748b', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#475569', fontSize: 13 }}>{desc}</div>
    </div>
  )
}
