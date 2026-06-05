/**
 * Vercel Serverless Function — Coste mensual de personal
 *
 * GET /api/team-costs?year=2026&workspace=xul-ws-1
 *
 * Calcula el coste de imputación mensual usando la misma fórmula
 * que la vista "Costes de equipo" de MyTrack:
 *   coste_imput = (segundos_en_proyecto / MAX(segundos_totales_persona, 160h)) × coste_mensual
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

import { supabaseSql } from './_supabase.js'

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
    const db = supabaseSql()

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

    // Capacity: 160 standard hours per month in seconds (same constant as MyTrack frontend)
    const CAPACITY_SECS = 160 * 3600

    // Formula mirrors MyTrack's "Coste imput." calculation:
    //   imputCost = (seconds_on_project / MAX(person_total_seconds, capacity)) × monthly_cost
    //
    // person_total_seconds = all seconds the person logged in that month across ALL projects,
    // so we compute it in a CTE before filtering by project.
    let rows
    if (project) {
      const like = `%${project.toLowerCase()}%`
      rows = await db`
        WITH person_month_totals AS (
          SELECT
            user_email,
            TO_CHAR(start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
            SUM(duration) AS total_secs
          FROM time_entries
          WHERE workspace_id = ${workspace}
            AND duration > 0
            AND EXTRACT(YEAR FROM start_time AT TIME ZONE 'Europe/Madrid') = ${year}
          GROUP BY user_email, TO_CHAR(start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
        )
        SELECT
          TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
          ROUND(
            SUM(
              (te.duration::numeric / GREATEST(COALESCE(pmt.total_secs, te.duration), ${CAPACITY_SECS}))
              * COALESCE(wm.monthly_cost, 0)
            )::numeric,
            2
          ) AS cost
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email    = wm.user_email
         AND wm.workspace_id = te.workspace_id
        LEFT JOIN person_month_totals pmt
          ON te.user_email = pmt.user_email
         AND TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = pmt.month
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND EXTRACT(YEAR FROM te.start_time AT TIME ZONE 'Europe/Madrid') = ${year}
          AND LOWER(COALESCE(te.project_name, '')) LIKE ${like}
          AND COALESCE(wm.monthly_cost, 0) > 0
        GROUP BY TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
        ORDER BY month
      `
    } else {
      rows = await db`
        WITH person_month_totals AS (
          SELECT
            user_email,
            TO_CHAR(start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
            SUM(duration) AS total_secs
          FROM time_entries
          WHERE workspace_id = ${workspace}
            AND duration > 0
            AND EXTRACT(YEAR FROM start_time AT TIME ZONE 'Europe/Madrid') = ${year}
          GROUP BY user_email, TO_CHAR(start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM')
        )
        SELECT
          TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS month,
          ROUND(
            SUM(
              (te.duration::numeric / GREATEST(COALESCE(pmt.total_secs, te.duration), ${CAPACITY_SECS}))
              * COALESCE(wm.monthly_cost, 0)
            )::numeric,
            2
          ) AS cost
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email    = wm.user_email
         AND wm.workspace_id = te.workspace_id
        LEFT JOIN person_month_totals pmt
          ON te.user_email = pmt.user_email
         AND TO_CHAR(te.start_time AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = pmt.month
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND EXTRACT(YEAR FROM te.start_time AT TIME ZONE 'Europe/Madrid') = ${year}
          AND COALESCE(wm.monthly_cost, 0) > 0
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
