import { useNavigate } from 'react-router-dom'
import { Search, Bell, Moon, Sun, MoreHorizontal, Calendar } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRole } from '../../context/RoleContext'
import { useTheme } from '../../context/ThemeContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TopBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount } = useRole()
  const { isDark, toggle } = useTheme()

  const today = format(new Date(), "yyyy", { locale: es })

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
      {/* Search */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--c-bg-muted)', border: '1.5px solid var(--c-border)',
        borderRadius: 10, padding: '8px 14px', maxWidth: 480,
      }}>
        <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--c-text-4)', flex: 1 }}>¿En qué estás trabajando?</span>
        <kbd style={{
          fontSize: 11, color: 'var(--c-text-4)',
          background: 'var(--c-border)', borderRadius: 5,
          padding: '2px 6px', fontFamily: 'inherit',
        }}>/</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Team avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: ['linear-gradient(135deg,#7C4DFF,#E040FB)', 'linear-gradient(135deg,#06B6D4,#3B82F6)', 'linear-gradient(135deg,#F59E0B,#EF4444)'][i],
            border: '2px solid var(--c-bg-surface)',
            marginLeft: i > 0 ? -8 : 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>
            {['VG', 'AM', 'LS'][i]}
          </div>
        ))}
      </div>

      {/* Year */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
        fontSize: 13, color: 'var(--c-text-1)', fontWeight: 500, cursor: 'pointer',
      }}>
        <Calendar size={13} style={{ color: 'var(--c-text-3)' }} />
        {today}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
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

      {/* More */}
      <button style={{
        width: 36, height: 36, borderRadius: 9,
        background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--c-text-3)',
      }}>
        <MoreHorizontal size={15} />
      </button>
    </div>
  )
}
