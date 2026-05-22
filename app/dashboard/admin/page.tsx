'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'dashboard' | 'agences' | 'agents' | 'objectifs' | 'fiches' | 'alertes' | 'parametres' | 'equipes' | 'permissions' | 'manquants'

export default function DashboardAdmin() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<any>(null)

  // Data
  const [stats, setStats] = useState({
    totalAgents: 0, totalAgences: 0,
    collecteAujourdhui: 0, collecteMois: 0,
    agentsEnAttente: 0, manquantsTotal: 0,
    fichesNonValides: 0, tauxPerformance: 0,
  })
  const [topAgents, setTopAgents] = useState<any[]>([])
  const [agencesStats, setAgencesStats] = useState<any[]>([])
  const [alertes, setAlertes] = useState<any[]>([])
  const [evolutionMensuelle, setEvolutionMensuelle] = useState<any[]>([])

  // Agences
  const [agences, setAgences] = useState<any[]>([])
  const [agenceSearch, setAgenceSearch] = useState('')
  const [agenceFilter, setAgenceFilter] = useState('tous')
  const [showAgenceModal, setShowAgenceModal] = useState(false)
  const [editingAgence, setEditingAgence] = useState<any>(null)
  const [deleteAgenceConfirm, setDeleteAgenceConfirm] = useState<string | null>(null)
  const [agenceLoading, setAgenceLoading] = useState(false)
  const [agenceForm, setAgenceForm] = useState({
    nom: '', region: '', adresse: '', telephone: '', email: '', actif: true
  })

  // Zones
const [selectedAgenceZones, setSelectedAgenceZones] = useState<any>(null)
const [zones, setZones] = useState<any[]>([])
const [showZoneModal, setShowZoneModal] = useState(false)
const [editingZone, setEditingZone] = useState<any>(null)
const [deleteZoneConfirm, setDeleteZoneConfirm] = useState<string | null>(null)
const [zoneLoading, setZoneLoading] = useState(false)
const [zoneForm, setZoneForm] = useState({ numero: '', nom: '' })

// Agents
const [agentsData, setAgentsData] = useState<any[]>([])
const [agentSearch, setAgentSearch] = useState('')
const [agentFilterRole, setAgentFilterRole] = useState('tous')
const [agentFilterStatut, setAgentFilterStatut] = useState('tous')
const [agentFilterAgence, setAgentFilterAgence] = useState('tous')
const [selectedAgent, setSelectedAgent] = useState<any>(null)
const [agentFiches, setAgentFiches] = useState<any[]>([])
const [agentLoadingFiches, setAgentLoadingFiches] = useState(false)
const [showAgentEditModal, setShowAgentEditModal] = useState(false)
const [agentEditForm, setAgentEditForm] = useState<any>({})
const [agentEditLoading, setAgentEditLoading] = useState(false)
const [deleteAgentConfirm, setDeleteAgentConfirm] = useState<string | null>(null)

// Objectifs
const [objectifs, setObjectifs] = useState<any[]>([])
const [objectifSearch, setObjectifSearch] = useState('')
const [objectifFilterType, setObjectifFilterType] = useState('tous')
const [objectifFilterStatut, setObjectifFilterStatut] = useState('tous')
const [objectifFilterCible, setObjectifFilterCible] = useState('tous')
const [showObjectifModal, setShowObjectifModal] = useState(false)
const [editingObjectif, setEditingObjectif] = useState<any>(null)
const [deleteObjectifConfirm, setDeleteObjectifConfirm] = useState<string | null>(null)
const [objectifLoading, setObjectifLoading] = useState(false)
const [objectifForm, setObjectifForm] = useState({
  titre: '',
  type_periodicite: 'mensuel',
  type_cible: 'agent',
  agent_id: '',
  equipe_id: '',
  agence_id: '',
  zone_id: '',
  date_debut: '',
  date_fin: '',
  statut_objectif: 'actif',
  cible_comptes: 6,
  cible_comptes_actives: 4,
  cible_montant: 25000,
  cible_depots: 5,
  cible_visites_prospects: 50,
  cible_clients_suivis: 25,
  cible_assurances: 0,
  description: '',
})

// Fiches
const [fiches, setFiches] = useState<any[]>([])
const [ficheSearch, setFicheSearch] = useState('')
const [ficheFilterAgence, setFicheFilterAgence] = useState('tous')
const [ficheFilterStatut, setFicheFilterStatut] = useState('tous')
const [ficheFilterDate, setFicheFilterDate] = useState('')
const [ficheFilterManquant, setFicheFilterManquant] = useState('tous')
const [selectedFiche, setSelectedFiche] = useState<any>(null)
const [deleteFicheConfirm, setDeleteFicheConfirm] = useState<string | null>(null)

// Alertes
const [alertesData, setAlertesData] = useState<any[]>([])
const [alertesLoading, setAlertesLoading] = useState(false)

//modale de validation de fiche 
const [showValidationModal, setShowValidationModal] = useState(false)
const [validationFiche, setValidationFiche] = useState<any>(null)
const [validationStatut, setValidationStatut] = useState('validee')
const [validationCommentaire, setValidationCommentaire] = useState('')

// Paramètres
const [adminForm, setAdminForm] = useState({ nom: '', prenom: '', telephone: '' })
const [adminSaving, setAdminSaving] = useState(false)
const [adminSuccess, setAdminSuccess] = useState(false)

// Équipes
const [equipes, setEquipes] = useState<any[]>([])
const [equipeSearch, setEquipeSearch] = useState('')
const [equipeFilterAgence, setEquipeFilterAgence] = useState('tous')
const [selectedEquipe, setSelectedEquipe] = useState<any>(null)
const [equipeMembers, setEquipeMembers] = useState<any[]>([])
const [showEquipeModal, setShowEquipeModal] = useState(false)
const [editingEquipe, setEditingEquipe] = useState<any>(null)
const [deleteEquipeConfirm, setDeleteEquipeConfirm] = useState<string | null>(null)
const [equipeLoading, setEquipeLoading] = useState(false)
const [showAddMembreModal, setShowAddMembreModal] = useState(false)
const [equipeForm, setEquipeForm] = useState({
  nom: '', agence_id: '', chef_id: '', description: '', actif: true
})

// Permissions
const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({})
const [permissionsLoading, setPermissionsLoading] = useState(false)
const [permissionsSaving, setPermissionsSaving] = useState(false)
const [permissionsSuccess, setPermissionsSuccess] = useState(false)

// Création utilisateur
const [showCreateUserModal, setShowCreateUserModal] = useState(false)
const [createUserLoading, setCreateUserLoading] = useState(false)
const [createUserSuccess, setCreateUserSuccess] = useState<any>(null)
const [createUserError, setCreateUserError] = useState('')
const [equipesFiltrees, setEquipesFiltrees] = useState<any[]>([])
const [createUserForm, setCreateUserForm] = useState({
  email: '', password: '', nom: '', prenom: '',
  telephone: '', role: 'agent', agence_id: '', equipe_id: ''
})

// Manquants
const [manquants, setManquants] = useState<any[]>([])
const [manquantSearch, setManquantSearch] = useState('')
const [manquantFilterAgence, setManquantFilterAgence] = useState('tous')
const [manquantFilterStatut, setManquantFilterStatut] = useState('non_regle')
const [manquantFilterDateDebut, setManquantFilterDateDebut] = useState('')
const [manquantFilterDateFin, setManquantFilterDateFin] = useState('')
const [selectedManquant, setSelectedManquant] = useState<any>(null)
const [showReglementModal, setShowReglementModal] = useState(false)
const [reglementFiche, setReglementFiche] = useState<any>(null)
const [reglementCommentaire, setReglementCommentaire] = useState('')
const [reglementLoading, setReglementLoading] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  useEffect(() => {
    if (tab === 'agents') loadAgentsData()
    if (tab === 'objectifs') loadObjectifs()
    if (tab === 'fiches') loadFiches()
    if (tab === 'alertes') loadAlertes()
    if (tab === 'parametres') setAdminForm({
      nom: admin?.nom || '',
      prenom: admin?.prenom || '',
      telephone: admin?.telephone || '',
    })
    if (tab === 'equipes') loadEquipes()
    if (tab === 'permissions') loadPermissions()
    if (tab === 'manquants') loadManquants()
  }, [tab])
  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('realtime-admin')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fiches_journalieres' },
        () => {
          loadStats()
          loadFiches()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'agents' },
        () => {
          loadStats()
          loadAgentsData()
          loadAgences()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'agences' },
        () => {
          loadAgences()
          loadStats()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'objectifs' },
        () => {
          loadObjectifs()
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })
  
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: me } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
    if (!me || me.role !== 'admin') { router.push('/login'); return }
    setAdmin(me)

    await Promise.all([loadStats(), loadAgences(), loadAgentsData(), loadObjectifs(), loadFiches()])
    setLoading(false)
  }



  async function loadStats() {
    const [
      { count: totalAgents },
      { count: totalAgences },
      { data: fichesAujourdhui },
      { data: fichesMois },
      { count: agentsEnAttente },
      { data: manquants },
      { count: fichesNonValides },
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }).not('role', 'eq', 'admin'),
      supabase.from('agences').select('*', { count: 'exact', head: true }),
      supabase.from('fiches_journalieres').select('montant_mobilise, montant_rapporte').eq('date', today),
      supabase.from('fiches_journalieres').select('montant_mobilise, montant_rapporte, agent_id').gte('date', moisDebut),
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
      supabase.from('fiches_journalieres').select('montant_mobilise, montant_rapporte').eq('manquant_regle', false),
      supabase.from('fiches_journalieres').select('*', { count: 'exact', head: true }).eq('valide_chef', false),
    ])

    const collecteAujourdhui = (fichesAujourdhui || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
    const collecteMois = (fichesMois || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
    const manquantsTotal = (manquants || []).reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)

    setStats({
      totalAgents: totalAgents || 0,
      totalAgences: totalAgences || 0,
      collecteAujourdhui,
      collecteMois,
      agentsEnAttente: agentsEnAttente || 0,
      manquantsTotal,
      fichesNonValides: fichesNonValides || 0,
      tauxPerformance: collecteMois > 0 ? Math.min(100, Math.round((collecteMois / (25000 * 30)) * 100)) : 0,
    })

    // Top agents du mois
    const agentCollecte: Record<string, number> = {}
    ;(fichesMois || []).forEach(f => {
      agentCollecte[f.agent_id] = (agentCollecte[f.agent_id] || 0) + (f.montant_mobilise || 0)
    })
    const topIds = Object.entries(agentCollecte).sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (topIds.length > 0) {
      const { data: topData } = await supabase.from('agents').select('id, nom, prenom, agences(nom)').in('id', topIds.map(t => t[0]))
      setTopAgents(topIds.map(([id, montant]) => ({ ...topData?.find(a => a.id === id), montant })))
    }

    // Alertes
    const alertesList = []
    if ((agentsEnAttente || 0) > 0) alertesList.push({ type: 'warning', message: `${agentsEnAttente} compte(s) en attente d'activation`, action: 'agents' })
    if (manquantsTotal > 0) alertesList.push({ type: 'error', message: `${manquantsTotal.toLocaleString()} FCFA de manquants non réglés`, action: 'fiches' })
    if ((fichesNonValides || 0) > 0) alertesList.push({ type: 'info', message: `${fichesNonValides} fiche(s) en attente de validation`, action: 'fiches' })
    setAlertes(alertesList)

    // Évolution 6 derniers mois
    const evolution = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const debut = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const { data: mData } = await supabase.from('fiches_journalieres').select('montant_mobilise').gte('date', debut).lte('date', fin)
      const total = (mData || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
      evolution.push({
        mois: d.toLocaleDateString('fr-FR', { month: 'short' }),
        total,
        pct: total > 0 ? Math.min(100, Math.round(total / 1000000 * 100)) : 0
      })
    }
    setEvolutionMensuelle(evolution)
  }

  async function loadAgences() {
    const { data } = await supabase.from('agences').select('*').order('nom')
    const agencesWithStats = await Promise.all((data || []).map(async agence => {
      const { count: nbAgents } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('agence_id', agence.id)
      const { count: nbZones } = await supabase.from('zones').select('*', { count: 'exact', head: true }).eq('agence_id', agence.id)
      const { data: fiches } = await supabase.from('fiches_journalieres').select('montant_mobilise').eq('date', new Date().toISOString().split('T')[0])
      const collecte = (fiches || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
      return { ...agence, nbAgents: nbAgents || 0, nbZones: nbZones || 0, collecteJour: collecte }
    }))
    setAgences(agencesWithStats)

    // Stats agences pour dashboard
    setAgencesStats(agencesWithStats.map(a => ({ nom: a.nom, nbAgents: a.nbAgents, collecte: a.collecteJour })))
  }

  async function saveAgence(e: React.FormEvent) {
    e.preventDefault()
    setAgenceLoading(true)
    if (editingAgence) {
      await supabase.from('agences').update(agenceForm).eq('id', editingAgence.id)
      setAgences(prev => prev.map(a => a.id === editingAgence.id ? { ...a, ...agenceForm } : a))
    } else {
      const { data } = await supabase.from('agences').insert(agenceForm).select().single()
      if (data) setAgences(prev => [...prev, { ...data, nbAgents: 0, collecteJour: 0 }])
    }
    setShowAgenceModal(false)
    setEditingAgence(null)
    setAgenceForm({ nom: '', region: '', adresse: '', telephone: '', email: '', actif: true })
    setAgenceLoading(false)
  }

  async function toggleAgence(id: string, actif: boolean) {
    await supabase.from('agences').update({ actif }).eq('id', id)
    setAgences(prev => prev.map(a => a.id === id ? { ...a, actif } : a))
  }

  async function deleteAgence(id: string) {
    await supabase.from('agences').delete().eq('id', id)
    setAgences(prev => prev.filter(a => a.id !== id))
    setDeleteAgenceConfirm(null)
  }

  async function loadZones(agence: any) {
    setSelectedAgenceZones(agence)
    const { data } = await supabase
      .from('zones')
      .select('*')
      .eq('agence_id', agence.id)
      .order('numero')
    setZones(data || [])
  }
  
  async function saveZone(e: React.FormEvent) {
    e.preventDefault()
    setZoneLoading(true)
    if (editingZone) {
      await supabase.from('zones').update({
        numero: parseInt(zoneForm.numero),
        nom: zoneForm.nom,
      }).eq('id', editingZone.id)
      setZones(prev => prev.map(z => z.id === editingZone.id
        ? { ...z, numero: parseInt(zoneForm.numero), nom: zoneForm.nom } : z))
    } else {
      const { data } = await supabase.from('zones').insert({
        agence_id: selectedAgenceZones.id,
        numero: parseInt(zoneForm.numero),
        nom: zoneForm.nom,
      }).select().single()
      if (data) setZones(prev => [...prev, data])
    }
    setShowZoneModal(false)
    setEditingZone(null)
    setZoneForm({ numero: '', nom: '' })
    setZoneLoading(false)
  }
  
  async function deleteZone(id: string) {
    await supabase.from('zones').delete().eq('id', id)
    setZones(prev => prev.filter(z => z.id !== id))
    setDeleteZoneConfirm(null)
  }
  
  function openCreateZone() {
    setEditingZone(null)
    setZoneForm({ numero: '', nom: '' })
    setShowZoneModal(true)
  }
  
  function openEditZone(zone: any) {
    setEditingZone(zone)
    setZoneForm({ numero: zone.numero.toString(), nom: zone.nom || '' })
    setShowZoneModal(true)
  }

  async function loadAgentsData() {
    const { data, error } = await supabase
      .from('agents')
      .select('*, agences(nom), equipes!agents_equipe_id_fkey(nom)')
      .neq('role', 'admin')
      .order('created_at', { ascending: false })
    setAgentsData(data || [])
  }
  
  async function selectAgent(agent: any) {
    setSelectedAgent(agent)
    setAgentLoadingFiches(true)
    const { data } = await supabase
      .from('fiches_journalieres')
      .select('*')
      .eq('agent_id', agent.id)
      .order('date', { ascending: false })
      .limit(10)
    setAgentFiches(data || [])
    setAgentLoadingFiches(false)
  }
  
  async function saveAgentEdit(e: React.FormEvent) {
    e.preventDefault()
    setAgentEditLoading(true)
    await supabase.from('agents').update({
      nom: agentEditForm.nom,
      prenom: agentEditForm.prenom,
      telephone: agentEditForm.telephone,
      role: agentEditForm.role,
      agence_id: agentEditForm.agence_id,
      statut: agentEditForm.statut,
      actif: agentEditForm.statut === 'actif',
    }).eq('id', agentEditForm.id)
    setAgentsData(prev => prev.map(a => a.id === agentEditForm.id ? { ...a, ...agentEditForm } : a))
    if (selectedAgent?.id === agentEditForm.id) setSelectedAgent((p: any) => ({ ...p, ...agentEditForm }))
    setShowAgentEditModal(false)
    setAgentEditLoading(false)
  }
  
  async function toggleAgentStatut(id: string, statut: string) {
    await supabase.from('agents').update({ statut, actif: statut === 'actif' }).eq('id', id)
    setAgentsData(prev => prev.map(a => a.id === id ? { ...a, statut, actif: statut === 'actif' } : a))
    if (selectedAgent?.id === id) setSelectedAgent((p: any) => ({ ...p, statut, actif: statut === 'actif' }))
  }
  
  async function deleteAgent(id: string) {
    await supabase.from('agents').delete().eq('id', id)
    setAgentsData(prev => prev.filter(a => a.id !== id))
    if (selectedAgent?.id === id) setSelectedAgent(null)
    setDeleteAgentConfirm(null)
  }
  
  async function validerFiche(ficheId: string) {
    await supabase.from('fiches_journalieres').update({ valide_chef: true }).eq('id', ficheId)
    setAgentFiches(prev => prev.map(f => f.id === ficheId ? { ...f, valide_chef: true } : f))
  }
  
  async function confirmerManquant(ficheId: string) {
    await supabase.from('fiches_journalieres').update({ manquant_regle: true }).eq('id', ficheId)
    setAgentFiches(prev => prev.map(f => f.id === ficheId ? { ...f, manquant_regle: true } : f))
  }

  async function loadObjectifs() {
    const { data } = await supabase
      .from('objectifs')
      .select('*, agents(nom, prenom), equipes(nom), agences(nom), zones(nom, numero)')
      .order('created_at', { ascending: false })
    setObjectifs(data || [])
  }
  
  async function saveObjectif(e: React.FormEvent) {
    e.preventDefault()
    setObjectifLoading(true)
  
    const payload = {
      titre: objectifForm.titre,
      type_periodicite: objectifForm.type_periodicite,
      type_cible: objectifForm.type_cible,
      agent_id: objectifForm.type_cible === 'agent' ? objectifForm.agent_id || null : null,
      equipe_id: objectifForm.type_cible === 'equipe' ? objectifForm.equipe_id || null : null,
      agence_id: ['agence', 'global'].includes(objectifForm.type_cible) ? objectifForm.agence_id || null : null,
      zone_id: objectifForm.zone_id || null,
      date_debut: objectifForm.date_debut || null,
      date_fin: objectifForm.date_fin || null,
      statut_objectif: objectifForm.statut_objectif,
      cible_comptes: objectifForm.cible_comptes,
      cible_comptes_actives: objectifForm.cible_comptes_actives,
      cible_montant: objectifForm.cible_montant,
      cible_depots: objectifForm.cible_depots,
      cible_visites_prospects: objectifForm.cible_visites_prospects,
      cible_clients_suivis: objectifForm.cible_clients_suivis,
      cible_assurances: objectifForm.cible_assurances,
      description: objectifForm.description,
      mois: new Date().getMonth() + 1,
      annee: new Date().getFullYear(),
    }
  
    if (editingObjectif) {
      await supabase.from('objectifs').update(payload).eq('id', editingObjectif.id)
      setObjectifs(prev => prev.map(o => o.id === editingObjectif.id ? { ...o, ...payload } : o))
    } else {
      const { data } = await supabase.from('objectifs').insert(payload).select().single()
      if (data) setObjectifs(prev => [data, ...prev])
    }
  
    setShowObjectifModal(false)
    setEditingObjectif(null)
    resetObjectifForm()
    setObjectifLoading(false)
  }
  
  async function dupliquerObjectif(obj: any) {
    const { data } = await supabase.from('objectifs').insert({
      ...obj,
      id: undefined,
      titre: `${obj.titre} (copie)`,
      created_at: undefined,
      statut_objectif: 'actif',
    }).select().single()
    if (data) setObjectifs(prev => [data, ...prev])
  }
  
  async function toggleObjectifStatut(id: string, statut: string) {
    await supabase.from('objectifs').update({ statut_objectif: statut }).eq('id', id)
    setObjectifs(prev => prev.map(o => o.id === id ? { ...o, statut_objectif: statut } : o))
  }
  
  async function deleteObjectif(id: string) {
    await supabase.from('objectifs').delete().eq('id', id)
    setObjectifs(prev => prev.filter(o => o.id !== id))
    setDeleteObjectifConfirm(null)
  }
  
  function resetObjectifForm() {
    setObjectifForm({
      titre: '', type_periodicite: 'mensuel', type_cible: 'agent',
      agent_id: '', equipe_id: '', agence_id: '', zone_id: '',
      date_debut: '', date_fin: '', statut_objectif: 'actif',
      cible_comptes: 6, cible_comptes_actives: 4, cible_montant: 25000,
      cible_depots: 5, cible_visites_prospects: 50, cible_clients_suivis: 25,
      cible_assurances: 0, description: '',
    })
  }
  
  function openCreateObjectif() {
    setEditingObjectif(null)
    resetObjectifForm()
    setShowObjectifModal(true)
  }
  
  function openEditObjectif(obj: any) {
    setEditingObjectif(obj)
    setObjectifForm({
      titre: obj.titre || '',
      type_periodicite: obj.type_periodicite || 'mensuel',
      type_cible: obj.type_cible || 'agent',
      agent_id: obj.agent_id || '',
      equipe_id: obj.equipe_id || '',
      agence_id: obj.agence_id || '',
      zone_id: obj.zone_id || '',
      date_debut: obj.date_debut || '',
      date_fin: obj.date_fin || '',
      statut_objectif: obj.statut_objectif || 'actif',
      cible_comptes: obj.cible_comptes || 6,
      cible_comptes_actives: obj.cible_comptes_actives || 4,
      cible_montant: obj.cible_montant || 25000,
      cible_depots: obj.cible_depots || 5,
      cible_visites_prospects: obj.cible_visites_prospects || 50,
      cible_clients_suivis: obj.cible_clients_suivis || 25,
      cible_assurances: obj.cible_assurances || 0,
      description: obj.description || '',
    })
    setShowObjectifModal(true)
  }

  async function loadEquipes() {
    const { data } = await supabase
      .from('equipes')
      .select('*, agences(nom), agents!equipes_chef_id_fkey(nom, prenom)')
      .order('created_at', { ascending: false })
  
    const equipesWithStats = await Promise.all((data || []).map(async eq => {
      const { count: nbMembres } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('equipe_id', eq.id)
      return { ...eq, nbMembres: nbMembres || 0 }
    }))
    setEquipes(equipesWithStats)
  }
  
  async function selectEquipe(equipe: any) {
    setSelectedEquipe(equipe)
    const { data } = await supabase
      .from('agents')
      .select('*, agences(nom)')
      .eq('equipe_id', equipe.id)
      .neq('role', 'admin')
    setEquipeMembers(data || [])
  }
  
  async function saveEquipe(e: React.FormEvent) {
    e.preventDefault()
    setEquipeLoading(true)
    const payload = {
      nom: equipeForm.nom,
      agence_id: equipeForm.agence_id || null,
      chef_id: equipeForm.chef_id || null,
      description: equipeForm.description || null,
      actif: equipeForm.actif,
    }
    if (editingEquipe) {
      await supabase.from('equipes').update(payload).eq('id', editingEquipe.id)
      setEquipes(prev => prev.map(e => e.id === editingEquipe.id ? { ...e, ...payload } : e))
      if (selectedEquipe?.id === editingEquipe.id) setSelectedEquipe((p: any) => ({ ...p, ...payload }))
    } else {
      const { data } = await supabase.from('equipes').insert(payload).select().single()
      if (data) setEquipes(prev => [{ ...data, nbMembres: 0 }, ...prev])
    }
    setShowEquipeModal(false)
    setEditingEquipe(null)
    resetEquipeForm()
    setEquipeLoading(false)
  }
  
  async function deleteEquipe(id: string) {
    // Retirer tous les agents de l'équipe avant suppression
    await supabase.from('agents').update({ equipe_id: null }).eq('equipe_id', id)
    await supabase.from('equipes').delete().eq('id', id)
    setEquipes(prev => prev.filter(e => e.id !== id))
    if (selectedEquipe?.id === id) { setSelectedEquipe(null); setEquipeMembers([]) }
    setDeleteEquipeConfirm(null)
  }
  
  async function retirerMembre(agentId: string) {
    await supabase.from('agents').update({ equipe_id: null }).eq('id', agentId)
    setEquipeMembers(prev => prev.filter(a => a.id !== agentId))
    setEquipes(prev => prev.map(e => e.id === selectedEquipe?.id
      ? { ...e, nbMembres: Math.max(0, e.nbMembres - 1) } : e))
  }
  
  async function ajouterMembre(agentId: string) {
    await supabase.from('agents').update({ equipe_id: selectedEquipe.id }).eq('id', agentId)
    const agent = agentsData.find(a => a.id === agentId)
    if (agent) {
      setEquipeMembers(prev => [...prev, agent])
      setEquipes(prev => prev.map(e => e.id === selectedEquipe?.id
        ? { ...e, nbMembres: e.nbMembres + 1 } : e))
    }
    setShowAddMembreModal(false)
  }
  
  async function definirChef(agentId: string) {
    await supabase.from('equipes').update({ chef_id: agentId }).eq('id', selectedEquipe.id)
    const agent = equipeMembers.find(a => a.id === agentId)
    setSelectedEquipe((p: any) => ({ ...p, chef_id: agentId, agents: agent }))
    setEquipes(prev => prev.map(e => e.id === selectedEquipe.id
      ? { ...e, chef_id: agentId, agents: agent } : e))
  }
  
  function resetEquipeForm() {
    setEquipeForm({ nom: '', agence_id: '', chef_id: '', description: '', actif: true })
  }
  
  function openCreateEquipe() {
    setEditingEquipe(null)
    resetEquipeForm()
    setShowEquipeModal(true)
  }
  
  function openEditEquipe(eq: any) {
    setEditingEquipe(eq)
    setEquipeForm({
      nom: eq.nom || '',
      agence_id: eq.agence_id || '',
      chef_id: eq.chef_id || '',
      description: eq.description || '',
      actif: eq.actif !== false,
    })
    setShowEquipeModal(true)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreateUserLoading(true)
    setCreateUserError('')
  
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createUserForm),
      })
      const data = await res.json()
  
      if (!res.ok) {
        setCreateUserError(data.error || 'Erreur lors de la création')
      } else {
        setCreateUserSuccess({
          email: createUserForm.email,
          password: createUserForm.password,
          nom: createUserForm.nom,
          prenom: createUserForm.prenom,
          role: createUserForm.role,
        })
        await loadAgentsData()
        await loadStats()
      }
    } catch {
      setCreateUserError('Erreur réseau. Réessayez.')
    }
    setCreateUserLoading(false)
  }
  
  function resetCreateUserForm() {
    setCreateUserForm({
      email: '', password: '', nom: '', prenom: '',
      telephone: '', role: 'agent', agence_id: '', equipe_id: ''
    })
    setCreateUserError('')
    setCreateUserSuccess(null)
    setEquipesFiltrees([])
  }
  
  async function onAgenceChangeCreateUser(agenceId: string) {
    setCreateUserForm(p => ({ ...p, agence_id: agenceId, equipe_id: '' }))
    if (agenceId) {
      const { data } = await supabase
        .from('equipes')
        .select('*')
        .eq('agence_id', agenceId)
      setEquipesFiltrees(data || [])
    } else {
      setEquipesFiltrees([])
    }
  }

  async function loadPermissions() {
    setPermissionsLoading(true)
    const { data } = await supabase.from('role_permissions').select('*')
    const matrix: Record<string, Record<string, boolean>> = {}
    ;(data || []).forEach(p => {
      if (!matrix[p.role]) matrix[p.role] = {}
      matrix[p.role][p.permission] = p.valeur
    })
    setPermissions(matrix)
    setPermissionsLoading(false)
  }
  
  function togglePermission(role: string, permission: string) {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role]?.[permission]
      }
    }))
  }
  
  async function savePermissions() {
    setPermissionsSaving(true)
    const upserts: any[] = []
    Object.entries(permissions).forEach(([role, perms]) => {
      Object.entries(perms).forEach(([permission, valeur]) => {
        upserts.push({ role, permission, valeur, updated_at: new Date().toISOString() })
      })
    })
    await supabase.from('role_permissions').upsert(upserts, { onConflict: 'role,permission' })
    setPermissionsSaving(false)
    setPermissionsSuccess(true)
    setTimeout(() => setPermissionsSuccess(false), 3000)
  }

  async function loadManquants() {
    const { data } = await supabase
      .from('fiches_journalieres')
      .select('*, agents!inner(nom, prenom, agence_id, telephone, agences(nom))')
      .order('date', { ascending: false })
    
    const avecManquant = (data || []).filter(f =>
      Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0
    )
    setManquants(avecManquant)
  }
  
  async function confirmerReglement(ficheId: string, commentaire?: string) {
    setReglementLoading(true)
    await supabase.from('fiches_journalieres').update({
      manquant_regle: true,
      manquant_regle_at: new Date().toISOString(),
      manquant_regle_par: admin?.id || null,
      commentaire_chef: commentaire || null,
    }).eq('id', ficheId)
  
    // Notification à l'agent
    const fiche = manquants.find(f => f.id === ficheId)
    if (fiche) {
      const montant = Math.max(0, (fiche.montant_mobilise || 0) - (fiche.montant_rapporte || 0))
      await supabase.from('notifications').insert({
        agent_id: fiche.agent_id,
        type: 'validation',
        titre: '✅ Manquant réglé',
        message: `Votre manquant de ${montant.toLocaleString()} FCFA (fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')}) a été confirmé comme réglé.${commentaire ? ` Note: ${commentaire}` : ''}`,
      })
    }
  
    setManquants(prev => prev.map(f => f.id === ficheId
      ? { ...f, manquant_regle: true, manquant_regle_at: new Date().toISOString() } : f))
    if (selectedManquant?.id === ficheId)
      setSelectedManquant((p: any) => ({ ...p, manquant_regle: true }))
  
    setShowReglementModal(false)
    setReglementCommentaire('')
    setReglementLoading(false)
    loadStats()
  }

  async function loadFiches() {
    const { data } = await supabase
      .from('fiches_journalieres')
      .select('*, agents!inner(nom, prenom, agence_id, agences(nom))')
      .order('date', { ascending: false })
      .limit(100)
    setFiches(data || [])
  }
  
  async function validerFicheAdmin(ficheId: string, statut: string, commentaire?: string) {
    const { data: agentData } = await supabase
      .from('agents').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').single()
  
    await supabase.from('fiches_journalieres').update({
      valide_chef: statut === 'validee',
      statut_validation: statut,
      commentaire_chef: commentaire || null,
      valide_par: agentData?.id || null,
    }).eq('id', ficheId)
  
    // Notification automatique à l'agent
    const fiche = fiches.find(f => f.id === ficheId)
    if (fiche) {
      const titres: Record<string, string> = {
        validee: '✅ Fiche validée',
        rejetee: '❌ Fiche rejetée',
        a_corriger: '🔄 Fiche à corriger',
      }
      const messages: Record<string, string> = {
        validee: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} a été validée.`,
        rejetee: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} a été rejetée.${commentaire ? ` Motif: ${commentaire}` : ''}`,
        a_corriger: `Votre fiche du ${new Date(fiche.date).toLocaleDateString('fr-FR')} nécessite des corrections.${commentaire ? ` Note: ${commentaire}` : ''}`,
      }
      await supabase.from('notifications').insert({
        agent_id: fiche.agent_id,
        type: statut === 'validee' ? 'validation' : statut === 'rejetee' ? 'rejet' : 'correction',
        titre: titres[statut],
        message: messages[statut],
      })
    }
  
    setFiches(prev => prev.map(f => f.id === ficheId ? {
      ...f, valide_chef: statut === 'validee',
      statut_validation: statut, commentaire_chef: commentaire || null
    } : f))
    if (selectedFiche?.id === ficheId) setSelectedFiche((p: any) => ({
      ...p, valide_chef: statut === 'validee',
      statut_validation: statut, commentaire_chef: commentaire || null
    }))
  }
  
  async function confirmerManquantAdmin(ficheId: string) {
    await supabase.from('fiches_journalieres').update({
      manquant_regle: true,
      manquant_regle_at: new Date().toISOString(),
    }).eq('id', ficheId)
    setFiches(prev => prev.map(f => f.id === ficheId ? { ...f, manquant_regle: true } : f))
    if (selectedFiche?.id === ficheId) setSelectedFiche((p: any) => ({ ...p, manquant_regle: true }))
  }
  
  async function deleteFiche(ficheId: string) {
    await supabase.from('fiches_journalieres').delete().eq('id', ficheId)
    setFiches(prev => prev.filter(f => f.id !== ficheId))
    if (selectedFiche?.id === ficheId) setSelectedFiche(null)
    setDeleteFicheConfirm(null)
  }

  async function loadAlertes() {
    setAlertesLoading(true)
  
    const [
      { data: manquants },
      { data: agentsInactifs },
      { data: fichesNonValidees },
      { count: enAttente },
    ] = await Promise.all([
      supabase.from('fiches_journalieres')
        .select('*, agents!inner(nom, prenom, agences(nom))')
        .eq('manquant_regle', false),
      supabase.from('agents')
        .select('*, agences(nom)')
        .neq('role', 'admin')
        .eq('statut', 'actif'),
      supabase.from('fiches_journalieres')
        .select('*, agents!inner(nom, prenom, agences(nom))')
        .eq('valide_chef', false)
        .lt('date', today),
      supabase.from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_attente'),
    ])
  
    const liste: any[] = []
  
    // Manquants non réglés
    const manquantsReels = (manquants || []).filter(f =>
      Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0
    )
    manquantsReels.forEach(f => {
      const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
      liste.push({
        type: 'error',
        categorie: 'Manquant',
        message: `Manquant de ${montant.toLocaleString()} FCFA non réglé`,
        detail: `${f.agents?.prenom} ${f.agents?.nom} — ${f.agents?.agences?.nom || '—'} — Fiche du ${new Date(f.date).toLocaleDateString('fr-FR')}`,
        date: f.date,
        action: 'fiches',
        id: f.id,
      })
    })
  
    // Fiches non validées (jours passés)
    ;(fichesNonValidees || []).forEach(f => {
      liste.push({
        type: 'warning',
        categorie: 'Validation',
        message: `Fiche non validée`,
        detail: `${f.agents?.prenom} ${f.agents?.nom} — ${f.agents?.agences?.nom || '—'} — ${new Date(f.date).toLocaleDateString('fr-FR')}`,
        date: f.date,
        action: 'fiches',
        id: f.id,
      })
    })
  
    // Comptes en attente
    if ((enAttente || 0) > 0) {
      liste.push({
        type: 'info',
        categorie: 'Compte',
        message: `${enAttente} compte(s) en attente d'activation`,
        detail: 'Des agents ont créé un compte et attendent votre validation',
        date: today,
        action: 'agents',
        id: 'pending',
      })
    }
  
    // Trier par sévérité
    const ordre = { error: 0, warning: 1, info: 2 }
    liste.sort((a, b) => ordre[a.type as keyof typeof ordre] - ordre[b.type as keyof typeof ordre])
  
    setAlertesData(liste)
    setAlertesLoading(false)
  }
  
  async function saveAdminProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!admin) return
    setAdminSaving(true)
    await supabase.from('agents').update({
      nom: adminForm.nom,
      prenom: adminForm.prenom,
      telephone: adminForm.telephone,
    }).eq('id', admin.id)
    setAdmin((p: any) => ({ ...p, ...adminForm }))
    setAdminSaving(false)
    setAdminSuccess(true)
    setTimeout(() => setAdminSuccess(false), 3000)
  }

  function openCreateAgence() {
    setEditingAgence(null)
    setAgenceForm({ nom: '', region: '', adresse: '', telephone: '', email: '', actif: true })
    setShowAgenceModal(true)
  }

  function openEditAgence(agence: any) {
    setEditingAgence(agence)
    setAgenceForm({ nom: agence.nom, region: agence.region || '', adresse: agence.adresse || '', telephone: agence.telephone || '', email: agence.email || '', actif: agence.actif !== false })
    setShowAgenceModal(true)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredAgences = agences.filter(a => {
    const matchSearch = agenceSearch === '' || `${a.nom} ${a.region || ''}`.toLowerCase().includes(agenceSearch.toLowerCase())
    const matchFilter = agenceFilter === 'tous' || (agenceFilter === 'actif' ? a.actif !== false : a.actif === false)
    return matchSearch && matchFilter
  })

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊', active: true },
    { key: 'agences', label: 'Agences', icon: '🏦', active: true },
    { key: 'agents', label: 'Agents', icon: '👥', active: true },
    { key: 'equipes', label: 'Équipes', icon: '🤝', active: true },
    { key: 'objectifs', label: 'Objectifs', icon: '🎯', active: true },
    { key: 'fiches', label: 'Fiches', icon: '📋', active: true },
    { key: 'alertes', label: 'Alertes', icon: '⚠️', active: true },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️', active: true },
    { key: 'permissions', label: 'Permissions', icon: '🔐', active: true },
    { key: 'manquants', label: 'Manquants', icon: '🚨', active: true },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Chargement du back-office...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>

      {/* ── SIDEBAR ── */}
      <div className={`flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-16'}`}
        style={{ backgroundColor: '#0f172a', minHeight: '100vh', position: 'sticky', top: 0 }}>
        {/* Logo */}
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: '#2A4E94', color: 'white' }}>P</div>
          {sidebarOpen && (
            <div>
              <div className="text-white font-bold text-sm">PERCOM</div>
              <div className="text-xs" style={{ color: '#E4322C', fontWeight: 600 }}>ADMIN</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="p-2 space-y-1 mt-2">
          {navItems.map(item => (
            <button key={item.key} type="button"
              onClick={() => item.active && setTab(item.key as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${!item.active ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: tab === item.key ? '#2A4E94' : 'transparent',
                color: tab === item.key ? 'white' : 'rgba(255,255,255,0.55)',
              }}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <span className="text-xs">{item.label}</span>
              )}
              {sidebarOpen && !item.active && <span className="ml-auto text-xs opacity-50">Bientôt</span>}
            </button>
          ))}
        </nav>

        {/* Toggle sidebar */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b"
          style={{ backgroundColor: 'white', borderColor: '#f1f5f9' }}>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
              {tab === 'dashboard' && '📊 Dashboard Stratégique'}
              {tab === 'agences' && '🏦 Gestion des Agences'}
              {tab === 'agents' && '👥 Gestion des Agents'}
              {tab === 'objectifs' && '🎯 Gestion des Objectifs'}
              {tab === 'fiches' && '📋 Gestion des Fiches'} 
              {tab === 'manquants' && '🚨 Gestion des Manquants'}
              {tab === 'alertes' && '⚠️ Alertes & Anomalies'}
              {tab === 'parametres' && '⚙️ Paramètres'}
              {tab === 'equipes' && '🤝 Gestion des Équipes'}
              {tab === 'permissions' && '🔐 Gestion des Permissions'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
              PADES Microfinance — Back-office Super Admin
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats.agentsEnAttente > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                ⏳ {stats.agentsEnAttente} en attente
              </div>
            )}
            <div className="text-xs px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
              {admin?.prenom} {admin?.nom}
            </div>
            <button onClick={handleLogout} type="button"
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              Déconnexion
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">

          {/* ════ DASHBOARD ════ */}
          {tab === 'dashboard' && (
            <>
              {/* Alertes */}
              {alertes.length > 0 && (
                <div className="space-y-2">
                  {alertes.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                      style={{
                        backgroundColor: a.type === 'error' ? '#FEF2F2' : a.type === 'warning' ? '#FEF9C3' : '#EEF2FF',
                        border: `1px solid ${a.type === 'error' ? '#FECACA' : a.type === 'warning' ? '#FDE68A' : '#C7D2FE'}`
                      }}>
                      <span className="text-sm font-medium"
                        style={{ color: a.type === 'error' ? '#991B1B' : a.type === 'warning' ? '#854D0E' : '#2A4E94' }}>
                        {a.type === 'error' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'} {a.message}
                      </span>
                      <button type="button" onClick={() => setTab(a.action as Tab)}
                        className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: '#1a1a2e' }}>
                        Voir →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total agents', value: stats.totalAgents, icon: '👥', color: '#2A4E94', bg: '#EEF2FF', sub: 'Actifs sur la plateforme' },
                  { label: 'Total agences', value: stats.totalAgences, icon: '🏦', color: '#166534', bg: '#F0FDF4', sub: 'Réseau PADES' },
                  { label: "Collecté aujourd'hui", value: stats.collecteAujourdhui.toLocaleString() + ' Fcfa', icon: '💰', color: '#854D0E', bg: '#FEF9C3', sub: 'Toutes agences' },
                  { label: 'Collecté ce mois', value: stats.collecteMois.toLocaleString() + ' Fcfa', icon: '📈', color: '#991B1B', bg: '#FEF2F2', sub: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: s.bg }}>{s.icon}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: s.bg, color: s.color }}>Live</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs mt-1 font-medium" style={{ color: '#1a1a2e' }}>{s.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Stats secondaires */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'En attente activation', value: stats.agentsEnAttente, color: '#854D0E', bg: '#FEF9C3', icon: '⏳' },
                  { label: 'Manquants non réglés', value: stats.manquantsTotal.toLocaleString() + ' FCFA', color: '#991B1B', bg: '#FEF2F2', icon: '🚨' },
                  { label: 'Fiches non validées', value: stats.fichesNonValides, color: '#2A4E94', bg: '#EEF2FF', icon: '📋' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: s.bg }}>{s.icon}</div>
                    <div>
                      <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: '#818387' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Évolution + Top agents */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Évolution mensuelle */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-sm mb-5" style={{ color: '#1a1a2e' }}>
                    📈 Évolution des collectes (6 mois)
                  </h3>
                  <div className="flex items-end gap-2 h-32">
                    {evolutionMensuelle.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs font-medium" style={{ color: '#2A4E94' }}>
                          {m.total > 0 ? (m.total / 1000).toFixed(0) + 'k' : '0'}
                        </div>
                        <div className="w-full rounded-t-lg transition-all"
                          style={{
                            height: `${Math.max(4, m.pct)}%`,
                            minHeight: '4px',
                            backgroundColor: i === evolutionMensuelle.length - 1 ? '#2A4E94' : '#C7D2FE'
                          }} />
                        <div className="text-xs" style={{ color: '#818387' }}>{m.mois}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top 5 agents */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>
                    🏆 Top 5 agents du mois
                  </h3>
                  {topAgents.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-sm" style={{ color: '#818387' }}>
                      Aucune donnée ce mois
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topAgents.map((a, i) => (
                        <div key={a.id} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: i === 0 ? '#FEF9C3' : i === 1 ? '#F1F5F9' : '#FEF2F2',
                              color: i === 0 ? '#854D0E' : i === 1 ? '#475569' : '#991B1B'
                            }}>
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                              {a.prenom} {a.nom}
                            </div>
                            <div className="text-xs" style={{ color: '#818387' }}>
                              {a.agences?.nom || '—'}
                            </div>
                          </div>
                          <div className="text-xs font-bold" style={{ color: '#2A4E94' }}>
                            {(a.montant || 0).toLocaleString()} F
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Performance par agence */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>
                  🏦 Performance par agence (aujourd&apos;hui)
                </h3>
                <div className="space-y-3">
                  {agencesStats.map(a => {
                    const pct = Math.min(100, Math.round((a.collecte / 25000) * 100))
                    return (
                      <div key={a.nom}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{a.nom}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                              {a.nbAgents} agents
                            </span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: pct >= 100 ? '#166534' : pct >= 50 ? '#854D0E' : '#991B1B' }}>
                            {a.collecte.toLocaleString()} FCFA
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                          <div className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#22C55E' : pct >= 50 ? '#EAB308' : '#EF4444'
                            }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ════ AGENCES ════ */}
          {tab === 'agences' && (
            <div className="space-y-4">
              {/* Header + Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                    Toutes les agences
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
                    {agences.length} agence(s) dans le réseau PADES
                  </p>
                </div>
                <button type="button" onClick={openCreateAgence}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#2A4E94' }}>
                  ➕ Nouvelle agence
                </button>
              </div>

              {/* Filtres */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input type="text" placeholder="Rechercher une agence..."
                    value={agenceSearch} onChange={e => setAgenceSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
                </div>
                <select value={agenceFilter} onChange={e => setAgenceFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="tous">Tous les statuts</option>
                  <option value="actif">Actives</option>
                  <option value="inactif">Inactives</option>
                </select>
                <div className="flex items-center text-xs px-3" style={{ color: '#818387' }}>
                  {filteredAgences.length} résultat(s)
                </div>
              </div>

              {/* Tableau agences */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      {['Agence', 'Région', 'Contact', 'Agents', 'Collecté aujourd\'hui', 'Statut', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgences.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center">
                          <div className="text-3xl mb-2">🏦</div>
                          <div className="text-sm" style={{ color: '#818387' }}>Aucune agence trouvée</div>
                        </td>
                      </tr>
                    ) : filteredAgences.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < filteredAgences.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                              style={{ backgroundColor: '#2A4E94' }}>
                              {a.nom?.[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>{a.nom}</div>
                              <div className="text-xs" style={{ color: '#818387' }}>{a.adresse || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#818387' }}>{a.region || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs" style={{ color: '#1a1a2e' }}>{a.telephone || '—'}</div>
                          <div className="text-xs" style={{ color: '#818387' }}>{a.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold" style={{ color: '#2A4E94' }}>{a.nbAgents}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold" style={{ color: a.collecteJour > 0 ? '#166534' : '#818387' }}>
                            {a.collecteJour > 0 ? a.collecteJour.toLocaleString() + ' FCFA' : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              backgroundColor: a.actif !== false ? '#DCFCE7' : '#FEE2E2',
                              color: a.actif !== false ? '#166534' : '#991B1B'
                            }}>
                            {a.actif !== false ? '✅ Active' : '⏸ Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => loadZones(a)}
                              className="p-1.5 rounded-lg" title="Gérer les zones"
                              style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>🗺️</button>
                            <button type="button" onClick={() => openEditAgence(a)}
                              className="p-1.5 rounded-lg" title="Modifier"
                              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>✏️</button>
                            <button type="button" onClick={() => toggleAgence(a.id, a.actif === false)}
                              className="p-1.5 rounded-lg" title={a.actif !== false ? 'Désactiver' : 'Activer'}
                              style={{ backgroundColor: a.actif !== false ? '#FEF9C3' : '#F0FDF4', color: a.actif !== false ? '#854D0E' : '#166534' }}>
                              {a.actif !== false ? '⏸' : '▶️'}
                            </button>
                            <button type="button" onClick={() => setDeleteAgenceConfirm(a.id)}
                              className="p-1.5 rounded-lg" title="Supprimer"
                              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards stats agences */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agences.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: '#2A4E94' }}>{a.nom?.[0]}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: a.actif !== false ? '#DCFCE7' : '#FEE2E2',
                          color: a.actif !== false ? '#166534' : '#991B1B'
                        }}>
                        {a.actif !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                      <div className="font-bold text-sm mb-3" style={{ color: '#1a1a2e' }}>{a.nom}</div>
                      <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#818387' }}>Agents</span>
                        <span className="font-semibold" style={{ color: '#2A4E94' }}>{a.nbAgents}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#818387' }}>Zones</span>
                        <span className="font-semibold" style={{ color: '#2A4E94' }}>{a.nbZones ?? '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#818387' }}>Collecté/jour</span>
                        <span className="font-semibold" style={{ color: '#166534' }}>{a.collecteJour.toLocaleString()} F</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#818387' }}>Région</span>
                        <span style={{ color: '#1a1a2e' }}>{a.region || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

                          {/* Panneau zones */}
{selectedAgenceZones && (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="px-5 py-4 border-b flex items-center justify-between"
      style={{ borderColor: '#f1f5f9' }}>
      <div>
        <h3 className="font-bold text-sm" style={{ color: '#1a1a2e' }}>
          🗺️ Zones de l&apos;agence — {selectedAgenceZones.nom}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
          {zones.length} zone(s) configurée(s)
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={openCreateZone}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-white"
          style={{ backgroundColor: '#2A4E94' }}>
          ➕ Ajouter une zone
        </button>
        <button type="button" onClick={() => setSelectedAgenceZones(null)}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>
          ✕ Fermer
        </button>
      </div>
    </div>

    {zones.length === 0 ? (
      <div className="p-8 text-center">
        <div className="text-3xl mb-2">🗺️</div>
        <div className="text-sm font-medium" style={{ color: '#1a1a2e' }}>
          Aucune zone configurée
        </div>
        <div className="text-xs mt-1" style={{ color: '#818387' }}>
          Ajoutez des zones pour organiser les agents de cette agence
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {zones.map(z => (
          <div key={z.id} className="rounded-xl p-4 border"
            style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                style={{ backgroundColor: '#2A4E94' }}>
                {z.numero}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => openEditZone(z)}
                  className="p-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>✏️</button>
                <button type="button" onClick={() => setDeleteZoneConfirm(z.id)}
                  className="p-1 rounded-lg text-xs"
                  style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🗑️</button>
              </div>
            </div>
            <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>
              Zone {z.numero}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
              {z.nom || selectedAgenceZones.nom}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}


            </div>


          )}

          {/* ════ AGENTS ════ */}
{tab === 'agents' && (
  <div className="flex gap-4 h-full">

    {/* Liste agents */}
    <div className={`flex flex-col space-y-4 transition-all ${selectedAgent ? 'w-1/2' : 'w-full'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
            Tous les agents
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
            {agentsData.length} agent(s) dans le réseau PADES
          </p>
        </div>
        <button type="button"
          onClick={() => { resetCreateUserForm(); setShowCreateUserModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: '#2A4E94' }}>
          ➕ Créer un utilisateur
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input type="text" placeholder="Rechercher par nom, prénom, email..."
            value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={agentFilterAgence} onChange={e => setAgentFilterAgence(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Toutes les agences</option>
            {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
          <select value={agentFilterRole} onChange={e => setAgentFilterRole(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Tous les rôles</option>
            <option value="agent">Agent</option>
            <option value="chef">Chef</option>
            <option value="responsable">Responsable</option>
            <option value="dg">DG</option>
          </select>
          <select value={agentFilterStatut} onChange={e => setAgentFilterStatut(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="en_attente">En attente</option>
            <option value="bloque">Bloqué</option>
          </select>
          <span className="text-xs flex items-center px-2" style={{ color: '#818387' }}>
            {agentsData.filter(a => {
              const ms = agentSearch === '' || `${a.prenom} ${a.nom} ${a.email || ''}`.toLowerCase().includes(agentSearch.toLowerCase())
              const mr = agentFilterRole === 'tous' || a.role === agentFilterRole
              const mst = agentFilterStatut === 'tous' || a.statut === agentFilterStatut
              const ma = agentFilterAgence === 'tous' || a.agence_id === agentFilterAgence
              return ms && mr && mst && ma
            }).length} résultat(s)
          </span>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex-1">
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Agent', 'Rôle', 'Agence', 'Statut', 'Dernière fiche', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentsData
                .filter(a => {
                  const ms = agentSearch === '' || `${a.prenom} ${a.nom} ${a.email || ''}`.toLowerCase().includes(agentSearch.toLowerCase())
                  const mr = agentFilterRole === 'tous' || a.role === agentFilterRole
                  const mst = agentFilterStatut === 'tous' || a.statut === agentFilterStatut
                  const ma = agentFilterAgence === 'tous' || a.agence_id === agentFilterAgence
                  return ms && mr && mst && ma
                })
                .map((a, i, arr) => (
                  <tr key={a.id}
                    onClick={() => selectAgent(a)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                      backgroundColor: selectedAgent?.id === a.id ? '#EEF2FF' : undefined
                    }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: '#2A4E94' }}>
                          {a.prenom?.[0]}{a.nom?.[0]}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>{a.prenom} {a.nom}</div>
                          <div className="text-xs" style={{ color: '#818387' }}>{a.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#818387' }}>
                      {a.agences?.nom || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: a.statut === 'actif' ? '#DCFCE7' : a.statut === 'en_attente' ? '#FEF9C3' : '#FEE2E2',
                          color: a.statut === 'actif' ? '#166534' : a.statut === 'en_attente' ? '#854D0E' : '#991B1B'
                        }}>
                        {a.statut === 'actif' ? '✅ Actif' : a.statut === 'en_attente' ? '⏳ Attente' : '🚫 Bloqué'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#818387' }}>
                      {a.derniere_fiche ? new Date(a.derniere_fiche).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {a.statut !== 'actif' && (
                          <button type="button" onClick={() => toggleAgentStatut(a.id, 'actif')}
                            className="p-1.5 rounded-lg" title="Activer"
                            style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>✅</button>
                        )}
                        {a.statut !== 'bloque' && (
                          <button type="button" onClick={() => toggleAgentStatut(a.id, 'bloque')}
                            className="p-1.5 rounded-lg" title="Bloquer"
                            style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🚫</button>
                        )}
                        <button type="button"
                          onClick={() => { setAgentEditForm({ ...a }); setShowAgentEditModal(true) }}
                          className="p-1.5 rounded-lg" title="Modifier"
                          style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>✏️</button>
                        <button type="button" onClick={() => setDeleteAgentConfirm(a.id)}
                          className="p-1.5 rounded-lg" title="Supprimer"
                          style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ── PANNEAU DÉTAIL AGENT ── */}
    {selectedAgent && (
      <div className="w-1/2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

          {/* Header agent */}
          <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white"
                style={{ backgroundColor: '#2A4E94' }}>
                {selectedAgent.prenom?.[0]}{selectedAgent.nom?.[0]}
              </div>
              <div>
                <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                  {selectedAgent.prenom} {selectedAgent.nom}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                  {selectedAgent.email || '—'} · {selectedAgent.telephone || '—'}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                    {selectedAgent.role}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: selectedAgent.statut === 'actif' ? '#DCFCE7' : '#FEE2E2',
                      color: selectedAgent.statut === 'actif' ? '#166534' : '#991B1B'
                    }}>
                    {selectedAgent.statut === 'actif' ? 'Actif' : selectedAgent.statut === 'en_attente' ? 'En attente' : 'Bloqué'}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedAgent(null)}
              className="p-1.5 rounded-lg text-sm"
              style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
          </div>

          {/* Infos */}
          <div className="p-5 border-b grid grid-cols-2 gap-3" style={{ borderColor: '#f1f5f9' }}>
            {[
              { label: 'Agence', value: selectedAgent.agences?.nom || '—' },
              { label: 'Équipe', value: selectedAgent.equipes?.nom || '—' },
              { label: 'Membre depuis', value: new Date(selectedAgent.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
              { label: 'Statut', value: selectedAgent.actif ? 'Actif' : 'Inactif' },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                <div className="font-semibold text-sm mt-0.5" style={{ color: '#1a1a2e' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Stats performance */}
          <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>PERFORMANCE (10 dernières fiches)</h4>
            {agentLoadingFiches ? (
              <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Chargement...</div>
            ) : agentFiches.length === 0 ? (
              <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Aucune fiche soumise</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Comptes ouverts', value: agentFiches.reduce((s, f) => s + (f.comptes_ouverts || 0), 0) },
                  { label: 'Montant collecté', value: agentFiches.reduce((s, f) => s + (f.montant_mobilise || 0), 0).toLocaleString() + ' F' },
                  { label: 'Prospects visités', value: agentFiches.reduce((s, f) => s + (f.prospects_visites || 0), 0) },
                  { label: 'Comptes activés', value: agentFiches.reduce((s, f) => s + (f.comptes_actives || 0), 0) },
                  { label: 'Manquants', value: agentFiches.filter(f => (f.montant_mobilise - f.montant_rapporte) > 0 && !f.manquant_regle).length + ' non réglé(s)' },
                  { label: 'Fiches validées', value: agentFiches.filter(f => f.valide_chef).length + '/' + agentFiches.length },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-2.5" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-xs" style={{ color: '#818387' }}>{s.label}</div>
                    <div className="font-bold text-sm mt-0.5" style={{ color: '#2A4E94' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique fiches */}
          <div className="p-5">
            <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>HISTORIQUE DES FICHES</h4>
            {agentFiches.length === 0 ? (
              <div className="text-center py-4 text-sm" style={{ color: '#818387' }}>Aucune fiche</div>
            ) : (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
                {agentFiches.map(f => {
                  const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                  return (
                    <div key={f.id} className="rounded-xl p-3 border" style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-xs" style={{ color: '#1a1a2e' }}>
                            {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                            {f.comptes_ouverts} comptes · {(f.montant_mobilise || 0).toLocaleString()} FCFA
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!f.valide_chef && (
                            <button type="button" onClick={() => validerFiche(f.id)}
                              className="px-2 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                              ✅ Valider
                            </button>
                          )}
                          {manq > 0 && !f.manquant_regle && (
                            <button type="button" onClick={() => confirmerManquant(f.id)}
                              className="px-2 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                              💰 Réglé
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: f.valide_chef ? '#DCFCE7' : '#FEF9C3',
                            color: f.valide_chef ? '#166534' : '#854D0E'
                          }}>
                          {f.valide_chef ? 'Validée' : 'En attente'}
                        </span>
                        {manq > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                              color: f.manquant_regle ? '#166534' : '#991B1B'
                            }}>
                            {f.manquant_regle ? '✅ Manquant réglé' : `⚠️ ${manq.toLocaleString()} FCFA manquant`}
                          </span>
                        )}
                      </div>
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

{/* ════ OBJECTIFS ════ */}
{tab === 'objectifs' && (
  <div className="space-y-4">

    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
          Gestion des objectifs
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
          {objectifs.length} objectif(s) défini(s)
        </p>
      </div>
      <button type="button" onClick={openCreateObjectif}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
        style={{ backgroundColor: '#2A4E94' }}>
        ➕ Nouvel objectif
      </button>
    </div>

    {/* Filtres */}
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input type="text" placeholder="Rechercher un objectif..."
          value={objectifSearch} onChange={e => setObjectifSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
          style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
      </div>
      <select value={objectifFilterType} onChange={e => setObjectifFilterType(e.target.value)}
        className="px-3 py-2 rounded-xl border text-xs outline-none"
        style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
        <option value="tous">Toutes les périodes</option>
        <option value="journalier">Journalier</option>
        <option value="hebdomadaire">Hebdomadaire</option>
        <option value="mensuel">Mensuel</option>
        <option value="trimestriel">Trimestriel</option>
        <option value="annuel">Annuel</option>
        <option value="permanent">Permanent</option>
      </select>
      <select value={objectifFilterCible} onChange={e => setObjectifFilterCible(e.target.value)}
        className="px-3 py-2 rounded-xl border text-xs outline-none"
        style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
        <option value="tous">Toutes les cibles</option>
        <option value="agent">Agent</option>
        <option value="equipe">Équipe</option>
        <option value="agence">Agence</option>
        <option value="global">Global</option>
      </select>
      <select value={objectifFilterStatut} onChange={e => setObjectifFilterStatut(e.target.value)}
        className="px-3 py-2 rounded-xl border text-xs outline-none"
        style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
        <option value="tous">Tous les statuts</option>
        <option value="actif">Actif</option>
        <option value="suspendu">Suspendu</option>
        <option value="expire">Expiré</option>
      </select>
    </div>

    {/* Liste objectifs */}
    {(() => {
      const filtered = objectifs.filter(o => {
        const ms = objectifSearch === '' || (o.titre || '').toLowerCase().includes(objectifSearch.toLowerCase())
        const mt = objectifFilterType === 'tous' || o.type_periodicite === objectifFilterType
        const mc = objectifFilterCible === 'tous' || o.type_cible === objectifFilterCible
        const mst = objectifFilterStatut === 'tous' || o.statut_objectif === objectifFilterStatut
        return ms && mt && mc && mst
      })

      if (filtered.length === 0) return (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <div className="font-semibold text-base" style={{ color: '#1a1a2e' }}>
            Aucun objectif trouvé
          </div>
          <div className="text-sm mt-2 mb-6" style={{ color: '#818387' }}>
            Créez votre premier objectif pour commencer à piloter les performances
          </div>
          <button type="button" onClick={openCreateObjectif}
            className="px-6 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#2A4E94' }}>
            ➕ Créer un objectif
          </button>
        </div>
      )

      return (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(obj => {
            const periodeColor: Record<string, { bg: string, color: string }> = {
              journalier: { bg: '#EEF2FF', color: '#2A4E94' },
              hebdomadaire: { bg: '#F0FDF4', color: '#166534' },
              mensuel: { bg: '#FEF9C3', color: '#854D0E' },
              trimestriel: { bg: '#FEF2F2', color: '#991B1B' },
              annuel: { bg: '#F5F3FF', color: '#5B21B6' },
              permanent: { bg: '#F0FDF4', color: '#166534' },
            }
            const pc = periodeColor[obj.type_periodicite] || { bg: '#EEF2FF', color: '#2A4E94' }

            return (
              <div key={obj.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                {/* Header card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="font-bold text-sm" style={{ color: '#1a1a2e' }}>
                      {obj.titre || 'Sans titre'}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: pc.bg, color: pc.color }}>
                        {obj.type_periodicite}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>
                        {obj.type_cible === 'agent' && `👤 ${obj.agents?.prenom || ''} ${obj.agents?.nom || ''}`}
                        {obj.type_cible === 'equipe' && `👥 ${obj.equipes?.nom || 'Équipe'}`}
                        {obj.type_cible === 'agence' && `🏦 ${obj.agences?.nom || 'Agence'}`}
                        {obj.type_cible === 'global' && '🌍 Global'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: obj.statut_objectif === 'actif' ? '#DCFCE7'
                            : obj.statut_objectif === 'suspendu' ? '#FEF9C3' : '#FEE2E2',
                          color: obj.statut_objectif === 'actif' ? '#166534'
                            : obj.statut_objectif === 'suspendu' ? '#854D0E' : '#991B1B'
                        }}>
                        {obj.statut_objectif === 'actif' ? '✅ Actif'
                          : obj.statut_objectif === 'suspendu' ? '⏸ Suspendu' : '❌ Expiré'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPIs cibles */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'Comptes', value: obj.cible_comptes },
                    { label: 'Activés', value: obj.cible_comptes_actives },
                    { label: 'Montant', value: (obj.cible_montant || 0).toLocaleString() + ' F' },
                    { label: 'Dépôts', value: obj.cible_depots },
                    { label: 'Prospects', value: obj.cible_visites_prospects },
                    { label: 'Clients', value: obj.cible_clients_suivis },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg p-2"
                      style={{ backgroundColor: '#f8fafc' }}>
                      <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                      <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Dates */}
                {(obj.date_debut || obj.date_fin) && (
                  <div className="text-xs mb-3 flex gap-3" style={{ color: '#818387' }}>
                    {obj.date_debut && <span>📅 Du {new Date(obj.date_debut).toLocaleDateString('fr-FR')}</span>}
                    {obj.date_fin && <span>→ {new Date(obj.date_fin).toLocaleDateString('fr-FR')}</span>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#f1f5f9' }}>
                  <button type="button" onClick={() => openEditObjectif(obj)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                    ✏️ Modifier
                  </button>
                  <button type="button" onClick={() => dupliquerObjectif(obj)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                    📋 Dupliquer
                  </button>
                  {obj.statut_objectif === 'actif' ? (
                    <button type="button"
                      onClick={() => toggleObjectifStatut(obj.id, 'suspendu')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                      ⏸ Suspendre
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => toggleObjectifStatut(obj.id, 'actif')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                      ▶️ Activer
                    </button>
                  )}
                  <button type="button" onClick={() => setDeleteObjectifConfirm(obj.id)}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )
    })()}
  </div>
)}

{/* ════ FICHES ════ */}
{tab === 'fiches' && (
  <div className="flex gap-4">

    {/* Liste fiches */}
    <div className={`flex flex-col space-y-4 transition-all ${selectedFiche ? 'w-1/2' : 'w-full'}`}>

      {/* Stats rapides */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total fiches', value: fiches.length, bg: '#EEF2FF', color: '#2A4E94' },
          { label: 'Non validées', value: fiches.filter(f => !f.valide_chef).length, bg: '#FEF9C3', color: '#854D0E' },
          { label: 'Avec manquant', value: fiches.filter(f => (f.montant_mobilise - f.montant_rapporte) > 0 && !f.manquant_regle).length, bg: '#FEF2F2', color: '#991B1B' },
          { label: 'Validées', value: fiches.filter(f => f.valide_chef).length, bg: '#F0FDF4', color: '#166534' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: '#818387' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input type="text" placeholder="Rechercher par agent..."
            value={ficheSearch} onChange={e => setFicheSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={ficheFilterDate}
            onChange={e => setFicheFilterDate(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
          <select value={ficheFilterAgence} onChange={e => setFicheFilterAgence(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Toutes les agences</option>
            {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
          <select value={ficheFilterStatut} onChange={e => setFicheFilterStatut(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Tous les statuts</option>
            <option value="validee">✅ Validée</option>
            <option value="rejetee">❌ Rejetée</option>
            <option value="a_corriger">🔄 À corriger</option>
            <option value="en_attente">⏳ En attente</option>
          </select>
          <select value={ficheFilterManquant} onChange={e => setFicheFilterManquant(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Tous les manquants</option>
            <option value="avec">Avec manquant</option>
            <option value="regle">Manquant réglé</option>
            <option value="sans">Sans manquant</option>
          </select>
          {(ficheSearch || ficheFilterDate || ficheFilterAgence !== 'tous' || ficheFilterStatut !== 'tous' || ficheFilterManquant !== 'tous') && (
            <button type="button"
              onClick={() => { setFicheSearch(''); setFicheFilterDate(''); setFicheFilterAgence('tous'); setFicheFilterStatut('tous'); setFicheFilterManquant('tous') }}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Date', 'Agent', 'Agence', 'Collecté', 'Rapporté', 'Manquant', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold" style={{ color: '#818387' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiches
                .filter(f => {
                  const ms = ficheSearch === '' || `${f.agents?.prenom} ${f.agents?.nom}`.toLowerCase().includes(ficheSearch.toLowerCase())
                  const ma = ficheFilterAgence === 'tous' || f.agents?.agence_id === ficheFilterAgence
                  const mst = ficheFilterStatut === 'tous' || f.statut_validation === ficheFilterStatut
                  const md = ficheFilterDate === '' || f.date === ficheFilterDate
                  const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                  const mm = ficheFilterManquant === 'tous' ||
                    (ficheFilterManquant === 'avec' && manq > 0 && !f.manquant_regle) ||
                    (ficheFilterManquant === 'regle' && f.manquant_regle) ||
                    (ficheFilterManquant === 'sans' && manq === 0)
                  return ms && ma && mst && md && mm
                })
                .map((f, i, arr) => {
                  const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                  return (
                    <tr key={f.id}
                      onClick={() => setSelectedFiche(f)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                        backgroundColor: selectedFiche?.id === f.id ? '#EEF2FF' : undefined
                      }}>
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                          {new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="text-xs" style={{ color: '#818387' }}>
                          {new Date(f.date).toLocaleDateString('fr-FR', { year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: '#2A4E94' }}>
                            {f.agents?.prenom?.[0]}{f.agents?.nom?.[0]}
                          </div>
                          <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                            {f.agents?.prenom} {f.agents?.nom}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: '#818387' }}>
                        {f.agents?.agences?.nom || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#166534' }}>
                          {(f.montant_mobilise || 0).toLocaleString()} F
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
                          {(f.montant_rapporte || 0).toLocaleString()} F
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {manq > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                              color: f.manquant_regle ? '#166534' : '#991B1B'
                            }}>
                            {f.manquant_regle ? '✅' : '⚠️'} {manq.toLocaleString()} F
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#818387' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor:
                            f.statut_validation === 'validee' ? '#DCFCE7' :
                            f.statut_validation === 'rejetee' ? '#FEE2E2' :
                            f.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF',
                          color:
                            f.statut_validation === 'validee' ? '#166534' :
                            f.statut_validation === 'rejetee' ? '#991B1B' :
                            f.statut_validation === 'a_corriger' ? '#854D0E' : '#2A4E94'
                        }}>
                        {f.statut_validation === 'validee' ? '✅ Validée' :
                        f.statut_validation === 'rejetee' ? '❌ Rejetée' :
                        f.statut_validation === 'a_corriger' ? '🔄 À corriger' : '⏳ En attente'}
                      </span>
                    </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                        {!f.valide_chef && (
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setValidationFiche(f)
                            setValidationStatut('validee')
                            setValidationCommentaire('')
                            setShowValidationModal(true)
                          }}
                          className="p-1.5 rounded-lg" title="Valider"
                          style={{ backgroundColor: '#F0FDF4', color: '#166634' }}>✅</button>
                      )}
                          {manq > 0 && !f.manquant_regle && (
                            <button type="button" onClick={() => confirmerManquantAdmin(f.id)}
                              className="p-1.5 rounded-lg" title="Confirmer manquant réglé"
                              style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>💰</button>
                          )}
                          <button type="button" onClick={() => setDeleteFicheConfirm(f.id)}
                            className="p-1.5 rounded-lg" title="Supprimer"
                            style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          {fiches.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>Aucune fiche journalière</div>
              <div className="text-xs mt-1" style={{ color: '#818387' }}>Les fiches apparaîtront ici dès que les agents commencent à soumettre</div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── PANNEAU DÉTAIL FICHE ── */}
    {selectedFiche && (
      <div className="w-1/2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="p-5 border-b flex items-start justify-between"
            style={{ borderColor: '#f1f5f9' }}>
            <div>
              <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                Fiche du {new Date(selectedFiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#818387' }}>
                {selectedFiche.agents?.prenom} {selectedFiche.agents?.nom} · {selectedFiche.agents?.agences?.nom}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: selectedFiche.valide_chef ? '#DCFCE7' : '#FEF9C3',
                    color: selectedFiche.valide_chef ? '#166534' : '#854D0E'
                  }}>
                  {selectedFiche.valide_chef ? '✅ Validée' : '⏳ En attente de validation'}
                </span>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedFiche(null)}
              className="p-1.5 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
          </div>

          {/* KPIs */}
          <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>INDICATEURS</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Comptes ouverts', value: selectedFiche.comptes_ouverts || 0 },
                { label: 'Comptes activés', value: selectedFiche.comptes_actives || 0 },
                { label: 'Montant collecté', value: (selectedFiche.montant_mobilise || 0).toLocaleString() + ' F' },
                { label: 'Montant rapporté', value: (selectedFiche.montant_rapporte || 0).toLocaleString() + ' F' },
                { label: 'Nombre de dépôts', value: selectedFiche.nb_depots || 0 },
                { label: 'Prospects visités', value: selectedFiche.prospects_visites || 0 },
                { label: 'Clients suivis', value: selectedFiche.clients_suivis || 0 },
                { label: 'Assurances vendues', value: selectedFiche.assurances_vendues || 0 },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                  <div className="font-bold text-sm mt-0.5" style={{ color: '#2A4E94' }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Manquant */}
          {(() => {
            const manq = Math.max(0, (selectedFiche.montant_mobilise || 0) - (selectedFiche.montant_rapporte || 0))
            return manq > 0 ? (
              <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>MANQUANT</h4>
                <div className="rounded-2xl p-4 flex items-center justify-between"
                  style={{
                    backgroundColor: selectedFiche.manquant_regle ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${selectedFiche.manquant_regle ? '#BBF7D0' : '#FECACA'}`
                  }}>
                  <div>
                    <div className="font-bold text-xl"
                      style={{ color: selectedFiche.manquant_regle ? '#166534' : '#E4322C' }}>
                      {manq.toLocaleString()} FCFA
                    </div>
                    <div className="text-xs mt-0.5"
                      style={{ color: selectedFiche.manquant_regle ? '#166534' : '#991B1B' }}>
                      {selectedFiche.manquant_regle ? '✅ Manquant réglé' : '⚠️ Non réglé'}
                    </div>
                  </div>
                  {!selectedFiche.manquant_regle && (
                    <button type="button" onClick={() => confirmerManquantAdmin(selectedFiche.id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: '#2A4E94' }}>
                      💰 Confirmer règlement
                    </button>
                  )}
                </div>
              </div>
            ) : null
          })()}

        {/* Observations */}
        {selectedFiche.observations && (
          <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 className="font-semibold text-xs mb-2" style={{ color: '#818387' }}>OBSERVATIONS</h4>
            <p className="text-sm" style={{ color: '#1a1a2e' }}>{selectedFiche.observations}</p>
          </div>
        )}

        {/* Commentaire chef */}
        {selectedFiche.commentaire_chef && (
          <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 className="font-semibold text-xs mb-2" style={{ color: '#818387' }}>COMMENTAIRE CHEF</h4>
            <div className="rounded-xl p-3 flex items-start gap-3"
              style={{
                backgroundColor:
                  selectedFiche.statut_validation === 'validee' ? '#F0FDF4' :
                  selectedFiche.statut_validation === 'rejetee' ? '#FEF2F2' : '#FEF9C3',
                border: `1px solid ${
                  selectedFiche.statut_validation === 'validee' ? '#BBF7D0' :
                  selectedFiche.statut_validation === 'rejetee' ? '#FECACA' : '#FDE68A'}`
              }}>
              <span className="text-base flex-shrink-0">
                {selectedFiche.statut_validation === 'validee' ? '✅' :
                selectedFiche.statut_validation === 'rejetee' ? '❌' : '🔄'}
              </span>
              <p className="text-sm"
                style={{
                  color:
                    selectedFiche.statut_validation === 'validee' ? '#166534' :
                    selectedFiche.statut_validation === 'rejetee' ? '#991B1B' : '#854D0E'
                }}>
                {selectedFiche.commentaire_chef}
              </p>
            </div>
          </div>
        )}

        {/* Heure de soumission */}
        {selectedFiche.heure_soumission && (
          <div className="px-5 py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
            <span className="text-xs" style={{ color: '#818387' }}>
              🕐 Soumise le {new Date(selectedFiche.heure_soumission).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
              })} à {new Date(selectedFiche.heure_soumission).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        )}
          {/* Actions */}
          <div className="p-5 flex gap-3">
            <button type="button"
              onClick={() => {
                setValidationFiche(selectedFiche)
                setValidationStatut('validee')
                setValidationCommentaire('')
                setShowValidationModal(true)
              }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#166534' }}>
              ✅ Valider / Décision
            </button>
            <button type="button" onClick={() => setDeleteFicheConfirm(selectedFiche.id)}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              🗑️
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
        <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
          Alertes & Anomalies
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
          {alertesData.length} alerte(s) active(s)
        </p>
      </div>
      <button type="button" onClick={loadAlertes}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
        🔄 Actualiser
      </button>
    </div>

    {/* Stats alertes */}
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Critiques', value: alertesData.filter(a => a.type === 'error').length, bg: '#FEF2F2', color: '#991B1B', icon: '🚨' },
        { label: 'Avertissements', value: alertesData.filter(a => a.type === 'warning').length, bg: '#FEF9C3', color: '#854D0E', icon: '⚠️' },
        { label: 'Informations', value: alertesData.filter(a => a.type === 'info').length, bg: '#EEF2FF', color: '#2A4E94', icon: 'ℹ️' },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: s.bg }}>{s.icon}</div>
          <div>
            <div className="font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: '#818387' }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Liste alertes */}
    {alertesLoading ? (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#818387' }}>Analyse en cours...</p>
      </div>
    ) : alertesData.length === 0 ? (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <div className="font-semibold text-base" style={{ color: '#166534' }}>
          Aucune alerte active
        </div>
        <div className="text-sm mt-2" style={{ color: '#818387' }}>
          Tout est en ordre. Le réseau PADES fonctionne normalement.
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        {alertesData.map((alerte, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4 flex items-start gap-4"
            style={{
              borderColor: alerte.type === 'error' ? '#FECACA'
                : alerte.type === 'warning' ? '#FDE68A' : '#C7D2FE'
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{
                backgroundColor: alerte.type === 'error' ? '#FEF2F2'
                  : alerte.type === 'warning' ? '#FEF9C3' : '#EEF2FF'
              }}>
              {alerte.type === 'error' ? '🚨' : alerte.type === 'warning' ? '⚠️' : 'ℹ️'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: alerte.type === 'error' ? '#FEE2E2'
                      : alerte.type === 'warning' ? '#FEF9C3' : '#EEF2FF',
                    color: alerte.type === 'error' ? '#991B1B'
                      : alerte.type === 'warning' ? '#854D0E' : '#2A4E94'
                  }}>
                  {alerte.categorie}
                </span>
                <span className="text-xs" style={{ color: '#818387' }}>
                  {new Date(alerte.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>
                {alerte.message}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                {alerte.detail}
              </div>
            </div>
            <button type="button"
              onClick={() => setTab(alerte.action as Tab)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
              Voir →
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* ════ PARAMÈTRES ════ */}
{tab === 'parametres' && (
  <div className="max-w-2xl space-y-6">
    <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
      Paramètres du back-office
    </h2>

    {/* Profil admin */}
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="font-semibold text-sm mb-5 flex items-center gap-2" style={{ color: '#2A4E94' }}>
        👤 Mon profil administrateur
      </h3>

      {adminSuccess && (
        <div className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
          style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
          ✅ Profil mis à jour avec succès
        </div>
      )}

      <form onSubmit={saveAdminProfile} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Prénom</label>
            <input type="text" value={adminForm.prenom}
              onChange={e => setAdminForm(p => ({ ...p, prenom: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Nom</label>
            <input type="text" value={adminForm.nom}
              onChange={e => setAdminForm(p => ({ ...p, nom: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Téléphone</label>
          <input type="tel" value={adminForm.telephone}
            onChange={e => setAdminForm(p => ({ ...p, telephone: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="+228 9X XX XX XX" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Email</label>
          <div className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
            {admin?.email} — non modifiable
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Rôle</label>
          <div className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
            Administrateur — non modifiable
          </div>
        </div>
        <button type="submit" disabled={adminSaving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: adminSaving ? '#818387' : '#2A4E94' }}>
          {adminSaving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>

    {/* Infos plateforme */}
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: '#2A4E94' }}>
        🏦 Informations PERCOM
      </h3>
      <div className="space-y-3">
        {[
          { label: 'Application', value: 'PERCOM v1.0' },
          { label: 'Organisation', value: 'PADES Microfinance' },
          { label: 'Total agences', value: `${stats.totalAgences} agence(s)` },
          { label: 'Total utilisateurs', value: `${stats.totalAgents} agent(s)` },
          { label: 'Objectifs définis', value: `${objectifs.length} objectif(s)` },
          { label: 'Fiches soumises', value: `${fiches.length} fiche(s)` },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0"
            style={{ borderColor: '#f1f5f9' }}>
            <span className="text-xs" style={{ color: '#818387' }}>{item.label}</span>
            <span className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Danger zone */}
    <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#FECACA' }}>
      <h3 className="font-semibold text-sm mb-4" style={{ color: '#991B1B' }}>
        🚨 Zone dangereuse
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ backgroundColor: '#FEF2F2' }}>
          <div>
            <div className="text-sm font-medium" style={{ color: '#1a1a2e' }}>
              Se déconnecter
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
              Terminer la session en cours
            </div>
          </div>
          <button type="button" onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#E4322C', color: 'white' }}>
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* ════ ÉQUIPES ════ */}
{tab === 'equipes' && (
  <div className="flex gap-4">

    {/* Liste équipes */}
    <div className={`flex flex-col space-y-4 transition-all ${selectedEquipe ? 'w-1/2' : 'w-full'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
            Gestion des équipes
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
            {equipes.length} équipe(s) dans le réseau PADES
          </p>
        </div>
        <button type="button" onClick={openCreateEquipe}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: '#2A4E94' }}>
          ➕ Nouvelle équipe
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input type="text" placeholder="Rechercher une équipe..."
            value={equipeSearch} onChange={e => setEquipeSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
        </div>
        <select value={equipeFilterAgence} onChange={e => setEquipeFilterAgence(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs outline-none"
          style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
          <option value="tous">Toutes les agences</option>
          {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
      </div>

      {/* Grille équipes */}
      {(() => {
        const filtered = equipes.filter(e => {
          const ms = equipeSearch === '' || e.nom.toLowerCase().includes(equipeSearch.toLowerCase())
          const ma = equipeFilterAgence === 'tous' || e.agence_id === equipeFilterAgence
          return ms && ma
        })
        if (filtered.length === 0) return (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">🤝</div>
            <div className="font-semibold text-base" style={{ color: '#1a1a2e' }}>Aucune équipe trouvée</div>
            <div className="text-sm mt-2 mb-6" style={{ color: '#818387' }}>
              Créez votre première équipe pour organiser vos agents
            </div>
            <button type="button" onClick={openCreateEquipe}
              className="px-6 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#2A4E94' }}>
              ➕ Créer une équipe
            </button>
          </div>
        )
        return (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(eq => (
              <div key={eq.id}
                onClick={() => selectEquipe(eq)}
                className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-blue-200 transition-all"
                style={{ borderColor: selectedEquipe?.id === eq.id ? '#2A4E94' : undefined,
                  boxShadow: selectedEquipe?.id === eq.id ? '0 0 0 2px #2A4E94' : undefined }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                      style={{ backgroundColor: '#2A4E94' }}>
                      {eq.nom?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#1a1a2e' }}>{eq.nom}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                        {eq.agences?.nom || '—'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: eq.actif !== false ? '#DCFCE7' : '#FEE2E2',
                      color: eq.actif !== false ? '#166534' : '#991B1B'
                    }}>
                    {eq.actif !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Chef */}
                <div className="flex items-center gap-2 mb-3 p-2 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                  <span className="text-sm">👨‍💼</span>
                  <div>
                    <div className="text-xs" style={{ color: '#818387' }}>Chef d&apos;équipe</div>
                    <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                      {eq.agents ? `${eq.agents.prenom} ${eq.agents.nom}` : '— Non assigné'}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-xl p-2 text-center" style={{ backgroundColor: '#EEF2FF' }}>
                    <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{eq.nbMembres}</div>
                    <div className="text-xs" style={{ color: '#818387' }}>Membres</div>
                  </div>
                  <div className="rounded-xl p-2 text-center" style={{ backgroundColor: '#F0FDF4' }}>
                    <div className="font-bold text-lg" style={{ color: '#166534' }}>
                      {eq.actif !== false ? '✅' : '⏸'}
                    </div>
                    <div className="text-xs" style={{ color: '#818387' }}>Statut</div>
                  </div>
                </div>

                {eq.description && (
                  <p className="text-xs mb-3" style={{ color: '#818387' }}>{eq.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#f1f5f9' }}
                  onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => openEditEquipe(eq)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                    ✏️ Modifier
                  </button>
                  <button type="button" onClick={() => setDeleteEquipeConfirm(eq.id)}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>

    {/* ── PANNEAU DÉTAIL ÉQUIPE ── */}
    {selectedEquipe && (
      <div className="w-1/2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#f1f5f9' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white"
                style={{ backgroundColor: '#2A4E94' }}>
                {selectedEquipe.nom?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>{selectedEquipe.nom}</div>
                <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                  {selectedEquipe.agences?.nom || '—'}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: selectedEquipe.actif !== false ? '#DCFCE7' : '#FEE2E2',
                      color: selectedEquipe.actif !== false ? '#166534' : '#991B1B'
                    }}>
                    {selectedEquipe.actif !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => { setSelectedEquipe(null); setEquipeMembers([]) }}
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
          </div>

          {/* Chef d'équipe */}
          <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>CHEF D&apos;ÉQUIPE</h4>
            {selectedEquipe.agents ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: '#2A4E94' }}>
                  {selectedEquipe.agents.prenom?.[0]}{selectedEquipe.agents.nom?.[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>
                    {selectedEquipe.agents.prenom} {selectedEquipe.agents.nom}
                  </div>
                  <div className="text-xs" style={{ color: '#818387' }}>Chef assigné</div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl text-xs text-center" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                ⚠️ Aucun chef assigné — Cliquez sur ⭐ d&apos;un membre pour le définir chef
              </div>
            )}
          </div>

          {/* Membres */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-xs" style={{ color: '#818387' }}>
                MEMBRES ({equipeMembers.length})
              </h4>
              <button type="button" onClick={() => setShowAddMembreModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: '#2A4E94' }}>
                ➕ Ajouter
              </button>
            </div>

            {equipeMembers.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: '#818387' }}>
                Aucun membre dans cette équipe
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
                {equipeMembers.map(membre => (
                  <div key={membre.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#f8fafc' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: selectedEquipe.chef_id === membre.id ? '#854D0E' : '#2A4E94' }}>
                      {membre.prenom?.[0]}{membre.nom?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                        {membre.prenom} {membre.nom}
                        {selectedEquipe.chef_id === membre.id && (
                          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Chef</span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: '#818387' }}>{membre.role}</div>
                    </div>
                    <div className="flex gap-1">
                      {selectedEquipe.chef_id !== membre.id && (
                        <button type="button" onClick={() => definirChef(membre.id)}
                          className="p-1.5 rounded-lg text-xs" title="Définir comme chef"
                          style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>⭐</button>
                      )}
                      <button type="button" onClick={() => retirerMembre(membre.id)}
                        className="p-1.5 rounded-lg text-xs" title="Retirer de l'équipe"
                        style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
)}

{/* ════ PERMISSIONS ════ */}
{tab === 'permissions' && (
  <div className="space-y-6">

    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
          Matrice des permissions
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#818387' }}>
          Définissez ce que chaque rôle peut faire dans l&apos;application
        </p>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={loadPermissions}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
          🔄 Actualiser
        </button>
        <button type="button" onClick={savePermissions} disabled={permissionsSaving}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: permissionsSaving ? '#818387' : '#2A4E94' }}>
          {permissionsSaving ? 'Sauvegarde...' : '💾 Enregistrer'}
        </button>
      </div>
    </div>

    {/* Success */}
    {permissionsSuccess && (
      <div className="p-3 rounded-xl flex items-center gap-2"
        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <span>✅</span>
        <span className="text-sm font-medium" style={{ color: '#166534' }}>
          Permissions enregistrées avec succès
        </span>
      </div>
    )}

    {/* Info */}
    <div className="p-4 rounded-2xl flex items-start gap-3"
      style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
      <span className="text-lg">ℹ️</span>
      <p className="text-xs" style={{ color: '#2A4E94' }}>
        Ces permissions servent de référence pour configurer l&apos;accès de chaque rôle.
        Elles s&apos;appliqueront automatiquement quand les dashboards Chef, Responsable et DG seront développés.
        <strong> L&apos;administrateur a toujours un accès complet.</strong>
      </p>
    </div>

    {permissionsLoading ? (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#818387' }}>Chargement des permissions...</p>
      </div>
    ) : (
      <div className="space-y-6">
        {[
          {
            categorie: '📋 Fiches journalières',
            permissions: [
              { key: 'soumettre_fiche', label: 'Soumettre une fiche' },
              { key: 'voir_ses_fiches', label: 'Voir ses propres fiches' },
              { key: 'voir_fiches_equipe', label: 'Voir les fiches de son équipe' },
              { key: 'valider_fiches', label: 'Valider des fiches' },
              { key: 'voir_toutes_fiches', label: 'Voir toutes les fiches du réseau' },
            ]
          },
          {
            categorie: '👥 Agents & Équipes',
            permissions: [
              { key: 'voir_agents_equipe', label: 'Voir les agents de son équipe' },
              { key: 'voir_tous_agents', label: 'Voir tous les agents' },
            ]
          },
          {
            categorie: '🎯 Objectifs',
            permissions: [
              { key: 'voir_ses_objectifs', label: 'Voir ses objectifs assignés' },
              { key: 'gerer_objectifs', label: 'Créer et gérer des objectifs' },
            ]
          },
          {
            categorie: '📊 Rapports & Données',
            permissions: [
              { key: 'voir_classement', label: 'Voir le classement des agents' },
              { key: 'voir_agence', label: 'Voir les données de son agence' },
              { key: 'rapports_agence', label: 'Accéder aux rapports d\'agence' },
              { key: 'voir_tout_reseau', label: 'Voir tout le réseau PADES' },
              { key: 'rapports_globaux', label: 'Accéder aux rapports globaux' },
            ]
          },
          {
            categorie: '💬 Communication',
            permissions: [
              { key: 'messagerie', label: 'Messagerie interne' },
            ]
          },
        ].map(groupe => (
          <div key={groupe.categorie} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Header groupe */}
            <div className="px-5 py-3 border-b"
              style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
              <h3 className="font-semibold text-sm" style={{ color: '#1a1a2e' }}>
                {groupe.categorie}
              </h3>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold w-64"
                      style={{ color: '#818387' }}>Permission</th>
                    {[
                      { key: 'agent', label: '👤 Agent', color: '#2A4E94', bg: '#EEF2FF' },
                      { key: 'chef', label: '👨‍💼 Chef', color: '#166534', bg: '#F0FDF4' },
                      { key: 'responsable', label: '🏦 Responsable', color: '#854D0E', bg: '#FEF9C3' },
                      { key: 'dg', label: '⭐ DG', color: '#5B21B6', bg: '#F5F3FF' },
                    ].map(role => (
                      <th key={role.key} className="px-5 py-3 text-center">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full"
                          style={{ backgroundColor: role.bg, color: role.color }}>
                          {role.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupe.permissions.map((perm, i, arr) => (
                    <tr key={perm.key}
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                          {perm.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                          {perm.key}
                        </div>
                      </td>
                      {['agent', 'chef', 'responsable', 'dg'].map(role => {
                        const active = permissions[role]?.[perm.key] ?? false
                        return (
                          <td key={role} className="px-5 py-4 text-center">
                            <button type="button"
                              onClick={() => togglePermission(role, perm.key)}
                              className="relative w-11 h-6 rounded-full transition-all mx-auto flex-shrink-0"
                              style={{ backgroundColor: active ? '#2A4E94' : '#e2e8f0' }}>
                              <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                                style={{ left: active ? '23px' : '2px' }} />
                            </button>
                            <div className="text-xs mt-1 font-medium"
                              style={{ color: active ? '#166534' : '#991B1B' }}>
                              {active ? 'Oui' : 'Non'}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Bouton save bas de page */}
        <div className="flex justify-end">
          <button type="button" onClick={savePermissions} disabled={permissionsSaving}
            className="px-8 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: permissionsSaving ? '#818387' : '#2A4E94' }}>
            {permissionsSaving ? 'Sauvegarde...' : '💾 Enregistrer toutes les permissions'}
          </button>
        </div>
      </div>
    )}
  </div>
)}

{/* ════ MANQUANTS ════ */}
{tab === 'manquants' && (
  <div className="flex gap-4">

    {/* Liste */}
    <div className={`flex flex-col space-y-4 transition-all ${selectedManquant ? 'w-1/2' : 'w-full'}`}>

      {/* Stats globales */}
      {(() => {
        const total = manquants.reduce((s, f) =>
          s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
        const nonRegle = manquants.filter(f => !f.manquant_regle)
        const regle = manquants.filter(f => f.manquant_regle)
        const totalNonRegle = nonRegle.reduce((s, f) =>
          s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
        const totalRegle = regle.reduce((s, f) =>
          s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)

        return (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total manquants', value: total.toLocaleString() + ' F', bg: '#EEF2FF', color: '#2A4E94', icon: '💰' },
              { label: 'Non réglés', value: totalNonRegle.toLocaleString() + ' F', bg: '#FEF2F2', color: '#991B1B', icon: '🚨' },
              { label: 'Réglés', value: totalRegle.toLocaleString() + ' F', bg: '#F0FDF4', color: '#166534', icon: '✅' },
              { label: 'Fiches concernées', value: manquants.length, bg: '#FEF9C3', color: '#854D0E', icon: '📋' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-xs" style={{ color: '#818387' }}>{s.label}</span>
                </div>
                <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input type="text" placeholder="Rechercher par agent..."
            value={manquantSearch} onChange={e => setManquantSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={manquantFilterAgence} onChange={e => setManquantFilterAgence(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Toutes les agences</option>
            {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
          <select value={manquantFilterStatut} onChange={e => setManquantFilterStatut(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
            <option value="tous">Tous les statuts</option>
            <option value="non_regle">⚠️ Non réglés</option>
            <option value="regle">✅ Réglés</option>
          </select>
          <input type="date" value={manquantFilterDateDebut}
            onChange={e => setManquantFilterDateDebut(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
          <input type="date" value={manquantFilterDateFin}
            onChange={e => setManquantFilterDateFin(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
          {(manquantSearch || manquantFilterAgence !== 'tous' || manquantFilterStatut !== 'tous' || manquantFilterDateDebut || manquantFilterDateFin) && (
            <button type="button"
              onClick={() => {
                setManquantSearch('')
                setManquantFilterAgence('tous')
                setManquantFilterStatut('non_regle')
                setManquantFilterDateDebut('')
                setManquantFilterDateFin('')
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: '#f8fafc' }}>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Date', 'Agent', 'Agence', 'Collecté', 'Rapporté', 'Manquant', 'Statut', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold"
                    style={{ color: '#818387' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {manquants
                .filter(f => {
                  const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                  const ms = manquantSearch === '' ||
                    `${f.agents?.prenom} ${f.agents?.nom}`.toLowerCase().includes(manquantSearch.toLowerCase())
                  const ma = manquantFilterAgence === 'tous' || f.agents?.agence_id === manquantFilterAgence
                  const mst = manquantFilterStatut === 'tous' ||
                    (manquantFilterStatut === 'regle' ? f.manquant_regle : !f.manquant_regle)
                  const md1 = !manquantFilterDateDebut || f.date >= manquantFilterDateDebut
                  const md2 = !manquantFilterDateFin || f.date <= manquantFilterDateFin
                  return ms && ma && mst && md1 && md2 && montant > 0
                })
                .map((f, i, arr) => {
                  const montant = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                  return (
                    <tr key={f.id}
                      onClick={() => setSelectedManquant(f)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                        backgroundColor: selectedManquant?.id === f.id ? '#FEF2F2' : undefined
                      }}>
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                          {new Date(f.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="text-xs" style={{ color: '#818387' }}>
                          {new Date(f.date).getFullYear()}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: '#E4322C' }}>
                            {f.agents?.prenom?.[0]}{f.agents?.nom?.[0]}
                          </div>
                          <div>
                            <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                              {f.agents?.prenom} {f.agents?.nom}
                            </div>
                            <div className="text-xs" style={{ color: '#818387' }}>
                              {f.agents?.telephone || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: '#818387' }}>
                        {f.agents?.agences?.nom || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#166534' }}>
                          {(f.montant_mobilise || 0).toLocaleString()} F
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
                          {(f.montant_rapporte || 0).toLocaleString()} F
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold" style={{ color: '#E4322C' }}>
                          {montant.toLocaleString()} F
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2',
                            color: f.manquant_regle ? '#166534' : '#991B1B'
                          }}>
                          {f.manquant_regle ? '✅ Réglé' : '⚠️ En attente'}
                        </span>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        {!f.manquant_regle && (
                          <button type="button"
                            onClick={() => { setReglementFiche(f); setShowReglementModal(true) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ backgroundColor: '#2A4E94' }}>
                            💰 Régler
                          </button>
                        )}
                        {f.manquant_regle && f.manquant_regle_at && (
                          <span className="text-xs" style={{ color: '#818387' }}>
                            {new Date(f.manquant_regle_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          {manquants.filter(f => Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0).length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-medium text-sm" style={{ color: '#166534' }}>Aucun manquant</div>
              <div className="text-xs mt-1" style={{ color: '#818387' }}>
                Tous les manquants ont été réglés !
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Panneau détail manquant */}
    {selectedManquant && (() => {
      const montant = Math.max(0, (selectedManquant.montant_mobilise || 0) - (selectedManquant.montant_rapporte || 0))
      return (
        <div className="w-1/2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">

            {/* Header */}
            <div className="p-5 border-b flex items-start justify-between"
              style={{ borderColor: '#f1f5f9' }}>
              <div>
                <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                  Manquant — {new Date(selectedManquant.date).toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#818387' }}>
                  {selectedManquant.agents?.prenom} {selectedManquant.agents?.nom}
                  · {selectedManquant.agents?.agences?.nom}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedManquant(null)}
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>

            {/* Montant */}
            <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
              <div className="rounded-2xl p-5 text-center"
                style={{
                  backgroundColor: selectedManquant.manquant_regle ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${selectedManquant.manquant_regle ? '#BBF7D0' : '#FECACA'}`
                }}>
                <div className="text-3xl font-bold mb-1"
                  style={{ color: selectedManquant.manquant_regle ? '#166534' : '#E4322C' }}>
                  {montant.toLocaleString()} FCFA
                </div>
                <div className="text-sm"
                  style={{ color: selectedManquant.manquant_regle ? '#166534' : '#991B1B' }}>
                  {selectedManquant.manquant_regle ? '✅ Manquant réglé' : '⚠️ Non réglé'}
                </div>
                {selectedManquant.manquant_regle && selectedManquant.manquant_regle_at && (
                  <div className="text-xs mt-1" style={{ color: '#818387' }}>
                    Réglé le {new Date(selectedManquant.manquant_regle_at).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>

            {/* Détail fiche */}
            <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
              <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>DÉTAIL DE LA FICHE</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Montant collecté', value: (selectedManquant.montant_mobilise || 0).toLocaleString() + ' F' },
                  { label: 'Montant rapporté', value: (selectedManquant.montant_rapporte || 0).toLocaleString() + ' F' },
                  { label: 'Comptes ouverts', value: selectedManquant.comptes_ouverts || 0 },
                  { label: 'Téléphone agent', value: selectedManquant.agents?.telephone || '—' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                    <div className="font-bold text-sm mt-0.5" style={{ color: '#1a1a2e' }}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commentaire chef si présent */}
            {selectedManquant.commentaire_chef && (
              <div className="p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                <h4 className="font-semibold text-xs mb-2" style={{ color: '#818387' }}>NOTE</h4>
                <p className="text-sm" style={{ color: '#1a1a2e' }}>{selectedManquant.commentaire_chef}</p>
              </div>
            )}

            {/* Action */}
            <div className="p-5">
              {!selectedManquant.manquant_regle ? (
                <button type="button"
                  onClick={() => { setReglementFiche(selectedManquant); setShowReglementModal(true) }}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: '#2A4E94' }}>
                  💰 Confirmer le règlement
                </button>
              ) : (
                <div className="text-center text-sm font-medium" style={{ color: '#166534' }}>
                  ✅ Ce manquant a été réglé
                </div>
              )}
            </div>
          </div>
        </div>
      )
    })()}
  </div>
)}

          {/* Sections à venir */}
          {!['dashboard', 'agences', 'agents', 'objectifs', 'fiches', 'alertes', 'parametres', 'equipes', 'permissions', 'manquants'].includes(tab) && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl mb-4">🚧</div>
                <div className="font-semibold text-lg" style={{ color: '#1a1a2e' }}>Module en développement</div>
                <div className="text-sm mt-2" style={{ color: '#818387' }}>Cette section sera disponible prochainement</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL AGENCE ── */}
      {showAgenceModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="font-bold text-lg mb-5" style={{ color: '#1a1a2e' }}>
              {editingAgence ? '✏️ Modifier l\'agence' : '➕ Nouvelle agence'}
            </h3>
            <form onSubmit={saveAgence} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Nom de l&apos;agence *</label>
                  <input type="text" value={agenceForm.nom}
                    onChange={e => setAgenceForm(p => ({ ...p, nom: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0' }} placeholder="Agence Sagbado" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Région</label>
                  <input type="text" value={agenceForm.region}
                    onChange={e => setAgenceForm(p => ({ ...p, region: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0' }} placeholder="Lomé" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Adresse</label>
                <input type="text" value={agenceForm.adresse}
                  onChange={e => setAgenceForm(p => ({ ...p, adresse: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0' }} placeholder="34, rue du Chemin de Fer..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Téléphone</label>
                  <input type="tel" value={agenceForm.telephone}
                    onChange={e => setAgenceForm(p => ({ ...p, telephone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0' }} placeholder="+228 70 35 37 XX" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Email</label>
                  <input type="email" value={agenceForm.email}
                    onChange={e => setAgenceForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0' }} placeholder="agence@pades.tg" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>Statut</label>
                <button type="button" onClick={() => setAgenceForm(p => ({ ...p, actif: !p.actif }))}
                  className="relative w-10 h-6 rounded-full transition-all"
                  style={{ backgroundColor: agenceForm.actif ? '#2A4E94' : '#e2e8f0' }}>
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                    style={{ left: agenceForm.actif ? '22px' : '2px' }} />
                </button>
                <span className="text-xs" style={{ color: '#818387' }}>{agenceForm.actif ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button"
                  onClick={() => { setShowAgenceModal(false); setEditingAgence(null) }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                  Annuler
                </button>
                <button type="submit" disabled={agenceLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: agenceLoading ? '#818387' : '#2A4E94' }}>
                  {agenceLoading ? 'Sauvegarde...' : editingAgence ? 'Enregistrer' : 'Créer l\'agence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ── MODAL SUPPRESSION AGENCE ── */}
      {deleteAgenceConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="text-5xl mb-4">🏦</div>
            <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>Supprimer cette agence ?</h3>
            <p className="text-sm mb-6" style={{ color: '#818387' }}>
              Cette action est irréversible. Tous les agents et données liés à cette agence seront affectés.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteAgenceConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
              <button type="button" onClick={() => deleteAgence(deleteAgenceConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZONE */}
{showZoneModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <h3 className="font-bold text-lg mb-5" style={{ color: '#1a1a2e' }}>
        {editingZone ? '✏️ Modifier la zone' : '➕ Nouvelle zone'}
        <span className="text-sm font-normal ml-2" style={{ color: '#818387' }}>
          — {selectedAgenceZones?.nom}
        </span>
      </h3>
      <form onSubmit={saveZone} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Numéro de zone *
          </label>
          <input type="number" min="1" value={zoneForm.numero}
            onChange={e => setZoneForm(p => ({ ...p, numero: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="1" required />
          <p className="text-xs mt-1" style={{ color: '#818387' }}>
            Zone {zoneForm.numero || '?'} de {selectedAgenceZones?.nom} sera unique
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Nom / Description (optionnel)
          </label>
          <input type="text" value={zoneForm.nom}
            onChange={e => setZoneForm(p => ({ ...p, nom: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="Ex: Quartier Bé, Centre-ville..." />
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: '#EEF2FF' }}>
          <p className="text-xs" style={{ color: '#2A4E94' }}>
            ℹ️ La Zone {zoneForm.numero || '?'} de {selectedAgenceZones?.nom} est distincte
            de la Zone {zoneForm.numero || '?'} de toute autre agence.
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <button type="button"
            onClick={() => { setShowZoneModal(false); setEditingZone(null) }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Annuler
          </button>
          <button type="submit" disabled={zoneLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: zoneLoading ? '#818387' : '#2A4E94' }}>
            {zoneLoading ? 'Sauvegarde...' : editingZone ? 'Enregistrer' : 'Créer la zone'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL SUPPRESSION ZONE */}
{deleteZoneConfirm && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <div className="text-4xl mb-4">🗺️</div>
      <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>
        Supprimer cette zone ?
      </h3>
      <p className="text-sm mb-6" style={{ color: '#818387' }}>
        Les agents et équipes affectés à cette zone devront être réaffectés.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDeleteZoneConfirm(null)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#e2e8f0', color: '#818387' }}>
          Annuler
        </button>
        <button type="button" onClick={() => deleteZone(deleteZoneConfirm)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#E4322C' }}>
          Supprimer
        </button>
      </div>
    </div>
  </div>
)}

{/* MODAL EDIT AGENT */}
{showAgentEditModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <h3 className="font-bold text-lg mb-5" style={{ color: '#1a1a2e' }}>
        ✏️ Modifier {agentEditForm.prenom} {agentEditForm.nom}
      </h3>
      <form onSubmit={saveAgentEdit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Prénom</label>
            <input type="text" value={agentEditForm.prenom || ''}
              onChange={e => setAgentEditForm((p: any) => ({ ...p, prenom: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Nom</label>
            <input type="text" value={agentEditForm.nom || ''}
              onChange={e => setAgentEditForm((p: any) => ({ ...p, nom: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Téléphone</label>
          <input type="tel" value={agentEditForm.telephone || ''}
            onChange={e => setAgentEditForm((p: any) => ({ ...p, telephone: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }} placeholder="+228 9X XX XX XX" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Rôle</label>
            <select value={agentEditForm.role || 'agent'}
              onChange={e => setAgentEditForm((p: any) => ({ ...p, role: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="agent">Agent</option>
              <option value="chef">Chef</option>
              <option value="responsable">Responsable</option>
              <option value="dg">DG</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Statut</label>
            <select value={agentEditForm.statut || 'actif'}
              onChange={e => setAgentEditForm((p: any) => ({ ...p, statut: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="actif">Actif</option>
              <option value="en_attente">En attente</option>
              <option value="bloque">Bloqué</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Agence</label>
          <select value={agentEditForm.agence_id || ''}
            onChange={e => setAgentEditForm((p: any) => ({ ...p, agence_id: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}>
            <option value="">Aucune agence</option>
            {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => setShowAgentEditModal(false)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
          <button type="submit" disabled={agentEditLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: agentEditLoading ? '#818387' : '#2A4E94' }}>
            {agentEditLoading ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL SUPPRESSION AGENT */}
{deleteAgentConfirm && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <div className="text-4xl mb-4">👤</div>
      <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>Supprimer cet agent ?</h3>
      <p className="text-sm mb-6" style={{ color: '#818387' }}>
        Toutes ses fiches et données de performance seront supprimées.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDeleteAgentConfirm(null)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
        <button type="button" onClick={() => deleteAgent(deleteAgentConfirm)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
      </div>
    </div>
  </div>
)}

{/* MODAL OBJECTIF */}
{showObjectifModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
          {editingObjectif ? '✏️ Modifier l\'objectif' : '🎯 Nouvel objectif'}
        </h3>
        <button type="button" onClick={() => { setShowObjectifModal(false); setEditingObjectif(null) }}
          className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
      </div>

      <form onSubmit={saveObjectif} className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>

        {/* Titre + Description */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Titre de l&apos;objectif *
            </label>
            <input type="text" value={objectifForm.titre}
              onChange={e => setObjectifForm(p => ({ ...p, titre: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}
              placeholder="Ex: Objectif mensuel agents Sagbado" required />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Description (optionnel)
            </label>
            <textarea value={objectifForm.description}
              onChange={e => setObjectifForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: '#e2e8f0' }} rows={2}
              placeholder="Notes ou instructions supplémentaires..." />
          </div>
        </div>

        {/* Période + Statut */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Périodicité *
            </label>
            <select value={objectifForm.type_periodicite}
              onChange={e => setObjectifForm(p => ({ ...p, type_periodicite: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="journalier">📅 Journalier</option>
              <option value="hebdomadaire">📅 Hebdomadaire</option>
              <option value="mensuel">📅 Mensuel</option>
              <option value="trimestriel">📅 Trimestriel</option>
              <option value="annuel">📅 Annuel</option>
              <option value="permanent">♾️ Permanent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Statut
            </label>
            <select value={objectifForm.statut_objectif}
              onChange={e => setObjectifForm(p => ({ ...p, statut_objectif: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="actif">✅ Actif</option>
              <option value="suspendu">⏸ Suspendu</option>
              <option value="expire">❌ Expiré</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Date de début
            </label>
            <input type="date" value={objectifForm.date_debut}
              onChange={e => setObjectifForm(p => ({ ...p, date_debut: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Date de fin
            </label>
            <input type="date" value={objectifForm.date_fin}
              onChange={e => setObjectifForm(p => ({ ...p, date_fin: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }} />
          </div>
        </div>

        {/* Cible */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: '#e2e8f0' }}>
          <div className="text-xs font-bold" style={{ color: '#1a1a2e' }}>🎯 Affecter à</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'agent', label: '👤 Agent' },
              { key: 'equipe', label: '👥 Équipe' },
              { key: 'agence', label: '🏦 Agence' },
              { key: 'global', label: '🌍 Global' },
            ].map(t => (
              <button key={t.key} type="button"
                onClick={() => setObjectifForm(p => ({ ...p, type_cible: t.key }))}
                className="py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  backgroundColor: objectifForm.type_cible === t.key ? '#2A4E94' : '#f8fafc',
                  color: objectifForm.type_cible === t.key ? 'white' : '#818387',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {objectifForm.type_cible === 'agent' && (
            <select value={objectifForm.agent_id}
              onChange={e => setObjectifForm(p => ({ ...p, agent_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="">Sélectionner un agent</option>
              {agentsData.filter(a => a.role === 'agent').map(a => (
                <option key={a.id} value={a.id}>{a.prenom} {a.nom} — {a.agences?.nom || '—'}</option>
              ))}
            </select>
          )}

          {objectifForm.type_cible === 'agence' && (
            <select value={objectifForm.agence_id}
              onChange={e => setObjectifForm(p => ({ ...p, agence_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}>
              <option value="">Sélectionner une agence</option>
              {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          )}

          {objectifForm.type_cible === 'global' && (
            <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
              ℹ️ Cet objectif s&apos;appliquera à l&apos;ensemble du réseau PADES Microfinance.
            </div>
          )}
        </div>

        {/* KPIs cibles */}
        <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: '#e2e8f0' }}>
          <div className="text-xs font-bold" style={{ color: '#1a1a2e' }}>📊 Indicateurs cibles</div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'cible_comptes', label: 'Comptes à ouvrir', placeholder: '6' },
              { key: 'cible_comptes_actives', label: 'Comptes à activer', placeholder: '4' },
              { key: 'cible_depots', label: 'Nombre de dépôts', placeholder: '5' },
              { key: 'cible_assurances', label: 'Assurances à vendre', placeholder: '0' },
              { key: 'cible_visites_prospects', label: 'Prospects à visiter', placeholder: '50' },
              { key: 'cible_clients_suivis', label: 'Clients à suivre', placeholder: '25' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#818387' }}>
                  {field.label}
                </label>
                <input type="number" min="0"
                  value={(objectifForm as any)[field.key]}
                  onChange={e => setObjectifForm(p => ({ ...p, [field.key]: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0' }}
                  placeholder={field.placeholder} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#818387' }}>
              Montant cible (FCFA)
            </label>
            <input type="number" min="0"
              value={objectifForm.cible_montant}
              onChange={e => setObjectifForm(p => ({ ...p, cible_montant: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}
              placeholder="25000" />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-3">
          <button type="button"
            onClick={() => { setShowObjectifModal(false); setEditingObjectif(null) }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Annuler
          </button>
          <button type="submit" disabled={objectifLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: objectifLoading ? '#818387' : '#2A4E94' }}>
            {objectifLoading ? 'Sauvegarde...' : editingObjectif ? 'Enregistrer' : 'Créer l\'objectif'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL SUPPRESSION OBJECTIF */}
{deleteObjectifConfirm && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <div className="text-4xl mb-4">🎯</div>
      <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>Supprimer cet objectif ?</h3>
      <p className="text-sm mb-6" style={{ color: '#818387' }}>
        Cette action est irréversible.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDeleteObjectifConfirm(null)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
        <button type="button" onClick={() => deleteObjectif(deleteObjectifConfirm)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
      </div>
    </div>
  </div>
)}

{/* MODAL SUPPRESSION FICHE */}
{deleteFicheConfirm && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <div className="text-4xl mb-4">📋</div>
      <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>
        Supprimer cette fiche ?
      </h3>
      <p className="text-sm mb-6" style={{ color: '#818387' }}>
        Cette action est irréversible. Toutes les données de cette fiche seront perdues.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDeleteFicheConfirm(null)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
        <button type="button" onClick={() => deleteFiche(deleteFicheConfirm)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
      </div>
    </div>
  </div>
)}

{/* MODAL VALIDATION FICHE */}
{showValidationModal && validationFiche && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
          📋 Décision sur la fiche
        </h3>
        <button type="button" onClick={() => setShowValidationModal(false)}
          className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
      </div>

      <div className="p-6 space-y-5">
        {/* Info fiche */}
        <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
          <div className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>
            {validationFiche.agents?.prenom} {validationFiche.agents?.nom}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
            Fiche du {new Date(validationFiche.date).toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </div>
          <div className="text-xs mt-1" style={{ color: '#2A4E94' }}>
            {(validationFiche.montant_mobilise || 0).toLocaleString()} FCFA collectés
          </div>
        </div>

        {/* Choix statut */}
        <div>
          <label className="block text-xs font-semibold mb-3" style={{ color: '#1a1a2e' }}>
            Décision *
          </label>
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

        {/* Commentaire */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Commentaire {validationStatut !== 'validee' ? '*' : '(optionnel)'}
          </label>
          <textarea
            value={validationCommentaire}
            onChange={e => setValidationCommentaire(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder={
              validationStatut === 'validee' ? 'Bravo pour cette fiche ! (optionnel)' :
              validationStatut === 'rejetee' ? 'Expliquez le motif du rejet...' :
              'Indiquez ce qui doit être corrigé...'
            } />
        </div>

        {/* Info notification */}
        <div className="rounded-xl p-3 flex items-center gap-2"
          style={{ backgroundColor: '#EEF2FF' }}>
          <span className="text-sm">🔔</span>
          <p className="text-xs" style={{ color: '#2A4E94' }}>
            L&apos;agent recevra automatiquement une notification avec votre décision.
          </p>
        </div>

        {/* Boutons */}
        <div className="flex gap-3">
          <button type="button" onClick={() => setShowValidationModal(false)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Annuler
          </button>
          <button type="button"
            onClick={async () => {
              await validerFicheAdmin(validationFiche.id, validationStatut, validationCommentaire)
              setShowValidationModal(false)
              setValidationCommentaire('')
            }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{
              backgroundColor:
                validationStatut === 'validee' ? '#166534' :
                validationStatut === 'rejetee' ? '#991B1B' : '#854D0E'
            }}>
            Confirmer la décision
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* MODAL ÉQUIPE */}
{showEquipeModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
      <h3 className="font-bold text-lg mb-5" style={{ color: '#1a1a2e' }}>
        {editingEquipe ? '✏️ Modifier l\'équipe' : '🤝 Nouvelle équipe'}
      </h3>
      <form onSubmit={saveEquipe} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Nom de l&apos;équipe *
          </label>
          <input type="text" value={equipeForm.nom}
            onChange={e => setEquipeForm(p => ({ ...p, nom: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="Ex: Équipe Alpha" required />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Agence
          </label>
          <select value={equipeForm.agence_id}
            onChange={e => setEquipeForm(p => ({ ...p, agence_id: e.target.value, chef_id: '' }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}>
            <option value="">Sélectionner une agence</option>
            {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Chef d&apos;équipe
          </label>
          <select value={equipeForm.chef_id}
            onChange={e => setEquipeForm(p => ({ ...p, chef_id: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ borderColor: '#e2e8f0' }}>
            <option value="">Aucun chef assigné</option>
            {agentsData
              .filter(a => !equipeForm.agence_id || a.agence_id === equipeForm.agence_id)
              .filter(a => ['chef', 'agent', 'responsable'].includes(a.role))
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.prenom} {a.nom} — {a.role}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Description (optionnel)
          </label>
          <textarea value={equipeForm.description}
            onChange={e => setEquipeForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: '#e2e8f0' }} rows={2}
            placeholder="Description de l'équipe..." />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>Statut</label>
          <button type="button" onClick={() => setEquipeForm(p => ({ ...p, actif: !p.actif }))}
            className="relative w-10 h-6 rounded-full transition-all"
            style={{ backgroundColor: equipeForm.actif ? '#2A4E94' : '#e2e8f0' }}>
            <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
              style={{ left: equipeForm.actif ? '22px' : '2px' }} />
          </button>
          <span className="text-xs" style={{ color: '#818387' }}>{equipeForm.actif ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => { setShowEquipeModal(false); setEditingEquipe(null) }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
          <button type="submit" disabled={equipeLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: equipeLoading ? '#818387' : '#2A4E94' }}>
            {equipeLoading ? 'Sauvegarde...' : editingEquipe ? 'Enregistrer' : 'Créer l\'équipe'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{/* MODAL SUPPRESSION ÉQUIPE */}
{deleteEquipeConfirm && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
      <div className="text-4xl mb-4">🤝</div>
      <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>Supprimer cette équipe ?</h3>
      <p className="text-sm mb-6" style={{ color: '#818387' }}>
        Les agents de cette équipe seront désaffectés. Cette action est irréversible.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDeleteEquipeConfirm(null)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border"
          style={{ borderColor: '#e2e8f0', color: '#818387' }}>Annuler</button>
        <button type="button" onClick={() => deleteEquipe(deleteEquipeConfirm)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#E4322C' }}>Supprimer</button>
      </div>
    </div>
  </div>
)}

{/* MODAL AJOUTER MEMBRE */}
{showAddMembreModal && selectedEquipe && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
          ➕ Ajouter un membre — {selectedEquipe.nom}
        </h3>
        <button type="button" onClick={() => setShowAddMembreModal(false)}
          className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
      </div>
      <div className="p-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {agentsData
          .filter(a => a.equipe_id !== selectedEquipe.id && !equipeMembers.find(m => m.id === a.id))
          .filter(a => !selectedEquipe.agence_id || a.agence_id === selectedEquipe.agence_id)
          .length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: '#818387' }}>
            Tous les agents de cette agence sont déjà dans l&apos;équipe
          </div>
        ) : (
          <div className="space-y-2">
            {agentsData
              .filter(a => !equipeMembers.find(m => m.id === a.id))
              .filter(a => !selectedEquipe.agence_id || a.agence_id === selectedEquipe.agence_id)
              .map(agent => (
                <div key={agent.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: '#f8fafc' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: '#2A4E94' }}>
                      {agent.prenom?.[0]}{agent.nom?.[0]}
                    </div>
                    <div>
                      <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                        {agent.prenom} {agent.nom}
                      </div>
                      <div className="text-xs" style={{ color: '#818387' }}>
                        {agent.role} · {agent.agences?.nom || '—'}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => ajouterMembre(agent.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: '#2A4E94' }}>
                    Ajouter
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* MODAL CRÉER UTILISATEUR */}
{showCreateUserModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
          👤 Créer un utilisateur
        </h3>
        <button type="button"
          onClick={() => { setShowCreateUserModal(false); resetCreateUserForm() }}
          className="p-2 rounded-lg"
          style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
      </div>

      {/* Succès */}
      {createUserSuccess ? (
        <div className="p-6 space-y-4">
          <div className="rounded-2xl p-5 text-center"
            style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="text-4xl mb-3">🎉</div>
            <div className="font-bold text-base mb-1" style={{ color: '#166534' }}>
              Compte créé avec succès !
            </div>
            <div className="text-sm" style={{ color: '#166534' }}>
              {createUserSuccess.prenom} {createUserSuccess.nom} — {createUserSuccess.role}
            </div>
          </div>

          {/* Identifiants */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 className="font-semibold text-xs" style={{ color: '#818387' }}>
              🔑 IDENTIFIANTS DE CONNEXION
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Email', value: createUserSuccess.email },
                { label: 'Mot de passe', value: createUserSuccess.password },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: 'white', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div className="text-xs" style={{ color: '#818387' }}>{item.label}</div>
                    <div className="font-mono text-sm font-semibold" style={{ color: '#1a1a2e' }}>
                      {item.value}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => navigator.clipboard.writeText(item.value)}
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                    📋 Copier
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: '#991B1B' }}>
              ⚠️ Communiquez ces identifiants à l&apos;utilisateur. Le mot de passe ne sera plus visible après fermeture.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button"
              onClick={() => {
                const text = `Identifiants PERCOM\nEmail: ${createUserSuccess.email}\nMot de passe: ${createUserSuccess.password}`
                navigator.clipboard.writeText(text)
              }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
              📋 Copier tout
            </button>
            <button type="button"
              onClick={() => { resetCreateUserForm(); setShowCreateUserModal(false) }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#2A4E94' }}>
              ✅ Terminer
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={createUser} className="p-6 space-y-4 overflow-y-auto"
          style={{ maxHeight: '80vh' }}>

          {/* Erreur */}
          {createUserError && (
            <div className="p-3 rounded-xl text-sm"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              ❌ {createUserError}
            </div>
          )}

          {/* Identité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Prénom *
              </label>
              <input type="text" value={createUserForm.prenom}
                onChange={e => setCreateUserForm(p => ({ ...p, prenom: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e2e8f0' }}
                placeholder="Koffi" required />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Nom *
              </label>
              <input type="text" value={createUserForm.nom}
                onChange={e => setCreateUserForm(p => ({ ...p, nom: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e2e8f0' }}
                placeholder="Mensah" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Téléphone
            </label>
            <input type="tel" value={createUserForm.telephone}
              onChange={e => setCreateUserForm(p => ({ ...p, telephone: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e2e8f0' }}
              placeholder="+228 9X XX XX XX" />
          </div>

          {/* Accès */}
          <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-xs font-bold" style={{ color: '#1a1a2e' }}>🔐 Accès</div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Email *
              </label>
              <input type="email" value={createUserForm.email}
                onChange={e => setCreateUserForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e2e8f0' }}
                placeholder="koffi.mensah@pades.tg" required />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Mot de passe temporaire *
              </label>
              <div className="relative">
                <input type="text" value={createUserForm.password}
                  onChange={e => setCreateUserForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none pr-24"
                  style={{ borderColor: '#e2e8f0' }}
                  placeholder="Min. 8 caractères" required minLength={8} />
                <button type="button"
                  onClick={() => {
                    const pwd = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '!'
                    setCreateUserForm(p => ({ ...p, password: pwd }))
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                  🎲 Générer
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: '#818387' }}>
                Ce mot de passe sera communiqué à l&apos;utilisateur
              </p>
            </div>
          </div>

          {/* Rôle & Affectation */}
          <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-xs font-bold" style={{ color: '#1a1a2e' }}>🎭 Rôle & Affectation</div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Rôle *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'agent', label: '👤 Agent' },
                  { key: 'chef', label: '👨‍💼 Chef' },
                  { key: 'responsable', label: '🏦 Responsable' },
                  { key: 'dg', label: '⭐ DG' },
                ].map(r => (
                  <button key={r.key} type="button"
                    onClick={() => setCreateUserForm(p => ({ ...p, role: r.key }))}
                    className="py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: createUserForm.role === r.key ? '#2A4E94' : '#f8fafc',
                      color: createUserForm.role === r.key ? 'white' : '#818387',
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                Agence
              </label>
              <select
                value={createUserForm.agence_id}
                onChange={e => onAgenceChangeCreateUser(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e2e8f0' }}>
                <option value="">Sélectionner une agence</option>
                {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select>
            </div>
            {equipesFiltrees.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                  Équipe
                </label>
                <select
                  value={createUserForm.equipe_id}
                  onChange={e => setCreateUserForm(p => ({ ...p, equipe_id: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0' }}>
                  <option value="">Aucune équipe</option>
                  {equipesFiltrees.map(eq => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            <button type="button"
              onClick={() => { setShowCreateUserModal(false); resetCreateUserForm() }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: '#e2e8f0', color: '#818387' }}>
              Annuler
            </button>
            <button type="submit" disabled={createUserLoading}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: createUserLoading ? '#818387' : '#2A4E94' }}>
              {createUserLoading ? 'Création...' : '✅ Créer le compte'}
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
)}

{/* MODAL RÈGLEMENT MANQUANT */}
{showReglementModal && reglementFiche && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
          💰 Confirmer le règlement
        </h3>
        <button type="button" onClick={() => { setShowReglementModal(false); setReglementCommentaire('') }}
          className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
      </div>

      <div className="p-6 space-y-4">
        {/* Info */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div className="font-semibold text-sm" style={{ color: '#991B1B' }}>
            {reglementFiche.agents?.prenom} {reglementFiche.agents?.nom}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
            Fiche du {new Date(reglementFiche.date).toLocaleDateString('fr-FR')}
            · {reglementFiche.agents?.agences?.nom}
          </div>
          <div className="font-bold text-2xl mt-2" style={{ color: '#E4322C' }}>
            {Math.max(0, (reglementFiche.montant_mobilise || 0) - (reglementFiche.montant_rapporte || 0)).toLocaleString()} FCFA
          </div>
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
            Note / Commentaire (optionnel)
          </label>
          <textarea value={reglementCommentaire}
            onChange={e => setReglementCommentaire(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: '#e2e8f0' }}
            placeholder="Ex: Règlement effectué en cash le 22/05..." />
        </div>

        {/* Info notification */}
        <div className="rounded-xl p-3 flex items-center gap-2"
          style={{ backgroundColor: '#EEF2FF' }}>
          <span>🔔</span>
          <p className="text-xs" style={{ color: '#2A4E94' }}>
            L&apos;agent recevra une notification de confirmation.
          </p>
        </div>

        {/* Boutons */}
        <div className="flex gap-3">
          <button type="button"
            onClick={() => { setShowReglementModal(false); setReglementCommentaire('') }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Annuler
          </button>
          <button type="button"
            onClick={() => confirmerReglement(reglementFiche.id, reglementCommentaire)}
            disabled={reglementLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: reglementLoading ? '#818387' : '#166534' }}>
            {reglementLoading ? 'Traitement...' : '✅ Confirmer le règlement'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  )
}