import { useState, useEffect, useRef } from 'react'
import { RotateCcw, Save, Share2, Check, Users, X, Smile, Trash2 } from 'lucide-react'
import { dbSaveNote, dbShareNote, dbToggleReaction, ensureReactionsColumn, dbDeleteNote } from '../../lib/db'
import toast from 'react-hot-toast'

const NOTE_COLORS = ['#FFF176', '#FFF59D', '#FFEE58']
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🔥']

export default function StickyNote({ note, idx, members, userEmail, authorName, onChange, onDelete }) {
  // Is this note shared TO me (i.e. I'm not the author)?
  const isReadOnly = !!(note.author_email && note.author_email !== userEmail)

  const [draft, setDraft]           = useState(note.content || '')
  const [saving, setSaving]         = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [emojiOpen, setEmojiOpen]   = useState(false)
  const [reactions, setReactions]   = useState(() => {
    try { return JSON.parse(note.reactions || '[]') } catch { return [] }
  })
  const [sharedWith, setSharedWith] = useState(() => {
    try { return JSON.parse(note.shared_with || '[]') } catch { return [] }
  })
  const pickerRef = useRef(null)
  const btnRef    = useRef(null)

  useEffect(() => {
    try { setSharedWith(JSON.parse(note.shared_with || '[]')) } catch {}
  }, [note.shared_with])

  useEffect(() => {
    try { setReactions(JSON.parse(note.reactions || '[]')) } catch {}
  }, [note.reactions])

  // Close share picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    function handler(e) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) setPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const isDirty    = draft !== (note.content || '')
  const isSharedAll = sharedWith.includes('all')
  const bg = NOTE_COLORS[idx]

  // Group reactions by emoji
  const grouped = REACTION_EMOJIS.map(emoji => {
    const list = reactions.filter(r => r.emoji === emoji)
    return { emoji, count: list.length, mine: list.some(r => r.email === userEmail) }
  }).filter(g => g.count > 0)

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await dbSaveNote({ userEmail, authorName, slot: idx, content: draft })
      if (saved) { onChange({ ...note, id: saved.id, content: draft }); toast.success('Nota guardada') }
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  async function handleClear() {
    setDraft('')
    setSharedWith([])
    if (!note.id) return
    try {
      await dbSaveNote({ userEmail, authorName, slot: idx, content: '' })
      await dbShareNote(note.id, [])
      onChange({ ...note, content: '', shared_with: '[]' })
    } catch {}
  }

  async function handleDelete() {
    if (!note.id) { onDelete?.(); return }
    try {
      await dbDeleteNote(note.id)
      onDelete?.()
    } catch { toast.error('Error al eliminar') }
  }

  async function toggle(target) {
    let noteId = note.id
    const currentDraft = draft  // capture before any async/re-render
    if (!noteId) {
      setSaving(true)
      try {
        const saved = await dbSaveNote({ userEmail, authorName, slot: idx, content: currentDraft })
        if (saved) { noteId = saved.id }
      } catch { toast.error('Guarda la nota primero'); setSaving(false); return }
      setSaving(false)
    }
    const next = sharedWith.includes(target)
      ? sharedWith.filter(e => e !== target)
      : [...sharedWith, target]
    setSharedWith(next)
    // Always include content so re-mount (key change) restores the draft
    onChange({ ...note, id: noteId, content: currentDraft, shared_with: JSON.stringify(next) })
    await dbShareNote(noteId, next)
  }

  async function handleReact(emoji) {
    if (!note.id) return
    try {
      await ensureReactionsColumn()
      const next = await dbToggleReaction(note.id, userEmail, authorName, emoji)
      setReactions(next)
      onChange({ ...note, reactions: JSON.stringify(next) })
    } catch { toast.error('Error al reaccionar') }
    setEmojiOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ borderRadius: 12, background: bg, boxShadow: '2px 4px 14px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

        {/* Author label for read-only notes */}
        {isReadOnly && note.author_name && (
          <div style={{ padding: '8px 12px 0', fontSize: 10, fontWeight: 700, color: '#a08000', opacity: 0.7, letterSpacing: '0.04em' }}>
            ✏️ {note.author_name}
          </div>
        )}

        <textarea
          value={draft}
          onChange={isReadOnly ? undefined : e => setDraft(e.target.value)}
          readOnly={isReadOnly}
          placeholder={isReadOnly ? '' : 'Escribe una nota...'}
          style={{ width: '100%', minHeight: 80, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, lineHeight: 1.5, color: '#4a3f00', boxSizing: 'border-box', padding: '12px 12px 4px', cursor: isReadOnly ? 'default' : 'text' }}
        />

        {/* Toolbar — only for the author */}
        {!isReadOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 8px', justifyContent: 'flex-end' }}>
            <button onClick={handleClear} title="Limpiar" style={btnStyle('transparent', '#a08000')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <RotateCcw size={12} />
            </button>
            <button onClick={handleDelete} title="Borrar nota" style={btnStyle('transparent', '#c0392b')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Trash2 size={12} />
            </button>
            <button onClick={handleSave} title="Guardar"
              style={{ ...btnStyle(isDirty ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.07)', isDirty ? '#4a3000' : '#a08000'), width: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', fontSize: 11, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = isDirty ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.07)'}>
              {saving ? <span style={{ fontSize: 10 }}>Guardando…</span> : <><Save size={11} /><span>Guardar</span></>}
            </button>
            <button ref={btnRef} onClick={() => { setPickerOpen(p => !p); setPickerSearch('') }} title="Compartir"
              style={{ ...btnStyle(sharedWith.length ? 'rgba(124,77,255,0.18)' : 'rgba(0,0,0,0.07)', sharedWith.length ? '#5a00cc' : '#a08000'), width: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', fontSize: 11, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = sharedWith.length ? 'rgba(124,77,255,0.18)' : 'rgba(0,0,0,0.07)'}>
              <Share2 size={11} /><span>Compartir</span>
            </button>
          </div>
        )}

        {/* Shared-with chips — only visible to author */}
        {!isReadOnly && sharedWith.length > 0 && (
          <div style={{ padding: '0 8px 6px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {isSharedAll ? (
              <Chip label="Todo el equipo" icon={<Users size={9} />} onRemove={() => toggle('all')} />
            ) : sharedWith.map(email => {
              const m = members.find(m => m.user_email === email)
              const name = m?.user_name?.split(' ')[0] || email.split('@')[0]
              return <Chip key={email} label={name} onRemove={() => toggle(email)} />
            })}
          </div>
        )}

        {/* Reaction bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 8px', flexWrap: 'wrap' }}>
          {grouped.map(g => (
            <button key={g.emoji} onClick={() => handleReact(g.emoji)}
              title={`${g.count} reacción${g.count > 1 ? 'es' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 12, border: `1.5px solid ${g.mine ? 'rgba(124,77,255,0.5)' : 'rgba(0,0,0,0.15)'}`, background: g.mine ? 'rgba(124,77,255,0.12)' : 'rgba(0,0,0,0.06)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span>{g.emoji}</span><span style={{ fontSize: 10, fontWeight: 700, color: '#5a4a00' }}>{g.count}</span>
            </button>
          ))}
          {note.id && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setEmojiOpen(p => !p)} title="Reaccionar"
                style={{ width: 24, height: 24, borderRadius: 20, border: '1.5px dashed rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                <Smile size={12} style={{ color: '#a08000' }} />
              </button>
              {emojiOpen && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '6px 8px', display: 'flex', gap: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200 }}>
                  {REACTION_EMOJIS.map(e => (
                    <button key={e} onClick={() => handleReact(e)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'var(--c-bg-muted)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share picker */}
      {pickerOpen && (
        <div ref={pickerRef} style={{ position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, zIndex: 300, width: 240, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px 5px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-4)' }}>Compartir con</div>
          {/* Search box */}
          <div style={{ padding: '4px 10px 6px' }}>
            <input
              autoFocus
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Buscar usuario…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '5px 9px', borderRadius: 7, border: '1px solid var(--c-border)',
                background: 'var(--c-bg-muted)', fontSize: 12, color: 'var(--c-text-1)',
                outline: 'none',
              }}
            />
          </div>
          {/* "Todo el equipo" — only show when search is empty */}
          {!pickerSearch && (
            <>
              <PickerRow icon={<div style={{ width: 26, height: 26, borderRadius: 8, background: '#7C4DFF20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={13} style={{ color: '#7C4DFF' }} /></div>} label="Todo el equipo" checked={isSharedAll} onClick={() => toggle('all')} />
              <div style={{ height: 1, background: 'var(--c-border-light)', margin: '2px 8px' }} />
            </>
          )}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {members.length === 0 && <p style={{ fontSize: 12, color: 'var(--c-text-4)', textAlign: 'center', padding: '12px 0', margin: 0 }}>Cargando…</p>}
            {members
              .filter(m => !pickerSearch || m.user_name?.toLowerCase().includes(pickerSearch.toLowerCase()) || m.user_email?.toLowerCase().includes(pickerSearch.toLowerCase()))
              .map(m => {
                const initials = m.user_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                return (
                  <PickerRow key={m.user_email}
                    icon={<div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#7C4DFF,#E040FB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{initials}</div>}
                    label={m.user_name} checked={sharedWith.includes(m.user_email)} onClick={() => toggle(m.user_email)} />
                )
              })}
            {pickerSearch && members.filter(m => m.user_name?.toLowerCase().includes(pickerSearch.toLowerCase()) || m.user_email?.toLowerCase().includes(pickerSearch.toLowerCase())).length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--c-text-4)', textAlign: 'center', padding: '10px 0', margin: 0 }}>Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg, color) {
  return { height: 26, borderRadius: 7, border: 'none', background: bg, cursor: 'pointer', color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s', width: 26 }
}

function Chip({ label, icon, onRemove }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(124,77,255,0.15)', borderRadius: 6, padding: '2px 4px 2px 6px' }}>
      {icon}
      <span style={{ fontSize: 10, color: '#5a00cc', fontWeight: 600 }}>{label}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a00cc', padding: '0 1px', display: 'flex', lineHeight: 1, fontSize: 13, fontWeight: 400 }}>×</button>
    </div>
  )
}

function PickerRow({ icon, label, checked, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: hover ? '#7C4DFF0a' : checked ? '#7C4DFF08' : 'transparent' }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, flex: 1, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? '#7C4DFF' : 'var(--c-border)'}`, background: checked ? '#7C4DFF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s' }}>
        {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      </div>
    </div>
  )
}
