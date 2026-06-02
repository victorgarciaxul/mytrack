import { createContext, useContext, useEffect, useRef, useState } from 'react'

const TIMER_KEY = 'mytrack-timer-state'

function loadTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveTimerState(state) {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(state)) } catch {}
}

function clearTimerState() {
  localStorage.removeItem(TIMER_KEY)
}

function fmtSecs(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const TimerContext = createContext(null)

export function TimerProvider({ children }) {
  const saved = loadTimerState()

  const [isRunning, setIsRunning] = useState(() => !!saved?.startedAt)
  const [elapsed, setElapsed] = useState(() =>
    saved?.startedAt ? Math.floor((Date.now() - saved.startedAt) / 1000) : 0
  )

  const startedAtRef = useRef(saved?.startedAt || null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      if (!startedAtRef.current) {
        startedAtRef.current = Date.now() - elapsed * 1000
      }
      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(secs)
        document.title = `${fmtSecs(secs)} • MyTrack`
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
      document.title = 'MyTrack | XUL'
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  function start(customStartedAt) {
    const now = customStartedAt ? new Date(customStartedAt).getTime() : Date.now()
    startedAtRef.current = now
    saveTimerState({ startedAt: now })
    setIsRunning(true)
    // If restoring from Neon (cross-device), compute correct elapsed time
    setElapsed(Math.floor((Date.now() - now) / 1000))
  }

  function stop() {
    const secs = elapsed
    setIsRunning(false)
    clearTimerState()
    startedAtRef.current = null
    return secs
  }

  function reset() {
    setIsRunning(false)
    setElapsed(0)
    clearTimerState()
    startedAtRef.current = null
  }

  const value = {
    isRunning,
    elapsed,
    formatted: fmtSecs(elapsed),
    start,
    stop,
    reset,
    format: fmtSecs,
  }

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimerContext() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimerContext must be used inside TimerProvider')
  return ctx
}
