'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'dashboard' | 'agences' | 'agents' | 'objectifs' | 'fiches' | 'alertes' | 'parametres'

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

  const today = new Date().toISOString().split('T')[0]
  const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: me } = await supabase.from('agents').select('*').eq('user_id', user.id).single()
    if (!me || me.role !== 'admin') { router.push('/login'); return }
    setAdmin(me)

    await Promise.all([loadStats(), loadAgences()])
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
    { key: 'agents', label: 'Agents', icon: '👥', active: false },
    { key: 'objectifs', label: 'Objectifs', icon: '🎯', active: false },
    { key: 'fiches', label: 'Fiches', icon: '📋', active: false },
    { key: 'alertes', label: 'Alertes', icon: '⚠️', active: false },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️', active: false },
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
                  { label: "Collecté aujourd'hui", value: stats.collecteAujourdhui.toLocaleString() + ' F', icon: '💰', color: '#854D0E', bg: '#FEF9C3', sub: 'Toutes agences' },
                  { label: 'Collecté ce mois', value: stats.collecteMois.toLocaleString() + ' F', icon: '📈', color: '#991B1B', bg: '#FEF2F2', sub: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
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

          {/* Sections à venir */}
          {!['dashboard', 'agences'].includes(tab) && (
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
    </div>
  )
}