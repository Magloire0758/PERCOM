'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Agent = {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  role: string
  statut: string
  actif: boolean
  agence_id: string
  created_at: string
  agences?: { nom: string }
}

type Tab = 'overview' | 'users' | 'create'

export default function DashboardAdmin() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [agents, setAgents] = useState<Agent[]>([])
  const [agences, setAgences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterAgence, setFilterAgence] = useState('tous')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    prenom: '', nom: '', email: '', telephone: '',
    agence: '', role: 'agent', password: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: me } = await supabase
      .from('agents').select('role').eq('user_id', user.id).single()
    if (!me || me.role !== 'admin') { router.push('/login'); return }

    const { data: agentsData } = await supabase
      .from('agents')
      .select('*, agences(nom)')
      .order('created_at', { ascending: false })
    setAgents(agentsData || [])

    const { data: agencesData } = await supabase
      .from('agences').select('*').order('nom')
    setAgences(agencesData || [])

    setLoading(false)
  }

  async function updateStatut(id: string, statut: string) {
    setActionLoading(id + statut)
    await supabase.from('agents').update({ statut, actif: statut === 'actif' }).eq('id', id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, statut, actif: statut === 'actif' } : a))
    setActionLoading(null)
  }

  async function deleteAgent(id: string) {
    setActionLoading(id + 'delete')
    await supabase.from('agents').delete().eq('id', id)
    setAgents(prev => prev.filter(a => a.id !== id))
    setShowDeleteConfirm(null)
    setActionLoading(null)
  }

  async function saveEdit() {
    if (!editingAgent) return
    setActionLoading('edit')
    await supabase.from('agents').update({
      nom: editingAgent.nom,
      prenom: editingAgent.prenom,
      telephone: editingAgent.telephone,
      role: editingAgent.role,
      agence_id: editingAgent.agence_id,
    }).eq('id', editingAgent.id)
    setAgents(prev => prev.map(a => a.id === editingAgent.id ? { ...a, ...editingAgent } : a))
    setShowEditModal(false)
    setEditingAgent(null)
    setActionLoading(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')

    const { data, error: authError } = await supabase.auth.signUp({
      email: createForm.email,
      password: createForm.password,
    })

    if (authError || !data.user) {
      setCreateError(authError?.message || 'Erreur création compte')
      setCreateLoading(false)
      return
    }

    const agence = agences.find(a => a.nom === createForm.agence)

    const { error: insertError } = await supabase.from('agents').insert({
      user_id: data.user.id,
      nom: createForm.nom,
      prenom: createForm.prenom,
      email: createForm.email,
      telephone: createForm.telephone,
      agence_id: agence?.id || null,
      role: createForm.role,
      actif: true,
      statut: 'actif',
    })

    if (insertError) {
      setCreateError(insertError.message)
      setCreateLoading(false)
      return
    }

    setCreateSuccess(true)
    setCreateForm({ prenom: '', nom: '', email: '', telephone: '', agence: '', role: 'agent', password: '' })
    setCreateLoading(false)
    setTimeout(() => setCreateSuccess(false), 4000)
    loadData()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = agents.filter(a => {
    const matchSearch = search === '' ||
      `${a.prenom} ${a.nom} ${a.email}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'tous' || a.role === filterRole
    const matchStatut = filterStatut === 'tous' || a.statut === filterStatut
    const matchAgence = filterAgence === 'tous' || a.agence_id === filterAgence
    return matchSearch && matchRole && matchStatut && matchAgence
  })

  const stats = {
    total: agents.length,
    actifs: agents.filter(a => a.statut === 'actif').length,
    enAttente: agents.filter(a => a.statut === 'en_attente').length,
    bloques: agents.filter(a => a.statut === 'bloque').length,
  }

  const roleLabel: Record<string, string> = {
    agent: 'Agent', chef: 'Chef', responsable: 'Responsable', dg: 'DG', admin: 'Admin'
  }
  const statutColor: Record<string, { bg: string, color: string }> = {
    actif: { bg: '#DCFCE7', color: '#166534' },
    en_attente: { bg: '#FEF9C3', color: '#854D0E' },
    bloque: { bg: '#FEE2E2', color: '#991B1B' },
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-10 h-10 border-4 rounded-full animate-spin"
        style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc', fontFamily: 'var(--font-dm-sans)' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#1a1a2e' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: '#2A4E94', color: 'white' }}>P</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">PERCOM</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#E4322C', color: 'white' }}>
                  Admin
                </span>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Back-office</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="text-xs px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}>
            Déconnexion
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { key: 'overview', label: '📊 Vue d\'ensemble' },
              { key: 'users', label: '👥 Utilisateurs' },
              { key: 'create', label: '➕ Créer un compte' },
            ].map(t => (
              <button key={t.key} type="button"
                onClick={() => setTab(t.key as Tab)}
                className="px-4 py-3 text-xs font-medium border-b-2 transition-all"
                style={{
                  color: tab === t.key ? 'white' : 'rgba(255,255,255,0.45)',
                  borderBottomColor: tab === t.key ? '#2A4E94' : 'transparent',
                  backgroundColor: 'transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {/* ══ TAB : VUE D'ENSEMBLE ══ */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>
              Vue d&apos;ensemble de la plateforme
            </h2>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total utilisateurs', value: stats.total, icon: '👥', bg: '#EEF2FF', color: '#2A4E94' },
                { label: 'Comptes actifs', value: stats.actifs, icon: '✅', bg: '#F0FDF4', color: '#166534' },
                { label: 'En attente', value: stats.enAttente, icon: '⏳', bg: '#FEF9C3', color: '#854D0E' },
                { label: 'Comptes bloqués', value: stats.bloques, icon: '🚫', bg: '#FEF2F2', color: '#991B1B' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#818387' }}>{s.label}</div>
                      <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: s.bg }}>{s.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Répartition par rôle */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>
                  Répartition par rôle
                </h3>
                <div className="space-y-3">
                  {['agent', 'chef', 'responsable', 'dg', 'admin'].map(role => {
                    const count = agents.filter(a => a.role === role).length
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <div key={role}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                            {roleLabel[role]}
                          </span>
                          <span className="text-xs" style={{ color: '#818387' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: '#2A4E94' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="font-semibold text-sm mb-4" style={{ color: '#1a1a2e' }}>
                  Répartition par agence
                </h3>
                <div className="space-y-3">
                  {agences.map(agence => {
                    const count = agents.filter(a => a.agence_id === agence.id).length
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <div key={agence.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{agence.nom}</span>
                          <span className="text-xs" style={{ color: '#818387' }}>{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: '#E4322C' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Comptes en attente */}
            {stats.enAttente > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: '#1a1a2e' }}>
                  ⏳ Comptes en attente d&apos;activation
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                    {stats.enAttente}
                  </span>
                </h3>
                <div className="space-y-3">
                  {agents.filter(a => a.statut === 'en_attente').map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: '#f8fafc' }}>
                      <div>
                        <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>
                          {a.prenom} {a.nom}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                          {a.email} · {a.agences?.nom || 'Aucune agence'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatut(a.id, 'actif')}
                          disabled={actionLoading === a.id + 'actif'}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                          style={{ backgroundColor: '#166534' }}>
                          {actionLoading === a.id + 'actif' ? '...' : '✅ Activer'}
                        </button>
                        <button
                          onClick={() => updateStatut(a.id, 'bloque')}
                          disabled={actionLoading === a.id + 'bloque'}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                          style={{ backgroundColor: '#991B1B' }}>
                          {actionLoading === a.id + 'bloque' ? '...' : '🚫 Refuser'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB : UTILISATEURS ══ */}
        {tab === 'users' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>
              Gestion des utilisateurs
            </h2>

            {/* Filtres */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4" style={{ color: '#818387' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input type="text" placeholder="Rechercher par nom, prénom, email..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
              </div>

              <div className="flex flex-wrap gap-2">
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="tous">Tous les statuts</option>
                  <option value="actif">Actif</option>
                  <option value="en_attente">En attente</option>
                  <option value="bloque">Bloqué</option>
                </select>

                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="tous">Tous les rôles</option>
                  <option value="agent">Agent</option>
                  <option value="chef">Chef</option>
                  <option value="responsable">Responsable</option>
                  <option value="dg">DG</option>
                  <option value="admin">Admin</option>
                </select>

                <select value={filterAgence} onChange={e => setFilterAgence(e.target.value)}
                  className="px-3 py-2 rounded-xl border text-xs outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="tous">Toutes les agences</option>
                  {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>

                <div className="text-xs flex items-center px-3" style={{ color: '#818387' }}>
                  {filtered.length} résultat(s)
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>Aucun utilisateur trouvé</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        {['Utilisateur', 'Rôle', 'Agence', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                            style={{ color: '#818387' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a, i) => (
                        <tr key={a.id}
                          style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ backgroundColor: '#2A4E94' }}>
                                {a.prenom?.[0]}{a.nom?.[0]}
                              </div>
                              <div>
                                <div className="font-medium text-sm" style={{ color: '#1a1a2e' }}>
                                  {a.prenom} {a.nom}
                                </div>
                                <div className="text-xs" style={{ color: '#818387' }}>{a.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                              {roleLabel[a.role] || a.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs" style={{ color: '#818387' }}>
                              {a.agences?.nom || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{
                                backgroundColor: statutColor[a.statut]?.bg || '#f1f5f9',
                                color: statutColor[a.statut]?.color || '#1a1a2e'
                              }}>
                              {a.statut === 'actif' ? '✅ Actif'
                                : a.statut === 'en_attente' ? '⏳ En attente'
                                  : '🚫 Bloqué'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* Activer */}
                              {a.statut !== 'actif' && (
                                <button
                                  onClick={() => updateStatut(a.id, 'actif')}
                                  disabled={!!actionLoading}
                                  className="p-1.5 rounded-lg text-xs font-medium"
                                  style={{ backgroundColor: '#F0FDF4', color: '#166534' }}
                                  title="Activer">
                                  ✅
                                </button>
                              )}
                              {/* Bloquer */}
                              {a.statut !== 'bloque' && (
                                <button
                                  onClick={() => updateStatut(a.id, 'bloque')}
                                  disabled={!!actionLoading}
                                  className="p-1.5 rounded-lg text-xs font-medium"
                                  style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                                  title="Bloquer">
                                  🚫
                                </button>
                              )}
                              {/* Modifier */}
                              <button
                                onClick={() => { setEditingAgent({ ...a }); setShowEditModal(true) }}
                                className="p-1.5 rounded-lg text-xs"
                                style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}
                                title="Modifier">
                                ✏️
                              </button>
                              {/* Supprimer */}
                              <button
                                onClick={() => setShowDeleteConfirm(a.id)}
                                className="p-1.5 rounded-lg text-xs"
                                style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                                title="Supprimer">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB : CRÉER UN COMPTE ══ */}
        {tab === 'create' && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>
              Créer un compte utilisateur
            </h2>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              {createSuccess && (
                <div className="mb-4 p-4 rounded-xl flex items-center gap-3"
                  style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                  <span className="text-xl">✅</span>
                  <div>
                    <div className="font-semibold text-sm">Compte créé avec succès !</div>
                    <div className="text-xs mt-0.5">Le compte est actif et l&apos;utilisateur peut se connecter.</div>
                  </div>
                </div>
              )}

              {createError && (
                <div className="mb-4 p-4 rounded-xl text-sm"
                  style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                  ❌ {createError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <AdminField label="Prénom" type="text"
                    value={createForm.prenom}
                    onChange={v => setCreateForm(p => ({ ...p, prenom: v }))}
                    placeholder="Jean" required />
                  <AdminField label="Nom" type="text"
                    value={createForm.nom}
                    onChange={v => setCreateForm(p => ({ ...p, nom: v }))}
                    placeholder="Kodjo" required />
                </div>

                <AdminField label="Email" type="email"
                  value={createForm.email}
                  onChange={v => setCreateForm(p => ({ ...p, email: v }))}
                  placeholder="agent@pades.tg" required />

                <AdminField label="Téléphone" type="tel"
                  value={createForm.telephone}
                  onChange={v => setCreateForm(p => ({ ...p, telephone: v }))}
                  placeholder="+228 9X XX XX XX" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                      Rôle
                    </label>
                    <select value={createForm.role}
                      onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} required>
                      <option value="agent">Agent</option>
                      <option value="chef">Chef d&apos;équipe</option>
                      <option value="responsable">Responsable agence</option>
                      <option value="dg">Direction Générale</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                      Agence
                    </label>
                    <select value={createForm.agence}
                      onChange={e => setCreateForm(p => ({ ...p, agence: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                      <option value="">Aucune agence</option>
                      {agences.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                    Mot de passe temporaire
                  </label>
                  <input type="text"
                    value={createForm.password}
                    onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                    placeholder="Min. 8 caractères" required minLength={8} />
                  <p className="text-xs mt-1" style={{ color: '#818387' }}>
                    L&apos;utilisateur pourra changer son mot de passe depuis ses paramètres.
                  </p>
                </div>

                <div className="rounded-xl p-4" style={{ backgroundColor: '#EEF2FF' }}>
                  <p className="text-xs" style={{ color: '#2A4E94' }}>
                    ℹ️ Le compte créé par l&apos;admin est immédiatement actif.
                    L&apos;utilisateur peut se connecter dès maintenant avec les identifiants fournis.
                  </p>
                </div>

                <button type="submit" disabled={createLoading}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: createLoading ? '#818387' : '#2A4E94' }}>
                  {createLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Création en cours...
                    </>
                  ) : '➕ Créer le compte'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL MODIFICATION ══ */}
      {showEditModal && editingAgent && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg mb-5" style={{ color: '#1a1a2e' }}>
              ✏️ Modifier {editingAgent.prenom} {editingAgent.nom}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AdminField label="Prénom" type="text"
                  value={editingAgent.prenom}
                  onChange={v => setEditingAgent(p => p ? { ...p, prenom: v } : p)}
                  placeholder="Prénom" />
                <AdminField label="Nom" type="text"
                  value={editingAgent.nom}
                  onChange={v => setEditingAgent(p => p ? { ...p, nom: v } : p)}
                  placeholder="Nom" />
              </div>

              <AdminField label="Téléphone" type="tel"
                value={editingAgent.telephone || ''}
                onChange={v => setEditingAgent(p => p ? { ...p, telephone: v } : p)}
                placeholder="+228 9X XX XX XX" />

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Rôle</label>
                <select value={editingAgent.role}
                  onChange={e => setEditingAgent(p => p ? { ...p, role: e.target.value } : p)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="agent">Agent</option>
                  <option value="chef">Chef d&apos;équipe</option>
                  <option value="responsable">Responsable agence</option>
                  <option value="dg">Direction Générale</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>Agence</label>
                <select value={editingAgent.agence_id || ''}
                  onChange={e => setEditingAgent(p => p ? { ...p, agence_id: e.target.value } : p)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}>
                  <option value="">Aucune agence</option>
                  {agences.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button"
                onClick={() => { setShowEditModal(false); setEditingAgent(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                Annuler
              </button>
              <button type="button"
                onClick={saveEdit}
                disabled={actionLoading === 'edit'}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#2A4E94' }}>
                {actionLoading === 'edit' ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL SUPPRESSION ══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="text-4xl mb-4">🗑️</div>
            <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1a2e' }}>
              Confirmer la suppression
            </h3>
            <p className="text-sm mb-6" style={{ color: '#818387' }}>
              Cette action est irréversible. Le compte sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                Annuler
              </button>
              <button type="button"
                onClick={() => deleteAgent(showDeleteConfirm)}
                disabled={!!actionLoading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#E4322C' }}>
                {actionLoading ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminField({ label, type, value, onChange, placeholder, required }: {
  label: string, type: string, value: string,
  onChange: (v: string) => void, placeholder: string, required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
        style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
        onFocus={e => e.target.style.borderColor = '#2A4E94'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        placeholder={placeholder} required={required} />
    </div>
  )
}