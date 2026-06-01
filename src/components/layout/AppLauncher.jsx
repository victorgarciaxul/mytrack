import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import {
  LayoutGrid, Clock, BarChart2, MessageSquare,
  FileCode, Users, TrendingUp, Leaf, RefreshCw, Bot,
} from 'lucide-react'

const ALL_APPS = [
  { href: 'https://mytrack.xul.es',  label: 'MyTrack',        icon: Clock,        color: '#6366F1', bg: '#6366F1', internal: true },
  { href: 'https://xultech.xul.es',  label: 'Xul Tech',       icon: BarChart2,    color: '#7C4DFF', bg: '#7C4DFF' },
  { href: 'https://deeptalk.xul.es', label: 'DeepTalk',        icon: MessageSquare,color: '#10B981', bg: '#10B981' },
  { href: 'https://briefing.xul.es', label: 'Briefing',        icon: Bot,          color: '#8B5CF6', bg: '#8B5CF6' },
  { href: 'https://crm.xul.es',      label: 'CRM XUL',         icon: Users,        color: '#06B6D4', bg: '#06B6D4' },
  { href: 'https://ecofin.xul.es',   label: 'EcoFin',          icon: TrendingUp,   color: '#059669', bg: '#059669' },
  { href: 'https://prompts.xul.es',  label: 'Systems Prompt',  icon: FileCode,     color: '#F59E0B', bg: '#F59E0B' },
  { href: 'https://bcorp.xul.es',    label: 'B Corp',          icon: Leaf,         color: '#14B8A6', bg: '#14B8A6' },
  { href: 'https://giros.xul.es',    label: 'Giros',           icon: RefreshCw,    color: '#F97316', bg: '#F97316' },
]

export default function AppLauncher() {
  const [open, setOpen]       = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const btnRef                = useRef(null)
  const panelRef              = useRef(null)
  const location              = useLocation()

  // Calculate panel position from button bounds
  const recalc = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPanelPos({ top: r.bottom + 8, left: r.left })
  }, [])

  function handleToggle() {
    recalc()
    setOpen(p => !p)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (
        !btnRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on navigation
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)
    return () => {
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [open, recalc])

  function go(app) {
    if (app.internal) { setOpen(false); return }
    window.open(app.href, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: panelPos.top,
        left: panelPos.left,
        zIndex: 99999,
        background: 'rgba(10, 10, 20, 0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04)',
        padding: 14,
        width: 252,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 12px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
          Apps XUL
        </span>
        <a
          href="https://appcenter.xul.es"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          style={{ fontSize: 10, color: '#A78BFA', textDecoration: 'none', fontWeight: 600 }}
        >
          Ver todas →
        </a>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {ALL_APPS.map(app => {
          const Icon     = app.icon
          const isActive = app.internal
          return (
            <button
              key={app.href}
              onClick={() => go(app)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '10px 4px',
                borderRadius: 12,
                border: isActive ? `1.5px solid ${app.color}70` : '1.5px solid rgba(255,255,255,0.07)',
                background: isActive ? app.color + '2a' : 'rgba(255,255,255,0.05)',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = app.color + '22'
                  e.currentTarget.style.borderColor = app.color + '55'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                }
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: isActive ? app.bg : app.bg + '28',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isActive ? `0 4px 16px ${app.color}55` : 'none',
                transition: 'all 0.12s',
              }}>
                <Icon size={18} color={isActive ? '#fff' : app.color} />
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                textAlign: 'center', lineHeight: 1.2,
              }}>
                {app.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        data-tour="app-launcher"
        onClick={handleToggle}
        title="Apps XUL"
        style={{
          width: 32, height: 32,
          borderRadius: 8,
          border: '1px solid var(--c-border)',
          background: open ? '#7C4DFF18' : 'var(--c-bg-muted)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#7C4DFF' : 'var(--c-text-3)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#7C4DFF18'; e.currentTarget.style.color = '#7C4DFF' }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'var(--c-bg-muted)'
            e.currentTarget.style.color = 'var(--c-text-3)'
          }
        }}
      >
        <LayoutGrid size={15} />
      </button>

      {open && createPortal(panel, document.body)}
    </div>
  )
}
