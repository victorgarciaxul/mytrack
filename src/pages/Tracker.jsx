import { useState, useEffect } from 'react'
import { Play, Square, Plus, ChevronDown, MoreHorizontal, Clock, Zap, Briefcase } from 'lucide-react'
import { useTimer } from '../hooks/useTimer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { loadClockifyCache, clockifyStartTimer, clockifyStopTimer, clockifyDeleteEntry, getClockifyUserId, isClockifyUser, clockifyGetProjectTasks } from '../lib/clockify'
import { getSelectedYear } from '../components/layout/TopBar'
import { initDB, dbGetEntries, dbInsertEntry, dbDeleteEntry } from '../lib/db'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ManualEntryModal from '../components/timer/ManualEntryModal'

export default function Tracker() {
  const { user, isDemo } = useAuth()
  const { workspace, projects, getTasksForProject } = useWorkspace()
  const timer = useTimer()

  const ACTIVE_KEY = 'mytrack-active-entry'

  const [description, setDescription] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY))?.description || '' } catch { return '' }
  })
  const [selectedProject, setSelectedProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY))?.project || null } catch { return null }
  })
  const [selectedTask, setSelectedTask] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY))?.task || null } catch { return null }
  })

  // Persist active entry state to localStorage whenever it changes
  useEffect(() => {
    if (timer.isRunning || description || selectedProject) {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({
        description, project: selectedProject, task: selectedTask,
      }))
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  }, [description, selectedProject, selectedTask, timer.isRunning])
  const [entries, setEntries] = useState(() => {
    if (!isDemo) return []
    const cache = loadClockifyCache()
    if (cache?.entries?.length) {
      const selectedYear = getSelectedYear()
      return cache.entries
        .filter(e => e.end_time && new Date(e.start_time).getFullYear() === selectedYear)
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    }
    return []
  })
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [projectTasks, setProjectTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Load tasks when project changes
  useEffect(() => {
    if (!selectedProject) { setProjectTasks([]); return }
    setLoadingTasks(true)
    clockifyGetProjectTasks(selectedProject.id)
      .then(tasks => { setProjectTasks(tasks); setLoadingTasks(false) })
      .catch(() => setLoadingTasks(false))
  }, [selectedProject?.id])

  useEffect(() => {
    if (!syncEnabled) {
      // Non-Clockify users: load from Neon
      const year = getSelectedYear()
      initDB().then(() => dbGetEntries(user.email, year)).then(rows => {
        setEntries(rows.map(r => ({
          id: r.id,
          description: r.description,
          start_time: r.start_time,
          end_time: r.end_time,
          duration: r.duration,
          projects: r.project_id ? { name: r.project_name, color: r.project_color } : null,
          tasks: r.task_id ? { name: r.task_name } : null,
        })))
      }).catch(console.error)
    }
  }, [user?.email])

  async function loadEntries() {
    // kept for compatibility (non-demo Supabase mode - not used currently)
  }

  const syncEnabled = isClockifyUser(user?.email)

  async function handleStart() {
    if (syncEnabled) {
      setSyncing(true)
      try {
        await clockifyStartTimer({
          description: description || '',
          projectId: selectedProject?.id || null,
          taskId: selectedTask?.id || null,
        })
        timer.start()
        toast.success('⏱ Timer iniciado en Clockify')
      } catch (err) {
        toast.error('Error al iniciar en Clockify: ' + err.message)
      } finally {
        setSyncing(false)
      }
    } else {
      timer.start()
    }
  }

  async function handleStop() {
    const secs = timer.stop()
    if (secs < 5) { timer.reset(); return }

    if (syncEnabled) {
      setSyncing(true)
      try {
        const userId = getClockifyUserId()
        const saved = await clockifyStopTimer(userId)
        const duration = saved.timeInterval?.duration
          ? Math.round(saved.timeInterval.duration / 1000)
          : secs
        const entry = {
          id: saved.id,
          description: saved.description || description || '(sin descripción)',
          start_time: saved.timeInterval?.start,
          end_time: saved.timeInterval?.end,
          duration,
          projects: selectedProject
            ? { name: selectedProject.name, color: selectedProject.color, clients: selectedProject.clients }
            : null,
          tasks: selectedTask ? { name: selectedTask.name } : null,
        }
        setEntries(prev => [entry, ...prev])
        // Also save to Neon for centralised storage
        initDB().then(() => dbInsertEntry({
          id: saved.id,
          userEmail: user.email,
          workspaceId: 'xul-ws-1',
          projectId: selectedProject?.id || null,
          projectName: selectedProject?.name || null,
          projectColor: selectedProject?.color || null,
          clientName: selectedProject?.clients?.name || null,
          taskId: selectedTask?.id || null,
          taskName: selectedTask?.name || null,
          description: entry.description,
          startTime: entry.start_time,
          endTime: entry.end_time,
          duration,
          billable: true,
        })).catch(err => console.warn('Neon save error:', err.message))
        toast.success('✅ Guardado en Clockify')
      } catch (err) {
        toast.error('No se pudo sincronizar con Clockify: ' + err.message)
      } finally {
        setSyncing(false)
      }
    } else {
      // Other users: save to Neon
      const start = new Date(Date.now() - secs * 1000)
      const end = new Date()
      try {
        await initDB()
        const saved = await dbInsertEntry({
          userEmail: user.email,
          workspaceId: 'xul-ws-1',
          projectId: selectedProject?.id || null,
          projectName: selectedProject?.name || null,
          projectColor: selectedProject?.color || null,
          taskId: selectedTask?.id || null,
          taskName: selectedTask?.name || null,
          description: description || '(sin descripción)',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          duration: secs,
        })
        setEntries(prev => [{
          id: saved.id,
          description: saved.description,
          start_time: saved.start_time,
          end_time: saved.end_time,
          duration: saved.duration,
          projects: selectedProject ? { name: selectedProject.name, color: selectedProject.color } : null,
          tasks: selectedTask ? { name: selectedTask.name } : null,
        }, ...prev])
        toast.success('Tiempo registrado')
      } catch (err) {
        toast.error('Error al guardar: ' + err.message)
      }
    }

    timer.reset()
    setDescription('')
    setSelectedProject(null)
    setSelectedTask(null)
    localStorage.removeItem(ACTIVE_KEY)
  }

  async function deleteEntry(id) {
    try {
      // Never delete from Clockify — only remove locally / from Neon
      if (!syncEnabled) await dbDeleteEntry(id)
      setEntries(e => e.filter(x => x.id !== id))
      toast.success('Entrada eliminada')
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  async function reactivateEntry(e) {
    if (timer.isRunning) {
      toast.error('Para el timer actual antes de reactivar')
      return
    }
    // Restore description, project and task from the entry
    setDescription(e.description || '')
    const proj = e.projects?.name
      ? projects.find(p => p.name === e.projects.name) || { name: e.projects.name, color: e.projects.color, id: e.project_id }
      : null
    setSelectedProject(proj || null)
    setSelectedTask(e.tasks?.name ? { name: e.tasks.name, id: e.task_id } : null)
    // Start timer
    if (syncEnabled) {
      setSyncing(true)
      try {
        await clockifyStartTimer({
          description: e.description || '',
          projectId: e.project_id || null,
          taskId: e.task_id || null,
        })
        timer.start()
        toast.success('⏱ Timer reactivado en Clockify')
      } catch (err) {
        toast.error('Error al reactivar: ' + err.message)
      } finally {
        setSyncing(false)
      }
    } else {
      timer.start()
      toast.success('⏱ Timer reactivado')
    }
  }

  function handleManualSave(entry) {
    setEntries(prev => [entry, ...prev].sort((a, b) =>
      new Date(b.start_time) - new Date(a.start_time)
    ))
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
          <Card data-tour="timer-bar" color="var(--c-card-a)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: timer.isRunning ? '#22C55E' : '#E2E8F0', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: timer.isRunning ? '#22C55E' : '#94A3B8' }}>
                  {timer.isRunning ? 'Tarea activa' : 'Iniciar temporizador'}
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
                fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 4,
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
                color: timer.isRunning ? 'var(--c-text-1)' : 'var(--c-border)',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.3s',
              }}>
                {timer.formatted}
              </span>
              <button
                onClick={timer.isRunning ? handleStop : handleStart}
                disabled={syncing}
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: syncing ? 'wait' : 'pointer',
                  background: syncing ? '#94A3B8' : timer.isRunning ? '#22C55E' : 'linear-gradient(135deg,#7C4DFF,#E040FB)',
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
                    background: selectedProject ? selectedProject.color + '12' : 'var(--c-bg-muted)',
                    color: selectedProject ? selectedProject.color : '#94A3B8',
                    border: `1px solid ${selectedProject ? selectedProject.color + '30' : 'var(--c-border)'}`,
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
                    minWidth: 220, maxHeight: 280, overflowY: 'auto',
                    background: 'var(--c-bg-surface)', borderRadius: 10,
                    border: '1px solid var(--c-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    zIndex: 50, padding: '4px 0',
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

              {selectedProject && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowTaskPicker(p => !p)}
                    disabled={loadingTasks}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 7,
                      background: selectedTask ? '#7C4DFF12' : 'var(--c-bg-muted)',
                      color: selectedTask ? '#7C4DFF' : '#94A3B8',
                      border: `1px solid ${selectedTask ? '#7C4DFF30' : 'var(--c-border)'}`,
                      fontSize: 12, fontWeight: 500, cursor: loadingTasks ? 'wait' : 'pointer',
                    }}
                  >
                    {loadingTasks ? '…' : (selectedTask?.name || 'Tarea')}
                    <ChevronDown size={11} />
                  </button>
                  {showTaskPicker && !loadingTasks && (
                    <div style={{
                      position: 'absolute', left: 0, top: 'calc(100% + 4px)',
                      minWidth: 220, maxHeight: 220, overflowY: 'auto',
                      background: 'var(--c-bg-surface)', borderRadius: 10,
                      border: '1px solid var(--c-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                      zIndex: 50, padding: '4px 0',
                    }}>
                      <Opt onClick={() => { setSelectedTask(null); setShowTaskPicker(false) }} muted>Sin tarea</Opt>
                      {projectTasks.length === 0
                        ? <Opt muted>No hay tareas en este proyecto</Opt>
                        : projectTasks.map(t => (
                          <Opt key={t.id} onClick={() => { setSelectedTask(t); setShowTaskPicker(false) }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C4DFF', flexShrink: 0 }} />
                            {t.name}
                          </Opt>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card color="var(--c-card-b)">
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
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center', padding: '24px 0' }}>
                  Sin entradas aún
                </p>
              ) : recentEntries.map((e, i) => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < recentEntries.length - 1 ? '1px solid var(--c-border-light)' : 'none',
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
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {e.description}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: '2px 0 0' }}>
                      {e.projects?.name || 'Sin proyecto'}
                      {e.tasks && <span style={{ color: '#7C4DFF' }}> · {e.tasks.name}</span>}
                    </p>
                  </div>
                  {e.end_time && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-3)', flexShrink: 0 }}>
                      {format(parseISO(e.start_time), 'HH:mm')} – {format(parseISO(e.end_time), 'HH:mm')}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {timer.format(e.duration || 0)}
                  </span>
                  {/* Reactivate button */}
                  <button
                    onClick={() => reactivateEntry(e)}
                    title="Reactivar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = '#7C4DFF15'; ev.currentTarget.style.color = '#7C4DFF' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-border)' }}
                  >
                    <Play size={13} fill="currentColor" />
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteEntry(e.id)}
                    title="Eliminar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = '#EF444415'; ev.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-border)' }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ MIDDLE COLUMN ══ */}
        <div style={{ padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '1px solid var(--c-border-light)', borderRight: '1px solid var(--c-border-light)' }}>

          {/* Week Earns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card compact color="var(--c-card-c)">
              <p style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horas hoy</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.5px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {timer.format(totalToday)}
              </p>
              <p style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginTop: 4 }}>
                {todayEntries.length} entradas
              </p>
            </Card>
            <Card compact color="var(--c-card-d)">
              <p style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Esta semana</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.5px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {timer.format(totalWeek)}
              </p>
              <p style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600, marginTop: 4 }}>
                {entries.length} registros
              </p>
            </Card>
          </div>

          {/* Report analytics / activity heatmap */}
          <Card color="var(--c-card-c)">
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
          <Card color="var(--c-card-d)">
            <CardHeader title="Por proyecto" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projectList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center', padding: '12px 0' }}>Sin datos</p>
              ) : projectList.map(p => (
                <div key={p.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                      <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', fontVariantNumeric: 'tabular-nums' }}>
                      {timer.format(p.secs)}
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--c-border)' }}>
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

          {/* Ongoing timesheet */}
          <Card color="var(--c-card-b)">
            <CardHeader title="Ongoing Timesheet" />
            <div style={{ marginTop: 12 }}>
              {timer.isRunning ? (
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--c-card-a)', border: '1px solid var(--c-border)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: '0 0 4px' }}>
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
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--c-card-a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Zap size={18} style={{ color: '#7C4DFF' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-2)', margin: 0 }}>No hay timer activo</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 4 }}>Pulsa play para empezar</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick projects */}
          <Card color="var(--c-card-c)" style={{ overflow: 'hidden' }}>
            <CardHeader title="Proyectos activos">
              <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600 }}>{projects.length} TOTAL</span>
            </CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {projects.slice(0, 4).map(p => (
                <div key={p.id} style={{
                  padding: '10px', borderRadius: 10, minWidth: 0,
                  background: p.color + '10', border: `1px solid ${p.color}20`,
                  overflow: 'hidden',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexShrink: 0 }}>
                    <Briefcase size={13} color="white" />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 2, whiteSpace: 'nowrap' }}>
                    {(byProject[p.name]?.secs || 0) > 0 ? timer.format(byProject[p.name].secs) : '0h registradas'}
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
          onDemoSave={handleManualSave}
        />
      )}
    </div>
  )
}

// ── Shared components ──────────────────────────────────────────────────────────

function Card({ children, compact, color, style, ...props }) {
  return (
    <div style={{
      background: color || 'var(--c-bg-surface)',
      borderRadius: 14,
      border: '1px solid var(--c-border)',
      padding: compact ? '14px' : '18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      minWidth: 0,
      ...style,
    }} {...props}>
      {children}
    </div>
  )
}

function CardHeader({ title, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: 0, letterSpacing: '-0.2px' }}>{title}</h3>
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
        color: muted ? 'var(--c-text-3)' : 'var(--c-text-1)',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
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
            background: secs > 0 ? 'linear-gradient(180deg,#7C4DFF,#E040FB)' : 'var(--c-border)',
            transition: 'height 0.3s',
            cursor: secs > 0 ? 'pointer' : 'default',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {[1,5,9,13,17,21].map(h => (
          <span key={h} style={{ fontSize: 10, color: 'var(--c-text-3)' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}
