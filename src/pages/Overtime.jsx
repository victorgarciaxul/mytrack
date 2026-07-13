import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  Plus, Trash2, ChevronDown, ChevronUp, Users, User, X
} from 'lucide-react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { effectiveWeeklyHours } from '../lib/holidays'
import SearchableDropdown from '../components/ui/SearchableDropdown'
import { useRole } from '../context/RoleContext'
import { useAuth } from '../context/AuthContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { initDB, sql, dbGetCompensations, dbAddCompensation, dbDeleteCompensation, dbGetWeeklyHours, dbGetVacations, dbAddVacation, dbDeleteVacation, dbBulkUpsertVacations, getWsId, supabaseClient } from '../lib/db'
import { fetchAndParseVacations } from '../lib/icalVacations'
import toast from 'react-hot-toast'
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
  const sign = h < 0 ? '-' : '+'
  return mm > 0 ? `${sign}${hh}h ${mm}m` : `${sign}${hh}h`
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

// ── Add vacation modal ────────────────────────────────────────────────────────
function AddVacModal({ members, vacations, onAdd, onDelete, onClose, loading }) {
  const [email, setEmail]   = useState('')
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dateTo, setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hours, setHours]   = useState('7.5')
  const [desc, setDesc]     = useState('Vacaciones')
  const [tab, setTab]       = useState('add')  // 'add' | 'list'

  // Date range → array of working days (Mon–Fri)
  function workingDays(from, to) {
    const days = []
    let d = parseISO(from)
    const end = parseISO(to)
    while (d <= end) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) days.push(format(d, 'yyyy-MM-dd'))
      d = new Date(d.getTime() + 86400000)
    }
    return days
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    const days = workingDays(dateFrom, dateTo)
    for (const date of days) {
      await onAdd({ userEmail: email, date, hours: parseFloat(hours), description: desc })
    }
  }

  const memberVacs = vacations
    .filter(v => !email || v.user_email === email)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--c-bg-surface)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)' }}>Gestión de vacaciones</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--c-bg-muted)', borderRadius: 9, padding: 3 }}>
          {[['add', 'Añadir días'], ['list', 'Ver registros']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: tab === v ? 'var(--c-bg-surface)' : 'transparent',
              color: tab === v ? 'var(--c-text-1)' : 'var(--c-text-4)',
              boxShadow: tab === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{l}</button>
          ))}
        </div>

        {tab === 'add' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
              Persona
              <select value={email} onChange={e => setEmail(e.target.value)} required style={selectStyle}>
                <option value=''>Seleccionar…</option>
                {members.map(m => <option key={m.user_email} value={m.user_email}>{m.user_name}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
                Desde
                <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} required style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
                Hasta
                <input type='date' value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} required style={inputStyle} />
              </label>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
              Horas/día
              <div style={{ position: 'relative' }}>
                <input type='number' step='0.5' min='0.5' max='12' value={hours} onChange={e => setHours(e.target.value)} required style={{ ...inputStyle, paddingRight: 32 }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--c-text-4)' }}>h</span>
              </div>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>
              Descripción
              <input value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} />
            </label>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--c-text-4)' }}>
              Se añadirán {workingDays(dateFrom, dateTo).length} día(s) laborable(s) × {hours}h = <strong>{(workingDays(dateFrom, dateTo).length * parseFloat(hours || 0)).toFixed(1)}h</strong> en total
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type='button' onClick={onClose} style={btnSecondary}>Cancelar</button>
              <button type='submit' disabled={loading} style={{ ...btnPrimary, background: '#10B981' }}>
                {loading ? 'Guardando…' : 'Añadir vacaciones'}
              </button>
            </div>
          </form>
        )}

        {tab === 'list' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <select value={email} onChange={e => setEmail(e.target.value)} style={{ ...selectStyle, marginTop: 0 }}>
                <option value=''>Todos los miembros</option>
                {members.map(m => <option key={m.user_email} value={m.user_email}>{m.user_name}</option>)}
              </select>
            </div>
            {memberVacs.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>Sin registros</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {memberVacs.map(v => {
                  const mb = members.find(m => m.user_email === v.user_email)
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{mb?.user_name || v.user_email}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{format(parseISO(v.date), 'd MMM yyyy', { locale: es })} · {v.hours}h · {v.description}</div>
                      </div>
                      <button onClick={() => onDelete(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: 4, borderRadius: 6, opacity: 0.7 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
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
  const [showModal, setShowModal]   = useState(false)
  const [showVacModal, setShowVacModal] = useState(false)
  const [vacations, setVacations]   = useState([])
  const [syncing, setSyncing]       = useState(false)
  const [saving, setSaving]         = useState(false)
  // Date range — default: last complete week (Mon–Sun)
  const [rangeBounds, setRangeBounds] = useState({ from: null, to: null })

  // Sync viewMode once role is loaded
  useEffect(() => {
    if (role !== null) setViewMode(isAdmin ? 'team' : 'mine')
  }, [role, isAdmin])

  // Load all data — each fetch is independent so one failure doesn't block the others
  async function load() {
    setLoading(true)
    await initDB()

    // Members via native Supabase — exclude users who belong to multiple workspaces
    // (admins registered in both xul+fundacion should only appear in xul-ws-1)
    const wsId = getWsId()
    supabaseClient
      .from('workspace_members')
      .select('id, user_name, user_email, group_name, weekly_hours')
      .eq('workspace_id', wsId)
      .order('user_name')
      .then(async ({ data }) => {
        let members = (data || []).map(m => ({ ...m, weekly_hours: m.weekly_hours ?? 37.5 }))
        // For non-primary workspaces (fundacion), remove users who are also in xul-ws-1
        if (wsId !== 'xul-ws-1') {
          const { data: xulMembers } = await supabaseClient
            .from('workspace_members')
            .select('user_email')
            .eq('workspace_id', 'xul-ws-1')
          const xulEmails = new Set((xulMembers || []).map(m => m.user_email))
          members = members.filter(m => !xulEmails.has(m.user_email))
        }
        setMembers(members)
      })
      .catch(e => console.error('Overtime members error:', e))

    // Compensations
    dbGetCompensations(null)
      .then(setComps)
      .catch(e => console.error('Overtime comps error:', e))

    // Vacations
    dbGetVacations()
      .then(setVacations)
      .catch(e => console.error('Overtime vacations error:', e))

    // Weekly hours (main data) — critical path
    const from = format(startOfYear(new Date()), 'yyyy-MM-dd')
    const to   = format(addWeeks(new Date(), 1), 'yyyy-MM-dd')
    dbGetWeeklyHours(null, from, to)
      .then(setWeeklyRaw)
      .catch(e => console.error('Overtime weekly error:', e))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── Build per-user data ──────────────────────────────────────────────────
  const userData = useMemo(() => {
    const map = {}

    // Current week Monday — exclude it (only show completed weeks)
    const currentWeekKey = weekKey(new Date())

    // Group weekly hours per user per week — filtered by rangeBounds
    weeklyRaw.forEach(row => {
      const email = row.user_email
      const wk = typeof row.week_start === 'string'
        ? row.week_start.slice(0, 10)
        : format(new Date(row.week_start), 'yyyy-MM-dd')
      if (wk >= currentWeekKey) return  // skip current (incomplete) week
      const wkDate = parseISO(wk)
      if (rangeBounds.from && wkDate < rangeBounds.from) return
      if (rangeBounds.to   && wkDate > rangeBounds.to)   return
      const h = parseFloat(row.total_seconds) / 3600
      if (!map[email]) map[email] = { email, weeks: {} }
      map[email].weeks[wk] = (map[email].weeks[wk] || 0) + h
    })

    // Add comp entries — also filtered by range
    comps.forEach(c => {
      const email = c.user_email
      const wkDate = new Date(c.week_start)
      if (rangeBounds.from && wkDate < rangeBounds.from) return
      if (rangeBounds.to   && wkDate > rangeBounds.to)   return
      if (!map[email]) map[email] = { email, weeks: {} }
      map[email].compEntries = map[email].compEntries || []
      map[email].compEntries.push(c)
    })

    // Index vacations by user + week
    // Align vacation date window to the same minimum as weekly hours (start of current year)
    const vacMinDate = rangeBounds.from || startOfYear(new Date())
    const vacMaxDate = rangeBounds.to   || null
    const vacByUserWeek = {}  // { 'email|wk': [{ hours, date, description, id }] }
    vacations.forEach(v => {
      const wk = weekKey(parseISO(v.date))
      const wkDate = parseISO(wk)
      if (wkDate < vacMinDate) return
      if (vacMaxDate && wkDate > vacMaxDate) return
      const key = `${v.user_email}|${wk}`
      if (!vacByUserWeek[key]) vacByUserWeek[key] = []
      vacByUserWeek[key].push(v)
      // Ensure user appears in map even if they have no tracked hours that week
      if (!map[v.user_email]) map[v.user_email] = { email: v.user_email, weeks: {} }
    })

    // Compute balances per user — only for members of the active workspace
    const workspaceEmails = new Set(members.map(m => m.user_email))
    return Object.entries(map).filter(([email]) => workspaceEmails.has(email)).map(([email, data]) => {
      const mb = members.find(m => m.user_email === email)
      const name = mb?.user_name || email
      const group = mb?.group_name || ''
      const stdHours = parseFloat(mb?.weekly_hours ?? STANDARD_HOURS)

      // Collect all weeks that have tracked hours OR vacations
      const allWeeks = new Set([
        ...Object.keys(data.weeks || {}),
        ...Object.keys(vacByUserWeek).filter(k => k.startsWith(email + '|')).map(k => k.split('|')[1]),
      ])

      const weekEntries = [...allWeeks].map(wk => {
        const trackedH  = data.weeks?.[wk] || 0
        const vacRows   = vacByUserWeek[`${email}|${wk}`] || []
        const vacH      = vacRows.reduce((s, v) => s + Number(v.hours), 0)
        const h         = trackedH + vacH          // effective hours (tracked + vacation)
        const effStdH   = effectiveWeeklyHours(email, wk, stdHours) // stdHours minus holidays
        const diff      = h - effStdH
        const overtime  = Math.max(0, diff)
        const undertime = Math.max(0, -diff)
        const compEntries = (data.compEntries || []).filter(c => c.week_start === wk)
        const compUsed = compEntries.reduce((s, c) => s + parseFloat(c.comp_hours), 0)
        return { wk, h, trackedH, vacH, vacRows, overtime, undertime, compUsed, compEntries, diff }
      }).sort((a, b) => b.wk.localeCompare(a.wk))

      const acumulado  = weekEntries.reduce((s, w) => s + w.overtime, 0)
      const debido     = weekEntries.reduce((s, w) => s + w.undertime, 0)
      const compensado = (data.compEntries || []).reduce((s, c) => s + parseFloat(c.comp_hours), 0)
      const totalVacH  = weekEntries.reduce((s, w) => s + w.vacH, 0)

      return { email, name, group, stdHours, weekEntries, acumulado, compensado, debido, totalVacH,
        totalOvertime: acumulado, totalCompUsed: compensado, balance: debido }
    }).sort((a, b) => b.debido - a.debido)
  }, [weeklyRaw, comps, vacations, members, rangeBounds])

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

  async function handleSyncCalendar() {
    setSyncing(true)
    try {
      // Load members from ALL workspaces so fundacion users also match
      const { data: allMembers } = await supabaseClient
        .from('workspace_members')
        .select('user_email, user_name, weekly_hours, workspace_id')
      const { rows, unmatched } = await fetchAndParseVacations(allMembers || members, '2024-01-01')
      if (rows.length === 0) {
        toast('No se encontraron eventos nuevos')
        return
      }
      // Bulk upsert — single DB call
      const imported = await dbBulkUpsertVacations(rows, myEmail)
      const updated = await dbGetVacations()
      setVacations(updated)
      const msg = unmatched.length
        ? `✅ ${imported} días importados. Sin match: ${unmatched.join(', ')}`
        : `✅ ${imported} días importados desde Google Calendar`
      toast.success(msg, { duration: 6000 })
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSyncing(false)
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
            Jornada estándar: {STANDARD_HOURS}h · 35h en julio y agosto · Jornadas individuales según perfil
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date range picker — week mode: snaps to Mon–Sun */}
          <DateRangePicker
            from={rangeBounds.from}
            to={rangeBounds.to}
            onChange={({ from, to }) => setRangeBounds({ from, to })}
            weekMode
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
            <button onClick={handleSyncCalendar} disabled={syncing} style={{ ...btnPrimary, background: '#10B981' }}>
              {syncing ? 'Sincronizando…' : 'Sync Google Cal'}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowModal(true)} style={btnPrimary}>
              <Plus size={14} /> Compensación
            </button>
          )}
        </div>
      </div>

      {/* ── MY VIEW ─────────────────────────────────────────────────────── */}
      {!showTeamView && (
        <>
          {/* Balance cards */}
          {(() => {
            const acu  = myData?.acumulado ?? 0
            const deb  = myData?.debido    ?? 0
            const vac  = myData?.totalVacH ?? 0
            const net    = deb - acu   // positive = owes company, negative = company owes you
            const isOk   = Math.abs(net) < 0.05
            const isSurplus = net < -0.05
            const balColor  = isOk ? '#10B981' : isSurplus ? '#3B82F6' : '#EF4444'
            const balLabel  = isOk ? 'Al día ✓' : isSurplus ? 'La empresa te debe horas' : 'Horas pendientes con la empresa'
            const balValue  = isOk ? '—' : fmtHShort(net)
            // Only show ACUMULADO/DEBIDO separately when they both have values worth showing
            const showDetail = acu > 0.05 && deb > 0.05
            return (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                {/* Net balance — the number that matters */}
                <BalanceCard
                  icon={isOk ? CheckCircle2 : isSurplus ? TrendingUp : TrendingDown}
                  label='BALANCE'
                  value={balValue}
                  color={balColor}
                  sub={balLabel}
                />
                {showDetail && (
                  <BalanceCard
                    icon={TrendingUp} label='ACUMULADO'
                    value={fmtHShort(acu)}
                    color='#7C4DFF'
                    sub='Semanas por encima del estándar'
                  />
                )}
                {showDetail && (
                  <BalanceCard
                    icon={TrendingDown} label='DEBIDO'
                    value={fmtHShort(deb)}
                    color='#F59E0B'
                    sub='Semanas por debajo del estándar'
                  />
                )}
                {vac > 0 && (
                  <BalanceCard
                    icon={CheckCircle2} label='VACACIONES'
                    value={`${Math.round(vac / (myData.stdHours / 5))}d · ${fmtHShort(vac)}`}
                    color='#10B981'
                    sub='Ya incluidas en el cálculo'
                  />
                )}
              </div>
            )
          })()}

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
              <WeekRow key={row.wk} row={row} stdHours={myData.stdHours} isMobile={isMobile} isAdmin={isAdmin} onDeleteComp={handleDeleteComp} />
            ))}
          </div>
        </>
      )}

      {/* ── TEAM VIEW (admin only) ───────────────────────────────────────── */}
      {showTeamView && (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ width: 220 }}>
              <SearchableDropdown
                value={filterUser === 'all' ? null : filterUser}
                onChange={opt => setFilterUser(opt?.value || 'all')}
                options={members.map(m => ({ value: m.user_email, label: m.user_name }))}
                placeholder="Todos los miembros"
                clearLabel="Todos los miembros"
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>{filteredTeam.filter(u => (u.debido - u.acumulado) > 0.05).length} personas con horas pendientes</span>
          </div>

          {/* Team table */}
          <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 70px 70px' : '1fr 120px 110px 100px 110px', padding: '10px 18px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Persona</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#10B981' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                Vacaciones
              </span>
              {!isMobile && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#3B82F6' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
                  Acumulado
                </span>
              )}
              {!isMobile && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--c-text-3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-text-3)', display: 'inline-block' }} />
                  Debido
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#F59E0B' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                Balance
              </span>
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

      {showModal && (
        <AddCompModal
          members={members}
          onAdd={handleAddComp}
          onClose={() => setShowModal(false)}
          loading={saving}
        />
      )}
      {showVacModal && (
        <AddVacModal
          members={members}
          vacations={vacations}
          onAdd={async ({ userEmail, date, hours, description }) => {
            setSaving(true)
            try {
              await dbAddVacation({ userEmail, date, hours, description, createdBy: myEmail })
              const updated = await dbGetVacations()
              setVacations(updated)
            } catch(e) { console.error(e) } finally { setSaving(false) }
          }}
          onDelete={async (id) => {
            await dbDeleteVacation(id)
            const updated = await dbGetVacations()
            setVacations(updated)
          }}
          onClose={() => setShowVacModal(false)}
          loading={saving}
        />
      )}
    </div>
  )
}

// ── Week row (my view) ────────────────────────────────────────────────────────
function WeekRow({ row, stdHours, isMobile, isAdmin, onDeleteComp }) {
  const isOver  = row.diff > 0.1
  const isUnder = row.diff < -0.1
  const hasComp = row.compUsed > 0
  const hasVac  = row.vacH > 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 90px 70px 80px 80px 1fr',
      padding: '10px 18px',
      borderBottom: '1px solid var(--c-border-light)',
      alignItems: 'center',
      background: hasVac ? '#10B98106' : isOver ? '#F59E0B08' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--c-text-2)', fontWeight: 500 }}>{weekLabel(row.wk)}</span>
        {hasVac && <span title={`${row.vacH}h de vacaciones`} style={{ fontSize: 10, background: '#10B98122', color: '#10B981', borderRadius: 5, padding: '1px 5px', fontWeight: 600 }}>🏖 {row.vacH}h vac</span>}
      </div>
      <span style={{ fontSize: 13, color: 'var(--c-text-1)', fontWeight: 600 }}>{fmtH(row.h)}</span>
      {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>{stdHours ?? STANDARD_HOURS}h</span>}
      <span style={{ fontSize: 13, fontWeight: 700, color: isOver ? '#F59E0B' : isUnder ? '#EF4444' : '#10B981' }}>
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

// ── Week task breakdown (lazy load) ──────────────────────────────────────────
function WeekTaskBreakdown({ userEmail, wk }) {
  const [tasks, setTasks] = useState(null)

  useEffect(() => {
    const from = wk + 'T00:00:00.000Z'
    const to   = format(endOfWeek(parseISO(wk), { weekStartsOn: 1 }), 'yyyy-MM-dd') + 'T23:59:59.999Z'
    sql()`
      SELECT
        COALESCE(project_name, 'Sin proyecto') AS project_name,
        project_color,
        ROUND(SUM(duration) / 3600.0, 2) AS hours
      FROM time_entries
      WHERE user_email    = ${userEmail}
        AND workspace_id  = ${getWsId()}
        AND duration > 0
        AND start_time   >= ${from}
        AND start_time   <= ${to}
      GROUP BY project_name, project_color
      ORDER BY hours DESC
    `.then(rows => setTasks(rows)).catch(() => setTasks([]))
  }, [userEmail, wk])

  if (!tasks) return (
    <div style={{ padding: '6px 0', fontSize: 11, color: 'var(--c-text-4)' }}>Cargando proyectos…</div>
  )
  if (tasks.length === 0) return (
    <div style={{ padding: '6px 0', fontSize: 11, color: 'var(--c-text-4)' }}>Sin entradas registradas</div>
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
      {tasks.map(p => {
        const color = p.project_color || '#7C4DFF'
        const h = parseFloat(p.hours)
        return (
          <div key={p.project_name} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 20,
            background: color + '18', border: `1px solid ${color}33`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-2)' }}>{p.project_name}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text-4)', fontWeight: 600 }}>
              {Math.floor(h)}h {Math.round((h % 1) * 60).toString().padStart(2, '0')}m
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── User row (team view) ──────────────────────────────────────────────────────
function UserRow({ u, isMobile, expanded, onToggle, onDeleteComp }) {
  const deb = u.debido    ?? 0
  const acu = u.acumulado ?? 0
  const vac = u.totalVacH ?? 0
  const bal = deb - acu   // positive = owes company, negative = company owes them
  const [openWeeks, setOpenWeeks] = useState({})
  function toggleWeek(wk) { setOpenWeeks(p => ({ ...p, [wk]: !p[wk] })) }

  // Status dot based on net balance
  const hasDeb = bal > 0.05
  const hasSurplus = bal < -0.05
  const dotColor = hasDeb ? '#EF4444' : hasSurplus ? '#3B82F6' : '#10B981'
  const dotTitle = hasDeb ? `Balance: ${fmtHShort(bal)}` : hasSurplus ? `Surplus: ${fmtHShort(-bal)}` : 'Al día'

  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 70px 70px' : '1fr 120px 110px 100px 110px',
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
          {/* Avatar with status dot */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7C4DFF18', border: `2px solid ${dotColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7C4DFF' }}>{u.name.charAt(0)}</span>
            </div>
            {/* Status dot */}
            <span
              title={dotTitle}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: dotColor,
                border: '2px solid var(--c-bg-surface)',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{u.name}</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>
              {u.group && !isMobile ? `${u.group} · ` : ''}{u.stdHours}h/sem
            </div>
          </div>
          {expanded ? <ChevronUp size={12} color='var(--c-text-4)' /> : <ChevronDown size={12} color='var(--c-text-4)' />}
        </div>
        {/* Vacaciones */}
        <span style={{ fontSize: 13, color: '#10B981', fontWeight: vac > 0 ? 700 : 400 }}>
          {vac > 0 ? `${Math.round(vac / (u.stdHours / 5))}d · ${fmtHShort(vac)}` : '—'}
        </span>
        {!isMobile && (
          <span style={{ fontSize: 13, color: '#3B82F6', fontWeight: acu > 0.05 ? 700 : 400 }}>
            {acu > 0.05 ? fmtHShort(acu) : '—'}
          </span>
        )}
        {!isMobile && (
          <span style={{ fontSize: 13, color: 'var(--c-text-3)', fontWeight: deb > 0.05 ? 700 : 400 }}>
            {deb > 0.05 ? fmtHShort(deb) : '—'}
          </span>
        )}
        <span style={{ fontSize: 14, fontWeight: 800, color: hasDeb ? '#EF4444' : hasSurplus ? '#3B82F6' : '#10B981', letterSpacing: '-0.3px' }}>
          {Math.abs(bal) > 0.05 ? fmtHShort(bal) : '—'}
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
            const isOver  = row.diff > 0.1
            const hasComp = row.compUsed > 0
            const wkOpen  = openWeeks[row.wk]
            return (
              <div key={row.wk}>
                {/* Week summary row — click to toggle project breakdown */}
                <div
                  onClick={() => toggleWeek(row.wk)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 60px 60px' : '180px 80px 80px 80px 1fr',
                    padding: '8px 32px',
                    borderBottom: wkOpen ? 'none' : '1px solid var(--c-border-light)',
                    alignItems: 'center', cursor: 'pointer',
                    background: wkOpen ? '#7C4DFF08' : isOver ? '#F59E0B06' : hasComp ? '#10B98106' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!wkOpen) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = wkOpen ? '#7C4DFF08' : isOver ? '#F59E0B06' : hasComp ? '#10B98106' : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {wkOpen
                      ? <ChevronUp size={11} color='#7C4DFF' />
                      : <ChevronDown size={11} color='var(--c-text-4)' />}
                    <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{weekLabel(row.wk)}</span>
                  </div>
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

                {/* Project breakdown — shown when week row is expanded */}
                {wkOpen && (
                  <div style={{
                    padding: '8px 32px 12px 52px',
                    borderBottom: '1px solid var(--c-border-light)',
                    background: '#7C4DFF06',
                  }}>
                    <WeekTaskBreakdown userEmail={u.email} wk={row.wk} />
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
