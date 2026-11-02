import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { AnalyticsData } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { AlertTriangle, TrendingDown, Lightbulb, BarChart2, RefreshCw, Loader2 } from 'lucide-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']

type Tab = 'charts' | 'gaps'

interface GapFinding {
  gap_type: string
  title: string
  description: string
  evidence_strength: string
  supporting_paper_count: number
  supporting_papers: { id: number; title: string; source: string; year?: number | null; url?: string | null }[]
  excerpts: string[]
  research_suggestion: string
}

interface GapReport {
  total_papers: number
  sufficient_data: boolean
  message: string
  gaps: GapFinding[]
  disclaimer?: string
}

export default function AnalysisPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('charts')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [gaps, setGaps] = useState<GapReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [gapLoading, setGapLoading] = useState(false)
  const [error, setError] = useState('')
  const [rebuildMsg, setRebuildMsg] = useState('')
  // Filter state
  const [filterYearFrom, setFilterYearFrom] = useState('')
  const [filterYearTo, setFilterYearTo] = useState('')
  const [filterSource, setFilterSource] = useState('')

  const loadAnalytics = () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filterYearFrom) params.set('year_from', filterYearFrom)
    if (filterYearTo) params.set('year_to', filterYearTo)
    if (filterSource) params.set('source', filterSource)
    const qs = params.toString() ? `?${params.toString()}` : ''
    api.get<AnalyticsData>(`/api/analytics${qs}`, token)
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAnalytics()
  }, [token])

  const loadGaps = () => {
    if (!token || gapLoading) return
    setGapLoading(true)
    api.get<GapReport>('/api/gaps', token)
      .then(setGaps)
      .catch(() => setGaps({ total_papers: 0, sufficient_data: false, message: 'Gap analysis unavailable.', gaps: [] }))
      .finally(() => setGapLoading(false))
  }

  useEffect(() => {
    if (tab === 'gaps' && !gaps) loadGaps()
  }, [tab])

  const rebuildIndex = async () => {
    if (!token) return
    try {
      await api.post('/api/gaps/rebuild-index', {}, token)
      setRebuildMsg('Embedding index rebuild queued.')
      setTimeout(() => setRebuildMsg(''), 4000)
    } catch (err) {
      setRebuildMsg(err instanceof Error ? err.message : 'Rebuild failed')
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Evidence-based research intelligence</p>
          <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Research Analysis</h1>
        </div>
        <button
          onClick={rebuildIndex}
          title="Rebuild semantic search index"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: '1px solid #1e293b',
            background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Rebuild index
        </button>
      </div>

      {rebuildMsg && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#1e293b', color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>
          {rebuildMsg}
        </div>
      )}

      {/* Analytics filters */}
      {tab === 'charts' && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
          padding: '14px 16px', background: '#0b1120', border: '1px solid #1e293b',
          borderRadius: 10, marginBottom: 20,
        }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Year from</span>
            <input
              type="number"
              placeholder="e.g. 2018"
              value={filterYearFrom}
              onChange={(e) => setFilterYearFrom(e.target.value)}
              style={filterInputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Year to</span>
            <input
              type="number"
              placeholder="e.g. 2024"
              value={filterYearTo}
              onChange={(e) => setFilterYearTo(e.target.value)}
              style={filterInputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Source</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={filterInputStyle}
            >
              <option value="">All sources</option>
              <option value="arxiv">arXiv</option>
              <option value="semantic_scholar">Semantic Scholar</option>
              <option value="crossref">Crossref</option>
              <option value="pubmed">PubMed</option>
            </select>
          </label>
          <button
            onClick={loadAnalytics}
            style={{
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: 12, cursor: 'pointer',
              marginBottom: 1,
            }}
          >
            Apply
          </button>
          {(filterYearFrom || filterYearTo || filterSource) && (
            <button
              onClick={() => { setFilterYearFrom(''); setFilterYearTo(''); setFilterSource('') }}
              style={{
                padding: '7px 12px', borderRadius: 7, border: '1px solid #1e293b',
                background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
                marginBottom: 1,
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #1e293b' }}>
        {([
          { key: 'charts' as Tab, label: 'Trends & Distributions', icon: BarChart2 },
          { key: 'gaps' as Tab, label: 'Research Gap Analysis', icon: Lightbulb },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === key ? '#3b82f6' : 'transparent'}`,
              color: tab === key ? '#3b82f6' : '#64748b',
              cursor: 'pointer', fontSize: 14, fontWeight: tab === key ? 500 : 400,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Charts Tab */}
      {tab === 'charts' && (
        <>
          {loading ? <SkeletonGrid /> : error ? <ErrorState message={error} /> :
            !analytics || analytics.total_papers === 0 ? <EmptyState /> : (
              <>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                  Based on {analytics.total_papers} saved papers
                  {analytics.date_range.min_year && analytics.date_range.max_year
                    ? ` · ${analytics.date_range.min_year}–${analytics.date_range.max_year}` : ''}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                  {analytics.publications_by_year.length > 0 && (
                    <ChartCard title="Publications by Year" subtitle="Temporal research activity in your library">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={analytics.publications_by_year} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#3b82f6' }} />
                          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Papers" />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                  {analytics.domain_distribution.length > 0 && (
                    <ChartCard title="Research Domains" subtitle="Topic distribution across saved papers">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analytics.domain_distribution.slice(0, 8)} dataKey="count" nameKey="domain" cx="50%" cy="50%" outerRadius={80}
                            label={({ domain, percent }: { domain?: string; percent?: number }) => domain ? `${domain} ${((percent ?? 0) * 100).toFixed(0)}%` : ''} labelLine={false}>
                            {analytics.domain_distribution.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                  {analytics.top_keywords.length > 0 && (
                    <ChartCard title="Top Keywords" subtitle="Most frequent terms in titles and abstracts">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.top_keywords.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 20, left: 100, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis dataKey="keyword" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                          <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#8b5cf6' }} />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Frequency" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                  {analytics.source_distribution.length > 0 && (
                    <ChartCard title="Academic Sources" subtitle="Distribution by data source">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.source_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="source" tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#10b981' }} />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Papers" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </div>
                {analytics.top_keywords.length > 0 && (
                  <div style={{ marginTop: 20, background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                    <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Keyword frequency</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {analytics.top_keywords.map((kw, i) => (
                        <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#0f172a', border: '1px solid #1e293b' }}>
                          <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>{kw.keyword}</span>
                          <span style={{ color: '#475569', fontSize: 11 }}>×{kw.count}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ color: '#334155', fontSize: 11, marginTop: 12 }}>
                      Extracted from titles and abstracts of saved papers. Based on term frequency after stop-word removal.
                    </p>
                  </div>
                )}
              </>
            )}
        </>
      )}

      {/* Gaps Tab */}
      {tab === 'gaps' && (
        <>
          {gapLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12, fontSize: 13 }}>Analyzing research gaps...</p>
            </div>
          ) : !gaps ? null : !gaps.sufficient_data ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
              <h2 style={{ color: '#64748b', fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Insufficient data</h2>
              <p style={{ color: '#475569', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>{gaps.message}</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{gaps.message}</p>
                <button onClick={loadGaps} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {gaps.gaps.map((gap, i) => <GapCard key={i} gap={gap} />)}
              </div>

              {gaps.disclaimer && (
                <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: '#0b1120', border: '1px solid #1e293b' }}>
                  <p style={{ color: '#475569', fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                    ⚠️ {gaps.disclaimer}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GapCard({ gap }: { gap: GapFinding }) {
  const [expanded, setExpanded] = useState(false)
  const typeConfig = {
    limitation_pattern: { color: '#ef4444', icon: <TrendingDown size={14} />, label: 'Reported limitation' },
    underrepresented_topic: { color: '#f59e0b', icon: <AlertTriangle size={14} />, label: 'Underrepresented topic' },
    methodology_gap: { color: '#8b5cf6', icon: <BarChart2 size={14} />, label: 'Methodology gap' },
    emerging_topic: { color: '#3b82f6', icon: <Lightbulb size={14} />, label: 'Emerging topic' },
  }
  const strengthColor = { Strong: '#10b981', Moderate: '#3b82f6', Emerging: '#f59e0b', Weak: '#64748b' }
  const config = typeConfig[gap.gap_type as keyof typeof typeConfig] || typeConfig.emerging_topic

  return (
    <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: '#0f172a', border: '1px solid #1e293b', color: config.color, fontSize: 11 }}>
              {config.icon} {config.label}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 20, background: '#0f172a', border: '1px solid #1e293b', color: strengthColor[gap.evidence_strength as keyof typeof strengthColor] || '#64748b', fontSize: 11 }}>
              {gap.evidence_strength} evidence · {gap.supporting_paper_count} paper{gap.supporting_paper_count !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
            {expanded ? 'Less ▲' : 'More ▼'}
          </button>
        </div>
        <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 6px', lineHeight: 1.4 }}>{gap.title}</h3>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{gap.description}</p>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid #0f172a' }}>
          {gap.excerpts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Verbatim excerpts from abstracts:</div>
              {gap.excerpts.map((excerpt, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#0f172a', borderRadius: 6, marginBottom: 4, color: '#94a3b8', fontSize: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{excerpt}"
                </div>
              ))}
            </div>
          )}

          {gap.supporting_papers.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Supporting papers:</div>
              {gap.supporting_papers.map((p) => (
                <div key={p.id} style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none' }}>{p.title}</a>
                  ) : p.title}
                  {p.year && <span> ({p.year})</span>}
                  <span style={{ color: '#334155' }}> · {p.source}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, padding: '10px 14px', background: '#1a2a1a', borderRadius: 8, border: '1px solid #1e3a1e' }}>
            <div style={{ color: '#4ade80', fontSize: 11, marginBottom: 4 }}>💡 Research suggestion</div>
            <p style={{ color: '#86efac', fontSize: 12, lineHeight: 1.5, margin: 0 }}>{gap.research_suggestion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, margin: '0 0 3px' }}>{title}</h3>
        <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 280, background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
      <h2 style={{ color: '#64748b', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No data to analyze yet</h2>
      <p style={{ color: '#475569', fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
        Save research papers to your library to begin generating trend analysis, keyword distributions, and research gap insights.
      </p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: '#ef4444', fontSize: 13 }}>{message}</div>
}

const filterInputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid #1e293b',
  background: '#0f172a', color: '#e2e8f0', fontSize: 12, outline: 'none',
  width: 110,
}
