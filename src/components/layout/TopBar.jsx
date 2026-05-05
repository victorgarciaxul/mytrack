import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRole } from '../../context/RoleContext'

const TITLES = {
  '/tracker':      'Tracker',
  '/dashboard':    'Dashboard',
  '/reports':      'Reportes',
  '/projects':     'Proyectos',
  '/clients':      'Clientes',
  '/team':         'Equipo',
  '/users':        'Usuarios',
  '/notifications':'Alertas',
  '/settings':     'Ajustes',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { unreadCount } = useRole()

  const title = TITLES[pathname] || 'MyTrack'
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <div
      className="flex items-center flex-shrink-0 px-5 gap-4"
      style={{
        height: 44,
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E8EE',
        zIndex: 10,
      }}
    >
      <h1 style={{ fontSize: 14, fontWeight: 600, color: '#1C1C28', margin: 0 }}>{title}</h1>

      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative">
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md transition-all"
          style={{ color: '#7A7F9A' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F3F4F8'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Bell size={15} />
        </button>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background: '#EF4444', fontSize: 8 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 cursor-default"
        style={{ background: 'linear-gradient(135deg,#7C4DFF,#EC4899)', fontSize: 11, fontWeight: 700 }}
        title={user?.email}
      >
        {initials}
      </div>
    </div>
  )
}
