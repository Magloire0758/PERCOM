'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function FicheJournaliere() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [agent, setAgent] = useState<any>(null)
  const [ficheDuJour, setFicheDuJour] = useState<any>(null)
  const [files, setFiles] = useState<File[]>([])
  const [form, setForm] = useState({
    comptes_ouverts: '',
    comptes_actives: '',
    montant_mobilise: '',
    montant_rapporte: '',
    nb_depots: '',
    prospects_visites: '',
    clients_suivis: '',
    assurances_vendues: '',
    montant_assurances: '',
  })

  const today = new Date().toISOString().split('T')[0]
  const manquant = Math.max(0,
    (parseFloat(form.montant_mobilise) || 0) -
    (parseFloat(form.montant_rapporte) || 0)
  )

  useEffect(() => {
    loadAgent()
  }, [])

  async function loadAgent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('Agent data:', data)
    console.log('Agent error:', error)

    if (!data) {
      console.log('Aucun agent trouvé pour cet utilisateur')
      return
    }

    setAgent(data)

    const { data: fiche } = await supabase
      .from('fiches_journalieres')
      .select('*')
      .eq('agent_id', data.id)
      .eq('date', today)
      .maybeSingle()

    if (fiche) setFicheDuJour(fiche)
  }

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agent) return
    setLoading(true)

    // 1. Créer la fiche
    const { data: fiche, error } = await supabase
      .from('fiches_journalieres')
      .insert({
        agent_id: agent.id,
        equipe_id: agent.equipe_id,
        date: today,
        comptes_ouverts: parseInt(form.comptes_ouverts) || 0,
        comptes_actives: parseInt(form.comptes_actives) || 0,
        montant_mobilise: parseFloat(form.montant_mobilise) || 0,
        montant_rapporte: parseFloat(form.montant_rapporte) || 0,
        nb_depots: parseInt(form.nb_depots) || 0,
        prospects_visites: parseInt(form.prospects_visites) || 0,
        clients_suivis: parseInt(form.clients_suivis) || 0,
        assurances_vendues: parseInt(form.assurances_vendues) || 0,
        montant_assurances: parseFloat(form.montant_assurances) || 0,
      })
      .select()
      .single()

    if (error) { setLoading(false); alert('Erreur: ' + error.message); return }

    // 2. Upload des pièces jointes
    for (const file of files) {
      const path = `${agent.id}/${today}/${file.name}`
      const { data: upload } = await supabase.storage
        .from('fiches-jointes')
        .upload(path, file, { upsert: true })

      if (upload) {
        const { data: urlData } = supabase.storage
          .from('fiches-jointes')
          .getPublicUrl(path)

        await supabase.from('pieces_jointes').insert({
          fiche_id: fiche.id,
          agent_id: agent.id,
          nom_fichier: file.name,
          url: urlData.publicUrl,
          type_fichier: file.type,
          taille: file.size,
        })
      }
    }

    setSuccess(true)
    setLoading(false)
    setFicheDuJour(fiche)
  }

  // ── Fiche déjà soumise ──
  if (ficheDuJour) {
    const m = (ficheDuJour.montant_mobilise || 0) - (ficheDuJour.montant_rapporte || 0)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#EEF2FF' }}>
            <svg className="w-8 h-8" style={{ color: '#2A4E94' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#2A4E94' }}>
            Fiche soumise ✅
          </h2>
          <p className="text-sm mb-6" style={{ color: '#818387' }}>
            Votre fiche du {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} a été soumise.
          </p>

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-3 text-left mb-6">
            {[
              { label: 'Comptes ouverts', value: ficheDuJour.comptes_ouverts },
              { label: 'Comptes activés', value: ficheDuJour.comptes_actives },
              { label: 'Montant collecté', value: ficheDuJour.montant_mobilise?.toLocaleString() + ' FCFA' },
              { label: 'Montant rapporté', value: ficheDuJour.montant_rapporte?.toLocaleString() + ' FCFA' },
              { label: 'Dépôts', value: ficheDuJour.nb_depots },
              { label: 'Prospects', value: ficheDuJour.prospects_visites },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                <div className="font-semibold text-sm mt-1" style={{ color: '#1a1a2e' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Manquant */}
          {m > 0 && (
            <div className="rounded-xl p-4 mb-6 text-left"
              style={{ backgroundColor: ficheDuJour.manquant_regle ? '#F0FDF4' : '#FEF2F2' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold"
                  style={{ color: ficheDuJour.manquant_regle ? '#166534' : '#991B1B' }}>
                  Manquant : {m.toLocaleString()} FCFA
                </span>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: ficheDuJour.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                    color: ficheDuJour.manquant_regle ? '#166534' : '#991B1B'
                  }}>
                  {ficheDuJour.manquant_regle ? '✅ Réglé' : '⚠️ En attente'}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/agent')}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#2A4E94' }}>
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire ──
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/agent')}
            className="flex items-center gap-2 text-sm mb-4"
            style={{ color: '#818387' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </button>
          <h1 className="text-2xl font-bold" style={{ color: '#2A4E94' }}>
            Fiche journalière
          </h1>
          <p className="text-sm mt-1" style={{ color: '#818387' }}>
            {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {agent && ` — ${agent.prenom} ${agent.nom}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Section 1 — Comptes */}
          <Section title="Comptes" icon="🏦">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Comptes ouverts" objectif="≥ 6"
                value={form.comptes_ouverts}
                onChange={v => handleChange('comptes_ouverts', v)}
                type="number" />
              <Field label="Comptes activés" objectif="≥ 4"
                value={form.comptes_actives}
                onChange={v => handleChange('comptes_actives', v)}
                type="number" />
            </div>
          </Section>

          {/* Section 2 — Montants */}
          <Section title="Montants (FCFA)" icon="💰">
            <div className="space-y-4">
              <Field label="Montant collecté (carnets)" objectif="≥ 25 000"
                value={form.montant_mobilise}
                onChange={v => handleChange('montant_mobilise', v)}
                type="number" suffix="FCFA" />
              <Field label="Montant effectivement rapporté"
                value={form.montant_rapporte}
                onChange={v => handleChange('montant_rapporte', v)}
                type="number" suffix="FCFA" />

              {/* Manquant calculé automatiquement */}
              {(parseFloat(form.montant_mobilise) > 0 || parseFloat(form.montant_rapporte) > 0) && (
                <div className={`rounded-xl p-4 flex items-center justify-between`}
                  style={{ backgroundColor: manquant > 0 ? '#FEF2F2' : '#F0FDF4' }}>
                  <div>
                    <div className="text-xs font-medium" style={{ color: manquant > 0 ? '#991B1B' : '#166534' }}>
                      Manquant calculé automatiquement
                    </div>
                    <div className="text-lg font-bold mt-1" style={{ color: manquant > 0 ? '#E4322C' : '#166534' }}>
                      {manquant.toLocaleString()} FCFA
                    </div>
                  </div>
                  <div className="text-2xl">{manquant > 0 ? '⚠️' : '✅'}</div>
                </div>
              )}
            </div>
          </Section>

          {/* Section 3 — Activités */}
          <Section title="Activités terrain" icon="📋">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre de dépôts" objectif="≥ 5"
                value={form.nb_depots}
                onChange={v => handleChange('nb_depots', v)}
                type="number" />
              <Field label="Prospects visités" objectif="≥ 10"
                value={form.prospects_visites}
                onChange={v => handleChange('prospects_visites', v)}
                type="number" />
              <Field label="Clients suivis/relancés" objectif="≥ 5"
                value={form.clients_suivis}
                onChange={v => handleChange('clients_suivis', v)}
                type="number" />
              <Field label="Assurances vendues"
                value={form.assurances_vendues}
                onChange={v => handleChange('assurances_vendues', v)}
                type="number" />
            </div>
            <div className="mt-4">
              <Field label="Montant assurances (FCFA)"
                value={form.montant_assurances}
                onChange={v => handleChange('montant_assurances', v)}
                type="number" suffix="FCFA" />
            </div>
          </Section>

          {/* Section 4 — Pièces jointes */}
          <Section title="Pièces jointes" icon="📎">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all"
              style={{ borderColor: '#2A4E94', backgroundColor: '#EEF2FF' }}>
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-2" style={{ color: '#2A4E94' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium" style={{ color: '#2A4E94' }}>
                  Cliquez pour ajouter des fichiers
                </p>
                <p className="text-xs mt-1" style={{ color: '#818387' }}>
                  Photos, reçus, documents (PDF, JPG, PNG)
                </p>
              </div>
              <input type="file" multiple onChange={handleFiles} className="hidden"
                accept="image/*,.pdf" />
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#2A4E94' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm flex-1 truncate" style={{ color: '#1a1a2e' }}>{f.name}</span>
                    <span className="text-xs" style={{ color: '#818387' }}>
                      {(f.size / 1024).toFixed(0)} Ko
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Bouton soumettre */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: loading ? '#818387' : '#2A4E94' }}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Envoi en cours...
              </>
            ) : (
              <>
                Soumettre ma fiche
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  )
}

// ── Composant Section ──
function Section({ title, icon, children }: {
  title: string, icon: string, children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"
        style={{ color: '#2A4E94' }}>
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}

// ── Composant Field ──
function Field({ label, value, onChange, type = 'text', suffix, objectif }: {
  label: string, value: string, onChange: (v: string) => void,
  type?: string, suffix?: string, objectif?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{label}</label>
        {objectif && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
            Objectif : {objectif}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          min={0}
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
          style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
          onFocus={e => e.target.style.borderColor = '#2A4E94'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          placeholder="0"
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: '#818387' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}