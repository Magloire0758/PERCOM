'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register' | 'pending' | 'blocked'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    prenom: '', nom: '', email: '', telephone: '', agence: '', password: '', confirm: ''
  })

  const agences = ['Agence Assivito', 'Agence Assigame', 'Agence Adidoadin', 'Agence Sagbado']

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('role, statut')
      .eq('user_id', data.user.id)
      .single()

    if (!agent) {
      setError("Compte introuvable. Contactez l'administrateur.")
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (agent.statut === 'en_attente') {
      await supabase.auth.signOut()
      setMode('pending')
      setLoading(false)
      return
    }

    if (agent.statut === 'bloque') {
      await supabase.auth.signOut()
      setMode('blocked')
      setLoading(false)
      return
    }

    if (agent.role === 'dg') router.push('/dashboard/dg')
    else if (agent.role === 'responsable') router.push('/dashboard/responsable')
    else if (agent.role === 'chef') router.push('/dashboard/chef')
    else router.push('/dashboard/agent')
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (registerForm.password !== registerForm.confirm) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (registerForm.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setLoading(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: registerForm.email,
      password: registerForm.password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Erreur lors de la création du compte')
      setLoading(false)
      return
    }

    const { data: agenceData } = await supabase
      .from('agences')
      .select('id')
      .eq('nom', registerForm.agence)
      .single()

    await supabase.from('agents').insert({
      user_id: data.user.id,
      nom: registerForm.nom,
      prenom: registerForm.prenom,
      telephone: registerForm.telephone,
      agence_id: agenceData?.id || null,
      role: 'agent',
      actif: false,
      statut: 'en_attente',
    })

    await supabase.auth.signOut()
    setMode('pending')
    setLoading(false)
  }

  if (mode === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#FEF9C3' }}>
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#1a1a2e' }}>
            Compte en attente
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#818387' }}>
            Votre demande a bien été enregistrée. Un administrateur PADES va examiner
            et activer votre compte dans les plus brefs délais.
          </p>
          <div className="rounded-2xl p-4 mb-6 text-left space-y-2"
            style={{ backgroundColor: '#F8FAFC' }}>
            {[
              '✅ Votre compte a été créé',
              "⏳ En attente de validation par l'admin",
              '📧 Vous serez notifié par email',
            ].map(s => (
              <div key={s} className="text-sm" style={{ color: '#1a1a2e' }}>{s}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode('login')}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#2A4E94', color: 'white' }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: '#FEE2E2' }}>
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#991B1B' }}>
            Compte bloqué
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#818387' }}>
            Votre compte a été suspendu. Contactez votre responsable ou
            l&apos;administrateur PADES pour plus d&apos;informations.
          </p>
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: '#FEF2F2' }}>
            <p className="text-sm font-medium" style={{ color: '#991B1B' }}>
              📞 +228 70 35 37 25 / 70 35 37 30
            </p>
            <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>
              padestogo2009@gmail.com
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMode('login')}
            className="w-full py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: '#E4322C', color: '#E4322C', backgroundColor: 'white' }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-dm-sans)' }}>

      {/* Panneau gauche */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: '#2A4E94' }}>
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: '#FFFFFF' }} />
        <div className="absolute -bottom-32 -right-16 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ backgroundColor: '#E4322C' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>P</div>
            <div>
              <div className="text-white font-bold text-2xl tracking-wide">PADES</div>
              <div className="text-xs tracking-widest font-semibold" style={{ color: '#E4322C' }}>
                MICROFINANCE
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
            CRÉONS DES COMMUNAUTÉS FORTES !
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">PERCOM</h1>
            <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Plateforme de suivi des performances des agents de collecte
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Agents suivis', value: 'En temps réel' },
              { label: 'Fiches digitales', value: 'Zéro papier' },
              { label: 'Calcul des primes', value: 'Automatique' },
              { label: 'Toutes agences', value: 'Centralisé' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <div className="text-white font-semibold text-sm">{item.value}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            © 2025 PADES Microfinance — Tous droits réservés
          </p>
        </div>
      </div>

      {/* Panneau droit */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-md py-8">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
              style={{ backgroundColor: '#2A4E94' }}>P</div>
            <div>
              <div className="font-bold text-xl" style={{ color: '#2A4E94' }}>PADES</div>
              <div className="text-xs font-semibold" style={{ color: '#E4322C' }}>MICROFINANCE</div>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex rounded-2xl p-1 mb-8" style={{ backgroundColor: '#f1f5f9' }}>
            {[
              { key: 'login', label: 'Connexion' },
              { key: 'register', label: 'Créer un compte' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setMode(tab.key as Mode); setError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: mode === tab.key ? 'white' : 'transparent',
                  color: mode === tab.key ? '#2A4E94' : '#818387',
                  boxShadow: mode === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Formulaire connexion */}
          {mode === 'login' && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold" style={{ color: '#1a1a2e' }}>Bon retour 👋</h2>
                <p className="mt-2 text-sm" style={{ color: '#818387' }}>
                  Connectez-vous à votre espace PERCOM
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <InputField label="Adresse email" type="email" value={loginForm.email}
                  onChange={v => setLoginForm(p => ({ ...p, email: v }))}
                  placeholder="votre@email.com" icon="email" />

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LockIcon />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl border bg-white text-sm outline-none transition-all"
                      style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                      onFocus={e => e.target.style.borderColor = '#2A4E94'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      placeholder="••••••••"
                      required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <EyeIcon show={showPassword} />
                    </button>
                  </div>
                </div>

                {error && <ErrorBox message={error} />}
                <SubmitButton loading={loading} label="Se connecter" />
              </form>
            </>
          )}

          {/* Formulaire inscription */}
          {mode === 'register' && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold" style={{ color: '#1a1a2e' }}>Créer un compte 🚀</h2>
                <p className="mt-2 text-sm" style={{ color: '#818387' }}>
                  Votre compte sera activé par un administrateur
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Prénom" type="text" value={registerForm.prenom}
                    onChange={v => setRegisterForm(p => ({ ...p, prenom: v }))}
                    placeholder="Jean" icon="user" required />
                  <InputField label="Nom" type="text" value={registerForm.nom}
                    onChange={v => setRegisterForm(p => ({ ...p, nom: v }))}
                    placeholder="Kodjo" icon="user" required />
                </div>

                <InputField label="Adresse email" type="email" value={registerForm.email}
                  onChange={v => setRegisterForm(p => ({ ...p, email: v }))}
                  placeholder="votre@email.com" icon="email" required />

                <InputField label="Téléphone" type="tel" value={registerForm.telephone}
                  onChange={v => setRegisterForm(p => ({ ...p, telephone: v }))}
                  placeholder="+228 9X XX XX XX" icon="phone" />

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
                    Agence
                  </label>
                  <select
                    value={registerForm.agence}
                    onChange={e => setRegisterForm(p => ({ ...p, agence: e.target.value }))}
                    className="w-full px-4 py-3.5 rounded-xl border bg-white text-sm outline-none"
                    style={{ borderColor: '#e2e8f0', color: registerForm.agence ? '#1a1a2e' : '#818387' }}
                    required>
                    <option value="">Sélectionnez votre agence</option>
                    {agences.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LockIcon />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={registerForm.password}
                      onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl border bg-white text-sm outline-none"
                      style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                      onFocus={e => e.target.style.borderColor = '#2A4E94'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      placeholder="Min. 8 caractères"
                      required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <EyeIcon show={showPassword} />
                    </button>
                  </div>
                </div>

                <InputField label="Confirmer le mot de passe" type="password"
                  value={registerForm.confirm}
                  onChange={v => setRegisterForm(p => ({ ...p, confirm: v }))}
                  placeholder="Répétez le mot de passe" icon="lock" required />

                {error && <ErrorBox message={error} />}

                <div className="rounded-xl p-4" style={{ backgroundColor: '#EEF2FF' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#2A4E94' }}>
                    ℹ️ Après inscription, votre compte sera en attente de validation par un
                    administrateur PADES avant de pouvoir vous connecter.
                  </p>
                </div>

                <SubmitButton loading={loading} label="Créer mon compte" />
              </form>
            </>
          )}

          {/* Agences */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: '#e2e8f0' }}>
            <p className="text-xs text-center mb-3" style={{ color: '#818387' }}>
              Agences PADES Microfinance
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Assivito', 'Assigame', 'Adidoadin', 'Sagbado'].map(a => (
                <span key={a} className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                  {a}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function InputField({ label, type, value, onChange, placeholder, icon, required }: {
  label: string, type: string, value: string, onChange: (v: string) => void,
  placeholder: string, icon: string, required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {icon === 'email' && <EmailIcon />}
          {icon === 'user' && <UserIcon />}
          {icon === 'phone' && <PhoneIcon />}
          {icon === 'lock' && <LockIcon />}
        </div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border bg-white text-sm outline-none transition-all"
          style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
          onFocus={e => e.target.style.borderColor = '#2A4E94'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          placeholder={placeholder}
          required={required} />
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl text-sm"
      style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      {message}
    </div>
  )
}

function SubmitButton({ loading, label }: { loading: boolean, label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
      style={{ backgroundColor: loading ? '#818387' : '#2A4E94', cursor: loading ? 'not-allowed' : 'pointer' }}
      onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#1e3a70')}
      onMouseLeave={e => !loading && (e.currentTarget.style.backgroundColor = '#2A4E94')}>
      {loading ? (
        <>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement...
        </>
      ) : (
        <>
          {label}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </>
      )}
    </button>
  )
}

const EmailIcon = () => (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const UserIcon = () => (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const PhoneIcon = () => (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)
const LockIcon = () => (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)
const EyeIcon = ({ show }: { show: boolean }) => show ? (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
  </svg>
) : (
  <svg className="w-5 h-5" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)