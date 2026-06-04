/**
 * Shared Supabase helper for Vercel API routes.
 * Exports a `sql` tagged-template function that mirrors @neondatabase/serverless,
 * so all existing db`…` calls work without changes.
 */
import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Returns a tagged-template SQL function backed by the exec_sql Postgres RPC.
 * Usage: const db = supabaseSql(); await db`SELECT * FROM …`
 */
export function supabaseSql() {
  const client = getClient()
  return function(strings, ...values) {
    let query = ''
    strings.forEach((s, i) => {
      query += s
      if (i < values.length) query += `$${i + 1}`
    })
    const params = values.map(v => (v === null || v === undefined) ? null : String(v))
    return client
      .rpc('exec_sql', { query_text: query, params: JSON.stringify(params) })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return Array.isArray(data) ? data : []
      })
  }
}
