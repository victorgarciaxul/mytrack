import { useMemo } from 'react'
import { BarChart2, Clock, Users, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useRole } from '../context/RoleContext'
import { demoEntries } from '../lib/demoData'
import { isThisWeek, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PROJECT_COLORS = ['#7C4DFF','#8b5cf6','#ec4899','#f97316','#22c55e','#06b6d4','#f59e0b']

export default function ManagerDashboard() {
  const { isDemo } = useAuth()
  const { projects, members } = useWorkspace()
  const { notifications } = useRole()

  // Use demo entries for demo mode; real would query all team entries
  const entries = isDemo ? demoEntries : []

  const weekEntries = useMemo(
    () => entries.filter(e => isThisWeek(parseISO(e.start_time), { weekStartsOn: 1 })),
    [entries]
  )

  // Hours per project this week
  const byProject = useMemo(() => {
    const map = {}
    weekEntries.forEach(e => {
      if (!e.project_id) return
      const p = projects.find(p => p.id === e.project_id)
      if (!p) return
      if (!map[e.project_id]) map[e.project_id] = { name: p.name, color: p.color, hours: 0, budget: p.budget_hours }
      map[e.project_id].hours += (e.duration || 0) / 3600
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [weekEntries, projects])

  // Hours + billing per member this week
  const byMember = useMemo(() => {
    const map = {}
    weekEntries.forEach(e => {
      const m = members.find(m => m.user_id === e.user_id)
      if (!m) return
      const key = e.user_id
      if (!map[key]) map[key] = {
        name: m.profiles?.full_name || 'Desconocido',
        jobTitle: m.profiles?.job_title || '',
        rate: m.profiles?.hourly_rate || 0,
        hours: 0,
        billableHours: 0,
      }
      map[key].hours += (e.duration || 0) / 3600
      if (e.billable) map[key].billableHours += (e.duration || 0) / 3600
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [weekEntries, members])

  // Total hours and billing
  const totalHours = weekEntries.reduce((s, e) => s + (e.duration || 0) / 3600, 0)
  const billableHours = weekEntries.filter(e => e.billable).reduce((s, e) => s + (e.duration || 0) / 3600, 0)
  const totalBilling = byMember.reduce((s, m) => s + m.billableHours * m.rate, 0)
  const unreadAlerts = notifications.filter(n => !n.read).length

  // Budget alerts: projects > 80% consumed
  const budgetAlerts = projects.filter(p => {
    if (!p.budget_hours) return false
    const used = (byProject.find(b => b.name === p.name)?.hours || 0)
    return used / p.budget_hours >= 0.8
  })

  const fmt = h => h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 24px', flexShrink: 0 }}>
        {[
          { label: 'Horas esta semana', value: fmt(totalHours),            icon: Clock,          accent: '#3B82F6' },
          { label: 'Horas facturables', value: fmt(billableHours),         icon: TrendingUp,     accent: '#6366F1' },
          { label: 'Facturación est.',  value: `€${Math.round(totalBilling)}`, icon: DollarSign, accent: '#0EA5E9' },
          { label: 'Alertas',           value: unreadAlerts,               icon: AlertTriangle,  accent: '#38BDF8' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
            borderRadius: 14,
            padding: '18px 20px',
            boxShadow: `0 4px 20px ${accent}40`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color="white" />
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-1px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPI cards */}
      <div data-tour="kpi-cards" />

      <div className="px-6 grid grid-cols-1 lg:grid-cols-2 gap-5 pb-6">
        {/* Time by project */}
        <div className="rounded-lg p-5" style={{ background: 'var(--c-bg-surface)', border: '1px solid #E5E8EE' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} style={{ color: '#7C4DFF' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--c-text-1)' }}>Horas por proyecto</h2>
          </div>
          {byProject.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--c-text-3)' }}>Sin entradas esta semana</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byProject} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={v => [`${v.toFixed(1)}h`]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E5E8EE', fontSize: 12 }}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {byProject.map((p, i) => <Cell key={i} fill={p.color || PROJECT_COLORS[i % PROJECT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {byProject.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--c-text-2)' }}>{p.name}</span>
                    {p.budget && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-border-light)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (p.hours / p.budget) * 100)}%`,
                            background: p.hours / p.budget >= 0.9 ? '#FF4757' : p.hours / p.budget >= 0.7 ? '#f59e0b' : '#22c55e',
                          }} />
                        </div>
                        <span className="font-numeric text-xs" style={{ color: 'var(--c-text-3)' }}>{Math.round((p.hours / p.budget) * 100)}%</span>
                      </div>
                    )}
                    <span className="font-numeric text-xs font-bold w-12 text-right" style={{ color: 'var(--c-text-1)' }}>{fmt(p.hours)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Time + billing per person */}
        <div className="rounded-lg p-5" style={{ background: 'var(--c-bg-surface)', border: '1px solid #E5E8EE' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} style={{ color: '#7C4DFF' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--c-text-1)' }}>Horas por persona</h2>
          </div>
          {byMember.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--c-text-3)' }}>Sin entradas esta semana</p>
          ) : (
            <div className="space-y-3">
              {byMember.map((m, i) => {
                const billing = m.billableHours * m.rate
                const initials = m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg,${PROJECT_COLORS[i % PROJECT_COLORS.length]},${PROJECT_COLORS[(i + 2) % PROJECT_COLORS.length]})` }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text-1)' }}>{m.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--c-input-bg)', color: 'var(--c-text-3)' }}>{m.jobTitle}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-numeric text-xs font-bold" style={{ color: '#7C4DFF' }}>{fmt(m.hours)}</span>
                        {m.rate > 0 && <span className="text-xs" style={{ color: 'var(--c-text-3)' }}>€{m.rate}/h · <span className="font-semibold" style={{ color: '#f59e0b' }}>€{Math.round(billing)}</span></span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-numeric text-xs" style={{ color: 'var(--c-text-3)' }}>{fmt(m.billableHours)} fact.</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Budget alerts */}
        {budgetAlerts.length > 0 && (
          <div className="rounded-lg p-5 lg:col-span-2" style={{ background: 'var(--c-bg-surface)', border: '1px solid #FFE0B2' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--c-text-1)' }}>Proyectos con presupuesto alto</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {budgetAlerts.map(p => {
                const used = byProject.find(b => b.name === p.name)?.hours || 0
                const pct = Math.round((used / p.budget_hours) * 100)
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FFFBF0', border: '1px solid #FFE0B2' }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text-1)' }}>{p.name}</p>
                      <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>{used.toFixed(1)}h de {p.budget_hours}h ({pct}%)</p>
                    </div>
                    <span className="font-numeric text-sm font-bold" style={{ color: pct >= 100 ? '#FF4757' : '#f59e0b' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
