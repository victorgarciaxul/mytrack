/**
 * Holiday configuration for MyTrack compensation calculations.
 * Holidays reduce the "hours owed" for the week they fall in.
 * Only weekday holidays count (weekend holidays don't affect workday count).
 */

// ── Employee → city mapping ──────────────────────────────────────────────────
const CITY_MAP = {
  // Córdoba
  'aitorrecalde@xul.es':      'cordoba',
  'inmaosuna@xul.es':         'cordoba',
  'javier@xul.es':            'cordoba',
  'josemitoribio@xul.es':     'cordoba',
  'olgaalba@xul.es':          'cordoba',
  'silviamunoz@xul.es':       'cordoba',
  'sarasanchez@xul.es':       'cordoba',
  'anarojas@fundacionxul.org':'cordoba',
  'victorgarcia@xul.es':      'cordoba',
  // Sevilla
  'asuncionblanco@xul.es':    'sevilla',
  'carlagarcia@xul.es':       'sevilla',
  'elenarojo@xul.es':         'sevilla',
  'javierdura@xul.es':        'sevilla',
  'jorgemelo@xul.es':         'sevilla',
  'joseluisacedo@xul.es':     'sevilla',
  'josecastillo@xul.es':      'sevilla',
  'lolagravan@xul.es':        'sevilla',
  'martagarcia@xul.es':       'sevilla',
  'miguelperez@xul.es':       'sevilla',
  'rociohernandez@xul.es':    'sevilla',
  'pablohernandez@xul.es':    'sevilla',
  'pepegomez@xul.es':         'sevilla',
  'pilarsalles@xul.es':       'sevilla',
  'sandravinas@xul.es':       'sevilla',
  'mariohurtado@xul.es':      'sevilla',
  'mariopulido@xul.es':       'sevilla',
  'auximazuecos@xul.es':      'sevilla',
  'saracliment@xul.es':       'sevilla',
  'andreabenitez@xul.es':     'sevilla',
  // Cádiz
  'saramoran@xul.es':         'cadiz',
  // Chiclana
  'cristinareyes@fundacionxul.org': 'chiclana',
  // Málaga
  'alejandraperea@xul.es':    'malaga',
  'irenezurita@xul.es':       'malaga',
  'cristinafernandez@xul.es': 'malaga',
}

// ── Holiday lists by year ────────────────────────────────────────────────────
// Format: 'YYYY-MM-DD'
// Only include dates that CAN fall on a weekday (we filter weekends at runtime)

const HOLIDAYS = {
  2026: {
    // Festivos nacionales
    national: [
      '2026-01-01', // Año Nuevo (jueves) ✅
      '2026-01-06', // Reyes (martes) ✅
      '2026-04-03', // Viernes Santo ✅
      '2026-05-01', // Fiesta del Trabajo (viernes) ✅
      // '2026-08-15' → sábado, se pierde (pendiente compensación 14/08)
      '2026-10-12', // Fiesta Nacional (lunes) ✅
      // '2026-11-01' → domingo, no computa
      '2026-12-08', // Inmaculada (martes) ✅
      '2026-12-25', // Navidad (viernes) ✅
    ],
    // Festivos por convenio (todos los empleados)
    convenio: [
      '2026-01-30', // San Publicito (último viernes de enero) ✅
      '2026-02-28', // Día de Andalucía ✅  (también autonómico)
      '2026-04-02', // Jueves Santo ✅      (también autonómico)
      '2026-12-24', // Nochebuena ✅
      '2026-12-31', // Nochevieja ✅
    ],
    // Festivos locales por ciudad
    local: {
      sevilla:  ['2026-04-22', '2026-06-04'],
      cordoba:  ['2026-09-08', '2026-10-24'],
      malaga:   ['2026-08-19', '2026-09-08'],
      cadiz:    ['2026-02-16', '2026-10-07'],
      chiclana: ['2026-06-13', '2026-09-08'],
    },
  },

  2027: {
    national: [
      '2027-01-01', // Año Nuevo (viernes) ✅
      '2027-01-06', // Reyes (miércoles) ✅
      '2027-03-26', // Viernes Santo ✅
      // '2027-05-01' → sábado, no computa
      '2027-08-16', // Asunción (lunes) ✅
      '2027-10-12', // Fiesta Nacional (martes) ✅
      '2027-11-01', // Todos los Santos (lunes) ✅
      '2027-12-06', // Constitución (lunes) ✅
      '2027-12-08', // Inmaculada (miércoles) ✅
      // '2027-12-25' → sábado, no computa
    ],
    convenio: [
      '2027-01-29', // San Publicito (último viernes de enero) ✅
      '2027-03-01', // Día de Andalucía ✅  (también autonómico)
      '2027-03-25', // Jueves Santo ✅      (también autonómico)
      '2027-12-24', // Nochebuena ✅
      '2027-12-31', // Nochevieja ✅
    ],
    local: {
      sevilla:  ['2027-04-22', '2027-06-04'], // mismas fechas locales
      cordoba:  ['2027-09-08', '2027-10-25'], // 25/10 es lunes en 2027
      malaga:   ['2027-08-19', '2027-09-08'],
      cadiz:    ['2027-02-16', '2027-10-07'],
      chiclana: ['2027-06-13', '2027-09-08'],
    },
  },
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the Set of holiday dates (YYYY-MM-DD) applicable to a given user,
 * for the given year. Only includes weekdays.
 */
export function getHolidaysForUser(email, year) {
  const config = HOLIDAYS[year]
  if (!config) return new Set()

  const city = CITY_MAP[email?.toLowerCase()] || 'sevilla'

  const all = [
    ...(config.national || []),
    ...(config.convenio || []),
    ...(config.local[city] || []),
  ]

  // Filter out weekends (0=Sun, 6=Sat)
  return new Set(
    all.filter(d => {
      const dow = new Date(d + 'T12:00:00').getDay()
      return dow !== 0 && dow !== 6
    })
  )
}

/**
 * Returns the number of holiday weekdays inside the ISO week starting on `weekStart` (YYYY-MM-DD).
 * `weekStart` is always Monday.
 */
export function countHolidaysInWeek(email, weekStart) {
  const year = parseInt(weekStart.slice(0, 4), 10)
  // A week can span two years (e.g. last week of Dec / first of Jan)
  const years = new Set([year, year + 1])
  let count = 0
  years.forEach(y => {
    const holidays = getHolidaysForUser(email, y)
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart + 'T12:00:00')
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().slice(0, 10)
      if (holidays.has(ds)) count++
    }
  })
  return count
}

/**
 * Returns effective weekly hours owed, discounting holidays.
 * @param {string} email
 * @param {string} weekStart  YYYY-MM-DD (Monday)
 * @param {number} stdWeeklyHours  e.g. 37.5
 */
export function effectiveWeeklyHours(email, weekStart, stdWeeklyHours) {
  const dailyH = stdWeeklyHours / 5
  const holidays = countHolidaysInWeek(email, weekStart)
  return dailyH * (5 - holidays)
}
