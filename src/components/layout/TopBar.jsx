import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, Calendar, Menu } from 'lucide-react'
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
      height: 60,
      background: 'var(--c-bg-surface)',
      borderBottom: '1px solid var(--c-border-light)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Hamburger – mobile only */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--c-text-3)', flexShrink: 0,
          }}
        >
          <Menu size={17} />
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8,
        background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
      }}>
        <Calendar size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
        <select
          value={currentYear}
          onChange={handleYearChange}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)',
            cursor: 'pointer', padding: 0,
          }}
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={isDark ? 'Tema claro' : 'Tema oscuro'}
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--c-text-3)',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-hover)'; e.currentTarget.style.color = '#7C4DFF' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-3)' }}
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Bell */}
      <button
        onClick={() => navigate('/notifications')}
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', color: 'var(--c-text-3)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#EF4444', border: '1.5px solid var(--c-bg-surface)',
          }} />
        )}
      </button>

    </div>
  )
}
