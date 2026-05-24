import { useState, useEffect } from 'react'
import { Briefcase, Search, Globe, Lock, Plus, X, Check, Trash2, ChevronDown, ChevronRight, ListTodo, Circle, CheckCircle2 } from 'lucide-react'
import { initDB, dbGetProjectsWithHours, dbGetClients, dbGetTasksForProject,
         dbCreateProject, dbDeleteProject, dbCreateTask, dbDeleteTask, dbToggleTaskStatus } from '../lib/db'
import { useRole } from '../context/RoleContext'
import toast from 'react-hot-toast'

const COLORS = ['#7C4DFF','#6B3EED','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#FF6D00','#6366F1','#00BCD4']

function fmtHours(secs) {
  const s = Number(secs) || 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0 && m === 0) return '—'
  if (m === 0) return `${h}h`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// ── Task panel for one project ─────────────────────────────────
function TaskPanel({ project, canEdit }) {
  const [tasks, setTasks]       = useState(null)   // null = not loaded yet
  const [loading, setLoading]   = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newEstimate, setNewEstimate] = useState('')
  const [addingTask, setAddingTask]   = useState(false)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    setLoading(true)
    dbGetTasksForProject(project.id)
      .then(t => { setTasks(t || []); setLoading(false) })
      .catch(() => { setTasks([]); setLoading(false) })
  }, [project.id])

  async function handleAddTask(e) {
    e.preventDefault()
    if (!newTaskName.trim()) return
    setSaving(true)
    try {
      const t = await dbCreateTask({
        projectId: project.id,
        name: newTaskName.trim(),
        estimate: newEstimate ? parseInt(newEstimate) : null,
      })
      setTasks(prev => [...prev, t])
      setNewTaskName(''); setNewEstimate(''); setAddingTask(false)
      toast.success('Tarea creada')
    } catch { toast.error('Error al crear tarea') }
    setSaving(false)
  }

  async function handleDelete(taskId) {
    try {
      await dbDeleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success('Tarea eliminada')
    } catch { toast.error('Error') }
  }

  async function handleToggle(task) {
    const next = task.status === 'DONE' ? 'ACTIVE' : 'DONE'
    try {
      await dbToggleTaskStatus(task.id, next)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    } catch { toast.error('Error') }
  }

  if (loading) return (
    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${project.color || '#7C4DFF'}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const active = (tasks || []).filter(t => t.status !== 'DONE')
  const done   = (tasks || []).filter(t => t.status === 'DONE')

  return (
    <div style={{ padding: '12px 20px 16px', background: 'var(--c-bg-muted)', borderTop: '1px solid var(--c-border-light)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {(tasks || []).length} tarea{(tasks || []).length !== 1 ? 's' : ''} · {active.length} activa{active.length !== 1 ? 's' : ''}
        </span>
        {canEdit && (
          <button onClick={() => setAddingTask(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: (project.color || '#7C4DFF') + '18', color: project.color || '#7C4DFF', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <Plus size={12} /> Nueva tarea
          </button>
        )}
      </div>

      {/* Add form */}
      {addingTask && (
        <form onSubmit={handleAddTask}
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--c-bg-surface)', borderRadius: 9, border: `1px solid ${project.color || '#7C4DFF'}40` }}>
          <input autoFocus value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
            placeholder="Nombre de la tarea…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)' }} />
          <input type="number" min="1" value={newEstimate} onChange={e => setNewEstimate(e.target.value)}
            placeholder="h est."
            style={{ width: 64, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--c-text-2)', outline: 'none' }} />
          <button type="submit" disabled={saving || !newTaskName.trim()}
            style={{ padding: '4px 12px', borderRadius: 7, background: project.color || '#7C4DFF', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {saving ? '…' : 'Añadir'}
          </button>
          <button type="button" onClick={() => { setAddingTask(false); setNewTaskName(''); setNewEstimate('') }}
            style={{ padding: '4px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)' }}>
            <X size={14} />
          </button>
        </form>
      )}

      {/* Task list */}
      {(tasks || []).length === 0 && !addingTask ? (
        <p style={{ fontSize: 12, color: 'var(--c-text-4)', textAlign: 'center', padding: '8px 0' }}>Sin tareas — {canEdit ? 'añade la primera' : 'no hay tareas importadas'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[...active, ...done].map(task => (
            <div key={task.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'var(--c-bg-surface)', transition: 'all 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {/* Toggle */}
              <button onClick={() => handleToggle(task)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {task.status === 'DONE'
                  ? <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                  : <Circle size={16} style={{ color: 'var(--c-text-4)' }} />}
              </button>

              {/* Color dot */}
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: project.color || '#7C4DFF', flexShrink: 0 }} />

              {/* Name */}
              <span style={{ flex: 1, fontSize: 13, color: task.status === 'DONE' ? 'var(--c-text-4)' : 'var(--c-text-1)', textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}>
                {task.name}
              </span>

              {/* Estimate badge */}
              {task.estimate && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--c-bg-muted)', color: 'var(--c-text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {task.estimate}h est.
                </span>
              )}

              {/* Delete */}
              {canEdit && (
                <button onClick={() => handleDelete(task.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: 5, opacity: 0.4, flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#EF4444' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'inherit' }}>
                  <Trash2 size={12} style={{ color: 'inherit' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function Projects() {
  const { isAdmin, isManager } = useRole()
  const canEdit = isAdmin || isManager

  const [projects, setProjects] = useState([])
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)

  // create form
  const [name, setName]               = useState('')
  const [color, setColor]             = useState(COLORS[0])
  const [clientId, setClientId]       = useState('')
  const [budgetHours, setBudgetHours] = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetProjectsWithHours(), dbGetClients()]))
      .then(([p, c]) => { setProjects(p || []); setClients(c || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const client = clients.find(c => c.id === clientId)
      const newP = await dbCreateProject({
        name: name.trim(), color,
        clientId: clientId || null,
        clientName: client?.name || null,
        budgetHours: budgetHours ? parseInt(budgetHours) : null,
      })
      setProjects(prev => [...prev, { ...newP, total_seconds: 0, member_count: 0 }])
      toast.success('Proyecto creado')
      setName(''); setColor(COLORS[0]); setClientId(''); setBudgetHours(''); setShowForm(false)
    } catch { toast.error('Error al crear proyecto') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este proyecto y sus tareas?')) return
    try {
      await dbDeleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success('Proyecto eliminado')
    } catch { toast.error('Error al eliminar') }
  }

  const inputStyle = {
    background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', width: '100%',
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Proyectos</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${projects.length} proyectos`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 200 }}>
            <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: '#7C4DFF', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> Nuevo proyecto
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid #7C4DFF40', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 20px rgba(124,77,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Nuevo proyecto</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nombre *</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del proyecto" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C4DFF'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Cliente</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Sin cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Presupuesto (h)</label>
                <input type="number" min="0" value={budgetHours} onChange={e => setBudgetHours(e.target.value)} placeholder="120" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C4DFF'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? `3px solid ${c}` : '3px solid transparent', outline: color === c ? `2px solid ${c}60` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    {color === c && <Check size={12} color="white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving || !name.trim()}
                style={{ padding: '8px 18px', borderRadius: 9, background: '#7C4DFF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
                {saving ? 'Creando…' : 'Crear proyecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Briefcase size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin proyectos</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify o crea uno nuevo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(project => {
            const isExp = expanded === project.id
            return (
              <div key={project.id} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => { if (!isExp) e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 110px 90px 36px 36px', alignItems: 'center', padding: '13px 16px', gap: 12 }}>
                  {/* Expand toggle */}
                  <button onClick={() => setExpanded(isExp ? null : project.id)}
                    style={{ width: 26, height: 26, borderRadius: 7, background: isExp ? (project.color || '#7C4DFF') + '18' : 'var(--c-bg-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isExp
                      ? <ChevronDown size={14} style={{ color: project.color || '#7C4DFF' }} />
                      : <ChevronRight size={14} style={{ color: 'var(--c-text-4)' }} />}
                  </button>

                  {/* Name + color */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: (project.color || '#7C4DFF') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: project.color || '#7C4DFF' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{project.name}</p>
                      {project.member_count > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>{project.member_count} miembro{project.member_count !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>

                  {/* Client */}
                  <span style={{ fontSize: 13, color: project.client_name ? 'var(--c-text-2)' : 'var(--c-text-4)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {project.client_name || '—'}
                  </span>

                  {/* Hours */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: Number(project.total_seconds) > 0 ? 'var(--c-text-1)' : 'var(--c-text-4)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtHours(project.total_seconds)}
                  </span>

                  {/* Access */}
                  <div>
                    {(project.access || 'PRIVATE') === 'PUBLIC' ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: '#10B98118' }}>
                        <Globe size={11} style={{ color: '#10B981' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>Público</span>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'var(--c-bg-muted)' }}>
                        <Lock size={11} style={{ color: 'var(--c-text-4)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)' }}>Privado</span>
                      </div>
                    )}
                  </div>

                  {/* Tasks icon shortcut */}
                  <button onClick={() => setExpanded(isExp ? null : project.id)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
                    title="Ver tareas"
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = '#7C4DFF' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
                    <ListTodo size={14} />
                  </button>

                  {/* Delete */}
                  {canEdit ? (
                    <button onClick={() => handleDelete(project.id)}
                      style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EF444418'; e.currentTarget.style.color = '#EF4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
                      <Trash2 size={13} />
                    </button>
                  ) : <span />}
                </div>

                {/* Task panel */}
                {isExp && <TaskPanel project={project} canEdit={canEdit} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
