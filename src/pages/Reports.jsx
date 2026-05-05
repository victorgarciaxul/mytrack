import { useState, useEffect } from 'react'
import { BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { demoEntries } from '../lib/demoData'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subWeeks, subMonths, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const RANGES = [
  { label: 'Esta semana', value: 'week' },
  { label: 'Sem. pasada', value: 'last_week' },
  { label: 'Este mes', value: 'month' },
  { label: 'Mes pasado', value: 'last_month' },
]

const statCard = (label, value, sub, color = '#7C4DFF') => (
  <div key={label} className="p-4" style={{ background: '#fff', border: '1px solid #E5E8EE', borderRadius: 8 }}>
    <p className="text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#9095B0' }}>{label}</p>
    <p className="text-2xl font-bold font-numeric" style={{ color: '#1C1C28' }}>{value}</p>
    {sub && <p className="text-xs mt-1" style={{ color }}>{sub}</p>}
  </div>
)

export default function Reports() {
  const { user, isDemo } = useAuth()
  const { workspace } = useWorkspace()
  const [range, setRange] = useState('week')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (workspace) loadReport()
  }, [workspace, range, isDemo])

  function getDateRange() {
    const now = new Date()
    switch (range) {
      case 'week':      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
      case 'last_week': return { from: startOfWeek(subWeeks(now,1),{ weekStartsOn:1 }), to: endOfWeek(subWeeks(now,1),{ weekStartsOn:1 }) }
      case 'month':     return { from: startOfMonth(now), to: endOfMonth(now) }
      case 'last_month':return { from: startOfMonth(subMonths(now,1)), to: endOfMonth(subMonths(now,1)) }
    }
  }

  async function loadReport() {
    setLoading(true)
    const { from, to } = getDateRange()
    if (isDemo) {
      setEntries(demoEntries.filter(e => { const d = new Date(e.start_time); return d >= from && d <= to }))
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('time_entries').select('*, projects(name, color)')
      .eq('workspace_id', workspace.id)
      .gte('start_time', from.toISOString())
      .lte('start_time', to.toISOString())
      .order('start_time')
    setEntries(data || [])
    setLoading(false)
  }

  const totalSecs = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const { from, to } = getDateRange()
  const days = eachDayOfInterval({ start: from, end: to })

  const byDayData = days.map(day => ({
    name: format(day, 'EEE', { locale: es }),
    horas: parseFloat((entries.filter(e => format(parseISO(e.start_time), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).reduce((s,e)=>s+(e.duration||0),0)/3600).toFixed(2)),
  }))

  const byProject = {}
  entries.forEach(e => {
    const name = e.projects?.name || 'Sin proyecto'
    const color = e.projects?.color || '#C0C0E0'
    if (!byProject[name]) byProject[name] = { name, value: 0, color }
    byProject[name].value += (e.duration || 0) / 3600
  })
  const pieData = Object.values(byProject).map(p => ({ ...p, value: parseFloat(p.value.toFixed(2)) }))

  const fmt = s => `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#1C1C28', color: '#fff', border: '1px solid #2A2D3A' }}>
        <span className="font-bold">{payload[0].value}h</span>
      </div>
    )
  }

  return (
    <div>
      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #E5E8EE' }}>
        <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: '#F3F4F8' }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: range === r.value ? '#fff' : 'transparent',
                color: range === r.value ? '#1C1C28' : '#7A7F9A',
                boxShadow: range === r.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {statCard('Total horas', `${(totalSecs/3600).toFixed(1)}h`, `${entries.length} entradas`)}
          {statCard('Entradas', entries.length, 'registros totales', '#EC4899')}
          {statCard('Media diaria', `${days.length > 0 ? (totalSecs/3600/days.length).toFixed(1) : 0}h`, 'por día laborable', '#4FC3F7')}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 p-4" style={{ background: '#fff', border: '1px solid #E5E8EE', borderRadius: 8 }}>
            <h3 className="font-bold text-sm mb-5" style={{ color: '#1C1C28' }}>Horas por día</h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: '#7A7F9A' }}>Cargando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byDayData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9095B0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9095B0' }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(123,104,238,0.06)', radius: 6 }} />
                  <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                    {byDayData.map((entry, i) => (
                      <Cell key={i} fill={entry.horas > 0 ? 'url(#barGrad)' : '#F0F0F8'} />
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
            )}
          </div>

          <div className="p-4" style={{ background: '#fff', border: '1px solid #E5E8EE', borderRadius: 8 }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: '#1C1C28' }}>Por proyecto</h3>
            {pieData.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm" style={{ color: '#7A7F9A' }}>Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v}h`]} contentStyle={{ borderRadius: 10, border: '1px solid #E5E8EE', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-2 mt-2">
              {pieData.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate" style={{ color: '#3D4060' }}>{p.name}</span>
                  <span className="font-bold" style={{ color: '#1C1C28' }}>{p.value}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E8EE', borderRadius: 8 }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #F0F0F8', background: '#FAFAFA' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7A7F9A' }}>Entradas detalladas</h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(123,104,238,0.1)', color: '#7C4DFF' }}>
              {entries.length} registros
            </span>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto" style={{ '--tw-divide-opacity': 1 }}>
            {entries.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: '#7A7F9A' }}>Sin entradas en este período</p>
            ) : (
              entries.map(e => (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors"
                  style={{ borderBottom: '1px solid #F8F8FC' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                >
                  <span className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: e.projects?.color || '#E0E0F0' }} />
                  <span className="flex-1 font-medium truncate" style={{ color: '#1C1C28' }}>{e.description}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${e.projects?.color || '#E0E0F0'}18`, color: e.projects?.color || '#7A7F9A' }}>
                    {e.projects?.name || 'Sin proyecto'}
                  </span>
                  <span className="text-xs" style={{ color: '#9095B0' }}>{format(parseISO(e.start_time), 'dd/MM HH:mm')}</span>
                  <span className="font-numeric font-bold text-xs w-16 text-right" style={{ color: '#3D4060' }}>{fmt(e.duration||0)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
