import { useState, useEffect } from 'react'
import { Briefcase, Search, Globe, Lock } from 'lucide-react'
import { initDB, dbGetProjectsWithHours } from '../lib/db'

function fmtHours(secs) {
  const s = Number(secs) || 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0 && m === 0) return '—'
  if (m === 0) return `${h}h`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    initDB()
      .then(() => dbGetProjectsWithHours())
      .then(data => { setProjects(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Proyectos</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${projects.length} proyectos importados de Clockify`}
          </p>
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 220 }}>
          <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proyecto…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : projects.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Briefcase size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin proyectos</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 110px 90px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Nombre', 'Cliente', 'Registrado', 'Acceso'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
          ) : filtered.map(project => (
            <div key={project.id}
              style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 110px 90px', padding: '13px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center', cursor: 'default' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Name + color dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: (project.color || '#7C4DFF') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

              {/* Access badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {(project.access || 'PRIVATE') === 'PUBLIC' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: '#10B98118' }}>
                    <Globe size={11} style={{ color: '#10B981' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>Público</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'var(--c-bg-muted)' }}>
                    <Lock size={11} style={{ color: 'var(--c-text-4)' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)' }}>Privado</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
