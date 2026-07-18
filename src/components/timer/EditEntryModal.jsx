import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import SearchableDropdown from '../ui/SearchableDropdown'
import { useWorkspace } from '../../context/WorkspaceContext'
import { initDB, dbInsertEntry, dbGetTasksForProject } from '../../lib/db'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

/**
 * Modal for editing an existing time entry.
 * entry: { id, description, start_time, end_time, projects, tasks, project_id, task_id, ... }
 */
export default function EditEntryModal({ entry, onClose, onSaved, user }) {
  const { projects: wsProjects } = useWorkspace()

  // Merge workspace projects with the entry's own project (if it's a legacy Clockify
  // project not yet in Supabase — so the dropdown always shows the correct selection).
  const projects = (() => {
    if (!entry.project_id || !entry.projects?.name) return wsProjects
    const alreadyIn = wsProjects.some(p => p.id === entry.project_id)
    if (alreadyIn) return wsProjects
    return [
      { id: entry.project_id, name: entry.projects.name, color: entry.projects.color || '#7C4DFF', clients: entry.projects.clients || null },
      ...wsProjects,
    ]
  })()

  const toDate = v => { try { return format(parseISO(v), 'yyyy-MM-dd') } catch { return format(new Date(), 'yyyy-MM-dd') } }
  const toTime = v => { try { return format(parseISO(v), 'HH:mm') } catch { return '00:00' } }

  const [desc,      setDesc]      = useState(entry.description || '')
  const [date,      setDate]      = useState(toDate(entry.start_time))
  const [startTime, setStartTime] = useState(toTime(entry.start_time))
  const [endTime,   setEndTime]   = useState(toTime(entry.end_time))
  const [projectId, setProjectId] = useState(entry.project_id || '')
  const [taskId,    setTaskId]    = useState(entry.task_id    || '')
  const [saving,    setSaving]    = useState(false)
  const [projectTasks, setProjectTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  useEffect(() => {
    if (!projectId) { setProjectTasks([]); return }
    setLoadingTasks(true)
    // Tasks are read from Supabase (reliable for all users)
    dbGetTasksForProject(projectId)
      .then(supabaseTasks => setProjectTasks(supabaseTasks.map(t => ({ id: t.id, name: t.name }))))
      .catch(() => setProjectTasks([]))
      .finally(() => setLoadingTasks(false))
  }, [projectId])

  async function handleSave() {
    const start = new Date(`${date}T${startTime}`)
    const end   = new Date(`${date}T${endTime}`)
    if (end <= start) { toast.error('La hora de fin debe ser posterior al inicio'); return }
    if (!projectId) { toast.error('Selecciona un proyecto'); return }
    if (!taskId)    { toast.error('Selecciona una tarea');   return }
    const duration = Math.floor((end - start) / 1000)
    // Try to find project in workspace list; fall back to the original entry data
    const project  = projects.find(p => p.id === projectId) ||
                     (projectId === (entry.project_id || '') ? entry.projects : null)
    const task     = projectTasks.find(t => t.id === taskId) ||
                     (taskId === (entry.task_id || '') ? entry.tasks : null)

    setSaving(true)
    try {
      await initDB()
      const saved = await dbInsertEntry({
        id:           entry.id,
        userEmail:    user?.email,
        workspaceId:  user?.workspace_id || 'xul-ws-1',
        projectId:    projectId || null,
        projectName:  project?.name  || null,
        projectColor: project?.color || null,
        clientName:   project?.clients?.name || null,
        taskId:       taskId || null,
        taskName:     task?.name || null,
        description:  desc || '(sin descripción)',
        startTime:    start.toISOString(),
        endTime:      end.toISOString(),
        duration,
        billable:     entry.billable || false,
      })
      toast.success('Entrada actualizada')
      onSaved({
        id:          saved.id,
        description: saved.description,
        start_time:  saved.start_time,
        end_time:    saved.end_time,
        duration:    saved.duration,
        project_id:  projectId || null,
        task_id:     taskId    || null,
        projects:    project ? { name: project.name, color: project.color, clients: project.clients } : null,
        tasks:       task    ? { name: task.name }   : null,
      })
      onClose()
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--c-input-bg)', border: '1px solid var(--c-input-border)',
    color: 'var(--c-text-1)', borderRadius: 10,
  }
  const focusCss  = { borderColor: '#7C4DFF', background: 'var(--c-bg-surface)' }
  const blurCss   = { borderColor: 'var(--c-input-border)', background: 'var(--c-input-bg)' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(13,13,30,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{ width: '100%', maxWidth: 440, borderRadius: 14, overflow: 'hidden', background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--c-border-light)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>{entry.id ? 'Editar entrada' : 'Nueva entrada'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', borderRadius: 6, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Descripción */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>Descripción</label>
            <input
              type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="¿En qué trabajaste?" autoFocus
              style={{ ...inputStyle, width: '100%', padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => Object.assign(e.target.style, focusCss)}
              onBlur={e => Object.assign(e.target.style, blurCss)}
            />
          </div>

          {/* Proyecto */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>Proyecto</label>
            <SearchableDropdown
              value={projectId || null}
              onChange={opt => { setProjectId(opt?.value || ''); setTaskId('') }}
              options={projects.map(p => ({ value: p.id, label: p.name, color: p.color }))}
              placeholder="Sin proyecto"
              clearLabel="Sin proyecto"
            />
          </div>

          {/* Tarea */}
          {projectId && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>Tarea</label>
              <SearchableDropdown
                value={taskId || null}
                onChange={opt => setTaskId(opt?.value || '')}
                options={projectTasks.map(t => ({ value: t.id, label: t.name, color: '#7C4DFF' }))}
                placeholder={loadingTasks ? 'Cargando tareas…' : 'Sin tarea'}
                clearLabel="Sin tarea"
                disabled={loadingTasks}
              />
            </div>
          )}

          {/* Fecha */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>Fecha</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, width: '100%', padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => Object.assign(e.target.style, focusCss)}
              onBlur={e => Object.assign(e.target.style, blurCss)}
            />
          </div>

          {/* Inicio / Fin */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Inicio', startTime, setStartTime], ['Fin', endTime, setEndTime]].map(([label, val, setter]) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>{label}</label>
                <input
                  type="time" value={val} onChange={e => setter(e.target.value)}
                  style={{ ...inputStyle, width: '100%', padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => Object.assign(e.target.style, focusCss)}
                  onBlur={e => Object.assign(e.target.style, blurCss)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 20px', borderTop: '1px solid var(--c-border-light)' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--c-input-bg)', color: 'var(--c-text-2)', border: '1px solid var(--c-input-border)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: saving ? '#7C4DFF88' : '#7C4DFF', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
