import { useState } from 'react'
import { Plus, Briefcase, Trash2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

const COLORS = ['#7B68EE','#6B4EFF','#FF6BCA','#FF4757','#FF7F50','#FFC107','#4CAF50','#26C6DA','#42A5F5','#26A69A']

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="px-6 py-6 flex items-start justify-between">
      <div>
        <h1 className="text-lg font-bold" style={{ color: '#1A1A2E' }}>{title}</h1>
        <p className="text-xs mt-0.5" style={{ color: '#9090B0' }}>{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

export default function Projects() {
  const { workspace, projects, clients, loadProjects } = useWorkspace()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('projects').insert({ workspace_id: workspace.id, name: name.trim(), client_id: clientId || null, color })
    setSaving(false)
    if (error) { toast.error('Error'); return }
    toast.success('Proyecto creado')
    setName(''); setClientId(''); setColor(COLORS[0]); setShowForm(false)
    loadProjects(workspace.id)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este proyecto?')) return
    await supabase.from('projects').delete().eq('id', id)
    toast.success('Eliminado')
    loadProjects(workspace.id)
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle={`${projects.length} proyectos activos`}
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)', boxShadow: '0 4px 14px rgba(107,78,255,0.3)' }}>
            <Plus size={15} />Nuevo proyecto
          </button>
        }
      />

      {showForm && (
        <div className="mx-6 mb-5 rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid #E8E8F0', boxShadow: '0 4px 20px rgba(107,78,255,0.08)' }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: '#1A1A2E' }}>Nuevo proyecto</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>Nombre *</label>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del proyecto"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all"
                  style={{ background: '#F4F4FA', border: '1.5px solid #E8E8F0', color: '#1A1A2E' }}
                  onFocus={e => Object.assign(e.target.style, { borderColor: '#7B68EE', background: '#fff' })}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E8E8F0', background: '#F4F4FA' })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>Cliente</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: '#F4F4FA', border: '1.5px solid #E8E8F0', color: '#1A1A2E' }}>
                  <option value="">Sin cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9090B0' }}>Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{ background: c, transform: color === c ? 'scale(1.3)' : 'scale(1)', outline: color === c ? `3px solid ${c}40` : 'none', outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: '#F4F4FA', color: '#4A4A6A', border: '1.5px solid #E8E8F0' }}>Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)' }}>
                {saving ? 'Guardando...' : 'Crear proyecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="px-6 pb-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Briefcase size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: '#4A4A6A' }}>Sin proyectos aún</p>
            <p className="text-sm mt-1" style={{ color: '#9090B0' }}>Crea tu primer proyecto para empezar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div key={project.id} className="group rounded-2xl p-5 transition-all"
                style={{ background: '#fff', border: '1.5px solid #E8E8F0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(107,78,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.04)'}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${project.color}18` }}>
                      <Briefcase size={18} style={{ color: project.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: '#1A1A2E' }}>{project.name}</h3>
                      {project.clients && <p className="text-xs mt-0.5" style={{ color: '#9090B0' }}>{project.clients.name}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(project.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: '#C0C0D8' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; e.currentTarget.style.color = '#FF4757' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C0C0D8' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: '#F0F0F8' }}>
                  <div className="h-1.5 rounded-full" style={{ width: '45%', background: project.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
