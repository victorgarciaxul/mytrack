import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useRole } from '../context/RoleContext'
import { User, HelpCircle, Play, Download, CheckCircle, RefreshCw, Trash2, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTour } from '../components/tour/AppTour'
import { importFromClockify, loadClockifyCache, clearClockifyCache, clockifyGetTags, clockifyGetTimeOffPolicies, clockifyGetTimeOffRequests, clockifyGetAllTasks } from '../lib/clockify'
import { initDB, dbUpsertEntries, dbUpsertMember, dbUpsertProjects, dbUpsertClients, dbChangePassword, dbUpsertTags, dbUpsertTimeOffPolicies, dbUpsertTimeOffRequests, dbUpsertTasks, dbUpsertGroups } from '../lib/db'

function ClockifyImportCard({ onImported }) {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const cache = loadClockifyCache()

  async function handleImport() {
    setLoading(true)
    setProgress(0)
    try {
      // 1. Import from Clockify API — incremental if we have a previous import.
      // Always go back to start of yesterday at minimum so entries logged before
      // the last sync (same day) are never missed.
      let since = null
      if (cache?.importedAt) {
        const startOfYesterday = new Date()
        startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        startOfYesterday.setHours(0, 0, 0, 0)
        const lastImport = new Date(cache.importedAt)
        since = (lastImport < startOfYesterday ? lastImport : startOfYesterday).toISOString()
      }
      const result = await importFromClockify((msg, pct) => {
        setStatus(msg)
        setProgress(pct)
      }, since)

      // 2. Save projects & clients to Neon — both workspaces share the same Clockify projects
      await initDB()
      setStatus('Guardando proyectos y clientes…')
      setProgress(88)
      if (result.projects?.length) {
        await dbUpsertProjects(result.projects)                        // xul-ws-1
        await dbUpsertProjects(result.projects, 'fundacion-ws-1')     // fundacion-ws-1
      }
      if (result.clients?.length) {
        await dbUpsertClients(result.clients)                          // xul-ws-1
        await dbUpsertClients(result.clients, 'fundacion-ws-1')       // fundacion-ws-1
      }

      // 3. Save all users + groups to Neon
      // dbUpsertMember routes each member to their workspace automatically (by email domain)
      setStatus('Registrando usuarios en MyTrack…')
      setProgress(90)
      for (const member of result.members || []) {
        await dbUpsertMember({
          userEmail: member.profiles?.email || '',
          userName: member.profiles?.full_name || member.profiles?.email || '',
          role: member.role || 'employee',
          clockifyUserId: member.user_id || member.id,
          groupName: member.group_name || null,
        })
      }
      if (result.groups?.length) {
        setStatus('Guardando grupos…')
        setProgress(91)
        await dbUpsertGroups(result.groups) // XUL workspace only
      }

      // 4. Save entries — dbUpsertEntries routes each entry to the correct workspace by email
      if (result.allEntriesForNeon?.length) {
        setStatus(`Guardando ${result.allEntriesForNeon.length} entradas nuevas…`)
        setProgress(92)
        await dbUpsertEntries(result.allEntriesForNeon, (done, total) => {
          setStatus(`Guardando en BD… ${done}/${total}`)
          setProgress(92 + Math.round((done / total) * 7))
        })
      }

      // 5. Tags — both workspaces
      setStatus('Importando etiquetas…')
      setProgress(97)
      const tags = await clockifyGetTags()
      if (tags.length) {
        await dbUpsertTags(tags)                      // xul-ws-1
        await dbUpsertTags(tags, 'fundacion-ws-1')   // fundacion-ws-1
      }

      // 6. Time off
      setStatus('Importando bajas y vacaciones…')
      setProgress(97)
      const rawUsers = result.members?.map(m => ({ id: m.user_id || m.id, email: m.profiles?.email || '', name: m.profiles?.full_name || '' })) || []
      const [policies, requests] = await Promise.all([
        clockifyGetTimeOffPolicies(),
        clockifyGetTimeOffRequests(rawUsers),
      ])
      if (policies.length) {
        await dbUpsertTimeOffPolicies(policies)                    // xul-ws-1
        await dbUpsertTimeOffPolicies(policies, 'fundacion-ws-1') // fundacion-ws-1
      }
      if (requests.length) await dbUpsertTimeOffRequests(requests) // routed by user email inside

      // 7. Tasks (all projects) — both workspaces
      setStatus('Importando tareas de proyectos…')
      setProgress(99)
      const tasks = await clockifyGetAllTasks(result.projects || [])
      if (tasks.length) {
        await dbUpsertTasks(tasks)                      // xul-ws-1
        await dbUpsertTasks(tasks, 'fundacion-ws-1')   // fundacion-ws-1
      }

      if (result.isIncremental) {
        toast.success(`✅ ${result.newCount} entradas · ${tags.length} etiquetas · ${tasks.length} tareas`)
      } else {
        toast.success(`✅ ${result.members?.length} usuarios · ${result.projects?.length} proyectos · ${tasks.length} tareas · ${result.allEntriesForNeon?.length} entradas`)
      }
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      console.error('Import error:', err)
      toast.error('Error al importar: ' + err.message)
      setLoading(false)
    }
  }

  function handleClear() {
    clearClockifyCache()
    toast.success('Caché eliminada — recarga la página')
    onImported?.()
  }

  return (
    <div style={{
      borderRadius: 14, padding: 20, marginBottom: 16,
      background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#03A9F4,#0288D1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Download size={16} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Importar desde Clockify</p>
          <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>Workspace XUL · API conectada</p>
        </div>
        {cache && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle size={14} style={{ color: '#10B981' }} />
            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>Importado</span>
          </div>
        )}
      </div>

      {cache && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14,
        }}>
          {[
            { label: 'Proyectos', value: cache.projects?.length || 0, color: '#7C4DFF' },
            { label: 'Clientes', value: cache.clients?.length || 0, color: '#10B981' },
            { label: 'Entradas', value: cache.entries?.length || 0, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--c-bg-muted)', borderRadius: 10, padding: '10px 14px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: 0 }}>{s.value.toLocaleString()}</p>
              <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>{status}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#7C4DFF' }}>{progress}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--c-bg-muted)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg,#7C4DFF,#03A9F4)',
              width: `${progress}%`, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {cache && (
        <p style={{ fontSize: 11, color: 'var(--c-text-4)', marginBottom: 12 }}>
          Última importación: {new Date(cache.importedAt).toLocaleString('es-ES')}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleImport}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 9, border: 'none',
            background: loading ? 'var(--c-bg-muted)' : 'linear-gradient(135deg,#03A9F4,#0288D1)',
            color: loading ? 'var(--c-text-3)' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {cache ? 'Actualizar datos' : 'Importar ahora'}
        </button>
        {cache && (
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 9,
              background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
              fontSize: 13, color: 'var(--c-text-3)', cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            Limpiar caché
          </button>
        )}
      </div>
    </div>
  )
}

function ChangePasswordCard({ user }) {
  const [current, setCurrent]     = useState('')
  const [next, setNext]           = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [saving, setSaving]       = useState(false)

  async function handleChange() {
    if (!current) { toast.error('Introduce tu contraseña actual'); return }
    if (next.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { toast.error('Las contraseñas no coinciden'); return }
    setSaving(true)
    try {
      // Verify current password
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

function AutoSyncCard() {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  async function triggerSync() {
    setRunning(true)
    try {
      const res = await fetch('/api/sync-clockify', { method: 'GET' })
      const data = await res.json()
      if (data.ok) {
        toast.success(`✅ Sync completada · ${data.upserted} entradas actualizadas`)
        setLastResult(data)
      } else {
        toast.error('Error en sync: ' + (data.error || 'desconocido'))
      }
    } catch (err) {
      toast.error('Error al llamar al servidor: ' + err.message)
    }
    setRunning(false)
  }

  return (
    <div style={{
      borderRadius: 14, padding: 20, marginBottom: 16,
      background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#10B981,#059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={16} color="white" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Sincronización automática</p>
          <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>
            Se ejecuta cada día a las 03:00h UTC · Últimos 7 días de todos los usuarios
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: '#10B98118' }}>
          <CheckCircle size={12} style={{ color: '#10B981' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981' }}>Activa</span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Clockify → MyTrack se sincroniza automáticamente cada noche. También puedes ejecutarla ahora manualmente si acabas de registrar tiempo en Clockify.
      </p>

      {lastResult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Entradas',  value: lastResult.upserted, color: '#10B981' },
            { label: 'Usuarios',  value: lastResult.users,    color: '#7C4DFF' },
            { label: 'Tiempo',    value: `${(lastResult.durationMs / 1000).toFixed(1)}s`, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--c-bg-muted)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={triggerSync}
        disabled={running}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 9, border: 'none',
          background: running ? 'var(--c-bg-muted)' : 'linear-gradient(135deg,#10B981,#059669)',
          color: running ? 'var(--c-text-3)' : '#fff',
          fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
        }}
      >
        <RefreshCw size={13} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
        {running ? 'Sincronizando…' : 'Ejecutar sync ahora'}
      </button>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { isAdmin } = useRole()
  const { onStartTour } = useOutletContext() || {}
  const { resetTour } = useTour()
  const [, forceUpdate] = useState(0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 640, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 20 }}>Ajustes</h1>

      {/* Clockify import + auto-sync — admin only */}
      {isAdmin && (
        <>
          <ClockifyImportCard onImported={() => forceUpdate(n => n + 1)} />
          <AutoSyncCard />
        </>
      )}

      {/* Cambiar contraseña */}
      <ChangePasswordCard user={user} />

      {/* Cuenta */}
      <div style={{
        borderRadius: 14, padding: 20, marginBottom: 16,
        background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <User size={15} style={{ color: '#7C4DFF' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>Cuenta</span>
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
      <div style={{
        borderRadius: 14, padding: 20,
        background: 'linear-gradient(135deg,rgba(124,77,255,0.06),rgba(224,64,251,0.04))',
        border: '1px solid rgba(124,77,255,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: '#7C4DFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HelpCircle size={17} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 4px' }}>Tutorial interactivo</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Repasa todas las funcionalidades paso a paso. El tour se adapta a tu rol.
            </p>
            <button
              onClick={() => { resetTour(); onStartTour?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 9, border: 'none',
                background: '#7C4DFF', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(124,77,255,0.3)',
              }}
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
