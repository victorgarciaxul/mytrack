import { useState, useEffect, useMemo } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { dbGetEntriesForPeriod, getWsId } from '../lib/db'
import { loadClockifyCache } from '../lib/clockify'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, subWeeks, addWeeks, subMonths, addMonths,
  parseISO, isWithinInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'

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

const RANGE_TYPES = [
  { label: 'Semana', value: 'week' },
  { label: 'Mes',    value: 'month' },
]
const TABS = ['Resumido', 'Detallado']

function getRange(type, anchor) {
  if (type === 'week') return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
}
function shiftAnchor(type, anchor, dir) {
  if (type === 'week') return dir > 0 ? addWeeks(anchor, 1) : subWeeks(anchor, 1)
  return dir > 0 ? addMonths(anchor, 1) : subMonths(anchor, 1)
}
function rangeLabel(type, from, to) {
  if (type === 'week') {
    const s = format(from, 'd MMM', { locale: es })
    const e = format(to, 'd MMM yyyy', { locale: es })
    return `${s} – ${e}`
  }
  return format(from, 'MMMM yyyy', { locale: es })
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
  const [tab, setTab] = useState('Resumido')
  const [rangeType, setRangeType] = useState('week')
  const [anchor, setAnchor] = useState(new Date())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  // Filter state — non-admins are locked to their own email
  const [filterProject,  setFilterProject]  = useState('ALL')
  const [filterClient,   setFilterClient]   = useState('ALL')
  const [filterBillable, setFilterBillable] = useState('ALL')
  const [filterUser,     setFilterUser]     = useState('ALL')

  const { from, to } = getRange(rangeType, anchor)

  useEffect(() => { loadData() }, [rangeType, anchor])

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

  // When viewing Fundación workspace, only entries from @fundacionxul.org count
  const isFundacion = getWsId() === 'fundacion-ws-1'

  // ── derived ─────────────────────────────────────────────────
  const filtered = useMemo(() => entries.filter(e => {
    // Fundación workspace: only the two Fundación users
    if (isFundacion && !e.user_email?.endsWith('@fundacionxul.org')) return false
    // Non-admins only see their own entries regardless of filter
    if (!isAdmin && e.user_email !== user?.email) return false
    if (filterProject  !== 'ALL' && (e.project_name || 'Sin proyecto') !== filterProject) return false
    if (filterClient   !== 'ALL' && (e.client_name  || 'Sin cliente')  !== filterClient)  return false
    if (filterUser     !== 'ALL' && e.user_email !== filterUser) return false
    if (filterBillable === 'YES' && !e.billable) return false
    if (filterBillable === 'NO'  &&  e.billable) return false
    return true
  }), [entries, filterProject, filterClient, filterUser, filterBillable, isAdmin, user?.email, isFundacion])

  // Base entries for building filter options (scoped to Fundación if applicable)
  const baseEntries = isFundacion
    ? entries.filter(e => e.user_email?.endsWith('@fundacionxul.org'))
    : entries

  const projects  = [...new Set(baseEntries.map(e => e.project_name || 'Sin proyecto'))].sort()
  const clients   = [...new Set(baseEntries.map(e => e.client_name  || 'Sin cliente'))].sort()
  // In Fundación always show both users, even if one has no entries in this period
  const users = isFundacion
    ? ['anarojas@fundacionxul.org', 'cristinareyes@fundacionxul.org']
    : [...new Set(baseEntries.map(e => e.user_email).filter(Boolean))].sort()

  const totalSecs    = filtered.reduce((s, e) => s + (Number(e.duration) || 0), 0)
  const billableSecs = filtered.filter(e => e.billable).reduce((s, e) => s + (Number(e.duration) || 0), 0)

  // Bar chart by day
  const days = eachDayOfInterval({ start: from, end: to })
  const byDayData = days.map(day => {
    const key = format(day, 'yyyy-MM-dd')
    const secs = filtered
      .filter(e => { try { return format(parseISO(e.start_time), 'yyyy-MM-dd') === key } catch { return false } })
      .reduce((s, e) => s + (Number(e.duration) || 0), 0)
    return { name: format(day, rangeType === 'week' ? 'EEE' : 'd', { locale: es }), horas: parseFloat((secs / 3600).toFixed(2)) }
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
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#fff' : 'var(--c-text-3)',
              background: tab === t ? '#7C4DFF' : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--c-border-light)' }} />

        {/* Range type */}
        {RANGE_TYPES.map(r => (
          <button key={r.value} onClick={() => setRangeType(r.value)} style={{
            padding: '5px 12px', fontSize: 12, fontWeight: rangeType === r.value ? 700 : 500,
            color: rangeType === r.value ? '#7C4DFF' : 'var(--c-text-3)',
            background: rangeType === r.value ? '#7C4DFF18' : 'transparent',
            border: '1px solid ' + (rangeType === r.value ? '#7C4DFF40' : 'transparent'),
            borderRadius: 7, cursor: 'pointer',
          }}>{r.label}</button>
        ))}

        {/* Period navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <button onClick={() => setAnchor(a => shiftAnchor(rangeType, a, -1))}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--c-border-light)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={14} style={{ color: 'var(--c-text-3)' }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', minWidth: 150, textAlign: 'center' }}>
            {rangeLabel(rangeType, from, to)}
          </span>
          <button onClick={() => setAnchor(a => shiftAnchor(rangeType, a, 1))}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--c-border-light)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={14} style={{ color: 'var(--c-text-3)' }} />
          </button>
        </div>

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
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={selectStyle}>
          <option value="ALL">Todos los proyectos</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={selectStyle}>
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
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byDayData} barSize={rangeType === 'week' ? 28 : 14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-light)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} />
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
                  {['Descripción', 'Proyecto', 'Fecha', 'Duración'].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '32px 0' }}>Sin entradas en este período</p>
                ) : filtered.map(e => (
                  <div key={e.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px', padding: '11px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--c-bg-muted)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                  >
                    {/* Description */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 3, height: 24, borderRadius: 2, background: e.project_color || '#E0E0F0', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDuration(e.duration)}
                    </span>
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
