import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  ChevronDown, Tag, LayoutDashboard, Bell, UserCog,
  Search, LogOut, HelpCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'

const NAV_EMPLOYEE = [
  { to: '/tracker',       icon: Clock,          label: 'Tracker'   },
  { to: '/notifications', icon: Bell,           label: 'Alertas', badge: true },
  { to: '/settings',      icon: Settings,       label: 'Ajustes'   },
]
const NAV_MANAGER = [
  { to: '/dashboard',     icon: LayoutDashboard,label: 'Dashboard' },
  { to: '/tracker',       icon: Clock,          label: 'Tracker'   },
  { to: '/reports',       icon: BarChart2,      label: 'Reportes'  },
  { to: '/projects',      icon: Briefcase,      label: 'Proyectos' },
  { to: '/clients',       icon: Tag,            label: 'Clientes'  },
  { to: '/team',          icon: Users,          label: 'Equipo'    },
  { to: '/notifications', icon: Bell,           label: 'Alertas', badge: true },
  { to: '/settings',      icon: Settings,       label: 'Ajustes'   },
]
const NAV_ADMIN_EXTRA = [
  { to: '/users', icon: UserCog, label: 'Usuarios' },
]

export default function Sidebar({ onStartTour }) {
  const [search, setSearch] = useState('')
  const { user, signOut } = useAuth()
  const { workspace } = useWorkspace()
  const { isManager, isAdmin, unreadCount } = useRole()
  const location = useLocation()
  const { resetTour } = useTour()

  const nav = isManager
    ? [...NAV_MANAGER, ...(isAdmin ? NAV_ADMIN_EXTRA : [])]
    : NAV_EMPLOYEE

  const filtered = search
    ? nav.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nav

  const wsName = workspace?.name || 'MyTrack'
  const wsInitials = wsName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: '#1B1B1F',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Workspace header */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', width: '100%',
          background: 'transparent', border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: 'linear-gradient(135deg,#7B68EE,#5E4DC8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>
          {wsInitials}
        </div>
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 600, color: '#fff',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {wsName}
        </span>
        <ChevronDown size={13} style={{ color: '#5C6370', flexShrink: 0 }} />
      </button>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Search size={13} style={{ color: '#5C6370', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: '#9EA6B4', flex: 1,
            }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
        <div style={{ padding: '8px 8px 3px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5C6370' }}>
          {isManager ? 'Gestión' : 'Mi trabajo'}
        </div>

        {filtered.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
          const count = badge ? unreadCount : 0
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={`nav-${to.replace('/', '')}`}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 1 }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: isActive ? 'rgba(123,104,238,0.15)' : 'transparent',
                  color: isActive ? '#fff' : '#9EA6B4',
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  position: 'relative', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#D0D3DE' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9EA6B4' } }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2, background: '#7B68EE', borderRadius: '0 2px 2px 0' }} />
                )}
                <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                  <Icon size={14} />
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5,
                      minWidth: 14, height: 14, borderRadius: 7,
                      background: '#EF4444', color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 2px',
                    }}>
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '6px 6px' }}>
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#5C6370', fontSize: 12,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#9EA6B4' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5C6370' }}
        >
          <HelpCircle size={14} style={{ flexShrink: 0 }} />
          <span>Tutorial</span>
        </button>

        <button
          onClick={signOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#5C6370', fontSize: 12,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5C6370' }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7B68EE,#EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {userInitials}
          </div>
          <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'left' }}>
            {userName}
          </span>
          <LogOut size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
        </button>
      </div>
    </aside>
  )
}
