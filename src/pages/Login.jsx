import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/tracker')
      } else {
        const { error } = await signUp(email, password, name)
        if (error) throw error
        toast.success('Cuenta creada. Revisa tu email.')
      }
    } catch (err) {
      toast.error(err.message || 'Error al autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url(/login-bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Soft overlay to ensure readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(220,140,120,0.08)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        pointerEvents: 'none',
      }} />

      {/* Glass card */}
      <div style={{
        width: 420,
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 24,
        padding: '44px 40px 36px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 24px 60px rgba(180,80,80,0.18), 0 2px 0 rgba(255,255,255,0.8) inset',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #7C4DFF, #E040FB)',
            marginBottom: 14,
            boxShadow: '0 8px 24px rgba(124,77,255,0.35)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0, letterSpacing: '-0.4px' }}>
            MyTrack
          </h1>
          <p style={{ fontSize: 13, color: '#7A7A9A', marginTop: 4 }}>
            {isLogin ? 'Bienvenido/a' : 'Crea tu cuenta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && (
            <Field label="Nombre completo">
              <LightInput type="text" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <LightInput type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </Field>
          <Field label="Contraseña">
            <LightInput type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </Field>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '12px 0',
              background: 'linear-gradient(135deg, #7C4DFF, #E040FB)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px rgba(124,77,255,0.35)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => e.currentTarget.style.opacity = loading ? '0.7' : '1'}
          >
            {loading ? 'Cargando...' : isLogin ? 'Entrar →' : 'Crear cuenta →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#8A8AAA' }}>
            {isLogin ? '¿Sin cuenta? ' : '¿Ya tienes una? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: '#7C4DFF', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </span>
        </div>

        {/* Demo shortcut */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#AAAACC', marginBottom: 8 }}>Acceso demo rápido</p>
          <button
            onClick={() => { setEmail('victorgarcia@xul.es'); setPassword('Xul2026') }}
            style={{
              padding: '7px 18px',
              fontSize: 12,
              fontWeight: 500,
              color: '#7C4DFF',
              background: 'rgba(124,77,255,0.08)',
              border: '1px solid rgba(124,77,255,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,77,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,77,255,0.08)'}
          >
            Usar credenciales demo
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8888AA', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function LightInput({ ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px',
        fontSize: 13,
        color: '#1A1A2E',
        background: 'rgba(255,255,255,0.6)',
        border: '1.5px solid rgba(200,190,230,0.5)',
        borderRadius: 10,
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(124,77,255,0.6)'; e.target.style.background = 'rgba(255,255,255,0.85)' }}
      onBlur={e => { e.target.style.borderColor = 'rgba(200,190,230,0.5)'; e.target.style.background = 'rgba(255,255,255,0.6)' }}
    />
  )
}
