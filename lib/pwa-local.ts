export function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

// Unregistering a worker does not detach it from an already open document.
// Reload once after cleanup so the next document gets its bundles from the network.
export async function clearLocalPercomWorker() {
  const ownsScript = (scriptURL: string) => {
    const url = new URL(scriptURL)
    return url.origin === window.location.origin && url.pathname === '/sw.js'
  }
  const controlled = 'serviceWorker' in navigator &&
    !!navigator.serviceWorker.controller && ownsScript(navigator.serviceWorker.controller.scriptURL)
  const registrations = 'serviceWorker' in navigator
    ? await navigator.serviceWorker.getRegistrations() : []
  await Promise.all([
    ...registrations.filter(registration =>
      [registration.active, registration.waiting, registration.installing]
        .some(worker => worker && ownsScript(worker.scriptURL)),
    ).map(registration => registration.unregister()),
    ...('caches' in window ? (await caches.keys())
      .filter(name => name.startsWith('percom-')).map(name => caches.delete(name)) : []),
  ])
  if (!controlled) return
  // This also prevents duplicate reloads from React Strict Mode effects.
  const key = 'percom-local-worker-reload'
  try {
    const last = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    console.warn('[PERCOM] Cache local nettoyé. Rechargez la page pour détacher l’ancien service worker.')
    return
  }
  window.location.reload()
}
