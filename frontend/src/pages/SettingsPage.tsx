import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Settings, User, Bell, Database } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div style={{ padding: '32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>Preferences & account</p>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={<User size={16} color="#3b82f6" />}>
        <Field label="Full name" value={user?.name ?? '—'} />
        <Field label="Email address" value={user?.email ?? '—'} />
        <Field label="Account status" value="Active" />
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy" icon={<Database size={16} color="#8b5cf6" />}>
        <Field label="Search history" value="Stored locally per session" />
        <Field label="Uploaded documents" value="Private, not shared with other users" />
        <Field label="AI conversations" value="Private, stored per user" />
      </Section>

      {/* System */}
      <Section title="System information" icon={<Settings size={16} color="#10b981" />}>
        <Field label="Application" value="ARIS — Affective Research Intelligence System" />
        <Field label="Version" value="1.0.0 — Milestone 2" />
        <Field label="Academic sources" value="arXiv, Semantic Scholar, Crossref, PubMed" />
        <Field label="AI backend" value="Ollama + Qwen 2.5 (local)" />
        <Field label="Embeddings" value="all-MiniLM-L6-v2 via FastEmbed" />
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={<Bell size={16} color="#f59e0b" />}>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          In-app status notifications are shown for background processing jobs. Email notifications are not configured in this version.
        </p>
      </Section>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
        {icon}
        <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #0f172a' }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{value}</span>
    </div>
  )
}
