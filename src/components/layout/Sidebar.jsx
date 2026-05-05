import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  ChevronLeft, ChevronRight, Timer, Tag,
  LayoutDashboard, Bell, UserCog, HelpCircle, Search, LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'

// ─── ClickUp color tokens ─────────────────────────────────────────────────────
const S = {
  bg:      '#191B23',
  border:  'rgba(255,255,255,0.07)',
  hover:   'rgba(255,255,255,0.05)',
  active:  'rgba(124,77,255,0.10)',
  text:    '#8C8FA8',
  textOn:  '#FFFFFF',
  label:   '#454859',
  primary: '#7C4DFF',
  input:   'rgba(255,255,255,0.06)',
}

const NAV_EMPLOYEE = [
  { to: '/tracker',      icon: Clock,          label: 'Tracker',    color: '#7C4DFF' },
  { to: '/notifications',icon: Bell,           label: 'Alertas',    color: '#F59E0B', badge: true },
]

const NAV_MANAGER = [
  { to: '/dashboard',    icon: LayoutDashboard,label: 'Dashboard',  color: '#06B6D4' },
  { to: '/tracker',      icon: Clock,          label: 'Tracker',    color: '#7C4DFF' },
  { to: '/reports',      icon: BarChart2,       label: 'Reportes',   color: '#10B981' },
  { to: '/projects',     icon: Briefcase,       label: 'Proyectos',  color: '#F59E0B' },
  { to: '/clients',      icon: Tag,             label: 'Clientes',   color: '#EC4899' },
  { to: '/team',         icon: Users,           label: 'Equipo',     color: '#8B5CF6' },
  { to: '/notifications',icon: Bell,           label: 'Alertas',    color: '#F59E0B', badge: true },
]

const NAV_ADMIN_EXTRA = [
  { to: '/users',        icon: UserCog,        label: 'Usuarios',   color: '#06B6D4' },
]

export default function Sidebar({ onStartTour }) {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const { user, signOut } = useAuth()
  const { workspace } = useWorkspace()
  const { isManager, isAdmin, unreadCount, role } = useRole()
  const location = useLocation()
  const { resetTour } = useTour()

  const mainNav = isManager
    ? [...NAV_MANAGER, ...(isAdmin ? NAV_ADMIN_EXTRA : [])]
    : NAV_EMPLOYEE

  const filtered = search
    ? mainNav.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : mainNav

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  const W = collapsed ? 52 : 228

  return (
    <aside
      className="relative flex flex-col flex-shrink-0 transition-all duration-200"
      style={{ width: W, background: S.bg, borderRight: `1px solid ${S.border}`, overflow: 'hidden' }}
    >
      {/* ── Workspace header ── */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0"
        style={{ padding: collapsed ? '14px 12px' : '12px 14px', borderBottom: `1px solid ${S.border}`, minHeight: 52 }}
      >
        {collapsed ? (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#7C4DFF' }}>
            <Timer size={14} color="white" />
          </div>
        ) : (
          <>
            <img src="/logo-xul.png" alt="XUL" style={{ height: 26, objectFit: 'contain', flexShrink: 0 }} />
            <span className="flex-1" />
            <ChevronLeft size={13} style={{ color: S.label, flexShrink: 0 }} />
          </>
        )}
      </div>

      {/* ── Search ── */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: S.input, border: `1px solid ${S.border}` }}>
            <Search size={12} style={{ color: S.label, flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent border-none outline-none text-xs flex-1"
              style={{ color: S.text, '::placeholder': { color: S.label } }}
            />
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {!collapsed && (
          <p className="px-2 mb-1 mt-2" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: S.label, textTransform: 'uppercase' }}>
            {isManager ? 'Gestión' : 'Mi trabajo'}
          </p>
        )}

        {filtered.map(({ to, icon: Icon, label, color, badge }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
          const count = badge ? unreadCount : 0
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={`nav-${to.replace('/', '')}`}
              title={collapsed ? label : undefined}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all duration-100 relative group"
              style={{
                background: isActive ? S.active : 'transparent',
                color: isActive ? S.textOn : S.text,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                marginBottom: 1,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = S.hover }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full"
                  style={{ background: S.primary }} />
              )}
              <span className="relative flex-shrink-0">
                <Icon size={15} style={{ color: isActive ? color : S.text }} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background: '#EF4444', fontSize: 8 }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          )
        })}

        {/* Settings */}
        {!collapsed && (
          <p className="px-2 mb-1 mt-3" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: S.label, textTransform: 'uppercase' }}>
            Workspace
          </p>
        )}
        {!collapsed && collapsed === false && <div style={{ height: 1, background: S.border, marginBottom: 6 }} />}
        <NavLink
          to="/settings"
          data-tour="nav-settings"
          title={collapsed ? 'Ajustes' : undefined}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all duration-100"
          style={({ isActive }) => ({
            background: isActive ? S.active : 'transparent',
            color: isActive ? S.textOn : S.text,
            fontSize: 13,
            fontWeight: isActive ? 500 : 400,
            marginBottom: 1,
          })}
          onMouseEnter={e => e.currentTarget.style.background = S.hover}
          onMouseLeave={e => { if (!e.currentTarget.getAttribute('data-active')) e.currentTarget.style.background = 'transparent' }}
        >
          <Settings size={15} style={{ color: S.text, flexShrink: 0 }} />
          {!collapsed && <span>Ajustes</span>}
        </NavLink>
      </nav>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-2 pb-3 pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
        {/* Tutorial */}
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          title={collapsed ? 'Tutorial' : undefined}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all mb-0.5"
          style={{ color: S.label, fontSize: 13, background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = S.hover; e.currentTarget.style.color = S.text }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.label }}
        >
          <HelpCircle size={15} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Tutorial</span>}
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all"
          style={{ color: S.label, fontSize: 13, background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.label }}
        >
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
            style={{ background: '#7C4DFF', fontSize: 9, fontWeight: 700 }}>
            {initials}
          </div>
          {!collapsed && <span className="flex-1 truncate text-left">{user?.email?.split('@')[0]}</span>}
          {!collapsed && <LogOut size={13} style={{ flexShrink: 0, opacity: 0.5 }} />}
        </button>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-14 w-5 h-5 rounded-full flex items-center justify-center z-10 transition-all"
        style={{ background: '#2A2D3A', border: `1px solid ${S.border}`, color: S.label }}
        onMouseEnter={e => e.currentTarget.style.background = '#353849'}
        onMouseLeave={e => e.currentTarget.style.background = '#2A2D3A'}
      >
        {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
      </button>
    </aside>
  )
}
