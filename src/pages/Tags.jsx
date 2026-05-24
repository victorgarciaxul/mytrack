import { useState, useEffect } from 'react'
import { Tag, Search } from 'lucide-react'
import { initDB, dbGetTags } from '../lib/db'

const COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#FF6D00','#00BCD4']

export default function Tags() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    initDB()
      .then(() => dbGetTags())
      .then(data => { setTags(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Etiquetas</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${tags.length} etiquetas importadas de Clockify`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 200 }}>
          <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar etiqueta…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : tags.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Tag size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin etiquetas</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>Nombre</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>Estado</span>
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
          ) : filtered.map((tag, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={tag.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 120px', padding: '12px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
