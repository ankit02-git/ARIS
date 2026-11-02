import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import type { DashboardData } from '../types'
import { Search, BookOpen, BarChart2, TrendingUp, ArrowRight, Layers } from 'lucide-react'

const quickActions = [
  { label: 'Search papers', desc: 'Explore academic research', icon: Search, to: '/explore' },
  { label: 'My Library', desc: 'View saved & uploaded', icon: BookOpen, to: '/library' },
  { label: 'Analytics', desc: 'Trends & distributions', icon: BarChart2, to: '/analysis' },
  { label: 'AI Assistant', desc: 'Ask research questions', icon: Layers, to: '/assistant' },
]

export default function DashboardPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [recentPapers, setRecentPapers] = useState<{ title: string; source: string; publication_year?: number | null; url?: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<DashboardData>('/api/dashboard', token),
      api.get<{ title: string; source: string; publication_year?: number | null; url?: string | null }[]>('/api/library', token),
    ])
      .then(([dash, library]) => {
        setDashboard(dash)
        setRecentPapers(library.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <PageShell><LoadingSkeleton /></PageShell>

  const stats = [
    { label: 'Papers collected', value: dashboard?.papers_collected ?? 0, icon: '📄', color: '#3b82f6' },
    { label: 'Saved papers', value: dashboard?.saved_papers ?? 0, icon: '🔖', color: '#8b5cf6' },
    { label: 'Papers analyzed', value: dashboard?.papers_analyzed ?? 0, icon: '🔬', color: '#10b981' },
    { label: 'Activity', value: dashboard?.research_activity ?? 'Ready', icon: '⚡', color: '#f59e0b' },
  ]

  return (
    <PageShell>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 6 }}>Research intelligence dashboard</p>
        <h1 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0 }}>
          Welcome back{user?.name ? `, ${user.name}` : ''} 👋
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>
          Transforming affective computing research into actionable intelligence.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: 12,
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, marginBottom: 4 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Quick search */}
        <div>
          <div style={{
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}>
            <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Quick search
            </h2>
            <QuickSearch onSearch={(q) => navigate(`/explore?q=${encodeURIComponent(q)}`)} />
          </div>

          {/* Recent saved papers */}
          <div style={{
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: 12,
            padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600, margin: 0 }}>Recently saved</h2>
              <button
                onClick={() => navigate('/library')}
                style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            {recentPapers.length === 0 ? (
              <EmptyState message="No papers saved yet. Search and save papers to build your library." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentPapers.map((paper, i) => (
                  <div key={i} style={{
                    padding: '12px 16px',
                    background: '#0f172a',
                    borderRadius: 8,
                    border: '1px solid #1e293b',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>{paper.source}</span>
                      {paper.publication_year && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>{paper.publication_year}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4 }}>
                      {paper.url ? (
                        <a href={paper.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {paper.title}
                        </a>
                      ) : paper.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Quick actions</h2>
          {quickActions.map(({ label, desc, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: '#0b1120',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '16px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#e2e8f0',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{
                background: '#1e293b',
                borderRadius: 8,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
              </div>
              <ArrowRight size={14} color="#334155" style={{ marginLeft: 'auto' }} />
            </button>
          ))}

          <div style={{
            background: 'linear-gradient(135deg, #1e2d4a, #1e1a3a)',
            border: '1px solid #2d3f5a',
            borderRadius: 12,
            padding: '16px 18px',
            marginTop: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TrendingUp size={14} color="#3b82f6" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>Affective Computing</span>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Research areas include emotion recognition, sentiment analysis, facial expression, speech emotion, stress detection and multimodal fusion.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function QuickSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('')
  const suggestions = [
    'Emotion recognition using deep learning',
    'Facial expression recognition CNN',
    'Speech emotion recognition transformer',
    'Multimodal affective computing',
    'Sentiment analysis BERT',
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && q.trim() && onSearch(q.trim())}
          placeholder="Search affective computing research..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #1e293b',
            background: '#0f172a',
            color: '#e2e8f0',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={() => q.trim() && onSearch(q.trim())}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSearch(s)}
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              border: '1px solid #1e293b',
              background: '#0f172a',
              color: '#64748b',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1200, margin: '0 auto' }}>
      {children}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 80, background: '#1e293b', borderRadius: 12, opacity: 0.5 }} />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
      {message}
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 6,
}
