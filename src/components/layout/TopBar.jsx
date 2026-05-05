import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Sun, MoreHorizontal, Calendar } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRole } from '../../context/RoleContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TopBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount, members } = useRole()
  const { workspace } = useWorkspace()

  const today = format(new Date(), "yyyy", { locale: es })
  const initials = (user?.user_metadata?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      height: 60,
      background: '#FFFFFF',
      borderBottom: '1px solid #F0F0F5',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      flexShrink: 0,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Search / timer input */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
        background: '#F8F8FD', border: '1.5px solid #EDEDF8',
        borderRadius: 10, padding: '8px 14px', maxWidth: 480,
      }}>
        <Search size={14} style={{ color: '#B0B5CC', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#B0B5CC', flex: 1 }}>¿En qué estás trabajando?</span>
        <kbd style={{
          fontSize: 11, color: '#B0B5CC',
          background: '#EDEDF8', borderRadius: 5,
          padding: '2px 6px', fontFamily: 'inherit',
        }}>/</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Team avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[...Array(Math.min(3, 3))].map((_, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: ['linear-gradient(135deg,#7C4DFF,#E040FB)', 'linear-gradient(135deg,#06B6D4,#3B82F6)', 'linear-gradient(135deg,#F59E0B,#EF4444)'][i],
            border: '2px solid #fff',
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
        background: '#F8F8FD', border: '1px solid #EDEDF8',
        fontSize: 13, color: '#1A1A2E', fontWeight: 500, cursor: 'pointer',
      }}>
        <Calendar size={13} style={{ color: '#9095B0' }} />
        {today}
      </button>

      {/* Bell */}
      <button
        onClick={() => navigate('/notifications')}
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: '#F8F8FD', border: '1px solid #EDEDF8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', color: '#9095B0',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#F0F0FA'}
        onMouseLeave={e => e.currentTarget.style.background = '#F8F8FD'}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#EF4444', border: '1.5px solid #fff',
          }} />
        )}
      </button>

      {/* More */}
      <button style={{
        width: 36, height: 36, borderRadius: 9,
        background: '#F8F8FD', border: '1px solid #EDEDF8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#9095B0',
      }}>
        <MoreHorizontal size={15} />
      </button>
    </div>
  )
}
