import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  ChevronLeft, ChevronRight, Timer, Tag, Zap,
  ChevronDown, Hash
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'

const navItems = [
  { to: '/tracker',  icon: Clock,     label: 'Tracker',   color: '#7B68EE' },
  { to: '/reports',  icon: BarChart2, label: 'Reportes',  color: '#FF6BCA' },
  { to: '/projects', icon: Briefcase, label: 'Proyectos', color: '#4FC3F7' },
  { to: '/clients',  icon: Tag,       label: 'Clientes',  color: '#81C784' },
  { to: '/team',     icon: Users,     label: 'Equipo',    color: '#FFB74D' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut } = useAuth()
  const { workspace } = useWorkspace()
  const location = useLocation()

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <aside
      className="relative flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{
        width: collapsed ? 64 : 220,
        background: 'linear-gradient(180deg, #13131F 0%, #1A1A2E 100%)',
        borderRight: '1px solid #2E2E4A',
      }}
    >
      {/* Workspace header */}
      <div
        className="flex items-center gap-2.5 px-3 py-4 cursor-pointer select-none"
        style={{ borderBottom: '1px solid #2E2E4A' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, #1A1A2E 0%, #13131F 100%)', border: '1.5px solid #2E2E4A' }}
        >
          <Timer size={16} style={{ color: '#7B68EE' }} />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate leading-tight">
              {workspace?.name || 'MyTrack'}
            </p>
            <p className="text-xs truncate" style={{ color: '#6B6B8A' }}>
              {user?.email}
            </p>
          </div>
        )}
        {!collapsed && <ChevronDown size={14} style={{ color: '#6B6B8A', flexShrink: 0 }} />}
      </div>

      {/* Nav section */}
      <div className="flex-1 py-3 px-2 space-y-0.5">
        {!collapsed && (
          <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: '#4A4A6A' }}>
            Principal
          </p>
        )}
        {navItems.map(({ to, icon: Icon, label, color }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(107, 78, 255, 0.18)' : 'transparent',
                color: isActive ? '#fff' : '#8888A8',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: color }}
                    />
                  )}
                  <Icon
                    size={17}
                    style={{ color: isActive ? color : '#6B6B8A', flexShrink: 0 }}
                    className="transition-colors group-hover:opacity-100"
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          )
        })}
      </div>

      {/* Bottom */}
      <div className="px-2 pb-3 space-y-0.5" style={{ borderTop: '1px solid #2E2E4A', paddingTop: 12 }}>
        <NavLink
          to="/settings"
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-all"
          style={({ isActive }) => ({
            background: isActive ? 'rgba(107,78,255,0.18)' : 'transparent',
            color: isActive ? '#fff' : '#8888A8',
          })}
        >
          <Settings size={17} style={{ color: '#6B6B8A', flexShrink: 0 }} />
          {!collapsed && <span>Ajustes</span>}
        </NavLink>

        {/* Avatar + signout */}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all group"
          style={{ color: '#6B6B8A' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B6B8A' }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg,#7B68EE,#FF6BCA)' }}
          >
            {initials}
          </div>
          {!collapsed && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-12 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors"
        style={{ background: '#2D2D4A', border: '1px solid #3A3A5A', color: '#8888A8' }}
        onMouseEnter={e => e.currentTarget.style.background = '#3D3D5A'}
        onMouseLeave={e => e.currentTarget.style.background = '#2D2D4A'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
