import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  Plus, Trash2, ChevronDown, ChevronUp, Users, User, X
} from 'lucide-react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { initDB, sql, dbGetCompensations, dbAddCompensation, dbDeleteCompensation, dbGetWeeklyHours, getWsId } from '../lib/db'
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  parseISO, startOfYear, endOfYear, startOfDay, endOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'

const STANDARD_HOURS = 37.5

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtH(h) {
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  return `${h < 0 ? '-' : ''}${hh}h ${mm.toString().padStart(2, '0')}m`
}
function fmtHShort(h) {
  if (Math.abs(h) < 0.01) return '0h'
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  return `${h < 0 ? '-' : '+'}${hh}${mm > 0 ? `:${mm.toString().padStart(2, '0')}` : ''}h`
}
// Monday of the ISO week for a Date
function weekMonday(d) {
  return startOfWeek(d, { weekStartsOn: 1 })
}
function weekKey(d) {
  return format(weekMonday(d), 'yyyy-MM-dd')
}
function weekLabel(iso) {
  const d = parseISO(iso)
  const end = endOfWeek(d, { weekStartsOn: 1 })
  return `${format(d, 'd MMM', { locale: es })} – ${format(end, 'd MMM', { locale: es })}`
}

// ── Balance card ─────────────────────────────────────────────────────────────
function BalanceCard({ label, value, color, sub, icon: Icon }) {
  return (
    <div style={{
      background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160,
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Add compensation modal ────────────────────────────────────────────────────
function AddCompModal({ members, onAdd, onClose, loading }) {
  const [email, setEmail] = useState('')
  const [week, setWeek] = useState(weekKey(subWeeks(new Date(), 1)))
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!email || !hours || isNaN(parseFloat(hours))) return
    onAdd({ userEmail: email, weekStart: week, compHours: parseFloat(hours), notes })
  }

  // Generate last 12 weeks
  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subWeeks(new Date(), i + 1)
    const key = weekKey(d)
    return { key, label: weekLabel(key) }
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--c-bg-surface)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)' }}>Registrar compensación</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
            Persona
            <select value={email} onChange={e => setEmail(e.target.value)} required style={selectStyle}>
              <option value=''>Seleccionar…</option>
              {members.map(m => <option key={m.user_email} value={m.user_email}>{m.user_name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
            Semana compensada
            <select value={week} onChange={e => setWeek(e.target.value)} style={selectStyle}>
              {weekOptions.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
            Horas compensadas
            <div style={{ position: 'relative' }}>
              <input
                type='number' step='0.25' min='0.25' max='40'
                value={hours} onChange={e => setHours(e.target.value)}
                placeholder='Ej: 5.5'
                required
                style={{ ...inputStyle, paddingRight: 32 }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--c-text-4)' }}>h</span>
            </div>
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
            Nota (opcional)
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder='Motivo o acuerdo…'
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type='button' onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type='submit' disabled={loading} style={btnPrimary}>
              {loading ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Overtime() {
  const { user } = useAuth()
  const { isAdmin, isManager, role } = useRole()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const myEmail = user?.email

  const [loading, setLoading]     = useState(true)
  const [members, setMembers]     = useState([])
  const [weeklyRaw, setWeeklyRaw] = useState([])
  const [comps, setComps]         = useState([])
  // admins default to team view, employees only see their own
  const [viewMode, setViewMode]   = useState(() => isAdmin ? 'team' : 'mine')
  const [filterUser, setFilterUser] = useState('all')
  const [expandedUser, setExpandedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]       = useState(false)
  // Date range — default: last 13 weeks
  const [rangeBounds, setRangeBounds] = useState(() => ({
    from: startOfDay(subWeeks(new Date(), 13)),
    to:   endOfDay(new Date()),
  }))

  // Sync viewMode once role is loaded
  useEffect(() => {
    if (role !== null) setViewMode(isAdmin ? 'team' : 'mine')
  }, [role, isAdmin])

  // Load all data
  async function load() {
    setLoading(true)
    try {
      await initDB()
      const db = sql()
      const [mems, compsAll] = await Promise.all([
        db`SELECT id, user_name, user_email, group_name FROM workspace_members WHERE workspace_id = ${getWsId()} ORDER BY user_name`,
        dbGetCompensations(null), // all users
      ])
      setMembers(mems)
      setComps(compsAll)

      // Weekly hours: last 52 weeks + current
      const from = format(subWeeks(new Date(), 52), 'yyyy-MM-dd')
      const to   = format(addWeeks(new Date(), 1), 'yyyy-MM-dd')
      const weekly = await dbGetWeeklyHours(null, from, to)
      setWeeklyRaw(weekly)
    } catch(e) {
      console.error('Overtime load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Build per-user data ──────────────────────────────────────────────────
  const userData = useMemo(() => {
    const map = {}

    // Group weekly hours per user per week — filtered by rangeBounds
    weeklyRaw.forEach(row => {
      const email = row.user_email
      const wk = typeof row.week_start === 'string'
        ? row.week_start.slice(0, 10)
        : format(new Date(row.week_start), 'yyyy-MM-dd')
      const wkDate = parseISO(wk)
      if (wkDate < rangeBounds.from || wkDate > rangeBounds.to) return  // outside range
      const h = parseFloat(row.total_seconds) / 3600

      if (!map[email]) map[email] = { email, weeks: {} }
      map[email].weeks[wk] = (map[email].weeks[wk] || 0) + h
    })

    // Add comp entries — also filtered by range
    comps.forEach(c => {
      const email = c.user_email
      const wkDate = parseISO(c.week_start)
      if (wkDate < rangeBounds.from || wkDate > rangeBounds.to) return
      if (!map[email]) map[email] = { email, weeks: {} }
      map[email].compEntries = map[email].compEntries || []
      map[email].compEntries.push(c)
    })

    // Compute balances per user
    return Object.entries(map).map(([email, data]) => {
      const mb = members.find(m => m.user_email === email)
      const name = mb?.user_name || email
      const group = mb?.group_name || ''

      const weekEntries = Object.entries(data.weeks || {}).map(([wk, h]) => {
        const overtime = Math.max(0, h - STANDARD_HOURS)
        const compEntries = (data.compEntries || []).filter(c => c.week_start === wk)
        const compUsed = compEntries.reduce((s, c) => s + parseFloat(c.comp_hours), 0)
        return { wk, h, overtime, compUsed, compEntries, diff: h - STANDARD_HOURS }
      }).sort((a, b) => b.wk.localeCompare(a.wk))

      // ACUMULADO = total extra hours in range
      const acumulado = weekEntries.reduce((s, w) => s + w.overtime, 0)
      // COMPENSADO = total comp hours used in range
      const compensado = (data.compEntries || []).reduce((s, c) => s + parseFloat(c.comp_hours), 0)
      // DEBIDO = what's still owed (acumulado - compensado)
      const debido = acumulado - compensado

      return { email, name, group, weekEntries, acumulado, compensado, debido,
        // keep old names for compat
        totalOvertime: acumulado, totalCompUsed: compensado, balance: debido }
    }).sort((a, b) => b.debido - a.debido)
  }, [weeklyRaw, comps, members, rangeBounds])

  const myData = useMemo(() => userData.find(u => u.email === myEmail), [userData, myEmail])

  // Filter for team view
  const filteredTeam = useMemo(() => {
    if (filterUser === 'all') return userData
    return userData.filter(u => u.email === filterUser)
  }, [userData, filterUser])

  async function handleAddComp(data) {
    setSaving(true)
    try {
      await dbAddCompensation({ ...data, createdBy: myEmail })
      await load()
      setShowModal(false)
    } catch(e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteComp(id) {
    if (!confirm('¿Eliminar esta compensación?')) return
    try {
      await dbDeleteCompensation(id)
      await load()
    } catch(e) { console.error(e) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #7C4DFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const showTeamView = isAdmin && viewMode === 'team'

  return (
    <div className='page-container' style={{ padding: isMobile ? '14px' : '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.5px' }}>
            Compensación de horas
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--c-text-4)' }}>
            Semana estándar: {STANDARD_HOURS}h · Las horas extra se acumulan y pueden compensarse
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date range picker */}
          <DateRangePicker
            from={rangeBounds.from}
            to={rangeBounds.to}
            onChange={({ from, to }) => setRangeBounds({ from, to })}
          />
          {/* View toggle admin */}
          {isAdmin && (
            <div style={{ display: 'flex', background: 'var(--c-bg-muted)', borderRadius: 9, padding: 3, gap: 2 }}>
              {[['mine', 'Mis horas', User], ['team', 'Equipo', Users]].map(([v, l, Icon]) => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: viewMode === v ? 'var(--c-bg-surface)' : 'transparent',
                  color: viewMode === v ? 'var(--c-text-1)' : 'var(--c-text-4)',
                  border: viewMode === v ? '1px solid var(--c-border-light)' : '1px solid transparent',
                  boxShadow: viewMode === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                  <Icon size={13} />{!isMobile && l}
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
            <button onClick={() => setShowModal(true)} style={btnPrimary}>
              <Plus size={14} /> Registrar compensación
            </button>
          )}
        </div>
      </div>

      {/* ── MY VIEW ─────────────────────────────────────────────────────── */}
      {!showTeamView && (
        <>
          {/* Balance cards: ACUMULADO / COMPENSADO / DEBIDO */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <BalanceCard
              icon={TrendingUp} label='ACUMULADO'
              value={myData ? fmtHShort(myData.acumulado) : '0h'}
              color='#7C4DFF'
              sub='Horas extra generadas en el período'
            />
            <BalanceCard
              icon={CheckCircle2} label='COMPENSADO'
              value={myData ? fmtHShort(myData.compensado) : '0h'}
              color='#10B981'
              sub='Horas ya disfrutadas / descontadas'
            />
            <BalanceCard
              icon={myData?.debido > 0 ? TrendingUp : myData?.debido < 0 ? TrendingDown : CheckCircle2}
              label='DEBIDO'
              value={myData ? fmtHShort(myData.debido) : '0h'}
              color={!myData || myData.debido === 0 ? '#10B981' : myData.debido > 0 ? '#F59E0B' : '#EF4444'}
              sub={myData?.debido > 0 ? 'Pendiente de compensar' : myData?.debido < 0 ? 'Por debajo del estándar' : 'Al día'}
            />
          </div>

          {/* Weekly table */}
          <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>Detalle semanal</span>
              <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Últimas semanas</span>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 80px 80px 80px 80px 1fr', padding: '8px 18px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
              {['Semana', 'Horas', !isMobile && 'Estándar', 'Extra', !isMobile && 'Comp.', !isMobile && 'Notas'].filter(Boolean).map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
              ))}
            </div>

            {!myData || myData.weekEntries.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>
                No hay registros de horas aún
              </div>
            ) : myData.weekEntries.slice(0, 20).map(row => (
              <WeekRow key={row.wk} row={row} isMobile={isMobile} isAdmin={isAdmin} onDeleteComp={handleDeleteComp} />
            ))}
          </div>
        </>
      )}

      {/* ── TEAM VIEW (admin only) ───────────────────────────────────────── */}
      {showTeamView && (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...selectStyle, maxWidth: 220 }}>
              <option value='all'>Todos los miembros</option>
              {members.map(m => <option key={m.user_email} value={m.user_email}>{m.user_name}</option>)}
            </select>
            <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>{filteredTeam.filter(u => u.balance > 0).length} personas con horas pendientes</span>
          </div>

          {/* Team table */}
          <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 70px 70px' : '1fr 110px 110px 110px', padding: '10px 18px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
              {['Persona', 'Acumulado', !isMobile && 'Compensado', 'Debido'].filter(Boolean).map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
              ))}
            </div>

            {filteredTeam.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>No hay datos</div>
            ) : filteredTeam.map(u => (
              <UserRow
                key={u.email} u={u} isMobile={isMobile}
                expanded={expandedUser === u.email}
                onToggle={() => setExpandedUser(expandedUser === u.email ? null : u.email)}
                onDeleteComp={handleDeleteComp}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <AddCompModal
          members={members}
          onAdd={handleAddComp}
          onClose={() => setShowModal(false)}
          loading={saving}
        />
      )}
    </div>
  )
}

// ── Week row (my view) ────────────────────────────────────────────────────────
function WeekRow({ row, isMobile, isAdmin, onDeleteComp }) {
  const isOver = row.diff > 0.1
  const isUnder = row.diff < -0.1
  const hasComp = row.compUsed > 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 80px 80px 80px 80px 1fr',
      padding: '10px 18px',
      borderBottom: '1px solid var(--c-border-light)',
      alignItems: 'center',
      background: isOver ? '#F59E0B08' : hasComp ? '#10B98108' : 'transparent',
    }}>
      <span style={{ fontSize: 13, color: 'var(--c-text-2)', fontWeight: 500 }}>{weekLabel(row.wk)}</span>
      <span style={{ fontSize: 13, color: 'var(--c-text-1)', fontWeight: 600 }}>{fmtH(row.h)}</span>
      {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>{STANDARD_HOURS}h</span>}
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: isOver ? '#F59E0B' : isUnder ? '#EF4444' : '#10B981',
      }}>
        {isOver ? '+' : ''}{fmtH(row.diff)}
      </span>
      {!isMobile && (
        <span style={{ fontSize: 12, color: '#10B981', fontWeight: hasComp ? 600 : 400 }}>
          {hasComp ? `-${fmtH(row.compUsed)}` : '—'}
        </span>
      )}
      {!isMobile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {row.compEntries.map(c => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, background: '#10B98118', color: '#10B981',
              borderRadius: 6, padding: '2px 7px', fontWeight: 500,
            }}>
              -{c.comp_hours}h {c.notes && `· ${c.notes}`}
              {isAdmin && (
                <button onClick={() => onDeleteComp(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0, opacity: 0.7 }}>
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── User row (team view) ──────────────────────────────────────────────────────
function UserRow({ u, isMobile, expanded, onToggle, onDeleteComp }) {
  const balanceColor = u.balance === 0 ? '#10B981' : u.balance > 0 ? '#F59E0B' : '#EF4444'

  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 70px 70px' : '1fr 110px 110px 110px',
          padding: '12px 18px',
          borderBottom: '1px solid var(--c-border-light)',
          cursor: 'pointer', alignItems: 'center',
          background: expanded ? 'var(--c-bg-muted)' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7C4DFF22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C4DFF' }}>{u.name.charAt(0)}</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{u.name}</div>
            {u.group && !isMobile && <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{u.group}</div>}
          </div>
          {expanded ? <ChevronUp size={12} color='var(--c-text-4)' /> : <ChevronDown size={12} color='var(--c-text-4)' />}
        </div>
        {!isMobile && (
          <span style={{ fontSize: 13, color: '#7C4DFF', fontWeight: 600 }}>
            {u.totalOvertime > 0 ? fmtHShort(u.totalOvertime) : '—'}
          </span>
        )}
        {!isMobile && (
          <span style={{ fontSize: 13, color: '#10B981', fontWeight: u.totalCompUsed > 0 ? 600 : 400 }}>
            {u.totalCompUsed > 0 ? fmtHShort(-u.totalCompUsed) : '—'}
          </span>
        )}
        <span style={{ fontSize: 14, fontWeight: 800, color: balanceColor, letterSpacing: '-0.3px' }}>
          {fmtHShort(u.balance)}
        </span>
      </div>

      {/* Expanded: week detail */}
      {expanded && (
        <div style={{ borderBottom: '1px solid var(--c-border-light)', background: 'var(--c-bg-app)' }}>
          {/* Week header */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 80px 80px 80px 1fr', padding: '8px 32px', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Semana', 'Horas', !isMobile && 'Extra', !isMobile && 'Comp.', !isMobile && 'Notas'].filter(Boolean).map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>
          {u.weekEntries.length === 0 ? (
            <div style={{ padding: '16px 32px', color: 'var(--c-text-4)', fontSize: 12 }}>Sin horas registradas</div>
          ) : u.weekEntries.slice(0, 12).map(row => {
            const isOver = row.diff > 0.1
            const hasComp = row.compUsed > 0
            return (
              <div key={row.wk} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 80px 80px 80px 1fr',
                padding: '8px 32px',
                borderBottom: '1px solid var(--c-border-light)',
                alignItems: 'center',
                background: isOver ? '#F59E0B06' : hasComp ? '#10B98106' : 'transparent',
              }}>
                <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{weekLabel(row.wk)}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 600 }}>{fmtH(row.h)}</span>
                {!isMobile && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: isOver ? '#F59E0B' : '#10B981' }}>
                    {isOver ? '+' : ''}{fmtH(row.diff)}
                  </span>
                )}
                {!isMobile && (
                  <span style={{ fontSize: 12, color: '#10B981' }}>
                    {hasComp ? `-${fmtH(row.compUsed)}` : '—'}
                  </span>
                )}
                {!isMobile && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {row.compEntries.map(c => (
                      <span key={c.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, background: '#10B98118', color: '#10B981',
                        borderRadius: 6, padding: '2px 7px',
                      }}>
                        -{c.comp_hours}h {c.notes && `· ${c.notes}`}
                        <button onClick={e => { e.stopPropagation(); onDeleteComp(c.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0, opacity: 0.7 }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const selectStyle = {
  display: 'block', width: '100%', marginTop: 6,
  padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)',
  color: 'var(--c-text-1)', fontSize: 13, cursor: 'pointer',
}
const inputStyle = {
  display: 'block', width: '100%', marginTop: 6,
  padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
  border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)',
  color: 'var(--c-text-1)', fontSize: 13, outline: 'none',
}
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
  background: '#7C4DFF', color: '#fff', border: 'none', cursor: 'pointer',
}
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
  background: 'var(--c-bg-muted)', color: 'var(--c-text-2)',
  border: '1.5px solid var(--c-border)', cursor: 'pointer',
}
