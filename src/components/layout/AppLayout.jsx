import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppTour, { useTour } from '../tour/AppTour'
import { useTheme } from '../../context/ThemeContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'

export default function AppLayout() {
  const { isDemo } = useAuth()
  const { isDark } = useTheme()
  const { isDone } = useTour()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [tourRunning, setTourRunning] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar when switching to desktop
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  useEffect(() => {
    const t = setTimeout(() => { if (!isDone()) setTourRunning(true) }, 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>


    <div className="app-wrapper" style={{
      display: 'flex', flex: 1, overflow: 'hidden',
      background: 'var(--c-bg-app)',
      padding: isMobile ? 0 : 12,
      gap: isMobile ? 0 : 12,
    }}>
      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 299,
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar
        onStartTour={() => setTourRunning(true)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div className="app-content-frame" style={{
          display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
          background: 'var(--c-bg-surface)',
          borderRadius: isMobile ? 0 : 14,
          border: isMobile ? 'none' : '1px solid var(--c-border)',
          boxShadow: isMobile ? 'none' : isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,0,0,0.05)',
          height: '100%',
        }}>
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main style={{ flex: 1, overflow: 'hidden', background: 'var(--c-bg-subtle)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Outlet context={{ onStartTour: () => setTourRunning(true) }} />
            </div>
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
    </div>
  )
}
