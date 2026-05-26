const CACHE_NAME = 'percom-v1'

const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard/agent',
  '/dashboard/agent/fiche',
  '/offline',
]

// Installation — mise en cache des ressources statiques
self.addEventListener('install', event => {
  console.log('[SW] Installation...')
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('[SW] Erreur cache install:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activation — nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[SW] Activation...')
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// Fetch — stratégie Network First avec fallback cache
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) return

  // Ignorer les requêtes Supabase (API) — toujours réseau
  if (url.hostname.includes('supabase.co')) return

  // Pour les navigations (pages HTML) — Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone))
          return response
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/offline'))
        )
    )
    return
  }

  // Pour les assets statiques — Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone))
          return response
        })
      })
    )
    return
  }

  // Défaut — Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// Notification push
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  const options = {
    body: data.message || 'Nouvelle notification PERCOM',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  }
  event.waitUntil(
    self.registration.showNotification(data.titre || 'PERCOM', options)
  )
})

// Clic sur notification
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})