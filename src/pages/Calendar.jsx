import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  format, addMonths, subMonths, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { demoEntries } from '../lib/demoData'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function secsToHM(secs) {
  if (!secs) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function Calendar() {
  const { isDemo } = useAuth()
  const { projects } = useWorkspace()
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(null)

  // Use demo entries (or real entries in future)
  const entries = isDemo ? demoEntries : []

  // Build calendar grid: Mon–Sun weeks
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Group entries by day
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const key = format(parseISO(e.start_time), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [entries])

  // Total hours for the month
  const monthTotal = useMemo(() => {
    return entries
      .filter(e => isSameMonth(parseISO(e.start_time), current))
      .reduce((sum, e) => sum + (e.duration || 0), 0)
  }, [entries, current])

  const selectedEntries = selected ? (byDay[format(selected, 'yyyy-MM-dd')] || []) : []

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'Inter, system-ui, sans-serif', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
            Calendario
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--c-card-a)', borderRadius: 8, padding: '4px 12px',
          }}>
            <Clock size={13} style={{ color: '#7C4DFF' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#7C4DFF' }}>
              {secsToHM(monthTotal)} este mes
            </span>
          </div>
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--c-border)',
              background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-2)',
            }}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{
            fontSize: 15, fontWeight: 600, color: 'var(--c-text-1)',
            minWidth: 140, textAlign: 'center', textTransform: 'capitalize',
          }}>
            {format(current, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--c-border)',
              background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-2)',
            }}
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--c-border)',
              background: 'var(--c-bg-muted)', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)',
            }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Main: calendar + detail panel */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* Calendar grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAY_LABELS.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 11, fontWeight: 700,
                color: 'var(--c-text-4)', padding: '4px 0',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 3, flex: 1,
          }}>
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEntries = byDay[key] || []
              const totalSecs = dayEntries.reduce((s, e) => s + (e.duration || 0), 0)
              const inMonth = isSameMonth(day, current)
              const isSelected = selected && isSameDay(day, selected)
              const today = isToday(day)

              // Get unique projects for this day (up to 3)
              const projectColors = [...new Set(dayEntries.map(e => e.projects?.color).filter(Boolean))].slice(0, 4)

              return (
                <div
                  key={key}
                  onClick={() => setSelected(isSameDay(day, selected) ? null : day)}
                  style={{
                    borderRadius: 10,
                    border: isSelected
                      ? '2px solid #7C4DFF'
                      : today
                        ? '2px solid #7C4DFF44'
                        : '1.5px solid var(--c-border-light)',
                    background: isSelected
                      ? 'var(--c-card-a)'
                      : today
                        ? 'var(--c-bg-subtle)'
                        : inMonth ? 'var(--c-bg-surface)' : 'var(--c-bg-muted)',
                    padding: '8px 9px',
                    cursor: 'pointer',
                    opacity: inMonth ? 1 : 0.4,
                    transition: 'all 0.1s',
                    minHeight: 76,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#7C4DFF66' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = today ? '#7C4DFF44' : 'var(--c-border-light)' }}
                >
                  {/* Day number */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 13, fontWeight: today ? 700 : 500,
                      color: today ? '#7C4DFF' : inMonth ? 'var(--c-text-1)' : 'var(--c-text-4)',
                      width: 22, height: 22, borderRadius: 6,
                      background: today ? '#7C4DFF18' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {format(day, 'd')}
                    </span>
                    {totalSecs > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: 'var(--c-text-2)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {secsToHM(totalSecs)}
                      </span>
                    )}
                  </div>

                  {/* Project color dots / bars */}
                  {dayEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                      {dayEntries.slice(0, 3).map((e, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '2px 5px', borderRadius: 4,
                          background: (e.projects?.color || '#7C4DFF') + '18',
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: e.projects?.color || '#7C4DFF',
                          }} />
                          <span style={{
                            fontSize: 10, color: 'var(--c-text-2)',
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1,
                          }}>
                            {e.description || e.projects?.name || '—'}
                          </span>
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <span style={{ fontSize: 9, color: 'var(--c-text-4)', paddingLeft: 5 }}>
                          +{dayEntries.length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{
          width: 280, flexShrink: 0,
          background: 'var(--c-bg-surface)',
          borderRadius: 14, border: '1px solid var(--c-border-light)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {selected ? (
            <>
              <div style={{
                padding: '16px 18px 12px',
                borderBottom: '1px solid var(--c-border-light)',
              }}>
                <p style={{ fontSize: 11, color: 'var(--c-text-4)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  {format(selected, 'EEEE', { locale: es })}
                </p>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
                  {format(selected, "d 'de' MMMM", { locale: es })}
                </p>
                {selectedEntries.length > 0 && (
                  <div style={{
                    marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'var(--c-card-a)', borderRadius: 6, padding: '3px 8px',
                  }}>
                    <Clock size={11} style={{ color: '#7C4DFF' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#7C4DFF' }}>
                      {secsToHM(selectedEntries.reduce((s, e) => s + (e.duration || 0), 0))} totales
                    </span>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                {selectedEntries.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%', gap: 8, opacity: 0.5,
                  }}>
                    <Clock size={28} style={{ color: 'var(--c-text-4)' }} />
                    <p style={{ fontSize: 13, color: 'var(--c-text-3)', margin: 0 }}>Sin registros</p>
                  </div>
                ) : (
                  selectedEntries.map(e => (
                    <div key={e.id} style={{
                      padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                      background: (e.projects?.color || '#7C4DFF') + '12',
                      borderLeft: `3px solid ${e.projects?.color || '#7C4DFF'}`,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)', margin: '0 0 3px' }}>
                        {e.description || '(sin descripción)'}
                      </p>
                      {e.projects && (
                        <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: '0 0 4px' }}>
                          {e.projects.name}
                          {e.projects.clients?.name && ` · ${e.projects.clients.name}`}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} style={{ color: 'var(--c-text-4)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)' }}>
                          {secsToHM(e.duration)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--c-text-4)', marginLeft: 4 }}>
                          {format(parseISO(e.start_time), 'HH:mm')} – {format(parseISO(e.end_time), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 10, padding: 24,
              opacity: 0.5,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--c-bg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={20} style={{ color: 'var(--c-text-3)' }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--c-text-3)', margin: 0, textAlign: 'center' }}>
                Selecciona un día para ver sus registros
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
