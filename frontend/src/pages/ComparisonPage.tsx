import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper, SemanticComparison } from '../types'
import { GitCompare, ExternalLink, Loader2, XCircle, Info } from 'lucide-react'

export default function ComparisonPage() {
  const { token } = useAuth()
  const [library, setLibrary] = useState<Paper[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<SemanticComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paperMap, setPaperMap] = useState<Record<number, Paper>>({})

  useEffect(() => {
    if (!token) return
    api.get<Paper[]>('/api/library', token)
      .then((papers) => {
        setLibrary(papers)
        const map: Record<number, Paper> = {}
        papers.forEach((p) => { if (p.id) map[p.id] = p })
        setPaperMap(map)
      })
      .catch(() => {})
  }, [token])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id)
      return next
    })
  }

  const handleCompare = async () => {
    if (selected.size < 2) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.post<SemanticComparison>('/api/compare', { paper_ids: Array.from(selected) }, token)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.7) return '#10b981'
    if (score >= 0.4) return '#f59e0b'
    return '#ef4444'
  }

  const scoreLabel = (score: number) => {
    if (score >= 0.7) return 'High similarity'
    if (score >= 0.4) return 'Moderate similarity'
    return 'Low similarity'
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Semantic analysis</p>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Paper Comparison</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          Select 2–4 papers from your library to compare their research focus using semantic similarity.
        </p>
      </div>

      {/* Paper Selection */}
      <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, margin: 0 }}>
            Select papers ({selected.size}/4)
          </h3>
          <button
            onClick={handleCompare}
            disabled={selected.size < 2 || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: selected.size < 2 || loading ? '#334155' : '#3b82f6',
              color: '#fff', fontSize: 13, fontWeight: 500,
              cursor: selected.size < 2 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Comparing…</>
              : <><GitCompare size={14} /> Compare</>
            }
          </button>
        </div>

        {library.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13 }}>
            No saved papers. Save papers in Explore Research to compare them.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {library.map((paper) => {
              if (!paper.id) return null
              const isSelected = selected.has(paper.id)
              const isDisabled = !isSelected && selected.size >= 4
              return (
                <label
                  key={paper.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    borderRadius: 8, cursor: isDisabled ? 'not-allowed' : 'pointer',
                    background: isSelected ? '#1e2d4a' : 'transparent',
                    border: `1px solid ${isSelected ? '#2d4a6a' : '#1e293b'}`,
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => toggle(paper.id!)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                      {paper.title}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      <span style={{ color: '#64748b', fontSize: 11 }}>{paper.source}</span>
                      {paper.publication_year && (
                        <span style={{ color: '#475569', fontSize: 11 }}>{paper.publication_year}</span>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
          borderRadius: 8, background: '#2a0d0d', border: '1px solid #451a03',
          color: '#fca5a5', fontSize: 13, marginBottom: 20,
        }}>
          <XCircle size={14} /> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Method note */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
            borderRadius: 8, background: '#0f2a1a', border: '1px solid #064e3b',
            color: '#6ee7b7', fontSize: 12, marginBottom: 20,
          }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Method:</strong> {result.method} — {result.note}</span>
          </div>

          {/* Selected paper scores */}
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Paper Relevance Scores
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
            {result.papers.map((ps) => {
              const paper = paperMap[ps.paper_id]
              const pct = Math.round(ps.similarity * 100)
              return (
                <div key={ps.paper_id} style={{
                  background: '#0b1120', border: '1px solid #1e293b', borderRadius: 10, padding: 16,
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, marginBottom: 10, lineHeight: 1.4 }}>
                    {paper?.title || `Paper #${ps.paper_id}`}
                  </div>
                  {/* Progress bar */}
                  <div style={{ background: '#1e293b', borderRadius: 4, height: 6, marginBottom: 8 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 4,
                      background: scoreColor(ps.similarity),
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: scoreColor(ps.similarity) }}>{scoreLabel(ps.similarity)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(ps.similarity) }}>{pct}%</span>
                  </div>
                  {paper?.url && (
                    <a href={paper.url} target="_blank" rel="noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      color: '#64748b', fontSize: 11, marginTop: 8, textDecoration: 'none',
                    }}>
                      <ExternalLink size={10} /> View paper
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pairwise comparison table */}
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Pairwise Comparison
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.pairwise.map((pair, i) => {
              const leftPaper = paperMap[pair.left_paper_id]
              const rightPaper = paperMap[pair.right_paper_id]
              const pct = Math.round(pair.score * 100)
              return (
                <div key={i} style={{
                  background: '#0b1120', border: '1px solid #1e293b', borderRadius: 10, padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, fontSize: 13, color: '#94a3b8', textAlign: 'right', lineHeight: 1.4 }}>
                      {leftPaper?.title || `Paper #${pair.left_paper_id}`}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(pair.score) }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>similarity</div>
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
                      {rightPaper?.title || `Paper #${pair.right_paper_id}`}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background: '#1e293b', borderRadius: 4, height: 5, marginBottom: 12 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 4,
                      background: scoreColor(pair.score),
                    }} />
                  </div>

                  {/* Evidence excerpts */}
                  {(pair.left_evidence || pair.right_evidence) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {pair.left_evidence && (
                        <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
                          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>Left paper excerpt</div>
                          <p style={{ color: '#94a3b8', fontSize: 11, margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{pair.left_evidence}"
                          </p>
                        </div>
                      )}
                      {pair.right_evidence && (
                        <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
                          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>Right paper excerpt</div>
                          <p style={{ color: '#94a3b8', fontSize: 11, margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{pair.right_evidence}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
