/**
 * Importa los registros de tiempo de Clockify de AYER para todos los usuarios.
 * Solo toca la tabla time_entries — no modifica proyectos, equipo, ni nada más.
 *
 * Uso: node scripts/import-yesterday.mjs
 */

import { createClient } from '@supabase/supabase-js'

const API_KEY      = 'MDQ0YTczODctZGNhMC00YjE1LTkxNzktMzdjYjM4YTVlMmM4'
const WORKSPACE_ID = '5e67ae37a4ec9a653886c794'
const BASE         = 'https://api.clockify.me/api/v1'
const HEADERS      = { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' }

const SUPABASE_URL = 'https://bjoqigbscnkqufhtgrlu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqb3FpZ2JzY25rcXVmaHRncmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Njk3NTQsImV4cCI6MjA5NjE0NTc1NH0.TTMiTrZKPP6MQKlXCQuNKTUuOhPCTZNWvcJoD53oTCo'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function getWsIdForEmail(email) {
  return email?.endsWith('@fundacionxul.org') ? 'fundacion-ws-1' : 'xul-ws-1'
}

async function fetchAll(path, pageSize = 50) {
  const results = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const url = `${BASE}${path}${sep}page=${page}&page-size=${pageSize}`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`Clockify ${res.status} en ${path}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    results.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return results
}

// ── Rango de ayer (hora local España → UTC) ─────────────────────────────────
const now = new Date()
const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)
const start = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0))
const end   = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59))

console.log(`Importando entradas del ${start.toISOString().slice(0,10)} (UTC)`)

// ── Obtener usuarios ─────────────────────────────────────────────────────────
const rawUsers = await fetchAll(`/workspaces/${WORKSPACE_ID}/users?page-size=200`, 200)
console.log(`${rawUsers.length} usuarios en Clockify`)

// ── Obtener proyectos para mapear nombre/color ───────────────────────────────
const rawProjects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects?archived=false`, 100)
const archivedP   = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects?archived=true`, 100)
const projectMap  = Object.fromEntries([...rawProjects, ...archivedP].map(p => [p.id, p]))

// ── Construir mapa de tareas ─────────────────────────────────────────────────
console.log('Cargando tareas…')
const taskMap = {}
for (const p of [...rawProjects, ...archivedP]) {
  try {
    const active = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects/${p.id}/tasks?status=ACTIVE`, 100)
    const done   = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects/${p.id}/tasks?status=DONE`, 100)
    ;[...active, ...done].forEach(t => { taskMap[t.id] = t.name })
  } catch { /* skip */ }
}
console.log(`${Object.keys(taskMap).length} tareas cargadas`)

// ── Importar entradas ────────────────────────────────────────────────────────
let total = 0
let skipped = 0

for (const u of rawUsers) {
  const url = `/workspaces/${WORKSPACE_ID}/user/${u.id}/time-entries?start=${start.toISOString()}&end=${end.toISOString()}`
  let entries
  try {
    entries = await fetchAll(url, 50)
  } catch (err) {
    console.warn(`  ✗ ${u.email}: ${err.message}`)
    continue
  }
  if (entries.length === 0) continue

  const wsId = getWsIdForEmail(u.email)
  const mirrorWsId = wsId === 'xul-ws-1' ? 'fundacion-ws-1' : null

  for (const e of entries) {
    if (!e.timeInterval?.end) { skipped++; continue } // saltamos timers en curso

    const proj      = e.projectId ? projectMap[e.projectId] : null
    const duration  = e.timeInterval?.duration
      ? Math.round(parseDuration(e.timeInterval.duration))
      : Math.floor((new Date(e.timeInterval.end) - new Date(e.timeInterval.start)) / 1000)

    const row = {
      id:            e.id,
      workspace_id:  wsId,
      user_email:    u.email,
      project_id:    e.projectId   || null,
      project_name:  proj?.name    || null,
      project_color: proj?.color   || null,
      client_name:   proj?.clientId ? null : null,
      task_id:       e.taskId      || null,
      task_name:     e.taskId ? (taskMap[e.taskId] || null) : null,
      description:   e.description || null,
      start_time:    e.timeInterval.start,
      end_time:      e.timeInterval.end,
      duration,
      billable:      e.billable ?? true,
    }

    const { error } = await supabase.from('time_entries').upsert(row, { onConflict: 'id' })
    if (error) {
      console.warn(`  ✗ Entry ${e.id} (${u.email}): ${error.message}`)
    } else {
      // Espejo en fundacion si aplica (misma lógica que dbUpsertEntries)
      if (mirrorWsId) {
        await supabase.from('time_entries').upsert({ ...row, id: e.id + '__f', workspace_id: mirrorWsId }, { onConflict: 'id' })
      }
      total++
    }
  }
  if (entries.length > 0) console.log(`  ✓ ${u.email}: ${entries.length} entradas`)
}

console.log(`\nListo. ${total} entradas upserted, ${skipped} saltadas (sin fin).`)

// ── Helper: parsear duración ISO 8601 (PT1H30M) → segundos ──────────────────
function parseDuration(iso) {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}
