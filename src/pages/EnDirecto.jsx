import { useState, useEffect, useRef } from 'react'
import { useRole } from '../context/RoleContext'
import { useNavigate } from 'react-router-dom'
import { supabaseClient as supabase } from '../lib/db'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Radio } from 'lucide-react'

// Format elapsed seconds as HH:MM:SS
function fmtElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function EnDirecto() {
  const { isAdmin, role } = useRole()
  const navigate = useNavigate()
  const [timers, setTimers] = useState([])
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const pollRef = useRef(null)

  // Redirect non-admins
  useEffect(() => {
    if (role !== null && !isAdmin) navigate('/tracker', { replace: true })
  }, [role, isAdmin])

  // Poll running_timers every 15s
  async function fetchTimers() {
    try {
      const { data } = await supabase
        .from('running_timers')
        .select('*')
        .order('started_at', { ascending: true })
      setTimers(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchTimers()
    pollRef.current = setInterval(fetchTimers, 15000)
    return () => clearInterval(pollRef.current)
  }, [isAdmin])

  // Tick every second to update elapsed time
  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (role === null || !isAdmin) return null

  const active = timers.filter(t => t.started_at)
  const inactive = [] // users without timer — could be extended later

  return (
    <div style={{ padding: '28px 24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg,#7C4DFF22,#E040FB22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Radio size={20} color="#7C4DFF" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>En directo</h1>
          <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: 0 }}>
            {active.length} persona{active.length !== 1 ? 's' : ''} trabajando ahora · se actualiza cada 15s
          </p>
        </div>
        {/* Live dot */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
            boxShadow: '0 0 0 3px #22c55e33',
            animation: 'pulse-live 2s infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>EN VIVO</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-live {
          0%, 100% { box-shadow: 0 0 0 3px #22c55e33; }
          50%       { box-shadow: 0 0 0 7px #22c55e11; }
        }
      `}</style>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--c-text-3)', fontSize: 14 }}>
          Cargando...
        </div>
      ) : active.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--c-bg-card)', borderRadius: 16,
          border: '1px solid var(--c-border-light)',
        }}>
          <Radio size={32} color="var(--c-text-4)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: 'var(--c-text-3)', margin: 0 }}>Nadie está trabajando ahora mismo</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(t => {
            const startedAt = t.started_at ? parseISO(t.started_at) : null
            const elapsedSecs = startedAt ? Math.floor((now - startedAt.getTime()) / 1000) : 0
            const color = t.project_color || '#7C4DFF'
            const initials = (t.user_email || '?').charAt(0).toUpperCase()

            return (
              <div key={t.user_email} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px',
                background: 'var(--c-bg-card)',
                border: '1px solid var(--c-border-light)',
                borderRadius: 14,
                transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,77,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#7C4DFF,#E040FB)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{initials}</span>
                </div>

                {/* Name + task */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {t.user_email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {t.project_name && (
                      <>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--c-text-3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {t.project_name}
                          {t.task_name && <span style={{ color: '#7C4DFF' }}> · {t.task_name}</span>}
                        </span>
                      </>
                    )}
                    {t.description && (
                      <span style={{ fontSize: 12, color: 'var(--c-text-4)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {t.project_name ? '— ' : ''}{t.description}
                      </span>
                    )}
                    {!t.project_name && !t.description && (
                      <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Sin tarea asignada</span>
                    )}
                  </div>
                </div>

                {/* Started ago */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 18, fontWeight: 700, color: '#7C4DFF',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
                  }}>
                    {fmtElapsed(elapsedSecs)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginTop: 2 }}>
                    desde {startedAt ? formatDistanceToNow(startedAt, { locale: es, addSuffix: false }) : '—'}
                  </div>
                </div>

                {/* Live indicator */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                  flexShrink: 0, boxShadow: '0 0 0 3px #22c55e33',
                }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
