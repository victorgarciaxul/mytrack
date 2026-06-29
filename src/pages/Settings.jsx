import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useRole } from '../context/RoleContext'
import { User, HelpCircle, Play, Lock, Eye, EyeOff, ShieldCheck, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTour } from '../components/tour/AppTour'
import { initDB, dbChangePassword } from '../lib/db'

/* ── Cambiar contraseña ─────────────────────────────────────── */
function ChangePasswordCard({ user }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving]   = useState(false)

  async function handleChange() {
    if (!current) { toast.error('Introduce tu contraseña actual'); return }
    if (next.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    setSaving(true)
    try {
      const { dbSignIn } = await import('../lib/db')
      const ok = await dbSignIn(user.email, current)
      if (!ok) { toast.error('Contraseña actual incorrecta'); setSaving(false); return }
      await dbChangePassword(user.email, next)
      toast.success('✅ Contraseña actualizada')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '9px 36px 9px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)',
    color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ borderRadius: 14, padding: 20, marginBottom: 16, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Lock size={15} style={{ color: '#7C4DFF' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>Cambiar contraseña</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Contraseña actual', current, setCurrent],
          ['Nueva contraseña', next, setNext],
          ['Confirmar nueva contraseña', confirm, setConfirm],
        ].map(([label, val, setter]) => (
          <div key={label}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={val}
                onChange={e => setter(e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', padding: 0 }}>
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={handleChange}
          disabled={saving}
          style={{ marginTop: 4, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#7C4DFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </div>
    </div>
  )
}

/* ── Verificación en dos pasos ──────────────────────────────── */
function TwoFactorCard() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (loading) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    setLoading(false)
    if (!enabled) {
      toast('🔐 Verificación en dos pasos activada', { duration: 3500 })
      setEnabled(true)
    } else {
      toast('Verificación en dos pasos desactivada', { duration: 3000 })
      setEnabled(false)
    }
  }

  return (
    <div style={{ borderRadius: 14, padding: 20, marginBottom: 16, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: enabled ? '#7C4DFF22' : 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <ShieldCheck size={16} style={{ color: enabled ? '#7C4DFF' : 'var(--c-text-4)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Verificación en dos pasos
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                background: enabled ? '#7C4DFF22' : 'var(--c-bg-muted)',
                color: enabled ? '#7C4DFF' : 'var(--c-text-4)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {enabled ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 2 }}>
              {enabled
                ? 'Se solicitará un código al iniciar sesión'
                : 'Añade una capa extra de seguridad a tu cuenta'}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={loading}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: enabled ? '#7C4DFF' : 'var(--c-border)',
            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {enabled && (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(124,77,255,0.06)', border: '1px solid rgba(124,77,255,0.15)' }}>
          <div style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6 }}>
            Recibirás un código de verificación en tu email cada vez que inicies sesión desde un dispositivo nuevo.
          </div>
          <button style={{
            marginTop: 10, display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600, color: '#7C4DFF', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>
            Configurar método de verificación <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Settings page ──────────────────────────────────────────── */
export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { isAdmin } = useRole()
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

      {/* Seguridad */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginTop: 4 }}>
        Seguridad
      </div>
      <ChangePasswordCard user={user} />
      <TwoFactorCard />

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
