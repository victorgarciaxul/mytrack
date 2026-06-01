import { useState, useEffect, useMemo } from 'react'
import { DollarSign, ChevronDown, ChevronUp, TrendingUp, Users, Briefcase, Filter } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useNavigate } from 'react-router-dom'
import { sql, initDB } from '../lib/db'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'
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
]

function fmt€(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtH(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginBottom: 3, whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Costs() {
  const { isAdmin } = useRole()
  const navigate    = useNavigate()
  const isMobile    = useMediaQuery('(max-width: 768px)')

  const [loading,     setLoading]     = useState(true)
  const [members,     setMembers]     = useState([])   // { id, user_name, user_email, hourly_rate, group_name }
  const [entries,     setEntries]     = useState([])   // raw time_entries rows
  const [preset,      setPreset]      = useState(0)    // index in PRESETS
  const [filterUser,  setFilterUser]  = useState('all')
  const [filterProj,  setFilterProj]  = useState('all')
  const [viewMode,    setViewMode]    = useState('project') // 'project' | 'person'
  const [sortCol,     setSortCol]     = useState('cost')
  const [sortDir,     setSortDir]     = useState('desc')
  const [expandedRow, setExpandedRow] = useState(null)

  // Guard: only admins
  useEffect(() => {
    if (isAdmin === false) navigate('/tracker', { replace: true })
  }, [isAdmin])

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        await initDB()
        const db = sql()
        const [mems, ents] = await Promise.all([
          db`SELECT id, user_name, user_email, hourly_rate, group_name FROM workspace_members WHERE hourly_rate > 0 ORDER BY user_name`,
          db`SELECT user_email, project_id, project_name, project_color, duration, start_time FROM time_entries WHERE duration > 0`,
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
  }, [])

  // Date range from preset
  const { from, to } = useMemo(() => PRESETS[preset].fn(), [preset])

  // Filter entries by date
  const dateFiltered = useMemo(() =>
    entries.filter(e => {
      const d = new Date(e.start_time)
      return d >= from && d <= to
    }),
  [entries, from, to])

  // Build rate map: email -> hourly_rate
  const rateMap = useMemo(() => {
    const m = {}
    members.forEach(mb => { m[mb.user_email] = parseFloat(mb.hourly_rate) || 0 })
    return m
  }, [members])

  // All unique projects
  const allProjects = useMemo(() => {
    const map = {}
    dateFiltered.forEach(e => {
      if (e.project_id && !map[e.project_id])
        map[e.project_id] = { id: e.project_id, name: e.project_name || 'Sin proyecto', color: e.project_color || '#7C4DFF' }
    })
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }, [dateFiltered])

  // All unique users with entries
  const allUsers = useMemo(() => {
    const emails = [...new Set(dateFiltered.map(e => e.user_email))]
    return emails.map(email => {
      const mb = members.find(m => m.user_email === email)
      return { email, name: mb?.user_name || email, rate: rateMap[email] || 0 }
    }).filter(u => u.rate > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [dateFiltered, members, rateMap])

  // Apply user/project filter
  const filtered = useMemo(() => {
    let rows = dateFiltered
    if (filterUser !== 'all') rows = rows.filter(e => e.user_email === filterUser)
    if (filterProj !== 'all') rows = rows.filter(e => e.project_id === filterProj)
    return rows
  }, [dateFiltered, filterUser, filterProj])

  // ── VIEW: by project ───────────────────────────────────────────────────────
  const byProject = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const projId = e.project_id || '__none__'
      if (!map[projId]) map[projId] = {
        id: projId, name: e.project_name || 'Sin proyecto', color: e.project_color || '#888',
        totalSecs: 0, totalCost: 0, people: {},
      }
      const cost = (e.duration / 3600) * rate
      map[projId].totalSecs += e.duration
      map[projId].totalCost += cost
      const mb = members.find(m => m.user_email === e.user_email)
      const pKey = e.user_email
      if (!map[projId].people[pKey]) map[projId].people[pKey] = { name: mb?.user_name || e.user_email, email: e.user_email, rate, secs: 0, cost: 0 }
      map[projId].people[pKey].secs += e.duration
      map[projId].people[pKey].cost += cost
    })
    return Object.values(map).sort((a, b) => {
      const v = sortCol === 'cost' ? b.totalCost - a.totalCost
              : sortCol === 'hours' ? b.totalSecs - a.totalSecs
              : a.name.localeCompare(b.name)
      return sortDir === 'asc' ? -v : v
    })
  }, [filtered, rateMap, members, sortCol, sortDir])

  // ── VIEW: by person ────────────────────────────────────────────────────────
  const byPerson = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const key = e.user_email
      if (!map[key]) {
        const mb = members.find(m => m.user_email === e.user_email)
        map[key] = { email: key, name: mb?.user_name || key, rate, group: mb?.group_name || '', totalSecs: 0, totalCost: 0, projects: {} }
      }
      const cost = (e.duration / 3600) * rate
      map[key].totalSecs += e.duration
      map[key].totalCost += cost
      const projId = e.project_id || '__none__'
      if (!map[key].projects[projId]) map[key].projects[projId] = { name: e.project_name || 'Sin proyecto', color: e.project_color || '#888', secs: 0, cost: 0 }
      map[key].projects[projId].secs += e.duration
      map[key].projects[projId].cost += cost
    })
    return Object.values(map).sort((a, b) => {
      const v = sortCol === 'cost' ? b.totalCost - a.totalCost
              : sortCol === 'hours' ? b.totalSecs - a.totalSecs
              : a.name.localeCompare(b.name)
      return sortDir === 'asc' ? -v : v
    })
  }, [filtered, rateMap, members, sortCol, sortDir])

  // Totals
  const totalCost  = useMemo(() => byProject.reduce((s, p) => s + p.totalCost, 0), [byProject])
  const totalSecs  = useMemo(() => byProject.reduce((s, p) => s + p.totalSecs, 0), [byProject])
  const totalPeople = useMemo(() => new Set(filtered.filter(e => rateMap[e.user_email] > 0).map(e => e.user_email)).size, [filtered, rateMap])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }) => sortCol === col
    ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
    : null

  if (isAdmin === null || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #7C4DFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div className="page-container" style={{ padding: isMobile ? '14px' : '24px 28px', overflowY: 'auto', height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.5px' }}>
            Costes de equipo
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--c-text-4)' }}>Solo visible para administradores</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Preset selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => setPreset(i)} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: preset === i ? '#7C4DFF' : 'var(--c-bg-muted)',
                color: preset === i ? '#fff' : 'var(--c-text-3)',
                border: preset === i ? '1.5px solid #7C4DFF' : '1.5px solid var(--c-border)',
                transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon={DollarSign}  label="Coste total"       value={fmt€(totalCost)}  color="#7C4DFF" />
        <StatCard icon={TrendingUp}  label="Horas registradas" value={fmtH(totalSecs)}  color="#06B6D4" />
        <StatCard icon={Users}       label="Perfiles activos"  value={totalPeople}       color="#10B981" />
        <StatCard icon={Briefcase}   label="Proyectos"         value={byProject.length}  color="#F59E0B" />
      </div>

      {/* Filters row */}
      <div style={{
        background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <Filter size={14} color="var(--c-text-4)" style={{ flexShrink: 0 }} />

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['project', 'Por proyecto'], ['person', 'Por persona']].map(([v, l]) => (
            <button key={v} onClick={() => { setViewMode(v); setExpandedRow(null) }} style={{
              padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === v ? '#7C4DFF22' : 'transparent',
              color: viewMode === v ? '#7C4DFF' : 'var(--c-text-3)',
              border: viewMode === v ? '1.5px solid #7C4DFF55' : '1.5px solid transparent',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--c-border-light)' }} />

        {/* User filter */}
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{
          padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)',
          color: 'var(--c-text-1)', fontSize: 12, cursor: 'pointer',
        }}>
          <option value="all">Todos los perfiles</option>
          {allUsers.map(u => <option key={u.email} value={u.email}>{u.name} ({u.rate} €/h)</option>)}
        </select>

        {/* Project filter */}
        <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={{
          padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)',
          color: 'var(--c-text-1)', fontSize: 12, cursor: 'pointer',
        }}>
          <option value="all">Todos los proyectos</option>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
          padding: '10px 16px',
          borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-muted)',
        }}>
          <button onClick={() => toggleSort('name')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0, textAlign: 'left' }}>
            {viewMode === 'project' ? 'Proyecto' : 'Persona'} <SortIcon col="name" />
          </button>
          {!isMobile && (
            <button onClick={() => toggleSort('hours')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0 }}>
              Horas <SortIcon col="hours" />
            </button>
          )}
          <button onClick={() => toggleSort('hours')} style={{ display: isMobile ? 'flex' : 'none', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0 }}>
            Horas <SortIcon col="hours" />
          </button>
          <button onClick={() => toggleSort('cost')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: 0 }}>
            Coste <SortIcon col="cost" />
          </button>
          {!isMobile && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tarifa</span>}
        </div>

        {/* Rows */}
        {viewMode === 'project' ? (
          byProject.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>
              No hay datos para el período seleccionado
            </div>
          ) : byProject.map(proj => (
            <ProjectRow
              key={proj.id}
              proj={proj}
              isMobile={isMobile}
              expanded={expandedRow === proj.id}
              onToggle={() => setExpandedRow(expandedRow === proj.id ? null : proj.id)}
            />
          ))
        ) : (
          byPerson.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: 13 }}>
              No hay datos para el período seleccionado
            </div>
          ) : byPerson.map(person => (
            <PersonRow
              key={person.email}
              person={person}
              isMobile={isMobile}
              expanded={expandedRow === person.email}
              onToggle={() => setExpandedRow(expandedRow === person.email ? null : person.email)}
            />
          ))
        )}

        {/* Totals footer */}
        {(byProject.length > 0 || byPerson.length > 0) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
            padding: '12px 16px',
            borderTop: '2px solid var(--c-border)',
            background: 'var(--c-bg-muted)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)' }}>TOTAL</span>
            {!isMobile && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>{fmtH(totalSecs)}</span>}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)' }}>{fmt€(totalCost)}</span>
            {!isMobile && <span />}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Project row ─────────────────────────────────────────────────────────────
function ProjectRow({ proj, isMobile, expanded, onToggle }) {
  const people = Object.values(proj.people).sort((a, b) => b.cost - a.cost)
  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--c-border-light)',
          cursor: 'pointer',
          transition: 'background 0.1s',
          background: expanded ? 'var(--c-bg-muted)' : 'transparent',
          alignItems: 'center',
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
        <span style={{ fontSize: 13, fontWeight: 700, color: '#7C4DFF' }}>{fmt€(proj.totalCost)}</span>
        {!isMobile && <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{people.length > 1 ? `${people.length} tarifas` : people[0] ? `${people[0].rate} €/h` : ''}</span>}
      </div>

      {/* Expanded: people breakdown */}
      {expanded && people.map(p => (
        <div key={p.email} style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
          padding: '8px 16px 8px 36px',
          borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-app)',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C4DFF22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7C4DFF' }}>{p.name.charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 600 }}>{fmt€(p.cost)}</span>
          {!isMobile && <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{p.rate} €/h</span>}
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
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--c-border-light)',
          cursor: 'pointer',
          transition: 'background 0.1s',
          background: expanded ? 'var(--c-bg-muted)' : 'transparent',
          alignItems: 'center',
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
        <span style={{ fontSize: 13, fontWeight: 700, color: '#7C4DFF' }}>{fmt€(person.totalCost)}</span>
        {!isMobile && <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{person.rate} €/h</span>}
      </div>

      {/* Expanded: project breakdown */}
      {expanded && projs.map(p => (
        <div key={p.id} style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 72px 80px' : '1fr 120px 120px 100px',
          padding: '8px 16px 8px 52px',
          borderBottom: '1px solid var(--c-border-light)',
          background: 'var(--c-bg-app)',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 600 }}>{fmt€(p.cost)}</span>
          {!isMobile && <span />}
        </div>
      ))}
    </>
  )
}
