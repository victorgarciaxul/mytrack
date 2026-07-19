import { useState, useEffect, useMemo } from 'react'
import { DollarSign, ChevronDown, ChevronUp, TrendingUp, Users, Briefcase, Filter, Building2, Percent, Landmark } from 'lucide-react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { useRole } from '../context/RoleContext'
import { useNavigate } from 'react-router-dom'
import { supabaseClient, getWsId, initDB } from '../lib/db'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Date helpers ─────────────────────────────────────────────────────────────
const THIS_MONTH = () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })

// Normalise project IDs: strip workspace suffixes so -xul and bare IDs merge
const normId = (id, name) => id
  ? String(id).replace(/-xul$/, '').replace(/-fundacion$/, '')
  : `__null__${(name || '').trim().toLowerCase()}`

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

// Proyectos que componen el COSTE ESTRUCTURAL de XUL (match por nombre, sin
// distinguir mayúsculas/acentos). Solo los 7 solicitados.
const STRUCTURAL_PROJECTS = [
  'XUL - Desarrollo de negocio',
  'XUL - Miscelánea',
  'XUL - Estructura',
  'XUL - Bcorp',
  'XUL - Contabilidad',
  'XUL - Administración',
  'XUL - Producción y eventos',
]
const normName = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const STRUCTURAL_SET = new Set(STRUCTURAL_PROJECTS.map(normName))

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
  const { isAdmin, role, costProjects } = useRole()
  // costProjects = null → no access; array of names → restricted project-only access
  // undefined = still loading; null = no access; array = restricted access
  const costProjectsLoaded = costProjects !== undefined
  const hasCostAccess = isAdmin || (costProjectsLoaded && costProjects !== null && costProjects.length > 0)
  const navigate   = useNavigate()
  const isMobile   = useMediaQuery('(max-width: 768px)')

  const [loading,      setLoading]      = useState(true)
  const [members,      setMembers]      = useState([])
  const [entries,      setEntries]      = useState([])
  const [from,         setFrom]         = useState(() => THIS_MONTH().from)
  const [to,           setTo]           = useState(() => THIS_MONTH().to)
  const [filterUser,   setFilterUser]   = useState('all')
  const [filterProj,   setFilterProj]   = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [viewMode,     setViewMode]     = useState('project')
  const [sortCol,      setSortCol]      = useState('cost')
  const [sortDir,      setSortDir]      = useState('desc')
  const [expandedRow,  setExpandedRow]  = useState(null)
  const [structOpen,   setStructOpen]   = useState(false)

  useEffect(() => {
    if (role !== null && costProjectsLoaded && !hasCostAccess) navigate('/tracker', { replace: true })
  }, [role, costProjectsLoaded, hasCostAccess])

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
        const fromISO = from.toISOString(), toISO = to.toISOString()
        const wsIds = [getWsId()]
        const allMems = [], allEnts = []
        for (const wsId of wsIds) {
          const [{ data: m }, { data: e }] = await Promise.all([
            supabaseClient.rpc('report_cost_members', { p_workspace_id: wsId }),
            supabaseClient.rpc('report_cost_entries', { p_workspace_id: wsId, p_from: fromISO, p_to: toISO }),
          ])
          ;(m || []).forEach(mb => { if (!allMems.some(x => x.user_email === mb.user_email)) allMems.push(mb) })
          allEnts.push(...(e || []))
        }
        const mems = allMems, ents = allEnts
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
  }, [from, to, isAdmin])

  // If user has restricted cost access, only show their allowed projects
  const dateFiltered = useMemo(() => {
    if (!costProjects || isAdmin) return entries
    return entries.filter(e =>
      costProjects.some(p => (e.project_name || '').toLowerCase().includes(p.toLowerCase()))
    )
  }, [entries, costProjects, isAdmin])

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
      const key = normId(e.project_id, e.project_name)
      if (!map[key])
        map[key] = { id: key, name: e.project_name || 'Sin proyecto', color: e.project_color || '#7C4DFF' }
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
    if (filterProj   !== 'all') rows = rows.filter(e => normId(e.project_id, e.project_name) === filterProj)
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
      const projId = normId(e.project_id, e.project_name)
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
      const projId = normId(e.project_id, e.project_name)
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
      const projId = normId(e.project_id, e.project_name)
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

  // ── COSTE ESTRUCTURAL — suma de los proyectos "XUL - ..." estructurales ──────
  // Independiente de los filtros de la UI (usa dateFiltered), pero respeta el rango
  // de fechas. Muestra coste real (horas × tarifa) e imputado, para ser más completo.
  const structural = useMemo(() => {
    let realCost = 0, imputCost = 0, secs = 0
    const byProj = {}
    dateFiltered.forEach(e => {
      if (!STRUCTURAL_SET.has(normName(e.project_name))) return
      const rate = rateMap[e.user_email] || 0
      if (!rate) return
      const mc          = monthlyCostMap[e.user_email] || 0
      const personTotal = personTotalSecs[e.user_email] || e.duration
      const cappedTotal = Math.max(personTotal, periodCapacitySecs)
      const real  = (e.duration / 3600) * rate
      const imput = (e.duration / cappedTotal) * mc * periodMonths
      realCost  += real
      imputCost += imput
      secs      += e.duration
      const key = e.project_name
      if (!byProj[key]) byProj[key] = { name: key, color: e.project_color || '#7C4DFF', realCost: 0, imputCost: 0, secs: 0 }
      byProj[key].realCost  += real
      byProj[key].imputCost += imput
      byProj[key].secs      += e.duration
    })
    const projects = Object.values(byProj).sort((a, b) => b.realCost - a.realCost)
    return { realCost, imputCost, secs, projects }
  }, [dateFiltered, rateMap, monthlyCostMap, personTotalSecs, periodCapacitySecs, periodMonths])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }) => sortCol === col
    ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
    : null

  if (costProjectsLoaded && !hasCostAccess) return null
  if (!isAdmin && (!costProjectsLoaded || role === null)) return (
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

        {/* Date range selector */}
        <DateRangePicker
          from={from} to={to}
          onChange={({ from: f, to: t }) => { setFrom(f); setTo(t) }}
        />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard icon={DollarSign} label="Coste imputado"    value={fmtEUR(totalImputCost)} color="#8B5CF6" isMobile={isMobile} />
        <StatCard icon={Percent}    label="% Imputación"      value={totalImputBudget > 0 ? fmtPct(totalImputCost / totalImputBudget * 100) : '—'} color="#7C4DFF" isMobile={isMobile} />
        <StatCard icon={TrendingUp} label="Horas registradas" value={fmtH(totalSecs)}        color="#06B6D4" isMobile={isMobile} />
        <StatCard icon={Users}      label="Perfiles activos"  value={totalPeople}             color="#10B981" isMobile={isMobile} />
        <StatCard icon={Briefcase}  label="Proyectos"         value={byProject.length}        color="#F59E0B" isMobile={isMobile} />
      </div>

      {/* Coste estructural — suma de los proyectos XUL de estructura (solo admins) */}
      {isAdmin && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,77,255,0.10), rgba(139,92,246,0.04))',
          border: '1px solid rgba(124,77,255,0.25)', borderRadius: 14,
          marginBottom: 16, overflow: 'hidden',
        }}>
          {/* Cabecera clicable */}
          <div
            onClick={() => setStructOpen(o => !o)}
            style={{
              padding: isMobile ? '14px 16px' : '16px 22px',
              display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18, flexWrap: 'wrap',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,77,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Landmark size={20} color="#7C4DFF" />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                Coste estructural
                {structOpen ? <ChevronUp size={14} color="var(--c-text-4)" /> : <ChevronDown size={14} color="var(--c-text-4)" />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginTop: 2 }}>
                {structural.projects.length} proyectos XUL de estructura · {fmtH(structural.secs)} · toca para {structOpen ? 'ocultar' : 'ver'} desglose
              </div>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 20 : 34, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Coste real</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--c-text-1)' }}>{fmtEUR(structural.realCost)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Coste imputado</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#7C4DFF' }}>{fmtEUR(structural.imputCost)}</div>
              </div>
            </div>
          </div>

          {/* Desglose por proyecto */}
          {structOpen && (
            <div style={{ borderTop: '1px solid rgba(124,77,255,0.20)', padding: isMobile ? '4px 10px 8px' : '4px 22px 10px' }}>
              {structural.projects.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--c-text-4)', padding: '12px 0' }}>Sin registros en el periodo seleccionado.</div>
              )}
              {structural.projects.map(p => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0', borderBottom: '1px solid var(--c-border-light)',
                }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)', width: 70, textAlign: 'right', flexShrink: 0 }}>{fmtH(p.secs)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', width: isMobile ? 90 : 110, textAlign: 'right', flexShrink: 0 }}>{fmtEUR(p.realCost)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7C4DFF', width: isMobile ? 90 : 110, textAlign: 'right', flexShrink: 0 }}>{fmtEUR(p.imputCost)}</span>
                </div>
              ))}
              {structural.projects.length > 0 && (
                <div style={{ display: 'flex', gap: 10, padding: '8px 0 2px', fontSize: 10, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span style={{ flex: 1 }} />
                  <span style={{ width: 70, textAlign: 'right' }}>Horas</span>
                  <span style={{ width: isMobile ? 90 : 110, textAlign: 'right' }}>Real</span>
                  <span style={{ width: isMobile ? 90 : 110, textAlign: 'right' }}>Imputado</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters row */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMobile ? 10 : 0, flexWrap: 'wrap' }}>
          <Filter size={13} color="var(--c-text-4)" style={{ flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {[['project', 'Por proyecto'], ['person', 'Por persona'], ['client', 'Por cliente']].filter(([v]) => isAdmin || v === 'project').map(([v, l]) => (
              <button key={v} onClick={() => { setViewMode(v); setExpandedRow(null) }} style={{
                padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: viewMode === v ? '#7C4DFF22' : 'transparent',
                color: viewMode === v ? '#7C4DFF' : 'var(--c-text-3)',
                border: viewMode === v ? '1.5px solid #7C4DFF55' : '1.5px solid transparent',
              }}>{l}</button>
            ))}
          </div>
          {!isMobile && <div style={{ width: 1, height: 20, background: 'var(--c-border-light)' }} />}
          {!isMobile && isAdmin && <>
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
        {isMobile && isAdmin && (
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
                  periodCapacitySecs={periodCapacitySecs}
                  showPeople={true}
                  showPersonCost={isAdmin} />
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
function ProjectRow({ proj, isMobile, expanded, onToggle, periodCapacitySecs, showPeople = true, showPersonCost = true }) {
  const people = Object.values(proj.people || {}).sort((a, b) => b.cost - a.cost)
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
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7C4DFF' }}>{(p.name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>{fmtH(p.secs)}</span>}
          {!isMobile && <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>
            {showPersonCost ? (p.personTotal ? fmtPct(p.secs / p.personTotal * 100) : '—') : ''}
          </span>}
          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 700, textAlign: isMobile ? 'right' : 'left' }}>
            {showPersonCost ? (p.mc > 0 ? fmtEUR(p.imputCost) : '—') : fmtH(p.secs)}
          </span>
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
