import { useState, useEffect } from 'react'
import { Tag, Search, Plus, Trash2, X, Check } from 'lucide-react'
import { initDB, dbGetTags, dbCreateTag, dbDeleteTag } from '../lib/db'
import { useRole } from '../context/RoleContext'
import toast from 'react-hot-toast'

const COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#FF6D00','#00BCD4']

export default function Tags() {
  const { isAdmin, isManager } = useRole()
  const [tags, setTags]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)

  // form
  const [newName, setNewName] = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    initDB()
      .then(() => dbGetTags())
      .then(data => { setTags(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    if (tags.some(t => t.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error('Ya existe una etiqueta con ese nombre'); return
    }
    setSaving(true)
    try {
      const created = await dbCreateTag({ name: newName.trim() })
      setTags(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success('Etiqueta creada')
      setNewName(''); setShowForm(false)
    } catch { toast.error('Error al crear etiqueta') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta etiqueta?')) return
    try {
      await dbDeleteTag(id)
      setTags(prev => prev.filter(t => t.id !== id))
      toast.success('Etiqueta eliminada')
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Etiquetas</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${tags.length} etiquetas`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 190 }}>
            <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar etiqueta…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
          </div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowForm(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, background: '#E040FB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> Nueva etiqueta
            </button>
          )}
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid #E040FB40', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag size={16} style={{ color: '#E040FB', flexShrink: 0 }} />
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nombre de la etiqueta…"
              style={{ flex: 1, background: 'var(--c-bg-muted)', border: '1px solid #E040FB60', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--c-text-1)', outline: 'none' }} />
            <button type="submit" disabled={saving || !newName.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#E040FB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: !newName.trim() ? 0.5 : 1 }}>
              <Check size={14} /> {saving ? 'Creando…' : 'Crear'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setNewName('') }}
              style={{ padding: '8px', borderRadius: 8, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={14} style={{ color: 'var(--c-text-3)' }} />
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E040FB', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : tags.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Tag size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin etiquetas</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa desde Clockify o crea una nueva</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Nombre', 'Estado', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
          ) : filtered.map((tag, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={tag.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', padding: '12px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Tag size={13} style={{ color }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{tag.name}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 8, background: '#10B98118', width: 'fit-content' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>Activa</span>
                </div>
                {(isAdmin || isManager) ? (
                  <button onClick={() => handleDelete(tag.id)}
                    style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EF444418'; e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--c-text-4)' }}>
                    <Trash2 size={13} />
                  </button>
                ) : <span />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
