import { useState, useEffect, useRef } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, startOfMonth, addMonths, subMonths,
  isSameDay, getDaysInMonth, getDay, startOfDay, endOfDay,
  startOfWeek, endOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WK = { weekStartsOn: 1 }

/**
 * DateRangePicker
 *
 * Props:
 *   from        Date | null
 *   to          Date | null
 *   onChange    ({ from, to }) => void
 *   label       string  (default 'Rango')
 *   buttonStyle object
 *   weekMode    boolean — snap selection to full Mon–Sun weeks
 */
export default function DateRangePicker({
  from, to, onChange, label = 'Rango', buttonStyle = {}, weekMode = false,
}) {
  const [open, setOpen]         = useState(false)
  const [selecting, setSelecting] = useState(null)   // first anchor (week start if weekMode)
  const [hover, setHover]       = useState(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(from || new Date()))
  const containerRef            = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false); setSelecting(null); setHover(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function snap(date, edge) {
    if (!weekMode) return edge === 'start' ? startOfDay(date) : endOfDay(date)
    return edge === 'start' ? startOfWeek(date, WK) : endOfWeek(date, WK)
  }

  function handleDayClick(date) {
    if (!selecting) {
      setSelecting(snap(date, 'start'))
    } else {
      const anchor = selecting
      const end    = snap(date, 'end')
      const [f, t] = end < anchor ? [snap(date, 'start'), endOfWeek(anchor, WK)] : [anchor, end]
      onChange({ from: f, to: t })
      setSelecting(null); setHover(null); setOpen(false)
    }
  }

  // Compute the visual display range (with live hover preview)
  function getDisplayRange() {
    const hoverSnapped = hover ? snap(hover, 'end') : null
    if (selecting) {
      const end = hoverSnapped || selecting
      return end >= selecting
        ? [selecting, end]
        : [snap(hover || selecting, 'start'), endOfWeek(selecting, WK)]
    }
    return [from, to]
  }
  const [dFrom, dTo] = getDisplayRange()

  function getDayStyle(date) {
    const isStart  = dFrom && isSameDay(date, weekMode ? startOfWeek(dFrom, WK) : dFrom)
    const isEnd    = dTo   && isSameDay(date, weekMode ? endOfWeek(dTo, WK)   : dTo)
    const inRange  = dFrom && dTo && date > (weekMode ? startOfWeek(dFrom, WK) : dFrom)
                             && date < (weekMode ? endOfWeek(dTo, WK) : dTo)
    const isToday  = isSameDay(date, new Date())

    // In weekMode highlight the whole start/end week uniformly
    const isInStartWeek = weekMode && dFrom && date >= startOfWeek(dFrom, WK) && date <= endOfWeek(dFrom, WK)
    const isInEndWeek   = weekMode && dTo   && date >= startOfWeek(dTo, WK)   && date <= endOfWeek(dTo, WK)

    if (!weekMode && (isStart || isEnd)) {
      return { bg: '#7C4DFF', color: '#fff', fw: 700, radius: isStart ? '8px 0 0 8px' : '0 8px 8px 0' }
    }
    if (weekMode && (isInStartWeek || isInEndWeek || inRange)) {
      const isEdge = (weekMode && isInStartWeek && isSameDay(date, startOfWeek(dFrom, WK)))
                  || (weekMode && isInEndWeek   && isSameDay(date, endOfWeek(dTo, WK)))
      return { bg: isEdge ? '#7C4DFF' : '#7C4DFF1A', color: isEdge ? '#fff' : '#7C4DFF', fw: isEdge ? 700 : 500, radius: 0 }
    }
    if (!weekMode && inRange) return { bg: '#7C4DFF1A', color: '#7C4DFF', fw: 500, radius: 0 }
    if (isToday) return { bg: 'transparent', color: '#7C4DFF', fw: 700, radius: 8, border: '1.5px solid #7C4DFF55' }
    return { bg: 'transparent', color: 'var(--c-text-1)', fw: 400, radius: 8 }
  }

  const firstDow  = (getDay(viewMonth) + 6) % 7
  const daysCount = getDaysInMonth(viewMonth)
  const cells     = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysCount; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))

  const triggerLabel = from && to
    ? `${format(weekMode ? startOfWeek(from, WK) : from, 'd MMM', { locale: es })} → ${format(weekMode ? endOfWeek(to, WK) : to, 'd MMM yy', { locale: es })}`
    : label

  const hint = selecting
    ? `Desde sem. ${format(selecting, 'd MMM', { locale: es })} → elige semana de fin`
    : from && to
      ? `${format(weekMode ? startOfWeek(from, WK) : from, 'd MMM', { locale: es })} → ${format(weekMode ? endOfWeek(to, WK) : to, 'd MMM yyyy', { locale: es })}`
      : weekMode ? 'Haz clic en cualquier día de la semana de inicio' : 'Elige la fecha de inicio'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) setViewMonth(startOfMonth(from || new Date())) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: (from && to) ? '#7C4DFF' : 'var(--c-bg-muted)',
          color:      (from && to) ? '#fff'    : 'var(--c-text-3)',
          border:     (from && to) ? '1.5px solid #7C4DFF' : '1.5px solid var(--c-border)',
          transition: 'all 0.15s', whiteSpace: 'nowrap',
          ...buttonStyle,
        }}
      >
        <CalendarRange size={13} />
        {triggerLabel}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 300,
            background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
            borderRadius: 16, padding: 18, minWidth: 272,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setViewMonth(m => subMonths(m, 1))}
              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', textTransform: 'capitalize' }}>
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={() => setViewMonth(m => addMonths(m, 1))}
              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--c-text-4)', paddingBottom: 4 }}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`e${i}`} />
              const ds = getDayStyle(date)
              return (
                <div key={date.getDate()}
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => { if (selecting) setHover(date) }}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    textAlign: 'center', fontSize: 12, fontWeight: ds.fw,
                    padding: '6px 0', cursor: 'pointer',
                    background: ds.bg, color: ds.color,
                    borderRadius: ds.radius, border: ds.border || 'none',
                    transition: 'background 0.08s', userSelect: 'none',
                  }}
                  onMouseOver={e => { if (!ds.bg || ds.bg === 'transparent') e.currentTarget.style.background = '#7C4DFF12' }}
                  onMouseOut={e => { if (!ds.bg || ds.bg === 'transparent') e.currentTarget.style.background = 'transparent' }}
                >
                  {date.getDate()}
                </div>
              )
            })}
          </div>

          {/* Hint */}
          <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--c-bg-muted)', textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: selecting ? '#7C4DFF' : 'var(--c-text-3)', fontWeight: selecting ? 600 : 400 }}>
              {hint}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
