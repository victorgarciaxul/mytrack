import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'

// ── Error Boundary — catches render crashes and shows a helpful UI ─────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(err) { return { error: err } }
  componentDidCatch(err, info) { console.error('App render error:', err, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060F', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#fff', marginBottom: 8, fontSize: 20 }}>Algo salió mal</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/tracker' }}
            style={{ padding: '10px 24px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }
}
import { WorkspaceProvider } from './context/WorkspaceContext'
import { RoleProvider } from './context/RoleContext'
import { ThemeProvider } from './context/ThemeContext'
import { TimerProvider } from './context/TimerContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Tracker from './pages/Tracker'
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Projects from './pages/Projects'
import Team from './pages/Team'
import Settings from './pages/Settings'
import ManagerDashboard from './pages/ManagerDashboard'
import Notifications from './pages/Notifications'
import Tags from './pages/Tags'
import TimeOff from './pages/TimeOff'
import Clients from './pages/Clients'
import Costs from './pages/Costs'
import Overtime from './pages/Overtime'
import EnDirecto from './pages/EnDirecto'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--c-input-bg)' }}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7C4DFF', borderTopColor: 'transparent' }} />
    </div>
  )
  if (!user) { window.location.replace('https://appcenter.xul.es'); return null; }
  return (
    <WorkspaceProvider>
      <RoleProvider>
        {children}
      </RoleProvider>
    </WorkspaceProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
      <TimerProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/tracker" replace />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="projects" element={<Projects />} />
            <Route path="team" element={<Team />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="tags" element={<Tags />} />
            <Route path="time-off" element={<TimeOff />} />
            <Route path="clients" element={<Clients />} />
            <Route path="costs" element={<Costs />} />
            <Route path="overtime" element={<Overtime />} />
            <Route path="en-directo" element={<EnDirecto />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </TimerProvider>
      </ThemeProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
