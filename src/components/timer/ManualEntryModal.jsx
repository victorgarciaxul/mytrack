import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ManualEntryModal({ onClose, onSave, projects, workspace, user, isDemo, onDemoSave }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    if (end <= start) { toast.error('La hora de fin debe ser posterior'); return }
    const duration = Math.floor((end - start) / 1000)
    setSaving(true)

    if (isDemo) {
      const project = projects.find(p => p.id === projectId)
      onDemoSave?.({
        id: `demo-${Date.now()}`,
        workspace_id: workspace.id,
        user_id: user.id,
        description: desc || '(sin descripción)',
        project_id: projectId || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration,
        projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
      })
      toast.success('Entrada añadida')
      setSaving(false)
      onSave()
      return
    }

    const { error } = await supabase.from('time_entries').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      description: desc || '(sin descripción)',
      project_id: projectId || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Entrada añadida')
    onSave()
  }

  const inputStyle = {
    background: '#F4F4FA',
    border: '1.5px solid #E8E8F0',
    color: '#1A1A2E',
    borderRadius: 10,
  }
  const focusStyle = { borderColor: '#7B68EE', background: '#fff' }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(13,13,30,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #E8E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F0F0F8' }}>
          <h2 className="font-bold text-base" style={{ color: '#1A1A2E' }}>Añadir tiempo manual</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all"
            style={{ color: '#B0B0C8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F4F4FA'; e.currentTarget.style.color = '#4A4A6A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#B0B0C8' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>Descripción</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="¿En qué trabajaste?"
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: '#E8E8F0', background: '#F4F4FA' })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>Proyecto</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}>
              <option value="">Sin proyecto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, focusStyle)}
              onBlur={e => Object.assign(e.target.style, { borderColor: '#E8E8F0', background: '#F4F4FA' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Inicio', startTime, setStartTime], ['Fin', endTime, setEndTime]].map(([label, val, setter]) => (
              <div key={label}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9090B0' }}>{label}</label>
                <input type="time" value={val} onChange={e => setter(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => Object.assign(e.target.style, { borderColor: '#E8E8F0', background: '#F4F4FA' })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#F4F4FA', color: '#4A4A6A', border: '1.5px solid #E8E8F0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#EBEBF5'}
            onMouseLeave={e => e.currentTarget.style.background = '#F4F4FA'}
          >
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)', boxShadow: '0 4px 14px rgba(107,78,255,0.3)' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
