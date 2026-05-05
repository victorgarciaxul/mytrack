import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppTour, { useTour } from '../tour/AppTour'
import { useTheme } from '../../context/ThemeContext'

export default function AppLayout() {
  const { isDemo } = useAuth()
  const { isDark } = useTheme()
  const { isDone } = useTour()
  const [tourRunning, setTourRunning] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (!isDone()) setTourRunning(true) }, 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg-app)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <Sidebar onStartTour={() => setTourRunning(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0, padding: '12px 12px 12px 0' }}>
        {isDemo && (
          <div style={{
            background: 'linear-gradient(90deg,#7C4DFF,#E040FB)',
            color: '#fff', fontSize: 11, fontWeight: 500,
            textAlign: 'center', padding: '3px 0', flexShrink: 0,
            borderRadius: '10px 10px 0 0', letterSpacing: '0.02em',
          }}>
            ✦ Modo demo activo
          </div>
        )}
        <div style={{
          display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
          background: 'var(--c-bg-surface)',
          borderRadius: isDemo ? '0 0 14px 14px' : 14,
          border: '1px solid var(--c-border)',
          boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.05)',
        }}>
          <TopBar />
          <main style={{ flex: 1, overflowY: 'auto', background: 'var(--c-bg-subtle)' }}>
            <Outlet context={{ onStartTour: () => setTourRunning(true) }} />
          </main>
        </div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1A2E', color: '#F1F5F9',
            border: '1px solid #2A2A4A', borderRadius: '10px',
            fontSize: '13px', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          },
        }}
      />
      <AppTour run={tourRunning} onFinish={() => setTourRunning(false)} />
    </div>
  )
}
