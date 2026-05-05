import { useState } from 'react'
import { Plus, Trash2, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

export default function Clients() {
  const { workspace, clients, projects, loadClients } = useWorkspace()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clients').insert({ workspace_id: workspace.id, name: name.trim(), email: email || null })
    setSaving(false)
    if (error) { toast.error('Error'); return }
    toast.success('Cliente creado')
    setName(''); setEmail(''); setShowForm(false)
    loadClients(workspace.id)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clients').delete().eq('id', id)
    toast.success('Cliente eliminado')
    loadClients(workspace.id)
  }

  const inputStyle = { background: '#F7F8FA', border: '1px solid #E5E8EE', color: '#1C1C28', borderRadius: 10 }

  return (
    <div>
      <div className="px-6 py-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#1C1C28' }}>Clientes</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7A7F9A' }}>{clients.length} clientes</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7C4DFF',  }}>
          <Plus size={15} />Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="mx-6 mb-5 rounded-lg p-5" style={{ background: '#fff', border: '1px solid #E5E8EE', boxShadow: '0 4px 20px rgba(107,78,255,0.08)' }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: '#1C1C28' }}>Nuevo cliente</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Nombre *</label>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente"
                  className="w-full px-3.5 py-2.5 text-sm outline-none" style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, { borderColor: '#7C4DFF', background: '#fff' })}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7F9A' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@empresa.com"
                  className="w-full px-3.5 py-2.5 text-sm outline-none" style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, { borderColor: '#7C4DFF', background: '#fff' })}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E8EE', background: '#F7F8FA' })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#F7F8FA', color: '#3D4060', border: '1px solid #E5E8EE' }}>Cancelar</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#7C4DFF' }}>
                {saving ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="px-6 pb-6">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(123,104,238,0.08)' }}>
              <Building2 size={28} style={{ color: '#C0C0E0' }} />
            </div>
            <p className="font-semibold" style={{ color: '#3D4060' }}>Sin clientes aún</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E8EE' }}>
            <div className="grid text-xs font-bold uppercase tracking-wider px-5 py-3" style={{
              gridTemplateColumns: '1fr 1fr 1fr auto', background: '#FAFAFA', borderBottom: '1px solid #F0F0F8', color: '#7A7F9A',
            }}>
              <span>Cliente</span><span>Email</span><span>Proyectos</span><span />
            </div>
            {clients.map(client => {
              const cp = projects.filter(p => p.client_id === client.id)
              return (
                <div key={client.id} className="grid items-center px-5 py-4 group transition-colors" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', borderBottom: '1px solid #F8F8FC' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(123,104,238,0.1)' }}>
                      <Building2 size={15} style={{ color: '#7C4DFF' }} />
                    </div>
                    <span className="font-semibold text-sm" style={{ color: '#1C1C28' }}>{client.name}</span>
                  </div>
                  <span className="text-sm" style={{ color: '#7A7F9A' }}>{client.email || '—'}</span>
                  <div className="flex gap-1 flex-wrap">
                    {cp.slice(0,3).map(p => (
                      <span key={p.id} className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: p.color }}>{p.name}</span>
                    ))}
                    {cp.length > 3 && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#F0F0F8', color: '#7A7F9A' }}>+{cp.length-3}</span>}
                  </div>
                  <button onClick={() => handleDelete(client.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all" style={{ color: '#A0A5C0' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; e.currentTarget.style.color = '#FF4757' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A0A5C0' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
