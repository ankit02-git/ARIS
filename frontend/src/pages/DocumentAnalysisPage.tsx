import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { ArrowLeft, FileText, Loader2, AlertTriangle } from 'lucide-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']

interface AnalysisData {
  document_id: number
  original_filename: string
  extracted_title: string | null
  extracted_authors: string | null
  stats: {
    total_pages: number
    total_chunks: number
    total_words: number
    unique_keywords: number
  }
  top_keywords: { keyword: string; count: number }[]
  page_distribution: { page: number; chunks: number; words: number }[]
  section_distribution: { section: string; count: number }[]
  top_sentences: { text: string; page: number | null; section: string | null }[]
}

export default function DocumentAnalysisPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    api.get<AnalysisData>(`/api/documents/${id}/analysis`, token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analysis'))
      .finally(() => setLoading(false))
  }, [token, id])

  if (loading) return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-faint)' }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Analysing document…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ padding: 32 }}>
      <button onClick={() => navigate(-1)} style={backBtnStyle}><ArrowLeft size={14} /> Back</button>
      <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center', color: '#ef4444' }}>
        <AlertTriangle size={18} /> {error}
      </div>
    </div>
  )

  if (!data) return null

  const hasPageDist = data.page_distribution.length > 0
  const hasSectionDist = data.section_distribution.length > 0 && !(data.section_distribution.length === 1 && data.section_distribution[0].section === '(unlabelled)')
  const hasKeywords = data.top_keywords.length > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <button onClick={() => navigate(-1)} style={backBtnStyle}>
        <ArrowLeft size={14} /> Back to Library
      </button>

      <div style={{ marginTop: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <FileText size={20} color="var(--accent)" />
          <h1 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {data.extracted_title || data.original_filename}
          </h1>
        </div>
        {data.extracted_authors && (
          <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '0 0 4px 30px' }}>{data.extracted_authors}</p>
        )}
        <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '0 0 0 30px' }}>{data.original_filename}</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Pages', value: data.stats.total_pages || '—' },
          { label: 'Words', value: data.stats.total_words.toLocaleString() },
          { label: 'Text Chunks', value: data.stats.total_chunks },
          { label: 'Unique Keywords', value: data.stats.unique_keywords },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>

        {/* Keyword frequency bar */}
        {hasKeywords && (
          <ChartCard title="Top Keywords" subtitle="Most frequent content terms (stop-words removed)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.top_keywords.slice(0, 15)}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 110, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} />
                <YAxis dataKey="keyword" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={110} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-muted)' }}
                  itemStyle={{ color: '#8b5cf6' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Frequency" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Section pie chart */}
        {hasSectionDist ? (
          <ChartCard title="Section Distribution" subtitle="Chunks per detected section heading">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.section_distribution}
                  dataKey="count"
                  nameKey="section"
                  cx="45%"
                  cy="50%"
                  outerRadius={95}
                  label={({ section, percent }: { section?: string; percent?: number }) =>
                    section && (percent ?? 0) > 0.04 ? `${section.slice(0, 14)} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {data.section_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(value: number, name: string) => [value + ' chunks', name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          /* Keyword pie fallback when no section headings */
          hasKeywords && (
            <ChartCard title="Keyword Share" subtitle="Top 10 keywords by share of frequency">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.top_keywords.slice(0, 10)}
                    dataKey="count"
                    nameKey="keyword"
                    cx="45%"
                    cy="50%"
                    outerRadius={95}
                    label={({ keyword, percent }: { keyword?: string; percent?: number }) =>
                      keyword && (percent ?? 0) > 0.04 ? `${keyword} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {data.top_keywords.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )
        )}

        {/* Page-wise word count line chart */}
        {hasPageDist && (
          <ChartCard
            title="Words per Page"
            subtitle="Content density across all pages"
            wide={data.page_distribution.length > 20}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.page_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="page" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} label={{ value: 'Page', position: 'insideBottom', offset: -2, fill: 'var(--text-dim)', fontSize: 11 }} height={30} />
                <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelFormatter={(l) => `Page ${l}`}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Line type="monotone" dataKey="words" stroke="#3b82f6" strokeWidth={2} dot={data.page_distribution.length < 30 ? { r: 3, fill: '#3b82f6' } : false} name="Words" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Page-wise chunks bar chart */}
        {hasPageDist && (
          <ChartCard title="Chunks per Page" subtitle="Text extraction density per page">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.page_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="page" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} label={{ value: 'Page', position: 'insideBottom', offset: -2, fill: 'var(--text-dim)', fontSize: 11 }} height={30} />
                <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelFormatter={(l) => `Page ${l}`}
                  itemStyle={{ color: '#10b981' }}
                />
                <Bar dataKey="chunks" fill="#10b981" radius={[3, 3, 0, 0]} name="Chunks" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Keyword tag cloud */}
      {hasKeywords && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Keyword Cloud</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.top_keywords.map((kw, i) => {
              const maxCount = data.top_keywords[0]?.count || 1
              const size = 11 + Math.round((kw.count / maxCount) * 10)
              return (
                <span key={kw.keyword} style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: COLORS[i % COLORS.length],
                  fontSize: size, fontWeight: size > 16 ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  {kw.keyword}
                  <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>×{kw.count}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Top key sentences */}
      {data.top_sentences.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Key Sentences</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: '0 0 14px' }}>Most information-dense sentences extracted from the document</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.top_sentences.map((s, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  {s.page && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-surface)', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      pg {s.page}
                    </span>
                  )}
                  {s.section && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--bg-surface)', padding: '1px 7px', borderRadius: 10, border: '1px solid var(--border)' }}>
                      § {s.section}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                  "{s.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ChartCard({ title, subtitle, children, wide }: {
  title: string; subtitle: string; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '20px 24px', gridColumn: wide ? 'span 2' : undefined,
    }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, margin: '0 0 3px' }}>{title}</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, margin: 0 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer',
}
