import { useState, useEffect } from 'react'
import { Play, Square, Plus, ChevronDown, MoreHorizontal, Clock, Zap, Briefcase } from 'lucide-react'
import { useTimer } from '../hooks/useTimer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { demoEntries } from '../lib/demoData'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ManualEntryModal from '../components/timer/ManualEntryModal'

export default function Tracker() {
  const { user, isDemo } = useAuth()
  const { workspace, projects, getTasksForProject } = useWorkspace()
  const timer = useTimer()

  const [description, setDescription] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [entries, setEntries] = useState(isDemo ? demoEntries.filter(e => e.user_id === 'demo-user-1') : [])
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [showManual, setShowManual] = useState(false)

  const projectTasks = selectedProject ? getTasksForProject(selectedProject.id) : []

  useEffect(() => {
    if (workspace && !isDemo) loadEntries()
  }, [workspace])

  async function loadEntries() {
    const since = subDays(new Date(), 7).toISOString()
    const { data } = await supabase
      .from('time_entries')
      .select('*, projects(name, color, clients(name)), tasks(name)')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .gte('start_time', since)
      .order('start_time', { ascending: false })
    if (data) setEntries(data)
  }

  async function handleStop() {
    const secs = timer.stop()
    if (secs < 5) { timer.reset(); return }
    const start = new Date(Date.now() - secs * 1000)
    const end = new Date()
    if (isDemo) {
      setEntries(prev => [{
        id: `demo-${Date.now()}`,
        workspace_id: workspace.id, user_id: user.id,
        description: description || '(sin descripción)',
        start_time: start.toISOString(), end_time: end.toISOString(), duration: secs,
        projects: selectedProject ? { name: selectedProject.name, color: selectedProject.color, clients: selectedProject.clients } : null,
        tasks: selectedTask ? { name: selectedTask.name } : null,
      }, ...prev])
      toast.success('Tiempo registrado')
      timer.reset(); setDescription(''); setSelectedProject(null); setSelectedTask(null)
      return
    }
    await supabase.from('time_entries').insert({
      workspace_id: workspace.id, user_id: user.id,
      description: description || '(sin descripción)',
      project_id: selectedProject?.id || null,
      task_id: selectedTask?.id || null,
      start_time: start.toISOString(), end_time: end.toISOString(), duration: secs,
    })
    toast.success('Tiempo registrado')
    timer.reset(); setDescription(''); setSelectedProject(null); setSelectedTask(null)
    loadEntries()
  }

  async function deleteEntry(id) {
    if (isDemo) { setEntries(e => e.filter(x => x.id !== id)); return }
    await supabase.from('time_entries').delete().eq('id', id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const todayEntries = entries.filter(e => isToday(parseISO(e.start_time)))
  const totalToday = todayEntries.reduce((s, e) => s + (e.duration || 0), 0)
  const totalWeek = entries.reduce((s, e) => s + (e.duration || 0), 0)
  const recentEntries = entries.slice(0, 8)

  // Hours by project this week
  const byProject = {}
  entries.forEach(e => {
    const name = e.projects?.name || 'Sin proyecto'
    const color = e.projects?.color || '#C0C0E0'
    if (!byProject[name]) byProject[name] = { name, color, secs: 0 }
    byProject[name].secs += e.duration || 0
  })
  const projectList = Object.values(byProject).sort((a, b) => b.secs - a.secs).slice(0, 5)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* 3-column grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 0 }}>

        {/* ══ LEFT COLUMN ══ */}
        <div style={{ padding: '20px 12px 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Active task card */}
          <Card data-tour="timer-bar">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: timer.isRunning ? '#22C55E' : '#E2E8F0', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: timer.isRunning ? '#22C55E' : '#94A3B8' }}>
                  {timer.isRunning ? 'Active Task' : 'Start Timer'}
                </span>
              </div>
              <button
                data-tour="manual-btn"
                onClick={() => setShowManual(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9095B0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                onMouseEnter={e => e.currentTarget.style.color = '#7C4DFF'}
                onMouseLeave={e => e.currentTarget.style.color = '#9095B0'}
              >
                <Plus size={13} /> Manual
              </button>
            </div>

            <input
              placeholder="¿En qué estás trabajando?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !timer.isRunning && timer.start()}
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontSize: 20, fontWeight: 700, color: '#1A1A2E', marginBottom: 4,
                letterSpacing: '-0.3px', boxSizing: 'border-box',
              }}
            />

            {selectedProject && (
              <p style={{ fontSize: 12, color: '#7C4DFF', marginBottom: 14, fontWeight: 500 }}>
                Project: {selectedProject.name}
                {selectedTask && <span style={{ color: '#9095B0' }}> › {selectedTask.name}</span>}
              </p>
            )}
            {!selectedProject && <div style={{ marginBottom: 14 }} />}

            {/* Timer display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 40, fontWeight: 800, letterSpacing: '-1px',
                color: timer.isRunning ? '#1A1A2E' : '#CBD5E1',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.3s',
              }}>
                {timer.formatted}
              </span>
              <button
                onClick={timer.isRunning ? handleStop : timer.start}
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: timer.isRunning ? '#22C55E' : 'linear-gradient(135deg,#7C4DFF,#E040FB)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: timer.isRunning ? '0 4px 16px rgba(34,197,94,0.4)' : '0 4px 16px rgba(124,77,255,0.4)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {timer.isRunning
                  ? <Square size={18} fill="white" color="white" />
                  : <Play size={18} fill="white" color="white" style={{ marginLeft: 3 }} />
                }
              </button>
            </div>

            {/* Project / Task pickers */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <div data-tour="project-picker" style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowProjectPicker(p => !p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 7,
                    background: selectedProject ? selectedProject.color + '12' : '#F8F8FD',
                    color: selectedProject ? selectedProject.color : '#94A3B8',
                    border: `1px solid ${selectedProject ? selectedProject.color + '30' : '#EDEDF8'}`,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedProject?.color || '#CBD5E1' }} />
                  {selectedProject?.name || 'Proyecto'}
                  <ChevronDown size={11} />
                </button>
                {showProjectPicker && (
                  <div style={{
                    position: 'absolute', left: 0, top: 'calc(100% + 4px)',
                    minWidth: 200, background: '#fff', borderRadius: 10,
                    border: '1px solid #EDEDF8', boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                    zIndex: 50, overflow: 'hidden', padding: '4px 0',
                  }}>
                    <Opt onClick={() => { setSelectedProject(null); setSelectedTask(null); setShowProjectPicker(false) }} muted>Sin proyecto</Opt>
                    {projects.map(p => (
                      <Opt key={p.id} onClick={() => { setSelectedProject(p); setSelectedTask(null); setShowProjectPicker(false) }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                        {p.name}
                      </Opt>
                    ))}
                  </div>
                )}
              </div>

              {selectedProject && projectTasks.length > 0 && (
                <select
                  onChange={e => {
                    const t = projectTasks.find(t => t.id === e.target.value)
                    setSelectedTask(t || null)
                  }}
                  value={selectedTask?.id || ''}
                  style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: 12,
                    background: '#F8F8FD', border: '1px solid #EDEDF8',
                    color: '#94A3B8', cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">Tarea</option>
                  {projectTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader title="Recent Activity">
              <button
                onClick={() => {}}
                style={{ fontSize: 12, color: '#7C4DFF', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                See All
              </button>
            </CardHeader>
            <div style={{ marginTop: 8 }}>
              {recentEntries.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>
                  Sin entradas aún
                </p>
              ) : recentEntries.map((e, i) => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < recentEntries.length - 1 ? '1px solid #F5F5FA' : 'none',
                }}>
                  {/* Project color */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: (e.projects?.color || '#7C4DFF') + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Clock size={13} style={{ color: e.projects?.color || '#7C4DFF' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {e.description}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                      {e.projects?.name || 'Sin proyecto'}
                      {e.tasks && <span style={{ color: '#7C4DFF' }}> · {e.tasks.name}</span>}
                    </p>
                  </div>
                  {e.end_time && (
                    <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
                      {format(parseISO(e.start_time), 'HH:mm')} – {format(parseISO(e.end_time), 'HH:mm')}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {timer.format(e.duration || 0)}
                  </span>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', flexShrink: 0 }}
                    onMouseEnter={ev => ev.currentTarget.style.color = '#EF4444'}
                    onMouseLeave={ev => ev.currentTarget.style.color = '#CBD5E1'}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ MIDDLE COLUMN ══ */}
        <div style={{ padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '1px solid #F0F0F7', borderRight: '1px solid #F0F0F7' }}>

          {/* Week Earns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card compact>
              <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horas hoy</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', letterSpacing: '-0.5px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {timer.format(totalToday)}
              </p>
              <p style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginTop: 4 }}>
                {todayEntries.length} entradas
              </p>
            </Card>
            <Card compact>
              <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Esta semana</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', letterSpacing: '-0.5px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {timer.format(totalWeek)}
              </p>
              <p style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600, marginTop: 4 }}>
                {entries.length} registros
              </p>
            </Card>
          </div>

          {/* Report analytics / activity heatmap */}
          <Card>
            <CardHeader title="Report Analytics">
              <div style={{ display: 'flex', gap: 4 }}>
                {['Hoy', 'Semana', 'Mes'].map(t => (
                  <button key={t} style={{
                    padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 500,
                    background: t === 'Semana' ? '#7C4DFF' : 'transparent',
                    color: t === 'Semana' ? '#fff' : '#94A3B8',
                  }}>{t}</button>
                ))}
              </div>
            </CardHeader>
            <ActivityGrid entries={entries} formatTime={timer.format} />
          </Card>

          {/* Project time breakdown */}
          <Card>
            <CardHeader title="Por proyecto" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projectList.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>Sin datos</p>
              ) : projectList.map(p => (
                <div key={p.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', fontVariantNumeric: 'tabular-nums' }}>
                      {timer.format(p.secs)}
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: '#F0F0F7' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: p.color,
                      width: `${Math.min(100, (p.secs / (totalWeek || 1)) * 100)}%`,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div style={{ padding: '20px 20px 20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary */}
          <Card>
            <CardHeader title="Summary" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Total Hours', value: timer.format(totalWeek), color: '#7C4DFF' },
                { label: 'Entries', value: entries.length, color: '#06B6D4' },
                { label: 'Today', value: timer.format(totalToday), color: '#22C55E' },
                { label: 'Active', value: timer.isRunning ? '1' : '0', color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px', borderRadius: 8, background: s.color + '08', border: `1px solid ${s.color}20` }}>
                  <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>{s.label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Weekly progress</span>
                <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600 }}>
                  {Math.min(100, Math.round((totalWeek / 3600 / 40) * 100))}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#F0F0F7', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg,#7C4DFF,#E040FB)',
                  borderRadius: 4,
                  width: `${Math.min(100, (totalWeek / 3600 / 40) * 100)}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>{timer.format(totalWeek)}</span>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>40h objetivo</span>
              </div>
            </div>
          </Card>

          {/* Ongoing timesheet */}
          <Card>
            <CardHeader title="Ongoing Timesheet" />
            <div style={{ marginTop: 12 }}>
              {timer.isRunning ? (
                <div style={{ padding: '12px', borderRadius: 10, background: '#F3F0FF', border: '1px solid #DDD6FE' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: '0 0 4px' }}>
                    {description || 'Sin descripción'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} style={{ color: '#7C4DFF' }} />
                      <span style={{ fontSize: 11, color: '#7C4DFF' }}>Last Tracked: now</span>
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      onClick={handleStop}>
                      <Square size={11} fill="white" color="white" />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Zap size={18} style={{ color: '#7C4DFF' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#475569', margin: 0 }}>No hay timer activo</p>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Pulsa play para empezar</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick projects */}
          <Card>
            <CardHeader title="Pinned Projects">
              <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600 }}>{projects.length} ACTIVE</span>
            </CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {projects.slice(0, 4).map(p => (
                <div key={p.id} style={{
                  padding: '10px', borderRadius: 10,
                  background: p.color + '10', border: `1px solid ${p.color}20`,
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <Briefcase size={13} color="white" />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                    {(byProject[p.name]?.secs || 0) > 0 ? timer.format(byProject[p.name].secs) : '0h tracked'}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showManual && (
        <ManualEntryModal
          onClose={() => setShowManual(false)}
          onSave={() => { setShowManual(false); if (!isDemo) loadEntries() }}
          projects={projects}
          workspace={workspace}
          user={user}
          isDemo={isDemo}
          onDemoSave={entry => setEntries(prev => [entry, ...prev])}
        />
      )}
    </div>
  )
}

// ── Shared components ──────────────────────────────────────────────────────────

function Card({ children, compact, ...props }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 14,
      border: '1px solid #EEEEF8',
      padding: compact ? '14px' : '18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }} {...props}>
      {children}
    </div>
  )
}

function CardHeader({ title, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', margin: 0, letterSpacing: '-0.2px' }}>{title}</h3>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>}
    </div>
  )
}

function Opt({ children, onClick, muted }) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', fontSize: 12, fontWeight: 400,
        color: muted ? '#94A3B8' : '#1E293B',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}

function ActivityGrid({ entries, formatTime }) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const secs = entries
      .filter(e => e.start_time && new Date(e.start_time).getHours() === h)
      .reduce((s, e) => s + (e.duration || 0), 0)
    return { h, secs }
  })
  const max = Math.max(...hours.map(h => h.secs), 1)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
        {hours.map(({ h, secs }) => (
          <div key={h} title={`${h}:00 — ${formatTime(secs)}`} style={{
            flex: 1,
            height: secs > 0 ? `${Math.max(8, (secs / max) * 60)}px` : 6,
            borderRadius: 3,
            background: secs > 0 ? 'linear-gradient(180deg,#7C4DFF,#E040FB)' : '#F0F0F7',
            transition: 'height 0.3s',
            cursor: secs > 0 ? 'pointer' : 'default',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {[1,5,9,13,17,21].map(h => (
          <span key={h} style={{ fontSize: 10, color: '#CBD5E1' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}
