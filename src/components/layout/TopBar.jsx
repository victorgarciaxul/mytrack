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
      height: 48,
      background: '#FFFFFF',
      borderBottom: '1px solid #EAECEF',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 8,
      flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <span style={{ fontSize: 13, color: '#7A8494', fontWeight: 400 }}>{wsName}</span>
        <ChevronRight size={13} style={{ color: '#C0C5CF' }} />
        <span style={{ fontSize: 13, color: '#1C1C28', fontWeight: 600 }}>{pageTitle}</span>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => navigate('/notifications')}
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', color: '#7A8494',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F3F4F8'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 5, right: 5,
              width: 7, height: 7, borderRadius: '50%',
              background: '#EF4444', border: '1.5px solid #fff',
            }} />
          )}
        </button>

        <div title={user?.email} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7B68EE,#EC4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', marginLeft: 4,
        }}>
          {initials}
        </div>
      </div>
    </div>
  )
}
