'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Periode = 'jour' | 'semaine' | 'mois' | 'annee' | 'custom'

export default function DashboardAgent() {
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [ficheDuJour, setFicheDuJour] = useState<any>(null)
  const [fiches, setFiches] = useState<any[]>([])
  const [fichesFiltrees, setFichesFiltrees] = useState<any[]>([])
  const [manquants, setManquants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState<Periode>('semaine')
  const [recherche, setRecherche] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'historique' | 'settings'>('dashboard')
  const [settingsForm, setSettingsForm] = useState({ nom: '', prenom: '', telephone: '' })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])
  useEffect(() => { filtrerFiches() }, [fiches, periode, recherche, dateDebut, dateFin])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: agentData } = await supabase
      .from('agents').select('*').eq('user_id', user.id).single()
    if (!agentData) { router.push('/login'); return }
    setAgent(agentData)
    setSettingsForm({ nom: agentData.nom || '', prenom: agentData.prenom || '', telephone: agentData.telephone || '' })

    const { data: fiche } = await supabase
      .from('fiches_journalieres').select('*')
      .eq('agent_id', agentData.id).eq('date', today).maybeSingle()
    setFicheDuJour(fiche)

    const { data: allFiches } = await supabase
      .from('fiches_journalieres').select('*')
      .eq('agent_id', agentData.id).order('date', { ascending: false })
    setFiches(allFiches || [])

    const { data: manq } = await supabase
      .from('fiches_journalieres').select('*')
      .eq('agent_id', agentData.id).eq('manquant_regle', false)
    setManquants((manq || []).filter(f => (f.montant_mobilise - f.montant_rapporte) > 0))
    setLoading(false)
  }

  function filtrerFiches() {
    let filtered = [...fiches]
    const now = new Date()

    if (periode === 'jour') {
      filtered = filtered.filter(f => f.date === today)
    } else if (periode === 'semaine') {
      const debut = new Date(now); debut.setDate(now.getDate() - 7)
      filtered = filtered.filter(f => new Date(f.date) >= debut)
    } else if (periode === 'mois') {
      const debut = new Date(now.getFullYear(), now.getMonth(), 1)
      filtered = filtered.filter(f => new Date(f.date) >= debut)
    } else if (periode === 'annee') {
      const debut = new Date(now.getFullYear(), 0, 1)
      filtered = filtered.filter(f => new Date(f.date) >= debut)
    } else if (periode === 'custom' && dateDebut && dateFin) {
      filtered = filtered.filter(f => f.date >= dateDebut && f.date <= dateFin)
    }

    if (recherche) {
      filtered = filtered.filter(f =>
        f.date.includes(recherche) ||
        f.comptes_ouverts?.toString().includes(recherche) ||
        f.montant_mobilise?.toString().includes(recherche)
      )
    }

    setFichesFiltrees(filtered)
  }

  async function saveSettings() {
    if (!agent) return
    setSettingsSaving(true)
    await supabase.from('agents').update({
      nom: settingsForm.nom,
      prenom: settingsForm.prenom,
      telephone: settingsForm.telephone,
    }).eq('id', agent.id)
    setAgent({ ...agent, ...settingsForm })
    setSettingsSaving(false)
    setSettingsSuccess(true)
    setTimeout(() => setSettingsSuccess(false), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
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

  // ── Calculs indicateurs de performance ──
  const fichesMois = fiches.filter(f => {
    const now = new Date()
    return new Date(f.date) >= new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const totalComptes = fichesMois.reduce((s, f) => s + (f.comptes_ouverts || 0), 0)
  const totalActives = fichesMois.reduce((s, f) => s + (f.comptes_actives || 0), 0)
  const totalCollecte = fichesMois.reduce((s, f) => s + (f.montant_mobilise || 0), 0)
  const totalRapporte = fichesMois.reduce((s, f) => s + (f.montant_rapporte || 0), 0)
  const totalProspects = fichesMois.reduce((s, f) => s + (f.prospects_visites || 0), 0)
  const totalManquants = manquants.reduce((s, f) => s + Math.max(0, f.montant_mobilise - f.montant_rapporte), 0)
  const joursActifs = fichesMois.length
  const tauxActivation = totalComptes > 0 ? Math.round((totalActives / totalComptes) * 100) : 0
  const tauxCollecte = totalCollecte > 0 ? Math.round((totalRapporte / totalCollecte) * 100) : 0
  const objectifJournalierComptes = 6
  const scoreMoyen = joursActifs > 0
    ? Math.round((totalComptes / (joursActifs * objectifJournalierComptes)) * 100)
    : 0

  const indicateurs = [
    {
      titre: "Taux d'activation",
      valeur: `${tauxActivation}%`,
      sous: `${totalActives} activés / ${totalComptes} ouverts`,
      objectif: 70,
      score: tauxActivation,
      icon: '🎯',
      desc: 'Objectif ≥ 70%'
    },
    {
      titre: 'Taux de collecte',
      valeur: `${tauxCollecte}%`,
      sous: `${totalRapporte.toLocaleString()} / ${totalCollecte.toLocaleString()} FCFA`,
      objectif: 100,
      score: tauxCollecte,
      icon: '💰',
      desc: 'Montant rapporté vs collecté'
    },
    {
      titre: 'Score mensuel',
      valeur: `${Math.min(scoreMoyen, 100)}%`,
      sous: `${totalComptes} comptes en ${joursActifs} jour(s)`,
      objectif: 100,
      score: Math.min(scoreMoyen, 100),
      icon: '⭐',
      desc: `Objectif : ${objectifJournalierComptes}/jour`
    },
  ]

  const kpisJour = ficheDuJour ? [
    { label: 'Comptes ouverts', value: ficheDuJour.comptes_ouverts, objectif: 6, unite: '' },
    { label: 'Comptes activés', value: ficheDuJour.comptes_actives, objectif: 4, unite: '' },
    { label: 'Montant collecté', value: ficheDuJour.montant_mobilise, objectif: 25000, unite: ' FCFA' },
    { label: 'Dépôts', value: ficheDuJour.nb_depots, objectif: 5, unite: '' },
    { label: 'Prospects', value: ficheDuJour.prospects_visites, objectif: 10, unite: '' },
    { label: 'Clients suivis', value: ficheDuJour.clients_suivis, objectif: 5, unite: '' },
  ] : []

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-open-sans)' }}>

      {/* ── Header ── */}
      <div style={{ backgroundColor: '#2A4E94' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {agent?.prenom?.[0]}{agent?.nom?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">PERCOM</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#E4322C', color: 'white' }}>
                  Agent
                </span>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {agent?.prenom} {agent?.nom}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalManquants > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: '#E4322C', color: 'white' }}>
                ⚠️ {totalManquants.toLocaleString()} FCFA manquant
              </div>
            )}
            <button onClick={handleLogout}
              className="text-xs px-3 py-2 rounded-lg transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
              Déconnexion
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { key: 'dashboard', label: 'Tableau de bord', icon: '📊' },
              { key: 'historique', label: 'Historique', icon: '📋' },
              { key: 'settings', label: 'Paramètres', icon: '⚙️' },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="px-4 py-3 text-xs font-medium transition-all border-b-2"
                style={{
                  color: activeTab === tab.key ? 'white' : 'rgba(255,255,255,0.55)',
                  borderBottomColor: activeTab === tab.key ? 'white' : 'transparent',
                  backgroundColor: 'transparent',
                }}>
                <span className="mr-1.5">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">

        {/* ════ TAB : DASHBOARD ════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Manquants */}
            {totalManquants > 0 && (
              <div className="rounded-2xl p-4 flex items-center justify-between"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: '#FEE2E2' }}>⚠️</div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#991B1B' }}>
                      Manquant(s) en cours
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#B91C1C' }}>
                      {manquants.length} fiche(s) non réglée(s)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl" style={{ color: '#E4322C' }}>
                    {totalManquants.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: '#991B1B' }}>FCFA</div>
                </div>
              </div>
            )}

            {/* Fiche du jour */}
            <div className="rounded-2xl p-5 flex items-center justify-between"
              style={{
                background: ficheDuJour
                  ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)'
                  : 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                border: `1px solid ${ficheDuJour ? '#BBF7D0' : '#C7D2FE'}`
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: ficheDuJour ? '#DCFCE7' : '#E0E7FF' }}>
                  {ficheDuJour ? '✅' : '📝'}
                </div>
                <div>
                  <div className="font-bold" style={{ color: ficheDuJour ? '#166534' : '#2A4E94' }}>
                    {ficheDuJour ? 'Fiche soumise aujourd\'hui' : 'Fiche du jour à remplir'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: ficheDuJour ? '#166534' : '#818387' }}>
                    {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>
              {!ficheDuJour && (
                <button onClick={() => router.push('/dashboard/agent/fiche')}
                  className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 shrink-0"
                  style={{ backgroundColor: '#2A4E94' }}>
                  <span className="hidden sm:inline">Remplir</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
            </div>

            {/* Indicateurs de performance */}
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a2e' }}>
                📈 Indicateurs du mois
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {indicateurs.map(ind => {
                  const color = ind.score >= ind.objectif ? '#166534'
                    : ind.score >= ind.objectif * 0.5 ? '#854D0E' : '#991B1B'
                  const bg = ind.score >= ind.objectif ? '#F0FDF4'
                    : ind.score >= ind.objectif * 0.5 ? '#FEFCE8' : '#FEF2F2'
                  const barColor = ind.score >= ind.objectif ? '#22C55E'
                    : ind.score >= ind.objectif * 0.5 ? '#EAB308' : '#EF4444'
                  return (
                    <div key={ind.titre} className="bg-white rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs font-medium mb-1" style={{ color: '#818387' }}>
                            {ind.titre}
                          </div>
                          <div className="text-2xl font-bold" style={{ color }}>{ind.valeur}</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: bg }}>
                          {ind.icon}
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full mb-2" style={{ backgroundColor: '#f1f5f9' }}>
                        <div className="h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(ind.score, 100)}%`, backgroundColor: barColor }} />
                      </div>
                      <div className="text-xs" style={{ color: '#818387' }}>{ind.sous}</div>
                      <div className="text-xs mt-1 font-medium" style={{ color }}>{ind.desc}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* KPIs du jour */}
            {ficheDuJour && (
              <div>
                <h2 className="text-sm font-bold mb-3" style={{ color: '#1a1a2e' }}>
                  🎯 Performance du jour
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {kpisJour.map(kpi => {
                    const pct = Math.min(100, Math.round((kpi.value / kpi.objectif) * 100))
                    const atteint = kpi.value >= kpi.objectif
                    const partiel = pct >= 50 && !atteint
                    const bg = atteint ? '#F0FDF4' : partiel ? '#FEFCE8' : '#FEF2F2'
                    const color = atteint ? '#166534' : partiel ? '#854D0E' : '#991B1B'
                    const barColor = atteint ? '#22C55E' : partiel ? '#EAB308' : '#EF4444'
                    return (
                      <div key={kpi.label} className="bg-white rounded-2xl p-4 border border-gray-100">
                        <div className="text-xs mb-1" style={{ color: '#818387' }}>{kpi.label}</div>
                        <div className="font-bold text-xl" style={{ color }}>
                          {kpi.value?.toLocaleString()}{kpi.unite}
                        </div>
                        <div className="text-xs mt-1 mb-2" style={{ color: '#818387' }}>
                          / {kpi.objectif.toLocaleString()}{kpi.unite}
                        </div>
                        <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        <div className="text-xs mt-1 font-semibold" style={{ color }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>

                {ficheDuJour.montant_mobilise > ficheDuJour.montant_rapporte && (
                  <div className="mt-3 bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs" style={{ color: '#818387' }}>Manquant du jour</div>
                      <div className="font-bold text-lg mt-0.5" style={{ color: '#E4322C' }}>
                        {(ficheDuJour.montant_mobilise - ficheDuJour.montant_rapporte).toLocaleString()} FCFA
                      </div>
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{
                        backgroundColor: ficheDuJour.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                        color: ficheDuJour.manquant_regle ? '#166534' : '#991B1B'
                      }}>
                      {ficheDuJour.manquant_regle ? '✅ Réglé' : '⏳ En attente chef'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Résumé mensuel */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="text-sm font-bold mb-4" style={{ color: '#1a1a2e' }}>📊 Résumé du mois</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Jours actifs', value: joursActifs, icon: '📅' },
                  { label: 'Comptes ouverts', value: totalComptes, icon: '🏦' },
                  { label: 'Prospects visités', value: totalProspects, icon: '👥' },
                  { label: 'Montant collecté', value: totalCollecte.toLocaleString() + ' F', icon: '💵' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{item.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════ TAB : HISTORIQUE ════ */}
        {activeTab === 'historique' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: '#1a1a2e' }}>📋 Historique des fiches</h2>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
              {/* Période */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'jour', label: "Aujourd'hui" },
                  { key: 'semaine', label: '7 derniers jours' },
                  { key: 'mois', label: 'Ce mois' },
                  { key: 'annee', label: 'Cette année' },
                  { key: 'custom', label: 'Période' },
                ].map(p => (
                  <button key={p.key}
                    onClick={() => setPeriode(p.key as Periode)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      backgroundColor: periode === p.key ? '#2A4E94' : '#f1f5f9',
                      color: periode === p.key ? 'white' : '#818387',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Période personnalisée */}
              {periode === 'custom' && (
                <div className="flex gap-3 flex-wrap">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: '#818387' }}>Du</label>
                    <input type="date" value={dateDebut}
                      onChange={e => setDateDebut(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ borderColor: '#e2e8f0' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: '#818387' }}>Au</label>
                    <input type="date" value={dateFin}
                      onChange={e => setDateFin(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none"
                      style={{ borderColor: '#e2e8f0' }} />
                  </div>
                </div>
              )}

              {/* Recherche */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Rechercher par date, montant..."
                  value={recherche}
                  onChange={e => setRecherche(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                />
              </div>

              <div className="text-xs" style={{ color: '#818387' }}>
                {fichesFiltrees.length} fiche(s) trouvée(s)
              </div>
            </div>

            {/* Liste des fiches */}
            {fichesFiltrees.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                <div className="text-4xl mb-3">📭</div>
                <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>Aucune fiche trouvée</div>
                <div className="text-xs mt-1" style={{ color: '#818387' }}>Modifiez les filtres ou remplissez votre première fiche</div>
              </div>
            ) : (
              <div className="space-y-3">
                {fichesFiltrees.map(fiche => {
                  const manq = Math.max(0, (fiche.montant_mobilise || 0) - (fiche.montant_rapporte || 0))
                  const tauxAct = fiche.comptes_ouverts > 0
                    ? Math.round((fiche.comptes_actives / fiche.comptes_ouverts) * 100) : 0
                  return (
                    <div key={fiche.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>
                            {new Date(fiche.date).toLocaleDateString('fr-FR', {
                              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {manq > 0 && (
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{
                                backgroundColor: fiche.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                                color: fiche.manquant_regle ? '#166534' : '#991B1B'
                              }}>
                              {fiche.manquant_regle ? '✅' : '⚠️'} {manq.toLocaleString()} F
                            </span>
                          )}
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              backgroundColor: fiche.valide_chef ? '#DCFCE7' : '#FEF9C3',
                              color: fiche.valide_chef ? '#166534' : '#854D0E'
                            }}>
                            {fiche.valide_chef ? 'Validée' : 'En attente'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[
                          { label: 'Comptes', value: fiche.comptes_ouverts },
                          { label: 'Activés', value: fiche.comptes_actives },
                          { label: 'Taux act.', value: `${tauxAct}%` },
                          { label: 'Collecté', value: `${(fiche.montant_mobilise || 0).toLocaleString()}F` },
                          { label: 'Prospects', value: fiche.prospects_visites },
                          { label: 'Assurances', value: fiche.assurances_vendues },
                        ].map(item => (
                          <div key={item.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{item.value}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB : PARAMÈTRES ════ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: '#1a1a2e' }}>⚙️ Paramètres du compte</h2>

            {/* Profil */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>
                👤 Informations personnelles
              </h3>

              {settingsSuccess && (
                <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                  ✅ Modifications enregistrées avec succès
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: '#1a1a2e' }}>Prénom</label>
                    <input
                      type="text"
                      value={settingsForm.prenom}
                      onChange={e => setSettingsForm(p => ({ ...p, prenom: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ borderColor: '#e2e8f0' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: '#1a1a2e' }}>Nom</label>
                    <input
                      type="text"
                      value={settingsForm.nom}
                      onChange={e => setSettingsForm(p => ({ ...p, nom: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ borderColor: '#e2e8f0' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#1a1a2e' }}>Téléphone</label>
                  <input
                    type="tel"
                    value={settingsForm.telephone}
                    onChange={e => setSettingsForm(p => ({ ...p, telephone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0' }}
                    placeholder="+228 9X XX XX XX"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#1a1a2e' }}>Rôle</label>
                  <div className="px-4 py-3 rounded-xl text-sm"
                    style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                    {agent?.role?.toUpperCase()} — non modifiable
                  </div>
                </div>
                <button
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: settingsSaving ? '#818387' : '#2A4E94' }}>
                  {settingsSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </div>

            {/* Infos compte */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>
                🏦 Informations PADES
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Agence', value: 'Sagbado' },
                  { label: 'Statut', value: agent?.actif ? '✅ Actif' : '❌ Inactif' },
                  { label: 'Membre depuis', value: new Date(agent?.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: '#f1f5f9' }}>
                    <span className="text-xs" style={{ color: '#818387' }}>{item.label}</span>
                    <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl text-sm font-semibold border-2 transition-all"
              style={{ borderColor: '#E4322C', color: '#E4322C', backgroundColor: 'white' }}>
              Se déconnecter
            </button>
          </div>
        )}

      </div>

      {/* ── Navigation mobile bas ── */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden border-t"
        style={{ backgroundColor: 'white', borderColor: '#f1f5f9' }}>
        <div className="flex">
          {[
            { key: 'dashboard', label: 'Accueil', icon: '📊' },
            { key: 'historique', label: 'Fiches', icon: '📋' },
            { key: 'settings', label: 'Profil', icon: '⚙️' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-1 flex flex-col items-center py-3 text-xs font-medium transition-all"
              style={{ color: activeTab === tab.key ? '#2A4E94' : '#818387' }}>
              <span className="text-xl mb-0.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Padding bas mobile */}
      <div className="h-20 md:hidden" />
    </div>
  )
}