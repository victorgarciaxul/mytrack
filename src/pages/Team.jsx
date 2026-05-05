import { Users, Mail, Crown, Shield, Copy } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Team() {
  const { members } = useWorkspace()
  const { user } = useAuth()

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/register`)
    toast.success('Enlace copiado')
  }

  return (
    <div>
      <div className="px-6 py-6">
        <h1 className="text-lg font-bold" style={{ color: 'var(--c-text-1)' }}>Equipo</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>{members.length} miembros en el workspace</p>
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Members */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--c-bg-surface)', border: '1px solid #E5E8EE' }}>
          <div className="px-5 py-3.5" style={{ background: 'var(--c-bg-muted)', borderBottom: '1px solid #F0F0F8' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-3)' }}>Miembros</p>
          </div>
          {members.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Users size={36} style={{ color: '#D0D0E8' }} className="mb-3" />
              <p className="text-sm" style={{ color: 'var(--c-text-3)' }}>Sin miembros</p>
            </div>
          ) : (
            <div>
              {members.map(member => {
                const profile = member.profiles
                const isOwner = member.role === 'owner'
                const isMe = member.user_id === user?.id
                const initials = profile?.full_name
                  ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                  : profile?.email?.[0]?.toUpperCase() || '?'

                return (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4 transition-colors"
                    style={{ borderBottom: '1px solid #F8F8FC' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                      style={{ background: isOwner ? 'linear-gradient(135deg,#FFB74D,#FF9800)' : 'linear-gradient(135deg,#7C4DFF,#6B3EED)' }}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--c-text-1)' }}>
                          {profile?.full_name || profile?.email || 'Usuario'}
                        </span>
                        {isMe && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(123,104,238,0.1)', color: '#7C4DFF' }}>
                            Tú
                          </span>
                        )}
                      </div>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--c-text-3)' }}>
                        <Mail size={10} />
                        {profile?.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: isOwner ? 'rgba(255,183,77,0.12)' : 'rgba(123,104,238,0.08)',
                        color: isOwner ? '#F59E0B' : '#7C4DFF',
                      }}>
                      {isOwner ? <Crown size={12} /> : <Shield size={12} />}
                      {isOwner ? 'Propietario' : member.role === 'admin' ? 'Admin' : 'Miembro'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Invite */}
        <div className="rounded-lg p-5" style={{ background: 'linear-gradient(135deg, #191B23, #1C1C28)', border: '1px solid #2A2D3A' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} style={{ color: '#7C4DFF' }} />
            <h3 className="font-bold text-sm text-white">Invitar al equipo</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--c-text-2)' }}>Comparte este enlace con tu equipo para que se unan al workspace</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 rounded-xl text-xs truncate" style={{ background: '#0E0E1C', border: '1px solid #2A2D3A', color: '#8888A8' }}>
              {window.location.origin}/register
            </div>
            <button onClick={copyInvite}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: '#7C4DFF',  }}>
              <Copy size={13} />
              Copiar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
