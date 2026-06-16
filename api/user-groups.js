/**
 * GET /api/user-groups?workspace=xul-ws-1
 *
 * Returns user groups from workspace_members.group_name field.
 * Shape mirrors Clockify: [{ id, name, userIds: [email, ...] }]
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

  if (!['xul-ws-1', 'fundacion-ws-1'].includes(workspace)) {
    return res.status(400).json({ ok: false, error: 'Invalid workspace' })
  }

  try {
    const db = supabaseSql()
    const rows = await db`
      SELECT user_email, user_name, group_name
      FROM workspace_members
      WHERE workspace_id = ${workspace}
        AND role <> 'inactive'
      ORDER BY group_name, user_name
    `

    // Group by group_name
    const roleMap = {}
    for (const r of rows) {
      const grp = r.group_name || 'Sin grupo'
      if (!roleMap[grp]) roleMap[grp] = { id: grp, name: grp, userIds: [] }
      roleMap[grp].userIds.push(r.user_email)
    }

    res.status(200).json(Object.values(roleMap))
  } catch (err) {
    console.error('[user-groups] DB error:', err.message)
    res.status(500).json({ ok: false, error: 'Database error' })
  }
}
