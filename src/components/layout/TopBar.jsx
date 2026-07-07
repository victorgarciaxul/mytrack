import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, Calendar, Menu, Download, Smartphone, X } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAuth } from '../../context/AuthContext'
import { useRole } from '../../context/RoleContext'
import { useTheme } from '../../context/ThemeContext'
import { loadClockifyCache, isClockifyUser } from '../../lib/clockify'
import { initDB, dbGetAvailableYears } from '../../lib/db'

const YEAR_KEY = 'mytrack-selected-year'

export function getSelectedYear() {
  const saved = localStorage.getItem(YEAR_KEY)
  return saved ? Number(saved) : new Date().getFullYear()
}

function InstallModal({ onClose }) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)

  const steps = isIOS ? [
    { icon: '1', text: 'Abre esta página en **Safari** (no Chrome ni Firefox)' },
    { icon: '2', text: 'Pulsa el botón de **compartir** (cuadrado con flecha ↑) en la barra inferior' },
    { icon: '3', text: 'Desplázate y pulsa **"Añadir a pantalla de inicio"**' },
    { icon: '4', text: 'Ponle el nombre **MyTrack** y pulsa **Añadir**' },
  ] : isAndroid ? [
    { icon: '1', text: 'Abre esta página en **Chrome**' },
    { icon: '2', text: 'Pulsa el menú de los **tres puntos** (arriba a la derecha)' },
    { icon: '3', text: 'Pulsa **"Añadir a pantalla de inicio"** o **"Instalar app"**' },
    { icon: '4', text: 'Confirma pulsando **Instalar**' },
  ] : [
    { icon: '📱', text: '**iPhone / iPad:** Abre en Safari → Compartir → "Añadir a pantalla de inicio"' },
    { icon: '🤖', text: '**Android:** Abre en Chrome → Menú ⋮ → "Añadir a pantalla de inicio"' },
  ]

  const device = isIOS ? '📱 iPhone / iPad' : isAndroid ? '🤖 Android' : '📱 Móvil'

  function renderText(text) {
    const parts = text.split(/\*\*(.*?)\*\*/)
    return parts.map((p, i) => i % 2 === 1
      ? <strong key={i}>{p}</strong>
      : <span key={i}>{p}</span>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'Inter, system-ui, sans-serif',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--c-bg-surface, #1e1b2e)',
        borderRadius: 18, padding: '28px 28px 24px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        border: '1px solid rgba(124,77,255,0.2)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg,#7C4DFF,#5C35CC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Smartphone size={18} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1,#fff)', margin: 0 }}>Instalar MyTrack</p>
              <p style={{ fontSize: 11, color: 'var(--c-text-3,#aaa)', margin: 0 }}>Como app en tu {device}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3,#aaa)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                minWidth: 26, height: 26, borderRadius: 8,
                background: 'rgba(124,77,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#7C4DFF', flexShrink: 0,
              }}>{s.icon}</div>
              <p style={{ fontSize: 13, color: 'var(--c-text-2,#ccc)', margin: 0, lineHeight: 1.5 }}>
                {renderText(s.text)}
              </p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          background: 'rgba(124,77,255,0.08)', borderRadius: 10, padding: '10px 14px',
          border: '1px solid rgba(124,77,255,0.15)',
        }}>
          <p style={{ fontSize: 12, color: 'var(--c-text-3,#aaa)', margin: 0, lineHeight: 1.5 }}>
            ✅ Una vez instalada se abre a <strong>pantalla completa</strong>, sin barra del navegador, y se actualiza automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function TopBar({ onMenuClick }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount, isAdmin } = useRole()
  const { isDark, toggle } = useTheme()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [showInstall, setShowInstall] = useState(false)

  // Years from Clockify cache (owner only) or Neon (everyone else)
  const cacheYears = useMemo(() => {
    if (!isClockifyUser(user?.email)) return null
    const cache = loadClockifyCache()
    if (cache?.entries?.length) {
      const years = new Set(cache.entries.filter(e => e.start_time).map(e => new Date(e.start_time).getFullYear()))
      return [...years].sort((a, b) => b - a)
    }
    return null
  }, [user?.email])

  const [neonYears, setNeonYears] = useState(null)

  useEffect(() => {
    if (cacheYears || !user?.email) return
    initDB()
      .then(() => dbGetAvailableYears(user.email))
      .then(years => {
        const currentYear = new Date().getFullYear()
        const all = years?.length ? years : []
        setNeonYears(all.includes(currentYear) ? all : [currentYear, ...all])
      })
      .catch(() => setNeonYears([new Date().getFullYear()]))
  }, [user?.email, cacheYears])

  const availableYears = cacheYears || neonYears || [new Date().getFullYear()]
  const currentYear = getSelectedYear()

  function handleYearChange(e) {
    localStorage.setItem(YEAR_KEY, e.target.value)
    window.location.reload()
  }

  return (
    <div style={{
      height: 52,
      background: 'linear-gradient(90deg, #7C4DFF 0%, #5C35CC 100%)',
      borderBottom: '1px solid #5C35CC',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
      flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Hamburger – mobile only */}
      {isMobile && (
        <button onClick={onMenuClick} style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', flexShrink: 0,
        }}>
          <Menu size={16} />
        </button>
      )}

      {/* Welcome + support */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 700 }}>👋 Bienvenido a MyTrack</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            ¿Necesitas ayuda?{' '}
            <a href="mailto:tech@xul.es"
              style={{ color: '#C4B5FD', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#C4B5FD'}
            >tech@xul.es</a>
          </span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Install app button */}
      <button
        onClick={() => setShowInstall(true)}
        title="Instalar como app en el móvil"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, color: '#fff', fontWeight: 600,
          background: 'rgba(255,255,255,0.13)',
          padding: '5px 12px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.25)',
          whiteSpace: 'nowrap', flexShrink: 0,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
      >
        <Smartphone size={12} />
        {!isMobile && 'Instalar app'}
      </button>

      {/* Tutorial download link — role-specific */}
      <a
        href={isAdmin ? '/tutoriales/MyTrack_Tutorial_Admin.pdf' : '/tutoriales/MyTrack_Tutorial_Empleado.pdf'}
        download={isAdmin ? 'MyTrack_Tutorial_Admin.pdf' : 'MyTrack_Tutorial_Empleado.pdf'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, color: '#fff', fontWeight: 600,
          textDecoration: 'none',
          background: 'rgba(255,255,255,0.13)',
          padding: '5px 12px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.25)',
          whiteSpace: 'nowrap', flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
      >
        <Download size={12} />
        {!isMobile && 'Descarga aquí el tutorial de MyTrack'}
        {isMobile && 'Tutorial'}
      </a>

      {!isMobile && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}

      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
      }}>
        <Calendar size={12} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
        <select
          value={currentYear}
          onChange={handleYearChange}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 12.5, fontWeight: 600, color: '#fff',
            cursor: 'pointer', padding: 0,
          }}
        >
          {availableYears.map(y => (
            <option key={y} value={y} style={{ color: '#1F2937', background: '#fff' }}>{y}</option>
          ))}
        </select>
      </div>

      {/* Theme toggle */}
      <button onClick={toggle} title={isDark ? 'Tema claro' : 'Tema oscuro'} style={{
        width: 34, height: 34, borderRadius: 8,
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#fff', transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Install modal */}
      {showInstall && <InstallModal onClose={() => setShowInstall(false)} />}

      {/* Bell */}
      <button onClick={() => navigate('/notifications')} style={{
        width: 34, height: 34, borderRadius: 8,
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', color: '#fff',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#FCD34D', border: '1.5px solid #7C4DFF',
          }} />
        )}
      </button>

    </div>
  )
}
