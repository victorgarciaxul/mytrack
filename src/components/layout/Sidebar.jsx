import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  HelpCircle, ChevronDown, Plus, CalendarDays,
  Bell, LogOut, Smile, Tag, CalendarOff, Building2,
} from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { useTour } from '../tour/AppTour'
import { useTheme } from '../../context/ThemeContext'

function getStoredEmoji(email) {
  try { return localStorage.getItem(`mytrack-emoji-${email}`) || null } catch { return null }
}
function storeEmoji(email, emoji) {
  try { localStorage.setItem(`mytrack-emoji-${email}`, emoji) } catch {}
}

export default function Sidebar({ onStartTour }) {
  const { user, signOut } = useAuth()
  const { workspace, projects } = useWorkspace()
  const { isManager, unreadCount } = useRole()
  const { isDark } = useTheme()
  const location = useLocation()
  const { resetTour } = useTour()

  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState(() => getStoredEmoji(user?.email))
  const [pickerPos, setPickerPos] = useState({ bottom: 80, left: 8 })
  const menuRef = useRef(null)
  const userBtnRef = useRef(null)

  const wsName = workspace?.name || 'MyTrack'
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setEmojiPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openEmojiPicker() {
    if (userBtnRef.current) {
      const rect = userBtnRef.current.getBoundingClientRect()
      setPickerPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
      })
    }
    setEmojiPickerOpen(true)
  }

  function handleEmojiSelect(emoji) {
    storeEmoji(user?.email, emoji)
    setSelectedEmoji(emoji)
    setEmojiPickerOpen(false)
    setMenuOpen(false)
  }

  const generalNav = [
    { to: '/tracker', icon: Clock, label: 'Registro de tiempo', color: '#7C4DFF' },
    { to: '/calendar', icon: CalendarDays, label: 'Calendario', color: '#7C4DFF' },
    ...(isManager ? [{ to: '/reports', icon: BarChart2, label: 'Informes', color: '#7C4DFF' }] : []),
    { to: '/notifications', icon: Bell, label: 'Bandeja de entrada', color: '#7C4DFF', badge: true },
  ]

  const projectNav = [
    { to: '/projects', icon: Briefcase, label: 'Proyectos', color: '#10B981' },
    { to: '/clients', icon: Building2, label: 'Clientes', color: '#03A9F4' },
    { to: '/tags', icon: Tag, label: 'Etiquetas', color: '#E040FB' },
    { to: '/time-off', icon: CalendarOff, label: 'Bajas', color: '#F59E0B' },
    ...(isManager ? [{ to: '/team', icon: Users, label: 'Equipo', color: '#6366F1' }] : []),
  ]

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--c-bg-surface)',
      borderRight: '1px solid var(--c-border-light)',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      overflowX: 'visible', overflowY: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
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
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.3px' }}>MyTrack</span>
        </div>
      </div>

      {/* XUL logo */}
      <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="xul-logo" />
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
              ><Plus size={13} /></button>
            }>Gestión</SectionLabel>
            {projectNav.map(item => (
              <NavItem key={item.to} item={item} location={location} unreadCount={unreadCount} />
            ))}
          </>
        )}

        {projects.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {projects.slice(0, 4).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: p.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 14px 16px', borderTop: '1px solid var(--c-border-light)' }}>
        <NavItem item={{ to: '/settings', icon: Settings, label: 'Configuración', color: 'var(--c-text-3)' }} location={location} unreadCount={0} />
        <button
          onClick={() => { resetTour(); onStartTour?.() }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, marginBottom: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = '#7C4DFF' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)' }}
        >
          <HelpCircle size={15} style={{ flexShrink: 0 }} />
          <span>Centro de ayuda</span>
        </button>

        {/* User button + dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            ref={userBtnRef}
            onClick={() => { setMenuOpen(p => !p); setEmojiPickerOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: selectedEmoji ? 'var(--c-bg-muted)' : 'linear-gradient(135deg,#7C4DFF,#E040FB)',
              border: selectedEmoji ? '1px solid var(--c-border)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: selectedEmoji ? 18 : 10, fontWeight: 700, color: '#fff',
              boxShadow: selectedEmoji ? 'none' : '0 2px 6px rgba(124,77,255,0.3)',
            }}>
              {selectedEmoji || userInitials}
            </div>
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden', minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{userName}</p>
              <p style={{ fontSize: 10, color: 'var(--c-text-3)', margin: 0 }}>EQUIPO</p>
            </div>
            <ChevronDown size={12} style={{ color: 'var(--c-text-3)', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && !emojiPickerOpen && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--c-bg-surface)', borderRadius: 10,
              border: '1px solid var(--c-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              overflow: 'hidden', zIndex: 100,
            }}>
              <MenuItem icon={<Smile size={14} />} label="Cambiar emoji" onClick={openEmojiPicker} />
              <div style={{ height: 1, background: 'var(--c-border-light)', margin: '2px 0' }} />
              <MenuItem icon={<LogOut size={14} />} label="Cerrar sesión" onClick={signOut} danger />
            </div>
          )}

          {/* Emoji picker — fixed to viewport so sidebar overflow doesn't clip it */}
          {menuOpen && emojiPickerOpen && (
            <div style={{
              position: 'fixed',
              bottom: pickerPos.bottom,
              left: pickerPos.left,
              zIndex: 1000,
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.22))',
            }}>
              <Picker
                data={data}
                onEmojiSelect={(e) => handleEmojiSelect(e.native)}
                theme={isDark ? 'dark' : 'light'}
                locale="es"
                previewPosition="none"
                searchPosition="none"
                skinTonePosition="none"
                perLine={9}
                emojiSize={20}
                emojiButtonSize={28}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: danger ? '#EF4444' : 'var(--c-text-1)', textAlign: 'left' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#EF444410' : 'var(--c-bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {icon}{label}
    </button>
  )
}

function SectionLabel({ children, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-4)' }}>
      <span>{children}</span>{extra}
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
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 9, background: isActive ? '#7C4DFF18' : 'transparent', color: isActive ? '#7C4DFF' : 'var(--c-text-2)', fontSize: 13, fontWeight: isActive ? 600 : 400, transition: 'all 0.1s', cursor: 'pointer', position: 'relative' }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-1)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-2)' } }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: isActive ? '#7C4DFF20' : 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}>
          <Icon size={13} style={{ color: isActive ? '#7C4DFF' : 'var(--c-text-3)' }} />
        </div>
        <span style={{ flex: 1 }}>{label}</span>
        {count > 0 && (
          <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
    </NavLink>
  )
}
