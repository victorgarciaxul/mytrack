import { useEffect, useRef, useState } from 'react'

export function useTimer() {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      startRef.current = Date.now() - elapsed * 1000
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  const start = () => setIsRunning(true)
  const stop = () => { setIsRunning(false); return elapsed }
  const reset = () => { setIsRunning(false); setElapsed(0) }

  const format = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0')
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return { isRunning, elapsed, formatted: format(elapsed), start, stop, reset, format }
}
