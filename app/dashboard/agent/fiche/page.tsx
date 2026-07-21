'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Agent {
  id: string
  user_id: string
  prenom: string
  nom: string
  equipe_id: string
  agence_id: string
  [key: string]: any
}

interface Reactivation {
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

export default function FicheJournaliere() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [ficheDuJour, setFicheDuJour] = useState<any>(null)
  const [sectionsOuvertes, setSectionsOuvertes] = useState({
    comptes: true,
    montants: true,
    activites: true,
    depots: false,
    reactivations: false,
    augmentations: false,
    assurances: false,
    pieces: false,
  })

  // Formulaire principal
  const [form, setForm] = useState({
    comptes_ouverts_dat: '',
    comptes_actives: '',
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

  // Réactivations (lignes dynamiques)
  const [reactivations, setReactivations] = useState<Reactivation[]>([])

  // Augmentations de mise (lignes dynamiques)
  const [augmentations, setAugmentations] = useState<AugmentationMise[]>([])

  // Assurances (Honaméto + Akofa)
  const [assurances, setAssurances] = useState<AssuranceDetail[]>([
    { type_assurance: 'Honaméto', nb: '', montant: '' },
    { type_assurance: 'Akofa', nb: '', montant: '' },
  ])

  // Pièces jointes
  const [files, setFiles] = useState<File[]>([])

  const today = new Date().toISOString().split('T')[0]

  // Calculs automatiques
  const montantTotal = (parseFloat(form.montant_smart) || 0) + (parseFloat(form.montant_caisse) || 0)
  const montantRapporte = montantTotal // À ajuster si besoin
  const totalAutresDepots = (parseFloat(form.montant_depot_pe) || 0) + (parseFloat(form.montant_depot_dat) || 0) + (parseFloat(form.montant_depot_dav) || 0)
  const totalReactivations = reactivations.reduce((s, r) => s + (parseFloat(r.montant_cotise) || 0), 0)
  const totalAugmentations = augmentations.length
  const totalAssurancesNb = assurances.reduce((s, a) => s + (parseInt(a.nb) || 0), 0)
  const totalAssurancesMontant = assurances.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0)

  useEffect(() => { loadAgent() }, [])

  async function loadAgent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
    if (!data) return
    setAgent(data)
    const { data: fiche } = await supabase.from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', data.id).eq('date', today).maybeSingle()
    if (fiche) setFicheDuJour(fiche)
  }

  function toggleSection(key: keyof typeof sectionsOuvertes) {
    setSectionsOuvertes(p => ({ ...p, [key]: !p[key] }))
  }

  // ── Réactivations ──
  function ajouterReactivation() {
    setReactivations(prev => [...prev, {
      n_client: '', nom_prenom: '', produit: 'TONTINE',
      mise: '', nouvelle_mise: '', montant_cotise: '',
      reactif: true, commentaire: ''
    }])
    if (!sectionsOuvertes.reactivations) toggleSection('reactivations')
  }

  function updateReactivation(index: number, field: keyof Reactivation, value: string | boolean) {
    setReactivations(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function supprimerReactivation(index: number) {
    setReactivations(prev => prev.filter((_, i) => i !== index))
  }

  // ── Augmentations ──
  function ajouterAugmentation() {
    setAugmentations(prev => [...prev, { nom_client: '', ancienne_mise: '', nouvelle_mise: '', motif: 'EPARGNE' }])
    if (!sectionsOuvertes.augmentations) toggleSection('augmentations')
  }

  function updateAugmentation(index: number, field: keyof AugmentationMise, value: string) {
    setAugmentations(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a))
  }

  function supprimerAugmentation(index: number) {
    setAugmentations(prev => prev.filter((_, i) => i !== index))
  }

  // ── Assurances ──
  function updateAssurance(index: number, field: keyof AssuranceDetail, value: string) {
    setAssurances(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a))
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agent) return
    setLoading(true)

    // 1. Créer la fiche principale
    const { data: fiche, error } = await supabase
      .from('fiches_journalieres')
      .insert({
        agent_id: agent.id,
        equipe_id: agent.equipe_id || null,
        date: today,
        heure_soumission: new Date().toISOString(),
        // Comptes
        comptes_ouverts_dat: parseInt(form.comptes_ouverts_dat) || 0,
        comptes_ouverts: parseInt(form.comptes_ouverts_dat) || 0, // compatibilité
        comptes_actives: parseInt(form.comptes_actives) || 0,
        // Montants
        montant_smart: parseFloat(form.montant_smart) || 0,
        montant_caisse: parseFloat(form.montant_caisse) || 0,
        montant_mobilise: montantTotal,
        montant_rapporte: montantTotal,
        commission_jour: parseFloat(form.commission_jour) || 0,
        // Activités
        nb_clients_parcourus: parseInt(form.nb_clients_parcourus) || 0,
        nb_adhesions: parseInt(form.nb_adhesions) || 0,
        nb_abonnements_lyde_cash: parseInt(form.nb_abonnements_lyde_cash) || 0,
        // Autres dépôts
        montant_depot_pe: parseFloat(form.montant_depot_pe) || 0,
        montant_depot_dat: parseFloat(form.montant_depot_dat) || 0,
        montant_depot_dav: parseFloat(form.montant_depot_dav) || 0,
        // Observations
        observations: form.observations || null,
        // Statut
        statut_validation: 'en_attente',
        valide_chef: false,
        manquant_regle: false,
      })
      .select()
      .single()

    if (error) { setLoading(false); alert('Erreur: ' + error.message); return }

    // 2. Insérer réactivations
    if (reactivations.length > 0) {
      const reactivationsData = reactivations
        .filter(r => r.nom_prenom.trim() !== '')
        .map(r => ({
          fiche_id: fiche.id,
          agent_id: agent.id,
          n_client: r.n_client || null,
          nom_prenom: r.nom_prenom,
          produit: r.produit || 'TONTINE',
          mise: parseFloat(r.mise) || 0,
          nouvelle_mise: parseFloat(r.nouvelle_mise) || 0,
          montant_cotise: parseFloat(r.montant_cotise) || 0,
          reactif: r.reactif,
          commentaire: r.commentaire || null,
        }))
      if (reactivationsData.length > 0) {
        await supabase.from('reactivations').insert(reactivationsData)
      }
    }

    // 3. Insérer augmentations de mise
    if (augmentations.length > 0) {
      const augmentationsData = augmentations
        .filter(a => a.nom_client.trim() !== '')
        .map(a => ({
          fiche_id: fiche.id,
          agent_id: agent.id,
          nom_client: a.nom_client,
          ancienne_mise: parseFloat(a.ancienne_mise) || 0,
          nouvelle_mise: parseFloat(a.nouvelle_mise) || 0,
          motif: a.motif || 'EPARGNE',
        }))
      if (augmentationsData.length > 0) {
        await supabase.from('augmentations_mise').insert(augmentationsData)
      }
    }

    // 4. Insérer assurances
    const assurancesData = assurances
      .filter(a => (parseInt(a.nb) || 0) > 0)
      .map(a => ({
        fiche_id: fiche.id,
        agent_id: agent.id,
        type_assurance: a.type_assurance,
        nb: parseInt(a.nb) || 0,
        montant: parseFloat(a.montant) || 0,
      }))
    if (assurancesData.length > 0) {
      await supabase.from('assurances_details').insert(assurancesData)
    }

    // 5. Upload pièces jointes
    for (const file of files) {
      const path = `${agent.id}/${today}/${file.name}`
      const { data: upload } = await supabase.storage.from('fiches-jointes').upload(path, file, { upsert: true })
      if (upload) {
        const { data: urlData } = supabase.storage.from('fiches-jointes').getPublicUrl(path)
        await supabase.from('pieces_jointes').insert({
          fiche_id: fiche.id, agent_id: agent.id,
          nom_fichier: file.name, url: urlData.publicUrl,
          type_fichier: file.type, taille: file.size,
        })
      }
    }

    setLoading(false)
    setFicheDuJour(fiche)
  }

  // ── Fiche déjà soumise ──
  if (ficheDuJour) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8fafc' }}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#EEF2FF' }}>
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: '#2A4E94' }}>Fiche soumise ✅</h2>
            <p className="text-sm" style={{ color: '#818387' }}>
              {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Résumé */}
          <div className="space-y-3 mb-6">
            {/* Montants */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f8fafc' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: '#818387' }}>💰 MONTANTS</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'SMART', value: (ficheDuJour.montant_smart || 0).toLocaleString() + ' F' },
                  { label: 'Caisse', value: (ficheDuJour.montant_caisse || 0).toLocaleString() + ' F' },
                  { label: 'Commission', value: (ficheDuJour.commission_jour || 0).toLocaleString() + ' F' },
                  { label: 'Total', value: (ficheDuJour.montant_mobilise || 0).toLocaleString() + ' F' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-2" style={{ backgroundColor: 'white' }}>
                    <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                    <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activités */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#f8fafc' }}>
              <div className="text-xs font-semibold mb-2" style={{ color: '#818387' }}>📊 ACTIVITÉS</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Comptes DAT', value: ficheDuJour.comptes_ouverts_dat || 0 },
                  { label: 'Adhésions', value: ficheDuJour.nb_adhesions || 0 },
                  { label: 'Lydé Cash', value: ficheDuJour.nb_abonnements_lyde_cash || 0 },
                  { label: 'Clients', value: ficheDuJour.nb_clients_parcourus || 0 },
                  { label: 'Réactivations', value: ficheDuJour.reactivations?.length || 0 },
                  { label: 'Augm. mise', value: ficheDuJour.augmentations_mise?.length || 0 },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-2 text-center" style={{ backgroundColor: 'white' }}>
                    <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{item.value}</div>
                    <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Statut validation */}
            <div className="rounded-xl p-3 text-center"
              style={{
                backgroundColor: ficheDuJour.statut_validation === 'validee' ? '#F0FDF4' :
                  ficheDuJour.statut_validation === 'rejetee' ? '#FEF2F2' : '#EEF2FF',
              }}>
              <span className="text-sm font-medium"
                style={{
                  color: ficheDuJour.statut_validation === 'validee' ? '#166534' :
                    ficheDuJour.statut_validation === 'rejetee' ? '#991B1B' : '#2A4E94'
                }}>
                {ficheDuJour.statut_validation === 'validee' ? '✅ Fiche validée' :
                  ficheDuJour.statut_validation === 'rejetee' ? '❌ Fiche rejetée' :
                  '⏳ En attente de validation'}
              </span>
              {ficheDuJour.commentaire_chef && (
                <p className="text-xs mt-1" style={{ color: '#818387' }}>💬 {ficheDuJour.commentaire_chef}</p>
              )}
            </div>
          </div>

          <button onClick={() => router.push('/dashboard/agent')}
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
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/dashboard/agent')}
            className="flex items-center gap-2 text-sm mb-4" style={{ color: '#818387' }}>
            ← Retour
          </button>
          <h1 className="text-2xl font-bold" style={{ color: '#2A4E94' }}>Fiche journalière</h1>
          <p className="text-sm mt-1" style={{ color: '#818387' }}>
            {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {agent && ` — ${agent.prenom} ${agent.nom}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── SECTION : Comptes ── */}
          <SectionCard
            titre="🏦 Comptes"
            ouverte={sectionsOuvertes.comptes}
            onToggle={() => toggleSection('comptes')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Comptes ouverts (DAT)" objectif="≥ 6"
                value={form.comptes_ouverts_dat}
                onChange={v => setForm(p => ({ ...p, comptes_ouverts_dat: v }))}
                type="number" placeholder="0" />
              <Field label="Comptes activés" objectif="≥ 4"
                value={form.comptes_actives}
                onChange={v => setForm(p => ({ ...p, comptes_actives: v }))}
                type="number" placeholder="0" />
            </div>
          </SectionCard>

          {/* ── SECTION : Montants ── */}
          <SectionCard
            titre="💰 Montants collectés"
            ouverte={sectionsOuvertes.montants}
            onToggle={() => toggleSection('montants')}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Montant SMART (FCFA)"
                  value={form.montant_smart}
                  onChange={v => setForm(p => ({ ...p, montant_smart: v }))}
                  type="number" suffix="F" placeholder="0" />
                <Field label="Montant Caisse (FCFA)"
                  value={form.montant_caisse}
                  onChange={v => setForm(p => ({ ...p, montant_caisse: v }))}
                  type="number" suffix="F" placeholder="0" />
              </div>
              <Field label="Commission du jour (FCFA)"
                value={form.commission_jour}
                onChange={v => setForm(p => ({ ...p, commission_jour: v }))}
                type="number" suffix="F" placeholder="0" />

              {/* Total automatique */}
              {montantTotal > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <span className="text-sm font-medium" style={{ color: '#166534' }}>Total collecté</span>
                  <span className="font-bold text-lg" style={{ color: '#166534' }}>
                    {montantTotal.toLocaleString()} FCFA
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION : Activités ── */}
          <SectionCard
            titre="📋 Activités terrain"
            ouverte={sectionsOuvertes.activites}
            onToggle={() => toggleSection('activites')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nb clients parcourus"
                value={form.nb_clients_parcourus}
                onChange={v => setForm(p => ({ ...p, nb_clients_parcourus: v }))}
                type="number" placeholder="0" />
              <Field label="Nb d'adhésions"
                value={form.nb_adhesions}
                onChange={v => setForm(p => ({ ...p, nb_adhesions: v }))}
                type="number" placeholder="0" />
              <Field label="Nb abonnements Lydé Cash"
                value={form.nb_abonnements_lyde_cash}
                onChange={v => setForm(p => ({ ...p, nb_abonnements_lyde_cash: v }))}
                type="number" placeholder="0" />
            </div>
          </SectionCard>

          {/* ── SECTION : Autres dépôts ── */}
          <SectionCard
            titre="🏧 Autres dépôts"
            badge={totalAutresDepots > 0 ? totalAutresDepots.toLocaleString() + ' F' : undefined}
            ouverte={sectionsOuvertes.depots}
            onToggle={() => toggleSection('depots')}>
            <div className="space-y-4">
              <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                ℹ️ Renseignez les montants par type : PE (Prêt Épargne), DAT (Dépôt À Terme), DAV (Dépôt À Vue)
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Field label="Montant PE (Prêt Épargne)"
                  value={form.montant_depot_pe}
                  onChange={v => setForm(p => ({ ...p, montant_depot_pe: v }))}
                  type="number" suffix="F" placeholder="0" />
                <Field label="Montant DAT (Dépôt À Terme)"
                  value={form.montant_depot_dat}
                  onChange={v => setForm(p => ({ ...p, montant_depot_dat: v }))}
                  type="number" suffix="F" placeholder="0" />
                <Field label="Montant DAV (Dépôt À Vue)"
                  value={form.montant_depot_dav}
                  onChange={v => setForm(p => ({ ...p, montant_depot_dav: v }))}
                  type="number" suffix="F" placeholder="0" />
              </div>
              {totalAutresDepots > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <span className="text-sm font-medium" style={{ color: '#166534' }}>Total autres dépôts</span>
                  <span className="font-bold" style={{ color: '#166534' }}>{totalAutresDepots.toLocaleString()} F</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION : Réactivations ── */}
          <SectionCard
            titre="🔄 Réactivations"
            badge={reactivations.length > 0 ? `${reactivations.length} client(s)` : undefined}
            ouverte={sectionsOuvertes.reactivations}
            onToggle={() => toggleSection('reactivations')}>
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
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>N° Client</label>
                          <input type="text" value={r.n_client}
                            onChange={e => updateReactivation(i, 'n_client', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="Ex: 001" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Produit</label>
                          <select value={r.produit}
                            onChange={e => updateReactivation(i, 'produit', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }}>
                            <option value="TONTINE">TONTINE</option>
                            <option value="EPARGNE">EPARGNE</option>
                            <option value="DAT">DAT</option>
                            <option value="DAV">DAV</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Nom & Prénoms *</label>
                          <input type="text" value={r.nom_prenom}
                            onChange={e => updateReactivation(i, 'nom_prenom', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="Nom et prénoms du client" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Mise actuelle (F)</label>
                          <input type="number" value={r.mise}
                            onChange={e => updateReactivation(i, 'mise', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Nouvelle mise (F)</label>
                          <input type="number" value={r.nouvelle_mise}
                            onChange={e => updateReactivation(i, 'nouvelle_mise', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Montant cotisé (F)</label>
                          <input type="number" value={r.montant_cotise}
                            onChange={e => updateReactivation(i, 'montant_cotise', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="0" />
                        </div>
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
                                }}>
                                {opt.l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Commentaire</label>
                          <input type="text" value={r.commentaire}
                            onChange={e => updateReactivation(i, 'commentaire', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="Optionnel" />
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
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ backgroundColor: '#EEF2FF' }}>
                  <span className="text-xs font-medium" style={{ color: '#2A4E94' }}>
                    Total montants cotisés
                  </span>
                  <span className="font-bold text-sm" style={{ color: '#2A4E94' }}>
                    {totalReactivations.toLocaleString()} F
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION : Augmentations de mise ── */}
          <SectionCard
            titre="📈 Augmentations de mise"
            badge={augmentations.length > 0 ? `${augmentations.length} client(s)` : undefined}
            ouverte={sectionsOuvertes.augmentations}
            onToggle={() => toggleSection('augmentations')}>
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
                        <span className="text-xs font-semibold" style={{ color: '#166634' }}>Client #{i + 1}</span>
                        <button type="button" onClick={() => supprimerAugmentation(i)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                          style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Nom & Prénoms client *</label>
                          <input type="text" value={a.nom_client}
                            onChange={e => updateAugmentation(i, 'nom_client', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="Nom et prénoms du client" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Ancienne mise (F)</label>
                          <input type="number" value={a.ancienne_mise}
                            onChange={e => updateAugmentation(i, 'ancienne_mise', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Nouvelle mise (F)</label>
                          <input type="number" value={a.nouvelle_mise}
                            onChange={e => updateAugmentation(i, 'nouvelle_mise', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }} placeholder="0" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Motif</label>
                          <select value={a.motif}
                            onChange={e => updateAugmentation(i, 'motif', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                            style={{ borderColor: '#e2e8f0' }}>
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

              {augmentations.length > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ backgroundColor: '#F0FDF4' }}>
                  <span className="text-xs font-medium" style={{ color: '#166534' }}>
                    Nombre total d&apos;augmentations
                  </span>
                  <span className="font-bold text-sm" style={{ color: '#166534' }}>
                    {totalAugmentations}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── SECTION : Assurances ── */}
          <SectionCard
            titre="🛡️ Assurances"
            badge={totalAssurancesNb > 0 ? `${totalAssurancesNb} contrat(s)` : undefined}
            ouverte={sectionsOuvertes.assurances}
            onToggle={() => toggleSection('assurances')}>
            <div className="space-y-4">
              <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                ℹ️ Deux types d&apos;assurances : <strong>Honaméto</strong> et <strong>Akofa</strong>
              </div>
              {assurances.map((a, i) => (
                <div key={i} className="rounded-2xl p-4 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="font-semibold text-sm mb-3"
                    style={{ color: i === 0 ? '#2A4E94' : '#166534' }}>
                    {i === 0 ? '🔵' : '🟢'} Assurance {a.type_assurance}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Nombre de contrats</label>
                      <input type="number" value={a.nb}
                        onChange={e => updateAssurance(i, 'nb', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                        style={{ borderColor: '#e2e8f0' }} placeholder="0" min="0" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#818387' }}>Montant total (F)</label>
                      <input type="number" value={a.montant}
                        onChange={e => updateAssurance(i, 'montant', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                        style={{ borderColor: '#e2e8f0' }} placeholder="0" min="0" />
                    </div>
                  </div>
                </div>
              ))}

              {totalAssurancesNb > 0 && (
                <div className="rounded-xl p-3 grid grid-cols-2 gap-2"
                  style={{ backgroundColor: '#F0FDF4' }}>
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

          {/* ── SECTION : Observations ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: '#2A4E94' }}>
              📝 Observations
            </h3>
            <textarea value={form.observations}
              onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
              rows={3} placeholder="Remarques, difficultés rencontrées..." />
          </div>

          {/* ── SECTION : Pièces jointes ── */}
          <SectionCard
            titre="📎 Pièces jointes"
            badge={files.length > 0 ? `${files.length} fichier(s)` : undefined}
            ouverte={sectionsOuvertes.pieces}
            onToggle={() => toggleSection('pieces')}>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer"
              style={{ borderColor: '#2A4E94', backgroundColor: '#EEF2FF' }}>
              <span className="text-2xl mb-1">📁</span>
              <p className="text-sm font-medium" style={{ color: '#2A4E94' }}>Ajouter des fichiers</p>
              <p className="text-xs mt-0.5" style={{ color: '#818387' }}>Photos, reçus, PDF</p>
              <input type="file" multiple onChange={handleFiles} className="hidden" accept="image/*,.pdf" />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                    <span>📄</span>
                    <span className="text-xs flex-1 truncate" style={{ color: '#1a1a2e' }}>{f.name}</span>
                    <span className="text-xs" style={{ color: '#818387' }}>{(f.size / 1024).toFixed(0)} Ko</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Récapitulatif avant soumission ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>📊 Récapitulatif</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Total collecté', value: montantTotal.toLocaleString() + ' F', color: '#166534' },
                { label: 'Commission', value: (parseFloat(form.commission_jour) || 0).toLocaleString() + ' F', color: '#2A4E94' },
                { label: 'Comptes DAT', value: form.comptes_ouverts_dat || '0', color: '#2A4E94' },
                { label: 'Adhésions', value: form.nb_adhesions || '0', color: '#2A4E94' },
                { label: 'Lydé Cash', value: form.nb_abonnements_lyde_cash || '0', color: '#2A4E94' },
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

          {/* Bouton soumettre */}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
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
              <>Soumettre ma fiche →</>
            )}
          </button>

          {/* Espace bas mobile */}
          <div className="h-8" />

        </form>
      </div>
    </div>
  )
}

// ── Composant SectionCard ──
function SectionCard({
  titre, children, ouverte, onToggle, badge
}: {
  titre: string
  children: React.ReactNode
  ouverte: boolean
  onToggle: () => void
  badge?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" style={{ color: '#2A4E94' }}>{titre}</h3>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
              {badge}
            </span>
          )}
        </div>
        <span className="text-sm" style={{ color: '#818387' }}>{ouverte ? '▲' : '▼'}</span>
      </button>
      {ouverte && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Composant Field ──
function Field({ label, value, onChange, type = 'text', suffix, objectif, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  suffix?: string
  objectif?: string
  placeholder?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{label}</label>
        {objectif && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
            Obj : {objectif}
          </span>
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
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#818387' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}