import React, { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { Microscope } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'register') {
        await api.post('/api/auth/register', { name, email, password }, null)
        setMode('login')
        setMessage('Account created. Please sign in.')
      } else {
        const data = await api.post<{ access_token: string }>('/api/auth/login', { email, password }, null)
        login(data.access_token)
        navigate('/dashboard')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#0b1120',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 12,
            width: 48,
            height: 48,
            marginBottom: 16,
          }}>
            <Microscope size={24} color="#fff" />
          </div>
          <h1 style={{ color: '#f8fafc', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>ARIS</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
            Affective Research Intelligence System
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#0f172a', borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMessage('') }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 6,
                border: 'none',
                background: mode === m ? '#1e293b' : 'transparent',
                color: mode === m ? '#f8fafc' : '#64748b',
                fontWeight: mode === m ? 500 : 400,
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
                placeholder="Your name"
              />
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="••••••••"
            />
          </label>

          {message && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: message.toLowerCase().includes('success') || message.toLowerCase().includes('created')
                ? '#0d2a0d'
                : '#2a0d0d',
              color: message.toLowerCase().includes('success') || message.toLowerCase().includes('created')
                ? '#4ade80'
                : '#f87171',
              fontSize: 13,
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #1e293b',
  background: '#0f172a',
  color: '#e2e8f0',
  fontSize: 14,
  outline: 'none',
  width: '100%',
}
