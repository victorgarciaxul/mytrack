// ── Clockify API integration ────────────────────────────────
const API_KEY      = 'MDQ0YTczODctZGNhMC00YjE1LTkxNzktMzdjYjM4YTVlMmM4'
const WORKSPACE_ID = '5e67ae37a4ec9a653886c794'

/** Only this user syncs to Clockify */
export const CLOCKIFY_OWNER_EMAIL = 'victorgarcia@xul.es'

/** Returns true if the given email should sync with Clockify */
export function isClockifyUser(email) {
  return email === CLOCKIFY_OWNER_EMAIL
}
const BASE        = 'https://api.clockify.me/api/v1'
const CACHE_KEY   = 'mytrack-clockify-cache'

const h = { 'X-Api-Key': API_KEY }

async function get(path) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers: h })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Clockify ${res.status} en ${path}: ${text.slice(0, 100)}`)
  }
  return res.json()
}

// ── Fetch all pages of a paginated endpoint ─────────────────
async function fetchAll(path, pageSize = 50, onProgress) {
  const results = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const data = await get(`${path}${sep}page-size=${pageSize}&page=${page}`)
    if (!Array.isArray(data) || data.length === 0) break
    results.push(...data)
    onProgress?.(results.length)
    if (data.length < pageSize) break
    page++
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 80))
  }
  return results
}

// ── Map Clockify → MyTrack format ───────────────────────────
function mapProject(p) {
  return {
    id: p.id,
    workspace_id: WORKSPACE_ID,
    name: p.name,
    color: p.color || '#7C4DFF',
    client_id: p.clientId || null,
    budget_hours: p.timeEstimate?.estimate
      ? Math.round(p.timeEstimate.estimate / 3600)
      : null,
    archived: p.archived || false,
    clients: p.clientName ? { name: p.clientName } : null,
  }
}

function mapClient(c) {
  return {
    id: c.id,
    workspace_id: WORKSPACE_ID,
    name: c.name,
    email: c.email || null,
  }
}

function mapMember(m, users) {
  const user = users.find(u => u.id === m.userId)
  return {
    id: m.userId,
    workspace_id: WORKSPACE_ID,
    user_id: m.userId,
    role: m.membershipStatus === 'ACTIVE' ? 'employee' : 'inactive',
    profiles: {
      full_name: user?.name || 'Usuario',
      email: user?.email || '',
      job_title: '',
      hourly_rate: m.hourlyRate?.amount ? m.hourlyRate.amount / 100 : 0,
    },
  }
}

function mapEntry(e) {
  const start = e.timeInterval?.start || null
  const end   = e.timeInterval?.end   || null
  const duration = start && end
    ? Math.round((new Date(end) - new Date(start)) / 1000)
    : null
  return {
    id: e.id,
    workspace_id: WORKSPACE_ID,
    user_id: e.userId,
    project_id: e.projectId || null,
    task_id: e.taskId || null,
    description: e.description || '',
    start_time: start,
    end_time: end,
    duration,
    billable: e.billable || false,
    projects: e.projectId ? { id: e.projectId } : null, // enriched later
  }
}

// ── Main import function ─────────────────────────────────────
const CLOCKIFY_USER_ID = '69d4a7086590b46e76292934' // victorgarcia@xul.es

export async function importFromClockify(onStatus) {
  // Always start clean
  localStorage.removeItem(CACHE_KEY)

  const ws = { id: WORKSPACE_ID, name: 'XUL', working_hours_per_day: 8, alert_threshold_days: 1 }

  onStatus('Importando clientes…', 5)
  const rawClients = await fetchAll(`/workspaces/${WORKSPACE_ID}/clients`, 100)
  const clients = rawClients.map(mapClient)

  onStatus('Importando proyectos…', 15)
  const rawProjects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects?archived=false`, 100)
  const rawArchived = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects?archived=true`, 100)
  const projects = [...rawProjects, ...rawArchived].map(mapProject)

  // Enrich projects with client names
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
  projects.forEach(p => {
    if (p.client_id && clientMap[p.client_id]) {
      p.clients = { name: clientMap[p.client_id].name }
    }
  })

  onStatus('Importando miembros…', 25)
  const rawUsers = await fetchAll(`/workspaces/${WORKSPACE_ID}/users?page-size=200`, 200)
  const members = rawUsers.map(u => ({
    id: u.id,
    workspace_id: WORKSPACE_ID,
    user_id: u.id,
    role: u.roles?.[0]?.role === 'WORKSPACE_ADMIN' ? 'admin' : 'employee',
    profiles: {
      full_name: u.name || '',
      email: u.email || '',
      job_title: '',
      hourly_rate: 0,
    },
  }))

  onStatus('Importando entradas de tiempo…', 35)
  const rawEntries = await fetchAll(
    `/workspaces/${WORKSPACE_ID}/user/${CLOCKIFY_USER_ID}/time-entries`,
    50,
    (n) => onStatus(`Importando entradas… (${n})`, Math.min(35 + Math.floor(n / 20), 85))
  )

  // Map entries and enrich with project info
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const entries = rawEntries.map(e => {
    const entry = mapEntry(e)
    if (entry.project_id && projectMap[entry.project_id]) {
      entry.projects = {
        name: projectMap[entry.project_id].name,
        color: projectMap[entry.project_id].color,
        clients: projectMap[entry.project_id].clients,
      }
    }
    return entry
  })

  onStatus('Guardando en caché…', 90)
  const cache = { ws, clients, projects, members, entries, importedAt: new Date().toISOString() }

  // localStorage has ~5MB limit — try full save, fall back to without entries body
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    // Too large: store metadata + entries without descriptions
    console.warn('localStorage full, storing compact version:', e)
    const compact = {
      ...cache,
      entries: entries.map(({ description, ...rest }) => rest),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(compact))
  }

  onStatus('¡Importación completada!', 100)
  return cache
}

// ── Write API ────────────────────────────────────────────────

/** Fetch tasks for a project (with simple in-memory cache) */
const _taskCache = {}
export async function clockifyGetProjectTasks(projectId) {
  if (_taskCache[projectId]) return _taskCache[projectId]
  try {
    const data = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects/${projectId}/tasks?status=ACTIVE`, 100)
    const tasks = data.map(t => ({ id: t.id, name: t.name, project_id: projectId }))
    _taskCache[projectId] = tasks
    return tasks
  } catch {
    return []
  }
}

/** Start a running timer in Clockify. Returns the new entry object. */
export async function clockifyStartTimer({ description, projectId, taskId }) {
  const body = {
    start: new Date().toISOString(),
    description: description || '',
    ...(projectId && { projectId }),
    ...(taskId    && { taskId }),
    billable: true,
  }
  const res = await fetch(`${BASE}/workspaces/${WORKSPACE_ID}/time-entries`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Clockify start error ${res.status}`)
  return res.json()
}

/** Stop the currently running timer. Returns the updated entry. */
export async function clockifyStopTimer(userId) {
  const body = { end: new Date().toISOString() }
  const res = await fetch(`${BASE}/workspaces/${WORKSPACE_ID}/user/${userId}/time-entries`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Clockify stop error ${res.status}`)
  return res.json()
}

/** Create a complete manual time entry. Returns the new entry. */
export async function clockifyCreateEntry({ description, projectId, taskId, start, end }) {
  const body = {
    start: new Date(start).toISOString(),
    end:   new Date(end).toISOString(),
    description: description || '',
    ...(projectId && { projectId }),
    ...(taskId    && { taskId }),
    billable: true,
  }
  const res = await fetch(`${BASE}/workspaces/${WORKSPACE_ID}/time-entries`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Clockify create error ${res.status}`)
  return res.json()
}

/** Delete a time entry by its Clockify ID. */
export async function clockifyDeleteEntry(entryId) {
  const res = await fetch(`${BASE}/workspaces/${WORKSPACE_ID}/time-entries/${entryId}`, {
    method: 'DELETE',
    headers: h,
  })
  if (!res.ok) throw new Error(`Clockify delete error ${res.status}`)
}

/** Get the Clockify userId for victorgarcia@xul.es */
export function getClockifyUserId() {
  return CLOCKIFY_USER_ID
}

// ── Load from cache ──────────────────────────────────────────
export function loadClockifyCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearClockifyCache() {
  localStorage.removeItem(CACHE_KEY)
}

export { WORKSPACE_ID }
