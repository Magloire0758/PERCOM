'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 8) {
      setError('Minimum 8 caractères')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-3xl p-10 w-full max-w-md text-center border border-gray-100">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1a2e' }}>
          Mot de passe modifié !
        </h2>
        <p className="text-sm" style={{ color: '#818387' }}>
          Redirection vers la connexion...
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6"
      style={{ fontFamily: 'var(--font-dm-sans)' }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-md border border-gray-100 shadow-sm">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
            style={{ backgroundColor: '#2A4E94' }}>P</div>
          <div>
            <div className="font-bold" style={{ color: '#2A4E94' }}>PADES</div>
            <div className="text-xs font-semibold" style={{ color: '#E4322C' }}>MICROFINANCE</div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1a2e' }}>
          Nouveau mot de passe 🔐
        </h2>
        <p className="text-sm mb-6" style={{ color: '#818387' }}>
          Choisissez un mot de passe sécurisé pour votre compte.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
              Nouveau mot de passe
            </label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
              onFocus={e => e.target.style.borderColor = '#2A4E94'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              placeholder="Min. 8 caractères" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
              Confirmer le mot de passe
            </label>
            <input type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
              onFocus={e => e.target.style.borderColor = '#2A4E94'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              placeholder="Répétez le mot de passe" required />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              ❌ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: loading ? '#818387' : '#2A4E94' }}>
            {loading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}