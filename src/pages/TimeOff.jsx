import { useState, useEffect } from 'react'
import { CalendarOff, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react'
import { initDB, dbGetTimeOffRequests, dbGetTimeOffPolicies } from '../lib/db'
import { format, parseISO, differenceInBusinessDays } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_CONFIG = {
  APPROVED:  { label: 'Aprobada',  color: '#10B981', bg: '#10B98118', Icon: CheckCircle },
  PENDING:   { label: 'Pendiente', color: '#F59E0B', bg: '#F59E0B18', Icon: AlertCircle },
  REJECTED:  { label: 'Rechazada', color: '#EF4444', bg: '#EF444418', Icon: XCircle },
  WITHDRAWN: { label: 'Retirada',  color: '#94A3B8', bg: '#94A3B818', Icon: XCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const { label, color, bg, Icon } = cfg
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, background: bg }}>
      <Icon size={11} style={{ color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  )
}

export default function TimeOff() {
  const [requests, setRequests] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterUser, setFilterUser] = useState('ALL')

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetTimeOffRequests(), dbGetTimeOffPolicies()]))
      .then(([reqs, pols]) => {
        setRequests(reqs || [])
        setPolicies(pols || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const users = [...new Set(requests.map(r => r.user_name).filter(Boolean))].sort()

  const filtered = requests.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
    if (filterUser !== 'ALL' && r.user_name !== filterUser) return false
    return true
  })

  // Stats
  const approved = requests.filter(r => r.status === 'APPROVED').length
  const pending  = requests.filter(r => r.status === 'PENDING').length

  const selectStyle = {
    background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
    borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--c-text-1)',
    outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Bajas y Vacaciones</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
          {loading ? 'Cargando…' : `${requests.length} solicitudes · ${policies.length} políticas`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : requests.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <CalendarOff size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin solicitudes de baja</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total solicitudes', value: requests.length, color: '#7C4DFF' },
              { label: 'Aprobadas', value: approved, color: '#10B981' },
              { label: 'Pendientes', value: pending, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, padding: '16px 20px' }}>
                <p style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Policies */}
          {policies.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Políticas</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {policies.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#7C4DFF', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{p.name}</span>
                    {p.days_per_year && <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{p.days_per_year} días/año</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="ALL">Todos los estados</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="PENDING">Pendientes</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="WITHDRAWN">Retiradas</option>
            </select>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
              <option value="ALL">Todos los usuarios</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--c-text-3)', alignSelf: 'center', marginLeft: 4 }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', padding: '10px 16px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
              {['Empleado', 'Política', 'Inicio', 'Fin', 'Estado'].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)' }}>{h}</span>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
            ) : filtered.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{r.user_name || r.user_email || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{r.policy_name || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                  {r.start_date ? format(parseISO(r.start_date), 'd MMM yyyy', { locale: es }) : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                  {r.end_date ? format(parseISO(r.end_date), 'd MMM yyyy', { locale: es }) : '—'}
                </span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
