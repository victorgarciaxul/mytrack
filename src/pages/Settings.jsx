import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { Settings as SettingsIcon, User, Building, HelpCircle, Play, Download, CheckCircle, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTour } from '../components/tour/AppTour'
import { importFromClockify, loadClockifyCache, clearClockifyCache } from '../lib/clockify'

function ClockifyImportCard({ onImported }) {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const cache = loadClockifyCache()

  async function handleImport() {
    setLoading(true)
    setProgress(0)
    try {
      const result = await importFromClockify((msg, pct) => {
        setStatus(msg)
        setProgress(pct)
      })
      toast.success(`Importados: ${result.projects?.length} proyectos, ${result.entries?.length} entradas`)
      setTimeout(() => window.location.reload(), 1200)
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

export default function Settings() {
  const { user } = useAuth()
  const { workspace } = useWorkspace()
  const { onStartTour } = useOutletContext() || {}
  const { resetTour } = useTour()
  const [, forceUpdate] = useState(0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 640, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 20 }}>Ajustes</h1>

      {/* Clockify import */}
      <ClockifyImportCard onImported={() => forceUpdate(n => n + 1)} />

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
