// ── Neon PostgreSQL client ───────────────────────────────────
import { neon } from '@neondatabase/serverless'

const CONNECTION = import.meta.env.VITE_NEON_URL

let _sql = null
export function sql() {
  if (!_sql) _sql = neon(CONNECTION)
  return _sql
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
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_email   TEXT NOT NULL,
      user_name    TEXT NOT NULL DEFAULT '',
      role         TEXT DEFAULT 'employee',
      hourly_rate  NUMERIC DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
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
  // Seed workspace
  await db`
    INSERT INTO workspaces (id, name, slug, working_hours_per_day)
    VALUES ('xul-ws-1', 'XUL', 'xul', 8)
    ON CONFLICT (slug) DO NOTHING
  `
}

// ── Time entries ──────────────────────────────────────────────

export async function dbGetEntries(userEmail, year) {
  const db = sql()
  return db`
    SELECT * FROM time_entries
    WHERE user_email = ${userEmail}
      AND end_time IS NOT NULL
      AND EXTRACT(YEAR FROM start_time) = ${year}
    ORDER BY start_time DESC
  `
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
  return rows[0]
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

export async function dbGetMembers() {
  const db = sql()
  return db`SELECT * FROM workspace_members WHERE workspace_id = 'xul-ws-1' ORDER BY user_name`
}

export async function dbUpsertMember({ userEmail, userName, role }) {
  const db = sql()
  await db`
    INSERT INTO workspace_members (workspace_id, user_email, user_name, role)
    VALUES ('xul-ws-1', ${userEmail}, ${userName}, ${role || 'employee'})
    ON CONFLICT (workspace_id, user_email)
    DO UPDATE SET user_name = EXCLUDED.user_name, role = EXCLUDED.role
  `
}
