import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { Paper, SearchResponse } from '../types'
import { Search, Filter, Bookmark, BookmarkCheck, ExternalLink, Loader2 } from 'lucide-react'

const SOURCES = ['All', 'arXiv', 'Semantic Scholar', 'Crossref', 'PubMed']
const YEARS = ['All years', '2024', '2023', '2022', '2021', '2020', '2019', '2018', 'Before 2018']

const TOPIC_SUGGESTIONS = [
  'Emotion recognition using deep learning',
  'Facial expression recognition',
  'Speech emotion recognition transformer',
  'Multimodal emotion recognition',
  'Sentiment analysis BERT',
  'Stress detection physiological',
  'Affective computing healthcare',
  'Human-computer interaction emotion',
]

export default function ExplorePage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState('All')
  const [yearFilter, setYearFilter] = useState('All years')
  const [limit, setLimit] = useState(20)
  const [showFilters, setShowFilters] = useState(false)

  // Auto-search if q param present
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      runSearch(q)
    }
  }, [])

  // Load saved paper ids for checkmarks
  useEffect(() => {
    if (!token) return
    api.get<Paper[]>('/api/library', token)
      .then((papers) => {
        const ids = new Set(papers.map((p) => paperKey(p)))
        setSavedIds(ids)
      })
      .catch(() => {})
  }, [token])

  const paperKey = (p: Paper) => p.external_id ?? p.doi ?? p.url ?? p.title

  const runSearch = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setMessage('')
    try {
      const data = await api.get<SearchResponse>(
        `/api/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`,
        token,
      )
      setResults(data.results || [])
      if (data.results.length === 0) setMessage('No results found. Try a broader search term.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setSearchParams(query ? { q: query } : {})
    runSearch(query)
  }

  const handleSave = async (paper: Paper) => {
    if (!token) return
    try {
      await api.post('/api/library/save-paper', paper, token)
      setSavedIds((prev) => new Set([...prev, paperKey(paper)]))
      setMessage(`Saved: ${paper.title}`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const filteredResults = results.filter((p) => {
    if (sourceFilter !== 'All' && p.source !== sourceFilter) return false
    if (yearFilter !== 'All years') {
      if (yearFilter === 'Before 2018') {
        if (!p.publication_year || p.publication_year >= 2018) return false
      } else {
        if (String(p.publication_year) !== yearFilter) return false
      }
    }
    return true
  })

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Academic discovery</p>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Explore Research</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
          Search across arXiv, Semantic Scholar, Crossref and PubMed simultaneously.
        </p>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search emotion recognition, sentiment analysis, multimodal fusion..."
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: 10,
                border: '1px solid #1e293b',
                background: '#0b1120',
                color: '#e2e8f0',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #1e293b',
              background: showFilters ? '#1e293b' : '#0b1120',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
            }}
          >
            <Filter size={14} /> Filters
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#334155' : '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Searching...</> : 'Search'}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '16px',
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: 10,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}>
            <div>
              <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Source</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '1px solid',
                      borderColor: sourceFilter === s ? '#3b82f6' : '#1e293b',
                      background: sourceFilter === s ? '#1e3a5f' : 'transparent',
                      color: sourceFilter === s ? '#93c5fd' : '#64748b',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Year</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setYearFilter(y)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '1px solid',
                      borderColor: yearFilter === y ? '#3b82f6' : '#1e293b',
                      background: yearFilter === y ? '#1e3a5f' : 'transparent',
                      color: yearFilter === y ? '#93c5fd' : '#64748b',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Results per search</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #1e293b',
                  background: '#0f172a',
                  color: '#94a3b8',
                  fontSize: 12,
                }}
              >
                {[10, 20, 40].map((n) => (
                  <option key={n} value={n}>{n} results</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Topic chips */}
        {results.length === 0 && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TOPIC_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); runSearch(s) }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '1px solid #1e293b',
                  background: '#0b1120',
                  color: '#64748b',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
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

      {/* Results header */}
      {results.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {filteredResults.length} of {results.length} results
            {sourceFilter !== 'All' || yearFilter !== 'All years' ? ' (filtered)' : ''}
          </span>
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredResults.map((paper) => (
          <PaperCard
            key={paperKey(paper)}
            paper={paper}
            saved={savedIds.has(paperKey(paper))}
            onSave={handleSave}
          />
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 13 }}>Searching across academic sources...</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PaperCard({ paper, saved, onSave }: { paper: Paper; saved: boolean; onSave: (p: Paper) => void }) {
  const truncate = (text: string | null | undefined, max: number) =>
    text && text.length > max ? text.slice(0, max) + '…' : text || ''

  return (
    <div style={{
      background: '#0b1120',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: '20px 24px',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 20,
            background: '#1e293b',
            color: '#3b82f6',
            fontSize: 11,
            fontWeight: 500,
          }}>
            {paper.source}
          </span>
          {paper.publication_year && (
            <span style={{ color: '#64748b', fontSize: 12 }}>{paper.publication_year}</span>
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
                background: 'transparent',
              }}
            >
              <ExternalLink size={12} /> View
            </a>
          )}
          <button
            onClick={() => !saved && onSave(paper)}
            disabled={saved}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: saved ? '#10b981' : '#1e293b',
              background: saved ? '#0d2a20' : 'transparent',
              color: saved ? '#34d399' : '#94a3b8',
              fontSize: 12,
              cursor: saved ? 'default' : 'pointer',
              fontWeight: saved ? 500 : 400,
            }}
          >
            {saved ? <><BookmarkCheck size={12} /> Saved</> : <><Bookmark size={12} /> Save</>}
          </button>
        </div>
      </div>
      <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginBottom: 6, margin: '0 0 6px' }}>
        {paper.title}
      </h3>
      {paper.authors && (
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, margin: '0 0 8px' }}>
          {paper.authors}
        </p>
      )}
      {paper.abstract && (
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {truncate(paper.abstract, 300)}
        </p>
      )}
      {!paper.abstract && (
        <p style={{ color: '#334155', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Abstract not available for this record.
        </p>
      )}
    </div>
  )
}
