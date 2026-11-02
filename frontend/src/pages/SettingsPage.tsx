import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../services/api'
import { Settings, User, Bell, Database, Sun, Moon, Lock } from 'lucide-react'

export default function SettingsPage() {
  const { user, token } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const handleChangePassword = async () => {
    if (!token) return
    setPwMsg('')
    setPwError('')
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    setChangingPw(true)
    try {
      await api.post('/api/auth/change-password', { current_password: currentPw, new_password: newPw }, token)
      setPwMsg('Password changed successfully.')
      setCurrentPw('')
      setNewPw('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 4 }}>Preferences & account</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={<User size={16} color="var(--accent)" />}>
        <Field label="Full name" value={user?.name ?? '—'} />
        <Field label="Email address" value={user?.email ?? '—'} />
        <Field label="Account status" value="Active" />
      </Section>

      {/* Appearance */}
      <Section title="Appearance" icon={theme === 'dark' ? <Moon size={16} color="var(--purple)" /> : <Sun size={16} color="var(--amber)" />}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Theme</div>
            <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>
              Currently using {theme === 'dark' ? 'dark' : 'light'} mode
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" icon={<Lock size={16} color="var(--green)" />}>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>Current password</span>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>New password (min 8 characters)</span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={inputStyle}
            />
          </label>
          {pwError && <div style={{ color: 'var(--red)', fontSize: 12 }}>{pwError}</div>}
          {pwMsg && <div style={{ color: 'var(--green)', fontSize: 12 }}>{pwMsg}</div>}
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !currentPw || !newPw}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none', alignSelf: 'flex-start',
              background: changingPw || !currentPw || !newPw ? 'var(--bg-elevated)' : 'var(--accent)',
              color: changingPw || !currentPw || !newPw ? 'var(--text-faint)' : '#fff',
              fontSize: 13, cursor: changingPw || !currentPw || !newPw ? 'not-allowed' : 'pointer',
            }}
          >
            {changingPw ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </Section>

      {/* Data & Privacy */}
      <Section title="Data & Privacy" icon={<Database size={16} color="var(--purple)" />}>
        <Field label="Saved searches" value="Stored in your account, visible only to you" />
        <Field label="Uploaded documents" value="Private, not shared with other users" />
        <Field label="AI conversations" value="Private, stored per user, deletable" />
        <Field label="Collections" value="Private, organized per user" />
      </Section>

      {/* System */}
      <Section title="System information" icon={<Settings size={16} color="var(--green)" />}>
        <Field label="Application" value="ARIS — Affective Research Intelligence System" />
        <Field label="Version" value="1.0.0 — Milestone 6 Complete" />
        <Field label="Academic sources" value="arXiv, Semantic Scholar, Crossref, PubMed" />
        <Field label="AI backend" value="Ollama + llama3.2 (local inference)" />
        <Field label="Embeddings" value="all-MiniLM-L6-v2 via sentence-transformers" />
        <Field label="Vector index" value="FAISS flat inner-product (in-memory)" />
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={<Bell size={16} color="var(--amber)" />}>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: 0, padding: '10px 20px' }}>
          In-app status notifications are shown for background processing jobs. Email notifications are not configured in this version.
        </p>
      </Section>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        {icon}
        <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ padding: '4px 0' }}>{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>{label}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{value}</span>
    </div>
  )
}

// Workaround: React import needed for JSX type of Section/Field params
import React from 'react'

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 13, outline: 'none',
}
