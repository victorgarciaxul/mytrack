import { useState, useEffect } from 'react'
import { Building2, Mail, Plus, X, Trash2, Search } from 'lucide-react'
import { initDB, dbGetClients, dbGetProjects, dbCreateClient, dbDeleteClient } from '../lib/db'
import { useRole } from '../context/RoleContext'
import toast from 'react-hot-toast'

export default function Clients() {
  const { isAdmin, isManager } = useRole()
  const [clients, setClients]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)

  // form state
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetClients(), dbGetProjects()]))
      .then(([c, p]) => { setClients(c || []); setProjects(p || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function projectsForClient(clientId) {
    return projects.filter(p => p.client_id === clientId)
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const newC = await dbCreateClient({ name: name.trim(), email: email.trim() || null })
      setClients(prev => [...prev, newC].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Cliente creado')
      setName(''); setEmail(''); setShowForm(false)
    } catch { toast.error('Error al crear cliente') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await dbDeleteClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Cliente eliminado')
    } catch { toast.error('Error al eliminar') }
  }

  const inputStyle = { background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', width: '100%' }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${clients.length} clientes`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 200 }}>
            <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
          </div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: '#03A9F4', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid #03A9F440', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 20px rgba(3,169,244,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Nuevo cliente</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}><X size={16} /></button>
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nombre *</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#03A9F4'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contacto@cliente.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#03A9F4'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving || !name.trim()}
                style={{ padding: '8px 18px', borderRadius: 9, background: '#03A9F4', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
                {saving ? 'Creando…' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #03A9F4', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : clients.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Building2 size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin clientes</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa desde Clockify o crea uno nuevo</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(client => {
            const clientProjects = projectsForClient(client.id)
            return (
              <div key={client.id} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, padding: '16px 18px', transition: 'box-shadow 0.15s', position: 'relative' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Delete button */}
                {(isAdmin || isManager) && (
                  <button onClick={() => handleDelete(client.id)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EF444418'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.parentElement.querySelector('button').style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--c-text-4)'; e.currentTarget.style.opacity = '0' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                {/* Icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#03A9F418', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={18} style={{ color: '#03A9F4' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{client.name}</p>
                    {client.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Mail size={10} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{client.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Projects */}
                {clientProjects.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-border-light)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      {clientProjects.length} proyecto{clientProjects.length !== 1 ? 's' : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {clientProjects.slice(0, 4).map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: (p.color || '#7C4DFF') + '18' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color || '#7C4DFF', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--c-text-2)', fontWeight: 500 }}>{p.name}</span>
                        </div>
                      ))}
                      {clientProjects.length > 4 && (
                        <span style={{ fontSize: 11, color: 'var(--c-text-3)', padding: '3px 6px' }}>+{clientProjects.length - 4} más</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
