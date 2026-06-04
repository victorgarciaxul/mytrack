#!/usr/bin/env node
/**
 * migrate-neon-to-supabase.js — con soporte de reanudación y reconexión
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const { Client } = pg

const NEON_URL = process.env.NEON_URL
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NEON_URL) { console.error('❌  Falta NEON_URL'); process.exit(1) }
if (!SUPA_URL) { console.error('❌  Falta SUPABASE_URL'); process.exit(1) }
if (!SUPA_KEY) { console.error('❌  Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

function toISO(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}
function normaliseRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? toISO(v) : v
  return out
}

async function getNewClient() {
  const c = new Client({
    connectionString: NEON_URL.replace('channel_binding=require', 'channel_binding=disable'),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  })
  await c.connect()
  return c
}

async function migrateTimeEntries() {
  // Get how many we already have in Supabase
  const { count } = await supabase.from('time_entries').select('*', { count: 'exact', head: true })
  const alreadyDone = count || 0
  console.log(`  time_entries: ${alreadyDone} ya migradas, reanudando…`)

  const BATCH = 500
  let offset = alreadyDone
  let total = null
  let neon = await getNewClient()
  let reconnects = 0

  while (true) {
    // Fetch batch from Neon
    let rows
    try {
      const res = await neon.query(
        `SELECT * FROM time_entries ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
        [BATCH, offset]
      )
      rows = res.rows.map(normaliseRow)
      if (total === null) {
        const tot = await neon.query('SELECT COUNT(*) FROM time_entries')
        total = parseInt(tot.rows[0].count)
      }
    } catch (err) {
      // Neon connection dropped — reconnect and retry
      console.log(`\n  ↻ Reconectando a Neon (${++reconnects})…`)
      try { await neon.end() } catch {}
      await new Promise(r => setTimeout(r, 2000))
      neon = await getNewClient()
      continue
    }

    if (!rows.length) break

    // Insert to Supabase
    const { error } = await supabase.from('time_entries').upsert(rows, { ignoreDuplicates: true })
    if (error) {
      // Batch failed — try row by row
      for (const row of rows) {
        await supabase.from('time_entries').upsert(row, { ignoreDuplicates: true })
      }
    }

    offset += rows.length
    process.stdout.write(`\r  time_entries: ${offset}/${total || '?'} (${Math.round(offset/(total||offset)*100)}%)`)

    if (rows.length < BATCH) break
  }

  try { await neon.end() } catch {}
  console.log(`\r  time_entries: ✅  ${offset} filas totales`)
}

async function main() {
  console.log('\n🔄  Reanudando migración time_entries…\n')
  await migrateTimeEntries()
  console.log('\n✅  Migración completada\n')
}

main().catch(err => { console.error('Error fatal:', err.message); process.exit(1) })
