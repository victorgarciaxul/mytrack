import { useState, useEffect } from 'react'
import { Building2, Mail, Plus, X, Trash2, Search, Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { initDB, dbGetClients, dbGetProjects, dbCreateClient, dbDeleteClient, dbUpdateClient, dbArchiveClient } from '../lib/db'
import { useRole } from '../context/RoleContext'
import toast from 'react-hot-toast'

const inputStyle = { background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', width: '100%', boxSizing: 'border-box' }

// ── Edit client modal ──────────────────────────────────────────
function EditClientModal({ client, onSave, onClose }) {
  const [name, setName]   = useState(client.name)
  const [email, setEmail] = useState(client.email || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await dbUpdateClient({ id: client.id, name: name.trim(), email: email.trim() || null })
      onSave(updated)
      toast.success('Cliente actualizado')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--c-bg-surface)', borderRadius: 16, padding: '24px 28px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Editar cliente</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nombre *</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#03A9F4'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contacto@cliente.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#03A9F4'} onBlur={e => e.target.style.borderColor = 'var(--c-border-light)'} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()} style={{ padding: '8px 18px', borderRadius: 9, background: '#03A9F4', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Client card ────────────────────────────────────────────────
function ClientCard({ client, projects, canEdit, onEdit, onArchive, onDelete }) {
  const clientProjects = projects.filter(p => p.client_id === client.id)
  const isArch = !!client.archived

  return (
    <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, padding: '16px 18px', transition: 'box-shadow 0.15s', position: 'relative', opacity: isArch ? 0.65 : 1 }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Action buttons — top right */}
      {canEdit && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          ref={el => {
            if (el) {
              el.closest('[data-card]')
            }
          }}
        >
        </div>
      )}

      {/* Hover action buttons using CSS trick — render always, show on parent hover */}
      {canEdit && (
        <div className="card-actions" style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
          <button onClick={() => onEdit(client)} title="Editar"
            style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#03A9F415'; e.currentTarget.style.color = '#03A9F4' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
            <Pencil size={12} />
          </button>
          <button onClick={() => onArchive(client)} title={isArch ? 'Restaurar' : 'Archivar'}
            style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = isArch ? '#10B98115' : '#F59E0B15'; e.currentTarget.style.color = isArch ? '#10B981' : '#F59E0B' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
            {isArch ? <ArchiveRestore size={12} /> : <Archive size={12} />}
          </button>
          <button onClick={() => onDelete(client.id)} title="Eliminar"
            style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EF444418'; e.currentTarget.style.color = '#EF4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, paddingRight: canEdit ? 90 : 0 }}>
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
            {clientProjects.length > 4 && <span style={{ fontSize: 11, color: 'var(--c-text-3)', padding: '3px 6px' }}>+{clientProjects.length - 4} más</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function Clients() {
  const { isAdmin, isManager } = useRole()
  const canEdit = isAdmin || isManager

  const [clients, setClients]           = useState([])
  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [tab, setTab] = useState('active')

  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetAllClients(), dbGetProjects()]))
      .then(([c, p]) => { setClients(c || []); setProjects(p || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const q = search.toLowerCase()
  const activeClients   = clients.filter(c => !c.archived)
  const archivedClients = clients.filter(c => c.archived)
  const filtered         = activeClients.filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
  const filteredArchived = archivedClients.filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))

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
    try { await dbDeleteClient(id); setClients(prev => prev.filter(c => c.id !== id)); toast.success('Cliente eliminado') }
    catch { toast.error('Error al eliminar') }
  }

  async function handleArchive(client) {
    const next = !client.archived
    try {
      await dbArchiveClient(client.id, next)
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, archived: next } : c))
      toast.success(next ? 'Cliente archivado' : 'Cliente restaurado')
    } catch { toast.error('Error') }
  }

  function handleEditSaved(updated) {
    setClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
    setEditingClient(null)
  }

  return (
    <div className="page-container" style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${activeClients.length} activos · ${archivedClients.length} archivados`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 200 }}>
            <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: '#03A9F4', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', marginBottom: 20 }}>
        {[['active', 'Activos', activeClients.length], ['archived', 'Archivados', archivedClients.length]].map(([key, label, count]) => {
          const on = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 16px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#03A9F4' : 'var(--c-text-3)', borderBottom: `2px solid ${on ? '#03A9F4' : 'transparent'}`, marginBottom: -1, transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
              {label}
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: on ? '#03A9F418' : 'var(--c-bg-muted)', color: on ? '#03A9F4' : 'var(--c-text-4)', fontWeight: 600 }}>{count}</span>
            </button>
          )
        })}
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
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', color: 'var(--c-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={saving || !name.trim()} style={{ padding: '8px 18px', borderRadius: 9, background: '#03A9F4', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
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
      ) : (
        <>
          {tab === 'active' ? (
            filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
                <Building2 size={40} style={{ color: 'var(--c-text-4)' }} />
                <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>{search ? 'Sin resultados' : 'Sin clientes activos'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {filtered.map(client => (
                  <ClientCard key={client.id} client={client} projects={projects} canEdit={canEdit}
                    onEdit={setEditingClient} onArchive={handleArchive} onDelete={handleDelete} />
                ))}
              </div>
            )
          ) : (
            filteredArchived.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
                <Archive size={40} style={{ color: 'var(--c-text-4)' }} />
                <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>{search ? 'Sin resultados' : 'Sin clientes archivados'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {filteredArchived.map(client => (
                  <ClientCard key={client.id} client={client} projects={projects} canEdit={canEdit}
                    onEdit={setEditingClient} onArchive={handleArchive} onDelete={handleDelete} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {editingClient && (
        <EditClientModal client={editingClient} onSave={handleEditSaved} onClose={() => setEditingClient(null)} />
      )}
    </div>
  )
}

// Load all clients including archived
async function dbGetAllClients() {
  const { sql } = await import('../lib/db')
  const db = sql()
  return db`SELECT * FROM clients WHERE workspace_id = 'xul-ws-1' ORDER BY archived ASC, name ASC`
}
