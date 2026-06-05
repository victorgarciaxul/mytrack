import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, Calendar, Menu, Download } from 'lucide-react'
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

export default function TopBar({ onMenuClick }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount } = useRole()
  const { isDark, toggle } = useTheme()
  const isMobile = useMediaQuery('(max-width: 768px)')

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
      .then(years => setNeonYears(years?.length ? years : [new Date().getFullYear()]))
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
            <a href="mailto:victorgarcia@xul.es"
              style={{ color: '#C4B5FD', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#C4B5FD'}
            >victorgarcia@xul.es</a>
          </span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Tutorial download link */}
      <a
        href="/tutoriales/MyTrack_Tutorial_Admin.pdf"
        download="MyTrack_Tutorial_Admin.pdf"
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
