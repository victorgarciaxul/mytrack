import { useState } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'

export default function TimeEntryRow({ entry, onDelete, onRefresh, projects, formatTime, isLast }) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(entry.description)
  const [saving, setSaving] = useState(false)
  const project = entry.projects
  const task = entry.tasks
  const startFmt = format(parseISO(entry.start_time), 'HH:mm')
  const endFmt = entry.end_time ? format(parseISO(entry.end_time), 'HH:mm') : '--:--'

  async function saveEdit() {
    setSaving(true)
    await supabase.from('time_entries').update({ description: desc }).eq('id', entry.id)
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 transition-colors"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--c-border-light)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Project color bar */}
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: project?.color || '#E0E0F0' }} />

      {/* Description */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            className="w-full text-sm outline-none bg-transparent"
            style={{ color: '#1C1C28', borderBottom: '1px solid #7C4DFF' }}
          />
        ) : (
          <p className="text-sm font-medium truncate" style={{ color: '#1C1C28' }}>
            {entry.description || <span style={{ color: '#A0A5C0', fontStyle: 'italic' }}>Sin descripción</span>}
          </p>
        )}
        {(project || task) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {project && <>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: project.color }} />
              <p className="text-xs" style={{ color: '#7A7F9A' }}>
                {project.name}{project.clients ? ` · ${project.clients.name}` : ''}
              </p>
            </>}
            {task && <>
              {project && <span className="text-xs" style={{ color: '#A0A5C0' }}>›</span>}
              <p className="text-xs font-medium" style={{ color: '#7C4DFF' }}>{task.name}</p>
            </>}
          </div>
        )}
      </div>

      {/* Time range */}
      <span className="text-xs hidden sm:block" style={{ color: '#9095B0' }}>
        {startFmt} – {endFmt}
      </span>

      {/* Duration */}
      <span className="font-numeric text-sm font-bold w-20 text-right" style={{ color: '#3D4060' }}>
        {formatTime(entry.duration || 0)}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: '#9095B0' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,104,238,0.1)'; e.currentTarget.style.color = '#7C4DFF' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9095B0' }}
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: '#9095B0' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; e.currentTarget.style.color = '#FF4757' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9095B0' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
