import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { User, HelpCircle, Play } from 'lucide-react'
import { useTour } from '../components/tour/AppTour'

/* ── Settings page ──────────────────────────────────────────── */
export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { onStartTour } = useOutletContext() || {}
  const { resetTour } = useTour()

  return (
    <div style={{ padding: '24px 28px', maxWidth: 640, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 6 }}>Mi cuenta</h1>
      <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 24 }}>Gestiona tu perfil, seguridad y preferencias</p>

      {/* Cuenta */}
      <div style={{ borderRadius: 14, padding: 20, marginBottom: 16, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <User size={15} style={{ color: '#7C4DFF' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>Información de cuenta</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--c-border-light)', marginBottom: 10 }}>
            <span style={{ color: 'var(--c-text-3)' }}>Email</span>
            <span style={{ fontWeight: 500 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--c-text-3)' }}>Workspace</span>
            <span style={{ fontWeight: 500 }}>{workspace?.name || 'XUL'}</span>
          </div>
        </div>
      </div>

      {/* Tutorial */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginTop: 4 }}>
        Ayuda
      </div>
      <div style={{
        borderRadius: 14, padding: 20,
        background: 'linear-gradient(135deg,rgba(124,77,255,0.06),rgba(224,64,251,0.04))',
        border: '1px solid rgba(124,77,255,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#7C4DFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={17} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 4px' }}>Tutorial interactivo</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Repasa todas las funcionalidades paso a paso. El tour se adapta a tu rol.
            </p>
            <button
              onClick={() => { resetTour(); onStartTour?.() }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#7C4DFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,77,255,0.3)' }}
            >
              <Play size={13} fill="white" />
              Iniciar tutorial
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
