/**
 * Auto-imputación diaria para el equipo ADA.
 * Cron: lunes-viernes a las 20:00 UTC (22:00 hora España verano).
 * Solo inserta si el usuario no tiene ningún registro ese día.
 * Idempotente — safe to run multiple times.
 */

import { createClient } from '@supabase/supabase-js'
import { parseIcal, matchMember } from '../src/lib/icalVacations.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

const ICAL_URL =
  'https://calendar.google.com/calendar/ical/xul.es_9sihmss6cllthmfdd397ug869o%40group.calendar.google.com/private-2d0c526ca7baa801aef1049821e86bc2/basic.ics'

/** Devuelve el Set de emails (de USERS) que tienen vacación hoy según el calendario en vivo */
async function getEmailsOnVacationToday(todayStr) {
  try {
    const res = await fetch(ICAL_URL)
    if (!res.ok) return new Set()
    const text = await res.text()
    const events = parseIcal(text)
    const membersForMatch = USERS.map(u => ({ user_name: u.name, user_email: u.email }))
    const onVacation = new Set()
    for (const ev of events) {
      if (!ev.dateFrom) continue
      const dateTo = ev.dateTo || ev.dateFrom
      if (todayStr < ev.dateFrom || todayStr >= dateTo) continue
      const member = matchMember(ev.summary, membersForMatch)
      if (member) onVacation.add(member.user_email)
    }
    return onVacation
  } catch (err) {
    console.warn('No se pudo comprobar el calendario de vacaciones:', err.message)
    return new Set()
  }
}

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
  { email: 'pepegomez@xul.es',       name: 'Pepe Gómez Palas', taskId: '673afba6c736720c7f527126', taskName: 'Redactor' },
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

// Hueco mínimo a rellenar (en ms). Por debajo se ignora para no crear
// entradas ridículas de pocos minutos.
const MIN_GAP_MS = 15 * 60 * 1000

/**
 * Dado el tramo de jornada [winStart, winEnd] y las entradas que el usuario ya
 * tiene ese día, devuelve los huecos NO cubiertos dentro del tramo.
 * Las entradas se recortan al tramo (lo que caiga fuera no cuenta).
 */
function computeGaps(winStartMs, winEndMs, entries) {
  const clipped = entries
    .map(e => ({ s: Math.max(e.startMs, winStartMs), e: Math.min(e.endMs, winEndMs) }))
    .filter(iv => iv.e > iv.s)
    .sort((a, b) => a.s - b.s)

  // Fusionar solapes
  const merged = []
  for (const iv of clipped) {
    const last = merged[merged.length - 1]
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e)
    else merged.push({ ...iv })
  }

  // Huecos entre los tramos cubiertos
  const gaps = []
  let cursor = winStartMs
  for (const iv of merged) {
    if (iv.s > cursor) gaps.push({ s: cursor, e: iv.s })
    cursor = Math.max(cursor, iv.e)
  }
  if (cursor < winEndMs) gaps.push({ s: cursor, e: winEndMs })

  return gaps.filter(g => g.e - g.s >= MIN_GAP_MS)
}

function buildEntry(email, dateStr, startUtcMs, endUtcMs, suffix = '') {
  const user     = USERS.find(u => u.email === email)
  const duration = Math.floor((endUtcMs - startUtcMs) / 1000)
  const id = `ada-auto-${email.split('@')[0]}-${dateStr.replace(/-/g, '')}${suffix}`
  return {
    id,
    workspace_id:  WS_ID,
    user_email:    email,
    project_id:    PROJECT_ID,
    project_name:  PROJECT_NAME,
    task_id:       user.taskId,
    task_name:     user.taskName,
    description:   DESCRIPTION,
    start_time:    new Date(startUtcMs).toISOString(),
    end_time:      new Date(endUtcMs).toISOString(),
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

  // Comprobar el calendario de Google en vivo — no depende de que alguien
  // pulse "Sync Google Cal" a mano
  const onVacationToday = await getEmailsOnVacationToday(todayStr)

  // Tramo de jornada de hoy en UTC (ms)
  const offset = spainOffsetHours(todayStr)
  const { startLocal, endLocal } = schedule(todayStr)
  const winStartMs = new Date(toUTC(todayStr, startLocal, offset)).getTime()
  const winEndMs   = new Date(toUTC(todayStr, endLocal,   offset)).getTime()
  const dayStart = todayStr + 'T00:00:00+00:00'
  const dayEnd   = todayStr + 'T23:59:59+00:00'

  for (const user of USERS) {
    if (onVacationToday.has(user.email)) {
      results.push({ email: user.email, status: 'skipped_vacation_calendar' })
      continue
    }

    // Vacaciones/permiso ya registrado en la tabla
    const { data: vacation } = await supabase
      .from('vacations')
      .select('id')
      .eq('user_email', user.email)
      .eq('date', todayStr)
      .limit(1)

    if (vacation && vacation.length > 0) {
      results.push({ email: user.email, status: 'skipped_vacation' })
      continue
    }

    const slug = user.email.split('@')[0]
    const autoPrefix = `ada-auto-${slug}-`

    // Todas las entradas del usuario ese día
    const { data: dayEntries } = await supabase
      .from('time_entries')
      .select('id, description, start_time, end_time')
      .eq('user_email', user.email)
      .eq('workspace_id', WS_ID)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)

    const all = (dayEntries || []).filter(e => e.start_time && e.end_time)

    // Automáticas SIN editar (siguen diciendo "Tareas varias") = las gestiona el
    // sistema, se recalculan. Si el usuario editó una automática, ya NO es pristine
    // y se respeta como trabajo real.
    const pristineAutoIds = all
      .filter(e => e.id.startsWith(autoPrefix) && e.description === DESCRIPTION)
      .map(e => e.id)

    // Ocupación = todo lo que NO sea una automática pristine (manuales + autos editadas)
    const occupied = all
      .filter(e => !(e.id.startsWith(autoPrefix) && e.description === DESCRIPTION))
      .map(e => ({ startMs: new Date(e.start_time).getTime(), endMs: new Date(e.end_time).getTime() }))

    // Borrar solo las automáticas pristine para recalcular limpio (idempotente)
    if (pristineAutoIds.length) {
      await supabase.from('time_entries').delete().in('id', pristineAutoIds)
    }

    // Calcular huecos dentro del tramo y rellenarlos
    const gaps = computeGaps(winStartMs, winEndMs, occupied)
    if (gaps.length === 0) {
      results.push({ email: user.email, status: 'full_day_covered' })
      continue
    }

    // IDs con sufijo -fill{n} para no colisionar con una automática editada
    // que conserve el id base
    const rows = gaps.map((g, i) =>
      buildEntry(user.email, todayStr, g.s, g.e, `-fill${i + 1}`))
    const { error } = await supabase.from('time_entries').upsert(rows, { onConflict: 'id' })
    if (error) {
      results.push({ email: user.email, status: 'error', error: error.message })
    } else {
      results.push({ email: user.email, status: 'filled', gaps: gaps.length })
    }
  }

  const filled  = results.filter(r => r.status === 'filled').length
  const covered = results.filter(r => r.status === 'full_day_covered').length
  console.log(`auto-imputacion ${todayStr}: ${filled} rellenados, ${covered} ya completos`)

  return res.status(200).json({ ok: true, date: todayStr, filled, covered, results })
}
