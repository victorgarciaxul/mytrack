import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Timer, ArrowRight } from 'lucide-react'
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
    <div
      className="min-h-screen flex"
      style={{ background: '#0E0E1C' }}
    >
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12"
        style={{ background: 'linear-gradient(145deg, #191B23 0%, #1C1C28 60%, #1E1235 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg,#1C1C28,#191B23)', border: '1px solid #2A2D3A' }}
          >
            <Timer size={20} style={{ color: '#7C4DFF' }} />
          </div>
          <span className="text-white font-bold text-lg">MyTrack</span>
        </div>

        <div>
          <div className="space-y-6 mb-12">
            {[
              { emoji: '⚡', title: 'Timer en tiempo real', desc: 'Registra segundos con un solo clic' },
              { emoji: '📊', title: 'Reportes visuales', desc: 'Gráficas por proyecto, cliente y período' },
              { emoji: '👥', title: 'Trabajo en equipo', desc: 'Workspaces compartidos con tu equipo' },
            ].map(f => (
              <div key={f.title} className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: 'rgba(123,104,238,0.15)' }}
                >
                  {f.emoji}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{f.title}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#6B7090' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#3D4060' }}>
            © 2025 MyTrack. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo above form */}
          <div className="flex justify-center mb-8">
            <img src="/logo-xul.png" alt="XUL" style={{ height: 64, objectFit: 'contain' }} />
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">
            {isLogin ? 'Bienvenido de vuelta' : 'Crear cuenta'}
          </h1>
          <p className="text-sm mb-8" style={{ color: '#6B7090' }}>
            {isLogin ? 'Accede a tu workspace de MyTrack' : 'Empieza a registrar tu tiempo hoy'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8888A8' }}>
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full px-4 py-3 text-sm text-white placeholder-gray-600 rounded-xl outline-none transition-all"
                  style={{ background: '#1C1C28', border: '1px solid #2A2D3A' }}
                  onFocus={e => e.target.style.borderColor = '#7C4DFF'}
                  onBlur={e => e.target.style.borderColor = '#2A2D3A'}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8888A8' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 text-sm text-white placeholder-gray-600 rounded-xl outline-none transition-all"
                style={{ background: '#1C1C28', border: '1px solid #2A2D3A' }}
                onFocus={e => e.target.style.borderColor = '#7C4DFF'}
                onBlur={e => e.target.style.borderColor = '#2A2D3A'}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8888A8' }}>
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 text-sm text-white placeholder-gray-600 rounded-xl outline-none transition-all"
                style={{ background: '#1C1C28', border: '1px solid #2A2D3A' }}
                onFocus={e => e.target.style.borderColor = '#7C4DFF'}
                onBlur={e => e.target.style.borderColor = '#2A2D3A'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all mt-2"
              style={{ background: '#7C4DFF', boxShadow: '0 4px 20px rgba(107,78,255,0.4)' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading ? 'Cargando...' : (
                <>
                  {isLogin ? 'Entrar al workspace' : 'Crear cuenta'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: '#3D4060' }}>
            Acceso restringido · Solo usuarios autorizados
          </p>
        </div>
      </div>
    </div>
  )
}
