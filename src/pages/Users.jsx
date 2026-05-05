import { useState } from 'react'
import { UserCog, Edit2, Check, X } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const ROLE_CONFIG = {
  admin:    { label: 'Admin',    color: '#7C4DFF', bg: 'rgba(123,104,238,0.1)' },
  manager:  { label: 'Manager', color: '#4FC3F7', bg: 'rgba(79,195,247,0.1)'  },
  employee: { label: 'Empleado',color: '#81C784', bg: 'rgba(129,199,132,0.1)' },
}

export default function Users() {
  const { members, loadMembers, workspace } = useWorkspace()
  const { isDemo } = useAuth()
  const [editing, setEditing] = useState(null) // member id being edited
  const [form, setForm] = useState({})

  function startEdit(m) {
    setEditing(m.id)
    setForm({
      role: m.role,
      job_title: m.profiles?.job_title || '',
      hourly_rate: m.profiles?.hourly_rate || '',
    })
  }

  function cancelEdit() { setEditing(null); setForm({}) }

  async function saveEdit(m) {
    if (isDemo) {
      toast.success('Cambios guardados (demo)')
      setEditing(null)
      return
    }
    const { error: roleErr } = await supabase
      .from('workspace_members')
      .update({ role: form.role })
      .eq('id', m.id)
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ job_title: form.job_title, hourly_rate: parseFloat(form.hourly_rate) || null })
      .eq('id', m.user_id)
    if (roleErr || profErr) { toast.error('Error al guardar'); return }
    toast.success('Cambios guardados')
    setEditing(null)
    loadMembers(workspace.id)
  }

  const inputCls = 'px-2.5 py-1.5 text-sm rounded-lg outline-none transition-all'
  const inputStyle = { background: '#F7F8FA', border: '1.5px solid #E5E8EE', color: '#1C1C28' }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-lg font-bold" style={{ color: '#1C1C28' }}>Usuarios</h1>
        <p className="text-xs mt-0.5" style={{ color: '#7A7F9A' }}>Gestiona roles y perfiles de facturación</p>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E5E8EE', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ borderBottom: '1px solid #F0F0F8', color: '#7A7F9A' }}>
            <div className="col-span-4">Usuario</div>
            <div className="col-span-3">Perfil / Cargo</div>
            <div className="col-span-2 text-right">€/hora</div>
            <div className="col-span-2">Rol</div>
            <div className="col-span-1" />
          </div>

          {members.map((m, i) => {
            const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.employee
            const initials = (m.profiles?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const isEditingThis = editing === m.id

            return (
              <div key={m.id}
                className="grid grid-cols-12 gap-4 items-center px-4 py-3.5 transition-colors"
                style={{ borderBottom: i === members.length - 1 ? 'none' : '1px solid #F0F0F8' }}
                onMouseEnter={e => !isEditingThis && (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* User info */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7C4DFF,#EC4899)' }}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1C1C28' }}>{m.profiles?.full_name || 'Sin nombre'}</p>
                    <p className="text-xs truncate" style={{ color: '#7A7F9A' }}>{m.profiles?.email || ''}</p>
                  </div>
                </div>

                {/* Job title */}
                <div className="col-span-3">
                  {isEditingThis ? (
                    <input className={inputCls} style={inputStyle}
                      value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                      placeholder="Cargo"
                    />
                  ) : (
                    <p className="text-sm truncate" style={{ color: '#6B7090' }}>{m.profiles?.job_title || '—'}</p>
                  )}
                </div>

                {/* Hourly rate */}
                <div className="col-span-2 text-right">
                  {isEditingThis ? (
                    <input className={inputCls + ' w-24 text-right'} style={inputStyle} type="number" min="0"
                      value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                      placeholder="0"
                    />
                  ) : (
                    <span className="font-numeric text-sm font-semibold" style={{ color: m.profiles?.hourly_rate ? '#1C1C28' : '#A0A5C0' }}>
                      {m.profiles?.hourly_rate ? `€${m.profiles.hourly_rate}` : '—'}
                    </span>
                  )}
                </div>

                {/* Role */}
                <div className="col-span-2">
                  {isEditingThis ? (
                    <select className={inputCls} style={inputStyle}
                      value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="employee">Empleado</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: roleCfg.bg, color: roleCfg.color }}>
                      {roleCfg.label}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {isEditingThis ? (
                    <>
                      <button onClick={() => saveEdit(m)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#22c55e' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEdit}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#FF4757' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(m)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: '#9095B0' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,104,238,0.1)'; e.currentTarget.style.color = '#7C4DFF'; e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9095B0' }}
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
