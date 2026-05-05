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

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Floating orbs
    const orbs = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 120 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      hue: [260, 280, 240, 300, 250, 270][i],
      alpha: 0.06 + Math.random() * 0.08,
    }))

    // ── Clock rings (decorative arcs sweeping)
    const rings = Array.from({ length: 5 }, (_, i) => ({
      x: window.innerWidth * 0.72,
      y: window.innerHeight * 0.42,
      radius: 90 + i * 60,
      speed: 0.002 + i * 0.0008,
      offset: (Math.PI * 2 * i) / 5,
      arcLen: Math.PI * (0.35 + i * 0.1),
      color: `hsla(${260 + i * 12}, 80%, 70%, ${0.12 - i * 0.015})`,
      width: 1.5 - i * 0.2,
    }))

    // ── Floating particles (tiny dots)
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.1 - Math.random() * 0.3,
      alpha: 0.1 + Math.random() * 0.3,
    }))

    // ── Progress bars (horizontal, floating)
    const bars = Array.from({ length: 8 }, (_, i) => ({
      x: -200,
      y: 80 + i * 100 + Math.random() * 40,
      w: 60 + Math.random() * 160,
      h: 2,
      speed: 0.15 + Math.random() * 0.25,
      alpha: 0.07 + Math.random() * 0.08,
      color: `hsl(${250 + Math.random() * 60}, 80%, 70%)`,
    }))

    let t = 0

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      t += 0.01

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#07071A')
      bg.addColorStop(0.45, '#0F0B28')
      bg.addColorStop(1, '#180A2E')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Orbs
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r) o.x = W + o.r
        if (o.x > W + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = H + o.r
        if (o.y > H + o.r) o.y = -o.r
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.hue}, 80%, 65%, ${o.alpha})`)
        g.addColorStop(1, `hsla(${o.hue}, 80%, 65%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill()
      })

      // Clock rings (sweeping arcs)
      rings.forEach(ring => {
        const cx = W * 0.72, cy = H * 0.42
        const angle = t * ring.speed * 60 + ring.offset
        ctx.beginPath()
        ctx.arc(cx, cy, ring.radius, angle, angle + ring.arcLen)
        ctx.strokeStyle = ring.color
        ctx.lineWidth = ring.width
        ctx.lineCap = 'round'
        ctx.stroke()
        // Dot at tip
        const tipX = cx + Math.cos(angle + ring.arcLen) * ring.radius
        const tipY = cy + Math.sin(angle + ring.arcLen) * ring.radius
        ctx.beginPath(); ctx.arc(tipX, tipY, ring.width * 1.5, 0, Math.PI * 2)
        ctx.fillStyle = ring.color.replace(/[\d.]+\)$/, '0.5)')
        ctx.fill()
      })

      // Center clock face hint
      const cx = W * 0.72, cy = H * 0.42
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(180,140,255,0.25)'
      ctx.fill()

      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180,150,255,${p.alpha})`
        ctx.fill()
      })

      // Floating progress bars
      bars.forEach(b => {
        b.x += b.speed
        if (b.x > W + 300) b.x = -b.w - 100
        ctx.fillStyle = b.color.replace('hsl', 'hsla').replace(')', `, ${b.alpha})`)
        ctx.beginPath()
        const bH = 3, bR = 2
        ctx.roundRect(b.x, b.y, b.w, bH, bR)
        ctx.fill()
        // Glowing head
        const gH = ctx.createRadialGradient(b.x + b.w, b.y + bH / 2, 0, b.x + b.w, b.y + bH / 2, 10)
        gH.addColorStop(0, b.color.replace('hsl', 'hsla').replace(')', ', 0.4)'))
        gH.addColorStop(1, 'transparent')
        ctx.fillStyle = gH
        ctx.beginPath(); ctx.arc(b.x + b.w, b.y + bH / 2, 10, 0, Math.PI * 2); ctx.fill()
      })

      // Subtle grid
      ctx.strokeStyle = 'rgba(120,100,200,0.03)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <AnimatedBackground />

      {/* Glass card */}
      <div style={{
        width: 420,
        background: 'rgba(18,12,40,0.72)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(160,130,255,0.15)',
        borderRadius: 24,
        padding: '44px 40px 36px',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #7C4DFF, #E040FB)',
            marginBottom: 14,
            boxShadow: '0 8px 28px rgba(124,77,255,0.45)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6"/>
              <path d="M12 7v5l3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.4px' }}>
            MyTrack
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(180,160,255,0.55)', marginTop: 4 }}>
            {isLogin ? 'Bienvenido/a de vuelta' : 'Crea tu cuenta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && (
            <Field label="Nombre completo">
              <DarkInput type="text" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <DarkInput type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </Field>
          <Field label="Contraseña">
            <DarkInput type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </Field>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, padding: '12px 0',
              background: 'linear-gradient(135deg, #7C4DFF, #E040FB)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px rgba(124,77,255,0.4)',
              transition: 'opacity 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,77,255,0.55)' } }}
            onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.7' : '1'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,77,255,0.4)' }}
          >
            {loading ? 'Cargando...' : isLogin ? 'Entrar →' : 'Crear cuenta →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            {isLogin ? '¿Sin cuenta? ' : '¿Ya tienes una? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'rgba(180,140,255,0.9)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </span>
        </div>

        {/* Demo shortcut */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', marginBottom: 8 }}>Acceso demo rápido</p>
          <button
            onClick={() => { setEmail('victorgarcia@xul.es'); setPassword('Xul2026') }}
            style={{
              padding: '7px 18px', fontSize: 12, fontWeight: 500,
              color: 'rgba(200,170,255,0.85)',
              background: 'rgba(124,77,255,0.1)',
              border: '1px solid rgba(124,77,255,0.22)',
              borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,77,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,77,255,0.1)'}
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
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'rgba(180,160,255,0.5)', marginBottom: 6,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function DarkInput({ ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '10px 14px', fontSize: 13,
        color: '#FFFFFF',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(160,130,255,0.15)',
        borderRadius: 10, outline: 'none', boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(124,77,255,0.65)'; e.target.style.background = 'rgba(255,255,255,0.09)' }}
      onBlur={e => { e.target.style.borderColor = 'rgba(160,130,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
    />
  )
}
