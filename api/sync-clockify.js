/**
 * Vercel Serverless Function — Clockify → Supabase sync
 *
 * Cron: runs daily at 03:00 UTC (configured in vercel.json)
 * Also callable manually: GET /api/sync-clockify
 *
 * Fetches the last 7 days of time entries for ALL Clockify workspace users
 * and upserts them into the Supabase `time_entries` table.
 * Idempotent — safe to run multiple times.
 */

import { supabaseSql } from './_supabase.js'

const API_KEY      = 'MDQ0YTczODctZGNhMC00YjE1LTkxNzktMzdjYjM4YTVlMmM4'
const WORKSPACE_ID = '5e67ae37a4ec9a653886c794'
const BASE         = 'https://api.clockify.me/api/v1'

const headers = { 'X-Api-Key': API_KEY }

async function clockifyGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Clockify ${res.status} ${path}: ${txt.slice(0, 120)}`)
  }
  return res.json()
}

async function fetchAll(path, pageSize = 50) {
  const results = []
  let page = 1
  while (true) {
    const sep  = path.includes('?') ? '&' : '?'
    const data = await clockifyGet(`${path}${sep}page-size=${pageSize}&page=${page}`)
    if (!Array.isArray(data) || !data.length) break
    results.push(...data)
    if (data.length < pageSize) break
    page++
    await new Promise(r => setTimeout(r, 100)) // gentle rate-limit buffer
  }
  return results
}

export default async function handler(req, res) {
  // Allow GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = supabaseSql()
  const startedAt = new Date()
  const log = []

  try {
    // ── 1. Fetch all workspace users from Clockify ───────────────
    log.push('Fetching workspace users…')
    const rawUsers = await fetchAll(`/workspaces/${WORKSPACE_ID}/users?page-size=200`, 200)
    log.push(`Found ${rawUsers.length} users`)

    // ── 2. Fetch projects for name/color enrichment ──────────────
    log.push('Fetching projects…')
    const rawProjects = await fetchAll(`/workspaces/${WORKSPACE_ID}/projects?archived=false`, 100)
    const projectMap  = {}
    for (const p of rawProjects) {
      projectMap[p.id] = {
        name:        p.name,
        color:       p.color       || '#7C4DFF',
        client_name: p.clientName  || null,
      }
    }

    // ── 3. Sync last 7 days for every user ───────────────────────
    // Use 7 days so we never miss entries even if the cron skips a day
    const since      = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const sinceParam = `?start=${since}`

    let totalUpserted = 0
    let totalSkipped  = 0

    for (const u of rawUsers) {
      if (!u.email) { totalSkipped++; continue }

      try {
        const entries = await fetchAll(
          `/workspaces/${WORKSPACE_ID}/user/${u.id}/time-entries${sinceParam}`,
          50
        )

        for (const e of entries) {
          const start = e.timeInterval?.start
          const end   = e.timeInterval?.end
          if (!start || !end) continue // skip running timers

          const duration = Math.round((new Date(end) - new Date(start)) / 1000)
          const proj     = e.projectId ? projectMap[e.projectId] : null

          await sql`
            INSERT INTO time_entries (
              id, workspace_id, user_email,
              project_id, project_name, project_color, client_name,
              task_id, description,
              start_time, end_time, duration, billable
            ) VALUES (
              ${e.id}, 'xul-ws-1', ${u.email},
              ${e.projectId    || null},
              ${proj?.name     || null},
              ${proj?.color    || null},
              ${proj?.client_name || null},
              ${e.taskId       || null},
              ${e.description  || ''},
              ${start}, ${end}, ${duration},
              ${e.billable     || false}
            )
            ON CONFLICT (id) DO UPDATE SET
              description   = EXCLUDED.description,
              project_name  = EXCLUDED.project_name,
              project_color = EXCLUDED.project_color,
              client_name   = EXCLUDED.client_name,
              task_id       = EXCLUDED.task_id,
              start_time    = EXCLUDED.start_time,
              end_time      = EXCLUDED.end_time,
              duration      = EXCLUDED.duration,
              billable      = EXCLUDED.billable
          `
          totalUpserted++
        }
      } catch (err) {
        log.push(`⚠️ Error syncing ${u.email}: ${err.message}`)
        totalSkipped++
      }
    }

    // ── 4. Persist sync metadata ─────────────────────────────────
    const durationMs = Date.now() - startedAt.getTime()
    await sql`
      INSERT INTO sync_log (synced_at, entries, duration_ms, notes)
      VALUES (NOW(), ${totalUpserted}, ${durationMs}, ${log.join(' | ')})
    `

    const result = {
      ok:         true,
      upserted:   totalUpserted,
      skipped:    totalSkipped,
      users:      rawUsers.length,
      durationMs,
      syncedAt:   new Date().toISOString(),
    }
    console.log('Clockify sync complete:', result)
    return res.status(200).json(result)

  } catch (err) {
    console.error('Sync fatal error:', err)
    return res.status(500).json({ error: err.message, log })
  }
}
