export default function Loading() {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#818387' }}>Chargement...</p>
        </div>
      </div>
    )
  }