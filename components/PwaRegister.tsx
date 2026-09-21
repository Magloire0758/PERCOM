'use client'

import { useEffect, useState } from 'react'
import { clearLocalPercomWorker, isLoopbackHost } from '@/lib/pwa-local'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaRegister() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || isLoopbackHost(window.location.hostname)) {
      // Un service worker de développement peut servir un ancien bundle Next.js
      // avec le HTML actuel et provoquer un échec d'hydratation.
      void clearLocalPercomWorker().catch(error => console.warn('[PERCOM] Nettoyage du cache local impossible.', error))

      return
    }

    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(registration => {
          console.log('[SW] Enregistré:', registration.scope)

          // Détecter mise à jour disponible
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true)
              }
            })
          })
        })
        .catch(err => console.log('[SW] Erreur:', err))
    }

    // Détecter si installable (Android Chrome)
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setDeferredPrompt(promptEvent)
      // Afficher le bouton d'installation après 3 secondes
      installPromptTimer = window.setTimeout(() => setShowInstall(true), 3000)
    }

    // Cacher le bouton si déjà installé
    const handleAppInstalled = () => {
      setShowInstall(false)
      setDeferredPrompt(null)
    }

    let installPromptTimer: number | undefined
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (installPromptTimer) window.clearTimeout(installPromptTimer)
    }
  }, [])

  function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(registration => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    })
    setShowUpdate(false)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
    setDeferredPrompt(null)
  }

  return (
    <>
      {/* Bandeau mise à jour disponible */}
      {showUpdate && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 text-white text-sm"
          style={{ backgroundColor: '#166534' }}>
          <span>🆕 Nouvelle version disponible !</span>
          <button onClick={handleUpdate}
            className="px-3 py-1 rounded-lg font-semibold text-xs"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            Mettre à jour
          </button>
        </div>
      )}

      {/* Bouton installer l'app (Android) */}
      {showInstall && (
        <div className="fixed bottom-24 left-4 right-4 z-50 rounded-2xl p-4 flex items-center justify-between shadow-2xl"
          style={{ backgroundColor: '#2A4E94' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>P</div>
            <div>
              <div className="font-bold text-white text-sm">Installer PERCOM</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Accès rapide depuis l&apos;écran d&apos;accueil
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowInstall(false)}
              className="px-3 py-2 rounded-xl text-xs"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
              Plus tard
            </button>
            <button onClick={handleInstall}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: 'white', color: '#2A4E94' }}>
              Installer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
