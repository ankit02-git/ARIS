import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper } from '../types'
import { useNavigate } from 'react-router-dom'
import { Bookmark, ExternalLink, Sparkles } from 'lucide-react'

interface Recommendation {
  paper: Paper
  reason: string
  score: number
}

export default function RecommendationsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<Recommendation[]>('/api/recommendations', token),
      api.get<Paper[]>('/api/library', token),
    ])
      .then(([recommendations, library]) => {
        setRecs(recommendations)
        setSavedIds(new Set(library.map((p) => p.external_id ?? p.doi ?? p.url ?? p.title)))
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSave = async (paper: Paper) => {
    if (!token) return
    try {
      await api.post('/api/library/save-paper', paper, token)
      const key = paper.external_id ?? paper.doi ?? paper.url ?? paper.title
      setSavedIds((prev) => new Set([...prev, key]))
      setMessage(`Saved: ${paper.title}`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Based on your research library</p>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Recommendations</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
          Papers similar to what you have saved, ranked by relevance.
        </p>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#1e293b', color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : recs.length === 0 ? (
        <EmptyState navigate={navigate} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {recs.map((rec, i) => {
            const key = rec.paper.external_id ?? rec.paper.doi ?? rec.paper.url ?? rec.paper.title
            const saved = savedIds.has(key)
            return (
              <div key={i} style={{
                background: '#0b1120',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, background: '#1e293b', color: '#3b82f6', fontSize: 11, fontWeight: 500 }}>
                      {rec.paper.source}
                    </span>
                    {rec.paper.publication_year && (
                      <span style={{ color: '#64748b', fontSize: 12 }}>{rec.paper.publication_year}</span>
                    )}
                    <span style={{ padding: '2px 8px', borderRadius: 20, background: '#1e3a2a', color: '#34d399', fontSize: 11 }}>
                      {Math.round(rec.score * 100)}% match
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {rec.paper.url && (
                      <a href={rec.paper.url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid #1e293b', color: '#64748b', fontSize: 12, textDecoration: 'none' }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      onClick={() => !saved && handleSave(rec.paper)}
                      disabled={saved}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 12px', borderRadius: 6, border: '1px solid',
                        borderColor: saved ? '#10b981' : '#1e293b',
                        background: saved ? '#0d2a20' : 'transparent',
                        color: saved ? '#34d399' : '#94a3b8',
                        fontSize: 12, cursor: saved ? 'default' : 'pointer',
                      }}
                    >
                      <Bookmark size={12} /> {saved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
                <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, lineHeight: 1.4, margin: '0 0 6px' }}>
                  {rec.paper.title}
                </h3>
                {rec.paper.authors && <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px' }}>{rec.paper.authors}</p>}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: '8px 12px', background: '#0f172a', borderRadius: 8 }}>
                  <Sparkles size={12} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{rec.reason}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 120, background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>⭐</div>
      <h2 style={{ color: '#64748b', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No recommendations yet</h2>
      <p style={{ color: '#475569', fontSize: 13, maxWidth: 380, margin: '0 auto 20px' }}>
        Save at least a few papers to your library to get personalized recommendations.
      </p>
      <button
        onClick={() => navigate('/explore')}
        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
      >
        Explore research
      </button>
    </div>
  )
}
