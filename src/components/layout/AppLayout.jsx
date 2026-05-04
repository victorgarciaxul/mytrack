import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppTour, { useTour } from '../tour/AppTour'

export default function AppLayout() {
  const { isDemo } = useAuth()
  const { isDone } = useTour()
  const [tourRunning, setTourRunning] = useState(false)

  // Auto-start tour on first visit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDone()) setTourRunning(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#F4F4FA' }}>
      {isDemo && (
        <div
          className="text-xs font-medium text-center py-1.5 px-4 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg,#7B68EE,#FF6BCA)', color: '#fff', letterSpacing: '0.02em' }}
        >
          ✦ Modo demo activo
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onStartTour={() => setTourRunning(true)} />
        <main className="flex-1 overflow-y-auto" style={{ background: '#F4F4FA' }}>
          <Outlet context={{ onStartTour: () => setTourRunning(true) }} />
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1A2E',
            color: '#fff',
            border: '1px solid #2E2E4A',
            borderRadius: '10px',
            fontSize: '13px',
          },
        }}
      />
      <AppTour run={tourRunning} onFinish={() => setTourRunning(false)} />
    </div>
  )
}
