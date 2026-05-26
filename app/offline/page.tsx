export default function OfflinePage() {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: '#0f172a', fontFamily: 'var(--font-dm-sans)' }}>
        <div className="text-center">
          <div className="text-6xl mb-6">📵</div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Vous êtes hors ligne
          </h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Vérifiez votre connexion internet et réessayez.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#2A4E94' }}>
            🔄 Réessayer
          </button>
          <div className="mt-8 p-4 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              PERCOM — PADES Microfinance
            </p>
          </div>
        </div>
      </div>
    )
  }