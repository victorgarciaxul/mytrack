// MyTrack Service Worker — cache-first para assets, network-first para navegación
const CACHE = 'mytrack-v23'

// Al instalar: precachear la shell
self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/']))
  )
})

// Al activar: eliminar caches antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Ignorar: no-GET, extensiones Chrome, websockets
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Ignorar llamadas a la base de datos (siempre red)
  if (url.hostname.includes('neon.tech') || url.hostname.includes('supabase')) return

  // Navegación (HTML): network-first con fallback a index.html en caché
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
          return res
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    )
    return
  }

  // Assets estáticos (JS, CSS, imágenes, fuentes): cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
    })
  )
})
