import { useState, useEffect } from 'react'
import { Building2, Mail, Briefcase } from 'lucide-react'
import { initDB, dbGetClients, dbGetProjects } from '../lib/db'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetClients(), dbGetProjects()]))
      .then(([c, p]) => { setClients(c || []); setProjects(p || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function projectsForClient(clientId) {
    return projects.filter(p => p.client_id === clientId)
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Clientes</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
          {loading ? 'Cargando…' : `${clients.length} clientes importados de Clockify`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : clients.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Building2 size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin clientes</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {clients.map(client => {
            const clientProjects = projectsForClient(client.id)
            return (
              <div key={client.id} style={{
                background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
                borderRadius: 14, padding: '16px 18px',
                transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
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
