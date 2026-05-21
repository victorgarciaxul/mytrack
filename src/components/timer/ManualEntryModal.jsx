import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { clockifyCreateEntry, isClockifyUser, clockifyGetProjectTasks } from '../../lib/clockify'
import { initDB, dbInsertEntry } from '../../lib/db'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ManualEntryModal({ onClose, onSave, projects, workspace, user, isDemo, onDemoSave }) {
  const { isDemo: authIsDemo } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [saving, setSaving] = useState(false)
  const [projectTasks, setProjectTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  useEffect(() => {
    if (!projectId) { setProjectTasks([]); setTaskId(''); return }
    setLoadingTasks(true)
    clockifyGetProjectTasks(projectId)
      .then(tasks => { setProjectTasks(tasks); setLoadingTasks(false) })
      .catch(() => setLoadingTasks(false))
  }, [projectId])

  function handleProjectChange(newProjectId) {
    setProjectId(newProjectId)
    setTaskId('')
  }

  async function handleSave() {
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    if (end <= start) { toast.error('La hora de fin debe ser posterior'); return }
    const duration = Math.floor((end - start) / 1000)
    setSaving(true)

    // ── Clockify sync — only for the Clockify owner ──
    const syncEnabled = isClockifyUser(user?.email)
    if (syncEnabled) {
      const project = projects.find(p => p.id === projectId)
      const task = projectTasks.find(t => t.id === taskId)
      try {
        const saved = await clockifyCreateEntry({
          description: desc || '',
          projectId: projectId || null,
          taskId: taskId || null,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        const entry = {
          id: saved.id,
          workspace_id: workspace?.id,
          description: saved.description || desc || '(sin descripción)',
          start_time: saved.timeInterval?.start || start.toISOString(),
          end_time: saved.timeInterval?.end || end.toISOString(),
          duration,
          projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
          tasks: task ? { name: task.name } : null,
        }
        onDemoSave?.(entry)
        // Also save to Neon
        initDB().then(() => dbInsertEntry({
          id: saved.id,
          userEmail: user?.email,
          workspaceId: 'xul-ws-1',
          projectId: projectId || null,
          projectName: project?.name || null,
          projectColor: project?.color || null,
          clientName: project?.clients?.name || null,
          taskId: taskId || null,
          taskName: task?.name || null,
          description: entry.description,
          startTime: entry.start_time,
          endTime: entry.end_time,
          duration,
          billable: true,
        })).catch(err => console.warn('Neon save error:', err.message))
        toast.success('✅ Guardado en Clockify')
      } catch (err) {
        toast.error('Error Clockify: ' + err.message)
      }
      setSaving(false)
      onSave()
      return
    }

    // Non-Clockify users: save to Neon
    const project = projects.find(p => p.id === projectId)
    const task = projectTasks.find(t => t.id === taskId)
    try {
      await initDB()
      const saved = await dbInsertEntry({
        userEmail: user?.email,
        workspaceId: 'xul-ws-1',
        projectId: projectId || null,
        projectName: project?.name || null,
        projectColor: project?.color || null,
        taskId: taskId || null,
        taskName: task?.name || null,
        description: desc || '(sin descripción)',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration,
      })
      onDemoSave?.({
        id: saved.id,
        description: saved.description,
        start_time: saved.start_time,
        end_time: saved.end_time,
        duration: saved.duration,
        projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
        tasks: task ? { name: task.name } : null,
      })
      toast.success('Entrada añadida')
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    }
    setSaving(false)
    onSave()
  }

  const inputStyle = {
    background: 'var(--c-input-bg)',
    border: '1px solid var(--c-input-border)',
    color: 'var(--c-text-1)',
    borderRadius: 10,
  }
  const focusStyle = { borderColor: '#7C4DFF', background: 'var(--c-bg-surface)' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(13,13,30,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-lg overflow-hidden" style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--c-border-light)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--c-text-1)' }}>Añadir tiempo manual</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-3)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-3)' }}>Descripción</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="¿En qué trabajaste?"
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: 'var(--c-input-border)', background: 'var(--c-input-bg)' })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-3)' }}>Proyecto</label>
            <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}>
              <option value="">Sin proyecto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-3)' }}>Tarea</label>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              disabled={!projectId || loadingTasks}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={{ ...inputStyle, opacity: !projectId ? 0.5 : 1, cursor: !projectId ? 'not-allowed' : 'pointer' }}
            >
              {!projectId
                ? <option value="">Selecciona un proyecto primero</option>
                : loadingTasks
                  ? <option value="">Cargando tareas…</option>
                  : <>
                      <option value="">Sin tarea</option>
                      {projectTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </>
              }
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-3)' }}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: 'var(--c-input-border)', background: 'var(--c-input-bg)' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Inicio', startTime, setStartTime], ['Fin', endTime, setEndTime]].map(([label, val, setter]) => (
              <div key={label}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-3)' }}>{label}</label>
                <input type="time" value={val} onChange={e => setter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: 'var(--c-input-border)', background: 'var(--c-input-bg)' })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--c-input-bg)', color: 'var(--c-text-2)', border: '1px solid var(--c-input-border)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EBEBF5'}
            onMouseLeave={e => e.currentTarget.style.background = '#F7F8FA'}
          >
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#7C4DFF',  }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
