import { useState, useEffect } from 'react'
import { Users, Search, Mail, Shield, Crown, Bell, BellOff, Plus, X, ChevronDown, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import { initDB, dbGetAllMembers, dbGetGroups, dbUpsertMember, dbUpsertGroups, dbChangePassword } from '../lib/db'

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

function MemberChip({ name, onRemove }) {
  const color = avatarColor(name)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: color + '18', border: `1px solid ${color}30` }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color }}>{initials(name)}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-2)' }}>{name}</span>
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--c-text-4)', display: 'flex', alignItems: 'center' }}>
          <X size={10} />
        </button>
      )}
    </div>
  )
}

// ── Modal base ─────────────────────────────────────────────────
function Modal({ title, onClose, children, onSave, saving }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--c-bg-surface)', borderRadius: 16,
          border: '1px solid var(--c-border-light)',
          width: 480, maxWidth: '90vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--c-border-light)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--c-border-light)' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)',
            color: 'var(--c-text-1)', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: saving ? '#7C4DFF88' : '#7C4DFF', color: '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving ? (
              <>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                Guardando…
              </>
            ) : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)',
  fontSize: 13, color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box',
}

// ── New Member Modal ───────────────────────────────────────────
function NewMemberModal({ onClose, onSaved }) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [role, setRole]         = useState('employee')
  const [password, setPassword] = useState('Xul14$')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim()) return setError('El nombre es obligatorio')
    if (!email.trim() || !email.includes('@')) return setError('Introduce un email válido')
    setSaving(true)
    setError('')
    try {
      await initDB()
      await dbUpsertMember({ userEmail: email.toLowerCase().trim(), userName: name.trim(), role })
      // Update password if changed from default
      if (password && password !== 'Xul14$') {
        await dbChangePassword(email.toLowerCase().trim(), password)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError('Error al guardar: ' + (e.message || e))
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo miembro" onClose={onClose} onSave={handleSave} saving={saving}>
      <Field label="Nombre completo">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María López" style={inputStyle} autoFocus />
      </Field>
      <Field label="Correo electrónico">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@empresa.es" style={inputStyle} type="email" />
      </Field>
      <Field label="Rol">
        <div style={{ position: 'relative' }}>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}>
            <option value="employee">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)', pointerEvents: 'none' }} />
        </div>
      </Field>
      <Field label="Contraseña inicial">
        <input value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="Xul14$" />
        <p style={{ fontSize: 11, color: 'var(--c-text-4)', marginTop: 4 }}>El miembro podrá cambiarla desde Ajustes.</p>
      </Field>
      {error && <p style={{ fontSize: 12, color: '#EF4444', marginTop: -10 }}>{error}</p>}
    </Modal>
  )
}

// ── New Group Modal ────────────────────────────────────────────
function NewGroupModal({ members, onClose, onSaved }) {
  const [name, setName]               = useState('')
  const [selectedMembers, setSelMems] = useState([])   // array of user_email
  const [managerEmail, setManager]    = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [search, setSearch]           = useState('')

  const filtered = members.filter(m =>
    (m.user_name || m.user_email).toLowerCase().includes(search.toLowerCase()) &&
    !selectedMembers.includes(m.user_email)
  )

  function toggleMember(email) {
    setSelMems(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])
  }

  async function handleSave() {
    if (!name.trim()) return setError('El nombre del grupo es obligatorio')
    setSaving(true)
    setError('')
    try {
      await initDB()
      const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await dbUpsertGroups([{
        id,
        name: name.trim(),
        user_ids: JSON.stringify(selectedMembers),
        manager_ids: managerEmail ? JSON.stringify([managerEmail]) : '[]',
      }])
      onSaved()
      onClose()
    } catch (e) {
      setError('Error al guardar: ' + (e.message || e))
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo grupo" onClose={onClose} onSave={handleSave} saving={saving}>
      <Field label="Nombre del grupo">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Diseño, Desarrollo…" style={inputStyle} autoFocus />
      </Field>

      <Field label="Miembros">
        {/* Selected chips */}
        {selectedMembers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {selectedMembers.map(email => {
              const m = members.find(x => x.user_email === email)
              return (
                <MemberChip
                  key={email}
                  name={m?.user_name || email}
                  onRemove={() => toggleMember(email)}
                />
              )
            })}
          </div>
        )}

        {/* Search + dropdown */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-muted)' }}>
            <Search size={13} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar y añadir miembros…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }}
            />
          </div>
          {search && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
              borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
              {filtered.map(m => (
                <div
                  key={m.user_email}
                  onClick={() => { toggleMember(m.user_email); setSearch('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: avatarColor(m.user_name) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: avatarColor(m.user_name) }}>{initials(m.user_name)}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>{m.user_name || m.user_email}</p>
                    <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>{m.user_email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="Gerente del grupo (opcional)">
        <div style={{ position: 'relative' }}>
          <select
            value={managerEmail}
            onChange={e => setManager(e.target.value)}
            style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
          >
            <option value="">— Sin gerente —</option>
            {members.map(m => (
              <option key={m.user_email} value={m.user_email}>
                {m.user_name || m.user_email}
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)', pointerEvents: 'none' }} />
        </div>
      </Field>

      {error && <p style={{ fontSize: 12, color: '#EF4444', marginTop: -10 }}>{error}</p>}
    </Modal>
  )
}

// ── Miembros tab ───────────────────────────────────────────────
function MembersTab({ members, isAdmin, onNewMember }) {
  const [search, setSearch] = useState('')
  const filtered = members.filter(m =>
    (m.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.user_email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
        </div>
        {isAdmin && (
          <button
            onClick={onNewMember}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              borderRadius: 10, background: '#7C4DFF', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#6C3CE8'}
            onMouseLeave={e => e.currentTarget.style.background = '#7C4DFF'}
          >
            <Plus size={14} />
            Nuevo miembro
          </button>
        )}
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
function GroupsTab({ groups, members, isAdmin, onNewGroup }) {
  const [search, setSearch] = useState('')

  // Enrich groups with member objects — match by email OR clockify_user_id
  const enriched = groups.map(g => {
    let userIds = [], managerIds = []
    try { userIds    = JSON.parse(g.user_ids    || '[]') } catch {}
    try { managerIds = JSON.parse(g.manager_ids || '[]') } catch {}

    const matchMember  = (m) => userIds.includes(m.clockify_user_id)    || userIds.includes(m.user_email)
    const matchManager = (m) => managerIds.includes(m.clockify_user_id) || managerIds.includes(m.user_email)

    const groupMembers  = members.filter(matchMember)
    const groupManagers = members.filter(matchManager)

    return { ...g, groupMembers, groupManagers }
  })

  const filtered = enriched.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border-light)', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--c-text-1)', width: '100%' }} />
        </div>
        {isAdmin && (
          <button
            onClick={onNewGroup}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              borderRadius: 10, background: '#7C4DFF', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#6C3CE8'}
            onMouseLeave={e => e.currentTarget.style.background = '#7C4DFF'}
          >
            <Plus size={14} />
            Nuevo grupo
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
          <Users size={36} style={{ color: 'var(--c-text-4)' }} />
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0 }}>Sin grupos</p>
          {isAdmin
            ? <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Crea uno con el botón «Nuevo grupo»</p>
            : <p style={{ fontSize: 12, color: 'var(--c-text-4)', margin: 0 }}>Importa datos desde Clockify en Ajustes</p>
          }
        </div>
      ) : (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', padding: '10px 20px', background: 'var(--c-bg-muted)', borderBottom: '1px solid var(--c-border-light)' }}>
            {['Nombre', 'Miembros', 'Gerente de equipo'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-4)' }}>{h}</span>
            ))}
          </div>

          {filtered.map(group => (
            <div key={group.id}
              style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', padding: '14px 20px', borderBottom: '1px solid var(--c-border-light)', alignItems: 'start', gap: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7C4DFF18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={14} style={{ color: '#7C4DFF' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>{group.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: 0 }}>{group.groupMembers.length} miembro{group.groupMembers.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
                {group.groupMembers.length > 0 ? (
                  group.groupMembers.map(m => (
                    <MemberChip key={m.id} name={m.user_name || m.user_email} />
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Sin miembros</span>
                )}
              </div>

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
                  <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Sin gerente</span>
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
function RemindersTab() {
  const reminderTypes = [
    { id: 'daily_hours',  label: 'Horas diarias mínimas',  description: 'Avisa cuando un miembro no ha registrado las horas mínimas del día', icon: '⏱️' },
    { id: 'weekly_hours', label: 'Horas semanales',         description: 'Recordatorio de horas a completar antes del fin de semana', icon: '📅' },
    { id: 'missing_entry',label: 'Entradas sin proyecto',   description: 'Notifica entradas de tiempo sin proyecto asignado', icon: '📋' },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 20 }}>
        Los recordatorios automáticos se envían a los miembros del equipo según las reglas configuradas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reminderTypes.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
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
          Para configurar recordatorios automáticos, accede a <strong style={{ color: 'var(--c-text-2)' }}>Clockify → Equipo → Recordatorios</strong>.
        </p>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Team() {
  const { isAdmin } = useRole()
  const [tab, setTab]               = useState('Miembros')
  const [members, setMembers]       = useState([])
  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showNewMember, setNewMem]  = useState(false)
  const [showNewGroup, setNewGrp]   = useState(false)

  function reload() {
    return Promise.all([dbGetAllMembers(), dbGetGroups()])
      .then(([mems, grps]) => { setMembers(mems || []); setGroups(grps || []) })
  }

  useEffect(() => {
    initDB()
      .then(reload)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100 }}>
      {/* Modals */}
      {showNewMember && (
        <NewMemberModal
          onClose={() => setNewMem(false)}
          onSaved={() => { setLoading(true); reload().finally(() => setLoading(false)) }}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          members={members}
          onClose={() => setNewGrp(false)}
          onSaved={() => { setLoading(true); reload().finally(() => setLoading(false)) }}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Equipo</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 4 }}>
          {loading ? 'Cargando…' : `${members.length} miembro${members.length !== 1 ? 's' : ''} · ${groups.length} grupo${groups.length !== 1 ? 's' : ''}`}
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
          {tab === 'Miembros'      && <MembersTab  members={members} isAdmin={isAdmin} onNewMember={() => setNewMem(true)} />}
          {tab === 'Grupos'        && <GroupsTab   groups={groups} members={members} isAdmin={isAdmin} onNewGroup={() => setNewGrp(true)} />}
          {tab === 'Recordatorios' && <RemindersTab />}
        </>
      )}
    </div>
  )
}
