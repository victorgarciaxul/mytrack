import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRole } from '../../context/RoleContext'
import { useWorkspace } from '../../context/WorkspaceContext'

const TITLES = {
  '/tracker':       'Tracker',
  '/dashboard':     'Dashboard',
  '/reports':       'Reportes',
  '/projects':      'Proyectos',
  '/clients':       'Clientes',
  '/team':          'Equipo',
  '/users':         'Usuarios',
  '/notifications': 'Alertas',
  '/settings':      'Ajustes',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount } = useRole()
  const { workspace } = useWorkspace()

  const pageTitle = TITLES[pathname] || 'MyTrack'
  const wsName = workspace?.name || 'MyTrack'
  const initials = (user?.user_metadata?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      height: 52,
      background: '#FFFFFF',
      borderBottom: '1px solid #F1F5F9',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>{wsName}</span>
        <ChevronRight size={12} style={{ color: '#CBD5E1' }} />
        <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 600, letterSpacing: '-0.2px' }}>{pageTitle}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => navigate('/notifications')}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94A3B8', position: 'relative',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#475569' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 7, height: 7, borderRadius: '50%',
              background: '#EF4444', border: '1.5px solid #fff',
            }} />
          )}
        </button>

        <div title={user?.email} style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
          boxShadow: '0 2px 8px rgba(124,77,255,0.3)',
          cursor: 'default',
        }}>
          {initials}
        </div>
      </div>
    </div>
  )
}
