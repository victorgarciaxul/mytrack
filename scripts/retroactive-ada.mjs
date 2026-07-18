/**
 * Relleno retroactivo de auto-imputaciones ADA para Rocío, Pablo y Miguel.
 * Rango: 01/01/2026 → hoy.
 * Usa upsert → sobreescribe si el ID ya existe (id = ada-auto-{slug}-{YYYYMMDD}).
 *
 * Uso: node scripts/retroactive-ada.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const PROJECT_ID   = '667a69f4ed670144288c0ad4'
const PROJECT_NAME = 'Agencia Digital de Andalucía | Oficina Comunicación'
const DESCRIPTION  = 'Tareas varias'
const WS_ID        = 'xul-ws-1'

const USERS = [
  { email: 'rociohernandez@xul.es',  taskId: '667a6a0d2723434f11796209', taskName: 'Responsable proyecto' },
  { email: 'pablohernandez@xul.es',  taskId: '673afb9effb01d751bd43277', taskName: 'Coordinador actuaciones y contenidos' },
  { email: 'miguelperez@xul.es',     taskId: '673afba6c736720c7f527126', taskName: 'Redactor' },
]

// ── Festivos 2026 (nacional + convenio + local Sevilla) ────────────────────
const HOLIDAYS = new Set([
  '2026-01-01','2026-01-06','2026-01-30','2026-02-28',
  '2026-04-02','2026-04-03','2026-04-22',
  '2026-05-01','2026-06-04',
  '2026-08-14','2026-10-12',
  '2026-12-08','2026-12-24','2026-12-25','2026-12-31',
])

function isHoliday(dateStr) { return HOLIDAYS.has(dateStr) }

function lastSundayOf(year, month) {
  const d = new Date(Date.UTC(year, month + 1, 0))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}
function spainOffsetHours(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const year = d.getUTCFullYear()
  const dstStart = lastSundayOf(year, 2)
  const dstEnd   = lastSundayOf(year, 9)
  return (d >= dstStart && d < dstEnd) ? 2 : 1
}
function schedule(dateStr) {
  const month = parseInt(dateStr.slice(5, 7))
  const dow   = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  if (month === 7 || month === 8) return { startLocal: '08:00', endLocal: '15:00' }
  if (dow === 5)                   return { startLocal: '08:30', endLocal: '15:00' }
  return                                  { startLocal: '08:30', endLocal: '16:15' }
}
function toUTC(dateStr, timeLocal, offsetH) {
  const [h, m] = timeLocal.split(':').map(Number)
  const base = new Date(dateStr + 'T00:00:00Z')
  base.setUTCHours(h - offsetH, m, 0, 0)
  return base.toISOString()
}

// ── Iterar fechas ──────────────────────────────────────────────────────────
const start = new Date('2026-01-01T00:00:00Z')
const today = new Date()
today.setUTCHours(0, 0, 0, 0)

const dates = []
for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  const str = d.toISOString().slice(0, 10)
  const dow = d.getUTCDay()
  if (dow === 0 || dow === 6) continue // fin de semana
  if (isHoliday(str)) continue
  dates.push(str)
}

console.log(`Fechas laborables a rellenar: ${dates.length}`)
console.log(`Desde ${dates[0]} hasta ${dates[dates.length - 1]}`)

// ── Insertar ───────────────────────────────────────────────────────────────
let inserted = 0
let errors   = 0

for (const user of USERS) {
  console.log(`\nProcesando ${user.email}…`)
  let userInserted = 0

  for (const dateStr of dates) {
    const offset = spainOffsetHours(dateStr)
    const { startLocal, endLocal } = schedule(dateStr)
    const startUtc  = toUTC(dateStr, startLocal, offset)
    const endUtc    = toUTC(dateStr, endLocal,   offset)
    const duration  = Math.floor((new Date(endUtc) - new Date(startUtc)) / 1000)
    const slug      = user.email.split('@')[0]
    const id        = `ada-auto-${slug}-${dateStr.replace(/-/g, '')}`

    const row = {
      id,
      workspace_id:  WS_ID,
      user_email:    user.email,
      project_id:    PROJECT_ID,
      project_name:  PROJECT_NAME,
      task_id:       user.taskId,
      task_name:     user.taskName,
      description:   DESCRIPTION,
      start_time:    startUtc,
      end_time:      endUtc,
      duration,
      billable:      true,
    }

    const { error } = await supabase.from('time_entries').upsert(row, { onConflict: 'id' })
    if (error) {
      console.warn(`  ✗ ${dateStr}: ${error.message}`)
      errors++
    } else {
      userInserted++
      inserted++
    }
  }
  console.log(`  ✓ ${userInserted} entradas insertadas/actualizadas`)
}

console.log(`\n✅ Listo. ${inserted} entradas upserted, ${errors} errores.`)
