import { useState, useEffect } from 'react'
import { Play, Square, Plus, ChevronDown, Tag, Hash } from 'lucide-react'
import { useTimer } from '../hooks/useTimer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { demoEntries } from '../lib/demoData'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import TimeEntryRow from '../components/timer/TimeEntryRow'
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
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [showManual, setShowManual] = useState(false)

  const projectTasks = selectedProject ? getTasksForProject(selectedProject.id) : []

  useEffect(() => {
    if (workspace && !isDemo) loadEntries()
  }, [workspace])

  async function loadEntries() {
    const since = subDays(new Date(), 7).toISOString()
    const { data, error } = await supabase
      .from('time_entries')
      .select('*, projects(name, color, clients(name)), tasks(name)')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .gte('start_time', since)
      .order('start_time', { ascending: false })
    if (!error) setEntries(data || [])
  }

  async function handleStop() {
    const secs = timer.stop()
    if (secs < 5) { timer.reset(); return }
    const start = new Date(Date.now() - secs * 1000)
    const end = new Date()

    if (isDemo) {
      const newEntry = {
        id: `demo-${Date.now()}`,
        workspace_id: workspace.id,
        user_id: user.id,
        description: description || '(sin descripción)',
        project_id: selectedProject?.id || null,
        task_id: selectedTask?.id || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration: secs,
        projects: selectedProject ? { name: selectedProject.name, color: selectedProject.color, clients: selectedProject.clients } : null,
        tasks: selectedTask ? { name: selectedTask.name } : null,
      }
      setEntries(prev => [newEntry, ...prev])
      toast.success('Tiempo registrado')
      timer.reset(); setDescription(''); setSelectedProject(null); setSelectedTask(null)
      return
    }

    const { error } = await supabase.from('time_entries').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      description: description || '(sin descripción)',
      project_id: selectedProject?.id || null,
      task_id: selectedTask?.id || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration: secs,
    })
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Tiempo registrado')
    timer.reset(); setDescription(''); setSelectedProject(null); setSelectedTask(null)
    loadEntries()
  }

  async function handleDeleteEntry(id) {
    if (isDemo) { setEntries(e => e.filter(x => x.id !== id)); return }
    await supabase.from('time_entries').delete().eq('id', id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const grouped = groupByDay(entries)
  const totalToday = entries
    .filter(e => isToday(parseISO(e.start_time)))
    .reduce((s, e) => s + (e.duration || 0), 0)

  return (
    <div className="flex flex-col h-full">

      {/* ── Timer entry bar ── */}
      <div
        data-tour="timer-bar"
        className="flex items-center gap-3 px-6 py-0 flex-shrink-0"
        style={{ borderBottom: '1px solid #E5E8EE', background: '#fff', height: 56 }}
      >
        {/* Start/Stop button */}
        <button
          onClick={timer.isRunning ? handleStop : timer.start}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: timer.isRunning ? '#EF4444' : '#7C4DFF',
          }}
        >
          {timer.isRunning
            ? <Square size={12} fill="white" color="white" />
            : <Play size={12} fill="white" color="white" style={{ marginLeft: 1 }} />
          }
        </button>

        {/* Description */}
        <input
          type="text"
          placeholder="¿En qué estás trabajando?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !timer.isRunning && timer.start()}
          className="flex-1 text-sm bg-transparent border-none outline-none"
          style={{ color: '#1C1C28' }}
        />

        {/* Project picker */}
        <div data-tour="project-picker" className="relative">
          <button
            onClick={() => { setShowProjectPicker(p => !p); setShowTaskPicker(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: selectedProject ? `${selectedProject.color}15` : 'transparent',
              color: selectedProject ? selectedProject.color : '#9095B0',
              border: `1px solid ${selectedProject ? selectedProject.color + '40' : '#E5E8EE'}`,
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedProject?.color || '#D0D0E0' }} />
            {selectedProject?.name || 'Proyecto'}
            <ChevronDown size={11} />
          </button>
          {showProjectPicker && (
            <Dropdown onClose={() => setShowProjectPicker(false)}>
              <DropdownItem onClick={() => { setSelectedProject(null); setSelectedTask(null); setShowProjectPicker(false) }} muted>Sin proyecto</DropdownItem>
              {projects.map(p => (
                <button key={p.id}
                  onClick={() => { setSelectedProject(p); setSelectedTask(null); setShowProjectPicker(false) }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                  style={{ color: '#1C1C28' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.clients && <span style={{ color: '#A0A5C0' }}>{p.clients.name}</span>}
                </button>
              ))}
            </Dropdown>
          )}
        </div>

        {/* Task picker */}
        {selectedProject && (
          <div className="relative">
            <button
              onClick={() => { setShowTaskPicker(p => !p); setShowProjectPicker(false) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: selectedTask ? 'rgba(123,104,238,0.1)' : 'transparent',
                color: selectedTask ? '#7C4DFF' : '#9095B0',
                border: `1px solid ${selectedTask ? 'rgba(123,104,238,0.3)' : '#E5E8EE'}`,
              }}
            >
              <Hash size={11} />
              {selectedTask?.name || 'Tarea'}
              <ChevronDown size={11} />
            </button>
            {showTaskPicker && (
              <Dropdown onClose={() => setShowTaskPicker(false)}>
                <DropdownItem onClick={() => { setSelectedTask(null); setShowTaskPicker(false) }} muted>Sin tarea</DropdownItem>
                {projectTasks.length === 0
                  ? <p className="px-3 py-2 text-xs" style={{ color: '#A0A5C0' }}>No hay tareas</p>
                  : projectTasks.map(t => (
                    <button key={t.id}
                      onClick={() => { setSelectedTask(t); setShowTaskPicker(false) }}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                      style={{ color: '#1C1C28' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7C4DFF' }} />
                      <span className="flex-1 truncate">{t.name}</span>
                      {t.estimated_hours && <span style={{ color: '#9095B0' }}>{t.estimated_hours}h</span>}
                    </button>
                  ))
                }
              </Dropdown>
            )}
          </div>
        )}

        {/* Timer display */}
        <div
          className="font-numeric text-sm font-semibold w-20 text-right"
          style={{ color: timer.isRunning ? '#7C4DFF' : '#7A7F9A' }}
        >
          {timer.formatted}
        </div>

        {/* Divider + manual */}
        <div style={{ width: 1, height: 20, background: '#E5E8EE' }} />
        <button
          data-tour="manual-btn"
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all"
          style={{ color: '#7A7F9A', border: '1px solid #E5E8EE' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.color = '#1C1C28' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7A7F9A' }}
        >
          <Plus size={12} />
          Manual
        </button>
      </div>

      {/* ── Today summary ── */}
      {totalToday > 0 && (
        <div className="px-6 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid #F0F0F8', background: '#FAFAFA' }}>
          <span className="text-xs" style={{ color: '#7A7F9A' }}>Hoy</span>
          <span className="font-numeric text-xs font-semibold" style={{ color: '#7C4DFF' }}>{timer.format(totalToday)}</span>
        </div>
      )}

      {/* ── Entries ── */}
      <div data-tour="entries-list" className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
              style={{ background: '#F3F4F8' }}>
              <Play size={20} style={{ color: '#C0C0E0', marginLeft: 2 }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#3D4060' }}>Sin entradas esta semana</p>
            <p className="text-xs mt-1" style={{ color: '#9095B0' }}>Inicia el timer o añade tiempo manualmente</p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day}>
              {/* Day header */}
              <div
                className="flex items-center justify-between px-6 py-2 sticky top-0"
                style={{ background: '#F7F8FA', borderBottom: '1px solid #EEEEF6', zIndex: 1 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: '#3D4060' }}>{day}</span>
                  <span className="text-xs" style={{ color: '#9095B0' }}>{dayEntries.length} {dayEntries.length === 1 ? 'entrada' : 'entradas'}</span>
                </div>
                <span className="font-numeric text-xs font-semibold" style={{ color: '#1C1C28' }}>
                  {timer.format(dayEntries.reduce((s, e) => s + (e.duration || 0), 0))}
                </span>
              </div>
              {/* Entry rows */}
              <div style={{ background: '#fff' }}>
                {dayEntries.map((entry, i) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={handleDeleteEntry}
                    onRefresh={isDemo ? () => {} : loadEntries}
                    projects={projects}
                    formatTime={timer.format}
                    isLast={i === dayEntries.length - 1}
                  />
                ))}
              </div>
            </div>
          ))
        )}
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

function Dropdown({ children, onClose }) {
  return (
    <div
      className="absolute right-0 top-full mt-1 w-52 z-20 py-1 overflow-hidden"
      style={{ background: '#fff', border: '1px solid #E5E8EE', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}
    >
      {children}
    </div>
  )
}

function DropdownItem({ children, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-xs transition-colors"
      style={{ color: muted ? '#9095B0' : '#1C1C28' }}
      onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}

function groupByDay(entries) {
  const groups = {}
  entries.forEach(entry => {
    const d = parseISO(entry.start_time)
    let label
    if (isToday(d)) label = 'Hoy'
    else if (isYesterday(d)) label = 'Ayer'
    else label = format(d, "EEEE, d 'de' MMMM", { locale: es })
    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  })
  return groups
}
