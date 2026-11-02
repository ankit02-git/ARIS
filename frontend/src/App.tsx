import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppLayout from './layouts/AppLayout'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ExplorePage from './pages/ExplorePage'
import LibraryPage from './pages/LibraryPage'
import AnalysisPage from './pages/AnalysisPage'
import AssistantPage from './pages/AssistantPage'
import RecommendationsPage from './pages/RecommendationsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import ComparisonPage from './pages/ComparisonPage'
import CollectionsPage from './pages/CollectionsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }
  if (!token) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route path="/auth" element={token ? <Navigate to="/dashboard" replace /> : <AuthPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/comparison" element={<ComparisonPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
