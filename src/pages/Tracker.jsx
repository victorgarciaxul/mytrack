import { useState, useEffect } from 'react'
import { Play, Square, Plus, ChevronDown, Hash, Zap } from 'lucide-react'
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
      workspace_id: workspace.id, user_id: user.id,
      description: description || '(sin descripción)',
      project_id: selectedProject?.id || null,
      task_id: selectedTask?.id || null,
      start_time: start.toISOString(), end_time: end.toISOString(), duration: secs,
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
  const totalToday = entries.filter(e => isToday(parseISO(e.start_time))).reduce((s, e) => s + (e.duration || 0), 0)
  const todayEntries = entries.filter(e => isToday(parseISO(e.start_time))).length
  const totalWeek = entries.reduce((s, e) => s + (e.duration || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>

      {/* ── Stats header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #7C4DFF 0%, #E040FB 100%)',
        padding: '20px 28px 18px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Hoy</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
                {timer.format(totalToday)}
              </p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Entradas hoy</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>{todayEntries}</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginBottom: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Esta semana</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>
                {timer.format(totalWeek)}
              </p>
            </div>
          </div>
          <button
            data-tour="manual-btn"
            onClick={() => setShowManual(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            <Plus size={14} /> Manual
          </button>
        </div>
      </div>

      {/* ── Timer entry bar ── */}
      <div
        data-tour="timer-bar"
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #EEF0F5',
          height: 60,
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Play/Stop */}
        <button
          onClick={timer.isRunning ? handleStop : timer.start}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: timer.isRunning
              ? 'linear-gradient(135deg,#FF4757,#FF6B81)'
              : 'linear-gradient(135deg,#7C4DFF,#E040FB)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: timer.isRunning ? '0 2px 10px rgba(255,71,87,0.4)' : '0 2px 10px rgba(124,77,255,0.4)',
            transition: 'transform 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {timer.isRunning
            ? <Square size={13} fill="white" color="white" />
            : <Play size={13} fill="white" color="white" style={{ marginLeft: 2 }} />
          }
        </button>

        {/* Description */}
        <input
          type="text"
          placeholder="¿En qué estás trabajando?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !timer.isRunning && timer.start()}
          style={{
            flex: 1, fontSize: 14, background: 'transparent',
            border: 'none', outline: 'none', color: '#0F172A',
          }}
        />

        {/* Project picker */}
        <div data-tour="project-picker" style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowProjectPicker(p => !p); setShowTaskPicker(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6,
              background: selectedProject ? `${selectedProject.color}12` : '#F8FAFC',
              color: selectedProject ? selectedProject.color : '#64748B',
              border: `1px solid ${selectedProject ? selectedProject.color + '30' : '#E2E8F0'}`,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedProject?.color || '#CBD5E1', flexShrink: 0 }} />
            {selectedProject?.name || 'Proyecto'}
            <ChevronDown size={11} />
          </button>
          {showProjectPicker && (
            <Dropdown onClose={() => setShowProjectPicker(false)}>
              <DropItem onClick={() => { setSelectedProject(null); setSelectedTask(null); setShowProjectPicker(false) }} muted>Sin proyecto</DropItem>
              {projects.map(p => (
                <DropItem key={p.id} onClick={() => { setSelectedProject(p); setSelectedTask(null); setShowProjectPicker(false) }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  {p.name}
                  {p.clients && <span style={{ color: '#94A3B8', marginLeft: 'auto' }}>{p.clients.name}</span>}
                </DropItem>
              ))}
            </Dropdown>
          )}
        </div>

        {/* Task picker */}
        {selectedProject && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowTaskPicker(p => !p); setShowProjectPicker(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6,
                background: selectedTask ? 'rgba(124,77,255,0.08)' : '#F8FAFC',
                color: selectedTask ? '#7C4DFF' : '#64748B',
                border: `1px solid ${selectedTask ? 'rgba(124,77,255,0.25)' : '#E2E8F0'}`,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Hash size={11} />
              {selectedTask?.name || 'Tarea'}
              <ChevronDown size={11} />
            </button>
            {showTaskPicker && (
              <Dropdown onClose={() => setShowTaskPicker(false)}>
                <DropItem onClick={() => { setSelectedTask(null); setShowTaskPicker(false) }} muted>Sin tarea</DropItem>
                {projectTasks.length === 0
                  ? <p style={{ padding: '8px 12px', fontSize: 12, color: '#94A3B8' }}>No hay tareas</p>
                  : projectTasks.map(t => (
                    <DropItem key={t.id} onClick={() => { setSelectedTask(t); setShowTaskPicker(false) }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C4DFF', flexShrink: 0 }} />
                      {t.name}
                      {t.estimated_hours && <span style={{ color: '#94A3B8', marginLeft: 'auto' }}>{t.estimated_hours}h</span>}
                    </DropItem>
                  ))
                }
              </Dropdown>
            )}
          </div>
        )}

        {/* Timer */}
        <div style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 18, fontWeight: 700,
          color: timer.isRunning ? '#7C4DFF' : '#94A3B8',
          letterSpacing: '-0.5px', minWidth: 80, textAlign: 'right',
          transition: 'color 0.2s',
        }}>
          {timer.formatted}
        </div>
      </div>

      {/* ── Entries ── */}
      <div data-tour="entries-list" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {entries.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg,rgba(124,77,255,0.12),rgba(224,64,251,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Zap size={24} style={{ color: '#7C4DFF' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', margin: 0 }}>Sin entradas esta semana</p>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>Inicia el timer o añade tiempo manualmente</p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day} style={{ marginBottom: 20 }}>
              {/* Day header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8, padding: '0 4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{day}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: '#F1F5F9', color: '#64748B', fontWeight: 500,
                  }}>
                    {dayEntries.length} {dayEntries.length === 1 ? 'entrada' : 'entradas'}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                  {timer.format(dayEntries.reduce((s, e) => s + (e.duration || 0), 0))}
                </span>
              </div>

              {/* Card with entries */}
              <div style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #EEF0F5',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
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

function Dropdown({ children }) {
  return (
    <div style={{
      position: 'absolute', right: 0, top: 'calc(100% + 4px)',
      minWidth: 200, background: '#fff', borderRadius: 10,
      border: '1px solid #E2E8F0', boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
      zIndex: 50, overflow: 'hidden', padding: '4px 0',
    }}>
      {children}
    </div>
  )
}

function DropItem({ children, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', fontSize: 12, fontWeight: 400,
        color: muted ? '#94A3B8' : '#1E293B',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
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
