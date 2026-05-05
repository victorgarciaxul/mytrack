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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F6F8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar onStartTour={() => setTourRunning(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {isDemo && (
          <div style={{
            background: '#7B68EE',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            textAlign: 'center',
            padding: '3px 0',
            letterSpacing: '0.02em',
            flexShrink: 0,
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
            background: '#1C1C28',
            color: '#fff',
            border: '1px solid #2A2D3A',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
      <AppTour run={tourRunning} onFinish={() => setTourRunning(false)} />
    </div>
  )
}
