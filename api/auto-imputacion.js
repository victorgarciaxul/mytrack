/**
 * Auto-imputación diaria para el equipo ADA.
 * Cron: lunes-viernes a las 20:00 UTC (22:00 hora España verano).
 * Solo inserta si el usuario no tiene ningún registro ese día.
 * Idempotente — safe to run multiple times.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const PROJECT_ID   = '667a69f4ed670144288c0ad4'
const PROJECT_NAME = 'Agencia Digital de Andalucía | Oficina Comunicación'
const DESCRIPTION  = 'Tareas varias'
const WS_ID        = 'xul-ws-1'

// Usuarios y sus tareas
const USERS = [
  { email: 'rociohernandez@xul.es',  name: 'Rocío Hernández',  taskId: '667a6a0d2723434f11796209', taskName: 'Responsable proyecto' },
  { email: 'pablohernandez@xul.es',  name: 'Pablo Hernández',  taskId: '673afb9effb01d751bd43277', taskName: 'Coordinador actuaciones y contenidos' },
  { email: 'miguelperez@xul.es',     name: 'Miguel Pérez',     taskId: '673afba6c736720c7f527126', taskName: 'Redactor' },
  { email: 'pilarsalles@xul.es',     name: 'Pilar Sallés',     taskId: '673afb29c736720c7f525e81', taskName: 'Community Manager' },
  { email: 'sandravinas@xul.es',     name: 'Sandra Viñas',     taskId: '673afba6c736720c7f527126', taskName: 'Redactor' },
  { email: 'asuncionblanco@xul.es',  name: 'Asunción Blanco',  taskId: '673afb29c736720c7f525e81', taskName: 'Community Manager' },
]

// ── Festivos (nacionales + convenio) que aplican a todos ───────────────────
const HOLIDAYS_2026 = new Set([
  '2026-01-01','2026-01-06','2026-01-30','2026-02-28',
  '2026-04-02','2026-04-03','2026-04-22', // Sevilla local — ADA está en Sevilla
  '2026-05-01','2026-06-04', // Sevilla local
  '2026-08-14','2026-10-12',
  '2026-12-08','2026-12-24','2026-12-25','2026-12-31',
])
const HOLIDAYS_2027 = new Set([
  '2027-01-01','2027-01-06','2027-01-29','2027-03-01',
  '2027-03-25','2027-03-26',
  '2027-04-22','2027-06-04', // Sevilla local
  '2027-08-16','2027-10-12','2027-11-01','2027-12-06',
  '2027-12-08','2027-12-24','2027-12-31',
])

function isHoliday(dateStr) {
  const year = parseInt(dateStr.slice(0, 4))
  if (year === 2026) return HOLIDAYS_2026.has(dateStr)
  if (year === 2027) return HOLIDAYS_2027.has(dateStr)
  return false
}

// ── Offset UTC de España según fecha ──────────────────────────────────────
// DST: último domingo de marzo → último domingo de octubre = UTC+2, resto = UTC+1
function spainOffsetHours(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const year = d.getUTCFullYear()
  // Último domingo de marzo
  const dstStart = lastSundayOf(year, 2) // month 2 = marzo (0-based)
  // Último domingo de octubre
  const dstEnd   = lastSundayOf(year, 9) // month 9 = octubre
  return (d >= dstStart && d < dstEnd) ? 2 : 1
}
function lastSundayOf(year, month) {
  const d = new Date(Date.UTC(year, month + 1, 0)) // último día del mes
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // retroceder al domingo
  return d
}

// ── Horario según fecha y día de semana ────────────────────────────────────
// Devuelve { startLocal: 'HH:MM', endLocal: 'HH:MM' } en hora España
function schedule(dateStr) {
  const month = parseInt(dateStr.slice(5, 7))
  const dow   = new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0=Dom,1=Lun,…,5=Vie
  const isSummer = (month === 7 || month === 8)
  if (isSummer) return { startLocal: '08:00', endLocal: '15:00' }
  if (dow === 5)  return { startLocal: '08:30', endLocal: '15:00' } // viernes
  return { startLocal: '08:30', endLocal: '16:15' }                 // lun-jue
}

function toUTC(dateStr, timeLocal, offsetH) {
  const [h, m] = timeLocal.split(':').map(Number)
  const utcH = h - offsetH
  const pad = n => String(n).padStart(2, '0')
  // Handle day rollover (unlikely at 08:xx with +1/+2 but safe)
  const baseDate = new Date(dateStr + 'T00:00:00Z')
  baseDate.setUTCHours(utcH, m, 0, 0)
  return baseDate.toISOString()
}

function buildEntry(email, dateStr) {
  const user    = USERS.find(u => u.email === email)
  const offset  = spainOffsetHours(dateStr)
  const { startLocal, endLocal } = schedule(dateStr)
  const startUtc = toUTC(dateStr, startLocal, offset)
  const endUtc   = toUTC(dateStr, endLocal,   offset)
  const duration = Math.floor((new Date(endUtc) - new Date(startUtc)) / 1000)
  const id = `ada-auto-${email.split('@')[0]}-${dateStr.replace(/-/g, '')}`
  return {
    id,
    workspace_id:  WS_ID,
    user_email:    email,
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
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Determinar la fecha de hoy en España
  const nowUtc   = new Date()
  const offsetH  = spainOffsetHours(nowUtc.toISOString().slice(0, 10))
  const spainNow = new Date(nowUtc.getTime() + offsetH * 3600_000)
  const todayStr = spainNow.toISOString().slice(0, 10)
  const dow      = spainNow.getUTCDay() // 0=Dom,6=Sáb

  // Solo laborables
  if (dow === 0 || dow === 6) {
    return res.status(200).json({ ok: true, skipped: 'weekend', date: todayStr })
  }
  if (isHoliday(todayStr)) {
    return res.status(200).json({ ok: true, skipped: 'holiday', date: todayStr })
  }

  const results = []

  for (const user of USERS) {
    // Comprobar si el usuario ya tiene algún registro hoy
    const dayStart = todayStr + 'T00:00:00+00:00'
    const dayEnd   = todayStr + 'T23:59:59+00:00'
    const { data: existing } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_email', user.email)
      .eq('workspace_id', WS_ID)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .limit(1)

    if (existing && existing.length > 0) {
      results.push({ email: user.email, status: 'skipped_has_entries' })
      continue
    }

    const entry = buildEntry(user.email, todayStr)
    const { error } = await supabase.from('time_entries').upsert(entry, { onConflict: 'id' })
    if (error) {
      results.push({ email: user.email, status: 'error', error: error.message })
    } else {
      results.push({ email: user.email, status: 'inserted' })
    }
  }

  const inserted = results.filter(r => r.status === 'inserted').length
  const skipped  = results.filter(r => r.status === 'skipped_has_entries').length
  console.log(`auto-imputacion ${todayStr}: ${inserted} insertadas, ${skipped} ya tenían registros`)

  return res.status(200).json({ ok: true, date: todayStr, inserted, skipped, results })
}
