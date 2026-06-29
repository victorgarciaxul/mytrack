import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Clock, BarChart2, Briefcase, Users, Settings,
  HelpCircle, ChevronDown, Plus, CalendarDays,
  Bell, LogOut, Tag, CalendarOff, Building2,
  ChevronsLeft, ChevronsRight, X, Check, CircleDollarSign, AlarmClock, Radio,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useRole } from '../../context/RoleContext'
import { getWsId, dbSaveAvatar, dbGetAvatar } from '../../lib/db'
import { useTour } from '../tour/AppTour'
import { useTheme } from '../../context/ThemeContext'
import AppLauncher from './AppLauncher'

// ── Movie character avatars (DiceBear adventurer) ─────────────────
const AVATARS = [
  { id: 'neo',      label: 'Neo',       bg: 'b6e3f4' },
  { id: 'trinity',  label: 'Trinity',   bg: 'c0aede' },
  { id: 'morpheus', label: 'Morpheus',  bg: 'd1d4f9' },
  { id: 'ripley',   label: 'Ripley',    bg: 'ffd5dc' },
  { id: 'frodo',    label: 'Frodo',     bg: 'ffdfbf' },
  { id: 'gandalf',  label: 'Gandalf',   bg: 'b6e3f4' },
  { id: 'aragorn',  label: 'Aragorn',   bg: 'c0aede' },
  { id: 'legolas',  label: 'Legolas',   bg: 'd1d4f9' },
  { id: 'rey',      label: 'Rey',       bg: 'ffd5dc' },
  { id: 'vader',    label: 'Vader',     bg: 'ffdfbf' },
  { id: 'yoda',     label: 'Yoda',      bg: 'b6e3f4' },
  { id: 'indiana',  label: 'Indiana',   bg: 'c0aede' },
  { id: 'marty',    label: 'Marty',     bg: 'd1d4f9' },
  { id: 'joker',    label: 'Joker',     bg: 'ffd5dc' },
  { id: 'batman',   label: 'Batman',    bg: 'ffdfbf' },
  { id: 'tony',     label: 'Tony',      bg: 'b6e3f4' },
  { id: 'natasha',  label: 'Natasha',   bg: 'c0aede' },
  { id: 'thor',     label: 'Thor',      bg: 'd1d4f9' },
  { id: 'sarah',    label: 'Sarah',     bg: 'ffd5dc' },
  { id: 'maximus',  label: 'Maximus',   bg: 'ffdfbf' },
  { id: 'clarice',  label: 'Clarice',   bg: 'b6e3f4' },
  { id: 'vivian',   label: 'Vivian',    bg: 'c0aede' },
  { id: 'leia',     label: 'Leia',      bg: 'd1d4f9' },
  { id: 'oracle',   label: 'Oracle',    bg: 'ffd5dc' },
]

function avatarUrl(id, bg) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${id}&backgroundColor=${bg}&radius=50`
}

function getStoredAvatar(email) {
  try { return localStorage.getItem(`mytrack-avatar-${email}`) || null } catch { return null }
}
function storeAvatar(email, url) {
  try { localStorage.setItem(`mytrack-avatar-${email}`, url) } catch {}
}

// ── Avatar picker panel ───────────────────────────────────────────
function AvatarPickerPanel({ selected, onSelect, onClose, pos, panelRef }) {
  return (
    <div ref={panelRef} style={{
      position: 'fixed',
      bottom: pos.bottom,
      left: pos.left,
      zIndex: 1000,
      background: 'var(--c-bg-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      padding: 14,
      width: pos.width ?? Math.min(280, window.innerWidth - 16),
      maxWidth: 'calc(100vw - 16px)',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)', letterSpacing: '-0.1px' }}>Elige tu avatar</span>
        <button onClick={onClose} style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--c-bg-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}>
          <X size={12} />
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${window.innerWidth < 300 ? 4 : 6}, 1fr)`, gap: 6 }}>
        {AVATARS.map(av => {
          const url = avatarUrl(av.id, av.bg)
          const isSelected = selected === url
          return (
            <button
              key={av.id}
              title={av.label}
              onClick={() => onSelect(url)}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: 10, padding: 0, border: 'none',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
                outline: isSelected ? '2.5px solid #7C4DFF' : '2px solid transparent',
                outlineOffset: 1,
                transition: 'transform 0.1s, outline 0.1s',
                background: `#${av.bg}`,
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={url}
                alt={av.label}
                style={{ width: '100%', height: '100%', display: 'block' }}
                loading="lazy"
              />
              {isSelected && (
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#7C4DFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={9} color="#fff" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Workspace Switcher (admins only) ──────────────────────────────
const WORKSPACES = [
  { id: 'xul-ws-1',       label: 'XUL',       shortLabel: 'X' },
  { id: 'fundacion-ws-1', label: 'Fundación',  shortLabel: 'F' },
]

function WorkspaceSwitcher({ collapsed, user, isAdmin, switchWorkspace, isDark }) {
  // All admins can switch between both workspaces
  if (!isAdmin) return null

  const activeWsId = getWsId()

  // Blue palette matching the topbar gradient
  const activeBg     = 'linear-gradient(135deg, #1D4ED8, #2563EB)'
  const inactiveBg   = isDark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.10)'
  const inactiveClr  = isDark ? '#93C5FD' : '#1D4ED8'
  const inactiveBdr  = isDark ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.28)'
  const hoverBg      = isDark ? 'rgba(37,99,235,0.30)' : 'rgba(37,99,235,0.18)'

  return (
    <div data-tour="workspace-switcher" style={{
      padding: collapsed ? '0 8px 10px' : '0 14px 10px',
      flexShrink: 0,
    }}>
      {!collapsed && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-4)', marginBottom: 5, paddingLeft: 2 }}>
          Espacio
        </div>
      )}
      <div style={{
        display: 'flex',
        gap: 4,
        flexDirection: collapsed ? 'column' : 'row',
      }}>
        {WORKSPACES.map(ws => {
          const active = activeWsId === ws.id
          return (
            <button
              key={ws.id}
              onClick={() => !active && switchWorkspace(ws.id)}
              title={ws.label}
              style={{
                flex: collapsed ? 'none' : 1,
                padding: collapsed ? '6px 0' : '5px 8px',
                borderRadius: 7,
                border: active ? '1.5px solid rgba(37,99,235,0.6)' : `1.5px solid ${inactiveBdr}`,
                background: active ? activeBg : inactiveBg,
                color: active ? '#fff' : inactiveClr,
                fontSize: collapsed ? 10 : 11,
                fontWeight: 700,
                cursor: active ? 'default' : 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
                letterSpacing: collapsed ? '0.02em' : 0,
                boxShadow: active ? '0 2px 8px rgba(37,99,235,0.35)' : 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = inactiveBg }}
            >
              {collapsed ? ws.shortLabel : ws.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────
export default function Sidebar({ onStartTour, mobileOpen, onMobileClose }) {
  const { user, signOut, switchWorkspace } = useAuth()
  const { workspace } = useWorkspace()
  const { isManager, isAdmin, unreadCount, costProjects } = useRole()
  const { isDark } = useTheme()
  const location = useLocation()
  const { resetTour } = useTour()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('mytrack-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(() => getStoredAvatar(user?.email))

  // Load avatar from Supabase on mount (overrides localStorage if DB has a value)
  useEffect(() => {
    if (!user?.email) return
    dbGetAvatar(user.email)
      .then(url => {
        if (url) { storeAvatar(user.email, url); setSelectedAvatar(url) }
      })
      .catch(() => {})
  }, [user?.email])
  const [pickerPos, setPickerPos] = useState({ bottom: 80, left: 8 })
  const menuRef = useRef(null)
  const userBtnRef = useRef(null)
  const pickerRef = useRef(null)

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function toggleCollapsed() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('mytrack-sidebar-collapsed', String(next)) } catch {}
      if (next) { setMenuOpen(false); setAvatarPickerOpen(false) }
      return next
    })
  }

  useEffect(() => {
    function handleClick(e) {
      const inMenu   = menuRef.current   && menuRef.current.contains(e.target)
      const inPicker = pickerRef.current && pickerRef.current.contains(e.target)
      if (!inMenu && !inPicker) {
        setMenuOpen(false)
        setAvatarPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openAvatarPicker() {
    if (userBtnRef.current) {
      const rect = userBtnRef.current.getBoundingClientRect()
      const pickerW = Math.min(280, window.innerWidth - 16)
      // Align to rect.left but clamp so picker stays within viewport
      const rawLeft = isMobile ? 8 : rect.left
      const safeLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - pickerW - 8))
      setPickerPos({ bottom: window.innerHeight - rect.top + 8, left: safeLeft, width: pickerW })
    }
    setAvatarPickerOpen(true)
  }

  function handleAvatarSelect(url) {
    storeAvatar(user?.email, url)
    setSelectedAvatar(url)
    setAvatarPickerOpen(false)
    setMenuOpen(false)
    // Persist to Supabase so it loads on any device
    dbSaveAvatar(user?.email, url).catch(err => {
      console.error('Avatar save error:', err)
      import('react-hot-toast').then(({ default: toast }) => toast.error('No se pudo guardar el avatar en el servidor'))
    })
  }

  // Non-admin users viewing another workspace see a restricted view
  const isGuestViewing = !isAdmin && getWsId() !== (user?.workspace_id || 'xul-ws-1')

  const generalNav = [
    ...(!isGuestViewing ? [{ to: '/tracker',  icon: Clock,        label: 'Registro de tiempo', badge: false }] : []),
    ...(!isGuestViewing ? [{ to: '/calendar', icon: CalendarDays, label: 'Calendario',          badge: false }] : []),
    { to: '/reports', icon: BarChart2, label: 'Informes', badge: false },
    ...(isAdmin && !isGuestViewing ? [{ to: '/overtime', icon: AlarmClock, label: 'Compensación', badge: false }] : []),
    { to: '/notifications', icon: Bell, label: 'Bandeja de entrada', badge: true },
  ]

  const projectNav = [
    { to: '/projects',  icon: Briefcase,   label: 'Proyectos' },
    { to: '/clients',   icon: Building2,   label: 'Clientes'  },
    { to: '/tags',      icon: Tag,         label: 'Etiquetas' },
    { to: '/time-off',  icon: CalendarOff, label: 'Bajas'     },
    { to: '/team', icon: Users, label: 'Equipo' },
    ...((isAdmin || costProjects?.length > 0) ? [{ to: '/costs', icon: CircleDollarSign, label: 'Costes' }] : []),
    ...(isAdmin ? [{ to: '/en-directo', icon: Radio, label: 'En directo' }] : []),
  ]

  const W = collapsed ? 56 : 240

  // Avatar display element
  const avatarEl = selectedAvatar ? (
    <img src={selectedAvatar} alt="avatar" style={{ width: 28, height: 28, borderRadius: 8, display: 'block', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color: '#fff',
      boxShadow: '0 2px 6px rgba(124,77,255,0.3)',
    }}>{userInitials}</div>
  )

  const mobileStyle = isMobile ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 260,
    height: '100vh',
    height: '100dvh',          // iOS Safari: excludes browser chrome
    maxHeight: '-webkit-fill-available',
    borderRadius: '0 14px 14px 0',
    zIndex: 300,
    transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: mobileOpen ? '4px 0 32px rgba(0,0,0,0.18)' : 'none',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } : {}

  return (
    <aside style={{
      width: isMobile ? 0 : W, flexShrink: 0,
      background: 'var(--c-bg-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 14,
      display: 'flex', flexDirection: 'column',
      height: isMobile ? undefined : '100%',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      ...mobileStyle,
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '18px 0 14px' : '18px 20px 14px',
        borderBottom: '1px solid var(--c-border-light)',
        borderRadius: '14px 14px 0 0',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0, overflow: 'hidden',
      }}>
        {!isMobile && collapsed ? (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,77,255,0.3)',
            flexShrink: 0, cursor: 'pointer',
          }} onClick={toggleCollapsed} title="Expandir">
            <ChevronsRight size={16} color="white" strokeWidth={2.5} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              {!isMobile && <AppLauncher />}
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124,77,255,0.3)', flexShrink: 0,
              }}>
                <Clock size={16} color="white" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>MyTrack</span>
            </div>
            {/* Collapse button — desktop only */}
            {!isMobile && (
              <button onClick={toggleCollapsed} title="Contraer"
                style={{ width: 28, height: 28, borderRadius: 8, background: 'none', border: '1.5px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)', flexShrink: 0, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = '#7C4DFF' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
                <ChevronsLeft size={15} strokeWidth={2} />
              </button>
            )}
          </>
        )}
      </div>

      {/* XUL logo */}
      {!collapsed && (
        <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <div className="xul-logo" />
        </div>
      )}
      {collapsed && <div style={{ height: 10, flexShrink: 0 }} />}

      {/* Workspace switcher — XUL admins only */}
      <WorkspaceSwitcher
        collapsed={collapsed}
        user={user}
        isAdmin={isAdmin}
        switchWorkspace={switchWorkspace}
        isDark={isDark}
      />

      {/* Nav */}
      <nav className="no-scrollbar" onClick={onMobileClose} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '4px 8px' : '4px 14px' }}>
        {!collapsed && <SectionLabel>General</SectionLabel>}
        {collapsed && <div style={{ height: 4 }} />}
        {generalNav.map(item => (
          <NavItem key={item.to} item={item} location={location} unreadCount={unreadCount} collapsed={collapsed} />
        ))}
        {projectNav.length > 0 && (
          <>
            {collapsed
              ? <div style={{ height: 4, margin: '4px 0', borderTop: '1px solid var(--c-border-light)' }} />
              : <SectionLabel>Gestión</SectionLabel>
            }
            {projectNav.map(item => (
              <NavItem key={item.to} item={item} location={location} unreadCount={unreadCount} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{
        padding: collapsed ? '10px 8px 14px' : '10px 14px 16px',
        borderTop: '1px solid var(--c-border-light)',
        borderRadius: '0 0 14px 14px', flexShrink: 0,
      }}>
        <div onClick={onMobileClose}>
          <NavItem item={{ to: '/settings', icon: Settings, label: 'Mi cuenta' }} location={location} unreadCount={0} collapsed={collapsed} />
        </div>

        {collapsed ? (
          <button onClick={() => { resetTour(); onStartTour?.() }} title="Centro de ayuda"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 0', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', marginBottom: 8 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = '#7C4DFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)' }}>
            <HelpCircle size={15} />
          </button>
        ) : (
          <button onClick={() => { resetTour(); onStartTour?.() }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, marginBottom: 8 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = '#7C4DFF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)' }}>
            <HelpCircle size={15} style={{ flexShrink: 0 }} /><span>Centro de ayuda</span>
          </button>
        )}

        {/* User button + dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          {collapsed ? (
            <button ref={userBtnRef} onClick={() => { setMenuOpen(p => !p); setAvatarPickerOpen(false) }} title={userName}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}>
              {avatarEl}
            </button>
          ) : (
            <button ref={userBtnRef} onClick={() => { setMenuOpen(p => !p); setAvatarPickerOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}>
              {avatarEl}
              <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden', minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{userName}</p>
                <p style={{ fontSize: 10, color: 'var(--c-text-3)', margin: 0 }}>{getWsId() === 'fundacion-ws-1' ? 'FUNDACIÓN' : 'XUL'}</p>
              </div>
              <ChevronDown size={12} style={{ color: 'var(--c-text-3)', flexShrink: 0, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}

          {/* Dropdown */}
          {menuOpen && !avatarPickerOpen && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)',
              left: collapsed ? 'calc(100% + 8px)' : 0,
              right: collapsed ? 'auto' : 0,
              minWidth: collapsed ? 170 : 'auto',
              background: 'var(--c-bg-surface)', borderRadius: 10,
              border: '1px solid var(--c-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              overflow: 'hidden', zIndex: 100,
            }}>
              <MenuItem icon={
                <div style={{ width: 22, height: 22, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                  {selectedAvatar
                    ? <img src={selectedAvatar} alt="" style={{ width: '100%', height: '100%' }} />
                    : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#7C4DFF,#E040FB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>{userInitials}</div>
                  }
                </div>
              } label="Cambiar avatar" onClick={openAvatarPicker} />
              <div style={{ height: 1, background: 'var(--c-border-light)', margin: '2px 0' }} />
              <MenuItem icon={<LogOut size={14} />} label="Cerrar sesión" onClick={signOut} danger />
            </div>
          )}

          {/* Avatar picker — rendered via portal so sidebar's transform doesn't clip it */}
          {menuOpen && avatarPickerOpen && createPortal(
            <AvatarPickerPanel
              selected={selectedAvatar}
              onSelect={handleAvatarSelect}
              onClose={() => setAvatarPickerOpen(false)}
              pos={pickerPos}
              panelRef={pickerRef}
            />,
            document.body
          )}
        </div>
      </div>
    </aside>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: danger ? '#EF4444' : 'var(--c-text-1)', textAlign: 'left', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? '#EF444410' : 'var(--c-bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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

function NavItem({ item, location, unreadCount, collapsed }) {
  const { to, icon: Icon, label, badge } = item
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
  const count = badge ? unreadCount : 0

  return (
    <NavLink to={to} data-tour={`nav-${to.replace('/', '')}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }} title={collapsed ? label : undefined}>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 9,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '7px 0' : '7px 8px',
          borderRadius: 9,
          background: isActive ? '#7C4DFF18' : 'transparent',
          color: isActive ? '#7C4DFF' : 'var(--c-text-2)',
          fontSize: 13, fontWeight: isActive ? 600 : 400,
          transition: 'all 0.1s', cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-1)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-2)' } }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: isActive ? '#7C4DFF20' : 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Icon size={13} style={{ color: isActive ? '#7C4DFF' : 'var(--c-text-3)' }} />
          {collapsed && count > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && count > 0 && (
          <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
    </NavLink>
  )
}
