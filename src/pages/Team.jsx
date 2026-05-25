import { useState, useEffect } from 'react'
import { Users, Search, Mail, Shield, Crown, Bell, BellOff } from 'lucide-react'
import { initDB, dbGetAllMembers, dbGetGroups } from '../lib/db'

// ── helpers ────────────────────────────────────────────────────
const TABS = ['Miembros', 'Grupos', 'Recordatorios']

const ROLE_CONFIG = {
  admin:    { label: 'Administrador', color: '#7C4DFF', bg: '#7C4DFF18' },
  manager:  { label: 'Gerente',       color: '#F59E0B', bg: '#F59E0B18' },
  employee: { label: 'Miembro',       color: '#6366F1', bg: '#6366F118' },
  inactive: { label: 'Inactivo',      color: '#94A3B8', bg: '#94A3B818' },
}
const AVATAR_COLORS = ['#7C4DFF','#03A9F4','#10B981','#F59E0B','#EF4444','#E040FB','#6366F1','#FF6D00']

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function avatarColor(name) {
  let n = 0; for (const c of (name || '')) n += c.charCodeAt(0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
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

function MemberChip({ name }) {
  const color = avatarColor(name)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: color + '18', border: `1px solid ${color}30` }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color }}>{initials(name)}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-2)' }}>{name}</span>
    </div>
  )
}

// ── Miembros tab ───────────────────────────────────────────────
function MembersTab({ members }) {
  const [search, setSearch] = useState('')
  const filtered = members.filter(m =>
    (m.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.user_email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 240, marginBottom: 16 }}>
        <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro…"
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
      </div>

      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 130px 150px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
          {['Nombre', 'Correo electrónico', 'Grupo', 'Rol'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--c-text-3)', fontSize: 13, padding: '32px 0' }}>Sin resultados</p>
        ) : filtered.map(member => {
          const color = avatarColor(member.user_name)
          return (
            <div key={member.id}
              style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 130px 150px', padding: '12px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '20', border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{initials(member.user_name)}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {member.user_name || member.user_email}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <Mail size={12} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--c-text-3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {member.user_email}
                </span>
              </div>

              {member.group_name ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 'fit-content' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 100 }}>{member.group_name}</span>
                </div>
              ) : <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>—</span>}

              <RoleBadge role={member.role} />
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Grupos tab ─────────────────────────────────────────────────
function GroupsTab({ groups, members }) {
  const [search, setSearch] = useState('')

  // Enrich groups with member objects
  const enriched = groups.map(g => {
    let userIds = [], managerIds = []
    try { userIds    = JSON.parse(g.user_ids    || '[]') } catch {}
    try { managerIds = JSON.parse(g.manager_ids || '[]') } catch {}

    const groupMembers  = members.filter(m => userIds.includes(m.clockify_user_id))
    const groupManagers = members.filter(m => managerIds.includes(m.clockify_user_id))

    return { ...g, groupMembers, groupManagers }
  })

  const filtered = enriched.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', width: 240, marginBottom: 16 }}>
        <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo…"
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
          <Users size={36} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin grupos</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Nombre', 'Acceso (miembros)', 'Gerente de equipo asignado'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
            ))}
          </div>

          {filtered.map(group => (
            <div key={group.id}
              style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', padding: '14px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'start', gap: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Group name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7C4DFF18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={14} style={{ color: '#7C4DFF' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>{group.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>{group.groupMembers.length} miembro{group.groupMembers.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Member chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
                {group.groupMembers.length > 0 ? (
                  group.groupMembers.map(m => (
                    <MemberChip key={m.id} name={m.user_name || m.user_email} />
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Sin miembros importados</span>
                )}
              </div>

              {/* Manager */}
              <div style={{ paddingTop: 4 }}>
                {group.groupManagers.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {group.groupManagers.map(m => (
                      <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: '#F59E0B18', border: '1px solid #F59E0B30' }}>
                        <Crown size={11} style={{ color: '#F59E0B' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>{m.user_name || m.user_email}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Sin gerente asignado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Recordatorios tab ──────────────────────────────────────────
function RemindersTab({ members }) {
  // Static reminder types matching Clockify's reminder system
  const reminderTypes = [
    { id: 'daily_hours', label: 'Horas diarias mínimas', description: 'Avisa cuando un miembro no ha registrado las horas mínimas del día', icon: '⏱️', active: false },
    { id: 'weekly_hours', label: 'Horas semanales', description: 'Recordatorio de horas a completar antes del fin de semana', icon: '📅', active: false },
    { id: 'missing_entry', label: 'Entradas sin proyecto', description: 'Notifica entradas de tiempo sin proyecto asignado', icon: '📋', active: false },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 20 }}>
        Los recordatorios automáticos se envían a los miembros del equipo según las reglas configuradas en Clockify.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reminderTypes.map(r => (
          <div key={r.id}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {r.icon}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>{r.label}</p>
              <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: '3px 0 0' }}>{r.description}</p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: '#94A3B818' }}>
              <BellOff size={13} style={{ color: '#94A3B8' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>Inactivo</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Bell size={16} style={{ color: '#7C4DFF', flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: 0 }}>
          Para configurar recordatorios automáticos, accede directamente a <strong style={{ color: 'var(--c-text-2)' }}>Clockify → Equipo → Recordatorios</strong>.
          Los datos se sincronizan al hacer importación.
        </p>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Team() {
  const [tab, setTab]         = useState('Miembros')
  const [members, setMembers] = useState([])
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initDB()
      .then(() => Promise.all([dbGetAllMembers(), dbGetGroups()]))
      .then(([mems, grps]) => { setMembers(mems || []); setGroups(grps || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Equipo</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
          {loading ? 'Cargando…' : `${members.length} miembros · ${groups.length} grupos`}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--c-border-light)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 20px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
            color: tab === t ? '#7C4DFF' : 'var(--c-text-3)',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #7C4DFF' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <>
          {tab === 'Miembros'      && <MembersTab  members={members} />}
          {tab === 'Grupos'        && <GroupsTab   groups={groups} members={members} />}
          {tab === 'Recordatorios' && <RemindersTab members={members} />}
        </>
      )}
    </div>
  )
}
