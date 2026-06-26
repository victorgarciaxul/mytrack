import { useState, useEffect, useMemo } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Download, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { dbGetEntriesForPeriod, dbDeleteEntry, getWsId } from '../lib/db'
import { loadClockifyCache } from '../lib/clockify'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import {
  format, startOfDay, startOfWeek, endOfWeek,
  eachDayOfInterval, parseISO, isWithinInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'
import DateRangePicker from '../components/ui/DateRangePicker'

// ── helpers ────────────────────────────────────────────────────
function fmtDuration(secs) {
  const s = Number(secs) || 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}
function fmtH(secs) {
  const s = Number(secs) || 0
  return (s / 3600).toFixed(2) + 'h'
}

const TABS = ['Resumido', 'Detallado']

const JAVIER_EMAIL = 'javier@xul.es'
const JAVIER_TEAM_PROJECTS = [
  'Aprende Volando',
  'Andalucía Vuela (Ciudadanía)',
  'Andalucía Vuela (Empresas)',
  'El Basado de Comunicación',
]

const AITOR_EMAIL = 'aitorrecalde@xul.es'
const AITOR_TEAM_MEMBERS = [
  'lolagravan@xul.es',
  'josemitoribio@xul.es',
  'martagarcia@xul.es',
]

const JORGE_EMAIL = 'jorgemelo@xul.es'
const JORGE_TEAM_PROJECTS = [
  'Andalucía Vuela (Empresas)',
]

const AUXI_EMAIL = 'auximazuecos@xul.es'
const AUXI_TEAM_PROJECTS = [
  'CCOOSevilla_Campaña inmigrantes',
]

const CustomXTick = ({ x, y, payload }) => {
  const parts = payload.value?.split('|') || [payload.value]
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fontSize={11} fill="var(--c-text-3)">{parts[0]}</text>
      {parts[1] && <text x={0} y={0} dy={22} textAnchor="middle" fontSize={10} fill="var(--c-text-4)">{parts[1]}</text>}
    </g>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--c-text-1)', color: '#fff', padding: '6px 12px', borderRadius: 10, fontSize: 12 }}>
      <span style={{ fontWeight: 700 }}>{payload[0].value}h</span>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────
export default function Reports() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const isJavier = user?.email === JAVIER_EMAIL
  const isAitor  = user?.email === AITOR_EMAIL
  const isJorge  = user?.email === JORGE_EMAIL
  const isAuxi   = user?.email === AUXI_EMAIL
  const [tab, setTab] = useState('Resumido')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Date range — default to current week
  const [from, setFrom] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [to,   setTo]   = useState(() => endOfWeek(new Date(), { weekStartsOn: 1 }))

  // Filter state — non-admins are locked to their own email
  const [filterProject,  setFilterProject]  = useState('ALL')
  const [filterClient,   setFilterClient]   = useState('ALL')
  const [filterBillable, setFilterBillable] = useState('ALL')
  const [filterUser,     setFilterUser]     = useState('ALL')

  useEffect(() => {
    if (!from || !to) return
    loadData()
  }, [from, to])

  async function loadData() {
    setLoading(true)
    try {
      // Fetch directly — DB is already initialised from login/Tracker
      const rows = await dbGetEntriesForPeriod(from, to)
      if (rows.length > 0) {
        setEntries(rows.map(r => ({
          ...r,
          projects: r.project_id ? { name: r.project_name, color: r.project_color } : null,
        })))
        setLoading(false)
        return
      }
      // Fallback: Clockify cache (Victor)
      const cache = loadClockifyCache()
      if (cache?.entries?.length) {
        setEntries(cache.entries.filter(e => {
          try { return isWithinInterval(parseISO(e.start_time), { start: from, end: to }) }
          catch { return false }
        }))
      }
    } catch (err) {
      console.error('Report load error:', err)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta entrada?')) return
    setDeletingId(id)
    try {
      await dbDeleteEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Error al borrar:', err)
      alert('No se pudo borrar la entrada')
    }
    setDeletingId(null)
  }

  // When viewing Fundación workspace, only entries from @fundacionxul.org count
  const isFundacion = getWsId() === 'fundacion-ws-1'

  // ── derived ─────────────────────────────────────────────────
  const filtered = useMemo(() => entries.filter(e => {
    // Fundación workspace: only the two Fundación users
    if (isFundacion && !e.user_email?.endsWith('@fundacionxul.org')) return false
    // Non-admins only see their own entries regardless of filter
    if (!isAdmin && e.user_email !== user?.email) return false
    if (filterProject  !== 'ALL' && (e.project_name || 'Sin proyecto').toLowerCase() !== filterProject.toLowerCase()) return false
    if (filterClient   !== 'ALL' && (e.client_name  || 'Sin cliente').toLowerCase()  !== filterClient.toLowerCase())  return false
    if (filterUser     !== 'ALL' && e.user_email !== filterUser) return false
    if (filterBillable === 'YES' && !e.billable) return false
    if (filterBillable === 'NO'  &&  e.billable) return false
    return true
  }), [entries, filterProject, filterClient, filterUser, filterBillable, isAdmin, user?.email, isFundacion])

  // Base entries for building filter options (scoped to Fundación if applicable)
  const baseEntries = isFundacion
    ? entries.filter(e => e.user_email?.endsWith('@fundacionxul.org'))
    : entries

  // Filter options are cross-constrained: picking a client limits projects shown, and vice versa
  const projects = [...new Set(
    baseEntries
      .filter(e => filterClient  === 'ALL' || (e.client_name  || 'Sin cliente')  === filterClient)
      .map(e => e.project_name || 'Sin proyecto')
  )].sort()
  const clients  = [...new Set(
    baseEntries
      .filter(e => filterProject === 'ALL' || (e.project_name || 'Sin proyecto') === filterProject)
      .map(e => e.client_name  || 'Sin cliente')
  )].sort()
  // In Fundación always show both users, even if one has no entries in this period
  const users = isFundacion
    ? ['anarojas@fundacionxul.org', 'cristinareyes@fundacionxul.org']
    : [...new Set(baseEntries.map(e => e.user_email).filter(Boolean))].sort()

  const totalSecs    = filtered.reduce((s, e) => s + (Number(e.duration) || 0), 0)
  const billableSecs = filtered.filter(e => e.billable).reduce((s, e) => s + (Number(e.duration) || 0), 0)

  // Bar chart by day
  const days = eachDayOfInterval({ start: from, end: to })
  const diffDaysTotal = Math.round((startOfDay(to) - startOfDay(from)) / 86400000)
  const byDayData = days.map(day => {
    const key = format(day, 'yyyy-MM-dd')
    const secs = filtered
      .filter(e => { try { return format(parseISO(e.start_time), 'yyyy-MM-dd') === key } catch { return false } })
      .reduce((s, e) => s + (Number(e.duration) || 0), 0)
    const labelFmt = diffDaysTotal <= 7 ? 'EEE' : diffDaysTotal <= 31 ? 'd' : 'd MMM'
    const label = format(day, labelFmt, { locale: es })
    const sub   = diffDaysTotal <= 7 ? format(day, 'd/M') : null
    return {
      name:  sub ? `${label}|${sub}` : label,
      horas: parseFloat((secs / 3600).toFixed(2)),
    }
  })

  // Pie chart by project
  const byProjectMap = {}
  filtered.forEach(e => {
    const name  = e.project_name  || 'Sin proyecto'
    const color = e.project_color || '#C0C0E0'
    if (!byProjectMap[name]) byProjectMap[name] = { name, value: 0, color }
    byProjectMap[name].value += (Number(e.duration) || 0) / 3600
  })
  const pieData = Object.values(byProjectMap)
    .map(p => ({ ...p, value: parseFloat(p.value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)

  // Resumido: group by project → client
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const proj   = e.project_name  || 'Sin proyecto'
      const client = e.client_name   || ''
      const color  = e.project_color || '#C0C0E0'
      if (!map[proj]) map[proj] = { name: proj, client, color, secs: 0, billable: 0, count: 0 }
      map[proj].secs     += Number(e.duration) || 0
      map[proj].billable += e.billable ? (Number(e.duration) || 0) : 0
      map[proj].count    += 1
    })
    return Object.values(map).sort((a, b) => b.secs - a.secs)
  }, [filtered])

  function exportToExcel() {
    const wb = XLSX.utils.book_new()

    // ── Hoja 1: Resumen por proyecto ──
    const resumidoData = [
      ['#', 'Proyecto', 'Cliente', 'Entradas', 'Duración (h)', 'Facturable (h)'],
      ...grouped.map((g, i) => [
        i + 1,
        g.name,
        g.client || '',
        g.count,
        parseFloat((g.secs / 3600).toFixed(2)),
        parseFloat((g.billable / 3600).toFixed(2)),
      ]),
      ['', 'TOTAL', '', filtered.length, parseFloat((totalSecs / 3600).toFixed(2)), parseFloat((billableSecs / 3600).toFixed(2))],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(resumidoData)
    ws1['!cols'] = [{ wch: 4 }, { wch: 36 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

    // ── Hoja 2: Detallado ──
    const detalladoData = [
      ['Descripción', 'Proyecto', 'Cliente', 'Usuario', 'Fecha', 'Hora inicio', 'Duración (h)', 'Facturable'],
      ...filtered.map(e => {
        const dt = e.start_time ? parseISO(e.start_time) : null
        return [
          e.description || '',
          e.project_name || 'Sin proyecto',
          e.client_name  || 'Sin cliente',
          e.user_email   || '',
          dt ? format(dt, 'dd/MM/yyyy') : '',
          dt ? format(dt, 'HH:mm')      : '',
          parseFloat(((Number(e.duration) || 0) / 3600).toFixed(2)),
          e.billable ? 'Sí' : 'No',
        ]
      }),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(detalladoData)
    ws2['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Detallado')

    // File name with range
    const fromStr = format(from, 'dd-MM-yyyy')
    const toStr   = format(to,   'dd-MM-yyyy')
    const fileName = `informe_${fromStr}_${toStr}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // ── Equipo view (Auxi) ───────────────────────────────────────────────────
  const auxiTeamByProject = useMemo(() => {
    if (!isAuxi) return []
    return AUXI_TEAM_PROJECTS.map(projName => {
      const projEntries = entries.filter(e => e.project_name === projName)
      const byPerson = {}
      projEntries.forEach(e => {
        if (!byPerson[e.user_email]) byPerson[e.user_email] = { name: e.user_name || e.user_email, secs: 0, tasks: {} }
        byPerson[e.user_email].secs += Number(e.duration) || 0
        const taskKey = e.task_name || 'Sin tarea'
        if (!byPerson[e.user_email].tasks[taskKey]) byPerson[e.user_email].tasks[taskKey] = 0
        byPerson[e.user_email].tasks[taskKey] += Number(e.duration) || 0
      })
      const people = Object.entries(byPerson)
        .map(([email, d]) => ({
          email, name: d.name, secs: d.secs,
          tasks: Object.entries(d.tasks).map(([name, secs]) => ({ name, secs })).sort((a, b) => b.secs - a.secs),
        }))
        .sort((a, b) => b.secs - a.secs)
      return { name: projName, color: projEntries[0]?.project_color || '#7C4DFF', people, totalSecs: people.reduce((s, p) => s + p.secs, 0) }
    })
  }, [entries, isAuxi])

  // ── Equipo view (Jorge): horas de todos en Vuela Empresas ────────────────
  const jorgeTeamByProject = useMemo(() => {
    if (!isJorge) return []
    return JORGE_TEAM_PROJECTS.map(projName => {
      const projEntries = entries.filter(e => e.project_name === projName)
      const byPerson = {}
      projEntries.forEach(e => {
        if (!byPerson[e.user_email]) byPerson[e.user_email] = { name: e.user_name || e.user_email, secs: 0 }
        byPerson[e.user_email].secs += Number(e.duration) || 0
      })
      const people = Object.entries(byPerson)
        .map(([email, d]) => ({ email, name: d.name, secs: d.secs }))
        .sort((a, b) => b.secs - a.secs)
      const totalSecs = people.reduce((s, p) => s + p.secs, 0)
      const color = projEntries[0]?.project_color || '#7C4DFF'
      return { name: projName, color, people, totalSecs }
    })
  }, [entries, isJorge])

  // ── Equipo view (Aitor): horas de sus 3 compañeros agrupadas por proyecto ──
  const aitorTeamByProject = useMemo(() => {
    if (!isAitor) return []
    const teamEntries = entries.filter(e => AITOR_TEAM_MEMBERS.includes(e.user_email))
    const byProj = {}
    teamEntries.forEach(e => {
      const proj = e.project_name || 'Sin proyecto'
      if (!byProj[proj]) byProj[proj] = { name: proj, color: e.project_color || '#7C4DFF', people: {}, totalSecs: 0 }
      if (!byProj[proj].people[e.user_email]) byProj[proj].people[e.user_email] = { name: e.user_name || e.user_email, secs: 0 }
      byProj[proj].people[e.user_email].secs += Number(e.duration) || 0
      byProj[proj].totalSecs += Number(e.duration) || 0
    })
    return Object.values(byProj)
      .sort((a, b) => b.totalSecs - a.totalSecs)
      .map(p => ({ ...p, people: Object.entries(p.people).map(([email, d]) => ({ email, name: d.name, secs: d.secs })).sort((a, b) => b.secs - a.secs) }))
  }, [entries, isAitor])

  // ── Equipo view (Javier only) ─────────────────────────────────
  const teamByProject = useMemo(() => {
    if (!isJavier) return []
    return JAVIER_TEAM_PROJECTS.map(projName => {
      const projEntries = entries.filter(e => e.project_name === projName)
      const byPerson = {}
      projEntries.forEach(e => {
        if (!byPerson[e.user_email]) byPerson[e.user_email] = { name: e.user_name || e.user_email, secs: 0 }
        byPerson[e.user_email].secs += Number(e.duration) || 0
      })
      const people = Object.entries(byPerson)
        .map(([email, d]) => ({ email, name: d.name, secs: d.secs }))
        .sort((a, b) => b.secs - a.secs)
      const totalSecs = people.reduce((s, p) => s + p.secs, 0)
      const color = projEntries[0]?.project_color || '#7C4DFF'
      return { name: projName, color, people, totalSecs }
    })
  }, [entries, isJavier])

  const selectStyle = {
    background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)',
    borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--c-text-1)',
    outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ padding: isMobile ? '10px 14px' : '14px 28px', borderBottom: '1px solid var(--c-border-light)', display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[...TABS, ...((isJavier || isAitor || isJorge || isAuxi) ? ['Equipo'] : [])].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#fff' : 'var(--c-text-3)',
              background: tab === t ? '#7C4DFF' : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--c-border-light)' }} />

        <DateRangePicker
          from={from} to={to}
          onChange={({ from: f, to: t }) => { setFrom(f); setTo(t) }}
        />

        <div style={{ flex: 1 }} />

        {/* Filters */}
        {isAdmin && (
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
            <option value="ALL">{isFundacion ? 'Ambas usuarias' : 'Todos los usuarios'}</option>
            {users.map(u => (
              <option key={u} value={u}>
                {u === 'anarojas@fundacionxul.org'      ? 'Ana Rojas'
                : u === 'cristinareyes@fundacionxul.org' ? 'Cristina Reyes'
                : u.split('@')[0]}
              </option>
            ))}
          </select>
        )}
        <select value={filterProject} onChange={e => {
          setFilterProject(e.target.value)
          // If the currently selected client is no longer valid with this project, reset it
          if (filterClient !== 'ALL') {
            const validClients = new Set(baseEntries
              .filter(en => e.target.value === 'ALL' || (en.project_name || 'Sin proyecto') === e.target.value)
              .map(en => en.client_name || 'Sin cliente'))
            if (!validClients.has(filterClient)) setFilterClient('ALL')
          }
        }} style={selectStyle}>
          <option value="ALL">Todos los proyectos</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterClient} onChange={e => {
          setFilterClient(e.target.value)
          // If the currently selected project is no longer valid with this client, reset it
          if (filterProject !== 'ALL') {
            const validProjects = new Set(baseEntries
              .filter(en => e.target.value === 'ALL' || (en.client_name || 'Sin cliente') === e.target.value)
              .map(en => en.project_name || 'Sin proyecto'))
            if (!validProjects.has(filterProject)) setFilterProject('ALL')
          }
        }} style={selectStyle}>
          <option value="ALL">Todos los clientes</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterBillable} onChange={e => setFilterBillable(e.target.value)} style={selectStyle}>
          <option value="ALL">Facturable / No</option>
          <option value="YES">Solo facturable</option>
          <option value="NO">No facturable</option>
        </select>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ padding: isMobile ? '10px 14px' : '12px 28px', borderBottom: '1px solid var(--c-border-light)', display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 28, flexShrink: 0, background: 'var(--c-bg-muted)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>TOTAL</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(totalSecs)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>FACTURABLE</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#10B981', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(billableSecs)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>ENTRADAS</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#7C4DFF' }}>{filtered.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>PROYECTOS</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#03A9F4' }}>{pieData.length}</span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={exportToExcel}
          disabled={filtered.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9,
            background: filtered.length === 0 ? 'var(--c-bg-muted)' : '#217346',
            border: '1px solid ' + (filtered.length === 0 ? 'var(--c-border-light)' : '#1a5c38'),
            color: filtered.length === 0 ? 'var(--c-text-4)' : '#fff',
            fontSize: 12, fontWeight: 600, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { if (filtered.length > 0) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Download size={14} />
          Excel
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : '20px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: 16, marginBottom: 20 }}>
              {/* Bar chart */}
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, padding: '18px 20px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 16px' }}>Horas por día</p>
                <ResponsiveContainer width="100%" height={diffDaysTotal <= 7 ? 196 : 180}>
                  <BarChart data={byDayData} barSize={diffDaysTotal <= 7 ? 28 : 14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-light)" vertical={false} />
                    <XAxis dataKey="name" tick={<CustomXTick />} tickLine={false} axisLine={false} height={diffDaysTotal <= 7 ? 36 : 20} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(123,104,238,0.06)', radius: 6 }} />
                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                      {byDayData.map((entry, i) => (
                        <Cell key={i} fill={entry.horas > 0 ? 'url(#barGrad)' : 'var(--c-border-light)'} />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C4DFF" />
                        <stop offset="100%" stopColor="#6B3EED" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, padding: '18px 20px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Por proyecto</p>
                {pieData.length === 0 ? (
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--c-text-4)' }}>Sin datos</div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={3} dataKey="value">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={v => [`${v}h`]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, maxHeight: 100, overflowY: 'auto' }}>
                  {pieData.slice(0, 6).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-1)' }}>{p.value}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RESUMIDO: grouped by project ── */}
            {tab === 'Resumido' && (
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '24px 1fr 48px 72px' : '40px 1fr 100px 100px', padding: isMobile ? '8px 14px' : '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
                  {(isMobile ? ['#', 'Proyecto', 'Ent.', 'Dur.'] : ['#', 'Proyecto / Cliente', 'Entradas', 'Duración']).map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
                  ))}
                </div>

                {grouped.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '32px 0' }}>Sin entradas en este período</p>
                ) : grouped.map((g, i) => (
                  <div key={g.name}
                    style={{ display: 'grid', gridTemplateColumns: isMobile ? '24px 1fr 48px 72px' : '40px 1fr 100px 100px', padding: isMobile ? '10px 14px' : '13px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* # */}
                    <span style={{ fontSize: 12, color: 'var(--c-text-4)', fontWeight: 600 }}>{i + 1}</span>

                    {/* Project + client */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{g.name}</p>
                        {g.client && <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>{g.client}</p>}
                      </div>
                    </div>

                    {/* Count */}
                    <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{g.count}</span>

                    {/* Duration */}
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(g.secs)}</span>
                      {g.billable > 0 && (
                        <p style={{ fontSize: 10, color: '#10B981', margin: 0 }}>Fact. {fmtDuration(g.billable)}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total row */}
                {grouped.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '24px 1fr 48px 72px' : '40px 1fr 100px 100px', padding: isMobile ? '10px 14px' : '12px 20px', background: 'var(--c-bg-muted)', borderTop: '1px solid var(--c-border-light)' }}>
                    <span />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>{filtered.length}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#7C4DFF', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(totalSecs)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── DETALLADO: individual entries ── */}
            {tab === 'Detallado' && (
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px 36px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
                  {['Descripción', 'Proyecto', 'Fecha', 'Duración', ''].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '32px 0' }}>Sin entradas en este período</p>
                ) : filtered.map(e => (
                  <div key={e.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px 36px', padding: '11px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center', opacity: deletingId === e.id ? 0.4 : 1 }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--c-bg-muted)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                  >
                    {/* Description */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 3, height: 24, borderRadius: 2, background: e.project_color || '#E0E0F0', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: (!e.duration || e.duration === 0) ? '#EF4444' : 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {e.description || <span style={{ color: 'var(--c-text-4)', fontStyle: 'italic' }}>Sin descripción</span>}
                        </p>
                        {e.user_name && <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>{e.user_email}</p>}
                      </div>
                    </div>

                    {/* Project */}
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: (e.project_color || '#E0E0F0') + '18', color: e.project_color || 'var(--c-text-3)', fontWeight: 500 }}>
                        {e.project_name || 'Sin proyecto'}
                      </span>
                    </div>

                    {/* Date */}
                    <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
                      {e.start_time ? format(parseISO(e.start_time), 'dd/MM/yyyy HH:mm') : '—'}
                    </span>

                    {/* Duration */}
                    <span style={{ fontSize: 13, fontWeight: 700, color: (!e.duration || e.duration === 0) ? '#EF4444' : 'var(--c-text-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDuration(e.duration)}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--c-text-4)', display: 'flex', alignItems: 'center' }}
                      onMouseEnter={ev => ev.currentTarget.style.color = '#EF4444'}
                      onMouseLeave={ev => ev.currentTarget.style.color = 'var(--c-text-4)'}
                      title="Borrar entrada"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          {/* ── Pestaña Equipo (Auxi) ── */}
          {tab === 'Equipo' && isAuxi && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {auxiTeamByProject.map(proj => (
                <div key={proj.name} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--c-border-light)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>{proj.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-3)' }}>{proj.people.length} {proj.people.length === 1 ? 'persona' : 'personas'}</span>
                  </div>
                  {proj.people.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-text-4)' }}>Sin entradas en este período</div>
                  ) : (
                    <>
                      {proj.people.map(p => (
                        <div key={p.email} style={{ borderBottom: '1px solid var(--c-border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{p.email}</div>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text-1)' }}>{fmtDuration(p.secs)}</span>
                          </div>
                          {p.tasks?.map(t => (
                            <div key={t.name} style={{ display: 'flex', alignItems: 'center', padding: '5px 16px 5px 32px', gap: 12, background: 'var(--c-bg-muted)' }}>
                              <span style={{ fontSize: 12, color: 'var(--c-text-3)', flex: 1 }}>· {t.name}</span>
                              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text-3)' }}>{fmtDuration(t.secs)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'var(--c-bg-muted)', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}>TOTAL PROYECTO</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#7C4DFF' }}>{fmtDuration(proj.totalSecs)}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Pestaña Equipo (Jorge) ── */}
          {tab === 'Equipo' && isJorge && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {jorgeTeamByProject.map(proj => (
                <div key={proj.name} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--c-border-light)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>{proj.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-3)' }}>{proj.people.length} {proj.people.length === 1 ? 'persona' : 'personas'}</span>
                  </div>
                  {proj.people.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-text-4)' }}>Sin entradas en este período</div>
                  ) : (
                    <>
                      {proj.people.map(p => (
                        <div key={p.email} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--c-border-light)', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{p.email}</div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text-1)' }}>{fmtDuration(p.secs)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'var(--c-bg-muted)', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}>TOTAL PROYECTO</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#7C4DFF' }}>{fmtDuration(proj.totalSecs)}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Pestaña Equipo (Aitor) ── */}
          {tab === 'Equipo' && isAitor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {aitorTeamByProject.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-4)', fontSize: 14 }}>Sin entradas en este período</div>
              ) : aitorTeamByProject.map(proj => (
                <div key={proj.name} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--c-border-light)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>{proj.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-3)' }}>{proj.people.length} {proj.people.length === 1 ? 'persona' : 'personas'}</span>
                  </div>
                  {proj.people.map(p => (
                    <div key={p.email} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--c-border-light)', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{p.email}</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text-1)' }}>{fmtDuration(p.secs)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'var(--c-bg-muted)', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}>TOTAL PROYECTO</span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#7C4DFF' }}>{fmtDuration(proj.totalSecs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Pestaña Equipo (solo Javier) ── */}
          {tab === 'Equipo' && isJavier && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {teamByProject.map(proj => (
                <div key={proj.name} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--c-border-light)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>{proj.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-3)' }}>{proj.people.length} {proj.people.length === 1 ? 'persona' : 'personas'}</span>
                  </div>
                  {/* Rows */}
                  {proj.people.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-text-4)' }}>Sin entradas en este período</div>
                  ) : (
                    <>
                      {proj.people.map(p => (
                        <div key={p.email} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--c-border-light)', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)' }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>{p.email}</div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text-1)' }}>{fmtDuration(p.secs)}</span>
                        </div>
                      ))}
                      {/* Total */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'var(--c-bg-muted)', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}>TOTAL PROYECTO</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#7C4DFF' }}>{fmtDuration(proj.totalSecs)}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
