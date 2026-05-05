import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  Tag, LayoutDashboard, Bell, UserCog, HelpCircle,
  ChevronDown, Plus,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'

export default function Sidebar({ onStartTour }) {
  const { user, signOut } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { isManager, isAdmin, unreadCount } = useRole()
  const location = useLocation()
  const { resetTour } = useTour()

  const wsName = workspace?.name || 'MyTrack'
  const wsInitials = wsName.slice(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const generalNav = [
    ...(isManager ? [{ to: '/dashboard', icon: LayoutDashboard, label: 'Resumen', color: '#7C4DFF' }] : []),
    { to: '/tracker', icon: Clock, label: 'Registro de tiempo', color: '#7C4DFF' },
    ...(isManager ? [{ to: '/reports', icon: BarChart2, label: 'Informes', color: '#7C4DFF' }] : []),
    { to: '/notifications', icon: Bell, label: 'Bandeja de entrada', color: '#7C4DFF', badge: true },
  ]

  const projectNav = [
    { to: '/projects', icon: Briefcase, label: 'Proyectos', color: '#10B981' },
    { to: '/clients', icon: Tag, label: 'Clientes', color: '#F59E0B' },
    ...(isManager ? [{ to: '/team', icon: Users, label: 'Equipo', color: '#6366F1' }] : []),
    ...(isAdmin ? [{ to: '/users', icon: UserCog, label: 'Usuarios', color: '#EC4899' }] : []),
  ]

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      background: 'var(--c-bg-surface)',
      borderRight: '1px solid var(--c-border-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--c-border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,77,255,0.3)',
          }}>
            <Clock size={16} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.3px' }}>
            MyTrack
          </span>
        </div>
      </div>

      {/* Logo XUL centrado */}
      <div style={{ padding: '14px 20px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <img
          src="/logo-xul.png"
          alt="XUL"
          style={{
            height: 28, width: 'auto',
            filter: 'var(--logo-filter)',
          }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 14px' }}>

        <SectionLabel>General</SectionLabel>
        {generalNav.map(item => (
          <NavItem key={item.to} item={item} location={location} unreadCount={unreadCount} />
        ))}

        {projectNav.length > 0 && (
          <>
            <SectionLabel extra={
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#7C4DFF'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-3)'}
              >
                <Plus size={13} />
              </button>
            }>Gestión</SectionLabel>
            {projectNav.map(item => (
              <NavItem key={item.to} item={item} location={location} unreadCount={unreadCount} />
            ))}
          </>
        )}

        {/* Recent projects */}
        {projects.length > 0 && (
          <>
            <div style={{ marginTop: 8 }}>
              {projects.slice(0, 4).map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 8, cursor: 'default',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: p.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 14px 16px', borderTop: '1px solid var(--c-border-light)' }}>
        <NavItem
          item={{ to: '/settings', icon: Settings, label: 'Configuración', color: 'var(--c-text-3)' }}
          location={location}
          unreadCount={0}
        />
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 8px', borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--c-text-3)', fontSize: 13, marginBottom: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = '#7C4DFF' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)' }}
        >
          <HelpCircle size={15} style={{ flexShrink: 0 }} />
          <span>Centro de ayuda</span>
        </button>

        {/* User */}
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 10px', borderRadius: 10,
            background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 6px rgba(124,77,255,0.3)',
          }}>
            {userInitials}
          </div>
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden', minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <p style={{ fontSize: 10, color: 'var(--c-text-3)', margin: 0 }}>EQUIPO</p>
          </div>
          <ChevronDown size={12} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
        </button>
      </div>
    </aside>
  )
}

function SectionLabel({ children, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 8px 4px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--c-text-4)',
    }}>
      <span>{children}</span>
      {extra}
    </div>
  )
}

function NavItem({ item, location, unreadCount }) {
  const { to, icon: Icon, label, badge } = item
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
  const count = badge ? unreadCount : 0

  return (
    <NavLink to={to} data-tour={`nav-${to.replace('/', '')}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 8px', borderRadius: 9,
          background: isActive ? '#7C4DFF18' : 'transparent',
          color: isActive ? '#7C4DFF' : 'var(--c-text-2)',
          fontSize: 13, fontWeight: isActive ? 600 : 400,
          transition: 'all 0.1s', cursor: 'pointer', position: 'relative',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-1)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-2)' } }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: isActive ? '#7C4DFF20' : 'var(--c-bg-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.1s',
        }}>
          <Icon size={13} style={{ color: isActive ? '#7C4DFF' : 'var(--c-text-3)' }} />
        </div>
        <span style={{ flex: 1 }}>{label}</span>
        {count > 0 && (
          <span style={{
            minWidth: 18, height: 18, borderRadius: 9,
            background: '#EF4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
    </NavLink>
  )
}
