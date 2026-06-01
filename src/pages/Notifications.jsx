import { useState, useEffect } from 'react'
import { Bell, CheckCheck, BarChart2, CalendarDays, Clock, Send, X, Users, ChevronDown } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { initDB, dbGetAllMembers, dbSendNotification } from '../lib/db'
import toast from 'react-hot-toast'

// Only these two users can send notifications
const NOTIF_SENDERS = ['victorgarcia@xul.es', 'carlagarcia@xul.es']

const TYPE_CONFIG = {
  unlogged_time:  { icon: Clock,         color: '#FF4757', bg: 'rgba(255,71,87,0.08)',   label: 'Tiempo no imputado' },
  budget_warning: { icon: BarChart2,     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Presupuesto' },
  weekly_summary: { icon: CalendarDays,  color: '#7C4DFF', bg: 'rgba(123,104,238,0.08)', label: 'Resumen semanal' },
  announcement:   { icon: Bell,          color: '#03A9F4', bg: 'rgba(3,169,244,0.08)',   label: 'Anuncio' },
  default:        { icon: Bell,          color: 'var(--c-text-3)', bg: 'rgba(144,144,176,0.08)', label: 'Notificación' },
}

// ── Compose panel ──────────────────────────────────────────────
function ComposePanel({ senderEmail, senderName, onSent, onClose }) {
  const [members, setMembers]     = useState([])
  const [recipient, setRecipient] = useState('all') // 'all' or member.id
  const [type, setType]           = useState('announcement')
  const [title, setTitle]         = useState('')
  const [message, setMessage]     = useState('')
  const [sending, setSending]     = useState(false)

  useEffect(() => {
    initDB()
      .then(() => dbGetAllMembers())
      .then(all => setMembers(all.filter(m => m.user_email !== senderEmail)))
      .catch(console.error)
  }, [senderEmail])

  async function handleSend(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSending(true)
    try {
      const recipientIds = recipient === 'all'
        ? members.map(m => m.id)
        : [recipient]
      if (recipientIds.length === 0) { toast.error('No hay destinatarios'); setSending(false); return }
      await dbSendNotification({ senderEmail, senderName, recipientIds, type, title: title.trim(), message: message.trim() })
      toast.success(`Notificación enviada a ${recipient === 'all' ? 'todo el equipo' : members.find(m => m.id === recipient)?.user_name || 'destinatario'}`)
      onSent()
    } catch { toast.error('Error al enviar') }
    setSending(false)
  }

  const inputStyle = { background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ background: 'var(--c-bg-surface)', border: '1px solid #7C4DFF30', borderRadius: 14, padding: '20px', marginBottom: 20, boxShadow: '0 4px 20px rgba(124,77,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#7C4DFF18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={13} style={{ color: '#7C4DFF' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>Nueva notificación</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex' }}><X size={16} /></button>
      </div>

      <form onSubmit={handleSend}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Recipient */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Destinatario</label>
            <select value={recipient} onChange={e => setRecipient(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="all">Todo el equipo ({members.length})</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.user_name}</option>)}
            </select>
          </div>
          {/* Type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="announcement">📢 Anuncio</option>
              <option value="unlogged_time">⏱ Tiempo no imputado</option>
              <option value="budget_warning">📊 Presupuesto</option>
              <option value="weekly_summary">📋 Resumen semanal</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Título *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Asunto de la notificación" style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#7C4DFF'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Mensaje</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Detalle opcional…" rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = '#7C4DFF'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={sending || !title.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: '#7C4DFF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !title.trim() ? 0.5 : 1 }}>
            <Send size={13} />
            {sending ? 'Enviando…' : `Enviar${recipient === 'all' ? ` a todos (${members.length})` : ''}`}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function Notifications() {
  const { notifications, markRead, markAllRead, unreadCount, loadNotifications } = useRole()
  const { user } = useAuth()
  const [showCompose, setShowCompose] = useState(false)

  const canSend = NOTIF_SENDERS.includes(user?.email)
  const unread  = notifications.filter(n => !n.read)
  const read    = notifications.filter(n => n.read)

  function handleSent() {
    setShowCompose(false)
    // Reload notifications for the sender too (in case they sent to themselves)
    loadNotifications?.()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <span className="text-xs" style={{ color: 'var(--c-text-3)' }}>
          {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canSend && (
            <button
              onClick={() => setShowCompose(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
              style={{ background: showCompose ? '#7C4DFF' : 'rgba(123,104,238,0.1)', color: showCompose ? '#fff' : '#7C4DFF', border: '1px solid rgba(123,104,238,0.2)' }}
              onMouseEnter={e => { if (!showCompose) e.currentTarget.style.background = 'rgba(123,104,238,0.18)' }}
              onMouseLeave={e => { if (!showCompose) e.currentTarget.style.background = 'rgba(123,104,238,0.1)' }}
            >
              <Send size={13} />
              Enviar notificación
            </button>
          )}
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
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Compose panel */}
        {showCompose && canSend && (
          <div style={{ marginTop: 20 }}>
            <ComposePanel
              senderEmail={user.email}
              senderName={user.user_metadata?.full_name || user.email.split('@')[0]}
              onSent={handleSent}
              onClose={() => setShowCompose(false)}
            />
          </div>
        )}

        {notifications.length === 0 && !showCompose && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Bell size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--c-text-2)' }}>Sin notificaciones</p>
            <p className="text-sm mt-1" style={{ color: 'var(--c-text-3)' }}>Aquí aparecerán las alertas del equipo</p>
          </div>
        )}

        {unread.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--c-text-2)' }}>Sin leer</p>
            <div className="rounded-lg overflow-hidden" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              {unread.map((n, i) => <NotifRow key={n.id} n={n} onRead={markRead} isLast={i === unread.length - 1} />)}
            </div>
          </div>
        )}

        {read.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--c-text-3)' }}>Leídas</p>
            <div className="rounded-lg overflow-hidden" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', opacity: 0.7 }}>
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
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--c-border-light)', background: n.read ? 'transparent' : 'rgba(123,104,238,0.03)' }}
      onClick={() => !n.read && onRead(n.id)}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
      onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(123,104,238,0.03)'}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
        <Icon size={16} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text-1)' }}>{n.title}</p>
          {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: cfg.color }} />}
        </div>
        {n.message && <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-text-2)' }}>{n.message}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {n.sender_name && <span style={{ fontSize: 10, color: 'var(--c-text-4)', fontWeight: 600 }}>de {n.sender_name}</span>}
          <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>{ago}</p>
        </div>
      </div>
    </div>
  )
}
