import { useState, useEffect, useMemo, useRef } from 'react'
import { DollarSign, ChevronDown, ChevronUp, TrendingUp, Users, Briefcase, Filter, CalendarRange, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useNavigate } from 'react-router-dom'
import { sql, getWsId, initDB } from '../lib/db'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, addMonths, isSameDay, getDaysInMonth, getDay, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Date range presets ──────────────────────────────────────────────────────
const THIS_MONTH  = () => ({ from: startOfMonth(new Date()),  to: endOfMonth(new Date()) })
const LAST_MONTH  = () => { const d = subMonths(new Date(), 1); return { from: startOfMonth(d), to: endOfMonth(d) } }
const THIS_YEAR   = () => ({ from: startOfYear(new Date()),   to: endOfYear(new Date()) })
const ALL_TIME    = () => ({ from: new Date('2020-01-01'),     to: new Date('2099-12-31') })

const PRESETS = [
  { label: 'Este mes',      fn: THIS_MONTH },
  { label: 'Mes anterior',  fn: LAST_MONTH },
  { label: 'Este año',      fn: THIS_YEAR  },
  { label: 'Todo',          fn: ALL_TIME   },
  { label: 'Rango',         fn: null },
]
const CUSTOM_IDX = 4

// ── DateRangePicker ──────────────────────────────────────────────────────────
const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function DateRangePicker({ from, to, isActive, onActivate, onChange }) {
  const [open, setOpen]           = useState(false)
  const [selecting, setSelecting] = useState(null)
  const [hover, setHover]         = useState(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(from || new Date()))
  const containerRef              = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!containerRef.current?.contains(e.target)) { setOpen(false); setSelecting(null); setHover(null) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleTrigger() {
    onActivate(); setOpen(o => !o)
    if (!open) setViewMonth(startOfMonth(from || new Date()))
  }

  function handleDayClick(date) {
    if (!selecting) { setSelecting(date) } else {
      const [f, t] = date < selecting
        ? [startOfDay(date), endOfDay(selecting)]
        : [startOfDay(selecting), endOfDay(date)]
      onChange({ from: f, to: t })
      setSelecting(null); setHover(null); setOpen(false)
    }
  }

  function getDisplayRange() {
    if (selecting) { const end = hover || selecting; return selecting <= end ? [selecting, end] : [end, selecting] }
    return [from, to]
  }
  const [dFrom, dTo] = getDisplayRange()

  function getDayStyle(date) {
    const isStart = dFrom && isSameDay(date, dFrom)
    const isEnd   = dTo   && isSameDay(date, dTo)
    const inRange = dFrom && dTo && date > dFrom && date < dTo
    const isToday = isSameDay(date, new Date())
    if (isStart || isEnd) return { bg: '#7C4DFF', color: '#fff', fw: 700, radius: isStart ? '8px 0 0 8px' : '0 8px 8px 0' }
    if (inRange)          return { bg: '#7C4DFF1A', color: '#7C4DFF', fw: 500, radius: 0 }
    if (isToday)          return { bg: 'transparent', color: '#7C4DFF', fw: 700, radius: 8, border: '1.5px solid #7C4DFF55' }
    return { bg: 'transparent', color: 'var(--c-text-1)', fw: 400, radius: 8 }
  }

  const firstDow = (getDay(viewMonth) + 6) % 7
  const daysCount = getDaysInMonth(viewMonth)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysCount; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))

  const triggerLabel = isActive && from && to
    ? `${format(from, 'd MMM', { locale: es })} → ${format(to, 'd MMM yy', { locale: es })}`
    : 'Rango'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button onClick={handleTrigger} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        background: isActive ? '#7C4DFF' : 'var(--c-bg-muted)',
        color:      isActive ? '#fff'    : 'var(--c-text-3)',
        border:     isActive ? '1.5px solid #7C4DFF' : '1.5px solid var(--c-border)',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
        <CalendarRange size={13} />{triggerLabel}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 300,
          background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
          borderRadius: 16, padding: 18, minWidth: 272,
          boxShadow: '0 16px 48px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setViewMonth(m => subMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}><ChevronLeft size={14} /></button>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', textTransform: 'capitalize', letterSpacing: '-0.2px' }}>{format(viewMonth, 'MMMM yyyy', { locale: es })}</span>
            <button onClick={() => setViewMonth(m => addMonths(m, 1))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}><ChevronRight size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEK_DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--c-text-4)', paddingBottom: 4 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`e${i}`} />
              const ds = getDayStyle(date)
              return (
                <div key={date.getDate()} onClick={() => handleDayClick(date)}
                  onMouseEnter={() => selecting && setHover(date)} onMouseLeave={() => setHover(null)}
                  style={{ textAlign: 'center', fontSize: 12, fontWeight: ds.fw, padding: '6px 0', cursor: 'pointer', background: ds.bg, color: ds.color, borderRadius: ds.radius, border: ds.border || 'none', transition: 'background 0.08s', userSelect: 'none' }}
                  onMouseOver={e => { if (!ds.bg || ds.bg === 'transparent') e.currentTarget.style.background = '#7C4DFF12' }}
                  onMouseOut={e => { if (!ds.bg || ds.bg === 'transparent') e.currentTarget.style.background = ds.bg || 'transparent' }}
                >{date.getDate()}</div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--c-bg-muted)', textAlign: 'center' }}>
            {selecting ? (
              <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600 }}>Desde {format(selecting, 'd MMM', { locale: es })} → elige la fecha de fin</span>
            ) : (from && to) ? (
              <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{format(from, 'd MMM', { locale: es })} → {format(to, 'd MMM yyyy', { locale: es })}</span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Elige la fecha de inicio</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtEUR(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtH(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}
function fmtPct(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}
const CAPACITY_HOURS = 160  // standard monthly hours

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, isMobile }) {
  return (
    <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, padding: isMobile ? '12px 14px' : '16px 20px', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
      <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 12, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={isMobile ? 15 : 18} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--c-text-4)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: 'var(--c-text-1)', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Grid template (shared) ───────────────────────────────────────────────────
// Columns: Nombre | Horas | % Imputación | Coste Imputación
const GRID_DESKTOP = '1fr 140px 110px 140px'
const GRID_MOBILE  = '1fr auto'

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Costs() {
  const { isAdmin, role } = useRole()
  const navigate   = useNavigate()
  const isMobile   = useMediaQuery('(max-width: 768px)')

  const [loading,      setLoading]      = useState(true)
  const [members,      setMembers]      = useState([])
  const [entries,      setEntries]      = useState([])
  const [preset,       setPreset]       = useState(0)
  const [customRange,  setCustomRange]  = useState(() => THIS_MONTH())
  const [appliedRange, setAppliedRange] = useState(() => THIS_MONTH())
  const [filterUser,   setFilterUser]   = useState('all')
  const [filterProj,   setFilterProj]   = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [viewMode,     setViewMode]     = useState('project')
  const [sortCol,      setSortCol]      = useState('cost')
  const [sortDir,      setSortDir]      = useState('desc')
  const [expandedRow,  setExpandedRow]  = useState(null)

  useEffect(() => {
    if (role !== null && !isAdmin) navigate('/tracker', { replace: true })
  }, [role, isAdmin])

  const { from, to } = appliedRange

  // ── Capacity & period cost proportional to the selected period ──────────────
  // periodCapacitySecs: reference hours for the period (1 month → 160h, 1 year → 1920h)
  // periodMonths: used to scale monthly_cost to the full period cost
  const { periodCapacitySecs, periodMonths } = useMemo(() => {
    const ms = to.getTime() - from.getTime()
    const months = ms / (1000 * 60 * 60 * 24 * 30.4375)
    const clampedMonths = Math.max(months, 1)
    return {
      periodCapacitySecs: CAPACITY_HOURS * 3600 * clampedMonths,
      periodMonths: clampedMonths,
    }
  }, [from, to])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        await initDB()
        const db = sql()
        const [mems, ents] = await Promise.all([
          db`SELECT id, user_name, user_email, hourly_rate, group_name, COALESCE(monthly_cost, 0) AS monthly_cost
             FROM workspace_members
             WHERE workspace_id = ${getWsId()} AND hourly_rate > 0
             ORDER BY user_name`,
          db`SELECT user_email, project_id, project_name, project_color, client_name, duration, start_time
             FROM time_entries
             WHERE workspace_id = ${getWsId()}
               AND duration > 0
               AND start_time >= ${from.toISOString()}
               AND start_time <= ${to.toISOString()}`,
        ])
        setMembers(mems)
        setEntries(ents)
      } catch (e) {
        console.error('Costs load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedRange])

  function handlePreset(i) {
    setPreset(i)
    if (i !== CUSTOM_IDX) setAppliedRange(PRESETS[i].fn())
  }
  function handleRangeChange({ from: f, to: t }) {
    const range = { from: f, to: t }
    setCustomRange(range)
    setAppliedRange(range)
  }

  const dateFiltered = entries

  const rateMap = useMemo(() => {
    const m = {}
    members.forEach(mb => { m[mb.user_email] = parseFloat(mb.hourly_rate) || 0 })
    return m
  }, [members])

  const monthlyCostMap = useMemo(() => {
    const m = {}
    members.forEach(mb => { m[mb.user_email] = parseFloat(mb.monthly_cost) || 0 })
    return m
  }, [members])

  const allProjects = useMemo(() => {
    const map = {}
    dateFiltered.forEach(e => {
      if (e.project_id && !map[e.project_id])
        map[e.project_id] = { id: e.project_id, name: e.project_name || 'Sin proyecto', color: e.project_color || '#7C4DFF' }
    })
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }, [dateFiltered])

  const allClients = useMemo(() => {
    const map = {}
    dateFiltered.forEach(e => {
      const key = e.client_name || '__none__'
      if (!map[key]) map[key] = { id: key, name: e.client_name || 'Sin cliente' }
    })
    return Object.values(map)
      .filter(c => c.id !== '__none__')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [dateFiltered])

  const allUsers = useMemo(() => {
    const emails = [...new Set(dateFiltered.map(e => e.user_email))]
    return emails.map(email => {
      const mb = members.find(m => m.user_email === email)
      return { email, name: mb?.user_name || email, rate: rateMap[email] || 0 }
    }).filter(u => u.rate > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [dateFiltered, members, rateMap])

  const filtered = useMemo(() => {
    let rows = dateFiltered
    if (filterUser   !== 'all') rows = rows.filter(e => e.user_email === filterUser)
    if (filterProj   !== 'all') rows = rows.filter(e => e.project_id === filterProj)
    if (filterClient !== 'all') rows = rows.filter(e => (e.client_name || '__none__') === filterClient)
    return rows
  }, [dateFiltered, filterUser, filterProj, filterClient])

  const personTotalSecs = useMemo(() => {
    const map = {}
    dateFiltered.forEach(e => {
      if (!rateMap[e.user_email]) return
      map[e.user_email] = (map[e.user_email] || 0) + e.duration
    })
    return map
  }, [dateFiltered, rateMap])

  // ── VIEW: by project ───────────────────────────────────────────────────────
  const byProject = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const mc          = monthlyCostMap[e.user_email] || 0
      const personTotal = personTotalSecs[e.user_email] || e.duration
      const cappedTotal = Math.max(personTotal, periodCapacitySecs)
      const projId = e.project_id || '__none__'
      if (!map[projId]) map[projId] = {
        id: projId, name: e.project_name || 'Sin proyecto', color: e.project_color || '#888',
        totalSecs: 0, totalCost: 0, totalImputCost: 0,
        imputBudgets: {}, people: {},
      }
      const cost      = (e.duration / 3600) * rate
      const imputCost = (e.duration / cappedTotal) * mc * periodMonths
      map[projId].totalSecs      += e.duration
      map[projId].totalCost      += cost
      map[projId].totalImputCost += imputCost
      if (mc > 0 && !map[projId].imputBudgets[e.user_email]) {
        map[projId].imputBudgets[e.user_email] = mc * periodMonths * Math.min(personTotal / periodCapacitySecs, 1)
      }
      const mb   = members.find(m => m.user_email === e.user_email)
      const pKey = e.user_email
      if (!map[projId].people[pKey]) map[projId].people[pKey] = {
        name: mb?.user_name || e.user_email, email: e.user_email, rate, mc,
        secs: 0, cost: 0, imputCost: 0, personTotal,
      }
      map[projId].people[pKey].secs      += e.duration
      map[projId].people[pKey].cost      += cost
      map[projId].people[pKey].imputCost += imputCost
    })
    Object.values(map).forEach(proj => {
      proj.totalImputBudget = Object.values(proj.imputBudgets).reduce((s, b) => s + b, 0)
    })
    return Object.values(map).sort((a, b) => {
      const v = sortCol === 'cost' ? b.totalCost - a.totalCost
              : sortCol === 'hours' ? b.totalSecs - a.totalSecs
              : a.name.localeCompare(b.name)
      return sortDir === 'asc' ? -v : v
    })
  }, [filtered, rateMap, monthlyCostMap, personTotalSecs, periodCapacitySecs, periodMonths, members, sortCol, sortDir])

  // ── VIEW: by person ────────────────────────────────────────────────────────
  const byPerson = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const mc          = monthlyCostMap[e.user_email] || 0
      const personTotal = personTotalSecs[e.user_email] || e.duration
      const cappedTotal = Math.max(personTotal, periodCapacitySecs)
      const key = e.user_email
      if (!map[key]) {
        const mb = members.find(m => m.user_email === e.user_email)
        map[key] = {
          email: key, name: mb?.user_name || key, rate, mc,
          group: mb?.group_name || '',
          totalSecs: 0, totalCost: 0, totalImputCost: 0,
          personTotal, cappedTotal, projects: {},
        }
      }
      const cost      = (e.duration / 3600) * rate
      const imputCost = (e.duration / cappedTotal) * mc * periodMonths
      map[key].totalSecs      += e.duration
      map[key].totalCost      += cost
      map[key].totalImputCost += imputCost
      const projId = e.project_id || '__none__'
      if (!map[key].projects[projId]) map[key].projects[projId] = {
        name: e.project_name || 'Sin proyecto', color: e.project_color || '#888',
        secs: 0, cost: 0, imputCost: 0,
      }
      map[key].projects[projId].secs      += e.duration
      map[key].projects[projId].cost      += cost
      map[key].projects[projId].imputCost += imputCost
    })
    return Object.values(map).sort((a, b) => {
      const v = sortCol === 'cost' ? b.totalCost - a.totalCost
              : sortCol === 'hours' ? b.totalSecs - a.totalSecs
              : a.name.localeCompare(b.name)
      return sortDir === 'asc' ? -v : v
    })
  }, [filtered, rateMap, monthlyCostMap, personTotalSecs, periodCapacitySecs, periodMonths, members, sortCol, sortDir])

  // ── VIEW: by client ────────────────────────────────────────────────────────
  const byClient = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const mc          = monthlyCostMap[e.user_email] || 0
      const personTotal = personTotalSecs[e.user_email] || e.duration
      const cappedTotal = Math.max(personTotal, periodCapacitySecs)
      const clientKey  = e.client_name || '__none__'
      const clientName = e.client_name || 'Sin cliente'
      if (!map[clientKey]) map[clientKey] = {
        id: clientKey, name: clientName,
        totalSecs: 0, totalCost: 0, totalImputCost: 0,
        imputBudgets: {}, projects: {},
      }
      const cost      = (e.duration / 3600) * rate
      const imputCost = (e.duration / cappedTotal) * mc * periodMonths
      map[clientKey].totalSecs      += e.duration
      map[clientKey].totalCost      += cost
      map[clientKey].totalImputCost += imputCost
      if (mc > 0 && !map[clientKey].imputBudgets[e.user_email]) {
        map[clientKey].imputBudgets[e.user_email] = mc * periodMonths * Math.min(personTotal / periodCapacitySecs, 1)
      }
      const projId = e.project_id || '__none__'
      if (!map[clientKey].projects[projId]) map[clientKey].projects[projId] = {
        name: e.project_name || 'Sin proyecto', color: e.project_color || '#888',
        secs: 0, cost: 0, imputCost: 0,
      }
      map[clientKey].projects[projId].secs      += e.duration
      map[clientKey].projects[projId].cost      += cost
      map[clientKey].projects[projId].imputCost += imputCost
    })
    Object.values(map).forEach(c => {
      c.totalImputBudget = Object.values(c.imputBudgets).reduce((s, b) => s + b, 0)
    })
    return Object.values(map).sort((a, b) => {
      const v = sortCol === 'cost' ? b.totalCost - a.totalCost
              : sortCol === 'hours' ? b.totalSecs - a.totalSecs
              : a.name.localeCompare(b.name)
      return sortDir === 'asc' ? -v : v
    })
  }, [filtered, rateMap, monthlyCostMap, personTotalSecs, periodCapacitySecs, periodMonths, sortCol, sortDir])

  // Totals (use active view's data)
  const activeRows = viewMode === 'project' ? byProject : viewMode === 'person' ? byPerson : byClient
  const totalCost        = useMemo(() => activeRows.reduce((s, r) => s + r.totalCost, 0), [activeRows])
  const totalSecs        = useMemo(() => activeRows.reduce((s, r) => s + r.totalSecs, 0), [activeRows])
  const totalImputCost   = useMemo(() => activeRows.reduce((s, r) => s + r.totalImputCost, 0), [activeRows])
  const totalImputBudget = useMemo(() => {
    const seen = {}
    byProject.forEach(proj => {
      Object.entries(proj.imputBudgets || {}).forEach(([email, budget]) => {
        if (!seen[email]) seen[email] = budget
      })
    })
    return Object.values(seen).reduce((s, b) => s + b, 0)
  }, [byProject])
  const totalPeople = useMemo(() => new Set(filtered.filter(e => rateMap[e.user_email] > 0).map(e => e.user_email)).size, [filtered, rateMap])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }) => sortCol === col
    ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
    : null

  if (role === null || (role !== null && !isAdmin)) return null
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #7C4DFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div className="page-container" style={{ padding: isMobile ? '14px' : '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.5px' }}>Costes de equipo</h1>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--c-text-4)' }}>Solo visible para administradores</p>

        {/* Preset selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {PRESETS.slice(0, CUSTOM_IDX).map((p, i) => (
            <button key={i} onClick={() => handlePreset(i)} style={{
              padding: isMobile ? '7px 14px' : '6px 12px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: preset === i ? '#7C4DFF' : 'var(--c-bg-muted)',
              color:      preset === i ? '#fff'    : 'var(--c-text-3)',
              border:     preset === i ? '1.5px solid #7C4DFF' : '1.5px solid var(--c-border)',
              transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
          <DateRangePicker
            from={preset === CUSTOM_IDX ? customRange.from : null}
            to={preset === CUSTOM_IDX ? customRange.to : null}
            isActive={preset === CUSTOM_IDX}
            onActivate={() => setPreset(CUSTOM_IDX)}
            onChange={handleRangeChange}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard icon={DollarSign} label="Coste total"       value={fmtEUR(totalCost)} color="#7C4DFF" isMobile={isMobile} />
        <StatCard icon={TrendingUp} label="Horas registradas" value={fmtH(totalSecs)}   color="#06B6D4" isMobile={isMobile} />
        <StatCard icon={Users}      label="Perfiles activos"  value={totalPeople}        color="#10B981" isMobile={isMobile} />
        <StatCard icon={Briefcase}  label="Proyectos"         value={byProject.length}   color="#F59E0B" isMobile={isMobile} />
      </div>

      {/* Filters row */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 10 : 0, flexWrap: 'wrap' }}>
          <Filter size={13} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {[['project', 'Por proyecto'], ['person', 'Por persona'], ['client', 'Por cliente']].map(([v, l]) => (
              <button key={v} onClick={() => { setViewMode(v); setExpandedRow(null) }} style={{
                padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: viewMode === v ? '#7C4DFF22' : 'transparent',
                color: viewMode === v ? '#7C4DFF' : 'var(--c-text-3)',
                border: viewMode === v ? '1.5px solid #7C4DFF55' : '1.5px solid transparent',
              }}>{l}</button>
            ))}
          </div>
          {!isMobile && <div style={{ width: 1, height: 20, background: 'var(--c-border-light)' }} />}
          {!isMobile && <>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">Todos los perfiles</option>
              {allUsers.map(u => <option key={u.email} value={u.email}>{u.name} ({u.rate} €/h)</option>)}
            </select>
            <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">Todos los proyectos</option>
              {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 12, cursor: 'pointer' }}>
              <option value="all">Todos los clientes</option>
              {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>}
        </div>
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 13, cursor: 'pointer' }}>
              <option value="all">Todos los perfiles</option>
              {allUsers.map(u => <option key={u.email} value={u.email}>{u.name} ({u.rate} €/h)</option>)}
            </select>
            <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 13, cursor: 'pointer' }}>
              <option value="all">Todos los proyectos</option>
              {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)', color: 'var(--c-text-1)', fontSize: 13, cursor: 'pointer' }}>
              <option value="all">Todos los clientes</option>
              {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
          padding: '10px 14px', borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-muted)', gap: 8,
        }}>
          <button onClick={() => toggleSort('name')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0, textAlign: 'left' }}>
            {viewMode === 'project' ? 'Proyecto' : viewMode === 'person' ? 'Persona' : 'Cliente'} <SortIcon col="name" />
          </button>
          {!isMobile && (
            <button onClick={() => toggleSort('hours')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0 }}>
              Horas <SortIcon col="hours" />
            </button>
          )}
          {!isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>% Imputación</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: isMobile ? 'right' : 'left' }}>Coste imput.</span>
        </div>

        {/* Rows */}
        {viewMode === 'project' && (
          byProject.length === 0
            ? <EmptyState />
            : byProject.map(proj => (
                <ProjectRow key={proj.id} proj={proj} isMobile={isMobile}
                  expanded={expandedRow === proj.id}
                  onToggle={() => setExpandedRow(expandedRow === proj.id ? null : proj.id)}
                  periodCapacitySecs={periodCapacitySecs} />
              ))
        )}
        {viewMode === 'person' && (
          byPerson.length === 0
            ? <EmptyState />
            : byPerson.map(person => (
                <PersonRow key={person.email} person={person} isMobile={isMobile}
                  expanded={expandedRow === person.email}
                  onToggle={() => setExpandedRow(expandedRow === person.email ? null : person.email)} />
              ))
        )}
        {viewMode === 'client' && (
          byClient.length === 0
            ? <EmptyState />
            : byClient.map(client => (
                <ClientRow key={client.id} client={client} isMobile={isMobile}
                  expanded={expandedRow === client.id}
                  onToggle={() => setExpandedRow(expandedRow === client.id ? null : client.id)} />
              ))
        )}

        {/* Totals footer */}
        {activeRows.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
            padding: '12px 14px', borderTop: '2px solid var(--c-border)', background: 'var(--c-bg-muted)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)' }}>TOTAL</span>
            {!isMobile && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>{fmtH(totalSecs)}</span>}
            {!isMobile && <span style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6' }}>
              {totalImputBudget > 0 ? fmtPct(totalImputCost / totalImputBudget * 100) : '—'}
            </span>}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', textAlign: isMobile ? 'right' : 'left' }}>{fmtEUR(totalImputCost)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>No hay datos para el período seleccionado</div>
}

// ── Project row ──────────────────────────────────────────────────────────────
function ProjectRow({ proj, isMobile, expanded, onToggle, periodCapacitySecs }) {
  const people = Object.values(proj.people).sort((a, b) => b.cost - a.cost)
  return (
    <>
      <div onClick={onToggle} style={{
        display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
        padding: isMobile ? '11px 14px' : '12px 16px', borderBottom: '1px solid var(--c-border-light)',
        cursor: 'pointer', transition: 'background 0.1s', background: expanded ? 'var(--c-bg-muted)' : 'transparent', alignItems: 'center',
      }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
          <span style={{ fontSize: 11, color: 'var(--c-text-4)', flexShrink: 0 }}>({people.length} pers.)</span>
          {expanded ? <ChevronUp size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} />}
        </div>
        {!isMobile && <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{fmtH(proj.totalSecs)}</span>}
        {!isMobile && <span />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', textAlign: isMobile ? 'right' : 'left' }}>{fmtEUR(proj.totalImputCost)}</span>
      </div>

      {expanded && people.map(p => (
        <div key={p.email} style={{
          display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
          padding: '8px 16px 8px 36px', borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-app)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C4DFF22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7C4DFF' }}>{p.name.charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          {!isMobile && <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>{p.personTotal ? fmtPct(p.secs / p.personTotal * 100) : '—'}</span>}
          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700, textAlign: isMobile ? 'right' : 'left' }}>{p.mc > 0 ? fmtEUR(p.imputCost) : '—'}</span>
        </div>
      ))}
    </>
  )
}

// ── Person row ───────────────────────────────────────────────────────────────
function PersonRow({ person, isMobile, expanded, onToggle }) {
  const projs = Object.entries(person.projects).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.cost - a.cost)
  return (
    <>
      <div onClick={onToggle} style={{
        display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
        padding: isMobile ? '11px 14px' : '12px 16px', borderBottom: '1px solid var(--c-border-light)',
        cursor: 'pointer', transition: 'background 0.1s', background: expanded ? 'var(--c-bg-muted)' : 'transparent', alignItems: 'center',
      }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7C4DFF22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C4DFF' }}>{person.name.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
            {person.group && <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{person.group}</div>}
          </div>
          {expanded ? <ChevronUp size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} />}
        </div>
        {!isMobile && <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{fmtH(person.totalSecs)}</span>}
        {!isMobile && <span style={{ fontSize: 12, fontWeight: 600, color: '#8B5CF6' }}>{fmtPct(Math.min(person.personTotal / person.cappedTotal, 1) * 100)}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', textAlign: isMobile ? 'right' : 'left' }}>{person.mc > 0 ? fmtEUR(person.totalImputCost) : '—'}</span>
      </div>

      {expanded && projs.map(p => (
        <div key={p.id} style={{
          display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
          padding: '8px 16px 8px 52px', borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-app)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          {!isMobile && <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>{person.personTotal ? fmtPct(p.secs / person.personTotal * 100) : '—'}</span>}
          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700, textAlign: isMobile ? 'right' : 'left' }}>{person.mc > 0 ? fmtEUR(p.imputCost) : '—'}</span>
        </div>
      ))}
    </>
  )
}

// ── Client row ───────────────────────────────────────────────────────────────
function ClientRow({ client, isMobile, expanded, onToggle }) {
  const projs = Object.entries(client.projects).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.cost - a.cost)
  return (
    <>
      <div onClick={onToggle} style={{
        display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
        padding: isMobile ? '11px 14px' : '12px 16px', borderBottom: '1px solid var(--c-border-light)',
        cursor: 'pointer', transition: 'background 0.1s', background: expanded ? 'var(--c-bg-muted)' : 'transparent', alignItems: 'center',
      }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#06B6D422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={13} color="#06B6D4" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
          <span style={{ fontSize: 11, color: 'var(--c-text-4)', flexShrink: 0 }}>({projs.length} proy.)</span>
          {expanded ? <ChevronUp size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} /> : <ChevronDown size={12} color="var(--c-text-4)" style={{ flexShrink: 0 }} />}
        </div>
        {!isMobile && <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{fmtH(client.totalSecs)}</span>}
        {!isMobile && <span />}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', textAlign: isMobile ? 'right' : 'left' }}>{fmtEUR(client.totalImputCost)}</span>
      </div>

      {expanded && projs.map(p => (
        <div key={p.id} style={{
          display: 'grid', gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
          padding: '8px 16px 8px 52px', borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-app)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          {!isMobile && <span />}
          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700, textAlign: isMobile ? 'right' : 'left' }}>{fmtEUR(p.imputCost)}</span>
        </div>
      ))}
    </>
  )
}
