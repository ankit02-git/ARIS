import React, { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { Microscope, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Google Client ID — set via env or leave empty to hide Google button
// ---------------------------------------------------------------------------
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validateEmail(email: string): string {
  if (!email) return 'Email is required'
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address (e.g. you@gmail.com)'
  return ''
}

function validatePassword(password: string, mode: 'login' | 'register'): string {
  if (!password) return 'Password is required'
  if (mode === 'register' && password.length < 8)
    return 'Password must be at least 8 characters'
  return ''
}

// ---------------------------------------------------------------------------
// Google Identity Services types (minimal)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (resp: { credential: string }) => void }) => void
          renderButton: (el: HTMLElement, cfg: object) => void
          prompt: () => void
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Validation errors
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  // ---- Switch mode: clear all fields and errors ----
  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setEmailError('')
    setPasswordError('')
    setTouched({ email: false, password: false })
    setMessage('')
  }

  // ---- Live validation after touch ----
  useEffect(() => {
    if (touched.email) setEmailError(validateEmail(email))
  }, [email, touched.email])

  useEffect(() => {
    if (touched.password) setPasswordError(validatePassword(password, mode))
  }, [password, mode, touched.password])

  // ---- Google Sign-In setup ----
  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true)
    setMessage('')
    try {
      const data = await api.post<{ access_token: string }>(
        '/api/auth/google',
        { credential },
        null,
      )
      login(data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setMessageType('error')
      setMessage(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setGoogleLoading(false)
    }
  }, [login, navigate])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => handleGoogleCredential(resp.credential),
    })
    const btn = document.getElementById('google-signin-btn')
    if (btn) {
      window.google.accounts.id.renderButton(btn, {
        theme: 'filled_black',
        size: 'large',
        width: 328,
        text: 'continue_with',
        shape: 'rectangular',
      })
    }
  }, [handleGoogleCredential])

  // ---- Form submit ----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Force-validate everything before submit
    const eErr = validateEmail(email)
    const pErr = validatePassword(password, mode)
    setEmailError(eErr)
    setPasswordError(pErr)
    setTouched({ email: true, password: true })

    if (eErr || pErr || (mode === 'register' && !name.trim())) return

    setLoading(true)
    setMessage('')
    try {
      if (mode === 'register') {
        await api.post('/api/auth/register', { name: name.trim(), email, password }, null)
        switchMode('login')
        setMessageType('success')
        setMessage('Account created successfully! Please sign in.')
      } else {
        const data = await api.post<{ access_token: string }>(
          '/api/auth/login',
          { email, password },
          null,
        )
        login(data.access_token)
        navigate('/dashboard')
      }
    } catch (err) {
      setMessageType('error')
      setMessage(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid =
    !emailError &&
    !passwordError &&
    email.length > 0 &&
    password.length > 0 &&
    (mode === 'login' || name.trim().length > 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      {/* Load Google Identity Services script */}
      {GOOGLE_CLIENT_ID && (
        <script src="https://accounts.google.com/gsi/client" async defer />
      )}

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
              onClick={() => switchMode(m)}
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

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div id="google-signin-btn" style={{ marginBottom: 4, minHeight: 44 }} />
            {googleLoading && (
              <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '8px 0 0' }}>
                Signing in with Google…
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
              <span style={{ color: '#475569', fontSize: 12 }}>or continue with email</span>
              <div style={{ flex: 1, height: 1, background: '#1e293b' }} />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          {mode === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#94a3b8', fontSize: 13 }}>Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          {/* Email field with validation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#94a3b8', fontSize: 13 }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              required
              style={{
                ...inputStyle,
                borderColor: touched.email && emailError ? '#ef4444' : '#1e293b',
              }}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {touched.email && emailError && (
              <span style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {emailError}
              </span>
            )}
          </div>

          {/* Password field with show/hide toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: '#94a3b8', fontSize: 13 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                required
                style={{
                  ...inputStyle,
                  paddingRight: 40,
                  borderColor: touched.password && passwordError ? '#ef4444' : '#1e293b',
                }}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {touched.password && passwordError && (
              <span style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {passwordError}
              </span>
            )}
            {mode === 'register' && password.length > 0 && !passwordError && (
              <span style={{ color: '#4ade80', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Password looks good
              </span>
            )}
          </div>

          {/* Message banner */}
          {message && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: messageType === 'success' ? '#0d2a0d' : '#2a0d0d',
              color: messageType === 'success' ? '#4ade80' : '#f87171',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {messageType === 'success'
                ? <CheckCircle size={14} />
                : <AlertCircle size={14} />}
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
              background: loading
                ? '#334155'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              transition: 'opacity 0.15s',
              opacity: !isFormValid && !loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
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
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
