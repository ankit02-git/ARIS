import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { FileText, Download, Loader2, CheckCircle, XCircle, Plus } from 'lucide-react'

type ReportType = 'library_summary' | 'trend_analysis' | 'paper_comparison'
type ReportFormat = 'pdf' | 'csv' | 'json' | 'docx' | 'bibtex'

interface Report {
  id: number
  title: string
  report_type: string
  format: string
  status: string
  created_at: string
  file_path?: string | null
}

interface GenerateReportPayload {
  report_type: ReportType
  title: string
  format: ReportFormat
  paper_ids?: number[]
}

export default function ReportsPage() {
  const { token } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<GenerateReportPayload>({
    report_type: 'library_summary',
    title: 'Library Summary Report',
    format: 'pdf' as ReportFormat,
  })

  useEffect(() => {
    if (!token) return
    api.get<Report[]>('/api/reports', token)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleGenerate = async () => {
    if (!token) return
    setGenerating(true)
    setMessage('')
    try {
      const report = await api.post<Report>('/api/reports/generate', form, token)
      setReports((prev) => [report, ...prev])
      setMessage('Report generated successfully.')
      setShowForm(false)
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (report: Report) => {
    if (!token || !report.file_path) return
    try {
      const res = await fetch(`${api.base}/api/reports/${report.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const ext = report.format
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${report.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Download failed')
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Research outputs</p>
          <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Reports</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Generate report
        </button>
      </div>

      {/* Generate form */}
      {showForm && (
        <div style={{
          background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12,
          padding: 24, marginBottom: 24,
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>New report</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Report title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Report type</span>
                <select
                  value={form.report_type}
                  onChange={(e) => setForm({ ...form, report_type: e.target.value as ReportType })}
                  style={inputStyle}
                >
                  <option value="library_summary">Library summary</option>
                  <option value="trend_analysis">Trend analysis</option>
                  <option value="paper_comparison">Paper comparison</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Format</span>
                <select
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value as ReportFormat })}
                  style={inputStyle}
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">DOCX (Word)</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="bibtex">BibTeX</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: generating ? '#334155' : '#3b82f6',
                  color: '#fff', fontSize: 13, fontWeight: 500, cursor: generating ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {generating ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : 'Generate'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#1e293b', color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <EmptyState onGenerate={() => setShowForm(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((report) => (
            <ReportRow key={report.id} report={report} onDownload={handleDownload} />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ReportRow({ report, onDownload }: { report: Report; onDownload: (r: Report) => void }) {
  const statusConfig = {
    pending: { color: '#f59e0b', icon: <Loader2 size={12} />, label: 'Pending' },
    processing: { color: '#3b82f6', icon: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Processing' },
    completed: { color: '#10b981', icon: <CheckCircle size={12} />, label: 'Ready' },
    failed: { color: '#ef4444', icon: <XCircle size={12} />, label: 'Failed' },
  }
  const status = statusConfig[report.status as keyof typeof statusConfig] || statusConfig.pending

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px 20px', background: '#0b1120',
      border: '1px solid #1e293b', borderRadius: 10,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 8, width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <FileText size={16} color="#64748b" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {report.title}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{report.report_type.replace('_', ' ')}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>·</span>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{report.format}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>·</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(report.created_at).toLocaleDateString()}</span>
          <span style={{ fontSize: 11, color: '#475569' }}>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: status.color }}>
            {status.icon} {status.label}
          </span>
        </div>
      </div>
      {report.status === 'completed' && report.file_path && (
        <button
          onClick={() => onDownload(report)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7, border: '1px solid #1e3a5f',
            background: '#0f172a', color: '#93c5fd', fontSize: 12, cursor: 'pointer',
          }}
        >
          <Download size={12} /> Download
        </button>
      )}
    </div>
  )
}

function LoadingState() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {[1, 2].map((i) => <div key={i} style={{ height: 70, background: '#0b1120', borderRadius: 10, opacity: 0.5 }} />)}
  </div>
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>📄</div>
      <h2 style={{ color: '#64748b', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No reports yet</h2>
      <p style={{ color: '#475569', fontSize: 13, maxWidth: 360, margin: '0 auto 20px' }}>
        Generate a library summary, trend analysis or paper comparison report.
      </p>
      <button onClick={onGenerate}
        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
        Generate first report
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #1e293b',
  background: '#0f172a', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%',
}
