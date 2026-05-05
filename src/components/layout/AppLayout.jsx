import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppTour, { useTour } from '../tour/AppTour'

export default function AppLayout() {
  const { isDemo } = useAuth()
  const { isDone } = useTour()
  const [tourRunning, setTourRunning] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (!isDone()) setTourRunning(true) }, 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', background: '#F8FAFC' }}>
      <Sidebar onStartTour={() => setTourRunning(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {isDemo && (
          <div style={{
            background: 'linear-gradient(90deg, #7C4DFF, #E040FB)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            textAlign: 'center',
            padding: '4px 0',
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
            ✦ Modo demo activo
          </div>
        )}
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#FFFFFF' }}>
          <Outlet context={{ onStartTour: () => setTourRunning(true) }} />
        </main>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0F172A',
            color: '#F1F5F9',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
      <AppTour run={tourRunning} onFinish={() => setTourRunning(false)} />
    </div>
  )
}
