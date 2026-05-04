import { useState, useEffect } from 'react'
import { Play, Square, Plus, ChevronDown, Clock, Tag } from 'lucide-react'
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
  const [mode, setMode] = useState('timer')

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
      {/* Page header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#1A1A2E' }}>Tracker</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9090B0' }}>
              Hoy: <span className="font-semibold font-numeric" style={{ color: '#7B68EE' }}>{timer.format(totalToday)}</span> registradas
            </p>
          </div>
          <button
            data-tour="manual-btn"
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
            style={{ background: 'rgba(123,104,238,0.1)', color: '#7B68EE', border: '1px solid rgba(123,104,238,0.2)' }}
          >
            <Plus size={14} />
            Manual
          </button>
        </div>
      </div>

      {/* Timer bar */}
      <div data-tour="timer-bar" className="mx-6 mb-5 rounded-2xl overflow-hidden" style={{
        background: '#fff',
        border: '1.5px solid #E8E8F0',
        boxShadow: '0 2px 16px rgba(107,78,255,0.06)',
      }}>
        {/* Mode tabs */}
        <div className="flex border-b" style={{ borderColor: '#F0F0F8' }}>
          {['timer', 'manual'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2.5 text-xs font-semibold capitalize transition-all"
              style={{
                color: mode === m ? '#7B68EE' : '#9090B0',
                borderBottom: mode === m ? '2px solid #7B68EE' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {m === 'timer' ? '⏱ Timer' : '✏️ Manual'}
            </button>
          ))}
        </div>

        {mode === 'timer' ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <input
              type="text"
              placeholder="¿En qué estás trabajando?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="flex-1 text-sm bg-transparent border-none outline-none"
              style={{ color: '#1A1A2E' }}
            />

            {/* Project picker */}
            <div data-tour="project-picker" className="relative">
              <button
                onClick={() => { setShowProjectPicker(p => !p); setShowTaskPicker(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: selectedProject ? `${selectedProject.color}18` : '#F4F4FA',
                  color: selectedProject ? selectedProject.color : '#9090B0',
                  border: `1.5px solid ${selectedProject ? selectedProject.color + '40' : '#E8E8F0'}`,
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedProject?.color || '#D0D0E0' }} />
                {selectedProject?.name || 'Proyecto'}
                <ChevronDown size={12} />
              </button>
              {showProjectPicker && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden"
                  style={{ background: '#fff', border: '1.5px solid #E8E8F0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                  <button onClick={() => { setSelectedProject(null); setSelectedTask(null); setShowProjectPicker(false) }}
                    className="w-full text-left px-4 py-2 text-xs transition-colors"
                    style={{ color: '#9090B0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F4FA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Sin proyecto
                  </button>
                  {projects.map(p => (
                    <button key={p.id}
                      onClick={() => { setSelectedProject(p); setSelectedTask(null); setShowProjectPicker(false) }}
                      className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors"
                      style={{ color: '#1A1A2E' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F4F4FA'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      {p.clients && <span className="text-gray-400">{p.clients.name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Task picker — only shown when a project is selected */}
            {selectedProject && (
              <div className="relative">
                <button
                  onClick={() => { setShowTaskPicker(p => !p); setShowProjectPicker(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: selectedTask ? 'rgba(123,104,238,0.1)' : '#F4F4FA',
                    color: selectedTask ? '#7B68EE' : '#9090B0',
                    border: `1.5px solid ${selectedTask ? 'rgba(123,104,238,0.3)' : '#E8E8F0'}`,
                  }}
                >
                  <Tag size={11} />
                  {selectedTask?.name || 'Tarea'}
                  <ChevronDown size={12} />
                </button>
                {showTaskPicker && (
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden"
                    style={{ background: '#fff', border: '1.5px solid #E8E8F0', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                    <button onClick={() => { setSelectedTask(null); setShowTaskPicker(false) }}
                      className="w-full text-left px-4 py-2 text-xs transition-colors"
                      style={{ color: '#9090B0' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F4F4FA'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      Sin tarea
                    </button>
                    {projectTasks.length === 0 ? (
                      <p className="px-4 py-2 text-xs" style={{ color: '#C0C0D8' }}>No hay tareas</p>
                    ) : projectTasks.map(t => (
                      <button key={t.id}
                        onClick={() => { setSelectedTask(t); setShowTaskPicker(false) }}
                        className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 transition-colors"
                        style={{ color: '#1A1A2E' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F4F4FA'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7B68EE' }} />
                        <span className="flex-1 truncate">{t.name}</span>
                        {t.estimated_hours && <span style={{ color: '#B0B0C8' }}>{t.estimated_hours}h</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timer display */}
            <div className="font-numeric text-2xl font-bold w-28 text-center"
              style={{ color: timer.isRunning ? '#7B68EE' : '#1A1A2E' }}>
              {timer.formatted}
            </div>

            {/* Start/Stop */}
            <button
              onClick={timer.isRunning ? handleStop : timer.start}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
              style={{
                background: timer.isRunning
                  ? 'linear-gradient(135deg,#FF6B6B,#FF4757)'
                  : 'linear-gradient(135deg,#7B68EE,#6B4EFF)',
                boxShadow: timer.isRunning
                  ? '0 4px 14px rgba(255,71,87,0.4)'
                  : '0 4px 14px rgba(107,78,255,0.4)',
              }}
            >
              {timer.isRunning
                ? <Square size={15} fill="white" color="white" />
                : <Play size={15} fill="white" color="white" style={{ marginLeft: 2 }} />
              }
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)', boxShadow: '0 4px 14px rgba(107,78,255,0.3)' }}
            >
              <Plus size={16} />
              Añadir entrada manual
            </button>
          </div>
        )}
      </div>

      {/* Entries */}
      <div data-tour="entries-list" className="flex-1 px-6 pb-6 space-y-5 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Clock size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: '#4A4A6A' }}>Sin entradas esta semana</p>
            <p className="text-sm mt-1" style={{ color: '#9090B0' }}>Inicia el timer o añade tiempo manualmente</p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9090B0' }}>{day}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(123,104,238,0.1)', color: '#7B68EE' }}>
                    {dayEntries.length} {dayEntries.length === 1 ? 'entrada' : 'entradas'}
                  </span>
                </div>
                <span className="font-numeric text-sm font-bold" style={{ color: '#4A4A6A' }}>
                  {timer.format(dayEntries.reduce((s, e) => s + (e.duration || 0), 0))}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{
                background: '#fff',
                border: '1.5px solid #E8E8F0',
                boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
              }}>
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
