// ── Neon PostgreSQL client ───────────────────────────────────
import { neon } from '@neondatabase/serverless'

const CONNECTION = import.meta.env.VITE_NEON_URL

let _sql = null
export function sql() {
  if (!_sql) _sql = neon(CONNECTION)
  return _sql
}

/**
 * Neon's HTTP driver returns TIMESTAMPTZ columns as JS Date objects.
 * All our UI code (date-fns parseISO, format, etc.) expects ISO strings.
 * This helper normalises any Date object to an ISO string; passes strings through.
 */
function toISO(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/** Normalise all timestamp fields in a time_entries row */
function normEntry(r) {
  return {
    ...r,
    start_time: toISO(r.start_time),
    end_time:   toISO(r.end_time),
    created_at: toISO(r.created_at),
  }
}

// ── Bootstrap: create tables if they don't exist ─────────────
let _initialized = false
export async function initDB() {
  if (_initialized) return
  _initialized = true
  const db = sql()

  await db`
    CREATE TABLE IF NOT EXISTS workspaces (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name        TEXT NOT NULL DEFAULT 'XUL',
      slug        TEXT UNIQUE DEFAULT 'xul',
      working_hours_per_day INTEGER DEFAULT 8,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_email      TEXT NOT NULL,
      user_name       TEXT NOT NULL DEFAULT '',
      role            TEXT DEFAULT 'employee',
      hourly_rate     NUMERIC DEFAULT 0,
      password        TEXT DEFAULT 'Mytrack14$',
      clockify_user_id TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(workspace_id, user_email)
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS time_entries (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      user_email    TEXT NOT NULL,
      project_id    TEXT,
      project_name  TEXT,
      project_color TEXT,
      client_name   TEXT,
      task_id       TEXT,
      task_name     TEXT,
      description   TEXT DEFAULT '',
      start_time    TIMESTAMPTZ NOT NULL,
      end_time      TIMESTAMPTZ,
      duration      INTEGER,
      billable      BOOLEAN DEFAULT false,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await db`
    CREATE TABLE IF NOT EXISTS clients (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      name         TEXT NOT NULL,
      email        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS projects (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      name         TEXT NOT NULL,
      color        TEXT DEFAULT '#7C4DFF',
      client_id    TEXT,
      client_name  TEXT,
      budget_hours INTEGER,
      archived     BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS groups (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      name         TEXT NOT NULL,
      user_ids     TEXT DEFAULT '[]',
      manager_ids  TEXT DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS tasks (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      project_id   TEXT NOT NULL,
      name         TEXT NOT NULL,
      status       TEXT DEFAULT 'ACTIVE',
      estimate     INTEGER,
      archived     BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS tags (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      name         TEXT NOT NULL,
      archived     BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS time_off_policies (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      name         TEXT NOT NULL,
      color        TEXT DEFAULT '#7C4DFF',
      days_per_year NUMERIC,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS time_off_requests (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      user_email   TEXT,
      user_name    TEXT,
      policy_id    TEXT,
      policy_name  TEXT,
      status       TEXT DEFAULT 'PENDING',
      start_date   DATE,
      end_date     DATE,
      note         TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await db`
    CREATE TABLE IF NOT EXISTS sticky_notes (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      author_email TEXT NOT NULL,
      author_name  TEXT DEFAULT '',
      slot         INTEGER NOT NULL DEFAULT 0,
      content      TEXT DEFAULT '',
      shared_with  TEXT DEFAULT '[]',
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(author_email, slot)
    )
  `

  await db`
    CREATE TABLE IF NOT EXISTS notifications (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      user_id      TEXT NOT NULL,
      sender_email TEXT DEFAULT '',
      sender_name  TEXT DEFAULT '',
      type         TEXT DEFAULT 'default',
      title        TEXT NOT NULL,
      message      TEXT DEFAULT '',
      read         BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await db`
    CREATE TABLE IF NOT EXISTS hour_compensations (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT DEFAULT 'xul-ws-1',
      user_email   TEXT NOT NULL,
      week_start   TEXT NOT NULL,
      comp_hours   NUMERIC NOT NULL,
      notes        TEXT DEFAULT '',
      created_by   TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Migrate existing tables (safe to run repeatedly)
  await db`ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS group_name TEXT`
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS access TEXT DEFAULT 'PRIVATE'`
  await db`ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`


  // Seed workspace
  await db`
    INSERT INTO workspaces (id, name, slug, working_hours_per_day)
    VALUES ('xul-ws-1', 'XUL', 'xul', 8)
    ON CONFLICT (slug) DO NOTHING
  `

  // Seed all workspace users so they can log in before the first Clockify import
  const seedUsers = [
    { email: 'victorgarcia@xul.es',           name: 'Víctor García',                 role: 'admin'    },
    { email: 'carlagarcia@xul.es',             name: 'Carla García',                  role: 'admin'    },
    { email: 'josecastillo@xul.es',            name: 'José Castillo',                 role: 'admin'    },
    { email: 'aidacisneros@xul.es',            name: 'Aida Cisneros',                 role: 'employee' },
    { email: 'aitorrecalde@xul.es',            name: 'Aitor RV',                      role: 'employee' },
    { email: 'alejandraperea@xul.es',          name: 'Alejandra Perea',               role: 'employee' },
    { email: 'anarojas@fundacionxul.org',      name: 'Ana Rojas',                     role: 'employee' },
    { email: 'andreabenitez@xul.es',           name: 'Andrea Benítez',                role: 'employee' },
    { email: 'asuncionblanco@xul.es',          name: 'Asunción Blanco',               role: 'employee' },
    { email: 'auximazuecos@xul.es',            name: 'Auxi Mazuecos',                 role: 'employee' },
    { email: 'cristinafernandez@xul.es',       name: 'Cristina Fernández',            role: 'employee' },
    { email: 'cristinareyes@fundacionxul.org', name: 'Cristina Reyes Baro',           role: 'employee' },
    { email: 'elenarojo@xul.es',               name: 'Elena Rojo',                    role: 'employee' },
    { email: 'inmaosuna@xul.es',               name: 'Inma Osuna',                    role: 'employee' },
    { email: 'irenezurita@xul.es',             name: 'Irene Zurita',                  role: 'employee' },
    { email: 'javier@xul.es',                  name: 'Javier Ramírez',                role: 'employee' },
    { email: 'javierdura@xul.es',              name: 'Javier Durá',                   role: 'employee' },
    { email: 'jorgemelo@xul.es',               name: 'Jorge Melo',                    role: 'employee' },
    { email: 'joseluisacedo@xul.es',           name: 'José Luis Acedo',               role: 'employee' },
    { email: 'josemitoribio@xul.es',           name: 'Josemi Toribio',                role: 'employee' },
    { email: 'lolagravan@xul.es',              name: 'Lola Graván',                   role: 'employee' },
    { email: 'mariohurtado@xul.es',            name: 'Mario Hurtado',                 role: 'employee' },
    { email: 'mariopulido@xul.es',             name: 'Mario Pulido',                  role: 'employee' },
    { email: 'martagarcia@xul.es',             name: 'Marta García',                  role: 'employee' },
    { email: 'miguelperez@xul.es',             name: 'Miguel Pérez',                  role: 'employee' },
    { email: 'olgaalba@xul.es',                name: 'Olga Alba Fernández',           role: 'employee' },
    { email: 'pablohernandez@xul.es',          name: 'Pablo Hernández García Tapial', role: 'employee' },
    { email: 'pepegomez@xul.es',               name: 'Pepe Gómez Palas',              role: 'employee' },
    { email: 'pilarsalles@xul.es',             name: 'Pilar Sallés',                  role: 'employee' },
    { email: 'rociohernandez@xul.es',          name: 'Rocío Hernández',               role: 'employee' },
    { email: 'sandravinas@xul.es',             name: 'Sandra Viñas',                  role: 'employee' },
    { email: 'saracliment@xul.es',             name: 'Sara Climent',                  role: 'employee' },
    { email: 'saramoran@xul.es',               name: 'Sara Morán',                    role: 'employee' },
    { email: 'sarasanchez@xul.es',             name: 'Sara Sánchez',                  role: 'employee' },
    { email: 'silviamunoz@xul.es',             name: 'Silvia Muñoz',                  role: 'employee' },
  ]
  for (const u of seedUsers) {
    await db`
      INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password)
      VALUES ('xul-ws-1', ${u.email}, ${u.name}, ${u.role}, 'Mytrack14$')
      ON CONFLICT (workspace_id, user_email) DO NOTHING
    `
  }
}

// ── Auth ──────────────────────────────────────────────────────

export async function dbSignIn(email, password) {
  const db = sql()
  const rows = await db`
    SELECT * FROM workspace_members
    WHERE workspace_id = 'xul-ws-1'
      AND user_email = ${email}
      AND password = ${password}
    LIMIT 1
  `
  return rows[0] || null
}

// ── Notifications ─────────────────────────────────────────────
export async function dbGetNotifications(userId) {
  const db = sql()
  return db`
    SELECT * FROM notifications
    WHERE user_id = ${userId} AND workspace_id = 'xul-ws-1'
    ORDER BY created_at DESC
    LIMIT 50
  `
}

export async function dbSendNotification({ senderEmail, senderName, recipientIds, type, title, message }) {
  const db = sql()
  // Insert one row per recipient
  for (const userId of recipientIds) {
    await db`
      INSERT INTO notifications (workspace_id, user_id, sender_email, sender_name, type, title, message)
      VALUES ('xul-ws-1', ${userId}, ${senderEmail}, ${senderName}, ${type || 'default'}, ${title}, ${message || ''})
    `
  }
}

export async function dbMarkNotificationRead(id) {
  const db = sql()
  await db`UPDATE notifications SET read = true WHERE id = ${id}`
}

export async function dbMarkAllNotificationsRead(userId) {
  const db = sql()
  await db`UPDATE notifications SET read = true WHERE user_id = ${userId} AND workspace_id = 'xul-ws-1'`
}

export async function dbGetAllMembers() {
  const db = sql()
  return db`
    SELECT * FROM workspace_members
    WHERE workspace_id = 'xul-ws-1'
    ORDER BY user_name
  `
}

// ── Time entries ──────────────────────────────────────────────

export async function dbGetEntries(userEmail, year) {
  const db = sql()
  const rows = await db`
    SELECT * FROM time_entries
    WHERE user_email = ${userEmail}
      AND end_time IS NOT NULL
      AND EXTRACT(YEAR FROM start_time) = ${year}
    ORDER BY start_time DESC
  `
  return rows.map(normEntry)
}

/** All workspace entries in a date range (for Reports page) */
export async function dbGetEntriesForPeriod(from, to) {
  const db = sql()
  const rows = await db`
    SELECT * FROM time_entries
    WHERE workspace_id = 'xul-ws-1'
      AND end_time IS NOT NULL
      AND start_time >= ${from.toISOString()}
      AND start_time <= ${to.toISOString()}
    ORDER BY start_time DESC
  `
  return rows.map(normEntry)
}

export async function dbInsertEntry({
  id, userEmail, workspaceId,
  projectId, projectName, projectColor, clientName,
  taskId, taskName, description,
  startTime, endTime, duration, billable,
}) {
  const db = sql()
  const entryId = id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO time_entries
      (id, workspace_id, user_email, project_id, project_name, project_color, client_name,
       task_id, task_name, description, start_time, end_time, duration, billable)
    VALUES
      (${entryId}, ${workspaceId || 'xul-ws-1'}, ${userEmail},
       ${projectId || null}, ${projectName || null}, ${projectColor || null}, ${clientName || null},
       ${taskId || null}, ${taskName || null}, ${description || ''},
       ${startTime}, ${endTime || null}, ${duration || null}, ${billable || false})
    ON CONFLICT (id) DO UPDATE SET
      description   = EXCLUDED.description,
      project_id    = EXCLUDED.project_id,
      project_name  = EXCLUDED.project_name,
      project_color = EXCLUDED.project_color,
      client_name   = EXCLUDED.client_name,
      task_id       = EXCLUDED.task_id,
      task_name     = EXCLUDED.task_name,
      start_time    = EXCLUDED.start_time,
      end_time      = EXCLUDED.end_time,
      duration      = EXCLUDED.duration
    RETURNING *
  `
  return rows[0] ? normEntry(rows[0]) : null
}

/** Bulk upsert — inserts entries in batches of 50 */
export async function dbUpsertEntries(entries, onProgress) {
  const db = sql()
  const BATCH = 50
  let done = 0
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    for (const e of batch) {
      await db`
        INSERT INTO time_entries
          (id, workspace_id, user_email, project_id, project_name, project_color, client_name,
           task_id, task_name, description, start_time, end_time, duration, billable)
        VALUES
          (${e.id}, 'xul-ws-1', ${e.user_email},
           ${e.project_id || null}, ${e.project_name || null},
           ${e.project_color || null}, ${e.client_name || null},
           ${e.task_id || null}, ${e.task_name || null},
           ${e.description || ''}, ${e.start_time}, ${e.end_time || null},
           ${e.duration || null}, ${e.billable || false})
        ON CONFLICT (id) DO UPDATE SET
          description   = EXCLUDED.description,
          project_name  = EXCLUDED.project_name,
          project_color = EXCLUDED.project_color,
          client_name   = EXCLUDED.client_name,
          task_name     = EXCLUDED.task_name,
          start_time    = EXCLUDED.start_time,
          end_time      = EXCLUDED.end_time,
          duration      = EXCLUDED.duration
      `
    }
    done += batch.length
    onProgress?.(done, entries.length)
  }
}

export async function dbDeleteEntry(id) {
  const db = sql()
  await db`DELETE FROM time_entries WHERE id = ${id}`
}

// ── Members ───────────────────────────────────────────────────

export async function dbChangePassword(userEmail, newPassword) {
  const db = sql()
  await db`
    UPDATE workspace_members
    SET password = ${newPassword}
    WHERE workspace_id = 'xul-ws-1' AND user_email = ${userEmail}
  `
}

export async function dbGetAvailableYears(userEmail) {
  const db = sql()
  const rows = await db`
    SELECT DISTINCT EXTRACT(YEAR FROM start_time)::int AS year
    FROM time_entries
    WHERE user_email = ${userEmail}
      AND end_time IS NOT NULL
    ORDER BY year DESC
  `
  return rows.map(r => r.year)
}

// ── Projects & Clients ────────────────────────────────────────

export async function dbGetProjects() {
  const db = sql()
  return db`SELECT * FROM projects WHERE workspace_id = 'xul-ws-1' AND archived = false ORDER BY name`
}

export async function dbGetProjectsWithHours() {
  const db = sql()
  return db`
    SELECT p.*,
           COALESCE(SUM(te.duration), 0)::bigint AS total_seconds,
           COUNT(DISTINCT te.user_email)::int     AS member_count
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    WHERE p.workspace_id = 'xul-ws-1' AND p.archived = false
    GROUP BY p.id
    ORDER BY p.name
  `
}

export async function dbGetAllProjectsWithHours() {
  const db = sql()
  return db`
    SELECT p.*,
           COALESCE(SUM(te.duration), 0)::bigint AS total_seconds,
           COUNT(DISTINCT te.user_email)::int     AS member_count
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    WHERE p.workspace_id = 'xul-ws-1'
    GROUP BY p.id
    ORDER BY p.archived ASC, p.name ASC
  `
}

export async function dbGetClients() {
  const db = sql()
  return db`SELECT * FROM clients WHERE workspace_id = 'xul-ws-1' ORDER BY name`
}

// ── Groups ────────────────────────────────────────────────────

export async function dbGetGroups() {
  const db = sql()
  return db`SELECT * FROM groups WHERE workspace_id = 'xul-ws-1' ORDER BY name`
}

export async function dbUpsertGroups(groups) {
  const db = sql()
  for (const g of groups) {
    await db`
      INSERT INTO groups (id, workspace_id, name, user_ids, manager_ids)
      VALUES (${g.id}, 'xul-ws-1', ${g.name},
              ${g.user_ids || '[]'}, ${g.manager_ids || '[]'})
      ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        user_ids    = EXCLUDED.user_ids,
        manager_ids = EXCLUDED.manager_ids
    `
  }
}

// ── Tasks ──────────────────────────────────────────────────────

export async function dbGetTasksForProject(projectId) {
  const db = sql()
  return db`
    SELECT * FROM tasks
    WHERE project_id = ${projectId} AND archived = false
    ORDER BY created_at ASC
  `
}

export async function dbGetAllTasks() {
  const db = sql()
  return db`
    SELECT * FROM tasks
    WHERE workspace_id = 'xul-ws-1' AND archived = false
    ORDER BY project_id, created_at ASC
  `
}

export async function dbUpsertTasks(tasks) {
  const db = sql()
  for (const t of tasks) {
    await db`
      INSERT INTO tasks (id, workspace_id, project_id, name, status, estimate, archived)
      VALUES (${t.id}, 'xul-ws-1', ${t.project_id}, ${t.name},
              ${t.status || 'ACTIVE'}, ${t.estimate || null}, ${t.archived || false})
      ON CONFLICT (id) DO UPDATE SET
        name     = EXCLUDED.name,
        status   = EXCLUDED.status,
        estimate = EXCLUDED.estimate,
        archived = EXCLUDED.archived
    `
  }
}

export async function dbCreateTask({ projectId, name, estimate }) {
  const db = sql()
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO tasks (id, workspace_id, project_id, name, status, estimate)
    VALUES (${id}, 'xul-ws-1', ${projectId}, ${name}, 'ACTIVE', ${estimate || null})
    RETURNING *
  `
  return rows[0]
}

export async function dbDeleteTask(id) {
  const db = sql()
  await db`DELETE FROM tasks WHERE id = ${id}`
}

export async function dbToggleTaskStatus(id, status) {
  const db = sql()
  await db`UPDATE tasks SET status = ${status} WHERE id = ${id}`
}

export async function dbCreateProject({ name, color, clientId, clientName, budgetHours }) {
  const db = sql()
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO projects (id, workspace_id, name, color, client_id, client_name, budget_hours, archived, access)
    VALUES (${id}, 'xul-ws-1', ${name}, ${color || '#7C4DFF'},
            ${clientId || null}, ${clientName || null}, ${budgetHours || null}, false, 'PRIVATE')
    RETURNING *
  `
  return rows[0]
}

export async function dbDeleteProject(id) {
  const db = sql()
  await db`DELETE FROM projects WHERE id = ${id}`
}

export async function dbUpdateProject({ id, name, color, clientId, clientName, budgetHours }) {
  const db = sql()
  const rows = await db`
    UPDATE projects SET
      name         = ${name},
      color        = ${color || '#7C4DFF'},
      client_id    = ${clientId || null},
      client_name  = ${clientName || null},
      budget_hours = ${budgetHours || null}
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0]
}

export async function dbArchiveProject(id, archived) {
  const db = sql()
  await db`UPDATE projects SET archived = ${archived} WHERE id = ${id}`
}

export async function dbCreateClient({ name, email }) {
  const db = sql()
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO clients (id, workspace_id, name, email)
    VALUES (${id}, 'xul-ws-1', ${name}, ${email || null})
    RETURNING *
  `
  return rows[0]
}

export async function dbDeleteClient(id) {
  const db = sql()
  await db`DELETE FROM clients WHERE id = ${id}`
}

export async function dbUpdateClient({ id, name, email }) {
  const db = sql()
  const rows = await db`
    UPDATE clients SET name = ${name}, email = ${email || null}
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0]
}

export async function dbArchiveClient(id, archived) {
  const db = sql()
  await db`UPDATE clients SET archived = ${archived} WHERE id = ${id}`
}

export async function dbCreateTag({ name }) {
  const db = sql()
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO tags (id, workspace_id, name, archived)
    VALUES (${id}, 'xul-ws-1', ${name}, false)
    RETURNING *
  `
  return rows[0]
}

export async function dbDeleteTag(id) {
  const db = sql()
  await db`DELETE FROM tags WHERE id = ${id}`
}

export async function dbUpdateTag(id, name) {
  const db = sql()
  const rows = await db`
    UPDATE tags SET name = ${name} WHERE id = ${id} RETURNING *
  `
  return rows[0]
}

export async function dbCreateTimeOffRequest({ userEmail, userName, policyId, policyName, startDate, endDate, note }) {
  const db = sql()
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rows = await db`
    INSERT INTO time_off_requests
      (id, workspace_id, user_email, user_name, policy_id, policy_name, status, start_date, end_date, note)
    VALUES
      (${id}, 'xul-ws-1', ${userEmail || null}, ${userName || null},
       ${policyId || null}, ${policyName || null}, 'PENDING',
       ${startDate}, ${endDate}, ${note || null})
    RETURNING *
  `
  return rows[0]
}

export async function dbUpsertProjects(projects) {
  const db = sql()
  for (const p of projects) {
    await db`
      INSERT INTO projects (id, workspace_id, name, color, client_id, client_name, budget_hours, archived, access)
      VALUES (${p.id}, 'xul-ws-1', ${p.name}, ${p.color || '#7C4DFF'},
              ${p.client_id || null}, ${p.clients?.name || null},
              ${p.budget_hours || null}, ${p.archived || false}, ${p.access || 'PRIVATE'})
      ON CONFLICT (id) DO UPDATE SET
        name         = EXCLUDED.name,
        color        = EXCLUDED.color,
        client_id    = EXCLUDED.client_id,
        client_name  = EXCLUDED.client_name,
        budget_hours = EXCLUDED.budget_hours,
        archived     = EXCLUDED.archived,
        access       = EXCLUDED.access
    `
  }
}

// ── Sticky notes ──────────────────────────────────────────────

export async function dbGetMyNotes(userEmail) {
  const db = sql()
  const rows = await db`
    SELECT * FROM sticky_notes
    WHERE author_email = ${userEmail}
    ORDER BY slot ASC
  `
  // Always return 3 slots
  const bySlot = {}
  rows.forEach(r => { bySlot[r.slot] = r })
  return [0, 1, 2].map(slot => bySlot[slot] || {
    id: null, slot, content: '', shared_with: '[]',
    author_email: userEmail, author_name: '',
  })
}

export async function dbSaveNote({ userEmail, authorName, slot, content }) {
  const db = sql()
  // Try UPDATE first (works even if UNIQUE constraint is missing)
  const updated = await db`
    UPDATE sticky_notes
    SET content = ${content}, author_name = ${authorName || ''}, updated_at = NOW()
    WHERE author_email = ${userEmail} AND slot = ${slot}
    RETURNING *
  `
  if (updated.length > 0) return updated[0]

  // No existing row — insert new
  const rows = await db`
    INSERT INTO sticky_notes (workspace_id, author_email, author_name, slot, content, updated_at)
    VALUES ('xul-ws-1', ${userEmail}, ${authorName || ''}, ${slot}, ${content}, NOW())
    ON CONFLICT (author_email, slot) DO UPDATE SET
      content     = EXCLUDED.content,
      author_name = EXCLUDED.author_name,
      updated_at  = NOW()
    RETURNING *
  `
  return rows[0]
}

export async function dbShareNote(id, sharedWith) {
  const db = sql()
  await db`
    UPDATE sticky_notes
    SET shared_with = ${JSON.stringify(sharedWith)}, updated_at = NOW()
    WHERE id = ${id}
  `
}

export async function dbDeleteNote(noteId) {
  const db = sql()
  await db`DELETE FROM sticky_notes WHERE id = ${noteId}`
}

export async function dbGetSharedNotes(userEmail) {
  const db = sql()
  const rows = await db`
    SELECT * FROM sticky_notes
    WHERE author_email != ${userEmail}
      AND workspace_id = 'xul-ws-1'
      AND content != ''
      AND (shared_with::text LIKE ${'%"all"%'}
           OR shared_with::text LIKE ${'%' + userEmail + '%'})
    ORDER BY updated_at DESC
  `
  return rows
}

export async function dbUpdateNoteContent(noteId, content) {
  const db = sql()
  const rows = await db`
    UPDATE sticky_notes SET content = ${content}, updated_at = NOW()
    WHERE id = ${noteId} RETURNING *
  `
  return rows[0]
}

export async function dbUnshareNote(noteId, userEmail) {
  const db = sql()
  const rows = await db`SELECT shared_with FROM sticky_notes WHERE id = ${noteId}`
  if (!rows[0]) return
  let sw = []
  try { sw = JSON.parse(rows[0].shared_with || '[]') } catch {}
  sw = sw.filter(e => e !== userEmail)
  await db`UPDATE sticky_notes SET shared_with = ${JSON.stringify(sw)}, updated_at = NOW() WHERE id = ${noteId}`
}

export async function dbToggleReaction(noteId, userEmail, userName, emoji) {
  const db = sql()
  const rows = await db`SELECT reactions FROM sticky_notes WHERE id = ${noteId}`
  if (!rows[0]) return []
  let reactions = []
  try { reactions = JSON.parse(rows[0].reactions || '[]') } catch {}
  const exists = reactions.find(r => r.email === userEmail && r.emoji === emoji)
  if (exists) {
    reactions = reactions.filter(r => !(r.email === userEmail && r.emoji === emoji))
  } else {
    reactions.push({ email: userEmail, name: userName, emoji })
  }
  await db`UPDATE sticky_notes SET reactions = ${JSON.stringify(reactions)} WHERE id = ${noteId}`
  return reactions
}

// Ensure reactions column exists (run once per session)
let _reactionsReady = false
export async function ensureReactionsColumn() {
  if (_reactionsReady) return
  _reactionsReady = true
  try {
    await sql()`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS reactions TEXT DEFAULT '[]'`
  } catch {}
}

export async function dbUpsertClients(clients) {
  const db = sql()
  for (const c of clients) {
    await db`
      INSERT INTO clients (id, workspace_id, name, email)
      VALUES (${c.id}, 'xul-ws-1', ${c.name}, ${c.email || null})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `
  }
}

export async function dbUpsertMember({ userEmail, userName, role, clockifyUserId, groupName }) {
  const db = sql()
  await db`
    INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password, clockify_user_id, group_name)
    VALUES ('xul-ws-1', ${userEmail}, ${userName}, ${role || 'employee'}, 'Mytrack14$', ${clockifyUserId || null}, ${groupName || null})
    ON CONFLICT (workspace_id, user_email) DO UPDATE SET
      user_name        = EXCLUDED.user_name,
      -- Protect manually-promoted admins: only upgrade role (employee→admin), never downgrade
      role             = CASE
                           WHEN workspace_members.role = 'admin' THEN 'admin'
                           ELSE EXCLUDED.role
                         END,
      clockify_user_id = EXCLUDED.clockify_user_id,
      group_name       = EXCLUDED.group_name
  `
}

// ── Tags ──────────────────────────────────────────────────────

export async function dbGetTags() {
  const db = sql()
  return db`SELECT * FROM tags WHERE workspace_id = 'xul-ws-1' AND archived = false ORDER BY name`
}

export async function dbUpsertTags(tags) {
  const db = sql()
  for (const t of tags) {
    await db`
      INSERT INTO tags (id, workspace_id, name, archived)
      VALUES (${t.id}, 'xul-ws-1', ${t.name}, ${t.archived || false})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, archived = EXCLUDED.archived
    `
  }
}

// ── Time Off ──────────────────────────────────────────────────

export async function dbGetTimeOffPolicies() {
  const db = sql()
  return db`SELECT * FROM time_off_policies WHERE workspace_id = 'xul-ws-1' ORDER BY name`
}

export async function dbUpsertTimeOffPolicies(policies) {
  const db = sql()
  for (const p of policies) {
    await db`
      INSERT INTO time_off_policies (id, workspace_id, name, color, days_per_year)
      VALUES (${p.id}, 'xul-ws-1', ${p.name}, ${p.color || '#7C4DFF'}, ${p.daysPerYear || null})
      ON CONFLICT (id) DO UPDATE SET
        name         = EXCLUDED.name,
        color        = EXCLUDED.color,
        days_per_year = EXCLUDED.days_per_year
    `
  }
}

export async function dbGetTimeOffRequests() {
  const db = sql()
  return db`
    SELECT * FROM time_off_requests
    WHERE workspace_id = 'xul-ws-1'
    ORDER BY start_date DESC
  `
}

export async function dbUpsertTimeOffRequests(requests) {
  const db = sql()
  for (const r of requests) {
    await db`
      INSERT INTO time_off_requests
        (id, workspace_id, user_email, user_name, policy_id, policy_name, status, start_date, end_date, note)
      VALUES
        (${r.id}, 'xul-ws-1', ${r.user_email || null}, ${r.user_name || null},
         ${r.policy_id || null}, ${r.policy_name || null}, ${r.status || 'PENDING'},
         ${r.start_date || null}, ${r.end_date || null}, ${r.note || null})
      ON CONFLICT (id) DO UPDATE SET
        status      = EXCLUDED.status,
        user_email  = EXCLUDED.user_email,
        user_name   = EXCLUDED.user_name,
        policy_name = EXCLUDED.policy_name,
        start_date  = EXCLUDED.start_date,
        end_date    = EXCLUDED.end_date,
        note        = EXCLUDED.note
    `
  }
}

// ── Hour Compensations ────────────────────────────────────────

/** Get all compensation entries for a user (or all users if email omitted) */
export async function dbGetCompensations(userEmail) {
  const db = sql()
  if (userEmail) {
    return db`
      SELECT * FROM hour_compensations
      WHERE workspace_id = 'xul-ws-1' AND user_email = ${userEmail}
      ORDER BY week_start DESC
    `
  }
  return db`
    SELECT * FROM hour_compensations
    WHERE workspace_id = 'xul-ws-1'
    ORDER BY week_start DESC, user_email
  `
}

/** Add a compensation entry */
export async function dbAddCompensation({ userEmail, weekStart, compHours, notes, createdBy }) {
  const db = sql()
  const rows = await db`
    INSERT INTO hour_compensations (workspace_id, user_email, week_start, comp_hours, notes, created_by)
    VALUES ('xul-ws-1', ${userEmail}, ${weekStart}, ${compHours}, ${notes || ''}, ${createdBy || ''})
    RETURNING *
  `
  return rows[0]
}

/** Delete a compensation entry */
export async function dbDeleteCompensation(id) {
  const db = sql()
  await db`DELETE FROM hour_compensations WHERE id = ${id}`
}

/** Get weekly hours per user from time_entries */
export async function dbGetWeeklyHours(userEmail, fromDate, toDate) {
  const db = sql()
  const where = userEmail
    ? db`AND user_email = ${userEmail}`
    : db``
  return db`
    SELECT
      user_email,
      DATE_TRUNC('week', start_time AT TIME ZONE 'Europe/Madrid')::date AS week_start,
      SUM(duration) AS total_seconds
    FROM time_entries
    WHERE workspace_id = 'xul-ws-1'
      AND start_time >= ${fromDate}
      AND start_time <= ${toDate}
      AND duration > 0
      ${where}
    GROUP BY user_email, DATE_TRUNC('week', start_time AT TIME ZONE 'Europe/Madrid')
    ORDER BY week_start DESC, user_email
  `
}
