/**
 * Vercel Serverless Function — Coste mensual de personal
 *
 * GET /api/team-costs?year=2026&workspace=xul-ws-1
 *
 * Calcula el coste de personal mensual sumando
 * (horas imputadas × tarifa horaria de cada miembro)
 * y devuelve un JSON que EcoFin puede consumir directamente.
 *
 * Respuesta:
 * {
 *   ok: true,
 *   year: 2026,
 *   workspace: "xul-ws-1",
 *   costs: {
 *     "2026-01": 7445.50,
 *     "2026-02": 9710.00,
 *     ...
 *   }
 * }
 */

import { neon } from '@neondatabase/serverless'

// Allowed origins (add more if needed)
const ALLOWED_ORIGINS = [
  'https://ecofin.xul.es',
  'https://mytrack.xul.es',
  'http://localhost:5173',
  'http://localhost:3000',
]

export default async function handler(req, res) {
  // ── CORS ─────────────────────────────────────────────────────
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  // ── Params ────────────────────────────────────────────────────
  const year      = parseInt(req.query.year)  || new Date().getFullYear()
  const workspace = req.query.workspace       || 'xul-ws-1'
  // Optional: filter by project name (partial, case-insensitive)
  // e.g. ?project=XULTECH-2026 or ?project=Fundación
  const project   = req.query.project?.trim() || null

  if (!['xul-ws-1', 'fundacion-ws-1'].includes(workspace)) {
    res.status(400).json({ ok: false, error: 'Invalid workspace' })
    return
  }

  // ── Query ─────────────────────────────────────────────────────
  try {
    const db = neon(process.env.VITE_NEON_URL)

    // ── List mode: return distinct project names for the workspace+year ──
    if (req.query.list === '1') {
      const rows = await db`
        SELECT DISTINCT project_name
        FROM time_entries
        WHERE workspace_id = ${workspace}
          AND duration > 0
          AND project_name IS NOT NULL
          AND project_name <> ''
          AND EXTRACT(YEAR FROM start_time AT TIME ZONE 'Europe/Madrid') = ${year}
        ORDER BY project_name
      `
      res.status(200).json({ ok: true, year, workspace, projects: rows.map(r => r.project_name) })
      return
    }

    // Two query variants: with / without project filter.
    // Neon tagged templates don't support dynamic LIKE interpolation
    // in a single template, so we branch explicitly.
    let rows
    if (project) {
      const like = `%${project.toLowerCase()}%`
      rows = await db`
        SELECT
          TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
          ROUND(
            SUM(te.duration / 3600.0 * COALESCE(wm.hourly_rate, 0))::numeric,
            2
          ) AS cost
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email    = wm.user_email
         AND wm.workspace_id = te.workspace_id
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND EXTRACT(YEAR FROM te.start_time AT TIME ZONE 'Europe/Madrid') = ${year}
          AND LOWER(COALESCE(te.project_name, '')) LIKE ${like}
        GROUP BY TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
        ORDER BY month
      `
    } else {
      rows = await db`
        SELECT
          TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
          ROUND(
            SUM(te.duration / 3600.0 * COALESCE(wm.hourly_rate, 0))::numeric,
            2
          ) AS cost
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email    = wm.user_email
         AND wm.workspace_id = te.workspace_id
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND EXTRACT(YEAR FROM te.start_time AT TIME ZONE 'Europe/Madrid') = ${year}
        GROUP BY TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
        ORDER BY month
      `
    }

    // Convert rows → { "2026-01": 7445.50, ... }
    const costs = {}
    for (const r of rows) {
      costs[r.month] = parseFloat(r.cost) || 0
    }

    res.status(200).json({ ok: true, year, workspace, project: project || null, costs })
  } catch (err) {
    console.error('[team-costs] DB error:', err.message)
    res.status(500).json({ ok: false, error: 'Database error' })
  }
}
