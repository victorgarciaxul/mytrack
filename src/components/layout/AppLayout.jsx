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
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F8FA' }}>
      <Sidebar onStartTour={() => setTourRunning(true)} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {isDemo && (
          <div
            className="text-xs font-medium text-center py-1 flex-shrink-0"
            style={{ background: 'linear-gradient(90deg,#7C4DFF,#EC4899)', color: '#fff', letterSpacing: '0.02em' }}
          >
            ✦ Modo demo activo
          </div>
        )}
        <TopBar />
        <main className="flex-1 overflow-y-auto" style={{ background: '#F7F8FA' }}>
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
