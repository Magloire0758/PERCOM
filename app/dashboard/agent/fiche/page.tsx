'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

interface Reactivation {
  id?: string
  n_client: string
  nom_prenom: string
  produit: string
  mise: string
  nouvelle_mise: string
  montant_cotise: string
  reactif: boolean
  commentaire: string
}

interface AugmentationMise {
  id?: string
  nom_client: string
  ancienne_mise: string
  nouvelle_mise: string
  motif: string
}

interface AssuranceDetail {
  type_assurance: 'Honaméto' | 'Akofa'
  nb: string
  montant: string
}

const MAX_JOURS_RETRO = 10

export default function FicheJournaliere() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const dateParam = searchParams.get('date')
  const editParam = searchParams.get('edit')

  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [agent, setAgent] = useState<any>(null)
  const [ficheExistante, setFicheExistante] = useState<any>(null)
  const [erreurAcces, setErreurAcces] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Mode
  const isEdit = !!editParam
  const [dateFiche, setDateFiche] = useState<string>('')

  const [sectionsOuvertes, setSectionsOuvertes] = useState({
    comptes: true, montants: true, activites: true,
    depots: false, reactivations: false, augmentations: false, assurances: false,
  })

  const [form, setForm] = useState({
    comptes_ouverts_dat: '',
    montant_smart: '',
    montant_caisse: '',
    commission_jour: '',
    nb_clients_parcourus: '',
    nb_adhesions: '',
    nb_abonnements_lyde_cash: '',
    montant_depot_pe: '',
    montant_depot_dat: '',
    montant_depot_dav: '',
    observations: '',
  })

  const [reactivations, setReactivations] = useState<Reactivation[]>([])
  const [augmentations, setAugmentations] = useState<AugmentationMise[]>([])
  const [assurances, setAssurances] = useState<AssuranceDetail[]>([
    { type_assurance: 'Honaméto', nb: '', montant: '' },
    { type_assurance: 'Akofa', nb: '', montant: '' },
  ])

  const today = new Date().toISOString().split('T')[0]
  const dateMin = (() => {
    const d = new Date()
    d.setDate(d.getDate() - MAX_JOURS_RETRO)
    return d.toISOString().split('T')[0]
  })()

  // Calculs
  const montantSmart = parseFloat(form.montant_smart) || 0
  const montantCaisse = parseFloat(form.montant_caisse) || 0
  const ecart = montantSmart - montantCaisse
  const typeEcart = ecart > 0 ? 'manquant' : ecart < 0 ? 'surplus' : 'ok'
  const totalAutresDepots = (parseFloat(form.montant_depot_pe) || 0) + (parseFloat(form.montant_depot_dat) || 0) + (parseFloat(form.montant_depot_dav) || 0)
  const totalReactivations = reactivations.reduce((s, r) => s + (parseFloat(r.montant_cotise) || 0), 0)
  const totalAssurancesNb = assurances.reduce((s, a) => s + (parseInt(a.nb) || 0), 0)
  const totalAssurancesMontant = assurances.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)

  useEffect(() => { init() }, [])

  async function init() {
    setInitLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: a } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
    if (!a) { router.push('/login'); return }
    setAgent(a)

    // ── MODE ÉDITION ──
    if (editParam) {
      const { data: f } = await supabase.from('fiches_journalieres')
        .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
        .eq('id', editParam).eq('agent_id', a.id).maybeSingle()

      if (!f) { setErreurAcces('Fiche introuvable.'); setInitLoading(false); return }
      if (f.statut_validation === 'validee') {
        setErreurAcces('Cette fiche est déjà validée et ne peut plus être modifiée.')
        setInitLoading(false); return
      }

      setDateFiche(f.date)
      setForm({
        comptes_ouverts_dat: String(f.comptes_ouverts_dat ?? f.comptes_ouverts ?? ''),
        montant_smart: String(f.montant_smart ?? f.montant_mobilise ?? ''),
        montant_caisse: String(f.montant_caisse ?? f.montant_rapporte ?? ''),
        commission_jour: String(f.commission_jour ?? ''),
        nb_clients_parcourus: String(f.nb_clients_parcourus ?? ''),
        nb_adhesions: String(f.nb_adhesions ?? ''),
        nb_abonnements_lyde_cash: String(f.nb_abonnements_lyde_cash ?? ''),
        montant_depot_pe: String(f.montant_depot_pe ?? ''),
        montant_depot_dat: String(f.montant_depot_dat ?? ''),
        montant_depot_dav: String(f.montant_depot_dav ?? ''),
        observations: f.observations ?? '',
      })
      setReactivations((f.reactivations || []).map((r: any) => ({
        n_client: r.n_client ?? '', nom_prenom: r.nom_prenom ?? '', produit: r.produit ?? 'TONTINE',
        mise: String(r.mise ?? ''), nouvelle_mise: String(r.nouvelle_mise ?? ''),
        montant_cotise: String(r.montant_cotise ?? ''), reactif: r.reactif ?? true,
        commentaire: r.commentaire ?? '',
      })))
      setAugmentations((f.augmentations_mise || []).map((x: any) => ({
        nom_client: x.nom_client ?? '', ancienne_mise: String(x.ancienne_mise ?? ''),
        nouvelle_mise: String(x.nouvelle_mise ?? ''), motif: x.motif ?? 'EPARGNE',
      })))
      const hona = (f.assurances_details || []).find((x: any) => x.type_assurance === 'Honaméto')
      const akofa = (f.assurances_details || []).find((x: any) => x.type_assurance === 'Akofa')
      setAssurances([
        { type_assurance: 'Honaméto', nb: String(hona?.nb ?? ''), montant: String(hona?.montant ?? '') },
        { type_assurance: 'Akofa', nb: String(akofa?.nb ?? ''), montant: String(akofa?.montant ?? '') },
      ])
      if ((f.reactivations || []).length > 0) setSectionsOuvertes(p => ({ ...p, reactivations: true }))
      if ((f.augmentations_mise || []).length > 0) setSectionsOuvertes(p => ({ ...p, augmentations: true }))
      setInitLoading(false)
      return
    }

    // ── MODE CRÉATION (jour ou antérieure) ──
    const cible = dateParam || today

    if (cible > today) {
      setErreurAcces('Impossible de créer une fiche pour une date future.')
      setInitLoading(false); return
    }
    if (cible < dateMin) {
      setErreurAcces(`Vous ne pouvez pas remonter au-delà de ${MAX_JOURS_RETRO} jours.`)
      setInitLoading(false); return
    }

    setDateFiche(cible)

    const { data: existante } = await supabase.from('fiches_journalieres')
      .select('id, statut_validation').eq('agent_id', a.id).eq('date', cible).maybeSingle()

    if (existante) {
      if (existante.statut_validation === 'validee') {
        setFicheExistante(existante)
        setErreurAcces('Une fiche validée existe déjà pour cette date.')
        setInitLoading(false); return
      }
      // Redirection vers modification
      router.replace(`/dashboard/agent/fiche?edit=${existante.id}`)
      return
    }

    setInitLoading(false)
  }

  function toggleSection(key: keyof typeof sectionsOuvertes) {
    setSectionsOuvertes(p => ({ ...p, [key]: !p[key] }))
  }

  function ajouterReactivation() {
    setReactivations(prev => [...prev, {
      n_client: '', nom_prenom: '', produit: 'TONTINE',
      mise: '', nouvelle_mise: '', montant_cotise: '', reactif: true, commentaire: ''
    }])
    if (!sectionsOuvertes.reactivations) toggleSection('reactivations')
  }
  function updateReactivation(i: number, field: keyof Reactivation, v: string | boolean) {
    setReactivations(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: v } : r))
  }
  function supprimerReactivation(i: number) {
    setReactivations(prev => prev.filter((_, idx) => idx !== i))
  }

  function ajouterAugmentation() {
    setAugmentations(prev => [...prev, { nom_client: '', ancienne_mise: '', nouvelle_mise: '', motif: 'EPARGNE' }])
    if (!sectionsOuvertes.augmentations) toggleSection('augmentations')
  }
  function updateAugmentation(i: number, field: keyof AugmentationMise, v: string) {
    setAugmentations(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: v } : a))
  }
  function supprimerAugmentation(i: number) {
    setAugmentations(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateAssurance(i: number, field: keyof AssuranceDetail, v: string) {
    setAssurances(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: v } : a))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agent) return
    setLoading(true)

    const payload = {
      agent_id: agent.id,
      equipe_id: agent.equipe_id || null,
      date: dateFiche,
      heure_soumission: new Date().toISOString(),
      comptes_ouverts_dat: parseInt(form.comptes_ouverts_dat) || 0,
      comptes_ouverts: parseInt(form.comptes_ouverts_dat) || 0,
      montant_smart: montantSmart,
      montant_caisse: montantCaisse,
      montant_mobilise: montantSmart,
      montant_rapporte: montantCaisse,
      commission_jour: parseFloat(form.commission_jour) || 0,
      nb_clients_parcourus: parseInt(form.nb_clients_parcourus) || 0,
      nb_adhesions: parseInt(form.nb_adhesions) || 0,
      nb_abonnements_lyde_cash: parseInt(form.nb_abonnements_lyde_cash) || 0,
      montant_depot_pe: parseFloat(form.montant_depot_pe) || 0,
      montant_depot_dat: parseFloat(form.montant_depot_dat) || 0,
      montant_depot_dav: parseFloat(form.montant_depot_dav) || 0,
      observations: form.observations || null,
      statut_validation: 'en_attente',
      valide_chef: false,
      commentaire_chef: null,
      valide_par: null,
    }

    let ficheId = editParam

    if (isEdit) {
      const { error } = await supabase.from('fiches_journalieres').update(payload).eq('id', editParam)
      if (error) { setLoading(false); alert('Erreur : ' + error.message); return }
      // Purge des sous-tables
      await Promise.all([
        supabase.from('reactivations').delete().eq('fiche_id', editParam),
        supabase.from('augmentations_mise').delete().eq('fiche_id', editParam),
        supabase.from('assurances_details').delete().eq('fiche_id', editParam),
      ])
    } else {
      const { data, error } = await supabase.from('fiches_journalieres')
        .insert({ ...payload, manquant_regle: false }).select().single()
      if (error) { setLoading(false); alert('Erreur : ' + error.message); return }
      ficheId = data.id
    }

    // Réinsertion des sous-tables
    const reactData = reactivations.filter(r => r.nom_prenom.trim() !== '').map(r => ({
      fiche_id: ficheId, agent_id: agent.id,
      n_client: r.n_client || null, nom_prenom: r.nom_prenom, produit: r.produit || 'TONTINE',
      mise: parseFloat(r.mise) || 0, nouvelle_mise: parseFloat(r.nouvelle_mise) || 0,
      montant_cotise: parseFloat(r.montant_cotise) || 0, reactif: r.reactif,
      commentaire: r.commentaire || null,
    }))
    if (reactData.length > 0) await supabase.from('reactivations').insert(reactData)

    const augData = augmentations.filter(a => a.nom_client.trim() !== '').map(a => ({
      fiche_id: ficheId, agent_id: agent.id,
      nom_client: a.nom_client, ancienne_mise: parseFloat(a.ancienne_mise) || 0,
      nouvelle_mise: parseFloat(a.nouvelle_mise) || 0, motif: a.motif || 'EPARGNE',
    }))
    if (augData.length > 0) await supabase.from('augmentations_mise').insert(augData)

    const assurData = assurances.filter(a => (parseInt(a.nb) || 0) > 0).map(a => ({
      fiche_id: ficheId, agent_id: agent.id,
      type_assurance: a.type_assurance, nb: parseInt(a.nb) || 0, montant: parseFloat(a.montant) || 0,
    }))
    if (assurData.length > 0) await supabase.from('assurances_details').insert(assurData)

    setLoading(false)
    setSubmitted(true)
  }

  // ── ÉTATS D'ATTENTE ──
  if (initLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#818387' }}>Chargement...</p>
      </div>
    </div>
  )

  if (erreurAcces) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8fafc' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-md text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#991B1B' }}>Action impossible</h2>
        <p className="text-sm mb-6" style={{ color: '#818387' }}>{erreurAcces}</p>
        <button onClick={() => router.push('/dashboard/agent')}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#2A4E94' }}>
          Retour au dashboard
        </button>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8fafc' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#F0FDF4' }}>
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-bold mb-1" style={{ color: '#166534' }}>
          {isEdit ? 'Fiche modifiée !' : 'Fiche soumise !'}
        </h2>
        <p className="text-sm mb-6" style={{ color: '#818387' }}>
          {new Date(dateFiche).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          <br />
          {isEdit ? 'Elle repart en validation.' : 'En attente de validation.'}
        </p>
        <button onClick={() => router.push('/dashboard/agent')}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm"
          style={{ backgroundColor: '#2A4E94' }}>
          Retour au dashboard
        </button>
      </div>
    </div>
  )

  const estAnterieure = dateFiche !== today

  // ── FORMULAIRE ──
  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/dashboard/agent')}
            className="flex items-center gap-2 text-sm mb-4" style={{ color: '#818387' }}>
            ← Retour
          </button>
          <h1 className="text-2xl font-bold" style={{ color: '#2A4E94' }}>
            {isEdit ? '✏️ Modifier la fiche' : estAnterieure ? '📅 Fiche antérieure' : 'Fiche journalière'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#818387' }}>
            {new Date(dateFiche).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {agent && ` — ${agent.prenom} ${agent.nom}`}
          </p>
        </div>

        {/* Bandeaux contextuels */}
        {isEdit && (
          <div className="mb-4 p-3 rounded-xl text-xs flex items-start gap-2"
            style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
            <span>⚠️</span>
            <span>Après modification, cette fiche repartira en attente de validation.</span>
          </div>
        )}
        {!isEdit && estAnterieure && (
          <div className="mb-4 p-3 rounded-xl text-xs flex items-start gap-2"
            style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
            <span>📅</span>
            <span>Vous saisissez une fiche pour une date antérieure.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Comptes */}
          <SectionCard titre="🏦 Comptes" ouverte={sectionsOuvertes.comptes} onToggle={() => toggleSection('comptes')}>
            <Field label="Comptes ouverts (DAT)" objectif="≥ 6"
              value={form.comptes_ouverts_dat}
              onChange={v => setForm(p => ({ ...p, comptes_ouverts_dat: v }))}
              type="number" placeholder="0" />
          </SectionCard>

          {/* Montants */}
          <SectionCard titre="💰 Montants collectés" ouverte={sectionsOuvertes.montants} onToggle={() => toggleSection('montants')}>
            <div className="space-y-4">
              <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                ℹ️ <strong>SMART</strong> = montant théorique collecté sur le terrain · <strong>Caisse</strong> = montant effectivement rapporté.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Montant SMART (théorique)" value={form.montant_smart}
                  onChange={v => setForm(p => ({ ...p, montant_smart: v }))} type="number" suffix="F" placeholder="0" />
                <Field label="Montant Caisse (rapporté)" value={form.montant_caisse}
                  onChange={v => setForm(p => ({ ...p, montant_caisse: v }))} type="number" suffix="F" placeholder="0" />
              </div>
              <Field label="Commission du jour (FCFA)" value={form.commission_jour}
                onChange={v => setForm(p => ({ ...p, commission_jour: v }))} type="number" suffix="F" placeholder="0" />

              {(montantSmart > 0 || montantCaisse > 0) && (
                <div className="rounded-xl p-4"
                  style={{
                    backgroundColor: typeEcart === 'ok' ? '#F0FDF4' : typeEcart === 'manquant' ? '#FEF2F2' : '#EEF2FF',
                    border: `1px solid ${typeEcart === 'ok' ? '#BBF7D0' : typeEcart === 'manquant' ? '#FECACA' : '#C7D2FE'}`
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium"
                      style={{ color: typeEcart === 'ok' ? '#166534' : typeEcart === 'manquant' ? '#991B1B' : '#2A4E94' }}>
                      {typeEcart === 'ok' ? '✅ Aucun écart' : typeEcart === 'manquant' ? '⚠️ Manquant' : '🔵 Surplus'}
                    </span>
                    <span className="font-bold text-xl"
                      style={{ color: typeEcart === 'ok' ? '#166534' : typeEcart === 'manquant' ? '#E4322C' : '#2A4E94' }}>
                      {Math.abs(ecart).toLocaleString()} F
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: '#818387' }}>
                    SMART {montantSmart.toLocaleString()} F − Caisse {montantCaisse.toLocaleString()} F
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Activités */}
          <SectionCard titre="📋 Activités terrain" ouverte={sectionsOuvertes.activites} onToggle={() => toggleSection('activites')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nb clients parcourus" value={form.nb_clients_parcourus}
                onChange={v => setForm(p => ({ ...p, nb_clients_parcourus: v }))} type="number" placeholder="0" />
              <Field label="Nb d'adhésions" value={form.nb_adhesions}
                onChange={v => setForm(p => ({ ...p, nb_adhesions: v }))} type="number" placeholder="0" />
              <Field label="Nb abonnements Lydé Cash" value={form.nb_abonnements_lyde_cash}
                onChange={v => setForm(p => ({ ...p, nb_abonnements_lyde_cash: v }))} type="number" placeholder="0" />
            </div>
          </SectionCard>

          {/* Autres dépôts */}
          <SectionCard titre="🏧 Autres dépôts"
            badge={totalAutresDepots > 0 ? totalAutresDepots.toLocaleString() + ' F' : undefined}
            ouverte={sectionsOuvertes.depots} onToggle={() => toggleSection('depots')}>
            <div className="space-y-4">
              <Field label="Montant PE (Prêt Épargne)" value={form.montant_depot_pe}
                onChange={v => setForm(p => ({ ...p, montant_depot_pe: v }))} type="number" suffix="F" placeholder="0" />
              <Field label="Montant DAT (Dépôt À Terme)" value={form.montant_depot_dat}
                onChange={v => setForm(p => ({ ...p, montant_depot_dat: v }))} type="number" suffix="F" placeholder="0" />
              <Field label="Montant DAV (Dépôt À Vue)" value={form.montant_depot_dav}
                onChange={v => setForm(p => ({ ...p, montant_depot_dav: v }))} type="number" suffix="F" placeholder="0" />
              {totalAutresDepots > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <span className="text-sm font-medium" style={{ color: '#166534' }}>Total autres dépôts</span>
                  <span className="font-bold" style={{ color: '#166534' }}>{totalAutresDepots.toLocaleString()} F</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Réactivations */}
          <SectionCard titre="🔄 Réactivations"
            badge={reactivations.length > 0 ? `${reactivations.length} client(s)` : undefined}
            ouverte={sectionsOuvertes.reactivations} onToggle={() => toggleSection('reactivations')}>
            <div className="space-y-4">
              {reactivations.length === 0 ? (
                <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>
                  Aucune réactivation — cliquez sur + pour en ajouter
                </div>
              ) : (
                <div className="space-y-4">
                  {reactivations.map((r, i) => (
                    <div key={i} className="rounded-2xl p-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>Client #{i + 1}</span>
                        <button type="button" onClick={() => supprimerReactivation(i)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                          style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SmallField label="N° Client" value={r.n_client} onChange={v => updateReactivation(i, 'n_client', v)} placeholder="Ex: 001" />
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Produit</label>
                          <select value={r.produit} onChange={e => updateReactivation(i, 'produit', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                            <option value="TONTINE">TONTINE</option>
                            <option value="EPARGNE">EPARGNE</option>
                            <option value="DAT">DAT</option>
                            <option value="DAV">DAV</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <SmallField label="Nom & Prénoms *" value={r.nom_prenom} onChange={v => updateReactivation(i, 'nom_prenom', v)} placeholder="Nom et prénoms du client" />
                        </div>
                        <SmallField label="Mise actuelle (F)" value={r.mise} onChange={v => updateReactivation(i, 'mise', v)} type="number" />
                        <SmallField label="Nouvelle mise (F)" value={r.nouvelle_mise} onChange={v => updateReactivation(i, 'nouvelle_mise', v)} type="number" />
                        <SmallField label="Montant cotisé (F)" value={r.montant_cotise} onChange={v => updateReactivation(i, 'montant_cotise', v)} type="number" />
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Réactivé ?</label>
                          <div className="flex gap-2 mt-1">
                            {[{ v: true, l: '✅ Oui' }, { v: false, l: '❌ Non' }].map(opt => (
                              <button key={String(opt.v)} type="button"
                                onClick={() => updateReactivation(i, 'reactif', opt.v)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                                style={{
                                  backgroundColor: r.reactif === opt.v ? '#2A4E94' : '#f1f5f9',
                                  color: r.reactif === opt.v ? 'white' : '#818387'
                                }}>{opt.l}</button>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <SmallField label="Commentaire" value={r.commentaire} onChange={v => updateReactivation(i, 'commentaire', v)} placeholder="Optionnel" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={ajouterReactivation}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed"
                style={{ borderColor: '#2A4E94', color: '#2A4E94', backgroundColor: 'transparent' }}>
                ➕ Ajouter une réactivation
              </button>
              {reactivations.length > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: '#EEF2FF' }}>
                  <span className="text-xs font-medium" style={{ color: '#2A4E94' }}>Total montants cotisés</span>
                  <span className="font-bold text-sm" style={{ color: '#2A4E94' }}>{totalReactivations.toLocaleString()} F</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Augmentations */}
          <SectionCard titre="📈 Augmentations de mise"
            badge={augmentations.length > 0 ? `${augmentations.length} client(s)` : undefined}
            ouverte={sectionsOuvertes.augmentations} onToggle={() => toggleSection('augmentations')}>
            <div className="space-y-4">
              {augmentations.length === 0 ? (
                <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>
                  Aucune augmentation — cliquez sur + pour en ajouter
                </div>
              ) : (
                <div className="space-y-4">
                  {augmentations.map((a, i) => (
                    <div key={i} className="rounded-2xl p-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold" style={{ color: '#166534' }}>Client #{i + 1}</span>
                        <button type="button" onClick={() => supprimerAugmentation(i)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                          style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <SmallField label="Nom & Prénoms client *" value={a.nom_client} onChange={v => updateAugmentation(i, 'nom_client', v)} placeholder="Nom et prénoms du client" />
                        </div>
                        <SmallField label="Ancienne mise (F)" value={a.ancienne_mise} onChange={v => updateAugmentation(i, 'ancienne_mise', v)} type="number" />
                        <SmallField label="Nouvelle mise (F)" value={a.nouvelle_mise} onChange={v => updateAugmentation(i, 'nouvelle_mise', v)} type="number" />
                        <div className="col-span-2">
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Motif</label>
                          <select value={a.motif} onChange={e => updateAugmentation(i, 'motif', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                            <option value="EPARGNE">EPARGNE</option>
                            <option value="BESOIN">BESOIN</option>
                            <option value="AUTRE">AUTRE</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={ajouterAugmentation}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed"
                style={{ borderColor: '#166534', color: '#166534', backgroundColor: 'transparent' }}>
                ➕ Ajouter une augmentation de mise
              </button>
            </div>
          </SectionCard>

          {/* Assurances */}
          <SectionCard titre="🛡️ Assurances"
            badge={totalAssurancesNb > 0 ? `${totalAssurancesNb} contrat(s)` : undefined}
            ouverte={sectionsOuvertes.assurances} onToggle={() => toggleSection('assurances')}>
            <div className="space-y-4">
              {assurances.map((a, i) => (
                <div key={i} className="rounded-2xl p-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="font-semibold text-sm mb-3" style={{ color: i === 0 ? '#2A4E94' : '#166534' }}>
                    {i === 0 ? '🔵' : '🟢'} Assurance {a.type_assurance}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SmallField label="Nombre de contrats" value={a.nb} onChange={v => updateAssurance(i, 'nb', v)} type="number" />
                    <SmallField label="Montant total (F)" value={a.montant} onChange={v => updateAssurance(i, 'montant', v)} type="number" />
                  </div>
                </div>
              ))}
              {totalAssurancesNb > 0 && (
                <div className="rounded-xl p-3 grid grid-cols-2 gap-2" style={{ backgroundColor: '#F0FDF4' }}>
                  <div className="text-center">
                    <div className="font-bold" style={{ color: '#166534' }}>{totalAssurancesNb}</div>
                    <div className="text-xs" style={{ color: '#166534' }}>Total contrats</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold" style={{ color: '#166534' }}>{totalAssurancesMontant.toLocaleString()} F</div>
                    <div className="text-xs" style={{ color: '#166534' }}>Total montant</div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Observations */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: '#2A4E94' }}>📝 Observations</h3>
            <textarea value={form.observations}
              onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
              rows={3} placeholder="Remarques, difficultés rencontrées..." />
          </div>

          {/* Récapitulatif */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>📊 Récapitulatif</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Montant SMART', value: montantSmart.toLocaleString() + ' F', color: '#2A4E94' },
                { label: 'Montant Caisse', value: montantCaisse.toLocaleString() + ' F', color: '#2A4E94' },
                { label: typeEcart === 'manquant' ? '⚠️ Manquant' : typeEcart === 'surplus' ? '🔵 Surplus' : '✅ Écart', value: Math.abs(ecart).toLocaleString() + ' F', color: typeEcart === 'ok' ? '#166534' : typeEcart === 'manquant' ? '#991B1B' : '#2A4E94' },
                { label: 'Commission', value: (parseFloat(form.commission_jour) || 0).toLocaleString() + ' F', color: '#854D0E' },
                { label: 'Comptes DAT', value: form.comptes_ouverts_dat || '0', color: '#2A4E94' },
                { label: 'Adhésions', value: form.nb_adhesions || '0', color: '#2A4E94' },
                { label: 'Réactivations', value: reactivations.filter(r => r.nom_prenom).length, color: '#854D0E' },
                { label: 'Augm. mise', value: augmentations.filter(a => a.nom_client).length, color: '#854D0E' },
                { label: 'Assurances', value: totalAssurancesNb, color: '#2A4E94' },
                { label: 'Autres dépôts', value: totalAutresDepots.toLocaleString() + ' F', color: '#2A4E94' },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-1.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <span style={{ color: '#818387' }}>{item.label}</span>
                  <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Soumettre */}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
            style={{ backgroundColor: loading ? '#818387' : '#2A4E94' }}>
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isEdit ? 'Modification...' : 'Envoi...'}
              </>
            ) : (
              <>{isEdit ? '💾 Enregistrer les modifications' : 'Soumettre ma fiche →'}</>
            )}
          </button>

          <div className="h-8" />
        </form>
      </div>
    </div>
  )
}

// ── Composants ──
function SectionCard({ titre, children, ouverte, onToggle, badge }: {
  titre: string; children: React.ReactNode; ouverte: boolean; onToggle: () => void; badge?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" style={{ color: '#2A4E94' }}>{titre}</h3>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{badge}</span>
          )}
        </div>
        <span className="text-sm" style={{ color: '#818387' }}>{ouverte ? '▲' : '▼'}</span>
      </button>
      {ouverte && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', suffix, objectif, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; suffix?: string; objectif?: string; placeholder?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{label}</label>
        {objectif && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>Obj : {objectif}</span>
        )}
      </div>
      <div className="relative">
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          min={0} placeholder={placeholder || '0'}
          className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
          style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
          onFocus={e => e.target.style.borderColor = '#2A4E94'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#818387' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

function SmallField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        min={type === 'number' ? 0 : undefined} placeholder={placeholder || (type === 'number' ? '0' : '')}
        className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} />
    </div>
  )
}