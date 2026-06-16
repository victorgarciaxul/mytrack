/**
 * GET /api/projects?workspace=xul-ws-1&start=2026-01-01T00:00:00Z&end=2026-01-31T23:59:59Z
 *
 * Returns distinct projects for a workspace+period.
 * Shape: [{ id, name, color }]  — mirrors Clockify's project list.
 */

import { supabaseSql } from './_supabase.js'

const CORS_ORIGINS = [
  'https://ecofin.xul.es',
  'https://mytrack.xul.es',
  'http://localhost:5173',
  'http://localhost:3000',
]

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (CORS_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const workspace = req.query.workspace || 'xul-ws-1'
  const start     = req.query.start || null
  const end       = req.query.end   || null

  if (!['xul-ws-1', 'fundacion-ws-1'].includes(workspace)) {
    return res.status(400).json({ ok: false, error: 'Invalid workspace' })
  }

  try {
    const db = supabaseSql()
    let rows
    if (start && end) {
      rows = await db`
        SELECT DISTINCT project_name AS name, project_color AS color
        FROM time_entries
        WHERE workspace_id = ${workspace}
          AND duration > 0
          AND project_name IS NOT NULL AND project_name <> ''
          AND start_time >= ${start}::timestamptz
          AND start_time <= ${end}::timestamptz
        ORDER BY project_name
      `
    } else {
      rows = await db`
        SELECT DISTINCT project_name AS name, project_color AS color
        FROM time_entries
        WHERE workspace_id = ${workspace}
          AND duration > 0
          AND project_name IS NOT NULL AND project_name <> ''
        ORDER BY project_name
      `
    }

    const projects = rows.map(r => ({
      id:    r.name,
      name:  r.name,
      color: r.color || '#7C4DFF',
    }))

    res.status(200).json(projects)
  } catch (err) {
    console.error('[projects] DB error:', err.message)
    res.status(500).json({ ok: false, error: 'Database error' })
  }
}
