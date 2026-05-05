import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, User, Bell, Building, HelpCircle, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTour } from '../components/tour/AppTour'

export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { onStartTour } = useOutletContext() || {}
  const { resetTour } = useTour()
  const [wsName, setWsName] = useState(workspace?.name || '')
  const [saving, setSaving] = useState(false)

  async function saveWorkspace(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('workspaces').update({ name: wsName }).eq('id', workspace.id)
    setSaving(false)
    if (error) toast.error('Error al guardar')
    else toast.success('Guardado')
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Ajustes</h1>

      {/* Workspace */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Building size={18} className="text-primary-600" />
          <h2 className="font-semibold text-slate-800">Workspace</h2>
        </div>
        <form onSubmit={saveWorkspace} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del workspace</label>
            <input
              type="text"
              value={wsName}
              onChange={e => setWsName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* Account */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-primary-600" />
          <h2 className="font-semibold text-slate-800">Cuenta</h2>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500">ID de usuario</span>
            <span className="font-numeric text-xs text-slate-400">{user?.id?.slice(0, 8)}...</span>
          </div>
        </div>
      </div>

      {/* Tutorial */}
      <div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg,rgba(123,104,238,0.08),rgba(255,107,202,0.06))', border: '1px solid rgba(123,104,238,0.2)' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#7C4DFF',  }}>
            <HelpCircle size={18} color="white" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-sm" style={{ color: 'var(--c-text-1)' }}>Tutorial interactivo</h2>
            <p className="text-xs mt-1 mb-3" style={{ color: 'var(--c-text-2)' }}>
              Repasa todas las funcionalidades de MyTrack paso a paso. El tour se adapta a tu rol mostrando sólo las secciones relevantes.
            </p>
            <button
              onClick={() => { resetTour(); onStartTour?.() }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#7C4DFF', boxShadow: '0 4px 12px rgba(107,78,255,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Play size={14} fill="white" />
              Iniciar tutorial
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
