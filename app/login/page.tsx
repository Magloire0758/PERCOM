'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    if (agent?.role === 'dg') router.push('/dashboard/dg')
    else if (agent?.role === 'responsable') router.push('/dashboard/responsable')
    else if (agent?.role === 'chef') router.push('/dashboard/chef')
    else router.push('/dashboard/agent')
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-open-sans)' }}>

      {/* ── Panneau gauche — Branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: '#2A4E94' }}
      >
        {/* Cercles décoratifs */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: '#FFFFFF' }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ backgroundColor: '#E4322C' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5"
          style={{ backgroundColor: '#FFFFFF' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              P
            </div>
            <div>
              <div className="text-white font-bold text-2xl tracking-wide">PADES</div>
              <div className="text-xs tracking-widest" style={{ color: '#E4322C', fontWeight: 600 }}>
                MICROFINANCE
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
            CRÉONS DES COMMUNAUTÉS FORTES !
          </div>
        </div>

        {/* Contenu central */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              PERCOM
            </h1>
            <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Plateforme de suivi des performances des agents de collecte
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Agents suivis', value: 'En temps réel' },
              { label: 'Fiches digitales', value: 'Zéro papier' },
              { label: 'Calcul des primes', value: 'Automatique' },
              { label: 'Toutes agences', value: 'Centralisé' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <div className="text-white font-semibold text-sm">{item.value}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer gauche */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            © 2025 PADES Microfinance — Tous droits réservés
          </p>
        </div>
      </div>

      {/* ── Panneau droit — Formulaire ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: '#2A4E94' }}
            >
              P
            </div>
            <div>
              <div className="font-bold text-xl" style={{ color: '#2A4E94' }}>PADES</div>
              <div className="text-xs font-semibold" style={{ color: '#E4322C' }}>
                MICROFINANCE
              </div>
            </div>
          </div>

          {/* Header formulaire */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold" style={{ color: '#1a1a2e' }}>
              Bon retour 👋
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#818387' }}>
              Connectez-vous à votre espace PERCOM
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#1a1a2e' }}
              >
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border bg-white text-sm transition-all outline-none"
                  style={{
                    borderColor: '#e2e8f0',
                    color: '#1a1a2e',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2A4E94'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#1a1a2e' }}
              >
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border bg-white text-sm transition-all outline-none"
                  style={{
                    borderColor: '#e2e8f0',
                    color: '#1a1a2e',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2A4E94'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl text-sm"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-2"
              style={{
                backgroundColor: loading ? '#818387' : '#2A4E94',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1e3a70')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2A4E94')}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connexion en cours...
                </>
              ) : (
                <>
                  Se connecter
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Agences */}
          <div className="mt-10 pt-6 border-t" style={{ borderColor: '#e2e8f0' }}>
            <p className="text-xs text-center mb-3" style={{ color: '#818387' }}>
              Agences PADES Microfinance
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Assivito', 'Assigame', 'Adidoadin', 'Sagbado'].map((agence) => (
                <span
                  key={agence}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}
                >
                  {agence}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}