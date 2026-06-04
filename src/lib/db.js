// ── Supabase client ──────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const _supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export { _supabase as supabaseClient }

// ── sql() — exec_sql RPC fallback for complex aggregate queries ──
// Used only by Costs.jsx and a few report pages. Critical path
// functions (insert/select entries, auth) use native Supabase client.
export function sql() {
  return function(strings, ...values) {
    let query = ''
    strings.forEach((s, i) => { query += s; if (i < values.length) query += `$${i + 1}` })
    const params = values.map(v => (v === null || v === undefined) ? null : String(v))
    return _supabase
      .rpc('exec_sql', { query_text: query, params })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return Array.isArray(data) ? data : []
      })
  }
}

/**
 * Returns the active workspace_id.
 * Admins can override this to browse another workspace (stored in localStorage).
 * Falls back to the user's own workspace_id, then to 'xul-ws-1'.
 */
const SESSION_KEY       = 'mytrack-demo-user'
const ACTIVE_WS_KEY     = 'mytrack-active-workspace'

export function getWsId() {
  try {
    const override = localStorage.getItem(ACTIVE_WS_KEY)
    if (override) return override
    const u = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return u?.workspace_id || 'xul-ws-1'
  } catch {
    return 'xul-ws-1'
  }
}

/** Switch the active workspace (admin-only feature). Pass null to reset to own workspace. */
export function setActiveWorkspace(wsId) {
  try {
    if (wsId) localStorage.setItem(ACTIVE_WS_KEY, wsId)
    else localStorage.removeItem(ACTIVE_WS_KEY)
  } catch {}
}

/** Clear the workspace override (called on sign-out). */
export function clearActiveWorkspace() {
  try { localStorage.removeItem(ACTIVE_WS_KEY) } catch {}
}

/**
 * Returns the workspace_id that should own data for a given user email.
 * Used during Clockify imports to route entries/members to the right workspace.
 */
export function getWsIdForEmail(email) {
  if (email?.endsWith('@fundacionxul.org')) return 'fundacion-ws-1'
  return 'xul-ws-1'
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
// Uses a promise cache so concurrent calls share one init.
// Resets on error so mobile can retry after network failure.
// After a successful first run, sessionStorage flag skips the 30+ migration
// statements on subsequent page loads — cutting startup time from ~4s to ~0s.
// ── initDB — no-op with Supabase ─────────────────────────────
// Schema is managed via Supabase migrations (applied once via MCP/dashboard).
// This function is kept for backward compatibility with all call sites.
export function initDB() {
  return Promise.resolve()
}

// Legacy _runInitDB kept only as reference — never called in production.
// eslint-disable-next-line no-unused-vars
async function _runInitDB() {
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
    CREATE TABLE IF NOT EXISTS running_timers (
      user_email    TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL DEFAULT 'xul-ws-1',
      started_at    TIMESTAMPTZ NOT NULL,
      description   TEXT,
      project_id    TEXT,
      project_name  TEXT,
      project_color TEXT,
      task_id       TEXT,
      task_name     TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
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

  await db`
    CREATE TABLE IF NOT EXISTS deleted_entries (
      id         TEXT PRIMARY KEY,
      deleted_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Migrate existing tables (safe to run repeatedly)
  await db`ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS group_name TEXT`

  // Seed hourly rates from the team spreadsheet — only sets rate when it's 0 (never overwrites)
  await db`
    UPDATE workspace_members SET hourly_rate = v.rate
    FROM (VALUES
      ('aitorrecalde@xul.es',    25.00),
      ('alejandraperea@xul.es',  18.00),
      ('asuncionblanco@xul.es',  20.00),
      ('auximazuecos@xul.es',    21.00),
      ('carlagarcia@xul.es',     31.50),
      ('elenarojo@xul.es',       23.00),
      ('inmaosuna@xul.es',       25.00),
      ('inmaculadaosuna@xul.es', 25.00),
      ('irenezurita@xul.es',     18.00),
      ('javierdura@xul.es',      18.00),
      ('javierramirez@xul.es',   31.50),
      ('jesusmije@xul.es',       16.00),
      ('jorgemelo@xul.es',       23.00),
      ('joseluisacedo@xul.es',   23.00),
      ('josemitoribio@xul.es',   20.00),
      ('lolagravan@xul.es',      20.00),
      ('cristinafernandez@xul.es',20.00),
      ('mariopulido@xul.es',     21.00),
      ('martagarcia@xul.es',     20.00),
      ('miguelperez@xul.es',     21.00),
      ('olgaalba@xul.es',        20.00),
      ('pablohernandez@xul.es',  21.00),
      ('pepegomez@xul.es',       29.00),
      ('pilarsalles@xul.es',     20.00),
      ('rociohernandez@xul.es',  29.00),
      ('sandravinas@xul.es',     20.00),
      ('saracliment@xul.es',     20.00),
      ('saramoran@xul.es',       20.00),
      ('sarasanchez@xul.es',     21.00),
      ('silviamunoz@xul.es',     21.00),
      ('teresamarcos@xul.es',    24.00),
      ('victorgarcia@xul.es',    25.00)
    ) AS v(email, rate)
    WHERE workspace_members.user_email = v.email
      AND (workspace_members.hourly_rate IS NULL OR workspace_members.hourly_rate = 0)
  `
  await db`ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC DEFAULT 37.5`
  // Set individual weekly hours for part-time profiles
  await db`UPDATE workspace_members SET weekly_hours = 10   WHERE user_email = 'saracliment@xul.es'   AND weekly_hours = 37.5`
  await db`UPDATE workspace_members SET weekly_hours = 12.5 WHERE user_email = 'saramoran@xul.es'     AND weekly_hours = 37.5`
  await db`UPDATE workspace_members SET weekly_hours = 30   WHERE user_email = 'martagarcia@xul.es'   AND weekly_hours = 37.5`

  // Monthly fixed employment cost (salary + SS) used for imputation calculations
  await db`ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC DEFAULT 0`
  await db`
    UPDATE workspace_members SET monthly_cost = v.mc
    FROM (VALUES
      ('aitorrecalde@xul.es',    3460.42),
      ('alejandraperea@xul.es',  2454.52),
      ('asuncionblanco@xul.es',  2559.65),
      ('auximazuecos@xul.es',    2895.18),
      ('carlagarcia@xul.es',     4246.68),
      ('elenarojo@xul.es',       3112.99),
      ('inmaculadaosuna@xul.es', 3201.56),
      ('irenezurita@xul.es',     2454.52),
      ('javierdura@xul.es',      2379.54),
      ('javierramirez@xul.es',   4360.76),
      ('jesusmije@xul.es',       2177.95),
      ('jorgemelo@xul.es',       3070.20),
      ('joseluisacedo@xul.es',   3189.13),
      ('josemitoribio@xul.es',   2673.80),
      ('lolagravan@xul.es',      2782.13),
      ('mariopulido@xul.es',     2895.18),
      ('martagarcia@xul.es',     2120.38),
      ('miguelperez@xul.es',     2760.06),
      ('olgaalba@xul.es',        2568.41),
      ('pablohernandez@xul.es',  2895.18),
      ('pepegomez@xul.es',       3975.94),
      ('pilarsalles@xul.es',     2649.78),
      ('rociohernandez@xul.es',  3975.94),
      ('sandravinas@xul.es',     2715.94),
      ('saramoran@xul.es',        861.83),
      ('sarasanchez@xul.es',     2826.24),
      ('silviamunoz@xul.es',     2826.24),
      ('victorgarcia@xul.es',    3421.81)
    ) AS v(email, mc)
    WHERE workspace_members.user_email = v.email AND workspace_members.monthly_cost = 0
  `
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS access TEXT DEFAULT 'PRIVATE'`
  await db`ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`

  // ── Performance indexes (safe to run repeatedly) ─────────────
  await db`CREATE INDEX IF NOT EXISTS idx_te_ws_start    ON time_entries (workspace_id, start_time DESC)`
  await db`CREATE INDEX IF NOT EXISTS idx_te_email_start ON time_entries (user_email, start_time DESC)`
  await db`CREATE INDEX IF NOT EXISTS idx_te_ws_dur      ON time_entries (workspace_id, duration) WHERE duration > 0`

  // ── Seed workspaces ──────────────────────────────────────────
  await db`
    INSERT INTO workspaces (id, name, slug, working_hours_per_day)
    VALUES ('xul-ws-1', 'XUL', 'xul', 8)
    ON CONFLICT (slug) DO NOTHING
  `
  await db`
    INSERT INTO workspaces (id, name, slug, working_hours_per_day)
    VALUES ('fundacion-ws-1', 'Fundación XUL', 'fundacion', 8)
    ON CONFLICT (slug) DO NOTHING
  `

  // ── Seed XUL workspace users ─────────────────────────────────
  const xulUsers = [
    { email: 'victorgarcia@xul.es',           name: 'Víctor García',                 role: 'admin'    },
    { email: 'carlagarcia@xul.es',             name: 'Carla García',                  role: 'admin'    },
    { email: 'josecastillo@xul.es',            name: 'José Castillo',                 role: 'admin'    },
    { email: 'aidacisneros@xul.es',            name: 'Aida Cisneros',                 role: 'employee' },
    { email: 'aitorrecalde@xul.es',            name: 'Aitor RV',                      role: 'employee' },
    { email: 'alejandraperea@xul.es',          name: 'Alejandra Perea',               role: 'employee' },
    { email: 'andreabenitez@xul.es',           name: 'Andrea Benítez',                role: 'employee' },
    { email: 'asuncionblanco@xul.es',          name: 'Asunción Blanco',               role: 'employee' },
    { email: 'auximazuecos@xul.es',            name: 'Auxi Mazuecos',                 role: 'employee' },
    { email: 'cristinafernandez@xul.es',       name: 'Cristina Fernández',            role: 'employee' },
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
  for (const u of xulUsers) {
    await db`
      INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password)
      VALUES ('xul-ws-1', ${u.email}, ${u.name}, ${u.role}, 'Mytrack14$')
      ON CONFLICT (workspace_id, user_email) DO NOTHING
    `
  }

  // ── Seed Fundación XUL workspace users ───────────────────────
  const fundacionUsers = [
    { email: 'anarojas@fundacionxul.org',      name: 'Ana Rojas',          role: 'admin'    },
    { email: 'cristinareyes@fundacionxul.org', name: 'Cristina Reyes Baro', role: 'employee' },
  ]
  for (const u of fundacionUsers) {
    await db`
      INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password)
      VALUES ('fundacion-ws-1', ${u.email}, ${u.name}, ${u.role}, 'Mytrack14$')
      ON CONFLICT (workspace_id, user_email) DO NOTHING
    `
  }

  // ── Migration: move fundación users out of xul-ws-1 ─────────
  for (const u of fundacionUsers) {
    await db`
      DELETE FROM workspace_members
      WHERE workspace_id = 'xul-ws-1' AND user_email = ${u.email}
    `
  }

  // ── XUL admins also in Fundación workspace (cross-workspace visibility) ──
  const xulAdmins = [
    { email: 'victorgarcia@xul.es',  name: 'Víctor García', role: 'admin' },
    { email: 'carlagarcia@xul.es',   name: 'Carla García',  role: 'admin' },
    { email: 'josecastillo@xul.es',  name: 'José Castillo', role: 'admin' },
  ]
  for (const u of xulAdmins) {
    await db`
      INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password)
      VALUES ('fundacion-ws-1', ${u.email}, ${u.name}, ${u.role}, 'Mytrack14$')
      ON CONFLICT (workspace_id, user_email) DO NOTHING
    `
  }
}

// ── Auth ──────────────────────────────────────────────────────

export async function dbSignIn(email, password) {
  const { data, error } = await _supabase
    .from('workspace_members')
    .select('*')
    .eq('user_email', email)
    .eq('password', password)
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] || null
}

// ── Notifications ─────────────────────────────────────────────
export async function dbGetNotifications(userId) {
  const { data, error } = await _supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', getWsId())
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data || []
}

export async function dbSendNotification({ senderEmail, senderName, recipientIds, type, title, message }) {
  const rows = recipientIds.map(userId => ({
    workspace_id: getWsId(), user_id: userId,
    sender_email: senderEmail, sender_name: senderName,
    type: type || 'default', title, message: message || '',
  }))
  const { error } = await _supabase.from('notifications').insert(rows)
  if (error) throw new Error(error.message)
}

export async function dbMarkNotificationRead(id) {
  await _supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function dbMarkAllNotificationsRead(userId) {
  await _supabase.from('notifications').update({ read: true })
    .eq('user_id', userId).eq('workspace_id', getWsId())
}

export async function dbGetAllMembers() {
  const wsId = getWsId()
  let query = _supabase.from('workspace_members').select('*').eq('workspace_id', wsId)
  if (wsId === 'fundacion-ws-1') query = query.like('user_email', '%@fundacionxul.org')
  const { data, error } = await query.order('user_name')
  if (error) throw new Error(error.message)
  return data || []
}

// ── Time entries ──────────────────────────────────────────────

export async function dbGetEntries(userEmail, year) {
  const from = `${year}-01-01T00:00:00.000Z`
  const to   = `${year + 1}-01-01T00:00:00.000Z`
  const { data, error } = await _supabase
    .from('time_entries')
    .select('*')
    .eq('user_email', userEmail)
    .not('end_time', 'is', null)
    .gte('start_time', from)
    .lt('start_time', to)
    .order('start_time', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(normEntry)
}

/** All workspace entries in a date range (for Reports page) */
export async function dbGetEntriesForPeriod(from, to) {
  const { data, error } = await _supabase
    .from('time_entries')
    .select('*')
    .eq('workspace_id', getWsId())
    .not('end_time', 'is', null)
    .gte('start_time', from.toISOString())
    .lte('start_time', to.toISOString())
    .order('start_time', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(normEntry)
}

export async function dbInsertEntry({
  id, userEmail, workspaceId,
  projectId, projectName, projectColor, clientName,
  taskId, taskName, description,
  startTime, endTime, duration, billable,
}) {
  const entryId = id || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const wsId = workspaceId || getWsId()
  const { data, error } = await _supabase
    .from('time_entries')
    .upsert({
      id:            entryId,
      workspace_id:  wsId,
      user_email:    userEmail,
      project_id:    projectId    || null,
      project_name:  projectName  || null,
      project_color: projectColor || null,
      client_name:   clientName   || null,
      task_id:       taskId       || null,
      task_name:     taskName     || null,
      description:   description  || '',
      start_time:    startTime,
      end_time:      endTime      || null,
      duration:      duration     || null,
      billable:      billable     || false,
    }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data ? normEntry(data) : null
}

/** Returns true if the entry belongs to the Fundación client */
function isFundacionEntry(e) {
  return e.client_name?.toLowerCase().includes('fundaci')
}

/** Insert a single entry row (helper used by dbUpsertEntries) */
async function _upsertEntry(db, id, wsId, e) {
  await db`
    INSERT INTO time_entries
      (id, workspace_id, user_email, project_id, project_name, project_color, client_name,
       task_id, task_name, description, start_time, end_time, duration, billable)
    VALUES
      (${id}, ${wsId}, ${e.user_email},
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

/** Bulk upsert — inserts entries in batches of 50.
 *  Routing rules:
 *  1. Each entry goes to its owner's workspace (by email domain).
 *  2. Entries for the "Fundación" client are ALSO saved to fundacion-ws-1
 *     (even if tracked by a XUL user), using a suffixed ID to avoid PK conflicts. */
export async function dbUpsertEntries(entries, onProgress) {
  const db = sql()

  // Load deleted IDs once — skip any entry the user explicitly removed in MyTrack
  const deletedRows = await db`SELECT id FROM deleted_entries`
  const deletedIds = new Set(deletedRows.map(r => r.id))

  const toInsert = entries.filter(e => !deletedIds.has(e.id))

  const BATCH = 50
  let done = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    for (const e of batch) {
      const ownerWsId = getWsIdForEmail(e.user_email)

      // 1. Save to owner's workspace
      await _upsertEntry(db, e.id, ownerWsId, e)

      // 2. Fundación client entries also land in fundacion-ws-1
      //    Skip if already routed there (avoids double-writing @fundacionxul.org entries)
      if (isFundacionEntry(e) && ownerWsId !== 'fundacion-ws-1') {
        const mirrorId = `${e.id}__f`
        if (!deletedIds.has(mirrorId)) {
          await _upsertEntry(db, mirrorId, 'fundacion-ws-1', e)
        }
      }
    }
    done += batch.length
    onProgress?.(done, toInsert.length)
  }
}

const DELETED_CACHE_KEY = 'mytrack-deleted-entry-ids'

function _addToLocalDeletedList(id) {
  try {
    const raw = localStorage.getItem(DELETED_CACHE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    if (!ids.includes(id)) ids.push(id)
    localStorage.setItem(DELETED_CACHE_KEY, JSON.stringify(ids))
  } catch {}
}

export async function dbDeleteEntry(id) {
  _addToLocalDeletedList(id)
  await _supabase.from('deleted_entries').upsert({ id }, { onConflict: 'id', ignoreDuplicates: true })
  await _supabase.from('deleted_entries').upsert({ id: id + '__f' }, { onConflict: 'id', ignoreDuplicates: true })
  const { error } = await _supabase.from('time_entries').delete().in('id', [id, id + '__f'])
  if (error) throw new Error(error.message)
}

// ── Members ───────────────────────────────────────────────────

export async function dbChangePassword(userEmail, newPassword) {
  const db = sql()
  await db`
    UPDATE workspace_members
    SET password = ${newPassword}
    WHERE workspace_id = ${getWsId()} AND user_email = ${userEmail}
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
  return db`SELECT * FROM projects WHERE workspace_id = ${getWsId()} AND archived = false ORDER BY name`
}

export async function dbGetProjectsWithHours() {
  const db = sql()
  const wsId = getWsId()
  return db`
    SELECT p.*,
           COALESCE(SUM(te.duration), 0)::bigint AS total_seconds,
           COUNT(DISTINCT te.user_email)::int     AS member_count
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    WHERE p.workspace_id = ${wsId} AND p.archived = false
    GROUP BY p.id
    ORDER BY p.name
  `
}

export async function dbGetAllProjectsWithHours() {
  const db = sql()
  const wsId = getWsId()
  return db`
    SELECT p.*,
           COALESCE(SUM(te.duration), 0)::bigint AS total_seconds,
           COUNT(DISTINCT te.user_email)::int     AS member_count
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    WHERE p.workspace_id = ${wsId}
    GROUP BY p.id
    ORDER BY p.archived ASC, p.name ASC
  `
}

export async function dbGetClients() {
  const db = sql()
  return db`SELECT * FROM clients WHERE workspace_id = ${getWsId()} ORDER BY name`
}

// ── Groups ────────────────────────────────────────────────────

export async function dbGetGroups() {
  const db = sql()
  return db`SELECT * FROM groups WHERE workspace_id = ${getWsId()} ORDER BY name`
}

export async function dbUpsertGroups(groups) {
  const db = sql()
  const wsId = getWsId()
  for (const g of groups) {
    await db`
      INSERT INTO groups (id, workspace_id, name, user_ids, manager_ids)
      VALUES (${g.id}, ${wsId}, ${g.name},
              ${g.user_ids || '[]'}, ${g.manager_ids || '[]'})
      ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        user_ids    = EXCLUDED.user_ids,
        manager_ids = EXCLUDED.manager_ids
    `
  }
}

export async function dbDeleteGroup(id) {
  const db = sql()
  await db`DELETE FROM groups WHERE id = ${id}`
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
    WHERE workspace_id = ${getWsId()} AND archived = false
    ORDER BY project_id, created_at ASC
  `
}

export async function dbUpsertTasks(tasks, wsId) {
  const db = sql()
  wsId = wsId || getWsId()
  for (const t of tasks) {
    await db`
      INSERT INTO tasks (id, workspace_id, project_id, name, status, estimate, archived)
      VALUES (${t.id}, ${wsId}, ${t.project_id}, ${t.name},
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
    VALUES (${id}, ${getWsId()}, ${projectId}, ${name}, 'ACTIVE', ${estimate || null})
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
    VALUES (${id}, ${getWsId()}, ${name}, ${color || '#7C4DFF'},
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
    VALUES (${id}, ${getWsId()}, ${name}, ${email || null})
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
    VALUES (${id}, ${getWsId()}, ${name}, false)
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
      (${id}, ${getWsId()}, ${userEmail || null}, ${userName || null},
       ${policyId || null}, ${policyName || null}, 'PENDING',
       ${startDate}, ${endDate}, ${note || null})
    RETURNING *
  `
  return rows[0]
}

export async function dbUpsertProjects(projects, wsId) {
  const db = sql()
  wsId = wsId || getWsId()
  for (const p of projects) {
    await db`
      INSERT INTO projects (id, workspace_id, name, color, client_id, client_name, budget_hours, archived, access)
      VALUES (${p.id}, ${wsId}, ${p.name}, ${p.color || '#7C4DFF'},
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
  const updated = await db`
    UPDATE sticky_notes
    SET content = ${content}, author_name = ${authorName || ''}, updated_at = NOW()
    WHERE author_email = ${userEmail} AND slot = ${slot}
    RETURNING *
  `
  if (updated.length > 0) return updated[0]

  const rows = await db`
    INSERT INTO sticky_notes (workspace_id, author_email, author_name, slot, content, updated_at)
    VALUES (${getWsId()}, ${userEmail}, ${authorName || ''}, ${slot}, ${content}, NOW())
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
      AND workspace_id = ${getWsId()}
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

export async function dbUpsertClients(clients, wsId) {
  const db = sql()
  wsId = wsId || getWsId()
  for (const c of clients) {
    await db`
      INSERT INTO clients (id, workspace_id, name, email)
      VALUES (${c.id}, ${wsId}, ${c.name}, ${c.email || null})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `
  }
}

export async function dbUpsertMember({ userEmail, userName, role, clockifyUserId, groupName }) {
  const db = sql()
  // Route member to their workspace based on email domain
  const wsId = getWsIdForEmail(userEmail) || getWsId()
  await db`
    INSERT INTO workspace_members (workspace_id, user_email, user_name, role, password, clockify_user_id, group_name)
    VALUES (${wsId}, ${userEmail}, ${userName}, ${role || 'employee'}, 'Mytrack14$', ${clockifyUserId || null}, ${groupName || null})
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

// ── Running timer (cross-device sync) ────────────────────────────────────────

export async function dbSaveRunningTimer({ userEmail, workspaceId, startedAt, description, projectId, projectName, projectColor, taskId, taskName }) {
  await _supabase.from('running_timers').upsert({
    user_email:    userEmail,
    workspace_id:  workspaceId  || 'xul-ws-1',
    started_at:    startedAt,
    description:   description  || null,
    project_id:    projectId    || null,
    project_name:  projectName  || null,
    project_color: projectColor || null,
    task_id:       taskId       || null,
    task_name:     taskName     || null,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_email' })
}

export async function dbGetRunningTimer(userEmail) {
  const { data } = await _supabase
    .from('running_timers')
    .select('*')
    .eq('user_email', userEmail)
    .single()
  if (!data) return null
  return { ...data, started_at: toISO(data.started_at), updated_at: toISO(data.updated_at) }
}

export async function dbDeleteRunningTimer(userEmail) {
  await _supabase.from('running_timers').delete().eq('user_email', userEmail)
}

export async function dbDeleteMember(userEmail) {
  const db = sql()
  const wsId = getWsIdForEmail(userEmail) || getWsId()
  await db`DELETE FROM workspace_members WHERE workspace_id = ${wsId} AND user_email = ${userEmail}`
}

/** Admin-only update: allows role changes in both directions */
export async function dbUpdateMemberAdmin({ userEmail, userName, role, hourlyRate }) {
  const db = sql()
  const wsId = getWsIdForEmail(userEmail) || getWsId()
  await db`
    UPDATE workspace_members SET
      user_name   = ${userName},
      role        = ${role},
      hourly_rate = ${hourlyRate != null ? hourlyRate : null}
    WHERE workspace_id = ${wsId} AND user_email = ${userEmail}
  `
}

// ── Tags ──────────────────────────────────────────────────────

export async function dbGetTags() {
  const db = sql()
  return db`SELECT * FROM tags WHERE workspace_id = ${getWsId()} AND archived = false ORDER BY name`
}

export async function dbUpsertTags(tags, wsId) {
  const db = sql()
  wsId = wsId || getWsId()
  for (const t of tags) {
    await db`
      INSERT INTO tags (id, workspace_id, name, archived)
      VALUES (${t.id}, ${wsId}, ${t.name}, ${t.archived || false})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, archived = EXCLUDED.archived
    `
  }
}

// ── Time Off ──────────────────────────────────────────────────

export async function dbGetTimeOffPolicies() {
  const db = sql()
  return db`SELECT * FROM time_off_policies WHERE workspace_id = ${getWsId()} ORDER BY name`
}

export async function dbUpsertTimeOffPolicies(policies, wsId) {
  const db = sql()
  wsId = wsId || getWsId()
  for (const p of policies) {
    await db`
      INSERT INTO time_off_policies (id, workspace_id, name, color, days_per_year)
      VALUES (${p.id}, ${wsId}, ${p.name}, ${p.color || '#7C4DFF'}, ${p.daysPerYear || null})
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
    WHERE workspace_id = ${getWsId()}
    ORDER BY start_date DESC
  `
}

export async function dbUpsertTimeOffRequests(requests) {
  const db = sql()
  for (const r of requests) {
    // Route each request to the workspace that owns that user
    const wsId = r.user_email ? getWsIdForEmail(r.user_email) : getWsId()
    await db`
      INSERT INTO time_off_requests
        (id, workspace_id, user_email, user_name, policy_id, policy_name, status, start_date, end_date, note)
      VALUES
        (${r.id}, ${wsId}, ${r.user_email || null}, ${r.user_name || null},
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
  const wsId = getWsId()
  if (userEmail) {
    return db`
      SELECT * FROM hour_compensations
      WHERE workspace_id = ${wsId} AND user_email = ${userEmail}
      ORDER BY week_start DESC
    `
  }
  return db`
    SELECT * FROM hour_compensations
    WHERE workspace_id = ${wsId}
    ORDER BY week_start DESC, user_email
  `
}

/** Add a compensation entry */
export async function dbAddCompensation({ userEmail, weekStart, compHours, notes, createdBy }) {
  const db = sql()
  const rows = await db`
    INSERT INTO hour_compensations (workspace_id, user_email, week_start, comp_hours, notes, created_by)
    VALUES (${getWsId()}, ${userEmail}, ${weekStart}, ${compHours}, ${notes || ''}, ${createdBy || ''})
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
  const wsId = getWsId()
  const where = userEmail
    ? db`AND user_email = ${userEmail}`
    : db``
  return db`
    SELECT
      user_email,
      DATE_TRUNC('week', start_time AT TIME ZONE 'Europe/Madrid')::date AS week_start,
      SUM(duration) AS total_seconds
    FROM time_entries
    WHERE workspace_id = ${wsId}
      AND start_time >= ${fromDate}
      AND start_time <= ${toDate}
      AND duration > 0
      ${where}
    GROUP BY user_email, DATE_TRUNC('week', start_time AT TIME ZONE 'Europe/Madrid')
    ORDER BY week_start DESC, user_email
  `
}
