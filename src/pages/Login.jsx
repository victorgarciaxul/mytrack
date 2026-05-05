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

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #E0E0E0',
    borderRadius: 6,
    outline: 'none',
    color: '#1C1C28',
    background: '#fff',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 12, boxShadow: '0 4px 32px rgba(0,0,0,0.10)', padding: '40px 40px 32px', border: '1px solid #E8EAED' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#7B68EE,#5E4DC8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3" fill="white" />
                <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1C1C28', letterSpacing: '-0.3px' }}>MyTrack</span>
          </div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C28', marginBottom: 6, textAlign: 'center' }}>
          {isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
        </h1>
        <p style={{ fontSize: 13, color: '#7A7F9A', textAlign: 'center', marginBottom: 24 }}>
          {isLogin ? 'Accede a tu workspace' : 'Empieza a registrar tu tiempo'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#3D4060', marginBottom: 4 }}>Nombre completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7B68EE'}
                onBlur={e => e.target.style.borderColor = '#E0E0E0'}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#3D4060', marginBottom: 4 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#7B68EE'}
              onBlur={e => e.target.style.borderColor = '#E0E0E0'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#3D4060', marginBottom: 4 }}>Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#7B68EE'}
              onBlur={e => e.target.style.borderColor = '#E0E0E0'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '9px 0',
              background: '#7B68EE',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#6B5ADE' }}
            onMouseLeave={e => e.currentTarget.style.background = '#7B68EE'}
          >
            {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#7A7F9A' }}>
            {isLogin ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: '#7B68EE', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </span>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0F0F5', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#B0B5C8', marginBottom: 8 }}>Demo — acceso rápido</p>
          <button
            onClick={() => { setEmail('victorgarcia@xul.es'); setPassword('Xul2026') }}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 500,
              color: '#7B68EE',
              background: 'rgba(123,104,238,0.08)',
              border: '1px solid rgba(123,104,238,0.2)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,104,238,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(123,104,238,0.08)'}
          >
            Usar credenciales demo
          </button>
        </div>
      </div>
    </div>
  )
}
