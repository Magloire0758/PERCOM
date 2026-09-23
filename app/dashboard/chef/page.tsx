'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AgentInsights from '@/components/AgentInsights'
import AgentExportButtons from '@/components/AgentExportButtons'
import TeamWorkspace from '@/components/TeamWorkspace'
import { useTeamRpc } from '@/lib/use-team-rpc'
import type { TeamQueue } from '@/lib/team-reporting'
import { Home, Files, Users, ChartNoAxesCombined, Menu, Bell, Plus, ArrowRight } from 'lucide-react'
import FicheDetailModal from '@/components/FicheDetailModal'
import RegularisationModal from '@/components/RegularisationModal'   // ← AJOUTER
import EcartHistorique from '@/components/EcartHistorique'   
import { getEcart, getRestant } from '@/lib/ecarts'
import { fetchAllRows } from '@/lib/supabase-pagination'

type ActiveTab = 'accueil' | 'fiches' | 'equipe' | 'manquants' | 'performance' | 'messages' | 'profil'

export default function DashboardChef() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>('accueil')
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)

  // Data agent (propres données)
  const [ficheDuJour, setFicheDuJour] = useState<any>(null)
  const [fiches, setFiches] = useState<any[]>([])
  const [fichesLoading, setFichesLoading] = useState(false)
  const [fichesError, setFichesError] = useState('')
  const [notifications, setNotifications] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])

  // Équipe (données chef)
  const [equipeInfo, setEquipeInfo] = useState<any>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateAnterieure, setDateAnterieure] = useState('')
  // Modal détail fiche
  const [detailFiche, setDetailFiche] = useState<any>(null)
  const [detailCanValidate, setDetailCanValidate] = useState(false)
  const [showRegulModal, setShowRegulModal] = useState(false)
  const [regulFiche, setRegulFiche] = useState<any>(null)
  const [ecartsEquipe, setEcartsEquipe] = useState<any[]>([])
  const [selectedEcart, setSelectedEcart] = useState<any>(null)
  const [equipeError, setEquipeError] = useState('')
  const [statsScope, setStatsScope] = useState<'self' | 'team'>('team')
  const [showMore, setShowMore] = useState(false)
  const [validationBusy, setValidationBusy] = useState(false)
  const validationLock = useRef(false)
  const pending = useTeamRpc<TeamQueue>('equipe_file_traitement', { p_equipe_id: agent?.equipe_id ?? null, p_taille: 1 }, !!agent?.equipe_id)

  // Validation fiches membres
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationFiche, setValidationFiche] = useState<any>(null)
  const [validationStatut, setValidationStatut] = useState('validee')
  const [validationCommentaire, setValidationCommentaire] = useState('')

  // UI
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [fichesPeriode, setFichesPeriode] = useState<'semaine' | 'mois' | 'annee'>('mois')
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<any>(null)

  // Profil
  const [profilForm, setProfilForm] = useState({ nom: '', prenom: '', telephone: '' })
  const [profilSaving, setProfilSaving] = useState(false)
  const [profilSuccess, setProfilSuccess] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ nouveau: '', confirmer: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [notifPrefs, setNotifPrefs] = useState({
    notif_validation: true, notif_rappel: true,
    notif_objectif: true, notif_message: true,
  })

  const today = new Date().toISOString().split('T')[0]
  const dateMin = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    return d.toISOString().split('T')[0]
  })()

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedContact])

  useEffect(() => {
    if (!agent) return
    const channel = supabase.channel('chef-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (p) => { if (p.new.agent_id === agent.id) setNotifications(prev => [p.new, ...prev]) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async (p) => {
          if (p.new.destinataire_id !== agent.id) return
          if (selectedContact?.id === p.new.expediteur_id) {
            await supabase.rpc('marquer_message_lu', { p_message_id: p.new.id })
          }
          loadMessages(agent.id)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiches_journalieres' },
        (p) => {
          if (p.new.agent_id === agent.id) {
            setFiches(prev => prev.map(f => f.id === p.new.id ? { ...f, ...p.new } : f))
            if (ficheDuJour?.id === p.new.id) setFicheDuJour((prev: any) => ({ ...prev, ...p.new }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agent, selectedContact])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: a } = await supabase
      .from('agents')
      .select('*, agences(nom), equipes!agents_equipe_id_fkey(id, nom, chef_id)')
      .eq('user_id', user.id).single()
    if (!a || a.role !== 'chef' || a.statut !== 'actif' || a.actif !== true) {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }
    setAgent(a)
    setProfilForm({ nom: a.nom || '', prenom: a.prenom || '', telephone: a.telephone || '' })
    setTheme(a.theme || 'light')
    setNotifPrefs({
      notif_validation: a.notif_validation ?? true,
      notif_rappel: a.notif_rappel ?? true,
      notif_objectif: a.notif_objectif ?? true,
      notif_message: a.notif_message ?? true,
    })
    await Promise.all([
      loadFiches(a.id),
      loadNotifications(a.id),
      loadMessages(a.id),
      loadEquipe(a),
    ])
    setLoading(false)
  }

  async function loadFiches(agentId: string) {
    setFichesLoading(true)
    setFichesError('')
    const [ficheResult, historiqueResult] = await Promise.all([
      supabase.from('fiches_journalieres')
        .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
        .eq('agent_id', agentId).eq('date', today).maybeSingle(),
      fetchAllRows((from, to) => supabase.from('fiches_journalieres')
        .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
        .eq('agent_id', agentId).order('date', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    ])

    if (ficheResult.error || historiqueResult.error) {
      setFichesError(ficheResult.error?.message || historiqueResult.error?.message || 'Lecture des fiches impossible.')
    }
    if (!ficheResult.error) setFicheDuJour(ficheResult.data)
    if (!historiqueResult.error) setFiches(historiqueResult.data || [])
    setFichesLoading(false)
  }

  async function loadNotifications(agentId: string) {
    const { data } = await supabase.from('notifications')
      .select('*').eq('agent_id', agentId)
      .order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
  }

  async function loadMessages(agentId: string) {
    const { data } = await supabase.from('messages')
      .select('*, exp:expediteur_id(nom, prenom, role), dest:destinataire_id(nom, prenom, role)')
      .or(`expediteur_id.eq.${agentId},destinataire_id.eq.${agentId}`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    const { data: me } = await supabase.from('agents').select('agence_id').eq('id', agentId).single()
    if (me?.agence_id) {
      const { data: conts } = await supabase.from('agents')
        .select('id, nom, prenom, role')
        .eq('agence_id', me.agence_id)
        .in('role', ['responsable', 'dg', 'admin'])
        .neq('id', agentId)
      setContacts(conts || [])
    }
  }

  async function loadEquipe(a: any) {
    if (!a.equipe_id) return
    setEquipeInfo(a.equipes)
    setEquipeError('')
    const members = await fetchAllRows((from, to) => supabase.from('agents').select('id')
      .eq('equipe_id', a.equipe_id).in('role', ['agent', 'chef']).order('id').range(from, to))
    if (members.error) { setEcartsEquipe([]); setEquipeError(members.error.message); return }
    const ids = (members.data || []).map(m => m.id)
    if (!ids.length) { setEcartsEquipe([]); return }
    const result = await fetchAllRows((from, to) => supabase.from('fiches_journalieres')
      .select('*, agents!fiches_journalieres_agent_id_fkey(nom, prenom, telephone, agences(nom))')
      .in('agent_id', ids).order('date', { ascending: false }).order('id').range(from, to))
    if (result.error) { setEcartsEquipe([]); setEquipeError(result.error.message); return }
    setEcartsEquipe((result.data || []).filter(f => getEcart(f) !== 0))
  }

  async function validerFicheChef(ficheId: string, statut: string, commentaire?: string) {
    const action = statut === 'validee' ? 'valider' : 'demander_correction'
    const commentaireNettoye = commentaire?.trim() || null
    if (action === 'demander_correction' && !commentaireNettoye) {
      alert('Indiquez ce qui doit être corrigé.')
      return false
    }

    const { data, error: validationError } = await supabase.rpc('traiter_validation_fiche', {
      p_fiche_id: ficheId,
      p_action: action,
      p_commentaire: commentaireNettoye,
    })

    if (validationError) {
      alert(`Validation impossible : ${validationError.message}`)
      return false
    }

    if (!data?.ok) {
      alert(data?.erreur || data?.message || 'La décision n’a pas pu être enregistrée.')
      return false
    }

    const nouveauStatut = data.statut || (action === 'valider' ? 'validee' : 'a_corriger')
    // Mettre à jour aussi ses propres fiches
    setFiches(prev => prev.map(f => f.id === ficheId
      ? { ...f, valide_chef: nouveauStatut === 'validee', statut_validation: nouveauStatut, commentaire_chef: commentaireNettoye } : f))
    if (ficheDuJour?.id === ficheId) {
      setFicheDuJour((prev: any) => ({ ...prev, valide_chef: nouveauStatut === 'validee', statut_validation: nouveauStatut, commentaire_chef: commentaireNettoye }))
    }

    void pending.refresh()
    if (agent) void loadEquipe(agent)
    return true
  }

  async function marquerNotifsLues() {
    if (!agent) return
    const nonLues = notifications.filter(n => !n.lu)
    if (nonLues.length === 0) return

    const resultats = await Promise.all(nonLues.map(async notification => {
      const { data, error } = await supabase.rpc('marquer_notification_lue', { p_notif_id: notification.id })
      return !error && data?.ok ? notification.id : null
    }))
    const idsLus = new Set(resultats.filter((id): id is string => id !== null))
    setNotifications(prev => prev.map(n => idsLus.has(n.id) ? { ...n, lu: true } : n))
    if (idsLus.size !== nonLues.length) console.error('Certaines notifications n’ont pas pu être marquées comme lues.')
  }

  async function ouvrirConversation(contact: (typeof contacts)[number]) {
    setSelectedContact(contact)
    if (!agent) return
    const aMarquer = messages.filter(message =>
      message.expediteur_id === contact.id && message.destinataire_id === agent.id && !message.lu
    )
    if (aMarquer.length === 0) return

    const resultats = await Promise.all(aMarquer.map(async message => {
      const { data, error } = await supabase.rpc('marquer_message_lu', { p_message_id: message.id })
      return !error && data?.ok ? message.id : null
    }))
    const idsLus = new Set(resultats.filter((id): id is string => id !== null))
    setMessages(prev => prev.map(message => idsLus.has(message.id) ? { ...message, lu: true } : message))
    if (idsLus.size !== aMarquer.length) console.error('Certains messages n’ont pas pu être marqués comme lus.')
  }

  async function envoyerMessage() {
    if (!messageInput.trim() || !selectedContact || !agent) return
    setSendingMessage(true)
    const { data } = await supabase.from('messages').insert({
      expediteur_id: agent.id, destinataire_id: selectedContact.id, contenu: messageInput.trim(),
    }).select('*, exp:expediteur_id(nom, prenom, role), dest:destinataire_id(nom, prenom, role)').single()
    if (data) setMessages(prev => [...prev, data])
    setMessageInput('')
    setSendingMessage(false)
  }

  async function saveProfilForm() {
    if (!agent) return
    setProfilSaving(true)
    await supabase.from('agents').update(profilForm).eq('id', agent.id)
    setAgent((p: any) => ({ ...p, ...profilForm }))
    setProfilSaving(false); setProfilSuccess(true)
    setTimeout(() => setProfilSuccess(false), 3000)
  }

  async function changePassword() {
    if (pwdForm.nouveau !== pwdForm.confirmer) { setPwdError('Les mots de passe ne correspondent pas'); return }
    if (pwdForm.nouveau.length < 8) { setPwdError('Minimum 8 caractères'); return }
    setPwdSaving(true); setPwdError('')
    const { error } = await supabase.auth.updateUser({ password: pwdForm.nouveau })
    if (error) { setPwdError(error.message) }
    else { setPwdSuccess(true); setPwdForm({ nouveau: '', confirmer: '' }); setShowChangePwd(false); setTimeout(() => setPwdSuccess(false), 3000) }
    setPwdSaving(false)
  }

  async function saveNotifPrefs(key: string, value: boolean) {
    setNotifPrefs(p => ({ ...p, [key]: value }))
    await supabase.from('agents').update({ [key]: value }).eq('id', agent?.id)
  }

  async function toggleTheme() {
    const t = theme === 'light' ? 'dark' : 'light'
    setTheme(t)
    await supabase.from('agents').update({ theme: t }).eq('id', agent?.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ecartsListe = fiches.filter(f => getEcart(f) !== 0)
  const ecartsNonRegles = ecartsListe.filter(f => getRestant(f) > 0)
  const manquantsNonRegles = ecartsNonRegles.filter(f => getEcart(f) > 0)
  const surplusNonRegles = ecartsNonRegles.filter(f => getEcart(f) < 0)
  const totalManquants = manquantsNonRegles.reduce((s, f) => s + getRestant(f), 0)
  const totalSurplus = surplusNonRegles.reduce((s, f) => s + getRestant(f), 0)

  const notifNonLues = notifications.filter(n => !n.lu).length
  const messagesNonLus = messages.filter(m => m.destinataire_id === agent?.id && !m.lu).length

  const fichesFiltrees = (() => {
    let f = [...fiches]; const now = new Date()
    if (fichesPeriode === 'semaine') { const d = new Date(now); d.setDate(now.getDate() - 7); f = f.filter(x => new Date(x.date) >= d) }
    else if (fichesPeriode === 'mois') { f = f.filter(x => new Date(x.date) >= new Date(now.getFullYear(), now.getMonth(), 1)) }
    else { f = f.filter(x => new Date(x.date).getFullYear() === now.getFullYear()) }
    return f
  })()

  const messagesConv = selectedContact ? messages.filter(m =>
    (m.expediteur_id === agent?.id && m.destinataire_id === selectedContact.id) ||
    (m.expediteur_id === selectedContact.id && m.destinataire_id === agent?.id)
  ) : []

  const isDark = theme === 'dark'
  const bg = isDark ? '#0f172a' : '#f8fafc'
  const card = isDark ? '#1e293b' : 'white'
  const text = isDark ? '#f1f5f9' : '#1a1a2e'
  const sub = isDark ? '#94a3b8' : '#818387'
  const border = isDark ? '#334155' : '#f1f5f9'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#2A4E94', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: sub }}>Chargement...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, fontFamily: 'var(--font-dm-sans)' }}>

      {/* ── HEADER ── */}
      <div style={{ backgroundColor: '#2A4E94' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {agent?.prenom?.[0]}{agent?.nom?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">PERCOM</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#854D0E', color: 'white' }}>CHEF</span>
                {equipeInfo && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                    {equipeInfo.nom}
                  </span>
                )}
                {!isOnline && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#854D0E', color: '#FEF9C3' }}>🔴</span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {agent?.prenom} {agent?.nom}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button"
              aria-label="Notifications" onClick={() => { setShowNotifPanel(!showNotifPanel); if (notifNonLues > 0) marquerNotifsLues() }}
              className="relative p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Bell size={20} className="text-white" />
              {notifNonLues > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#E4322C' }}>
                  {notifNonLues > 9 ? '9+' : notifNonLues}
                </span>
              )}
            </button>
            {(pending.data?.compteurs.en_attente ?? 0) > 0 && (
              <button type="button" onClick={() => setActiveTab('equipe')}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: '#EAB308', color: 'white' }}>
                📋 {(pending.data?.compteurs.en_attente ?? 0)} à valider
              </button>
            )}
          </div>
        </div>

        {/* Notifications Panel */}
        {showNotifPanel && (
          <div className="max-w-6xl mx-auto px-4 pb-2">
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: border }}>
                <span className="font-semibold text-sm" style={{ color: text }}>🔔 Notifications</span>
                <button type="button" onClick={() => setShowNotifPanel(false)}
                  className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', color: sub }}>✕</button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: sub }}>Aucune notification</div>
                ) : notifications.slice(0, 10).map(n => (
                  <div key={n.id} className="px-4 py-3 border-b"
                    style={{ borderColor: border, backgroundColor: n.lu ? undefined : (isDark ? '#1e3a5f' : '#EEF2FF') }}>
                    <div className="font-medium text-xs" style={{ color: text }}>{n.titre}</div>
                    <div className="text-xs mt-0.5" style={{ color: sub }}>{n.message}</div>
                    <div className="text-xs mt-1" style={{ color: sub }}>
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'manquants' && equipeError && <div role="alert" className="max-w-6xl mx-auto mt-4 rounded-xl bg-red-50 p-4 text-red-800">Écarts équipe indisponibles : {equipeError}<button className="ml-3 underline" onClick={() => void loadEquipe(agent)}>Réessayer</button></div>}
      {/* ── CONTENU ── */}
      <div className="max-w-6xl mx-auto p-4 pb-24 space-y-4">

        {/* ════ ACCUEIL ════ */}
        {activeTab === 'accueil' && <>
          <section className="rounded-3xl bg-blue-950 p-6 sm:p-8 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Votre espace de collecte</p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">Bonjour {agent?.prenom}</h1>
            <p className="mt-2 text-sm text-blue-200">Pilotez votre journée et accompagnez votre équipe.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => ficheDuJour ? setActiveTab('fiches') : router.push('/dashboard/agent/fiche')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-950"><Plus size={18} />{ficheDuJour ? 'Voir ma fiche du jour' : 'Saisir ma fiche du jour'}</button>
              <button type="button" onClick={() => setShowDatePicker(true)} className="rounded-xl border border-blue-500 px-4 py-3 text-sm font-semibold">Saisir une date antérieure</button>
            </div>
          </section>
          {fichesError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{fichesError}</p>}
          <button type="button" onClick={() => setActiveTab('equipe')} className="w-full rounded-2xl border p-5 text-left flex items-center justify-between gap-3" style={{ backgroundColor: card, borderColor: border, color: text }}><div><h2 className="font-bold">Le suivi de votre équipe</h2><p className="mt-1 text-sm" style={{ color: sub }}>{!agent?.equipe_id ? 'Aucune équipe rattachée' : pending.error ? 'Compteurs indisponibles — ouvrir pour réessayer' : pending.data ? `${pending.data.compteurs.en_attente} en attente · ${pending.data.compteurs.a_corriger} à corriger` : 'Actualisation des compteurs…'}</p></div><ArrowRight size={20} /></button>
          <AgentInsights agentId={agent.id} hasAgency={!!agent.agence_id} mode="home" isDark={isDark} />
        </>}

        {/* ════ FICHES (propres fiches du chef) ════ */}
        {activeTab === 'fiches' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>📋 Mes fiches</h2>
            {fichesLoading && (
              <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: card, color: sub, border: `1px solid ${border}` }}>
                Chargement de l&apos;historique…
              </div>
            )}
            {fichesError && (
              <div role="alert" className="rounded-2xl p-4 flex items-center justify-between gap-3" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                <span className="text-sm">Impossible de charger les fiches : {fichesError}</span>
                <button type="button" onClick={() => agent && loadFiches(agent.id)} className="text-xs font-semibold underline">Réessayer</button>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total', value: fichesFiltrees.length, color: '#2A4E94', bg: '#EEF2FF' },
                { label: 'Validées', value: fichesFiltrees.filter(f => f.statut_validation === 'validee').length, color: '#166534', bg: '#F0FDF4' },
                { label: 'À corriger', value: fichesFiltrees.filter(f => f.statut_validation === 'a_corriger').length, color: '#854D0E', bg: '#FEF9C3' },
                { label: 'En attente', value: fichesFiltrees.filter(f => !f.statut_validation || f.statut_validation === 'en_attente').length, color: '#854D0E', bg: '#FEF9C3' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                  <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ key: 'semaine', label: '7 jours' }, { key: 'mois', label: 'Ce mois' }, { key: 'annee', label: 'Cette année' }].map(p => (
                <button key={p.key} type="button" onClick={() => setFichesPeriode(p.key as any)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: fichesPeriode === p.key ? '#2A4E94' : (isDark ? '#334155' : '#f1f5f9'), color: fichesPeriode === p.key ? 'white' : sub }}>
                  {p.label}
                </button>
              ))}
            </div>
            {fichesFiltrees.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">📭</div>
                <div className="font-medium text-sm" style={{ color: text }}>Aucune fiche</div>
              </div>
            ) : (
              <div className="space-y-3">
                {fichesFiltrees.map(fiche => {
                  const statutColor = fiche.statut_validation === 'validee' ? { bg: '#DCFCE7', color: '#166534', label: '✅ Validée' } :
                    fiche.statut_validation === 'a_corriger' ? { bg: '#FEF9C3', color: '#854D0E', label: '🔄 À corriger' } :
                    { bg: '#EEF2FF', color: '#2A4E94', label: '⏳ En attente' }
                  return (
                    <div key={fiche.id} className="rounded-2xl p-4" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="font-semibold text-sm" style={{ color: text }}>
                          {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: statutColor.bg, color: statutColor.color }}>{statutColor.label}</span>
                          {getEcart(fiche) !== 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: fiche.manquant_regle ? '#DCFCE7' : getEcart(fiche) > 0 ? '#FEE2E2' : '#E0E7FF',
                                color: fiche.manquant_regle ? '#166534' : getEcart(fiche) > 0 ? '#991B1B' : '#2A4E94'
                              }}>
                              {fiche.manquant_regle ? '✅' : getEcart(fiche) > 0 ? '⚠️' : '🔵'} {Math.abs(getEcart(fiche)).toLocaleString()} F
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'SMART', value: `${(fiche.montant_smart ?? fiche.montant_mobilise ?? 0).toLocaleString()}F` },
                          { label: 'Caisse', value: `${(fiche.montant_caisse ?? fiche.montant_rapporte ?? 0).toLocaleString()}F` },
                          { label: 'Commission', value: `${(fiche.commission_jour || 0).toLocaleString()}F` },
                          { label: 'Comptes DAT', value: fiche.comptes_ouverts_dat ?? fiche.comptes_ouverts ?? 0 },
                          { label: 'Adhésions', value: fiche.nb_adhesions || 0 },
                          { label: 'Réactiv.', value: fiche.reactivations?.filter((r: any) => r.reactif === true).length || 0 },
                        ].map(k => (
                          <div key={k.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                            <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value}</div>
                            <div className="text-xs" style={{ color: sub }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                      {fiche.commentaire_chef && (
                        <div className="rounded-xl p-3 flex items-start gap-2 mb-3"
                          style={{ backgroundColor: fiche.statut_validation === 'validee' ? '#F0FDF4' : fiche.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF' }}>
                          <span>💬</span>
                          <p className="text-xs" style={{ color: statutColor.color }}>{fiche.commentaire_chef}</p>
                        </div>
                      )}

                    <AgentExportButtons target={{ type: 'fiche', ficheId: fiche.id }} />
                    <div className="flex gap-2 mt-3">
                        <button type="button"
                          onClick={() => { setDetailFiche(fiche); setDetailCanValidate(false) }}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold"
                          style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                          👁️ Détails
                        </button>
                        {fiche.statut_validation !== 'validee' && (
                          <>
                            <button type="button"
                              onClick={() => router.push(`/dashboard/agent/fiche?edit=${fiche.id}`)}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold"
                              style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                              ✏️ Modifier
                            </button>
                            <button type="button"
                              onClick={() => {
                                setValidationFiche(fiche)
                                setValidationStatut('validee')
                                setValidationCommentaire('')
                                setShowValidationModal(true)
                              }}
                              className="flex-1 py-2 rounded-xl text-xs font-semibold"
                              style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                              ✅ Valider
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ ÉQUIPE ════ */}
        {activeTab === 'equipe' && <TeamWorkspace teamId={agent.equipe_id} mode="queue" isDark={isDark} onDecision={() => { void pending.refresh(); void loadFiches(agent.id); void loadEquipe(agent) }} />}

        {activeTab === 'manquants' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>⚖️ Mes écarts</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Manquants', value: totalManquants.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                { label: 'Surplus', value: totalSurplus.toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                { label: 'Réglés', value: ecartsListe.filter(f => f.manquant_regle).length, color: '#166534', bg: '#F0FDF4' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: s.bg }}>
                  <div className="font-bold text-base" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
            {ecartsListe.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">✅</div>
                <div className="font-medium text-sm" style={{ color: '#166534' }}>Aucun écart !</div>
                <div className="text-xs mt-1" style={{ color: sub }}>Vos comptes sont équilibrés 🎉</div>
              </div>
            ) : (
              <div className="space-y-3">
                {ecartsListe.map(fiche => {
                  const ecart = getEcart(fiche)
                  const isManquant = ecart > 0
                  const montant = Math.abs(ecart)
                  const regle = fiche.manquant_regle
                  return (
                    <div key={fiche.id} className="rounded-2xl p-4"
                      style={{ backgroundColor: card, border: `1px solid ${regle ? '#BBF7D0' : isManquant ? '#FECACA' : '#C7D2FE'}` }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                          </div>
                          <div className="font-bold text-xl mt-1"
                            style={{ color: regle ? '#166534' : isManquant ? '#E4322C' : '#2A4E94' }}>
                            {isManquant ? '−' : '+'} {montant.toLocaleString()} FCFA
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: regle ? '#DCFCE7' : isManquant ? '#FEE2E2' : '#E0E7FF',
                            color: regle ? '#166534' : isManquant ? '#991B1B' : '#2A4E94'
                          }}>
                          {regle ? '✅ Réglé' : isManquant ? '⚠️ Manquant' : '🔵 Surplus'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl p-2" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                          <div className="text-xs" style={{ color: sub }}>SMART (théorique)</div>
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {(fiche.montant_smart ?? fiche.montant_mobilise ?? 0).toLocaleString()} F
                          </div>
                        </div>
                        <div className="rounded-xl p-2" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                          <div className="text-xs" style={{ color: sub }}>Caisse (rapporté)</div>
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {(fiche.montant_caisse ?? fiche.montant_rapporte ?? 0).toLocaleString()} F
                          </div>
                        </div>
                      </div>
                      {(fiche.montant_regularise || 0) > 0 && (
                        <div className="mt-2 text-xs" style={{ color: '#166534' }}>
                          💰 {(fiche.montant_regularise || 0).toLocaleString()} F déjà régularisé — restant {Math.max(0, getRestant(fiche)).toLocaleString()} F
                        </div>
                      )}

                      {getRestant(fiche) > 0 && (
                        <button type="button"
                          onClick={() => { setRegulFiche(fiche); setShowRegulModal(true) }}
                          className="w-full mt-3 py-2.5 rounded-xl text-white text-xs font-semibold"
                          style={{ backgroundColor: '#2A4E94' }}>
                          💰 Régulariser
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* ── ÉCARTS DE L'ÉQUIPE ── */}
            {ecartsEquipe.filter(f => f.agent_id !== agent?.id).length > 0 && (
              <div className="pt-4 mt-4 border-t" style={{ borderColor: border }}>
                <h2 className="text-sm font-bold mb-3" style={{ color: text }}>
                  👥 Écarts de mon équipe
                </h2>

                {/* Stats équipe */}
                {(() => {
                  const ecartsMembres = ecartsEquipe.filter(f => f.agent_id !== agent?.id && !f.manquant_regle)
                  const totalManq = ecartsMembres.filter(f => getEcart(f) > 0).reduce((s, f) => s + getRestant(f), 0)
                  const totalSurp = ecartsMembres.filter(f => getEcart(f) < 0).reduce((s, f) => s + getRestant(f), 0)
                  return (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Manquants', value: totalManq.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                        { label: 'Surplus', value: totalSurp.toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                        { label: 'À traiter', value: ecartsMembres.length, color: '#854D0E', bg: '#FEF9C3' },
                      ].map(s => (
                        <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                          <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Liste */}
                <div className="space-y-3">
                  {ecartsEquipe.filter(f => f.agent_id !== agent?.id).map(f => {
                    const ec = getEcart(f)
                    const isManq = ec > 0
                    const restant = getRestant(f)
                    const regle = f.manquant_regle
                    const isOpen = selectedEcart?.id === f.id
                    return (
                      <div key={f.id} className="rounded-2xl overflow-hidden"
                        style={{
                          backgroundColor: card,
                          border: `1px solid ${regle ? '#BBF7D0' : isManq ? '#FECACA' : '#C7D2FE'}`
                        }}>
                        <button type="button"
                          onClick={() => setSelectedEcart(isOpen ? null : f)}
                          className="w-full p-4 text-left">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold text-sm" style={{ color: text }}>
                                {f.agents?.prenom} {f.agents?.nom}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: sub }}>
                                {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg"
                                style={{ color: regle ? '#166534' : isManq ? '#E4322C' : '#2A4E94' }}>
                                {isManq ? '−' : '+'} {Math.max(0, restant).toLocaleString()} F
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: regle ? '#DCFCE7' : isManq ? '#FEE2E2' : '#E0E7FF',
                                  color: regle ? '#166534' : isManq ? '#991B1B' : '#2A4E94'
                                }}>
                                {regle ? '✅ Réglé' : isManq ? '⚠️ Manquant' : '🔵 Surplus'}
                              </span>
                            </div>
                          </div>
                          {(f.montant_regularise || 0) > 0 && (
                            <div className="text-xs" style={{ color: '#166534' }}>
                              💰 {(f.montant_regularise || 0).toLocaleString()} F déjà régularisé sur {Math.abs(ec).toLocaleString()} F
                            </div>
                          )}
                          <div className="text-xs mt-2 text-right" style={{ color: sub }}>
                            {isOpen ? '▲ Réduire' : '▼ Détails'}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t p-4" style={{ borderColor: border }}>
                            <EcartHistorique
                              ficheId={f.id}
                              ecartTotal={Math.abs(ec)}
                              montantRegularise={f.montant_regularise || 0}
                              isManquant={isManq}
                              isDark={isDark}
                            />
                            {restant > 0 && (
                              <button type="button"
                                onClick={() => { setRegulFiche(f); setShowRegulModal(true) }}
                                className="w-full mt-3 py-3 rounded-xl text-white text-sm font-semibold"
                                style={{ backgroundColor: '#2A4E94' }}>
                                💰 Enregistrer une régularisation
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
              </div>
            )}

             {/* ── ÉCARTS DE L'ÉQUIPE ── */}
             {ecartsEquipe.filter(f => f.agent_id !== agent?.id).length > 0 && (
              <div className="pt-4 mt-4 border-t" style={{ borderColor: border }}>
                <h2 className="text-sm font-bold mb-3" style={{ color: text }}>
                  👥 Écarts de mon équipe
                </h2>

                {(() => {
                  const ecartsMembres = ecartsEquipe.filter(f => f.agent_id !== agent?.id && !f.manquant_regle)
                  const totalManq = ecartsMembres.filter(f => getEcart(f) > 0).reduce((s, f) => s + getRestant(f), 0)
                  const totalSurp = ecartsMembres.filter(f => getEcart(f) < 0).reduce((s, f) => s + getRestant(f), 0)
                  return (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Manquants', value: totalManq.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                        { label: 'Surplus', value: totalSurp.toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                        { label: 'À traiter', value: ecartsMembres.length, color: '#854D0E', bg: '#FEF9C3' },
                      ].map(s => (
                        <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                          <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div className="space-y-3">
                  {ecartsEquipe.filter(f => f.agent_id !== agent?.id).map(f => {
                    const ec = getEcart(f)
                    const isManq = ec > 0
                    const restant = getRestant(f)
                    const regle = f.manquant_regle
                    const isOpen = selectedEcart?.id === f.id
                    return (
                      <div key={f.id} className="rounded-2xl overflow-hidden"
                        style={{
                          backgroundColor: card,
                          border: `1px solid ${regle ? '#BBF7D0' : isManq ? '#FECACA' : '#C7D2FE'}`
                        }}>
                        <button type="button"
                          onClick={() => setSelectedEcart(isOpen ? null : f)}
                          className="w-full p-4 text-left">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold text-sm" style={{ color: text }}>
                                {f.agents?.prenom} {f.agents?.nom}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: sub }}>
                                {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg"
                                style={{ color: regle ? '#166534' : isManq ? '#E4322C' : '#2A4E94' }}>
                                {isManq ? '−' : '+'} {Math.max(0, restant).toLocaleString()} F
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  backgroundColor: regle ? '#DCFCE7' : isManq ? '#FEE2E2' : '#E0E7FF',
                                  color: regle ? '#166534' : isManq ? '#991B1B' : '#2A4E94'
                                }}>
                                {regle ? '✅ Réglé' : isManq ? '⚠️ Manquant' : '🔵 Surplus'}
                              </span>
                            </div>
                          </div>
                          {(f.montant_regularise || 0) > 0 && (
                            <div className="text-xs" style={{ color: '#166534' }}>
                              💰 {(f.montant_regularise || 0).toLocaleString()} F déjà régularisé sur {Math.abs(ec).toLocaleString()} F
                            </div>
                          )}
                          <div className="text-xs mt-2 text-right" style={{ color: sub }}>
                            {isOpen ? '▲ Réduire' : '▼ Détails'}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t p-4" style={{ borderColor: border }}>
                            <EcartHistorique
                              ficheId={f.id}
                              ecartTotal={Math.abs(ec)}
                              montantRegularise={f.montant_regularise || 0}
                              isManquant={isManq}
                              isDark={isDark}
                            />
                            {restant > 0 && (
                              <button type="button"
                                onClick={() => { setRegulFiche(f); setShowRegulModal(true) }}
                                className="w-full mt-3 py-3 rounded-xl text-white text-sm font-semibold"
                                style={{ backgroundColor: '#2A4E94' }}>
                                💰 Enregistrer une régularisation
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}


          </div>
        )}

        {/* ════ PERFORMANCE ════ */}
        {activeTab === 'performance' && <div className="space-y-5" style={{ color: text }}>
          <h1 className="text-2xl font-bold tracking-tight">Statistiques et rapports</h1>
          <div className="flex gap-2 rounded-2xl border p-1.5" style={{ backgroundColor: card, borderColor: border }}>
            {([{ key: 'team', label: 'Performances de l’équipe' }, { key: 'self', label: 'Mes performances' }] as const).map(scope => <button key={scope.key} type="button" aria-pressed={statsScope === scope.key} onClick={() => setStatsScope(scope.key)} className={`flex-1 rounded-xl px-3 py-3 text-sm font-semibold ${statsScope === scope.key ? 'bg-blue-900 text-white shadow-sm' : ''}`}>{scope.label}</button>)}
          </div>
          {statsScope === 'self' ? <AgentInsights agentId={agent.id} hasAgency={!!agent.agence_id} mode="stats" isDark={isDark} /> : <TeamWorkspace teamId={agent.equipe_id} mode="stats" isDark={isDark} onDecision={() => void pending.refresh()} />}
        </div>}

        {activeTab === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>💬 Messagerie</h2>
            {contacts.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">💬</div>
                <div className="font-medium text-sm" style={{ color: text }}>Aucun contact disponible</div>
              </div>
            ) : !selectedContact ? (
              <div className="space-y-2">
                {contacts.map(contact => {
                  const msgsContact = messages.filter(m =>
                    (m.expediteur_id === agent?.id && m.destinataire_id === contact.id) ||
                    (m.expediteur_id === contact.id && m.destinataire_id === agent?.id))
                  const lastMsg = msgsContact[msgsContact.length - 1]
                  const nonLus = messages.filter(m => m.expediteur_id === contact.id && m.destinataire_id === agent?.id && !m.lu).length
                  return (
                    <button key={contact.id} type="button" onClick={() => ouvrirConversation(contact)}
                      className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
                      style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shrink-0"
                        style={{ backgroundColor: '#2A4E94' }}>
                        {contact.prenom?.[0]}{contact.nom?.[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm" style={{ color: text }}>{contact.prenom} {contact.nom}</div>
                          {nonLus > 0 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: '#E4322C' }}>{nonLus}</span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: sub }}>{contact.role}</div>
                        {lastMsg && <div className="text-xs mt-0.5 truncate" style={{ color: sub }}>{lastMsg.expediteur_id === agent?.id ? 'Vous: ' : ''}{lastMsg.contenu}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
                <div className="flex items-center gap-3 p-4 rounded-2xl mb-3" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                  <button type="button" onClick={() => setSelectedContact(null)}
                    className="p-1.5 rounded-lg" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', color: sub }}>←</button>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: '#2A4E94' }}>
                    {selectedContact.prenom?.[0]}{selectedContact.nom?.[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: text }}>{selectedContact.prenom} {selectedContact.nom}</div>
                    <div className="text-xs" style={{ color: sub }}>{selectedContact.role}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1">
                  {messagesConv.length === 0 && <div className="text-center py-8 text-sm" style={{ color: sub }}>Démarrez la conversation 👋</div>}
                  {messagesConv.map(msg => {
                    const isMine = msg.expediteur_id === agent?.id
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-xs px-4 py-2.5 rounded-2xl"
                          style={{ backgroundColor: isMine ? '#2A4E94' : (isDark ? '#334155' : '#f1f5f9'), color: isMine ? 'white' : text, borderBottomRightRadius: isMine ? '4px' : undefined, borderBottomLeftRadius: !isMine ? '4px' : undefined }}>
                          <p className="text-sm">{msg.contenu}</p>
                          <p className="text-xs mt-1 opacity-70">{new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2">
                  <input type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage() } }}
                    placeholder="Écrire un message..."
                    className="flex-1 px-4 py-3 rounded-2xl border text-sm outline-none"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: card, color: text }} />
                  <button type="button" onClick={envoyerMessage} disabled={sendingMessage || !messageInput.trim()}
                    className="px-4 py-3 rounded-2xl font-semibold text-white"
                    style={{ backgroundColor: sendingMessage || !messageInput.trim() ? '#818387' : '#2A4E94' }}>
                    {sendingMessage ? '...' : '→'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ PROFIL ════ */}
        {activeTab === 'profil' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>👤 Mon profil</h2>
            <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl text-white mx-auto mb-3"
                style={{ backgroundColor: '#2A4E94' }}>
                {agent?.prenom?.[0]}{agent?.nom?.[0]}
              </div>
              <div className="font-bold text-lg" style={{ color: text }}>{agent?.prenom} {agent?.nom}</div>
              <div className="text-sm mt-0.5" style={{ color: sub }}>{agent?.email}</div>
              <div className="flex gap-2 justify-center mt-2 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Chef d&apos;équipe</span>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{equipeInfo?.nom || '—'}</span>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>{agent?.agences?.nom || '—'}</span>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>✏️ Informations personnelles</h3>
              {profilSuccess && <div className="mb-3 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>✅ Profil mis à jour</div>}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Prénom</label>
                    <input type="text" value={profilForm.prenom} onChange={e => setProfilForm(p => ({ ...p, prenom: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Nom</label>
                    <input type="text" value={profilForm.nom} onChange={e => setProfilForm(p => ({ ...p, nom: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Téléphone</label>
                  <input type="tel" value={profilForm.telephone} onChange={e => setProfilForm(p => ({ ...p, telephone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                </div>
                <button type="button" onClick={saveProfilForm} disabled={profilSaving}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: profilSaving ? '#818387' : '#2A4E94' }}>
                  {profilSaving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🔐 Sécurité</h3>
              {pwdSuccess && <div className="mb-3 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>✅ Mot de passe modifié</div>}
              {!showChangePwd ? (
                <button type="button" onClick={() => setShowChangePwd(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: '#2A4E94', backgroundColor: 'transparent' }}>
                  🔑 Changer le mot de passe
                </button>
              ) : (
                <div className="space-y-3">
                  {pwdError && <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>❌ {pwdError}</div>}
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Nouveau mot de passe</label>
                    <input type="password" value={pwdForm.nouveau} onChange={e => setPwdForm(p => ({ ...p, nouveau: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} placeholder="Min. 8 caractères" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Confirmer</label>
                    <input type="password" value={pwdForm.confirmer} onChange={e => setPwdForm(p => ({ ...p, confirmer: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowChangePwd(false); setPwdError('') }}
                      className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: sub }}>Annuler</button>
                    <button type="button" onClick={changePassword} disabled={pwdSaving}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ backgroundColor: pwdSaving ? '#818387' : '#2A4E94' }}>
                      {pwdSaving ? '...' : 'Modifier'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🎨 Apparence</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: text }}>Mode sombre</div>
                  <div className="text-xs" style={{ color: sub }}>{theme === 'dark' ? 'Sombre actif' : 'Clair actif'}</div>
                </div>
                <button type="button" onClick={toggleTheme}
                  className="relative w-12 h-6 rounded-full transition-all"
                  style={{ backgroundColor: theme === 'dark' ? '#2A4E94' : '#e2e8f0' }}>
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                    style={{ left: theme === 'dark' ? '26px' : '2px' }} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🏦 Mon compte PADES</h3>
              <div className="space-y-2">
                {[
                  { label: 'Rôle', value: 'Chef d\'équipe' },
                  { label: 'Équipe', value: equipeInfo?.nom || '—' },
                  { label: 'Agence', value: agent?.agences?.nom || '—' },
                  { label: 'Mes fiches', value: fiches.length },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b last:border-0" style={{ borderColor: border }}>
                    <span className="text-xs" style={{ color: sub }}>{item.label}</span>
                    <span className="text-xs font-medium" style={{ color: text }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={handleLogout}
              className="w-full py-3 rounded-2xl text-sm font-semibold border-2"
              style={{ borderColor: '#E4322C', color: '#E4322C', backgroundColor: 'transparent' }}>
              Se déconnecter
            </button>
          </div>
        )}

      </div>

      {showMore && <div className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setShowMore(false)}><div className="absolute bottom-24 right-4 left-4 sm:left-auto sm:w-80 rounded-2xl border p-3 shadow-xl" style={{ backgroundColor: card, borderColor: border }} onClick={e => e.stopPropagation()}>{([{ key: 'manquants', label: 'Écarts et régularisations' }, { key: 'messages', label: `Messages${messagesNonLus ? ` (${messagesNonLus})` : ''}` }, { key: 'profil', label: 'Mon profil' }] as const).map(t => <button type="button" key={t.key} onClick={() => { setActiveTab(t.key); setShowMore(false) }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-blue-50 hover:text-blue-900" style={{ color: text }}>{t.label}</button>)}</div></div>}
      <nav aria-label="Navigation chef" className="fixed bottom-0 left-0 right-0 z-40 border-t shadow-lg" style={{ backgroundColor: card, borderColor: border, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-6xl mx-auto flex">
          {[{ key: 'accueil', label: 'Accueil', Icon: Home }, { key: 'fiches', label: 'Mes fiches', Icon: Files }, { key: 'equipe', label: 'Équipe', Icon: Users }, { key: 'performance', label: 'Statistiques', Icon: ChartNoAxesCombined }, { key: 'plus', label: 'Plus', Icon: Menu }].map(t => <button key={t.key} type="button" aria-current={activeTab === t.key ? 'page' : undefined} onClick={() => t.key === 'plus' ? setShowMore(v => !v) : setActiveTab(t.key as ActiveTab)} className="relative flex-1 flex flex-col items-center gap-1.5 py-3 text-xs font-semibold" style={{ color: activeTab === t.key ? '#2563eb' : sub }}><t.Icon size={21} /><span>{t.label}</span>{t.key === 'equipe' && pending.data && pending.data.compteurs.en_attente > 0 && <span className="absolute top-1 right-1/4 rounded-full bg-blue-900 px-1.5 text-xs text-white">{pending.data.compteurs.en_attente}</span>}</button>)}
        </div>
      </nav>

      {/* Padding bas */}
      <div className="h-20" />

      {/* MODAL RÉGULARISATION */}
      {showRegulModal && regulFiche && (
        <RegularisationModal
          fiche={regulFiche}
          onClose={() => { setShowRegulModal(false); setRegulFiche(null) }}
          onSuccess={() => {
            if (agent) {
              loadFiches(agent.id)
              loadEquipe(agent)
            }
            setSelectedEcart(null)
          }}
        />
      )}

      {/* MODAL DÉTAIL FICHE */}
      {detailFiche && (
        <FicheDetailModal
          fiche={detailFiche}
          onClose={() => setDetailFiche(null)}
          canValidate={detailCanValidate}
          onValidate={() => {
            setValidationFiche(detailFiche)
            setValidationStatut('validee')
            setValidationCommentaire('')
            setDetailFiche(null)
            setShowValidationModal(true)
          }}
        />
      )}



      {/* MODAL VALIDATION FICHE */}
      {showValidationModal && validationFiche && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
              <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>📋 Décision sur la fiche</h3>
              <button type="button" disabled={validationBusy} onClick={() => setShowValidationModal(false)}
                className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>
                  Fiche du {new Date(validationFiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                  SMART {(validationFiche.montant_smart ?? validationFiche.montant_mobilise ?? 0).toLocaleString()} F ·
                  Caisse {(validationFiche.montant_caisse ?? validationFiche.montant_rapporte ?? 0).toLocaleString()} F ·
                  {(validationFiche.comptes_ouverts_dat ?? validationFiche.comptes_ouverts ?? 0)} comptes DAT
                </div>
                {(() => {
                  const e = getEcart(validationFiche)
                  if (e === 0) return null
                  return (
                    <div className="text-xs mt-1 font-semibold"
                      style={{ color: e > 0 ? '#991B1B' : '#2A4E94' }}>
                      {e > 0 ? '⚠️ Manquant' : '🔵 Surplus'} : {Math.abs(e).toLocaleString()} F
                    </div>
                  )
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-3" style={{ color: '#1a1a2e' }}>Décision</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'validee', label: '✅ Valider', bg: '#F0FDF4', color: '#166534', activeBg: '#166534' },
                    { key: 'a_corriger', label: '🔄 Demander une correction', bg: '#FEF9C3', color: '#854D0E', activeBg: '#854D0E' },
                  ].filter(s => s.key === 'validee' || !validationFiche.statut_validation || validationFiche.statut_validation === 'en_attente').map(s => (
                    <button key={s.key} type="button" onClick={() => setValidationStatut(s.key)}
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
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor: '#e2e8f0' }}
                  placeholder={validationStatut === 'validee' ? 'Bravo ! (optionnel)' : 'Ce qui doit être corrigé...'} />
              </div>

              <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#EEF2FF' }}>
                <span>🔔</span>
                <p className="text-xs" style={{ color: '#2A4E94' }}>L&apos;agent recevra une notification automatique.</p>
              </div>

              <div className="flex gap-3">
                <button type="button" disabled={validationBusy} onClick={() => setShowValidationModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                  Annuler
                </button>
                <button type="button"
                  disabled={validationBusy}
                  onClick={async () => {
                    if (validationLock.current) return
                    validationLock.current = true; setValidationBusy(true)
                    let ok = false
                    try { ok = await validerFicheChef(validationFiche.id, validationStatut, validationCommentaire) }
                    catch { alert('Décision impossible. Réessayez.') }
                    finally { validationLock.current = false; setValidationBusy(false) }
                    if (ok) {
                      setShowValidationModal(false)
                      setValidationCommentaire('')
                    }
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: validationStatut === 'validee' ? '#166534' : '#854D0E' }}>
                  {validationBusy ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DATE ANTÉRIEURE */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowDatePicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
              <h3 className="font-bold text-base" style={{ color: '#1a1a2e' }}>📅 Fiche antérieure</h3>
              <button type="button" onClick={() => setShowDatePicker(false)}
                className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                ℹ️ Vous pouvez saisir une fiche jusqu&apos;à 10 jours en arrière. Les dates déjà validées ne sont pas modifiables.
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#1a1a2e' }}>
                  Choisissez la date
                </label>
                <input type="date" value={dateAnterieure}
                  min={dateMin} max={today}
                  onChange={e => setDateAnterieure(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }} />
              </div>

              {/* Raccourcis 5 derniers jours */}
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: '#818387' }}>Accès rapide</div>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 5 }, (_, i) => {
                    const d = new Date()
                    d.setDate(d.getDate() - (i + 1))
                    const ds = d.toISOString().split('T')[0]
                    const f = fiches.find(x => x?.date === ds)
                    const validee = f?.statut_validation === 'validee'
                    return (
                      <button key={ds} type="button" disabled={validee}
                        onClick={() => setDateAnterieure(ds)}
                        className="p-2 rounded-xl text-xs text-left"
                        style={{
                          backgroundColor: validee ? '#F0FDF4' : dateAnterieure === ds ? '#2A4E94' : '#f8fafc',
                          color: validee ? '#166534' : dateAnterieure === ds ? 'white' : '#1a1a2e',
                          opacity: validee ? 0.6 : 1,
                          cursor: validee ? 'not-allowed' : 'pointer',
                        }}>
                        <div className="font-semibold">
                          {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.75 }}>
                          {validee ? '✅ Validée' : f ? '✏️ Modifiable' : '➕ Vide'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDatePicker(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: '#e2e8f0', color: '#818387' }}>
                  Annuler
                </button>
                <button type="button" disabled={!dateAnterieure}
                  onClick={() => {
                    setShowDatePicker(false)
                    router.push(`/dashboard/agent/fiche?date=${dateAnterieure}`)
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: dateAnterieure ? '#2A4E94' : '#cbd5e1' }}>
                  Continuer →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
