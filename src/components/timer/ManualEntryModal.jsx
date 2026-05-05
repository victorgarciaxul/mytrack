import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ManualEntryModal({ onClose, onSave, projects, workspace, user, isDemo, onDemoSave }) {
  const { getTasksForProject } = useWorkspace()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [saving, setSaving] = useState(false)

  const projectTasks = projectId ? getTasksForProject(projectId) : []

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

    if (isDemo) {
      const project = projects.find(p => p.id === projectId)
      const task = projectTasks.find(t => t.id === taskId)
      onDemoSave?.({
        id: `demo-${Date.now()}`,
        workspace_id: workspace.id,
        user_id: user.id,
        description: desc || '(sin descripción)',
        project_id: projectId || null,
        task_id: taskId || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration,
        projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
        tasks: task ? { name: task.name } : null,
      })
      toast.success('Entrada añadida')
      setSaving(false)
      onSave()
      return
    }

    const { error } = await supabase.from('time_entries').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      description: desc || '(sin descripción)',
      project_id: projectId || null,
      task_id: taskId || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Entrada añadida')
    onSave()
  }

  const inputStyle = {
    background: '#F7F8FA',
    border: '1px solid #E5E8EE',
    color: '#1C1C28',
    borderRadius: 10,
  }
  const focusStyle = { borderColor: '#7C4DFF', background: '#fff' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(13,13,30,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E8EE', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0F0F8' }}>
          <h2 className="font-bold text-base" style={{ color: '#1C1C28' }}>Añadir tiempo manual</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all"
            style={{ color: '#9095B0' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.color = '#3D4060' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9095B0' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Descripción</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="¿En qué trabajaste?"
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Proyecto</label>
            <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}>
              <option value="">Sin proyecto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {projectId && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Tarea</label>
              <select value={taskId} onChange={e => setTaskId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                style={inputStyle}>
                <option value="">Sin tarea</option>
                {projectTasks.map(t => <option key={t.id} value={t.id}>{t.name}{t.estimated_hours ? ` (${t.estimated_hours}h est.)` : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Inicio', startTime, setStartTime], ['Fin', endTime, setEndTime]].map(([label, val, setter]) => (
              <div key={label}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>{label}</label>
                <input type="time" value={val} onChange={e => setter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#F7F8FA', color: '#3D4060', border: '1px solid #E5E8EE' }}
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
