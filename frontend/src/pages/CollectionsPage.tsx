import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { CollectionAnalysis } from '../types'
import { FolderOpen, Plus, Trash2, BookOpen, X, Check, Loader2, ChevronRight, BarChart2 } from 'lucide-react'

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

type DetailTab = 'papers' | 'analysis'

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
  const [detailTab, setDetailTab] = useState<DetailTab>('papers')
  const [analysis, setAnalysis] = useState<CollectionAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

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
      setDetailTab('papers')
      setAnalysis(null)
    } catch {}
  }

  const loadAnalysis = async () => {
    if (!selected || !token) return
    setAnalysisLoading(true)
    try {
      const data = await api.get<CollectionAnalysis>(`/api/collections/${selected.id}/analyze`, token)
      setAnalysis(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const handleTabSwitch = (tab: DetailTab) => {
    setDetailTab(tab)
    if (tab === 'analysis' && !analysis) {
      loadAnalysis()
    }
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
      setAnalysis(null) // invalidate cached analysis
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
      setAnalysis(null)
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
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Organize your research</p>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: 0 }}>Collections</h1>
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>New collection</h3>
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
                  background: creating || !newName.trim() ? 'var(--border)' : '#3b82f6',
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
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '300px 1fr' : '1fr', gap: 20 }}>
        {/* Collections list */}
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 72, background: 'var(--surface)', borderRadius: 10, opacity: 0.5 }} />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FolderOpen size={32} color="var(--border)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No collections yet. Create one to organize your research.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {collections.map((col) => (
                <div
                  key={col.id}
                  onClick={() => openCollection(col)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    background: selected?.id === col.id ? 'var(--surface-active)' : 'var(--surface)',
                    border: `1px solid ${selected?.id === col.id ? '#2d4a6a' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    background: 'var(--border)', borderRadius: 8, width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FolderOpen size={16} color="var(--text-muted)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                      {col.paper_count} paper{col.paper_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(col.id) }}
                      style={{
                        padding: 6, borderRadius: 6, border: 'none',
                        background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection detail panel */}
        {selected && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            {/* Detail header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>{selected.name}</h2>
                {selected.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{selected.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowAddPaper(!showAddPaper)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'transparent', color: '#93c5fd', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <Plus size={12} /> Add paper
                </button>
                <button
                  onClick={() => setSelected(null)}
                  style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              {(['papers', 'analysis'] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabSwitch(tab)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: detailTab === tab ? 'var(--border)' : 'transparent',
                    color: detailTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: detailTab === tab ? 500 : 400,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {tab === 'papers' ? <><BookOpen size={13} /> Papers ({selected.paper_count})</> : <><BarChart2 size={13} /> Analysis</>}
                </button>
              ))}
            </div>

            {/* Add paper panel */}
            {showAddPaper && papersNotInCollection.length > 0 && (
              <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 10px' }}>Choose from your library:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {papersNotInCollection.map((p) => p.id && (
                    <button
                      key={p.id}
                      onClick={() => { handleAddPaper(p.id!); setShowAddPaper(false) }}
                      style={{
                        padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                        textAlign: 'left', fontSize: 12, lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{p.title}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({p.source})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Papers tab */}
            {detailTab === 'papers' && (
              selected.papers.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center' }}>
                  <BookOpen size={24} color="var(--border)" style={{ marginBottom: 8 }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No papers in this collection yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.papers.map((p) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.source}</span>
                          {p.publication_year && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.publication_year}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePaper(p.id)}
                        style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Analysis tab */}
            {detailTab === 'analysis' && (
              <div>
                {analysisLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Loader2 size={24} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>Analyzing collection…</p>
                  </div>
                ) : !analysis ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Analysis not loaded.</p>
                    <button
                      onClick={loadAnalysis}
                      style={{
                        marginTop: 12, padding: '8px 16px', borderRadius: 7,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Run analysis
                    </button>
                  </div>
                ) : (
                  <AnalysisPanel analysis={analysis} onRefresh={() => { setAnalysis(null); loadAnalysis() }} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AnalysisPanel({ analysis, onRefresh }: { analysis: CollectionAnalysis; onRefresh: () => void }) {
  const maxKw = analysis.top_keywords[0]?.count || 1
  const maxDom = analysis.domain_distribution[0]?.count || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
      </div>

      {/* Keywords */}
      {analysis.top_keywords.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: 0 }}>Top Keywords</h3>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{analysis.top_keywords.length} terms</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.top_keywords.slice(0, 12).map((kw) => (
              <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</span>
                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(kw.count / maxKw) * 100}%`, background: '#3b82f6', height: '100%', borderRadius: 3 }} />
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 24, textAlign: 'right', flexShrink: 0 }}>{kw.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domain distribution */}
      {analysis.domain_distribution.length > 0 && (
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Research Domains</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.domain_distribution.map((d) => (
              <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 160, flexShrink: 0 }}>{d.domain}</span>
                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(d.count / maxDom) * 100}%`, background: '#8b5cf6', height: '100%', borderRadius: 3 }} />
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 24, textAlign: 'right', flexShrink: 0 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publications by year */}
      {analysis.publications_by_year.length > 0 && (
        <div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Publications by Year</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {analysis.publications_by_year.map((y) => {
              const maxY = Math.max(...analysis.publications_by_year.map((x) => x.count))
              return (
                <div key={y.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div style={{
                    width: '100%', maxWidth: 32,
                    height: `${Math.max(4, (y.count / maxY) * 60)}px`,
                    background: '#3b82f6', borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{y.year}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={onRefresh}
        style={{
          alignSelf: 'flex-start', padding: '7px 14px', borderRadius: 7,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
        }}
      >
        Refresh analysis
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%',
  boxSizing: 'border-box',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
}
