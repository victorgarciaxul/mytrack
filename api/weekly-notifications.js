/**
 * Vercel Serverless Function — Notificaciones semanales de compensación
 *
 * GET /api/weekly-notifications
 *
 * Cron: cada lunes a las 07:00 (Europe/Madrid → 05:00 UTC en invierno, 06:00 en verano)
 * Configured in vercel.json: "0 6 * * 1"
 *
 * - Cada usuario recibe su resumen personal de la semana anterior
 * - Cada admin recibe un resumen del equipo completo
 */

import { supabaseSql } from './_supabase.js'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

const STANDARD_HOURS = 37.5
const WORKSPACES = ['xul-ws-1']

function fmtH(h) {
  const abs = Math.abs(h)
  const hh = Math.floor(abs)
  const mm = Math.round((abs - hh) * 60)
  const sign = h > 0 ? '+' : h < 0 ? '-' : ''
  return `${sign}${hh}h ${mm.toString().padStart(2, '0')}m`
}

export default async function handler(req, res) {
  // ── Date range: previous week ─────────────────────────────────
  const now = new Date()
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const prevWeekEnd   = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const wLabel = `${format(prevWeekStart, "d 'de' MMMM", { locale: es })} – ${format(prevWeekEnd, "d 'de' MMMM", { locale: es })}`

  try {
    const db = supabaseSql()
    let totalNotifications = 0

    for (const wsId of WORKSPACES) {
      // ── 1. Members with their all-time accumulated/compensated ──
      const members = await db`
        WITH weekly_hours AS (
          SELECT
            user_email,
            date_trunc('week', start_time AT TIME ZONE 'Europe/Madrid') AS wk,
            SUM(duration) / 3600.0 AS hours
          FROM time_entries
          WHERE workspace_id = ${wsId} AND duration > 0
          GROUP BY user_email, wk
        ),
        accumulated AS (
          SELECT user_email,
            SUM(GREATEST(0, hours - ${STANDARD_HOURS})) AS acumulado
          FROM weekly_hours
          GROUP BY user_email
        ),
        compensated AS (
          SELECT user_email, COALESCE(SUM(comp_hours), 0) AS compensado
          FROM hour_compensations
          WHERE workspace_id = ${wsId}
          GROUP BY user_email
        )
        SELECT
          wm.id, wm.user_name, wm.user_email, wm.role,
          ROUND(COALESCE(a.acumulado, 0)::numeric, 2)  AS acumulado,
          ROUND(COALESCE(c.compensado, 0)::numeric, 2) AS compensado,
          ROUND((COALESCE(a.acumulado, 0) - COALESCE(c.compensado, 0))::numeric, 2) AS debido
        FROM workspace_members wm
        LEFT JOIN accumulated a ON a.user_email = wm.user_email
        LEFT JOIN compensated c ON c.user_email = wm.user_email
        WHERE wm.workspace_id = ${wsId}
          AND wm.role NOT IN ('inactive')
        ORDER BY wm.user_name
      `

      // ── 2. Previous week hours per user ──────────────────────
      const prevWeekData = await db`
        SELECT user_email, SUM(duration) / 3600.0 AS hours
        FROM time_entries
        WHERE workspace_id = ${wsId}
          AND duration > 0
          AND start_time >= ${prevWeekStart.toISOString()}
          AND start_time <= ${prevWeekEnd.toISOString()}
        GROUP BY user_email
      `
      const prevWeekMap = {}
      prevWeekData.forEach(r => { prevWeekMap[r.user_email] = parseFloat(r.hours) })

      // ── 3. Send personal notification to each member ─────────
      const summaryLines = []
      const adminIds = members.filter(m => m.role === 'admin').map(m => m.id)

      const over  = []   // members with positive overtime
      const exact = []   // members exactly on target (±15min)
      const under = []   // members below target

      for (const m of members) {
        const weekH = prevWeekMap[m.user_email] || 0
        const diff  = weekH - STANDARD_HOURS
        const acu   = parseFloat(m.acumulado)
        const deb   = parseFloat(m.debido)

        // ── Personal message ───────────────────────────
        const statusLine = diff >= 0.25
          ? `✅  ${fmtH(diff)} por encima del estándar`
          : diff <= -0.25
          ? `⚠️  ${fmtH(Math.abs(diff))} por debajo del estándar`
          : `✅  Semana completada al 100%`

        const personalMsg = [
          `📅  Semana del ${wLabel}`,
          ``,
          `⏱  Horas registradas: ${fmtH(weekH)} / ${STANDARD_HOURS}h`,
          statusLine,
          ``,
          `📊  Balance acumulado`,
          `    • Acumulado (extras):  ${fmtH(acu)}`,
          `    • Debido (deuda):      ${fmtH(deb)}`,
        ].join('\n')

        await db`
          INSERT INTO notifications
            (workspace_id, user_id, sender_email, sender_name, type, title, message)
          VALUES (
            ${wsId}, ${m.id}, 'system@mytrack.xul.es', 'MyTrack',
            'weekly_summary',
            ${'📊 Tu resumen semanal · ' + wLabel},
            ${personalMsg}
          )
        `
        totalNotifications++

        // Group for admin summary
        if (diff >= 0.25)       over.push({ name: m.user_name, weekH, diff, deb })
        else if (diff <= -0.25) under.push({ name: m.user_name, weekH, diff, deb })
        else                    exact.push({ name: m.user_name, weekH })
      }

      // ── 4. Admin summary ─────────────────────────────
      if (adminIds.length > 0) {
        const fmtLine = (icon, name, weekH, diff, deb) =>
          `${icon}  ${name.padEnd(24)} ${fmtH(weekH)}  (${diff >= 0 ? '+' : ''}${fmtH(diff)}${deb > 0.1 ? `  debe: ${fmtH(deb)}` : ''})`

        const adminMsg = [
          `Semana del ${wLabel}  ·  ${members.length} miembros`,
          ``,
          ...(over.length  ? [`🔵 Por encima de ${STANDARD_HOURS}h ──────────────────`, ...over.map(u  => fmtLine('🔵', u.name, u.weekH, u.diff, u.deb)),  ``] : []),
          ...(exact.length ? [`🟢 Estándar cumplido ─────────────────────────`, ...exact.map(u => fmtLine('🟢', u.name, u.weekH, 0, 0)),                    ``] : []),
          ...(under.length ? [`🔴 Por debajo de ${STANDARD_HOURS}h ───────────────────`, ...under.map(u => fmtLine('🔴', u.name, u.weekH, u.diff, u.deb)), ``] : []),
          `Ver detalle completo en Compensación de horas`,
        ].join('\n')

        for (const adminId of adminIds) {
          await db`
            INSERT INTO notifications
              (workspace_id, user_id, sender_email, sender_name, type, title, message)
            VALUES (
              ${wsId}, ${adminId}, 'system@mytrack.xul.es', 'MyTrack',
              'weekly_admin_summary',
              ${'👥 Resumen equipo · ' + wLabel},
              ${adminMsg}
            )
          `
          totalNotifications++
        }
      }
    }

    res.status(200).json({ ok: true, notifications: totalNotifications, week: wLabel })
  } catch (err) {
    console.error('[weekly-notifications] error:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
}
