import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'

const sql = neon(process.env.NEON_DATABASE_URL)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function norm(row) { const o={}; for(const[k,v] of Object.entries(row)) o[k]=v instanceof Date?v.toISOString():v; return o }

console.log('Leyendo IDs de Supabase...')
const supaIds = new Set()
let page = 0
while(true) {
  const { data } = await supabase.from('time_entries').select('id').range(page*1000, page*1000+999)
  if (!data?.length) break
  data.forEach(r => supaIds.add(r.id))
  page++
  process.stdout.write('\r  IDs: ' + supaIds.size)
}
console.log('\n  Total Supabase: ' + supaIds.size)

console.log('Leyendo todas las entradas de Neon...')
const all = await sql`SELECT * FROM time_entries`
console.log('  Total Neon: ' + all.length)

const missing = all.filter(r => !supaIds.has(r.id)).map(norm)
console.log('  Faltan: ' + missing.length)

if (!missing.length) { console.log('✅ Datos completos'); process.exit(0) }

let done = 0
for (let i = 0; i < missing.length; i += 200) {
  await supabase.from('time_entries').upsert(missing.slice(i, i+200), { ignoreDuplicates: true })
  done += Math.min(200, missing.length - i)
  process.stdout.write('\r  Insertando: ' + done + '/' + missing.length)
}
console.log('\n✅ ' + missing.length + ' entradas recuperadas')
