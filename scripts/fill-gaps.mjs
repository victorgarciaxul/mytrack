import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'

const sql = neon('postgresql://neondb_owner:npg_yO9tMudVRm0E@ep-long-band-apjs8vf1-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
const supabase = createClient(
  'https://bjoqigbscnkqufhtgrlu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqb3FpZ2JzY25rcXVmaHRncmx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU2OTc1NCwiZXhwIjoyMDk2MTQ1NzU0fQ.-WY07JuTCYQaPY0IgUcBd4EqQbYYkLAW0zxEv3Ct5YE',
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
