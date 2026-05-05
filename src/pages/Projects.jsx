import { useState } from 'react'
import { Plus, Briefcase, Trash2, ChevronDown, ChevronRight, Tag, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const COLORS = ['#7C4DFF','#6B3EED','#EC4899','#FF4757','#FF7F50','#FFC107','#4CAF50','#26C6DA','#42A5F5','#26A69A']

export default function Projects() {
  const { workspace, projects, clients, tasks, loadProjects, loadTasks } = useWorkspace()
  const { isDemo } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [budgetHours, setBudgetHours] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)
  const [expandedProject, setExpandedProject] = useState(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskHours, setNewTaskHours] = useState('')
  const [addingTaskFor, setAddingTaskFor] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    if (isDemo) {
      toast.success('Proyecto creado (demo)')
      setName(''); setClientId(''); setBudgetHours(''); setColor(COLORS[0]); setShowForm(false)
      setSaving(false)
      return
    }
    const { error } = await supabase.from('projects').insert({
      workspace_id: workspace.id,
      name: name.trim(),
      client_id: clientId || null,
      color,
      budget_hours: budgetHours ? parseFloat(budgetHours) : null,
    })
    setSaving(false)
    if (error) { toast.error('Error'); return }
    toast.success('Proyecto creado')
    setName(''); setClientId(''); setBudgetHours(''); setColor(COLORS[0]); setShowForm(false)
    loadProjects(workspace.id)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este proyecto?')) return
    if (isDemo) { toast.success('Eliminado (demo)'); return }
    await supabase.from('projects').delete().eq('id', id)
    toast.success('Eliminado')
    loadProjects(workspace.id)
  }

  async function handleAddTask(projectId) {
    if (!newTaskName.trim()) return
    if (isDemo) {
      toast.success('Tarea creada (demo)')
      setNewTaskName(''); setNewTaskHours(''); setAddingTaskFor(null)
      return
    }
    const { error } = await supabase.from('tasks').insert({
      project_id: projectId,
      name: newTaskName.trim(),
      estimated_hours: newTaskHours ? parseFloat(newTaskHours) : null,
    })
    if (error) { toast.error('Error al crear tarea'); return }
    toast.success('Tarea creada')
    setNewTaskName(''); setNewTaskHours(''); setAddingTaskFor(null)
    loadTasks(projects.map(p => p.id))
  }

  async function handleDeleteTask(taskId) {
    if (isDemo) { toast.success('Tarea eliminada (demo)'); return }
    await supabase.from('tasks').delete().eq('id', taskId)
    toast.success('Tarea eliminada')
    loadTasks(projects.map(p => p.id))
  }

  const inputStyle = { background: '#F7F8FA', border: '1.5px solid #E5E8EE', color: '#1C1C28', borderRadius: 10 }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1C1C28' }}>Proyectos</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7A7F9A' }}>{projects.length} proyectos activos</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#7C4DFF,#6B3EED)', boxShadow: '0 4px 14px rgba(107,78,255,0.3)' }}>
          <Plus size={15} />Nuevo proyecto
        </button>
      </div>

      {showForm && (
        <div className="mx-6 mb-5 rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #E5E8EE', boxShadow: '0 4px 20px rgba(107,78,255,0.08)' }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: '#1C1C28' }}>Nuevo proyecto</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Nombre *</label>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del proyecto"
                  className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, { borderColor: '#7C4DFF', background: '#fff' })}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Cliente</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm outline-none"
                  style={inputStyle}>
                  <option value="">Sin cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Presupuesto (h)</label>
                <input type="number" min="0" value={budgetHours} onChange={e => setBudgetHours(e.target.value)} placeholder="120"
                  className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, { borderColor: '#7C4DFF', background: '#fff' })}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7F9A' }}>Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
                    style={{ background: c, transform: color === c ? 'scale(1.25)' : 'scale(1)', outline: color === c ? `3px solid ${c}50` : 'none', outlineOffset: 2 }}>
                    {color === c && <Check size={12} color="white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#F7F8FA', color: '#3D4060', border: '1.5px solid #E5E8EE' }}>Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#7C4DFF,#6B3EED)' }}>
                {saving ? 'Guardando...' : 'Crear proyecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="px-6 pb-6 space-y-3">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Briefcase size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: '#3D4060' }}>Sin proyectos aún</p>
            <p className="text-sm mt-1" style={{ color: '#7A7F9A' }}>Crea tu primer proyecto para empezar</p>
          </div>
        ) : (
          projects.map(project => {
            const projectTasks = tasks.filter(t => t.project_id === project.id)
            const isExpanded = expandedProject === project.id
            const isAddingTask = addingTaskFor === project.id

            return (
              <div key={project.id} className="rounded-2xl overflow-hidden"
                style={{ background: '#fff', border: '1.5px solid #E5E8EE', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                {/* Project header */}
                <div className="flex items-center gap-4 px-5 py-4"
                  style={{ borderBottom: isExpanded ? '1px solid #F0F0F8' : 'none' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${project.color}18` }}>
                    <Briefcase size={16} style={{ color: project.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm" style={{ color: '#1C1C28' }}>{project.name}</h3>
                      {project.clients && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F7F8FA', color: '#7A7F9A' }}>{project.clients.name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: '#7A7F9A' }}>
                        <span className="font-semibold" style={{ color: '#6B7090' }}>{projectTasks.length}</span> tareas
                      </span>
                      {project.budget_hours && (
                        <span className="text-xs" style={{ color: '#7A7F9A' }}>
                          Presupuesto: <span className="font-numeric font-semibold" style={{ color: '#3D4060' }}>{project.budget_hours}h</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setAddingTaskFor(isAddingTask ? null : project.id); setExpandedProject(project.id); setNewTaskName(''); setNewTaskHours('') }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'rgba(123,104,238,0.08)', color: '#7C4DFF' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,104,238,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(123,104,238,0.08)'}
                    >
                      <Plus size={12} />Tarea
                    </button>
                    <button
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: '#7A7F9A' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <button onClick={() => handleDelete(project.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: '#A0A5C0' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; e.currentTarget.style.color = '#FF4757' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A0A5C0' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Tasks list */}
                {isExpanded && (
                  <div>
                    {projectTasks.length === 0 && !isAddingTask && (
                      <p className="px-5 py-4 text-sm text-center" style={{ color: '#A0A5C0' }}>Sin tareas — añade la primera</p>
                    )}
                    {projectTasks.map((t, i) => (
                      <div key={t.id} className="group flex items-center gap-3 px-5 py-3 transition-colors"
                        style={{ borderBottom: i < projectTasks.length - 1 || isAddingTask ? '1px solid #F8F8FC' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
                        <Tag size={12} style={{ color: '#9095B0', flexShrink: 0 }} />
                        <span className="flex-1 text-sm" style={{ color: '#3D4060' }}>{t.name}</span>
                        {t.estimated_hours && (
                          <span className="font-numeric text-xs px-2 py-0.5 rounded-full" style={{ background: '#F7F8FA', color: '#7A7F9A' }}>
                            {t.estimated_hours}h est.
                          </span>
                        )}
                        <button onClick={() => handleDeleteTask(t.id)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                          style={{ color: '#A0A5C0' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#FF4757'; e.currentTarget.style.background = 'rgba(255,71,87,0.08)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#A0A5C0'; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    {isAddingTask && (
                      <div className="flex items-center gap-3 px-5 py-3" style={{ background: 'rgba(123,104,238,0.03)' }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
                        <input
                          autoFocus
                          type="text"
                          value={newTaskName}
                          onChange={e => setNewTaskName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddTask(project.id); if (e.key === 'Escape') setAddingTaskFor(null) }}
                          placeholder="Nombre de la tarea"
                          className="flex-1 text-sm px-2.5 py-1.5 rounded-lg outline-none"
                          style={{ background: '#F7F8FA', border: '1.5px solid #7C4DFF', color: '#1C1C28' }}
                        />
                        <input
                          type="number"
                          min="0"
                          value={newTaskHours}
                          onChange={e => setNewTaskHours(e.target.value)}
                          placeholder="h est."
                          className="w-20 text-sm px-2.5 py-1.5 rounded-lg outline-none"
                          style={{ background: '#F7F8FA', border: '1.5px solid #E5E8EE', color: '#1C1C28' }}
                        />
                        <button onClick={() => handleAddTask(project.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                          style={{ background: 'linear-gradient(135deg,#7C4DFF,#6B3EED)' }}>
                          Añadir
                        </button>
                        <button onClick={() => setAddingTaskFor(null)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: '#7A7F9A' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={13} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
