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
    access: p.public ? 'PUBLIC' : 'PRIVATE',
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

/**
 * Import data from Clockify.
 * @param {function} onStatus  - Progress callback (msg, pct)
 * @param {string|null} since  - ISO date string; if provided, only fetches entries
 *                               created after this date (incremental update).
 *                               Pass null for a full re-import.
 */
export async function importFromClockify(onStatus, since = null) {
  const isIncremental = !!since
  const existingCache = isIncremental ? loadClockifyCache() : null

  if (!isIncremental) localStorage.removeItem(CACHE_KEY)

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

  // Fetch user groups to show which team/department each member belongs to
  let userGroupMap = {}
  let groups = []
  try {
    const rawGroups = await fetchAll(`/workspaces/${WORKSPACE_ID}/user-groups`, 100)
    rawGroups.forEach(g => {
      ;(g.userIds || []).forEach(uid => { userGroupMap[uid] = g.name })
    })
    groups = rawGroups.map(g => ({
      id:          g.id,
      name:        g.name,
      user_ids:    JSON.stringify(g.userIds || []),
      manager_ids: JSON.stringify(g.managerIds || []),
    }))
  } catch { /* groups optional */ }

  const members = rawUsers.map(u => ({
    id: u.id,
    workspace_id: WORKSPACE_ID,
    user_id: u.id,
    role: u.roles?.[0]?.role === 'WORKSPACE_ADMIN' ? 'admin' : 'employee',
    group_name: userGroupMap[u.id] || null,
    profiles: {
      full_name: u.name || '',
      email: u.email || '',
      job_title: '',
      hourly_rate: 0,
    },
  }))

  const sinceLabel = isIncremental
    ? new Date(since).toLocaleDateString('es-ES')
    : null
  onStatus(
    isIncremental
      ? `Buscando entradas nuevas desde ${sinceLabel}…`
      : 'Importando entradas de tiempo…',
    35,
  )
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  // Fetch entries for ALL workspace users (filtered by since if incremental)
  const newEntriesForNeon = []

  // Build the date filter query param for incremental
  // Clockify expects ISO8601: start=2024-01-01T00:00:00Z
  // We subtract 1 minute from `since` as a safety buffer for clock skew
  const sinceQuery = isIncremental
    ? `?start=${new Date(new Date(since).getTime() - 60_000).toISOString()}`
    : ''

  for (let i = 0; i < rawUsers.length; i++) {
    const u = rawUsers[i]
    const pct = Math.round(35 + ((i / rawUsers.length) * 45))
    onStatus(
      isIncremental
        ? `Actualizando ${u.name || u.email}… (${i + 1}/${rawUsers.length})`
        : `Importando entradas de ${u.name || u.email}… (${i + 1}/${rawUsers.length})`,
      pct,
    )
    try {
      const userRaw = await fetchAll(
        `/workspaces/${WORKSPACE_ID}/user/${u.id}/time-entries${sinceQuery}`, 50
      )
      for (const e of userRaw) {
        const entry = mapEntry(e)
        const proj = entry.project_id ? projectMap[entry.project_id] : null
        newEntriesForNeon.push({
          ...entry,
          user_email: u.email,
          project_name: proj?.name || null,
          project_color: proj?.color || null,
          client_name: proj?.clients?.name || null,
        })
      }
    } catch (err) {
      console.warn(`Error fetching entries for ${u.email}:`, err.message)
    }
  }

  // For cache: merge Victor's new entries with existing cached entries
  const newVictorEntries = newEntriesForNeon
    .filter(e => e.user_email === CLOCKIFY_OWNER_EMAIL)
    .map(e => {
      const proj = e.project_id ? projectMap[e.project_id] : null
      return {
        ...e,
        projects: proj ? { name: proj.name, color: proj.color, clients: proj.clients } : null,
      }
    })

  let entries
  if (isIncremental && existingCache?.entries?.length) {
    // Merge: keep existing, upsert new ones (replace by id if already exists)
    const newIds = new Set(newVictorEntries.map(e => e.id))
    const kept = existingCache.entries.filter(e => !newIds.has(e.id))
    entries = [...newVictorEntries, ...kept]
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
  } else {
    entries = newVictorEntries
  }

  // allEntriesForNeon = only new/changed entries (Neon handles upserts)
  const allEntriesForNeon = newEntriesForNeon

  onStatus('Guardando en caché…', 90)
  const cache = { ws, clients, projects, members, entries, importedAt: new Date().toISOString() }

  // localStorage has ~5MB limit — try full save, fall back to without descriptions
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('localStorage full, storing compact version:', e)
    const compact = {
      ...cache,
      entries: entries.map(({ description, ...rest }) => rest),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(compact))
  }

  onStatus('¡Importación completada!', 100)
  return { ...cache, allEntriesForNeon, isIncremental, newCount: newEntriesForNeon.length, groups }
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

/** Fetch ALL tasks across ALL projects in the workspace */
export async function clockifyGetAllTasks(projects) {
  const all = []
  for (const p of (projects || [])) {
    try {
      const active   = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects/${p.id}/tasks?status=ACTIVE`, 100)
      const done     = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects/${p.id}/tasks?status=DONE`, 100)
      const combined = [...active, ...done]
      for (const t of combined) {
        all.push({
          id:         t.id,
          project_id: p.id,
          name:       t.name,
          status:     t.status === 'DONE' ? 'DONE' : 'ACTIVE',
          estimate:   t.estimate ? Math.round(t.estimate / 3600) : null,
          archived:   t.archived || false,
        })
      }
      await new Promise(r => setTimeout(r, 60)) // rate-limit buffer
    } catch { /* skip failed projects */ }
  }
  return all
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

// ── Tags ─────────────────────────────────────────────────────
export async function clockifyGetTags() {
  try {
    const data = await fetchAll(`/workspaces/${WORKSPACE_ID}/tags`, 100)
    return data.map(t => ({ id: t.id, name: t.name, archived: t.archived || false }))
  } catch (err) {
    console.warn('Tags fetch error:', err.message)
    return []
  }
}

// ── Time Off ──────────────────────────────────────────────────
export async function clockifyGetTimeOffPolicies() {
  try {
    const data = await get(`/workspaces/${WORKSPACE_ID}/time-off/policies`)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('Time off policies fetch error:', err.message)
    return []
  }
}

export async function clockifyGetTimeOffRequests(users) {
  try {
    const emailMap = Object.fromEntries((users || []).map(u => [u.id, { email: u.email, name: u.name }]))
    const data = await fetchAll(`/workspaces/${WORKSPACE_ID}/time-off/requests?status=ALL`, 50)
    return data.map(r => ({
      id: r.id,
      user_email: emailMap[r.userId]?.email || null,
      user_name: emailMap[r.userId]?.name || null,
      policy_id: r.timeOffPolicyId || null,
      policy_name: r.policyName || null,
      status: r.status || 'PENDING',
      start_date: r.timeOffPeriod?.period?.start?.split('T')[0] || r.startDate || null,
      end_date: r.timeOffPeriod?.period?.end?.split('T')[0] || r.endDate || null,
      note: r.note || null,
    }))
  } catch (err) {
    console.warn('Time off requests fetch error:', err.message)
    return []
  }
}

export { WORKSPACE_ID }
