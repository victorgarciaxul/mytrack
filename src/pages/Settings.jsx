import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Settings as SettingsIcon, User, Bell, Building } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
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
      <div className="bg-white border border-slate-200 rounded-xl p-5">
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
    </div>
  )
}
