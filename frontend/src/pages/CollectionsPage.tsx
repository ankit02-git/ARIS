import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { FolderOpen, Plus, Trash2, BookOpen, X, Check, Loader2, ChevronRight } from 'lucide-react'

interface Collection {
  id: number
  name: string
  description?: string | null
  paper_count: number
  created_at: string
  updated_at: string
}

interface CollectionDetail extends Collection {
  papers: {
    id: number
    title: string
    authors?: string | null
    source: string
    publication_year?: number | null
    url?: string | null
  }[]
}

interface LibraryPaper {
  id?: number
  title: string
  authors?: string | null
  source: string
  publication_year?: number | null
}

export default function CollectionsPage() {
  const { token } = useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [selected, setSelected] = useState<CollectionDetail | null>(null)
  const [library, setLibrary] = useState<LibraryPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [message, setMessage] = useState('')
  const [showAddPaper, setShowAddPaper] = useState(false)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<Collection[]>('/api/collections', token),
      api.get<LibraryPaper[]>('/api/library', token),
    ]).then(([cols, lib]) => {
      setCollections(cols)
      setLibrary(lib)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const openCollection = async (col: Collection) => {
    if (!token) return
    try {
      const detail = await api.get<CollectionDetail>(`/api/collections/${col.id}`, token)
      setSelected(detail)
    } catch {}
  }

  const handleCreate = async () => {
    if (!newName.trim() || !token) return
    setCreating(true)
    try {
      const col = await api.post<Collection>('/api/collections', { name: newName.trim(), description: newDesc.trim() || null }, token)
      setCollections((prev) => [col, ...prev])
      setNewName('')
      setNewDesc('')
      setShowCreateForm(false)
      toast('Collection created.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Delete this collection? Papers will not be removed from your library.')) return
    try {
      await api.delete<{ message: string }>(`/api/collections/${id}`, token)
      setCollections((prev) => prev.filter((c) => c.id !== id))
      if (selected?.id === id) setSelected(null)
      toast('Collection deleted.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleAddPaper = async (paperId: number) => {
    if (!selected || !token) return
    try {
      await api.post<Collection>(`/api/collections/${selected.id}/papers`, { paper_id: paperId }, token)
      const detail = await api.get<CollectionDetail>(`/api/collections/${selected.id}`, token)
      setSelected(detail)
      setCollections((prev) => prev.map((c) => c.id === detail.id ? { ...c, paper_count: detail.paper_count } : c))
      toast('Paper added to collection.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add paper')
    }
  }

  const handleRemovePaper = async (paperId: number) => {
    if (!selected || !token) return
    try {
      await api.delete<Collection>(`/api/collections/${selected.id}/papers/${paperId}`, token)
      const detail = await api.get<CollectionDetail>(`/api/collections/${selected.id}`, token)
      setSelected(detail)
      setCollections((prev) => prev.map((c) => c.id === detail.id ? { ...c, paper_count: detail.paper_count } : c))
      toast('Paper removed from collection.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove paper')
    }
  }

  const toast = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3500)
  }

  const papersInCollection = new Set(selected?.papers.map((p) => p.id) ?? [])
  const papersNotInCollection = library.filter((p) => p.id && !papersInCollection.has(p.id))

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Organize your research</p>
          <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Collections</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> New collection
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>New collection</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: creating || !newName.trim() ? '#334155' : '#3b82f6',
                  color: '#fff', fontSize: 13, cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {creating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</> : <><Check size={13} /> Create</>}
              </button>
              <button onClick={() => setShowCreateForm(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#1e293b', color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '300px 1fr' : '1fr', gap: 20 }}>
        {/* Collections list */}
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 72, background: '#0b1120', borderRadius: 10, opacity: 0.5 }} />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FolderOpen size={32} color="#334155" style={{ marginBottom: 12 }} />
              <p style={{ color: '#475569', fontSize: 13 }}>No collections yet. Create one to organize your research.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {collections.map((col) => (
                <div
                  key={col.id}
                  onClick={() => openCollection(col)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    background: selected?.id === col.id ? '#1e2d4a' : '#0b1120',
                    border: `1px solid ${selected?.id === col.id ? '#2d4a6a' : '#1e293b'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    background: '#1e293b', borderRadius: 8, width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FolderOpen size={16} color="#64748b" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.name}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                      {col.paper_count} paper{col.paper_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(col.id) }}
                      style={{
                        padding: 6, borderRadius: 6, border: 'none',
                        background: 'transparent', color: '#475569', cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={14} color="#475569" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection detail panel */}
        {selected && (
          <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>{selected.name}</h2>
                {selected.description && (
                  <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{selected.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowAddPaper(!showAddPaper)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 7, border: '1px solid #1e293b',
                    background: 'transparent', color: '#93c5fd', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <Plus size={12} /> Add paper
                </button>
                <button
                  onClick={() => setSelected(null)}
                  style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Add paper dropdown */}
            {showAddPaper && papersNotInCollection.length > 0 && (
              <div style={{ marginBottom: 16, padding: 14, background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
                <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 10px' }}>Choose from your library:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {papersNotInCollection.map((p) => p.id && (
                    <button
                      key={p.id}
                      onClick={() => { handleAddPaper(p.id!); setShowAddPaper(false) }}
                      style={{
                        padding: '8px 10px', borderRadius: 7, border: '1px solid #1e293b',
                        background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                        textAlign: 'left', fontSize: 12, lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: '#e2e8f0' }}>{p.title}</span>
                      <span style={{ color: '#475569', marginLeft: 6 }}>({p.source})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.papers.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <BookOpen size={24} color="#334155" style={{ marginBottom: 8 }} />
                <p style={{ color: '#475569', fontSize: 13 }}>No papers in this collection yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.papers.map((p) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                        <span style={{ color: '#64748b', fontSize: 11 }}>{p.source}</span>
                        {p.publication_year && <span style={{ color: '#475569', fontSize: 11 }}>{p.publication_year}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePaper(p.id)}
                      style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #1e293b',
  background: '#0f172a', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%',
  boxSizing: 'border-box',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: '1px solid #1e293b',
  background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer',
}
