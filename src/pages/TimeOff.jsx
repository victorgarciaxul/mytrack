import { useState, useEffect } from 'react'
import { CalendarOff, CheckCircle, XCircle, AlertCircle, Plus, X } from 'lucide-react'
import { initDB, dbGetTimeOffRequests, dbGetTimeOffPolicies, dbGetAllMembers, dbCreateTimeOffRequest } from '../lib/db'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  APPROVED:  { label: 'Aprobada',  color: '#10B981', bg: '#10B98118', Icon: CheckCircle },
  PENDING:   { label: 'Pendiente', color: '#F59E0B', bg: '#F59E0B18', Icon: AlertCircle },
  REJECTED:  { label: 'Rechazada', color: '#EF4444', bg: '#EF444418', Icon: XCircle },
  WITHDRAWN: { label: 'Retirada',  color: '#94A3B8', bg: '#94A3B818', Icon: XCircle },
}
const TABS = ['Solicitudes', 'Políticas']
const AVATAR_COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#6366F1','#FF6D00']

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function avatarColor(name) {
  let n = 0; for (const c of (name || '')) n += c.charCodeAt(0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  const { label, color, bg, Icon } = cfg
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, background: bg }}>
      <Icon size={11} style={{ color }} /><span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  )
}
function fmtDate(str) {
  if (!str) return '—'
  try { return format(parseISO(str), "d MMM yyyy", { locale: es }) } catch { return str }
}
function daysBetween(start, end) {
  if (!start || !end) return null
  try { const d = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1; return d > 0 ? d : null }
  catch { return null }
}

export default function TimeOff() {
  const { isAdmin, isManager } = useRole()
  const { user } = useAuth()
  const canManageAll = isAdmin || isManager
  const [requests, setRequests]   = useState([])
  const [policies, setPolicies]   = useState([])
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('Solicitudes')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterUser, setFilterUser]     = useState('ALL')
  const [showForm, setShowForm]   = useState(false)

  // form state
  const [fEmployee, setFEmployee] = useState('')
  const [fPolicy, setFPolicy]     = useState('')
  const [fStart, setFStart]       = useState('')
  const [fEnd, setFEnd]           = useState('')
  const [fNote, setFNote]         = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([
        dbGetTimeOffRequests(),
        dbGetTimeOffPolicies(),
        canManageAll ? dbGetAllMembers() : Promise.resolve([]),
      ]))
      .then(([reqs, pols, mems]) => {
        // Employees only see their own requests
        const filtered = canManageAll
          ? (reqs || [])
          : (reqs || []).filter(r => r.user_email === user?.email)
        setRequests(filtered)
        setPolicies(pols || [])
        setMembers(mems || [])
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
  const approved = requests.filter(r => r.status === 'APPROVED').length
  const pending  = requests.filter(r => r.status === 'PENDING').length

  async function handleCreate(e) {
    e.preventDefault()
    if (!fStart || !fEnd) { toast.error('Elige las fechas'); return }
    setSaving(true)
    try {
      // Admins can pick any member; employees always use their own account
      const member = canManageAll && fEmployee
        ? (members.find(m => m.user_email === fEmployee) || { user_email: fEmployee, user_name: fEmployee })
        : { user_email: user?.email, user_name: user?.user_name || user?.user_metadata?.full_name || user?.email }
      const policy = policies.find(p => p.id === fPolicy)
      const newR = await dbCreateTimeOffRequest({
        userEmail: member.user_email,
        userName:  member.user_name,
        policyId:   policy?.id   || null,
        policyName: policy?.name || null,
        startDate: fStart,
        endDate:   fEnd,
        note:      fNote || null,
      })
      setRequests(prev => [newR, ...prev])
      toast.success('Solicitud creada')
      setFEmployee(''); setFPolicy(''); setFStart(''); setFEnd(''); setFNote(''); setShowForm(false)
    } catch { toast.error('Error al crear solicitud') }
    setSaving(false)
  }

  const selectStyle = { background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--c-text-1)', outline: 'none', cursor: 'pointer' }
  const inputStyle  = { background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', width: '100%' }

  return (
    <div className="page-container" style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Bajas y Vacaciones</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${requests.length} solicitudes · ${policies.length} políticas`}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={15} /> Nueva solicitud
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid #F59E0B40', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 20px rgba(245,158,11,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Nueva solicitud de baja</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: canManageAll ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              {canManageAll && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Empleado</label>
                <select value={fEmployee} onChange={e => setFEmployee(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Mi cuenta</option>
                  {members.map(m => <option key={m.id} value={m.user_email}>{m.user_name || m.user_email}</option>)}
                </select>
              </div>
              )}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Política</label>
                <select value={fPolicy} onChange={e => setFPolicy(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Sin política</option>
                  {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Fecha inicio *</label>
                <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#F59E0B'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Fecha fin *</label>
                <input type="date" value={fEnd} min={fStart} onChange={e => setFEnd(e.target.value)} required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#F59E0B'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nota (opcional)</label>
              <input value={fNote} onChange={e => setFNote(e.target.value)} placeholder="Motivo o comentario…" style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#F59E0B'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
            </div>
            {fStart && fEnd && (
              <p style={{ fontSize: 12, color: '#F59E0B', marginBottom: 14 }}>
                {daysBetween(fStart, fEnd)} días · del {fmtDate(fStart)} al {fmtDate(fEnd)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving || !fStart || !fEnd}
                style={{ padding: '8px 18px', borderRadius: 9, background: '#F59E0B', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!fStart || !fEnd) ? 0.5 : 1 }}>
                {saving ? 'Creando…' : 'Crear solicitud'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--c-border-light)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '9px 18px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#7C4DFF' : 'var(--c-text-3)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #7C4DFF' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>

          {tab === 'Solicitudes' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total solicitudes', value: requests.length, color: '#7C4DFF' },
                  { label: 'Aprobadas',  value: approved, color: '#10B981' },
                  { label: 'Pendientes', value: pending,  color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, padding: '16px 20px' }}>
                    <p style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{s.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {requests.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                  <CalendarOff size={36} style={{ color: 'var(--c-text-4)' }} />
                  <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin solicitudes todavía</p>
                  <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Pulsa «Nueva solicitud» para crear la primera</p>
                </div>
              )}

              {/* Filters + Table — only show when there are requests */}
              {requests.length > 0 && <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                  <option value="ALL">Todos los estados</option>
                  <option value="APPROVED">Aprobadas</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="REJECTED">Rechazadas</option>
                  <option value="WITHDRAWN">Retiradas</option>
                </select>
                {canManageAll && (
                  <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
                    <option value="ALL">Todos los empleados</option>
                    {users.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                )}
                <span style={{ fontSize: 12, color: 'var(--c-text-3)', alignSelf: 'center', marginLeft: 4 }}>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: canManageAll ? '2fr 2fr 90px 1.5fr' : '2fr 90px 1.5fr', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
                  {(canManageAll ? ['Empleado', 'Período', 'Días', 'Estado'] : ['Período', 'Días', 'Estado']).map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
                  ))}
                </div>
                {filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
                ) : filtered.map(r => {
                  const color = avatarColor(r.user_name)
                  const days  = daysBetween(r.start_date, r.end_date)
                  return (
                    <div key={r.id}
                      style={{ display: 'grid', gridTemplateColumns: canManageAll ? '2fr 2fr 90px 1.5fr' : '2fr 90px 1.5fr', padding: '14px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {canManageAll && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '20', border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color }}>{initials(r.user_name)}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>{r.user_name || r.user_email || '—'}</p>
                          {r.policy_name && <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>{r.policy_name}</p>}
                        </div>
                      </div>
                      )}
                      <div>
                        <p style={{ fontSize: 13, color: 'var(--c-text-1)', margin: 0 }}>
                          {r.start_date && r.end_date ? `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}` : fmtDate(r.start_date || r.end_date)}
                        </p>
                        {r.created_at && <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>Solicitado el {fmtDate(r.created_at?.split('T')[0])}</p>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)' }}>{days !== null ? `${days}d` : '—'}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  )
                })}
              </div>
              </>}
            </>
          )}

          {tab === 'Políticas' && (
            <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
              {policies.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '32px 0' }}>Sin políticas de bajas</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
                    {['Política', 'Días / año', 'Color'].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
                    ))}
                  </div>
                  {policies.map(p => (
                    <div key={p.id}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#7C4DFF', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{p.days_per_year ? `${p.days_per_year} días` : '—'}</span>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: p.color || '#7C4DFF' }} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
