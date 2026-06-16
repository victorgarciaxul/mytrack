/**
 * GET /api/workspaces
 * Returns the list of available workspaces (same allowlist as team-costs).
 * Mimics the shape of Clockify's GET /workspaces: [{ id, name }]
 */

const CORS_ORIGINS = [
  'https://ecofin.xul.es',
  'https://mytrack.xul.es',
  'http://localhost:5173',
  'http://localhost:3000',
]

const WORKSPACES = [
  { id: 'xul-ws-1',        name: 'XUL' },
  { id: 'fundacion-ws-1',  name: 'Fundación' },
]

export default function handler(req, res) {
  const origin = req.headers.origin || ''
  if (CORS_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  res.status(200).json(WORKSPACES)
}
