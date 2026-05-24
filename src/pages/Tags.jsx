import { useState, useEffect } from 'react'
import { Tag, Hash } from 'lucide-react'
import { initDB, dbGetTags } from '../lib/db'

const COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#FF6D00','#00BCD4']

export default function Tags() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initDB()
      .then(() => dbGetTags())
      .then(data => { setTags(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Etiquetas</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
          {loading ? 'Cargando…' : `${tags.length} etiquetas importadas de Clockify`}
        </p>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {tags.map((tag, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={tag.id} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 20,
                background: color + '18', border: `1px solid ${color}40`,
              }}>
                <Hash size={12} style={{ color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{tag.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
