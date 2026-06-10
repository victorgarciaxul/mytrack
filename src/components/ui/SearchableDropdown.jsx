import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

/**
 * Reusable searchable dropdown.
 *
 * Props:
 *   value        – current selected option value (or null)
 *   onChange     – (option | null) => void
 *   options      – [{ value, label, color? }]
 *   placeholder  – text when nothing selected
 *   clearLabel   – label for the "clear / sin X" option  (default "Sin selección")
 *   style        – extra style for the trigger button
 *   disabled     – boolean
 */
export default function SearchableDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar…',
  clearLabel = 'Sin selección',
  style,
  disabled,
  error,
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const containerRef        = useRef(null)
  const inputRef            = useRef(null)
  const isMobile            = useMediaQuery('(max-width: 768px)')

  const selected = options.find(o => o.value === value) || null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Auto-focus search when opened (skip on mobile to avoid iOS scroll/zoom)
  useEffect(() => {
    if (open) {
      setQuery('')
      if (!isMobile) setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open, isMobile])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  function select(opt) {
    onChange(opt)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(p => !p)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 10px',
          borderRadius: 9,
          border: open
            ? '1.5px solid #7C4DFF'
            : error
              ? '1.5px solid #EF4444'
              : '1.5px solid var(--c-border)',
          background: open ? 'var(--c-bg-surface)' : 'var(--c-bg-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, color: selected ? 'var(--c-text-1)' : 'var(--c-text-4)',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
          textAlign: 'left',
          minWidth: 0,
        }}
      >
        {/* Color dot */}
        {selected?.color && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--c-text-4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: 'calc(100% + 4px)',
          minWidth: '100%',
          width: isMobile ? '100%' : 'max-content',
          maxWidth: isMobile ? '100%' : 320,
          zIndex: 200,
          background: 'var(--c-bg-surface)',
          border: '1px solid var(--c-border-light)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 10px',
            borderBottom: '1px solid var(--c-border-light)',
          }}>
            <Search size={13} style={{ color: 'var(--c-text-4)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--c-text-1)',
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter' && filtered.length > 0) select(filtered[0])
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', display: 'flex', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {/* Clear option */}
            {!query && (
              <Option
                label={clearLabel}
                color={null}
                active={!value}
                muted
                onClick={() => select(null)}
              />
            )}

            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--c-text-4)', padding: '10px 12px', margin: 0 }}>
                Sin resultados para "{query}"
              </p>
            ) : (
              filtered.map(o => (
                <Option
                  key={o.value}
                  label={o.label}
                  color={o.color}
                  active={o.value === value}
                  onClick={() => select(o)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Option({ label, color, active, muted, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: muted ? 'var(--c-text-4)' : 'var(--c-text-1)',
        background: active ? '#7C4DFF12' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {active && !muted && (
        <span style={{ fontSize: 11, color: '#7C4DFF', fontWeight: 700 }}>✓</span>
      )}
    </button>
  )
}
