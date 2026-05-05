import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  Tag, LayoutDashboard, Bell, UserCog,
  Search, LogOut, HelpCircle, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'

const NAV_EMPLOYEE = [
  { to: '/tracker',       icon: Clock,          label: 'Tracker'   },
  { to: '/notifications', icon: Bell,           label: 'Alertas',  badge: true },
  { to: '/settings',      icon: Settings,       label: 'Ajustes'   },
]
const NAV_MANAGER = [
  { to: '/dashboard',     icon: LayoutDashboard,label: 'Dashboard' },
  { to: '/tracker',       icon: Clock,          label: 'Tracker'   },
  { to: '/reports',       icon: BarChart2,      label: 'Reportes'  },
  { to: '/projects',      icon: Briefcase,      label: 'Proyectos' },
  { to: '/clients',       icon: Tag,            label: 'Clientes'  },
  { to: '/team',          icon: Users,          label: 'Equipo'    },
  { to: '/notifications', icon: Bell,           label: 'Alertas',  badge: true },
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
  const wsInitials = wsName.slice(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 232,
      flexShrink: 0,
      background: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Workspace */}
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', background: 'transparent', border: 'none',
          cursor: 'pointer', borderRadius: 8, padding: '6px 8px',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #7C4DFF, #E040FB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 8px rgba(124,77,255,0.3)',
          }}>
            {wsInitials}
          </div>
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {wsName}
            </p>
            <p style={{ fontSize: 10, color: '#475569', margin: 0, marginTop: 1 }}>Workspace</p>
          </div>
          <ChevronDown size={13} style={{ color: '#475569', flexShrink: 0 }} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Search size={13} style={{ color: '#475569', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: '#94A3B8', flex: 1,
            }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        <p style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#334155',
          padding: '0 6px', marginBottom: 4,
        }}>
          {isManager ? 'Gestión' : 'Mi trabajo'}
        </p>

        {filtered.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
          const count = badge ? unreadCount : 0
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={`nav-${to.replace('/', '')}`}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 8px', borderRadius: 8,
                  background: isActive ? 'rgba(124,77,255,0.18)' : 'transparent',
                  color: isActive ? '#C4B5FD' : '#64748B',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  borderLeft: isActive ? '2px solid #7C4DFF' : '2px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = '#CBD5E1'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#64748B'
                  }
                }}
              >
                <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                  <Icon size={15} />
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -6,
                      minWidth: 15, height: 15, borderRadius: 8,
                      background: '#EF4444', color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
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
      <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 8px', borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#334155', fontSize: 12, marginBottom: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748B' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155' }}
        >
          <HelpCircle size={14} style={{ flexShrink: 0 }} />
          <span>Tutorial</span>
        </button>

        <button
          onClick={signOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 8px', borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#334155', fontSize: 12,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155' }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
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
