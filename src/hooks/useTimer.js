import { useEffect, useRef, useState } from 'react'

const TIMER_KEY = 'mytrack-timer-state'

function loadTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveTimerState(state) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(state))
  } catch {}
}

function clearTimerState() {
  localStorage.removeItem(TIMER_KEY)
}

export function useTimer() {
  const saved = loadTimerState()

  const [isRunning, setIsRunning] = useState(() => !!saved?.startedAt)
  const [elapsed, setElapsed] = useState(() => {
    if (saved?.startedAt) {
      return Math.floor((Date.now() - saved.startedAt) / 1000)
    }
    return 0
  })

  const startedAtRef = useRef(saved?.startedAt || null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      if (!startedAtRef.current) {
        startedAtRef.current = Date.now() - elapsed * 1000
      }
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  const start = () => {
    const now = Date.now()
    startedAtRef.current = now
    saveTimerState({ startedAt: now })
    setIsRunning(true)
    setElapsed(0)
  }

  const stop = () => {
    setIsRunning(false)
    clearTimerState()
    startedAtRef.current = null
    return elapsed
  }

  const reset = () => {
    setIsRunning(false)
    setElapsed(0)
    clearTimerState()
    startedAtRef.current = null
  }

  const format = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0')
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return { isRunning, elapsed, formatted: format(elapsed), start, stop, reset, format }
}
