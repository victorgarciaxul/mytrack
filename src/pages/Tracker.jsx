import { useState, useEffect, useRef } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Play, Square, Plus, ChevronDown, Clock, Zap, Briefcase, Pencil, Trash2, Share2, Check, Smile, X } from 'lucide-react'
import { useTimerContext } from '../context/TimerContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { loadClockifyCache, clockifyStartTimer, clockifyStopTimer, clockifyDeleteEntry, getClockifyUserId, isClockifyUser, clockifyGetProjectTasks } from '../lib/clockify'
import { getSelectedYear } from '../components/layout/TopBar'
import { initDB, dbGetEntries, dbInsertEntry, dbDeleteEntry, dbGetMyNotes, dbSaveNote, dbShareNote, dbGetSharedNotes, dbGetAllMembers, dbUpdateNoteContent, dbUnshareNote, dbToggleReaction, ensureReactionsColumn, dbDeleteNote, getWsId, dbSaveRunningTimer, dbGetRunningTimer, dbDeleteRunningTimer } from '../lib/db'
import { format, parseISO, isToday, isYesterday, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import ManualEntryModal from '../components/timer/ManualEntryModal'
import SearchableDropdown from '../components/ui/SearchableDropdown'
import EditEntryModal from '../components/timer/EditEntryModal'
import StickyNote from '../components/ui/StickyNote'

export default function Tracker() {
  const { user, isDemo } = useAuth()
  const { workspace, projects, getTasksForProject, markProjectArchived } = useWorkspace()
  const timer = useTimerContext()
  const isMobile = useMediaQuery('(max-width: 768px)')

  // XUL admins viewing Fundación workspace cannot register time — show info screen
  const isGuestViewing = getWsId() !== (user?.workspace_id || 'xul-ws-1')
  if (isGuestViewing) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '60vh', gap: 12, color: 'var(--c-text-3)', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <Clock size={40} style={{ opacity: 0.3 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-2)', margin: 0 }}>
          Modo solo visualización
        </p>
        <p style={{ fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 300 }}>
          Estás viendo el espacio de Fundación. El registro de tiempo solo está disponible en tu espacio de trabajo (XUL).
        </p>
      </div>
    )
  }

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
    // Show localStorage cache immediately while Neon loads (any device that has it)
    if (!isClockifyUser(user?.email)) return []
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
  const [editingEntry, setEditingEntry] = useState(null)   // entry being edited
  const [confirmDeleteId, setConfirmDeleteId] = useState(null) // id pending delete confirm
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [chartPeriod, setChartPeriod] = useState('Semana')
  const [syncing, setSyncing] = useState(false)
  const [projectTasks, setProjectTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // ── Sticky notes ─────────────────────────────────────────────
  const [stickyNotes, setStickyNotes] = useState([
    { id: null, slot: 0, content: '', shared_with: '[]' },
    { id: null, slot: 1, content: '', shared_with: '[]' },
    { id: null, slot: 2, content: '', shared_with: '[]' },
  ])
  const [sharedNotes, setSharedNotes] = useState([])
  const [members, setMembers]         = useState([])

  // Load members first (so share picker is instant) — no initDB needed here
  useEffect(() => {
    if (!user?.email) return
    dbGetAllMembers()
      .then(all => setMembers(all.filter(m => m.user_email !== user.email)))
      .catch(console.error)
  }, [user?.email])

  // Load notes — skip initDB, table already exists
  useEffect(() => {
    if (!user?.email) return
    Promise.all([dbGetMyNotes(user.email), dbGetSharedNotes(user.email)])
      .then(([mine, shared]) => { setStickyNotes(mine); setSharedNotes(shared) })
      .catch(console.error)
  }, [user?.email])

  // Load tasks when project changes
  useEffect(() => {
    if (!selectedProject) { setProjectTasks([]); return }
    setLoadingTasks(true)
    clockifyGetProjectTasks(selectedProject.id)
      .then(tasks => { setProjectTasks(tasks); setLoadingTasks(false) })
      .catch(() => setLoadingTasks(false))
  }, [selectedProject?.id])

  // ── Neon load helper ───────────────────────────────────────────
  function mapNeonRow(r) {
    return {
      id: r.id,
      description: r.description,
      start_time: r.start_time,
      end_time: r.end_time,
      duration: r.duration,
      projects: r.project_id ? { name: r.project_name, color: r.project_color } : null,
      tasks: r.task_id ? { name: r.task_name } : null,
    }
  }

  function loadFromNeon() {
    if (!user?.email) return
    const year = getSelectedYear()
    initDB()
      .then(() => dbGetEntries(user.email, year))
      .then(rows => setEntries(rows.map(mapNeonRow)))
      .catch(err => console.warn('Tracker Neon load error:', err))
  }

  // Always load from Neon on mount — works for every device (mobile included)
  useEffect(() => {
    loadFromNeon()
  }, [user?.email])

  // Cross-device real-time: reload when user returns to this tab/app
  // (covers: phone unlock, tab switch, desktop↔mobile)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') loadFromNeon()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.email])

  // Same-device cross-component: reload when another component saves an entry
  useEffect(() => {
    window.addEventListener('mytrack:entry-saved', loadFromNeon)
    return () => window.removeEventListener('mytrack:entry-saved', loadFromNeon)
  }, [user?.email])

  const syncEnabled = isClockifyUser(user?.email)

  // ── Cross-device timer sync ──────────────────────────────────
  // Only RESTORES a timer from Neon — never resets a running local timer.
  // This avoids race conditions where Neon hasn't saved yet but local is already running.
  async function syncTimerWithNeon() {
    if (!user?.email) return
    if (timer.isRunning) return   // local timer is active — don't touch it
    try {
      await initDB()
      const running = await dbGetRunningTimer(user.email)
      if (!running) return        // nothing to restore
      // Timer was started on another device — restore here
      timer.start(running.started_at)
      setDescription(running.description || '')
      if (running.project_id) {
        setSelectedProject({
          id: running.project_id,
          name: running.project_name || '',
          color: running.project_color || '#7C4DFF',
        })
      }
      if (running.task_id) {
        setSelectedTask({ id: running.task_id, name: running.task_name || '' })
      }
    } catch (err) {
      console.warn('Timer sync error:', err)
    }
  }

  // Sync on mount (restore running timer from another device)
  useEffect(() => { syncTimerWithNeon() }, [user?.email])

  // Sync when user returns to the app (phone unlock, tab focus)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') syncTimerWithNeon()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.email])

  async function handleStart() {
    if (syncEnabled) {
      if (!selectedProject) {
        toast.error('Selecciona un proyecto antes de iniciar')
        return
      }
      setSyncing(true)
      // ── Timer ALWAYS starts in MyTrack — Clockify sync is best-effort ──
      const startedAt = new Date().toISOString()
      timer.start()
      dbSaveRunningTimer({
        userEmail: user.email,
        workspaceId: user.workspace_id || 'xul-ws-1',
        startedAt,
        description: description || '',
        projectId: selectedProject?.id || null,
        projectName: selectedProject?.name || null,
        projectColor: selectedProject?.color || null,
        taskId: selectedTask?.id || null,
        taskName: selectedTask?.name || null,
      }).catch(() => {})

      // Try Clockify — if it fails, timer is already running locally
      try {
        await clockifyStartTimer({
          description: description || '',
          projectId: selectedProject?.id || null,
          taskId: selectedTask?.id || null,
        })
        toast.success('⏱ Timer iniciado')
      } catch (err) {
        const msg = err.message || ''
        // Retry without task (task completed / task required error)
        if (selectedTask && msg.includes('501')) {
          try {
            await clockifyStartTimer({
              description: description || '',
              projectId: selectedProject?.id || null,
              taskId: null,
            })
            setSelectedTask(null)
            toast('⏱ Timer iniciado (tarea omitida en Clockify)', { duration: 3500 })
          } catch {
            toast('⏱ Timer iniciado en MyTrack · Sin sync Clockify', { duration: 3500 })
          }
        } else {
          toast('⏱ Timer iniciado en MyTrack · Sin sync Clockify', { duration: 3500 })
        }
      } finally {
        setSyncing(false)
      }
    } else {
      const startedAt = new Date().toISOString()
      timer.start()
      // Save to Neon so other devices can see the running timer
      dbSaveRunningTimer({
        userEmail: user.email,
        workspaceId: user.workspace_id || 'xul-ws-1',
        startedAt,
        description: description || '',
        projectId: selectedProject?.id || null,
        projectName: selectedProject?.name || null,
        projectColor: selectedProject?.color || null,
        taskId: selectedTask?.id || null,
        taskName: selectedTask?.name || null,
      }).catch(err => console.warn('Save running timer error:', err))
    }
  }

  async function handleStop() {
    const secs = timer.stop()
    // Always clear the running timer from Neon (cross-device cleanup)
    dbDeleteRunningTimer(user.email).catch(err => console.warn('Delete running timer error:', err))
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
          workspaceId: user.workspace_id || 'xul-ws-1',
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
        })).then(() => {
          // Notify Calendar (and any other page) to refresh in real time
          window.dispatchEvent(new CustomEvent('mytrack:entry-saved', {
            detail: { year: new Date(entry.start_time).getFullYear() }
          }))
        }).catch(err => console.warn('Neon save error:', err.message))
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
          workspaceId: user.workspace_id || 'xul-ws-1',
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
        // Notify Calendar to refresh in real time
        window.dispatchEvent(new CustomEvent('mytrack:entry-saved', {
          detail: { year: new Date().getFullYear() }
        }))
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
      if (!syncEnabled) await dbDeleteEntry(id)
      setEntries(e => e.filter(x => x.id !== id))
      setConfirmDeleteId(null)
      toast.success('Entrada eliminada')
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  function updateEntry(updated) {
    setEntries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
  }

  async function reactivateEntry(e) {
    if (timer.isRunning) {
      toast.error('Para el timer actual antes de reactivar')
      return
    }

    // Always restore description
    setDescription(e.description || '')

    // Find the project in the active (non-archived) projects list
    const proj = e.projects?.name
      ? projects.find(p => p.name === e.projects.name && !p.archived) || null
      : null

    if (e.projects?.name && !proj) {
      // Project is archived — pre-fill description, clear project, let user pick a new one
      setSelectedProject(null)
      setSelectedTask(null)
      toast(`📋 Descripción restaurada. El proyecto "${e.projects.name}" está archivado — elige uno activo y pulsa ▶`, { duration: 5000 })
      return
    }

    setSelectedProject(proj || null)
    setSelectedTask(e.tasks?.name ? { name: e.tasks.name, id: e.task_id } : null)

    if (syncEnabled) {
      setSyncing(true)
      // ── Timer ALWAYS starts in MyTrack — Clockify sync is best-effort ──
      const startedAt = new Date().toISOString()
      timer.start()
      dbSaveRunningTimer({
        userEmail: user.email,
        workspaceId: user.workspace_id || 'xul-ws-1',
        startedAt,
        description: e.description || '',
        projectId: proj?.id || null,
        projectName: proj?.name || null,
        projectColor: proj?.color || null,
        taskId: e.task_id || null,
        taskName: e.tasks?.name || null,
      }).catch(() => {})

      try {
        await clockifyStartTimer({
          description: e.description || '',
          projectId: proj?.id || null,
          taskId: e.task_id || null,
        })
        toast.success('⏱ Timer reactivado')
      } catch (err) {
        const msg = err.message || ''
        if (e.task_id && msg.includes('501')) {
          try {
            await clockifyStartTimer({
              description: e.description || '',
              projectId: proj?.id || null,
              taskId: null,
            })
            setSelectedTask(null)
            toast('⏱ Timer reactivado (tarea omitida en Clockify)', { duration: 3500 })
          } catch {
            toast('⏱ Timer reactivado en MyTrack · Sin sync Clockify', { duration: 3500 })
          }
        } else {
          toast('⏱ Timer reactivado en MyTrack · Sin sync Clockify', { duration: 3500 })
        }
      } finally {
        setSyncing(false)
      }
    } else {
      const startedAt = new Date().toISOString()
      timer.start()
      dbSaveRunningTimer({
        userEmail: user.email,
        workspaceId: user.workspace_id || 'xul-ws-1',
        startedAt,
        description: e.description || '',
        projectId: proj?.id || null,
        projectName: proj?.name || null,
        projectColor: proj?.color || null,
        taskId: e.task_id || null,
        taskName: e.tasks?.name || null,
      }).catch(() => {})
      toast.success('⏱ Timer reactivado')
    }
  }

  function handleManualSave(entry) {
    setEntries(prev => [entry, ...prev].sort((a, b) =>
      new Date(b.start_time) - new Date(a.start_time)
    ))
  }

  const todayEntries = entries.filter(e => { try { return isToday(parseISO(e.start_time)) } catch { return false } })
  const totalToday = todayEntries.reduce((s, e) => s + (e.duration || 0), 0)

  const _now = new Date()
  const _weekStart = startOfWeek(_now, { weekStartsOn: 1 })
  const _weekEnd   = endOfWeek(_now,   { weekStartsOn: 1 })
  const _monthStart = startOfMonth(_now)
  const _monthEnd   = endOfMonth(_now)

  const weekEntries = entries.filter(e => {
    try { return isWithinInterval(parseISO(e.start_time), { start: _weekStart, end: _weekEnd }) }
    catch { return false }
  })
  const monthEntries = entries.filter(e => {
    try { return isWithinInterval(parseISO(e.start_time), { start: _monthStart, end: _monthEnd }) }
    catch { return false }
  })

  const totalWeek = weekEntries.reduce((s, e) => s + (e.duration || 0), 0)

  const chartEntries = chartPeriod === 'Hoy' ? todayEntries
    : chartPeriod === 'Semana' ? weekEntries
    : monthEntries

  const recentEntries = showAllActivity ? entries : entries.slice(0, 8)

  // Hours by project (all entries)
  const byProject = {}
  entries.forEach(e => {
    const name = e.projects?.name || 'Sin proyecto'
    const color = e.projects?.color || '#C0C0E0'
    if (!byProject[name]) byProject[name] = { name, color, secs: 0 }
    byProject[name].secs += e.duration || 0
  })
  const projectList = Object.values(byProject).sort((a, b) => b.secs - a.secs).slice(0, 5)

  // Last 4 projects the user actually worked on (by most recent entry)
  const recentProjects = []
  const _seenProjects = new Set()
  for (const e of entries) {
    const name = e.projects?.name
    const color = e.projects?.color || '#7C4DFF'
    if (name && !_seenProjects.has(name)) {
      _seenProjects.add(name)
      recentProjects.push({ name, color })
      if (recentProjects.length === 4) break
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* 3-column grid — stacks on mobile */}
      <div style={{
        flex: 1,
        overflowY: isMobile ? 'auto' : 'hidden',
        overflowX: 'hidden',
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : undefined,
        gridTemplateColumns: isMobile ? undefined : '1fr 1fr 320px',
        gap: 0,
      }}>

        {/* ══ LEFT COLUMN ══ */}
        <div style={{ padding: isMobile ? '14px' : '20px 12px 20px 20px', overflowY: isMobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* Active task card */}
          <Card data-tour="timer-bar" color="var(--c-card-a)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: timer.isRunning ? '#22C55E' : 'var(--c-text-4)', display: 'inline-block' }} />
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
                color: timer.isRunning ? 'var(--c-text-1)' : 'var(--c-text-4)',
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
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', minWidth: 0 }}>
              <div data-tour="project-picker" style={{ minWidth: isMobile ? 0 : 180, flex: isMobile ? 1 : undefined }}>
                <SearchableDropdown
                  value={selectedProject?.id || null}
                  onChange={opt => {
                    if (!opt) { setSelectedProject(null); setSelectedTask(null); return }
                    const p = projects.find(x => x.id === opt.value)
                    setSelectedProject(p || null)
                    setSelectedTask(null)
                  }}
                  options={projects.filter(p => !p.archived).map(p => ({ value: p.id, label: p.name, color: p.color }))}
                  placeholder={syncEnabled && !selectedProject ? '⚠️ Proyecto requerido' : 'Proyecto'}
                  clearLabel="Sin proyecto"
                  style={{ fontSize: 12 }}
                />
              </div>

              {selectedProject && (
                <div style={{ minWidth: isMobile ? 0 : 140, flex: isMobile ? 1 : undefined }}>
                  <SearchableDropdown
                    value={selectedTask?.id || null}
                    onChange={opt => {
                      if (!opt) { setSelectedTask(null); return }
                      const t = projectTasks.find(x => x.id === opt.value)
                      setSelectedTask(t || null)
                    }}
                    options={projectTasks.map(t => ({ value: t.id, label: t.name, color: '#7C4DFF' }))}
                    placeholder={loadingTasks ? 'Cargando…' : 'Tarea'}
                    clearLabel="Sin tarea"
                    disabled={loadingTasks}
                    style={{ fontSize: 12 }}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card color="var(--c-card-b)">
            <CardHeader title="Recent Activity">
              <button
                onClick={() => setShowAllActivity(p => !p)}
                style={{ fontSize: 12, color: '#7C4DFF', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showAllActivity ? 'Ver menos' : `Ver todas (${entries.length})`}
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
                      {isMobile && e.end_time && (
                        <span style={{ color: 'var(--c-text-4)' }}> · {format(parseISO(e.start_time), 'HH:mm')}–{format(parseISO(e.end_time), 'HH:mm')}</span>
                      )}
                    </p>
                  </div>
                  {!isMobile && e.end_time && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-3)', flexShrink: 0 }}>
                      {format(parseISO(e.start_time), 'HH:mm')} – {format(parseISO(e.end_time), 'HH:mm')}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {timer.format(e.duration || 0)}
                  </span>
                  {/* Reactivate — hidden on mobile */}
                  {!isMobile && (
                    <button
                      onClick={() => reactivateEntry(e)}
                      title="Reactivar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = '#7C4DFF15'; ev.currentTarget.style.color = '#7C4DFF' }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-text-3)' }}
                    >
                      <Play size={13} fill="currentColor" />
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => setEditingEntry(e)}
                    title="Editar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = '#7C4DFF15'; ev.currentTarget.style.color = '#7C4DFF' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-text-3)' }}
                  >
                    <Pencil size={13} />
                  </button>

                  {/* Delete — with inline confirm */}
                  {confirmDeleteId === e.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                      <button
                        onClick={() => deleteEntry(e.id)}
                        style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >Sí</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer' }}
                      >No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(e.id)}
                      title="Eliminar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = '#EF444415'; ev.currentTarget.style.color = '#EF4444' }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-text-3)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ MIDDLE COLUMN ══ */}
        <div style={{ padding: isMobile ? '14px' : '20px 12px', overflowY: isMobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 14, borderLeft: isMobile ? 'none' : '1px solid var(--c-border-light)', borderRight: isMobile ? 'none' : '1px solid var(--c-border-light)', borderTop: isMobile ? '1px solid var(--c-border-light)' : 'none', minWidth: 0 }}>

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
                {weekEntries.length} registros
              </p>
            </Card>
          </div>

          {/* Report analytics / activity heatmap */}
          <Card color="var(--c-card-c)">
            <CardHeader title="Report Analytics">
              <div style={{ display: 'flex', gap: 4 }}>
                {['Hoy', 'Semana', 'Mes'].map(t => (
                  <button key={t} onClick={() => setChartPeriod(t)} style={{
                    padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 500,
                    background: t === chartPeriod ? '#7C4DFF' : 'transparent',
                    color: t === chartPeriod ? '#fff' : '#94A3B8',
                  }}>{t}</button>
                ))}
              </div>
            </CardHeader>
            <ActivityGrid entries={chartEntries} formatTime={timer.format} period={chartPeriod} />
          </Card>

          {/* Project time breakdown */}
          <Card color="var(--c-card-d)">
            <CardHeader title="Asignación de horas por proyecto/servicios" />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projectList.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center', padding: '12px 0' }}>Sin datos</p>
              ) : (() => {
                const totalProjectSecs = projectList.reduce((s, p) => s + p.secs, 0) || 1
                return projectList.map(p => {
                  const pct = Math.round((p.secs / totalProjectSecs) * 100)
                  return (
                    <div key={p.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-1)', fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                            {timer.format(p.secs)}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--c-bg-muted)' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          background: p.color,
                          width: `${pct}%`,
                          transition: 'width 0.4s',
                        }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </Card>

          {/* ── Mis Post-its ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--c-text-4)' }}>Mis notas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stickyNotes.map((note, i) => (
                <StickyNote
                  key={note.id != null ? note.id : `empty-${i}`}
                  idx={i}
                  note={note}
                  members={members}
                  userEmail={user?.email}
                  authorName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
                  onChange={updated => setStickyNotes(prev => prev.map((n, j) => j === i ? updated : n))}
                  onDelete={() => setStickyNotes(prev => prev.map((n, j) => j === i ? { id: null, slot: i, content: '', shared_with: '[]' } : n))}
                />
              ))}
            </div>
          </div>

        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div style={{ padding: isMobile ? '14px' : '20px 20px 20px 12px', overflowY: isMobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 14, borderTop: isMobile ? '1px solid var(--c-border-light)' : 'none', minWidth: 0 }}>

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
            <CardHeader title="Proyectos recientes">
              <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 600 }}>{projects.filter(p => !p.archived).length} TOTAL</span>
            </CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {recentProjects.length > 0 ? recentProjects.map(p => (
                <div key={p.name} style={{
                  padding: '10px', borderRadius: 10, minWidth: 0,
                  background: p.color + '18', border: `1px solid ${p.color}30`,
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
              )) : (
                <p style={{ fontSize: 12, color: 'var(--c-text-3)', gridColumn: '1 / -1', textAlign: 'center', padding: '12px 0' }}>
                  Sin entradas registradas aún
                </p>
              )}
            </div>
          </Card>

          {/* ── Notas compartidas conmigo ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Share2 size={11} style={{ color: 'var(--c-text-4)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--c-text-4)' }}>Compartidas conmigo</span>
            </div>
            {sharedNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.45 }}>
                <Share2 size={22} style={{ color: 'var(--c-text-4)', marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: 0 }}>Nadie ha compartido notas contigo</p>
              </div>
            ) : sharedNotes.map((note, i) => (
              <SharedNoteCard
                key={note.id}
                note={note}
                idx={i}
                userEmail={user?.email}
                userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
                onRemove={id => setSharedNotes(prev => prev.filter(n => n.id !== id))}
                onChange={updated => setSharedNotes(prev => prev.map(n => n.id === updated.id ? updated : n))}
              />
            ))}
          </div>

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

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          user={user}
          onClose={() => setEditingEntry(null)}
          onSaved={updated => { updateEntry(updated); setEditingEntry(null) }}
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

// ── SharedNoteCard ─────────────────────────────────────────────────────────────
const SHARED_NOTE_COLORS = ['#FFF9C4', '#FFF3E0', '#F3E5F5']
const REACTION_EMOJIS_SN = ['👍', '❤️', '😂', '🎉', '👀', '🔥']

function SharedNoteCard({ note, idx, userEmail, userName, onRemove, onChange }) {
  const [editing, setEditing]     = useState(false)
  const [draft, setDraft]         = useState(note.content || '')
  const [saving, setSaving]       = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [reactions, setReactions] = useState(() => {
    try { return JSON.parse(note.reactions || '[]') } catch { return [] }
  })

  useEffect(() => {
    try { setReactions(JSON.parse(note.reactions || '[]')) } catch {}
  }, [note.reactions])

  const bg = SHARED_NOTE_COLORS[idx % 3]
  const initials = note.author_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  const grouped = REACTION_EMOJIS_SN.map(emoji => {
    const list = reactions.filter(r => r.emoji === emoji)
    return { emoji, count: list.length, mine: list.some(r => r.email === userEmail) }
  }).filter(g => g.count > 0)

  async function handleSave() {
    setSaving(true)
    try {
      await dbUpdateNoteContent(note.id, draft)
      onChange({ ...note, content: draft })
      setEditing(false)
      toast.success('Nota guardada')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  async function handleUnshare() {
    try {
      await dbUnshareNote(note.id, userEmail)
      onRemove(note.id)
      toast.success('Nota eliminada')
    } catch { toast.error('Error al eliminar') }
  }

  async function handleReact(emoji) {
    try {
      await ensureReactionsColumn()
      const next = await dbToggleReaction(note.id, userEmail, userName, emoji)
      setReactions(next)
      onChange({ ...note, reactions: JSON.stringify(next) })
    } catch { toast.error('Error al reaccionar') }
    setEmojiOpen(false)
  }

  return (
    <div style={{ borderRadius: 12, background: bg, boxShadow: '2px 4px 10px rgba(0,0,0,0.08)', marginBottom: 10, overflow: 'hidden', position: 'relative' }}>
      {/* Header: author + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 6px' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#7C4DFF,#E040FB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#5a4a00', flex: 1 }}>{note.author_name}</span>
        <button onClick={() => { setEditing(true); setDraft(note.content || '') }} title="Editar"
          style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a08000' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <Pencil size={11} />
        </button>
        <button onClick={handleUnshare} title="Eliminar"
          style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0392b' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <X size={11} />
        </button>
      </div>

      {/* Content or editor */}
      {editing ? (
        <div style={{ padding: '0 12px 8px' }}>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ width: '100%', minHeight: 70, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, lineHeight: 1.5, color: '#4a3f00', boxSizing: 'border-box', padding: '8px' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)}
              style={{ height: 26, padding: '0 10px', borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: 11, color: '#5a4a00', fontWeight: 500 }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ height: 26, padding: '0 10px', borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.18)', cursor: 'pointer', fontSize: 11, color: '#4a3000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              {saving ? 'Guardando…' : <><Check size={11} /><span>Guardar</span></>}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#4a3f00', margin: 0, padding: '0 12px 8px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {note.content || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Nota vacía</span>}
        </p>
      )}

      {/* Reaction bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px 10px', flexWrap: 'wrap' }}>
        {grouped.map(g => (
          <button key={g.emoji} onClick={() => handleReact(g.emoji)}
            title={`${g.count} reacción${g.count > 1 ? 'es' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 12, border: `1.5px solid ${g.mine ? 'rgba(124,77,255,0.5)' : 'rgba(0,0,0,0.15)'}`, background: g.mine ? 'rgba(124,77,255,0.12)' : 'rgba(0,0,0,0.06)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span>{g.emoji}</span><span style={{ fontSize: 10, fontWeight: 700, color: '#5a4a00' }}>{g.count}</span>
          </button>
        ))}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setEmojiOpen(p => !p)} title="Reaccionar"
            style={{ width: 24, height: 24, borderRadius: 20, border: '1.5px dashed rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <Smile size={12} style={{ color: '#a08000' }} />
          </button>
          {emojiOpen && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '6px 8px', display: 'flex', gap: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200 }}>
              {REACTION_EMOJIS_SN.map(e => (
                <button key={e} onClick={() => handleReact(e)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'var(--c-bg-muted)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
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

function ActivityGrid({ entries, formatTime, period }) {
  // Build bars depending on period
  let bars = []

  if (period === 'Hoy') {
    // 24 bars — one per hour
    bars = Array.from({ length: 24 }, (_, h) => {
      const secs = entries
        .filter(e => e.start_time && new Date(e.start_time).getHours() === h)
        .reduce((s, e) => s + (e.duration || 0), 0)
      return { label: `${h}:00`, secs }
    })
  } else if (period === 'Semana') {
    // 7 bars — Mon to Sun
    const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    bars = Array.from({ length: 7 }, (_, i) => {
      // date-fns startOfWeek uses 0=Sun, so Mon=1. We want Mon=0 → dayOfWeek (1-7 → 0-6)
      const secs = entries
        .filter(e => {
          if (!e.start_time) return false
          const d = new Date(e.start_time).getDay() // 0=Sun,1=Mon,...6=Sat
          const idx = d === 0 ? 6 : d - 1         // convert to Mon=0…Sun=6
          return idx === i
        })
        .reduce((s, e) => s + (e.duration || 0), 0)
      return { label: DAY_NAMES[i], secs }
    })
  } else {
    // Mes — one bar per day of the current month (1-31)
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    bars = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const secs = entries
        .filter(e => e.start_time && new Date(e.start_time).getDate() === day)
        .reduce((s, e) => s + (e.duration || 0), 0)
      return { label: String(day), secs }
    })
  }

  const max = Math.max(...bars.map(b => b.secs), 1)

  // Which labels to show on the x-axis (avoid crowding)
  const showEvery = period === 'Hoy' ? 4 : period === 'Semana' ? 1 : 5

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: period === 'Mes' ? 2 : 4, alignItems: 'flex-end', height: 70 }}>
        {bars.map(({ label, secs }, i) => (
          <div
            key={i}
            title={`${label} — ${formatTime(secs)}`}
            style={{
              flex: 1,
              height: secs > 0 ? `${Math.max(6, (secs / max) * 70)}px` : 5,
              borderRadius: 3,
              background: secs > 0 ? 'linear-gradient(180deg,#7C4DFF,#E040FB)' : 'var(--c-bg-muted)',
              transition: 'height 0.3s',
              cursor: secs > 0 ? 'pointer' : 'default',
              minWidth: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 6 }}>
        {bars.map(({ label }, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            {i % showEvery === 0 && (
              <span style={{ fontSize: period === 'Semana' ? 10 : 9, color: 'var(--c-text-3)', display: 'block' }}>
                {label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
