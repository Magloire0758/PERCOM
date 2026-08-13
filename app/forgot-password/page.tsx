'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Veuillez saisir votre email.'); return }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-md">

        {!sent ? (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#EEF2FF' }}>
                <span className="text-3xl">🔑</span>
              </div>
              <h1 className="text-xl font-bold" style={{ color: '#2A4E94' }}>Mot de passe oublié</h1>
              <p className="text-sm mt-1" style={{ color: '#818387' }}>
                Saisissez votre email, nous vous enverrons un lien de réinitialisation.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                ❌ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#1a1a2e' }}>
                  Adresse email
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                  placeholder="votre@email.com" autoFocus />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ backgroundColor: loading ? '#818387' : '#2A4E94' }}>
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>
            </form>

            <button type="button" onClick={() => router.push('/login')}
              className="w-full mt-3 py-3 rounded-xl text-sm font-medium"
              style={{ color: '#818387' }}>
              ← Retour à la connexion
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#F0FDF4' }}>
              <span className="text-3xl">📬</span>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#166534' }}>Email envoyé !</h1>
            <p className="text-sm mb-1" style={{ color: '#818387' }}>
              Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
            </p>
            <p className="text-xs mb-6" style={{ color: '#818387' }}>
              Pensez à vérifier vos spams. Le lien expire après un délai limité.
            </p>
            <button type="button" onClick={() => router.push('/login')}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: '#2A4E94' }}>
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}