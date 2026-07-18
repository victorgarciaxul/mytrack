// Vercel serverless function — proxy for the private Google Calendar iCal feed
// Avoids CORS issues when fetching from the browser.

const ICAL_URL = process.env.ICAL_VACATIONS_URL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const r = await fetch(ICAL_URL)
    if (!r.ok) return res.status(502).json({ error: 'Error fetching calendar' })
    const text = await r.text()
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.status(200).send(text)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
