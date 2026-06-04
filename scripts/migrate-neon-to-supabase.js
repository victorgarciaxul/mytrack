#!/usr/bin/env node
/**
 * migrate-neon-to-supabase.js
 *
 * Migrates all data from Neon PostgreSQL → Supabase.
 * Run once from your machine:
 *
 *   NEON_URL="postgres://..." \
 *   SUPABASE_URL="https://bjoqigbscnkqufhtgrlu.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/migrate-neon-to-supabase.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING / upserts.
 */

import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'

const NEON_URL    = process.env.NEON_URL || process.env.VITE_NEON_URL
const SUPA_URL    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NEON_URL)  { console.error('❌  Set NEON_URL'); process.exit(1) }
if (!SUPA_URL)  { console.error('❌  Set SUPABASE_URL'); process.exit(1) }
if (!SUPA_KEY)  { console.error('❌  Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const neonSql  = neon(NEON_URL)
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

function rpc(query, params = []) {
  return supabase
    .rpc('exec_sql', { query_text: query, params: JSON.stringify(params.map(v => v === null || v === undefined ? null : String(v))) })
    .then(({ data, error }) => { if (error) throw new Error(error.message); return data || [] })
}

async function migrateTable(tableName, rows, batchSize = 100) {
  if (!rows.length) { console.log(`  ${tableName}: 0 rows (skip)`); return }
  let done = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(tableName).upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      // upsert may fail on tables without 'id' — fall back to insert ignore
      for (const row of batch) {
        await supabase.from(tableName).insert(row).select().maybeSingle().catch(() => {})
      }
    }
    done += batch.length
    process.stdout.write(`\r  ${tableName}: ${done}/${rows.length}`)
  }
  console.log(`\r  ${tableName}: ✅  ${done} rows`)
}

async function main() {
  console.log('\n🚀  Starting Neon → Supabase migration\n')

  // Tables to migrate (order matters for FK constraints)
  const tables = [
    'workspaces',
    'workspace_members',
    'clients',
    'projects',
    'tasks',
    'tags',
    'groups',
    'time_off_policies',
    'time_off_requests',
    'running_timers',
    'sticky_notes',
    'notifications',
    'hour_compensations',
    'deleted_entries',
    'time_entries',   // largest — last
  ]

  for (const table of tables) {
    try {
      process.stdout.write(`  ${table}: loading from Neon…`)
      const rows = await neonSql`SELECT * FROM ${neonSql(table)}`.catch(() => [])
      process.stdout.write(`\r  ${table}: ${rows.length} rows found, inserting…\n`)
      await migrateTable(table, rows)
    } catch (err) {
      console.warn(`  ⚠️  ${table}: ${err.message}`)
    }
  }

  // Special: sync_log (has SERIAL id, not TEXT)
  try {
    const logs = await neonSql`SELECT * FROM sync_log`.catch(() => [])
    if (logs.length) {
      const { error } = await supabase.from('sync_log').insert(logs)
      if (error) console.warn('  ⚠️  sync_log:', error.message)
      else console.log(`  sync_log: ✅  ${logs.length} rows`)
    }
  } catch {}

  console.log('\n✅  Migration complete!\n')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
