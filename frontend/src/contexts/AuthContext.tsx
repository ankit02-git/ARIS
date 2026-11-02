import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'
import type { User } from '../types'

interface AuthContextValue {
  token: string | null
  user: User | null
  loading: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('aris-token'))
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.get<User>('/api/auth/me', token)
      .then(setUser)
      .catch(() => {
        setToken(null)
        localStorage.removeItem('aris-token')
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = (newToken: string) => {
    localStorage.setItem('aris-token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('aris-token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
