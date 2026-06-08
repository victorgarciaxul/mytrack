import { useState, useMemo, useEffect, useRef } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Clock, Pencil, Trash2, TrendingUp, CalendarDays, X, Radio } from 'lucide-react'
import EditEntryModal from '../components/timer/EditEntryModal'
import { initDB as _initDB, dbDeleteEntry } from '../lib/db'
import toast from 'react-hot-toast'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  format, addMonths, subMonths, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { loadClockifyCache, isClockifyUser } from '../lib/clockify'
import { initDB, dbGetEntries } from '../lib/db'
import { useTimerContext } from '../context/TimerContext'

const ACTIVE_KEY = 'mytrack-active-entry'

const DAY_LABELS     = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_LABELS_MOB = ['L',   'M',   'X',   'J',   'V',   'S',   'D']

function secsToHM(secs) {
  if (!secs) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function secsToHMFull(secs) {
  if (!secs) return '0h 0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function Calendar() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { user, isDemo } = useAuth()
  const timer = useTimerContext()
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  // Live entry — running timer shown in today's modal
  const activeEntry = useMemo(() => {
    if (!timer.isRunning) return null
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)) || null } catch { return null }
  }, [timer.isRunning])

  // Load entries from Neon — always the source of truth
  function loadEntries(email, year) {
    if (!email) return
    setLoading(true)
    initDB()
      .then(() => dbGetEntries(email, year))
      .then(rows => setEntries(rows.map(r => ({
        ...r,
        projects: r.project_id
          ? { id: r.project_id, name: r.project_name || '', color: r.project_color || '#7C4DFF' }
          : null,
        tasks: r.task_id ? { id: r.task_id, name: r.task_name || '' } : null,
      }))))
      .catch(err => { console.error('Calendar Neon error:', err); setEntries([]) })
      .finally(() => setLoading(false))
  }

  // Initial load + reload when year/user changes
  useEffect(() => {
    loadEntries(user?.email, current.getFullYear())
  }, [user?.email, current.getFullYear()])

  // Same-device: reload when Tracker saves an entry
  useEffect(() => {
    function onEntrySaved(e) {
      const year = e.detail?.year || current.getFullYear()
      if (year === current.getFullYear()) loadEntries(user?.email, year)
    }
    window.addEventListener('mytrack:entry-saved', onEntrySaved)
    return () => window.removeEventListener('mytrack:entry-saved', onEntrySaved)
  }, [user?.email, current.getFullYear()])

  // Cross-device: reload when user returns to this tab/app (phone unlock, tab switch)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadEntries(user?.email, current.getFullYear())
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.email, current.getFullYear()])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      const key = format(parseISO(e.start_time), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [entries])

  // Max seconds in a single day (for heat bar scaling)
  const maxDaySecs = useMemo(() => {
    const vals = Object.values(byDay).map(arr => arr.reduce((s, e) => s + (e.duration || 0), 0))
    return Math.max(...vals, 1)
  }, [byDay])

  const monthEntries = useMemo(() =>
    entries.filter(e => isSameMonth(parseISO(e.start_time), current)), [entries, current])

  const monthTotal = useMemo(() =>
    monthEntries.reduce((sum, e) => sum + (e.duration || 0), 0), [monthEntries])

  const activeDays = useMemo(() =>
    new Set(monthEntries.map(e => format(parseISO(e.start_time), 'yyyy-MM-dd'))).size, [monthEntries])

  const selectedEntries = selected ? (byDay[format(selected, 'yyyy-MM-dd')] || []) : []
  // Show live timer card only when modal is open for TODAY
  const liveEntry = selected && isToday(selected) && timer.isRunning ? activeEntry : null

  function openModal(day) {
    setSelected(day)
    setConfirmDeleteId(null)
    requestAnimationFrame(() => setModalVisible(true))
  }

  function closeModal() {
    setModalVisible(false)
    setTimeout(() => { setSelected(null); setConfirmDeleteId(null) }, 220)
  }

  async function handleDelete(id) {
    try {
      await _initDB()
      await dbDeleteEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      setConfirmDeleteId(null)
      toast.success('Entrada eliminada')
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  function handleSaved(updated) {
    setEntries(prev => {
      const exists = prev.find(e => e.id === updated.id)
      if (exists) return prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
      // New entry added from day modal
      return [...prev, updated].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    })
    setEditingEntry(null)
    // keep day modal open — don't call closeModal()
  }

  function handleNewEntry() {
    if (!selected) return
    const dateStr = format(selected, 'yyyy-MM-dd')
    setEditingEntry({
      id:          null,
      description: '',
      start_time:  `${dateStr}T09:00:00`,
      end_time:    `${dateStr}T10:00:00`,
      project_id:  '',
      task_id:     '',
      projects:    null,
      tasks:       null,
    })
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 4px #22C55E30 } 50% { box-shadow: 0 0 0 8px #22C55E15 } }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes slideOutDown {
          from { opacity: 1; transform: translateY(0) scale(1) }
          to   { opacity: 0; transform: translateY(20px) scale(0.97) }
        }
        .cal-day:hover .cal-day-inner { border-color: #7C4DFF55 !important; background: var(--c-bg-hover) !important; }
        .cal-day:hover .cal-heat { opacity: 0.9 !important; }
        .cal-entry-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
      `}</style>

      <div style={{
        padding: isMobile ? '14px' : '24px 28px',
        fontFamily: 'Inter, system-ui, sans-serif',
        position: 'absolute', inset: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 12 : 20,
        boxSizing: 'border-box', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexShrink: 0, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-1)', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
              Calendario
            </h1>
            {/* Stats row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} style={{ color: '#7C4DFF' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7C4DFF' }}>
                  {secsToHMFull(monthTotal)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--c-text-4)', fontWeight: 400 }}>este mes</span>
              </div>
              <span style={{ color: 'var(--c-border)', fontSize: 14 }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CalendarDays size={13} style={{ color: 'var(--c-text-3)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)' }}>{activeDays}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>días activos</span>
              </div>
            </div>
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setCurrent(subMonths(current, 1))}
              style={{
                width: 34, height: 34, borderRadius: 9,
                border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--c-text-2)', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-hover)'; e.currentTarget.style.borderColor = '#7C4DFF66' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{
              padding: '6px 16px', borderRadius: 9,
              border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)',
              minWidth: 148, textAlign: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', textTransform: 'capitalize' }}>
                {format(current, 'MMMM yyyy', { locale: es })}
              </span>
            </div>

            <button
              onClick={() => setCurrent(addMonths(current, 1))}
              style={{
                width: 34, height: 34, borderRadius: 9,
                border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--c-text-2)', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-bg-hover)'; e.currentTarget.style.borderColor = '#7C4DFF66' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}
            >
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => setCurrent(new Date())}
              style={{
                padding: '6px 14px', borderRadius: 9,
                border: '1px solid #7C4DFF44', background: '#7C4DFF10',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: '#7C4DFF', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#7C4DFF20' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7C4DFF10' }}
            >
              Hoy
            </button>
          </div>
        </div>

        {/* ── Calendar grid ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${days.length / 7}, 1fr)`, gap: 4, marginBottom: 6 }}>
            {(isMobile ? DAY_LABELS_MOB : DAY_LABELS).map((d, i) => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: 11, fontWeight: 700,
                color: (i >= 5) ? '#E040FB88' : 'var(--c-text-4)',
                padding: '4px 0',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${days.length / 7}, 1fr)`,
            gap: 4, flex: 1, position: 'relative',
          }}>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--c-bg-surface)cc', borderRadius: 12, zIndex: 5,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  border: '3px solid #7C4DFF', borderTopColor: 'transparent',
                  animation: 'spin 0.7s linear infinite',
                }} />
              </div>
            )}

            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEntries = byDay[key] || []
              const totalSecs = dayEntries.reduce((s, e) => s + (e.duration || 0), 0)
              const inMonth = isSameMonth(day, current)
              const isSelected = selected && isSameDay(day, selected)
              const today = isToday(day)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const hasEntries = dayEntries.length > 0

              // Unique project colors (up to 4)
              const colors = [...new Map(dayEntries.map(e => [e.projects?.id, e.projects?.color]).filter(([, c]) => c)).values()].slice(0, 4)

              // Heat bar height (0–20px range)
              const heatPct = totalSecs / maxDaySecs
              const heatH = Math.round(heatPct * 20)

              return (
                <div
                  key={key}
                  className="cal-day"
                  onClick={() => hasEntries || today ? (isSameDay(day, selected) ? closeModal() : openModal(day)) : null}
                  style={{ cursor: (hasEntries || today) ? 'pointer' : 'default' }}
                >
                  <div
                    className="cal-day-inner"
                    style={{
                      borderRadius: isMobile ? 8 : 12,
                      border: isSelected
                        ? '2px solid #7C4DFF'
                        : today
                          ? '2px solid #7C4DFF55'
                          : `1.5px solid ${isWeekend && inMonth ? 'var(--c-border)' : 'var(--c-border-light)'}`,
                      background: isSelected
                        ? 'linear-gradient(145deg, #7C4DFF12, #E040FB08)'
                        : today
                          ? 'var(--c-bg-subtle)'
                          : inMonth ? 'var(--c-bg-surface)' : 'var(--c-bg-muted)',
                      padding: isMobile ? '4px 3px 0' : '8px 8px 0',
                      opacity: inMonth ? 1 : 0.3,
                      transition: 'border-color 0.15s, background 0.15s',
                      position: 'absolute', inset: 0,
                      boxSizing: 'border-box', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column',
                      
                      overflow: 'hidden',
                    }}
                  >
                    {/* Top row: day number + time */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 3 : 6 }}>
                      {/* Day number */}
                      <div style={{
                        width: isMobile ? 18 : 24, height: isMobile ? 18 : 24, borderRadius: '50%',
                        background: today ? '#7C4DFF' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontSize: isMobile ? 10 : 12, fontWeight: today ? 800 : inMonth ? 500 : 400,
                          color: today ? '#fff' : inMonth ? 'var(--c-text-1)' : 'var(--c-text-4)',
                          lineHeight: 1,
                        }}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Time badge — hidden on mobile */}
                      {!isMobile && totalSecs > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: isSelected ? '#7C4DFF' : 'var(--c-text-3)',
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                          marginTop: 2,
                        }}>
                          {secsToHM(totalSecs)}
                        </span>
                      )}
                    </div>

                    {/* Entry previews */}
                    {dayEntries.length > 0 && (
                      isMobile ? (
                        /* Mobile: compact color dots only */
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingBottom: 3 }}>
                          {[...new Map(dayEntries.map(e => [
                            e.projects?.id ?? e.id, e.projects?.color || '#7C4DFF'
                          ])).values()].slice(0, 4).map((c, idx) => (
                            <span key={idx} style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                          {dayEntries.slice(0, 3).map((e, i) => {
                            const c = e.projects?.color || '#7C4DFF'
                            const label = e.description || e.projects?.name || '—'
                            return (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '2px 4px', borderRadius: 4,
                                background: c + '14',
                              }}>
                                <span style={{
                                  width: 5, height: 5, borderRadius: '50%',
                                  background: c, flexShrink: 0,
                                }} />
                                <span style={{
                                  fontSize: 10, fontWeight: 500,
                                  color: 'var(--c-text-2)',
                                  overflow: 'hidden', whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis', flex: 1,
                                  lineHeight: 1.3,
                                }}>
                                  {label}
                                </span>
                              </div>
                            )
                          })}
                          {dayEntries.length > 3 && (
                            <span style={{
                              fontSize: 9, fontWeight: 600,
                              color: 'var(--c-text-4)', paddingLeft: 4,
                            }}>
                              +{dayEntries.length - 3} más
                            </span>
                          )}
                        </div>
                      )
                    )}

                    {/* Heat bar at bottom */}
                    {heatH > 0 && (
                      <div style={{ marginTop: 'auto', padding: '0 0 0', height: 4, marginBottom: 0, position: 'relative' }}>
                        <div
                          className="cal-heat"
                          style={{
                            position: 'absolute', bottom: 0, left: 0,
                            width: `${Math.max(heatPct * 100, 8)}%`,
                            position: 'absolute', inset: 0,
                            borderRadius: '4px 4px 0 0',
                            background: isSelected
                              ? 'linear-gradient(90deg, #7C4DFF, #E040FB)'
                              : colors[0]
                                ? `linear-gradient(90deg, ${colors[0]}, ${colors[0]}99)`
                                : 'linear-gradient(90deg, #7C4DFF, #7C4DFF99)',
                            opacity: isSelected ? 1 : 0.65,
                            transition: 'opacity 0.15s, width 0.3s',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Day detail — right drawer ── */}
      {selected && createPortal(
        <>
          {/* Backdrop + centering flex wrapper */}
          <div
            onClick={closeModal}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: modalVisible ? 'rgba(6,6,18,0.45)' : 'rgba(6,6,18,0)',
              backdropFilter: modalVisible ? 'blur(4px)' : 'none',
              transition: 'background 0.25s, backdrop-filter 0.25s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
          {/* Centered modal */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              maxHeight: '88vh',
              background: 'var(--c-bg-surface)',
              borderRadius: 24,
              border: '1px solid var(--c-border-light)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column',
              animation: modalVisible ? 'slideInUp 0.25s cubic-bezier(0.22,1,0.36,1) forwards' : 'slideOutDown 0.2s ease-in forwards',
              overflow: 'hidden',
            }}
          >
            {/* ── Header with gradient ── */}
            <div style={{
              padding: '28px 24px 22px',
              background: 'linear-gradient(160deg, #7C4DFF0f 0%, #E040FB07 60%, transparent 100%)',
              borderBottom: '1px solid var(--c-border-light)',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Big decorative number background */}
              <div style={{
                position: 'absolute', right: -10, top: -16,
                fontSize: 130, fontWeight: 900, lineHeight: 1,
                color: '#7C4DFF09', pointerEvents: 'none',
                userSelect: 'none', letterSpacing: '-8px',
              }}>
                {format(selected, 'd')}
              </div>

              {/* Close */}
              <button
                onClick={closeModal}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  width: 30, height: 30, borderRadius: 9,
                  background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--c-text-3)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#EF444412'; e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-bg-muted)'; e.currentTarget.style.color = 'var(--c-text-3)' }}
              >
                <X size={13} />
              </button>

              {/* Day label */}
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#7C4DFF', margin: '0 0 6px', textTransform: 'uppercase',
              }}>
                {format(selected, 'EEEE', { locale: es })}
              </p>

              {/* Date big */}
              <p style={{
                fontSize: 32, fontWeight: 800, color: 'var(--c-text-1)',
                margin: '0 0 18px', letterSpacing: '-1px', lineHeight: 1,
              }}>
                {format(selected, "d 'de' MMMM", { locale: es })}
              </p>

              {/* Stats row + add button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#7C4DFF', borderRadius: 10, padding: '7px 14px',
                  boxShadow: '0 4px 14px #7C4DFF40',
                }}>
                  <Clock size={13} color="rgba(255,255,255,0.8)" />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                    {secsToHMFull(selectedEntries.reduce((s, e) => s + (e.duration || 0), 0) + (liveEntry ? timer.elapsed : 0))}
                  </span>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)',
                  borderRadius: 10, padding: '7px 12px',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)' }}>
                    {selectedEntries.length + (liveEntry ? 1 : 0)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 400 }}>
                    {(selectedEntries.length + (liveEntry ? 1 : 0)) === 1 ? 'entrada' : 'entradas'}
                  </span>
                </div>

                {/* Add new entry button */}
                <button
                  onClick={handleNewEntry}
                  style={{
                    marginLeft: 'auto',
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 12px #10B98130', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
                >
                  <CalendarDays size={13} />
                  + Añadir
                </button>
              </div>
            </div>

            {/* ── Timeline entries ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>

              {/* ── Live timer card — only on today ── */}
              {liveEntry && (
                <div style={{
                  display: 'flex', gap: 14, marginBottom: 10,
                }}>
                  {/* Spine dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: '#22C55E', boxShadow: '0 0 0 4px #22C55E30',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  </div>
                  {/* Card */}
                  <div style={{
                    flex: 1, borderRadius: 14,
                    background: 'linear-gradient(135deg, #22C55E0A, #10B9810A)',
                    border: '1.5px solid #22C55E40',
                    padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', margin: 0 }}>
                        {liveEntry.description || <span style={{ color: 'var(--c-text-4)', fontStyle: 'italic' }}>Sin descripción</span>}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <Radio size={11} color="#22C55E" />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#22C55E', fontVariantNumeric: 'tabular-nums' }}>
                          {timer.formatted}
                        </span>
                      </div>
                    </div>
                    {liveEntry.project && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: (liveEntry.project.color || '#7C4DFF') + '15',
                          border: `1px solid ${liveEntry.project.color || '#7C4DFF'}28`,
                          borderRadius: 6, padding: '2px 7px',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: liveEntry.project.color || '#7C4DFF', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: liveEntry.project.color || '#7C4DFF' }}>
                            {liveEntry.project.name}
                          </span>
                        </div>
                        {liveEntry.task && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-4)', fontWeight: 500 }}>› {liveEntry.task.name}</span>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: '#22C55E', background: '#22C55E15', borderRadius: 4, padding: '2px 6px',
                      }}>En curso</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedEntries.length === 0 && !liveEntry ? (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', gap: 14, opacity: 0.5,
                }}>
                  <Clock size={36} style={{ color: 'var(--c-text-4)' }} />
                  <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: 0, fontWeight: 600 }}>Sin registros este día</p>
                </div>
              ) : selectedEntries.map((e, i) => {
                const color = e.projects?.color || '#7C4DFF'
                const isConfirming = confirmDeleteId === e.id
                const isLast = i === selectedEntries.length - 1

                return (
                  <div key={e.id} style={{ display: 'flex', gap: 14, marginBottom: isLast ? 0 : 6 }}>

                    {/* Timeline spine */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, flexShrink: 0 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: color,
                        boxShadow: `0 0 0 3px ${color}25`,
                        zIndex: 1,
                      }} />
                      {!isLast && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 16,
                          background: `linear-gradient(180deg, ${color}40, ${color}10)`,
                          borderRadius: 2, marginTop: 4,
                        }} />
                      )}
                    </div>

                    {/* Card */}
                    <div
                      className="cal-entry-card"
                      style={{
                        flex: 1, borderRadius: 14,
                        background: 'var(--c-bg-muted)',
                        border: '1px solid var(--c-border-light)',
                        padding: '12px 14px',
                        marginBottom: isLast ? 0 : 8,
                        transition: 'box-shadow 0.15s',
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <p style={{
                          flex: 1, fontSize: 13, fontWeight: 600,
                          color: 'var(--c-text-1)', margin: 0, lineHeight: 1.4,
                        }}>
                          {e.description || <span style={{ color: 'var(--c-text-4)', fontStyle: 'italic' }}>Sin descripción</span>}
                        </p>
                        {!isConfirming && (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button
                              onClick={() => setEditingEntry(e)}
                              title="Editar"
                              style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)', transition: 'all 0.12s' }}
                              onMouseEnter={ev => { ev.currentTarget.style.background = '#7C4DFF15'; ev.currentTarget.style.color = '#7C4DFF' }}
                              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-text-4)' }}
                            ><Pencil size={12} /></button>
                            <button
                              onClick={() => setConfirmDeleteId(e.id)}
                              title="Eliminar"
                              style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-4)', transition: 'all 0.12s' }}
                              onMouseEnter={ev => { ev.currentTarget.style.background = '#EF444415'; ev.currentTarget.style.color = '#EF4444' }}
                              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--c-text-4)' }}
                            ><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>

                      {/* Project tag */}
                      {e.projects && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: color + '15', border: `1px solid ${color}28`,
                            borderRadius: 6, padding: '2px 7px',
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color }}>
                              {e.projects.name}
                              {e.projects.clients?.name && <span style={{ fontWeight: 400, opacity: 0.65 }}> · {e.projects.clients.name}</span>}
                            </span>
                          </div>
                          {e.tasks && (
                            <span style={{ fontSize: 11, color: 'var(--c-text-4)', fontWeight: 500 }}>› {e.tasks.name}</span>
                          )}
                        </div>
                      )}

                      {/* Time row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: color + '18', borderRadius: 7, padding: '3px 9px',
                        }}>
                          <Clock size={10} style={{ color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                            {secsToHM(e.duration)}
                          </span>
                        </div>
                        {e.start_time && e.end_time && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-4)', fontVariantNumeric: 'tabular-nums' }}>
                            {format(parseISO(e.start_time), 'HH:mm')} → {format(parseISO(e.end_time), 'HH:mm')}
                          </span>
                        )}
                      </div>

                      {/* Delete confirm */}
                      {isConfirming && (
                        <div style={{
                          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 9,
                          background: '#EF444410', border: '1px solid #EF444430',
                        }}>
                          <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, flex: 1 }}>¿Eliminar entrada?</span>
                          <button onClick={() => handleDelete(e.id)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer' }}>Sí</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--c-bg-surface)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer' }}>No</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {/* Edit entry modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={handleSaved}
          user={user}
        />
      )}
    </>
  )
}
