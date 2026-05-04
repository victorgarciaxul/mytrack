import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  ChevronLeft, ChevronRight, Timer, Tag, ChevronDown,
  LayoutDashboard, Bell, UserCog, HelpCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'

export default function Sidebar({ onStartTour }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut } = useAuth()
  const { workspace } = useWorkspace()
  const { isManager, isAdmin, unreadCount, role } = useRole()
  const location = useLocation()
  const { resetTour } = useTour()

  const employeeNav = [
    { to: '/tracker',  icon: Clock,            label: 'Tracker',    color: '#7B68EE' },
    { to: '/notifications', icon: Bell,         label: 'Alertas',    color: '#FF6BCA', badge: unreadCount },
  ]

  const managerNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  color: '#4FC3F7' },
    { to: '/tracker',   icon: Clock,           label: 'Tracker',    color: '#7B68EE' },
    { to: '/reports',   icon: BarChart2,        label: 'Reportes',   color: '#FF6BCA' },
    { to: '/projects',  icon: Briefcase,        label: 'Proyectos',  color: '#81C784' },
    { to: '/clients',   icon: Tag,              label: 'Clientes',   color: '#FFB74D' },
    { to: '/team',      icon: Users,            label: 'Equipo',     color: '#26C6DA' },
    { to: '/notifications', icon: Bell,         label: 'Alertas',    color: '#FF8A65', badge: unreadCount },
  ]

  const adminExtra = [
    { to: '/users', icon: UserCog, label: 'Usuarios', color: '#CE93D8' },
  ]

  const navItems = isManager
    ? [...managerNav, ...(isAdmin ? adminExtra : [])]
    : employeeNav

  const tourAttr = (key) => ({ 'data-tour': key })

  const roleBadge = { admin: 'Admin', manager: 'Manager', employee: 'Empleado' }[role] || ''
  const roleColor = { admin: '#7B68EE', manager: '#4FC3F7', employee: '#81C784' }[role] || '#9090B0'

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <aside
      className="relative flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 64 : 220, background: 'linear-gradient(180deg,#13131F 0%,#1A1A2E 100%)', borderRight: '1px solid #2E2E4A' }}
    >
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-3 py-4" style={{ borderBottom: '1px solid #2E2E4A' }}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(180deg,#1A1A2E,#13131F)', border: '1.5px solid #2E2E4A' }}>
            <Timer size={16} style={{ color: '#7B68EE' }} />
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <img src="/logo-xul.png" alt="XUL" style={{ height: 28, objectFit: 'contain', objectPosition: 'left' }} />
            <p className="text-xs truncate mt-1" style={{ color: '#6B6B8A' }}>{user?.email}</p>
          </div>
        )}
        {!collapsed && <ChevronDown size={14} style={{ color: '#6B6B8A', flexShrink: 0 }} />}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-3 py-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${roleColor}18`, color: roleColor }}>
            {roleBadge}
          </span>
        </div>
      )}

      {/* Nav */}
      <div className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: '#4A4A6A' }}>
            {isManager ? 'Gestión' : 'Mi trabajo'}
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label, color, badge }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
          const tourKey = `nav-${to.replace('/', '')}`
          return (
            <NavLink key={to} to={to}
              data-tour={tourKey}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative"
              style={{ background: isActive ? 'rgba(107,78,255,0.18)' : 'transparent', color: isActive ? '#fff' : '#8888A8' }}
            >
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: color }} />}
              <span className="relative flex-shrink-0">
                <Icon size={17} style={{ color: isActive ? color : '#6B6B8A' }} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background: '#FF4757', fontSize: 9 }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          )
        })}

        {/* Settings separator */}
        {!collapsed && <div className="my-2" style={{ borderTop: '1px solid #2E2E4A' }} />}
        <NavLink to="/settings"
          data-tour="nav-settings"
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all"
          style={({ isActive }) => ({ background: isActive ? 'rgba(107,78,255,0.18)' : 'transparent', color: isActive ? '#fff' : '#8888A8' })}
        >
          <Settings size={17} style={{ color: '#6B6B8A', flexShrink: 0 }} />
          {!collapsed && <span>Ajustes</span>}
        </NavLink>
      </div>

      {/* User + signout */}
      <div className="px-2 pb-3 pt-2" style={{ borderTop: '1px solid #2E2E4A' }}>
        {/* Tutorial button */}
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-all mb-1"
          style={{ color: '#5A5A7A' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,104,238,0.1)'; e.currentTarget.style.color = '#7B68EE' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5A5A7A' }}
          title="Ver tutorial"
        >
          <HelpCircle size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Ver tutorial</span>}
        </button>
        <button onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all"
          style={{ color: '#6B6B8A' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B6B8A' }}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg,#7B68EE,#FF6BCA)' }}>
            {initials}
          </div>
          {!collapsed && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-12 w-6 h-6 rounded-full flex items-center justify-center z-10"
        style={{ background: '#2D2D4A', border: '1px solid #3A3A5A', color: '#8888A8' }}
        onMouseEnter={e => e.currentTarget.style.background = '#3D3D5A'}
        onMouseLeave={e => e.currentTarget.style.background = '#2D2D4A'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
