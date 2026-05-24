import { useState, useEffect } from 'react'
import { Users, Search, Mail, Shield, Crown } from 'lucide-react'
import { initDB, dbGetAllMembers } from '../lib/db'

const ROLE_CONFIG = {
  admin:    { label: 'Administrador',    color: '#7C4DFF', bg: '#7C4DFF18' },
  employee: { label: 'Miembro',          color: '#6366F1', bg: '#6366F118' },
  manager:  { label: 'Gerente',          color: '#F59E0B', bg: '#F59E0B18' },
  inactive: { label: 'Inactivo',         color: '#94A3B8', bg: '#94A3B818' },
}

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.employee
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: cfg.bg }}>
      {role === 'admin' ? <Crown size={11} style={{ color: cfg.color }} /> : <Shield size={11} style={{ color: cfg.color }} />}
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
    </div>
  )
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#6366F1','#FF6D00']

export default function Team() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    initDB()
      .then(() => dbGetAllMembers())
      .then(data => { setMembers(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = members.filter(m =>
    (m.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.user_email || '').toLowerCase().includes(search.toLowerCase())
  )

  // Group by group_name for display
  const groups = [...new Set(members.map(m => m.group_name).filter(Boolean))].sort()

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Equipo</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
            {loading ? 'Cargando…' : `${members.length} miembros · ${groups.length} grupos`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 220 }}>
          <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar miembro…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : members.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: 12 }}>
          <Users size={40} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin miembros</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 120px 140px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Nombre', 'Correo electrónico', 'Grupo', 'Rol'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '24px 0' }}>Sin resultados</p>
          ) : filtered.map((member, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
            return (
              <div key={member.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 120px 140px', padding: '12px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Name + avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '20', border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{initials(member.user_name)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {member.user_name || member.user_email}
                  </span>
                </div>

                {/* Email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <Mail size={12} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--c-text-3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {member.user_email}
                  </span>
                </div>

                {/* Group */}
                {member.group_name ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 'fit-content' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 90 }}>{member.group_name}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>—</span>
                )}

                {/* Role */}
                <RoleBadge role={member.role} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
