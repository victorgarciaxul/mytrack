import { Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppTour, { useTour } from '../tour/AppTour'
import { useTheme } from '../../context/ThemeContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { X } from 'lucide-react'

const BANNER_KEY = 'mytrack-banner-dismissed'

export default function AppLayout() {
  const { isDemo } = useAuth()
  const { isDark } = useTheme()
  const { isDone } = useTour()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [tourRunning, setTourRunning] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(() => {
    try { return localStorage.getItem(BANNER_KEY) !== 'true' } catch { return true }
  })

  function dismissBanner() {
    try { localStorage.setItem(BANNER_KEY, 'true') } catch {}
    setBannerVisible(false)
  }

  // Close sidebar when switching to desktop
  useEffect(() => { if (!isMobile) setSidebarOpen(false) }, [isMobile])

  useEffect(() => {
    const t = setTimeout(() => { if (!isDone()) setTourRunning(true) }, 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Welcome banner ── */}
      {bannerVisible && (
        <div style={{
          background: 'linear-gradient(90deg, #1D4ED8 0%, #2563EB 50%, #1E40AF 100%)',
          color: '#fff',
          padding: isMobile ? '8px 12px' : '9px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, flexShrink: 0, position: 'relative',
          fontSize: isMobile ? 12 : 13,
        }}>
          <span style={{ fontWeight: 700, letterSpacing: '-0.1px' }}>👋 Bienvenido a MyTrack</span>
          <span style={{ opacity: 0.75, display: isMobile ? 'none' : 'inline' }}>·</span>
          <span style={{ opacity: 0.9 }}>
            {isMobile ? '' : '¿Necesitas ayuda? '}
            <a
              href="mailto:tech@xul.es"
              style={{ color: '#93C5FD', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid rgba(147,197,253,0.4)' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#93C5FD'}
            >tech@xul.es</a>
          </span>
          <button
            onClick={dismissBanner}
            style={{
              position: 'absolute', right: isMobile ? 8 : 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6,
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', padding: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            title="Cerrar"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

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
    </div>
  )
}
