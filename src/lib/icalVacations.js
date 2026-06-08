/**
 * Fetch, parse and import vacation events from the team Google Calendar.
 *
 * Event format: "VACACIONES: NOMBRE APELLIDO" or "VACACIONES - NOMBRE APELLIDO"
 * Dates are full-day (VALUE=DATE).  DTEND is exclusive in iCal.
 */

/** Normalize a string for fuzzy name matching (no accents, lowercase, trimmed) */
function norm(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Parse iCal text → array of { summary, dateFrom, dateTo (exclusive) } */
function parseIcal(text) {
  const events = []
  const blocks = text.split('BEGIN:VEVENT')
  for (const block of blocks.slice(1)) {
    const get = (key) => {
      const m = block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`))
      return m ? m[1].trim() : null
    }
    const summary  = get('SUMMARY')
    const dtstart  = get('DTSTART')
    const dtend    = get('DTEND')
    const status   = get('STATUS')
    if (!summary || !dtstart || status === 'CANCELLED') continue
    // Only process VACACIONES events
    if (!norm(summary).startsWith('vacaciones')) continue
    // Parse date: 20250818 → '2025-08-18'
    const toIso = d => d ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null
    events.push({ summary, dateFrom: toIso(dtstart), dateTo: toIso(dtend) })
  }
  return events
}

/** Return array of 'yyyy-MM-dd' working days (Mon–Fri) in [from, to) */
function workingDays(from, toExclusive) {
  const days = []
  let d = new Date(from + 'T12:00:00Z')
  const end = new Date(toExclusive + 'T12:00:00Z')
  while (d < end) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10))
    }
    d = new Date(d.getTime() + 86400000)
  }
  return days
}

// Nickname → canonical expansions (only used as FALLBACK if original doesn't match)
const NICKNAMES = {
  'javi': 'javier',
  'pepe': 'jose',
  'asun': 'asuncion',
  'paqui': 'francisca',
  'nacho': 'ignacio',
  'conchi': 'concepcion',
}

// Words to strip from event summaries before matching (prefixes/qualifiers)
const STRIP_WORDS = new Set([
  'maternidad', 'paternidad', 'baja', 'permiso', 'licencia',
  'medio', 'dia', 'manana', 'tarde', 'japon',
])

/** Try to find a member match given an array of name words */
function tryMatch(words, members) {
  if (words.length === 0) return null
  const sigWords = words.filter(w => w.length > 2)
  const fullName = words.join(' ')

  // 1. Exact full-name match
  let found = members.find(m => norm(m.user_name) === fullName)
  if (found) return found

  // 2. All significant event words appear as substrings in member name
  //    e.g. "MARIO HURTADO" → both words in "Mario Hurtado" ✓
  if (sigWords.length > 0) {
    found = members.find(m => {
      const mn = norm(m.user_name)
      return sigWords.every(w => mn.includes(w))
    })
    if (found) return found
  }

  // 3. Member's first 2 key words all appear in event words (array membership)
  //    e.g. "Pepe Gómez Palas" → keys ['pepe','gomez'] ⊆ ['pepe','gomez'] ✓
  //    e.g. "Marta García" → keys ['marta','garcia'] ⊆ ['marta','garcia','benlloch'] ✓
  found = members.find(m => {
    const mw = norm(m.user_name).split(/\s+/).filter(w => w.length > 2)
    const keyWords = mw.slice(0, 2)
    return keyWords.length > 0 && keyWords.every(w => words.includes(w))
  })
  if (found) return found

  // 4. First name only — unique match in team
  const first = words[0]
  if (first && first.length > 2) {
    const candidates = members.filter(m => norm(m.user_name).split(/\s+/)[0] === first)
    if (candidates.length === 1) return candidates[0]
  }

  return null
}

/**
 * Match an event summary to a workspace member.
 * Tries original words first, then nickname-expanded words as fallback.
 */
function matchMember(summary, members) {
  let namePart = norm(summary)
    .replace(/^vacaciones\s*[:\-–]?\s*/, '')
    .replace(/\(.*?\)/g, '')   // remove "(Japón)", "(Medio día)", etc.
    .trim()

  if (!namePart) return null

  const words = namePart
    .split(/\s+/)
    .filter(w => w.length > 0 && !STRIP_WORDS.has(w))

  if (words.length === 0) return null

  // Try with original words first (inma → inma, lola → lola, auxi → auxi)
  const direct = tryMatch(words, members)
  if (direct) return direct

  // Fallback: expand nicknames and retry
  const expanded = words.map(w => NICKNAMES[w] || w)
  if (expanded.join('') !== words.join('')) return tryMatch(expanded, members)

  return null
}

/**
 * Fetch the iCal, parse vacation events, and return a list of
 * { member, date, hours } rows ready to upsert into `vacations`.
 *
 * @param {Array}  members   workspace members with user_email, user_name, weekly_hours
 * @param {string} fromDate  'yyyy-MM-dd' — only import events that end after this date
 * @returns {{ rows, unmatched }}
 */
export async function fetchAndParseVacations(members, fromDate = '2024-01-01') {
  const res = await fetch('/api/ical-vacations')
  if (!res.ok) throw new Error('No se pudo obtener el calendario')
  const text = await res.text()

  const events = parseIcal(text)
  const rows = []
  const unmatched = []

  for (const ev of events) {
    // Skip events that ended before fromDate
    if (ev.dateTo && ev.dateTo <= fromDate) continue

    const member = matchMember(ev.summary, members)
    if (!member) {
      unmatched.push(ev.summary)
      continue
    }

    // Daily hours = weekly_hours / 5 working days
    const weeklyH = parseFloat(member.weekly_hours ?? 37.5)
    const dailyH  = parseFloat((weeklyH / 5).toFixed(2))

    const days = workingDays(ev.dateFrom, ev.dateTo || ev.dateFrom)
    for (const date of days) {
      if (date < fromDate) continue
      rows.push({
        userEmail:   member.user_email,
        workspaceId: member.workspace_id || null,
        date,
        hours:       dailyH,
        description: 'Vacaciones (Google Calendar)',
      })
    }
  }

  return { rows, unmatched: [...new Set(unmatched)] }
}
