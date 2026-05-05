import { Bell, CheckCheck, AlertTriangle, BarChart2, CalendarDays, Clock } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const TYPE_CONFIG = {
  unlogged_time: { icon: Clock,         color: '#FF4757', bg: 'rgba(255,71,87,0.08)',  label: 'Tiempo no imputado' },
  budget_warning: { icon: BarChart2,    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Presupuesto' },
  weekly_summary: { icon: CalendarDays, color: '#7C4DFF', bg: 'rgba(123,104,238,0.08)',label: 'Resumen semanal' },
  default:        { icon: Bell,         color: '#7A7F9A', bg: 'rgba(144,144,176,0.08)',label: 'Notificación' },
}

export default function Notifications() {
  const { notifications, markRead, markAllRead, unreadCount } = useRole()

  const unread = notifications.filter(n => !n.read)
  const read   = notifications.filter(n => n.read)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1C1C28' }}>Alertas</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7A7F9A' }}>
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
            style={{ background: 'rgba(123,104,238,0.1)', color: '#7C4DFF', border: '1px solid rgba(123,104,238,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,104,238,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,104,238,0.1)' }}
          >
            <CheckCheck size={14} />
            Marcar todo leído
          </button>
        )}
      </div>

      <div className="px-6 pb-6 space-y-6">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Bell size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: '#3D4060' }}>Sin notificaciones</p>
            <p className="text-sm mt-1" style={{ color: '#7A7F9A' }}>Aquí aparecerán las alertas del equipo</p>
          </div>
        )}

        {unread.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#3D4060' }}>Sin leer</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E5E8EE', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              {unread.map((n, i) => <NotifRow key={n.id} n={n} onRead={markRead} isLast={i === unread.length - 1} />)}
            </div>
          </div>
        )}

        {read.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#9095B0' }}>Leídas</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E5E8EE', opacity: 0.7 }}>
              {read.map((n, i) => <NotifRow key={n.id} n={n} onRead={markRead} isLast={i === read.length - 1} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotifRow({ n, onRead, isLast }) {
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.default
  const Icon = cfg.icon
  const ago = formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es })

  return (
    <div
      className="flex items-start gap-4 px-4 py-4 cursor-pointer transition-colors"
      style={{
        borderBottom: isLast ? 'none' : '1px solid #F0F0F8',
        background: n.read ? 'transparent' : 'rgba(123,104,238,0.03)',
      }}
      onClick={() => !n.read && onRead(n.id)}
      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
      onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(123,104,238,0.03)'}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
        <Icon size={16} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: '#1C1C28' }}>{n.title}</p>
          {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: cfg.color }} />}
        </div>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7090' }}>{n.message}</p>
        <p className="text-xs mt-1.5" style={{ color: '#9095B0' }}>{ago}</p>
      </div>
    </div>
  )
}
