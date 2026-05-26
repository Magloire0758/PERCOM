'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'dashboard' | 'agents' | 'equipes' | 'objectifs' | 'fiches' | 'alertes' | 'manquants' | 'parametres'

export default function DashboardResponsable() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [responsable, setResponsable] = useState<any>(null)

  // Stats agence
  const [stats, setStats] = useState({
    totalAgents: 0, collecteAujourdhui: 0, collecteMois: 0,
    agentsEnAttente: 0, manquantsTotal: 0, fichesNonValides: 0,
  })
  const [topAgents, setTopAgents] = useState<any[]>([])
  const [evolutionMensuelle, setEvolutionMensuelle] = useState<any[]>([])
  const [alertesDash, setAlertesDash] = useState<any[]>([])

  // Agents
  const [agentsData, setAgentsData] = useState<any[]>([])
  const [agentSearch, setAgentSearch] = useState('')
  const [agentFilterRole, setAgentFilterRole] = useState('tous')
  const [agentFilterStatut, setAgentFilterStatut] = useState('tous')
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [agentFiches, setAgentFiches] = useState<any[]>([])
  const [agentLoadingFiches, setAgentLoadingFiches] = useState(false)

  // Équipes
  const [equipes, setEquipes] = useState<any[]>([])
  const [equipeSearch, setEquipeSearch] = useState('')
  const [selectedEquipe, setSelectedEquipe] = useState<any>(null)
  const [equipeMembers, setEquipeMembers] = useState<any[]>([])
  const [equipeZones, setEquipeZones] = useState<any[]>([])

  // Objectifs
  const [objectifs, setObjectifs] = useState<any[]>([])
  const [objectifSearch, setObjectifSearch] = useState('')
  const [objectifFilterStatut, setObjectifFilterStatut] = useState('tous')
  const [showObjectifModal, setShowObjectifModal] = useState(false)
  const [editingObjectif, setEditingObjectif] = useState<any>(null)
  const [deleteObjectifConfirm, setDeleteObjectifConfirm] = useState<string | null>(null)
  const [objectifLoading, setObjectifLoading] = useState(false)
  const [objectifForm, setObjectifForm] = useState({
    titre: '', type_periodicite: 'mensuel', type_cible: 'agent',
    agent_id: '', equipe_id: '', zone_id: '',
    date_debut: '', date_fin: '', statut_objectif: 'actif',
    cible_comptes: 6, cible_comptes_actives: 4, cible_montant: 25000,
    cible_depots: 5, cible_visites_prospects: 50, cible_clients_suivis: 25,
    cible_assurances: 0, description: '',
  })

  // Fiches
  const [fiches, setFiches] = useState<any[]>([])
  const [ficheSearch, setFicheSearch] = useState('')
  const [ficheFilterStatut, setFicheFilterStatut] = useState('tous')
  const [ficheFilterDate, setFicheFilterDate] = useState('')
  const [selectedFiche, setSelectedFiche] = useState<any>(null)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationFiche, setValidationFiche] = useState<any>(null)
  const [validationStatut, setValidationStatut] = useState('validee')
  const [validationCommentaire, setValidationCommentaire] = useState('')

  // Alertes
  const [alertesData, setAlertesData] = useState<any[]>([])
  const [alertesLoading, setAlertesLoading] = useState(false)

  // Manquants
  const [manquants, setManquants] = useState<any[]>([])
  const [manquantSearch, setManquantSearch] = useState('')
  const [manquantFilterStatut, setManquantFilterStatut] = useState('tous')
  const [selectedManquant, setSelectedManquant] = useState<any>(null)

  // Paramètres
  const [respForm, setRespForm] = useState({ nom: '', prenom: '', telephone: '' })
  const [respSaving, setRespSaving] = useState(false)
  const [respSuccess, setRespSuccess] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  useEffect(() => {
    if (tab === 'agents') loadAgents()
    if (tab === 'equipes') loadEquipes()
    if (tab === 'objectifs') loadObjectifs()
    if (tab === 'fiches') loadFiches()
    if (tab === 'alertes') loadAlertes()
    if (tab === 'manquants') loadManquants()
    if (tab === 'parametres') setRespForm({
      nom: responsable?.nom || '',
      prenom: responsable?.prenom || '',
      telephone: responsable?.telephone || ''
    })
  }, [tab])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: me } = await supabase.from('agents')
      .select('*, agences(nom)').eq('user_id', user.id).single()
    if (!me || me.role !== 'responsable') { router.push('/login'); return }
    setResponsable(me)
    await Promise.all([loadStats(me), loadAgents(me), loadFiches(me)])
    setLoading(false)
  }

  async function loadStats(resp?: any) {
    const r = resp || responsable
    if (!r?.agence_id) return

    // Agents de l'agence
    const { data: agentsAgence } = await supabase.from('agents')
      .select('id').eq('agence_id', r.agence_id).neq('role', 'admin')
    const agentIds = (agentsAgence || []).map(a => a.id)

    const [
      { count: totalAgents },
      { data: fichesAuj },
      { data: fichesMois },
      { count: enAttente },
      { data: manquantsData },
      { count: fichesNonValides },
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('agence_id', r.agence_id).neq('role', 'admin'),
      agentIds.length > 0 ? supabase.from('fiches_journalieres').select('montant_mobilise').eq('date', today).in('agent_id', agentIds) : { data: [] },
      agentIds.length > 0 ? supabase.from('fiches_journalieres').select('montant_mobilise, agent_id').gte('date', moisDebut).in('agent_id', agentIds) : { data: [] },
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('agence_id', r.agence_id).eq('statut', 'en_attente'),
      agentIds.length > 0 ? supabase.from('fiches_journalieres').select('montant_mobilise, montant_rapporte').eq('manquant_regle', false).in('agent_id', agentIds) : { data: [] },
      agentIds.length > 0 ? supabase.from('fiches_journalieres').select('*', { count: 'exact', head: true }).eq('valide_chef', false).in('agent_id', agentIds) : { count: 0 },
    ])

    const collecteAujourdhui = (fichesAuj || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
    const collecteMois = (fichesMois || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
    const manquantsTotal = (manquantsData || []).reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)

    setStats({ totalAgents: totalAgents || 0, collecteAujourdhui, collecteMois, agentsEnAttente: enAttente || 0, manquantsTotal, fichesNonValides: fichesNonValides || 0 })

    // Top agents
    const scores: Record<string, number> = {}
    ;(fichesMois || []).forEach(f => { scores[f.agent_id] = (scores[f.agent_id] || 0) + (f.montant_mobilise || 0) })
    const topIds = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (topIds.length > 0) {
      const { data: topData } = await supabase.from('agents').select('id, nom, prenom').in('id', topIds.map(t => t[0]))
      setTopAgents(topIds.map(([id, montant]) => ({ ...topData?.find(a => a.id === id), montant })))
    }

    // Alertes dashboard
    const al = []
    if ((enAttente || 0) > 0) al.push({ type: 'warning', message: `${enAttente} agent(s) en attente`, action: 'agents' })
    if (manquantsTotal > 0) al.push({ type: 'error', message: `${manquantsTotal.toLocaleString()} FCFA de manquants`, action: 'manquants' })
    if ((fichesNonValides || 0) > 0) al.push({ type: 'info', message: `${fichesNonValides} fiche(s) à valider`, action: 'fiches' })
    setAlertesDash(al)

    // Evolution 6 mois
    const evolution = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const debut = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      let total = 0
      if (agentIds.length > 0) {
        const { data: mData } = await supabase.from('fiches_journalieres')
          .select('montant_mobilise').gte('date', debut).lte('date', fin).in('agent_id', agentIds)
        total = (mData || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
      }
      evolution.push({ mois: d.toLocaleDateString('fr-FR', { month: 'short' }), total, pct: Math.min(100, Math.round(total / 500000 * 100)) })
    }
    setEvolutionMensuelle(evolution)
  }

  async function loadAgents(resp?: any) {
    const r = resp || responsable
    if (!r?.agence_id) return
    const { data } = await supabase.from('agents')
      .select('*, agences(nom), equipes!agents_equipe_id_fkey(nom)')
      .eq('agence_id', r.agence_id).neq('role', 'admin')
      .order('created_at', { ascending: false })
    setAgentsData(data || [])
  }

  async function selectAgent(agent: any) {
    setSelectedAgent(agent)
    setAgentLoadingFiches(true)
    const { data } = await supabase.from('fiches_journalieres').select('*')
      .eq('agent_id', agent.id).order('date', { ascending: false }).limit(10)
    setAgentFiches(data || [])
    setAgentLoadingFiches(false)
  }

  async function loadEquipes(resp?: any) {
    const r = resp || responsable
    if (!r?.agence_id) return
    const { data } = await supabase.from('equipes')
      .select('*, agences(nom), agents!equipes_chef_id_fkey(nom, prenom)')
      .eq('agence_id', r.agence_id).order('created_at', { ascending: false })
    const withStats = await Promise.all((data || []).map(async eq => {
      const { count: nbMembres } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('equipe_id', eq.id)
      return { ...eq, nbMembres: nbMembres || 0 }
    }))
    setEquipes(withStats)
  }

  async function selectEquipe(equipe: any) {
    setSelectedEquipe(equipe)
    const { data: members } = await supabase.from('agents').select('*, agences(nom)').eq('equipe_id', equipe.id)
    setEquipeMembers(members || [])
    const { data: ez } = await supabase.from('equipe_zones').select('zone_id, zones(id, numero, nom)').eq('equipe_id', equipe.id)
    setEquipeZones(ez || [])
  }

  async function loadObjectifs(resp?: any) {
    const r = resp || responsable
    if (!r?.agence_id) return
    const { data } = await supabase.from('objectifs')
      .select('*, agents(nom, prenom), equipes(nom), agences(nom)')
      .or(`agence_id.eq.${r.agence_id},type_cible.eq.global`)
      .order('created_at', { ascending: false })
    setObjectifs(data || [])
  }

  async function saveObjectif(e: React.FormEvent) {
    e.preventDefault()
    setObjectifLoading(true)
    const payload = {
      titre: objectifForm.titre, type_periodicite: objectifForm.type_periodicite,
      type_cible: objectifForm.type_cible,
      agent_id: objectifForm.type_cible === 'agent' ? objectifForm.agent_id || null : null,
      equipe_id: objectifForm.type_cible === 'equipe' ? objectifForm.equipe_id || null : null,
      agence_id: responsable?.agence_id || null,
      zone_id: objectifForm.zone_id || null,
      date_debut: objectifForm.date_debut || null, date_fin: objectifForm.date_fin || null,
      statut_objectif: objectifForm.statut_objectif,
      cible_comptes: objectifForm.cible_comptes, cible_comptes_actives: objectifForm.cible_comptes_actives,
      cible_montant: objectifForm.cible_montant, cible_depots: objectifForm.cible_depots,
      cible_visites_prospects: objectifForm.cible_visites_prospects, cible_clients_suivis: objectifForm.cible_clients_suivis,
      cible_assurances: objectifForm.cible_assurances, description: objectifForm.description,
      mois: new Date().getMonth() + 1, annee: new Date().getFullYear(),
    }
    if (editingObjectif) {
      await supabase.from('objectifs').update(payload).eq('id', editingObjectif.id)
      setObjectifs(prev => prev.map(o => o.id === editingObjectif.id ? { ...o, ...payload } : o))
    } else {
      const { data } = await supabase.from('objectifs').insert(payload).select().single()
      if (data) setObjectifs(prev => [data, ...prev])
    }
    setShowObjectifModal(false); setEditingObjectif(null); resetObjectifForm(); setObjectifLoading(false)
  }

  async function deleteObjectif(id: string) {
    await supabase.from('objectifs').delete().eq('id', id)
    setObjectifs(prev => prev.filter(o => o.id !== id))
    setDeleteObjectifConfirm(null)
  }

  async function toggleObjectifStatut(id: string, statut: string) {
    await supabase.from('objectifs').update({ statut_objectif: statut }).eq('id', id)
    setObjectifs(prev => prev.map(o => o.id === id ? { ...o, statut_objectif: statut } : o))
  }

  function resetObjectifForm() {
    setObjectifForm({ titre: '', type_periodicite: 'mensuel', type_cible: 'agent', agent_id: '', equipe_id: '', zone_id: '', date_debut: '', date_fin: '', statut_objectif: 'actif', cible_comptes: 6, cible_comptes_actives: 4, cible_montant: 25000, cible_depots: 5, cible_visites_prospects: 50, cible_clients_suivis: 25, cible_assurances: 0, description: '' })
  }

  function openCreateObjectif() { setEditingObjectif(null); resetObjectifForm(); setShowObjectifModal(true) }
  function openEditObjectif(obj: any) {
    setEditingObjectif(obj)
    setObjectifForm({ titre: obj.titre || '', type_periodicite: obj.type_periodicite || 'mensuel', type_cible: obj.type_cible || 'agent', agent_id: obj.agent_id || '', equipe_id: obj.equipe_id || '', zone_id: obj.zone_id || '', date_debut: obj.date_debut || '', date_fin: obj.date_fin || '', statut_objectif: obj.statut_objectif || 'actif', cible_comptes: obj.cible_comptes || 6, cible_comptes_actives: obj.cible_comptes_actives || 4, cible_montant: obj.cible_montant || 25000, cible_depots: obj.cible_depots || 5, cible_visites_prospects: obj.cible_visites_prospects || 50, cible_clients_suivis: obj.cible_clients_suivis || 25, cible_assurances: obj.cible_assurances || 0, description: obj.description || '' })
    setShowObjectifModal(true)
  }

  async function loadFiches(resp?: any) {
    const r = resp || responsable
    if (!r?.agence_id) return
    const { data: agentsAgence } = await supabase.from('agents').select('id').eq('agence_id', r.agence_id)
    const agentIds = (agentsAgence || []).map(a => a.id)
    if (agentIds.length === 0) { setFiches([]); return }
    const { data } = await supabase.from('fiches_journalieres')
      .select('*, agents!inner(nom, prenom, agence_id, agences(nom))')
      .in('agent_id', agentIds).order('date', { ascending: false }).limit(100)
    setFiches(data || [])
  }

  async function validerFicheResponsable(ficheId: string, statut: string, commentaire?: string) {
    await supabase.from('fiches_journalieres').update({
      valide_chef: statut === 'validee',
      statut_validation: statut,
      commentaire_chef: commentaire || null,
      valide_par: responsable?.id || null,
    }).eq('id', ficheId)

    // Notification agent
    const fiche = fiches.find(f => f.id === ficheId)
    if (fiche) {
      const titres: Record<string, string> = { validee: '✅ Fiche validée', rejetee: '❌ Fiche rejetée', a_corriger: '🔄 Fiche à corriger' }
      const msgs: Record<string, string> = {
        validee: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} a été validée.`,
        rejetee: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} a été rejetée.${commentaire ? ` Motif: ${commentaire}` : ''}`,
        a_corriger: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} nécessite des corrections.${commentaire ? ` Note: ${commentaire}` : ''}`,
      }
      await supabase.from('notifications').insert({
        agent_id: fiche.agent_id,
        type: statut === 'validee' ? 'validation' : statut === 'rejetee' ? 'rejet' : 'correction',
        titre: titres[statut], message: msgs[statut],
      })
    }

    setFiches(prev => prev.map(f => f.id === ficheId ? { ...f, valide_chef: statut === 'validee', statut_validation: statut, commentaire_chef: commentaire || null } : f))
    if (selectedFiche?.id === ficheId) setSelectedFiche((p: any) => ({ ...p, valide_chef: statut === 'validee', statut_validation: statut, commentaire_chef: commentaire || null }))
  }

  async function loadAlertes() {
    if (!responsable?.agence_id) return
    setAlertesLoading(true)
    const { data: agentsAgence } = await supabase.from('agents').select('id').eq('agence_id', responsable.agence_id)
    const agentIds = (agentsAgence || []).map(a => a.id)

    const liste: any[] = []
    if (agentIds.length > 0) {
      const [{ data: manquantsData }, { data: fichesNV }, { count: enAttente }] = await Promise.all([
        supabase.from('fiches_journalieres').select('*, agents!inner(nom, prenom, agences(nom))').eq('manquant_regle', false).in('agent_id', agentIds),
        supabase.from('fiches_journalieres').select('*, agents!inner(nom, prenom, agences(nom))').eq('valide_chef', false).lt('date', today).in('agent_id', agentIds),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('agence_id', responsable.agence_id).eq('statut', 'en_attente'),
      ])

      ;(manquantsData || []).filter(f => Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0).forEach(f => {
        const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
        liste.push({ type: 'error', categorie: 'Manquant', message: `Manquant de ${montant.toLocaleString()} FCFA`, detail: `${f.agents?.prenom} ${f.agents?.nom} — ${new Date(f.date).toLocaleDateString('fr-FR')}`, date: f.date, action: 'manquants' })
      })
      ;(fichesNV || []).forEach(f => {
        liste.push({ type: 'warning', categorie: 'Validation', message: 'Fiche à valider', detail: `${f.agents?.prenom} ${f.agents?.nom} — ${new Date(f.date).toLocaleDateString('fr-FR')}`, date: f.date, action: 'fiches' })
      })
      if ((enAttente || 0) > 0) liste.push({ type: 'info', categorie: 'Compte', message: `${enAttente} agent(s) en attente`, detail: 'Activation requise', date: today, action: 'agents' })
    }

    const ordre = { error: 0, warning: 1, info: 2 }
    liste.sort((a, b) => ordre[a.type as keyof typeof ordre] - ordre[b.type as keyof typeof ordre])
    setAlertesData(liste); setAlertesLoading(false)
  }

  async function loadManquants() {
    if (!responsable?.agence_id) return
    const { data: agentsAgence } = await supabase.from('agents').select('id').eq('agence_id', responsable.agence_id)
    const agentIds = (agentsAgence || []).map(a => a.id)
    if (agentIds.length === 0) { setManquants([]); return }
    const { data } = await supabase.from('fiches_journalieres')
      .select('*, agents!inner(nom, prenom, agence_id, telephone, agences(nom))')
      .in('agent_id', agentIds).order('date', { ascending: false })
    setManquants((data || []).filter(f => Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0))
  }

  async function saveRespProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!responsable) return
    setRespSaving(true)
    await supabase.from('agents').update(respForm).eq('id', responsable.id)
    setResponsable((p: any) => ({ ...p, ...respForm }))
    setRespSaving(false); setRespSuccess(true)
    setTimeout(() => setRespSuccess(false), 3000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'agents', label: 'Agents', icon: '👥' },
    { key: 'equipes', label: 'Équipes', icon: '🤝' },
    { key: 'objectifs', label: 'Objectifs', icon: '🎯' },
    { key: 'fiches', label: 'Fiches', icon: '📋' },
    { key: 'alertes', label: 'Alertes', icon: '⚠️' },
    { key: 'manquants', label: 'Manquants', icon: '🚨' },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Chargement...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>

      {/* SIDEBAR */}
      <div className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'}`}
        style={{ backgroundColor: '#0f172a', minHeight: '100vh', position: 'sticky', top: 0 }}>
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: '#2A4E94', color: 'white' }}>P</div>
          {sidebarOpen && (
            <div>
              <div className="text-white font-bold text-sm">PERCOM</div>
              <div className="text-xs font-semibold" style={{ color: '#22C55E' }}>RESPONSABLE</div>
            </div>
          )}
        </div>
        {sidebarOpen && responsable?.agences?.nom && (
          <div className="px-4 py-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            🏦 {responsable.agences.nom}
          </div>
        )}
        <nav className="p-2 space-y-1 mt-1">
          {navItems.map(item => (
            <button key={item.key} type="button" onClick={() => setTab(item.key as Tab)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: tab === item.key ? '#2A4E94' : 'transparent', color: tab === item.key ? 'white' : 'rgba(255,255,255,0.55)' }}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-xs">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b"
          style={{ backgroundColor: 'white', borderColor: '#f1f5f9' }}>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
              {tab === 'dashboard' && '📊 Dashboard — ' + (responsable?.agences?.nom || '')}
              {tab === 'agents' && '👥 Agents — ' + (responsable?.agences?.nom || '')}
              {tab === 'equipes' && '🤝 Équipes — ' + (responsable?.agences?.nom || '')}
              {tab === 'objectifs' && '🎯 Objectifs'}
              {tab === 'fiches' && '📋 Fiches — ' + (responsable?.agences?.nom || '')}
              {tab === 'alertes' && '⚠️ Alertes'}
              {tab === 'manquants' && '🚨 Manquants'}
              {tab === 'parametres' && '⚙️ Paramètres'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#818387' }}>PADES Microfinance — Responsable d&apos;agence</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
              🏦 {responsable?.prenom} {responsable?.nom}
            </div>
            <button onClick={handleLogout} type="button"
              className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              Déconnexion
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">

          {/* ════ DASHBOARD ════ */}
          {tab === 'dashboard' && (
            <>
              {/* Alertes */}
              {alertesDash.length > 0 && (
                <div className="space-y-2">
                  {alertesDash.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: a.type === 'error' ? '#FEF2F2' : a.type === 'warning' ? '#FEF9C3' : '#EEF2FF', border: `1px solid ${a.type === 'error' ? '#FECACA' : a.type === 'warning' ? '#FDE68A' : '#C7D2FE'}` }}>
                      <span className="text-sm font-medium" style={{ color: a.type === 'error' ? '#991B1B' : a.type === 'warning' ? '#854D0E' : '#2A4E94' }}>
                        {a.type === 'error' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'} {a.message}
                      </span>
                      <button type="button" onClick={() => setTab(a.action as Tab)}
                        className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: '#1a1a2e' }}>
                        Voir →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Agents actifs', value: stats.totalAgents, icon: '👥', color: '#2A4E94', bg: '#EEF2FF' },
                  { label: "Collecté aujourd'hui", value: stats.collecteAujourdhui.toLocaleString() + ' F', icon: '💰', color: '#854D0E', bg: '#FEF9C3' },
                  { label: 'Collecté ce mois', value: stats.collecteMois.toLocaleString() + ' F', icon: '📈', color: '#166534', bg: '#F0FDF4' },
                  { label: 'En attente activation', value: stats.agentsEnAttente, icon: '⏳', color: '#854D0E', bg: '#FEF9C3' },
                  { label: 'Manquants non réglés', value: stats.manquantsTotal.toLocaleString() + ' F', icon: '🚨', color: '#991B1B', bg: '#FEF2F2' },
                  { label: 'Fiches à valider', value: stats.fichesNonValides, icon: '📋', color: '#2A4E94', bg: '#EEF2FF' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ backgroundColor: s.bg }}>{s.icon}</div>
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs mt-1" style={{ color: '#818387' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Évolution + Top agents */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-sm mb-5" style={{ color: '#1a1a2e' }}>📈 Évolution collectes (6 mois)</h3>
                  <div className="flex items-end gap-2 h-32">
                    {evolutionMensuelle.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs font-medium" style={{ color: '#2A4E94' }}>{m.total > 0 ? (m.total / 1000).toFixed(0) + 'k' : '0'}</div>
                        <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, m.pct)}%`, minHeight: '4px', backgroundColor: i === evolutionMensuelle.length - 1 ? '#2A4E94' : '#C7D2FE' }} />
                        <div className="text-xs" style={{ color: '#818387' }}>{m.mois}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>🏆 Top agents du mois</h3>
                  {topAgents.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-sm" style={{ color: '#818387' }}>Aucune donnée ce mois</div>
                  ) : (
                    <div className="space-y-3">
                      {topAgents.map((a, i) => {
                        const maxScore = topAgents[0]?.montant || 1
                        const pct = Math.round((a.montant / maxScore) * 100)
                        return (
                          <div key={a.id}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                  style={{ backgroundColor: i === 0 ? '#FEF9C3' : i === 1 ? '#F1F5F9' : '#FEF2F2', color: i === 0 ? '#854D0E' : i === 1 ? '#475569' : '#991B1B' }}>
                                  {i + 1}
                                </div>
                                <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{a.prenom} {a.nom}</div>
                              </div>
                              <span className="text-xs font-bold" style={{ color: '#2A4E94' }}>{(a.montant || 0).toLocaleString()} F</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#EAB308' : '#2A4E94' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Objectifs agence */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>🎯 Objectifs de l&apos;agence</h3>
                {objectifs.length === 0 ? (
                  <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Aucun objectif défini</div>
                ) : (
                  <div className="space-y-3">
                    {objectifs.slice(0, 3).map(obj => {
                      const progression = obj.cible_montant > 0
                        ? Math.min(100, Math.round((stats.collecteMois / obj.cible_montant) * 100)) : 0
                      return (
                        <div key={obj.id} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium" style={{ color: '#1a1a2e' }}>{obj.titre}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: obj.statut_objectif === 'actif' ? '#DCFCE7' : '#FEF9C3', color: obj.statut_objectif === 'actif' ? '#166534' : '#854D0E' }}>
                              {obj.statut_objectif === 'actif' ? '✅ Actif' : '⏸ Suspendu'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full mb-1" style={{ backgroundColor: '#e2e8f0' }}>
                            <div className="h-2 rounded-full" style={{ width: `${progression}%`, backgroundColor: progression >= 100 ? '#22C55E' : '#2A4E94' }} />
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: '#818387' }}>
                            <span>{stats.collecteMois.toLocaleString()} F collectés</span>
                            <span>{progression}% — objectif {(obj.cible_montant || 0).toLocaleString()} F</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════ AGENTS (lecture seule) ════ */}
          {tab === 'agents' && (
            <div className="flex gap-4">
              <div className={`flex flex-col space-y-4 transition-all ${selectedAgent ? 'w-1/2' : 'w-full'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Agents — {responsable?.agences?.nom}</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#818387' }}>{agentsData.length} agent(s)</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>👁️ Lecture seule</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
                  <input type="text" placeholder="Rechercher..." value={agentSearch}
                    onChange={e => setAgentSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                  <div className="flex gap-2">
                    <select value={agentFilterRole} onChange={e => setAgentFilterRole(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                      <option value="tous">Tous les rôles</option>
                      <option value="agent">Agent</option>
                      <option value="chef">Chef</option>
                    </select>
                    <select value={agentFilterStatut} onChange={e => setAgentFilterStatut(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                      <option value="tous">Tous les statuts</option>
                      <option value="actif">Actif</option>
                      <option value="en_attente">En attente</option>
                      <option value="bloque">Bloqué</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {['Agent', 'Rôle', 'Équipe', 'Statut'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentsData.filter(a => {
                          const ms = agentSearch === '' || `${a.prenom} ${a.nom}`.toLowerCase().includes(agentSearch.toLowerCase())
                          const mr = agentFilterRole === 'tous' || a.role === agentFilterRole
                          const mst = agentFilterStatut === 'tous' || a.statut === agentFilterStatut
                          return ms && mr && mst
                        }).map((a, i, arr) => (
                          <tr key={a.id} onClick={() => selectAgent(a)}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: selectedAgent?.id === a.id ? '#EEF2FF' : undefined }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#2A4E94' }}>
                                  {a.prenom?.[0]}{a.nom?.[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>{a.prenom} {a.nom}</div>
                                  <div className="text-xs" style={{ color: '#818387' }}>{a.telephone || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{a.role}</span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#818387' }}>{a.equipes?.nom || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-1 rounded-full font-medium"
                                style={{ backgroundColor: a.statut === 'actif' ? '#DCFCE7' : a.statut === 'en_attente' ? '#FEF9C3' : '#FEE2E2', color: a.statut === 'actif' ? '#166534' : a.statut === 'en_attente' ? '#854D0E' : '#991B1B' }}>
                                {a.statut === 'actif' ? '✅ Actif' : a.statut === 'en_attente' ? '⏳ Attente' : '🚫 Bloqué'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {selectedAgent && (
                <div className="w-1/2">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: '#2A4E94' }}>
                          {selectedAgent.prenom?.[0]}{selectedAgent.nom?.[0]}
                        </div>
                        <div>
                          <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>{selectedAgent.prenom} {selectedAgent.nom}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{selectedAgent.telephone || '—'}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{selectedAgent.role}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedAgent(null)} className="p-1.5 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
                    </div>
                    <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Équipe', value: selectedAgent.equipes?.nom || '—' },
                          { label: 'Statut', value: selectedAgent.actif ? 'Actif' : 'Inactif' },
                          { label: 'Membre depuis', value: new Date(selectedAgent.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                          { label: 'Fiches', value: agentFiches.length + ' enregistrée(s)' },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                            <div className="font-semibold text-sm mt-0.5" style={{ color: '#1a1a2e' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>DERNIÈRES FICHES</h4>
                      {agentLoadingFiches ? (
                        <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Chargement...</div>
                      ) : agentFiches.length === 0 ? (
                        <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Aucune fiche</div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
                          {agentFiches.map(f => {
                            const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                            return (
                              <div key={f.id} className="rounded-xl p-3 border" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                                <div className="flex items-start justify-between mb-1">
                                  <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                                    {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </div>
                                  <div className="flex gap-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ backgroundColor: f.statut_validation === 'validee' ? '#DCFCE7' : f.statut_validation === 'rejetee' ? '#FEE2E2' : '#FEF9C3', color: f.statut_validation === 'validee' ? '#166534' : f.statut_validation === 'rejetee' ? '#991B1B' : '#854D0E' }}>
                                      {f.statut_validation === 'validee' ? '✅' : f.statut_validation === 'rejetee' ? '❌' : '⏳'}
                                    </span>
                                    {manq > 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>⚠️ {manq.toLocaleString()} F</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs" style={{ color: '#818387' }}>{f.comptes_ouverts} comptes · {(f.montant_mobilise || 0).toLocaleString()} FCFA</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ ÉQUIPES (lecture seule) ════ */}
          {tab === 'equipes' && (
            <div className="flex gap-4">
              <div className={`flex flex-col space-y-4 transition-all ${selectedEquipe ? 'w-1/2' : 'w-full'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Équipes — {responsable?.agences?.nom}</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#818387' }}>{equipes.length} équipe(s)</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>👁️ Lecture seule</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <input type="text" placeholder="Rechercher une équipe..."
                    value={equipeSearch} onChange={e => setEquipeSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                </div>

                {equipes.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="text-5xl mb-4">🤝</div>
                    <div className="font-semibold text-base" style={{ color: '#1a1a2e' }}>Aucune équipe</div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {equipes.filter(e => equipeSearch === '' || e.nom.toLowerCase().includes(equipeSearch.toLowerCase())).map(eq => (
                      <div key={eq.id} onClick={() => selectEquipe(eq)}
                        className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-blue-200 transition-all"
                        style={{ boxShadow: selectedEquipe?.id === eq.id ? '0 0 0 2px #2A4E94' : undefined }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: '#2A4E94' }}>{eq.nom?.[0]?.toUpperCase()}</div>
                            <div>
                              <div className="font-bold text-sm" style={{ color: '#1a1a2e' }}>{eq.nom}</div>
                              <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                                Chef : {eq.agents ? `${eq.agents.prenom} ${eq.agents.nom}` : '— Non assigné'}
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{eq.nbMembres}</div>
                            <div className="text-xs" style={{ color: '#818387' }}>membres</div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: eq.actif !== false ? '#DCFCE7' : '#FEE2E2', color: eq.actif !== false ? '#166534' : '#991B1B' }}>
                          {eq.actif !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedEquipe && (
                <div className="w-1/2">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
                      <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>{selectedEquipe.nom}</div>
                      <button type="button" onClick={() => { setSelectedEquipe(null); setEquipeMembers([]) }} className="p-1.5 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
                    </div>
                    <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>MEMBRES ({equipeMembers.length})</h4>
                      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
                        {equipeMembers.map(m => (
                          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: selectedEquipe.chef_id === m.id ? '#854D0E' : '#2A4E94' }}>
                              {m.prenom?.[0]}{m.nom?.[0]}
                            </div>
                            <div>
                              <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                                {m.prenom} {m.nom}
                                {selectedEquipe.chef_id === m.id && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Chef</span>}
                              </div>
                              <div className="text-xs" style={{ color: '#818387' }}>{m.role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {equipeZones.length > 0 && (
                      <div className="p-5">
                        <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>ZONES ({equipeZones.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {equipeZones.map(ez => (
                            <span key={ez.zone_id} className="text-xs px-3 py-1.5 rounded-xl font-medium"
                              style={{ backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
                              Zone {ez.zones?.numero}{ez.zones?.nom ? ` — ${ez.zones.nom}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ OBJECTIFS ════ */}
          {tab === 'objectifs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Objectifs — {responsable?.agences?.nom}</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#818387' }}>{objectifs.length} objectif(s)</p>
                </div>
                <button type="button" onClick={openCreateObjectif}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#2A4E94' }}>
                  ➕ Nouvel objectif
                </button>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-3">
                <input type="text" placeholder="Rechercher..." value={objectifSearch}
                  onChange={e => setObjectifSearch(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                <select value={objectifFilterStatut} onChange={e => setObjectifFilterStatut(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="tous">Tous les statuts</option>
                  <option value="actif">Actif</option>
                  <option value="suspendu">Suspendu</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {objectifs.filter(o => {
                  const ms = objectifSearch === '' || (o.titre || '').toLowerCase().includes(objectifSearch.toLowerCase())
                  const mst = objectifFilterStatut === 'tous' || o.statut_objectif === objectifFilterStatut
                  return ms && mst
                }).map(obj => {
                  const progression = obj.cible_montant > 0
                    ? Math.min(100, Math.round((stats.collecteMois / obj.cible_montant) * 100)) : 0
                  return (
                    <div key={obj.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="font-bold text-sm mb-2" style={{ color: '#1a1a2e' }}>{obj.titre}</div>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{obj.type_periodicite}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: obj.statut_objectif === 'actif' ? '#DCFCE7' : '#FEF9C3', color: obj.statut_objectif === 'actif' ? '#166534' : '#854D0E' }}>
                          {obj.statut_objectif === 'actif' ? '✅ Actif' : '⏸ Suspendu'}
                        </span>
                      </div>

                      {/* Progression */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1" style={{ color: '#818387' }}>
                          <span>Progression collecte</span>
                          <span className="font-bold" style={{ color: progression >= 100 ? '#166534' : '#2A4E94' }}>{progression}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                          <div className="h-2 rounded-full" style={{ width: `${progression}%`, backgroundColor: progression >= 100 ? '#22C55E' : '#2A4E94' }} />
                        </div>
                        <div className="text-xs mt-1" style={{ color: '#818387' }}>
                          {stats.collecteMois.toLocaleString()} F / {(obj.cible_montant || 0).toLocaleString()} F
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {[
                          { label: 'Comptes', value: obj.cible_comptes },
                          { label: 'Montant cible', value: (obj.cible_montant || 0).toLocaleString() + ' F' },
                        ].map(k => (
                          <div key={k.label} className="rounded-lg p-2" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                            <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#f1f5f9' }}>
                        <button type="button" onClick={() => openEditObjectif(obj)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>✏️ Modifier</button>
                        {obj.statut_objectif === 'actif' ? (
                          <button type="button" onClick={() => toggleObjectifStatut(obj.id, 'suspendu')}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>⏸</button>
                        ) : (
                          <button type="button" onClick={() => toggleObjectifStatut(obj.id, 'actif')}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>▶️</button>
                        )}
                        <button type="button" onClick={() => setDeleteObjectifConfirm(obj.id)}
                          className="p-1.5 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🗑️</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {objectifs.filter(o => objectifSearch === '' || (o.titre || '').toLowerCase().includes(objectifSearch.toLowerCase())).length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="text-5xl mb-4">🎯</div>
                  <div className="font-semibold text-base" style={{ color: '#1a1a2e' }}>Aucun objectif</div>
                  <button type="button" onClick={openCreateObjectif}
                    className="mt-4 px-6 py-3 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: '#2A4E94' }}>
                    ➕ Créer un objectif
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════ FICHES (avec validation) ════ */}
          {tab === 'fiches' && (
            <div className="flex gap-4">
              <div className={`flex flex-col space-y-4 transition-all ${selectedFiche ? 'w-1/2' : 'w-full'}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Fiches — {responsable?.agences?.nom}</h2>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                    ✅ Peut valider / rejeter
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: fiches.length, bg: '#EEF2FF', color: '#2A4E94' },
                    { label: 'Validées', value: fiches.filter(f => f.statut_validation === 'validee').length, bg: '#F0FDF4', color: '#166534' },
                    { label: 'Rejetées', value: fiches.filter(f => f.statut_validation === 'rejetee').length, bg: '#FEF2F2', color: '#991B1B' },
                    { label: 'En attente', value: fiches.filter(f => !f.statut_validation || f.statut_validation === 'en_attente').length, bg: '#FEF9C3', color: '#854D0E' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs mt-1" style={{ color: '#818387' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-2">
                  <input type="text" placeholder="Rechercher par agent..." value={ficheSearch}
                    onChange={e => setFicheSearch(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none min-w-40"
                    style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                  <input type="date" value={ficheFilterDate} onChange={e => setFicheFilterDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                  <select value={ficheFilterStatut} onChange={e => setFicheFilterStatut(e.target.value)}
                    className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                    <option value="tous">Tous les statuts</option>
                    <option value="validee">✅ Validée</option>
                    <option value="rejetee">❌ Rejetée</option>
                    <option value="a_corriger">🔄 À corriger</option>
                    <option value="en_attente">⏳ En attente</option>
                  </select>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {['Date', 'Agent', 'Collecté', 'Manquant', 'Statut', 'Actions'].map(h => (
                            <th key={h} className="text-left px-3 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fiches.filter(f => {
                          const ms = ficheSearch === '' || `${f.agents?.prenom} ${f.agents?.nom}`.toLowerCase().includes(ficheSearch.toLowerCase())
                          const mst = ficheFilterStatut === 'tous' || f.statut_validation === ficheFilterStatut
                          const md = ficheFilterDate === '' || f.date === ficheFilterDate
                          return ms && mst && md
                        }).map((f, i, arr) => {
                          const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                          return (
                            <tr key={f.id} onClick={() => setSelectedFiche(f)}
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                              style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: selectedFiche?.id === f.id ? '#EEF2FF' : undefined }}>
                              <td className="px-3 py-3">
                                <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                                  {new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#2A4E94' }}>
                                    {f.agents?.prenom?.[0]}{f.agents?.nom?.[0]}
                                  </div>
                                  <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{f.agents?.prenom} {f.agents?.nom}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs font-semibold" style={{ color: '#166534' }}>{(f.montant_mobilise || 0).toLocaleString()} F</td>
                              <td className="px-3 py-3">
                                {manq > 0 ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2', color: f.manquant_regle ? '#166534' : '#991B1B' }}>
                                    {f.manquant_regle ? '✅' : '⚠️'} {manq.toLocaleString()} F
                                  </span>
                                ) : <span className="text-xs" style={{ color: '#818387' }}>—</span>}
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: f.statut_validation === 'validee' ? '#DCFCE7' : f.statut_validation === 'rejetee' ? '#FEE2E2' : f.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF', color: f.statut_validation === 'validee' ? '#166534' : f.statut_validation === 'rejetee' ? '#991B1B' : f.statut_validation === 'a_corriger' ? '#854D0E' : '#2A4E94' }}>
                                  {f.statut_validation === 'validee' ? '✅' : f.statut_validation === 'rejetee' ? '❌' : f.statut_validation === 'a_corriger' ? '🔄' : '⏳'}
                                </span>
                              </td>
                              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                {(!f.statut_validation || f.statut_validation === 'en_attente' || f.statut_validation === 'a_corriger') && (
                                  <button type="button"
                                    onClick={() => { setValidationFiche(f); setValidationStatut('validee'); setValidationCommentaire(''); setShowValidationModal(true) }}
                                    className="px-2 py-1.5 rounded-lg text-xs font-semibold text-white"
                                    style={{ backgroundColor: '#166634' }}>
                                    Décider
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {selectedFiche && (
                <div className="w-1/2">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
                      <div>
                        <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                          Fiche du {new Date(selectedFiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: '#818387' }}>
                          {selectedFiche.agents?.prenom} {selectedFiche.agents?.nom}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block"
                          style={{ backgroundColor: selectedFiche.statut_validation === 'validee' ? '#DCFCE7' : selectedFiche.statut_validation === 'rejetee' ? '#FEE2E2' : '#FEF9C3', color: selectedFiche.statut_validation === 'validee' ? '#166534' : selectedFiche.statut_validation === 'rejetee' ? '#991B1B' : '#854D0E' }}>
                          {selectedFiche.statut_validation === 'validee' ? '✅ Validée' : selectedFiche.statut_validation === 'rejetee' ? '❌ Rejetée' : selectedFiche.statut_validation === 'a_corriger' ? '🔄 À corriger' : '⏳ En attente'}
                        </span>
                      </div>
                      <button type="button" onClick={() => setSelectedFiche(null)} className="p-1.5 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
                    </div>

                    <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Comptes ouverts', value: selectedFiche.comptes_ouverts || 0 },
                          { label: 'Comptes activés', value: selectedFiche.comptes_actives || 0 },
                          { label: 'Montant collecté', value: (selectedFiche.montant_mobilise || 0).toLocaleString() + ' F' },
                          { label: 'Montant rapporté', value: (selectedFiche.montant_rapporte || 0).toLocaleString() + ' F' },
                          { label: 'Dépôts', value: selectedFiche.nb_depots || 0 },
                          { label: 'Prospects', value: selectedFiche.prospects_visites || 0 },
                          { label: 'Clients suivis', value: selectedFiche.clients_suivis || 0 },
                          { label: 'Assurances', value: selectedFiche.assurances_vendues || 0 },
                        ].map(k => (
                          <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                            <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                            <div className="font-bold text-sm mt-0.5" style={{ color: '#2A4E94' }}>{k.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedFiche.observations && (
                      <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                        <h4 className="font-semibold text-xs mb-2" style={{ color: '#818387' }}>OBSERVATIONS</h4>
                        <p className="text-sm" style={{ color: '#1a1a2e' }}>{selectedFiche.observations}</p>
                      </div>
                    )}

                    {selectedFiche.commentaire_chef && (
                      <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                        <h4 className="font-semibold text-xs mb-2" style={{ color: '#818387' }}>COMMENTAIRE PRÉCÉDENT</h4>
                        <p className="text-sm italic" style={{ color: '#818387' }}>{selectedFiche.commentaire_chef}</p>
                      </div>
                    )}

                    <div className="p-5">
                      <button type="button"
                        onClick={() => { setValidationFiche(selectedFiche); setValidationStatut('validee'); setValidationCommentaire(''); setShowValidationModal(true) }}
                        className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                        style={{ backgroundColor: '#166534' }}>
                        ✅ Prendre une décision
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ ALERTES ════ */}
          {tab === 'alertes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Alertes — {responsable?.agences?.nom}</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#818387' }}>{alertesData.length} alerte(s)</p>
                </div>
                <button type="button" onClick={loadAlertes} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>🔄 Actualiser</button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Critiques', value: alertesData.filter(a => a.type === 'error').length, bg: '#FEF2F2', color: '#991B1B', icon: '🚨' },
                  { label: 'Avertissements', value: alertesData.filter(a => a.type === 'warning').length, bg: '#FEF9C3', color: '#854D0E', icon: '⚠️' },
                  { label: 'Informations', value: alertesData.filter(a => a.type === 'info').length, bg: '#EEF2FF', color: '#2A4E94', icon: 'ℹ️' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: s.bg }}>{s.icon}</div>
                    <div>
                      <div className="font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: '#818387' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {alertesLoading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
                </div>
              ) : alertesData.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <div className="font-semibold" style={{ color: '#166534' }}>Aucune alerte pour votre agence</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertesData.map((alerte, i) => (
                    <div key={i} className="bg-white rounded-2xl border p-4 flex items-start gap-4"
                      style={{ borderColor: alerte.type === 'error' ? '#FECACA' : alerte.type === 'warning' ? '#FDE68A' : '#C7D2FE' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: alerte.type === 'error' ? '#FEF2F2' : alerte.type === 'warning' ? '#FEF9C3' : '#EEF2FF' }}>
                        {alerte.type === 'error' ? '🚨' : alerte.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: alerte.type === 'error' ? '#FEE2E2' : alerte.type === 'warning' ? '#FEF9C3' : '#EEF2FF', color: alerte.type === 'error' ? '#991B1B' : alerte.type === 'warning' ? '#854D0E' : '#2A4E94' }}>
                            {alerte.categorie}
                          </span>
                        </div>
                        <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>{alerte.message}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{alerte.detail}</div>
                      </div>
                      <button type="button" onClick={() => setTab(alerte.action as Tab)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>Voir →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ MANQUANTS (lecture seule) ════ */}
          {tab === 'manquants' && (
            <div className="flex gap-4">
              <div className={`flex flex-col space-y-4 transition-all ${selectedManquant ? 'w-1/2' : 'w-full'}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Manquants — {responsable?.agences?.nom}</h2>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>👁️ Lecture seule</div>
                </div>

                {(() => {
                  const total = manquants.reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
                  const nonRegle = manquants.filter(f => !f.manquant_regle).reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total', value: total.toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                        { label: 'Non réglés', value: nonRegle.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                        { label: 'Fiches', value: manquants.length, color: '#854D0E', bg: '#FEF9C3' },
                      ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                          <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs mt-1" style={{ color: '#818387' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-2">
                  <input type="text" placeholder="Rechercher..." value={manquantSearch}
                    onChange={e => setManquantSearch(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                  <select value={manquantFilterStatut} onChange={e => setManquantFilterStatut(e.target.value)}
                    className="px-3 py-2 rounded-xl border text-xs outline-none" style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                    <option value="tous">Tous</option>
                    <option value="non_regle">⚠️ Non réglés</option>
                    <option value="regle">✅ Réglés</option>
                  </select>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {['Date', 'Agent', 'Collecté', 'Rapporté', 'Manquant', 'Statut'].map(h => (
                            <th key={h} className="text-left px-3 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {manquants.filter(f => {
                          const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                          const ms = manquantSearch === '' || `${f.agents?.prenom} ${f.agents?.nom}`.toLowerCase().includes(manquantSearch.toLowerCase())
                          const mst = manquantFilterStatut === 'tous' || (manquantFilterStatut === 'regle' ? f.manquant_regle : !f.manquant_regle)
                          return ms && mst && montant > 0
                        }).map((f, i, arr) => {
                          const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                          return (
                            <tr key={f.id} onClick={() => setSelectedManquant(f)}
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                              style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: selectedManquant?.id === f.id ? '#FEF2F2' : undefined }}>
                              <td className="px-3 py-3 text-xs font-medium" style={{ color: '#1a1a2e' }}>
                                {new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#E4322C' }}>
                                    {f.agents?.prenom?.[0]}{f.agents?.nom?.[0]}
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{f.agents?.prenom} {f.agents?.nom}</div>
                                    <div className="text-xs" style={{ color: '#818387' }}>{f.agents?.telephone || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs font-semibold" style={{ color: '#166534' }}>{(f.montant_mobilise || 0).toLocaleString()} F</td>
                              <td className="px-3 py-3 text-xs font-semibold" style={{ color: '#2A4E94' }}>{(f.montant_rapporte || 0).toLocaleString()} F</td>
                              <td className="px-3 py-3 text-sm font-bold" style={{ color: '#E4322C' }}>{montant.toLocaleString()} F</td>
                              <td className="px-3 py-3">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2', color: f.manquant_regle ? '#166534' : '#991B1B' }}>
                                  {f.manquant_regle ? '✅' : '⚠️'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {manquants.length === 0 && (
                      <div className="p-12 text-center">
                        <div className="text-4xl mb-3">✅</div>
                        <div className="font-medium text-sm" style={{ color: '#166534' }}>Aucun manquant pour cette agence</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedManquant && (
                <div className="w-1/2">
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
                      <div>
                        <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                          Manquant — {new Date(selectedManquant.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: '#818387' }}>
                          {selectedManquant.agents?.prenom} {selectedManquant.agents?.nom}
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedManquant(null)} className="p-1.5 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
                    </div>
                    <div className="p-5">
                      {(() => {
                        const montant = Math.max(0, (selectedManquant.montant_mobilise || 0) - (selectedManquant.montant_rapporte || 0))
                        return (
                          <>
                            <div className="rounded-2xl p-5 text-center mb-4"
                              style={{ backgroundColor: selectedManquant.manquant_regle ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${selectedManquant.manquant_regle ? '#BBF7D0' : '#FECACA'}` }}>
                              <div className="text-3xl font-bold mb-1" style={{ color: selectedManquant.manquant_regle ? '#166534' : '#E4322C' }}>
                                {montant.toLocaleString()} FCFA
                              </div>
                              <div className="text-sm" style={{ color: selectedManquant.manquant_regle ? '#166534' : '#991B1B' }}>
                                {selectedManquant.manquant_regle ? '✅ Réglé' : '⚠️ Non réglé'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: 'Collecté', value: (selectedManquant.montant_mobilise || 0).toLocaleString() + ' F' },
                                { label: 'Rapporté', value: (selectedManquant.montant_rapporte || 0).toLocaleString() + ' F' },
                                { label: 'Téléphone', value: selectedManquant.agents?.telephone || '—' },
                                { label: 'Date', value: new Date(selectedManquant.date).toLocaleDateString('fr-FR') },
                              ].map(k => (
                                <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                                  <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                                  <div className="font-semibold text-sm mt-0.5" style={{ color: '#1a1a2e' }}>{k.value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                              ℹ️ Le règlement définitif est confirmé par l&apos;administrateur
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ PARAMÈTRES ════ */}
          {tab === 'parametres' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>Paramètres</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-sm mb-5" style={{ color: '#2A4E94' }}>👤 Mon profil</h3>
                {respSuccess && (
                  <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>✅ Profil mis à jour</div>
                )}
                <form onSubmit={saveRespProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Prénom</label>
                      <input type="text" value={respForm.prenom}
                        onChange={e => setRespForm(p => ({ ...p, prenom: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Nom</label>
                      <input type="text" value={respForm.nom}
                        onChange={e => setRespForm(p => ({ ...p, nom: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Téléphone</label>
                    <input type="tel" value={respForm.telephone}
                      onChange={e => setRespForm(p => ({ ...p, telephone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ borderColor: '#e2e8f0' }} placeholder="+228 9X XX XX XX" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Agence</label>
                    <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                      {responsable?.agences?.nom || '—'} — non modifiable
                    </div>
                  </div>
                  <button type="submit" disabled={respSaving}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: respSaving ? '#818387' : '#2A4E94' }}>
                    {respSaving ? 'Sauvegarde...' : 'Enregistrer'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🏦 Mon agence</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Agence', value: responsable?.agences?.nom || '—' },
                    { label: 'Total agents', value: stats.totalAgents },
                    { label: 'Collecte du mois', value: stats.collecteMois.toLocaleString() + ' F' },
                    { label: 'Fiches à valider', value: stats.fichesNonValides },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#f1f5f9' }}>
                      <span className="text-xs" style={{ color: '#818387' }}>{item.label}</span>
                      <span className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#FECACA' }}>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#FEF2F2' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#1a1a2e' }}>Se déconnecter</div>
                    <div className="text-xs mt-0.5" style={{ color: '#818387' }}>Terminer la session</div>
                  </div>
                  <button type="button" onClick={handleLogout}
                    className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#E4322C', color: 'white' }}>
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL VALIDATION FICHEpp */}
      {showValidationModal && validationFiche && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
              <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>📋 Décision sur la fiche</h3>
              <button type="button" onClick={() => setShowValidationModal(false)} className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>
                  {validationFiche.agents?.prenom} {validationFiche.agents?.nom}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                  Fiche du {new Date(validationFiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className="text-xs mt-1" style={{ color: '#2A4E94' }}>
                  {(validationFiche.montant_mobilise || 0).toLocaleString()} FCFA collectés
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-3" style={{ color: '#1a1a2e' }}>Décision *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'validee', label: '✅ Valider', bg: '#F0FDF4', color: '#166534', activeBg: '#166534' },
                    { key: 'rejetee', label: '❌ Rejeter', bg: '#FEF2F2', color: '#991B1B', activeBg: '#991B1B' },
                    { key: 'a_corriger', label: '🔄 Corriger', bg: '#FEF9C3', color: '#854D0E', activeBg: '#854D0E' },
                  ].map(s => (
                    <button key={s.key} type="button"
                      onClick={() => setValidationStatut(s.key)}
                      className="py-3 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: validationStatut === s.key ? s.activeBg : s.bg,
                        color: validationStatut === s.key ? 'white' : s.color,
                        border: `2px solid ${validationStatut === s.key ? s.activeBg : 'transparent'}`
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                  Commentaire {validationStatut !== 'validee' ? '*' : '(optionnel)'}
                </label>
                <textarea value={validationCommentaire} onChange={e => setValidationCommentaire(e.target.value)} rows={3}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: '#e2e8f0' }}
                  placeholder={validationStatut === 'validee' ? 'Bravo ! (optionnel)' : validationStatut === 'rejetee' ? 'Motif du rejet...' : 'Ce qui doit être corrigé...'} />
              </div>

              <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#EEF2FF' }}>
                <span>🔔</span>
                <p className="text-xs" style={{ color: '#2A4E94' }}>L&apos;agent recevra une notification automatique.</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowValidationModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                  Annuler
                </button>
                <button type="button"
                  onClick={async () => {
                    await validerFicheResponsable(validationFiche.id, validationStatut, validationCommentaire)
                    setShowValidationModal(false)
                    setValidationCommentaire('')
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: validationStatut === 'validee' ? '#166534' : validationStatut === 'rejetee' ? '#991B1B' : '#854D0E' }}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OBJECTIF */}
      {showObjectifModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
              <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>{editingObjectif ? '✏️ Modifier' : '🎯 Nouvel objectif'}</h3>
              <button type="button" onClick={() => { setShowObjectifModal(false); setEditingObjectif(null) }} className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>
            <form onSubmit={saveObjectif} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: '80vh' }}>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Titre *</label>
                <input type="text" value={objectifForm.titre} onChange={e => setObjectifForm(p => ({ ...p, titre: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Périodicité</label>
                  <select value={objectifForm.type_periodicite} onChange={e => setObjectifForm(p => ({ ...p, type_periodicite: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                    <option value="journalier">Journalier</option>
                    <option value="hebdomadaire">Hebdomadaire</option>
                    <option value="mensuel">Mensuel</option>
                    <option value="trimestriel">Trimestriel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Cible</label>
                  <select value={objectifForm.type_cible} onChange={e => setObjectifForm(p => ({ ...p, type_cible: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                    <option value="agent">Agent</option>
                    <option value="equipe">Équipe</option>
                    <option value="agence">Agence entière</option>
                  </select>
                </div>
              </div>
              {objectifForm.type_cible === 'agent' && (
                <select value={objectifForm.agent_id} onChange={e => setObjectifForm(p => ({ ...p, agent_id: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                  <option value="">Sélectionner un agent</option>
                  {agentsData.map(a => <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}
                </select>
              )}
              {objectifForm.type_cible === 'equipe' && (
                <select value={objectifForm.equipe_id} onChange={e => setObjectifForm(p => ({ ...p, equipe_id: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }}>
                  <option value="">Sélectionner une équipe</option>
                  {equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'cible_comptes', label: 'Comptes' },
                  { key: 'cible_comptes_actives', label: 'Activations' },
                  { key: 'cible_depots', label: 'Dépôts' },
                  { key: 'cible_visites_prospects', label: 'Prospects' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#818387' }}>{f.label}</label>
                    <input type="number" min="0" value={(objectifForm as any)[f.key]}
                      onChange={e => setObjectifForm(p => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#818387' }}>Montant cible (FCFA)</label>
                <input type="number" min="0" value={objectifForm.cible_montant}
                  onChange={e => setObjectifForm(p => ({ ...p, cible_montant: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: '#e2e8f0' }} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowObjectifModal(false); setEditingObjectif(null) }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
                <button type="submit" disabled={objectifLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: objectifLoading ? '#818387' : '#2A4E94' }}>
                  {objectifLoading ? '...' : editingObjectif ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteObjectifConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>Supprimer cet objectif ?</h3>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteObjectifConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
              <button type="button" onClick={() => deleteObjectif(deleteObjectifConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}