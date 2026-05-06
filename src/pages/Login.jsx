import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

/* ── Animated canvas background ───────────────────────────── */
function AnimatedBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 140 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      hue: [260, 280, 245, 295, 255][i],
      alpha: 0.05 + Math.random() * 0.07,
    }))

    const rings = Array.from({ length: 5 }, (_, i) => ({
      speed: 0.002 + i * 0.0008,
      offset: (Math.PI * 2 * i) / 5,
      radius: 90 + i * 58,
      arcLen: Math.PI * (0.3 + i * 0.12),
      color: `hsla(${260 + i * 12}, 75%, 68%, ${0.1 - i * 0.012})`,
      width: 1.4 - i * 0.18,
    }))

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.08 - Math.random() * 0.25,
      alpha: 0.08 + Math.random() * 0.25,
    }))

    let t = 0
    const draw = () => {
      const W = canvas.width, H = canvas.height
      t += 0.01

      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#06060F')
      bg.addColorStop(0.5, '#0C0920')
      bg.addColorStop(1, '#120828')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r) o.x = W + o.r
        if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r
        if (o.y > H + o.r) o.y = -o.r
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.hue}, 80%, 62%, ${o.alpha})`)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill()
      })

      const cx = W * 0.72, cy = H * 0.38
      rings.forEach(ring => {
        const angle = t * ring.speed * 60 + ring.offset
        ctx.beginPath()
        ctx.arc(cx, cy, ring.radius, angle, angle + ring.arcLen)
        ctx.strokeStyle = ring.color
        ctx.lineWidth = ring.width
        ctx.lineCap = 'round'
        ctx.stroke()
        const tx = cx + Math.cos(angle + ring.arcLen) * ring.radius
        const ty = cy + Math.sin(angle + ring.arcLen) * ring.radius
        ctx.beginPath(); ctx.arc(tx, ty, ring.width * 1.6, 0, Math.PI * 2)
        ctx.fillStyle = ring.color; ctx.fill()
      })

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(170,140,255,${p.alpha})`; ctx.fill()
      })

      ctx.strokeStyle = 'rgba(100,80,180,0.025)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}

/* ── Login page ────────────────────────────────────────────── */
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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      <AnimatedBackground />

      {/* Card */}
      <div style={{
        width: 420,
        background: '#131220',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '40px 36px 32px',
        position: 'relative', zIndex: 1,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
      }}>

        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
            boxShadow: '0 8px 28px rgba(124,77,255,0.45)',
            marginBottom: 16,
          }}>
            {/* Clock icon */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            MyTrack
          </h1>
          <p style={{
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 16px',
          }}>
            Gestión de tiempos · XUL
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
            Bienvenido/a. Introduce tus credenciales.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
          {!isLogin && (
            <Field label="Nombre">
              <WhiteInput type="text" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Usuario">
            <WhiteInput type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </Field>
          <Field label="Contraseña">
            <WhiteInput type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </Field>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '14px 0',
              background: '#7C3AED',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.01em',
              transition: 'background 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#6D28D9' }}
            onMouseLeave={e => e.currentTarget.style.background = '#7C3AED'}
          >
            {loading ? 'Cargando...' : isLogin ? 'Acceder al Panel' : 'Crear cuenta'}
          </button>
        </form>

        {/* Switch mode */}
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            {isLogin ? '¿Sin cuenta? ' : '¿Ya tienes una? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </span>
        </div>

        {/* Demo */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <button
            onClick={() => { setEmail('victorgarcia@xul.es'); setPassword('Xul2026') }}
            style={{
              padding: '7px 18px', fontSize: 12, fontWeight: 500,
              color: 'rgba(180,150,255,0.7)',
              background: 'rgba(124,77,255,0.08)',
              border: '1px solid rgba(124,77,255,0.18)',
              borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,77,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,77,255,0.08)'}
          >
            Usar credenciales demo
          </button>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.06em' }}>
          XUL · © 2026
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: 'rgba(255,255,255,0.35)', marginBottom: 7,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function WhiteInput({ ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '12px 16px', fontSize: 14,
        color: '#1A1A2E',
        background: '#F0EEFF',
        border: '2px solid transparent',
        borderRadius: 10, outline: 'none', boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => e.target.style.borderColor = '#7C3AED'}
      onBlur={e => e.target.style.borderColor = 'transparent'}
    />
  )
}
