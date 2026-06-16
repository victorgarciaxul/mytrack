/**
 * GET /api/summary?workspace=xul-ws-1&start=...&end=...&by=user|project|task
 *
 * Returns a Clockify-compatible summary report grouped by user→project,
 * project→user, or project→task.
 *
 * Shape (same as Clockify summary reports):
 * {
 *   ok: true,
 *   totals: [{ totalTime: <seconds> }],
 *   groupOne: [
 *     { _id, name, duration, children: [{ _id, name, duration }] }
 *   ]
 * }
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
  const by        = req.query.by        || 'user'   // 'user' | 'project' | 'task'
  const start     = req.query.start
  const end       = req.query.end

  if (!['xul-ws-1', 'fundacion-ws-1'].includes(workspace)) {
    return res.status(400).json({ ok: false, error: 'Invalid workspace' })
  }
  if (!start || !end) {
    return res.status(400).json({ ok: false, error: 'start and end are required' })
  }

  try {
    const db = supabaseSql()

    if (by === 'user') {
      // Group: user → project
      const rows = await db`
        SELECT
          te.user_email,
          COALESCE(wm.user_name, te.user_email) AS user_name,
          COALESCE(te.project_name, '')          AS project_name,
          SUM(te.duration)                       AS duration
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email = wm.user_email AND wm.workspace_id = te.workspace_id
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND te.start_time >= ${start}::timestamptz
          AND te.start_time <= ${end}::timestamptz
        GROUP BY te.user_email, wm.user_name, te.project_name
        ORDER BY te.user_email, te.project_name
      `

      const usersMap = {}
      let totalTime = 0
      for (const r of rows) {
        if (!usersMap[r.user_email]) {
          usersMap[r.user_email] = { _id: r.user_email, name: r.user_name, duration: 0, children: [] }
        }
        const dur = Number(r.duration)
        usersMap[r.user_email].duration += dur
        usersMap[r.user_email].children.push({
          _id: r.project_name || '__no_project__',
          name: r.project_name || 'Sin proyecto',
          duration: dur,
        })
        totalTime += dur
      }

      const groupOne = Object.values(usersMap).sort((a, b) => b.duration - a.duration)
      return res.status(200).json({ ok: true, totals: [{ totalTime }], groupOne })
    }

    if (by === 'project') {
      // Group: project → user
      const rows = await db`
        SELECT
          COALESCE(te.project_name, '')          AS project_name,
          te.user_email,
          COALESCE(wm.user_name, te.user_email)  AS user_name,
          SUM(te.duration)                        AS duration
        FROM time_entries te
        LEFT JOIN workspace_members wm
          ON te.user_email = wm.user_email AND wm.workspace_id = te.workspace_id
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND te.start_time >= ${start}::timestamptz
          AND te.start_time <= ${end}::timestamptz
        GROUP BY te.project_name, te.user_email, wm.user_name
        ORDER BY te.project_name, te.user_email
      `

      const projMap = {}
      for (const r of rows) {
        const key = r.project_name || '__no_project__'
        if (!projMap[key]) {
          projMap[key] = { _id: key, name: r.project_name || 'Sin proyecto', duration: 0, children: [] }
        }
        const dur = Number(r.duration)
        projMap[key].duration += dur
        projMap[key].children.push({ _id: r.user_email, name: r.user_name, duration: dur })
      }

      const groupOne = Object.values(projMap).sort((a, b) => b.duration - a.duration)
      return res.status(200).json({ ok: true, totals: [{ totalTime: groupOne.reduce((s, p) => s + p.duration, 0) }], groupOne })
    }

    if (by === 'task') {
      // Group: project → task
      const rows = await db`
        SELECT
          COALESCE(te.project_name, '') AS project_name,
          COALESCE(te.task_name, '')    AS task_name,
          SUM(te.duration)              AS duration
        FROM time_entries te
        WHERE te.workspace_id = ${workspace}
          AND te.duration > 0
          AND te.start_time >= ${start}::timestamptz
          AND te.start_time <= ${end}::timestamptz
        GROUP BY te.project_name, te.task_name
        ORDER BY te.project_name, te.task_name
      `

      const projMap = {}
      for (const r of rows) {
        const key = r.project_name || '__no_project__'
        if (!projMap[key]) {
          projMap[key] = { _id: key, name: r.project_name || 'Sin proyecto', duration: 0, children: [] }
        }
        const dur = Number(r.duration)
        projMap[key].duration += dur
        projMap[key].children.push({ _id: r.task_name || '__no_task__', name: r.task_name || 'Sin tarea', duration: dur })
      }

      const groupOne = Object.values(projMap).sort((a, b) => b.duration - a.duration)
      return res.status(200).json({ ok: true, totals: [{ totalTime: groupOne.reduce((s, p) => s + p.duration, 0) }], groupOne })
    }

    return res.status(400).json({ ok: false, error: 'Invalid by parameter. Use: user, project, task' })
  } catch (err) {
    console.error('[summary] DB error:', err.message)
    res.status(500).json({ ok: false, error: 'Database error' })
  }
}
