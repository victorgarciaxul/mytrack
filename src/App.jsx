import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { RoleProvider } from './context/RoleContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Tracker from './pages/Tracker'
import Reports from './pages/Reports'
import Projects from './pages/Projects'
import Clients from './pages/Clients'
import Team from './pages/Team'
import Settings from './pages/Settings'
import ManagerDashboard from './pages/ManagerDashboard'
import Users from './pages/Users'
import Notifications from './pages/Notifications'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FA' }}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7C4DFF', borderTopColor: 'transparent' }} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/tracker" replace />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="projects" element={<Projects />} />
            <Route path="clients" element={<Clients />} />
            <Route path="team" element={<Team />} />
            <Route path="users" element={<Users />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
