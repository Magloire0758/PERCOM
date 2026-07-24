'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FicheDetail from '@/components/FicheDetail'
import EcartHistorique from '@/components/EcartHistorique'   // ← AJOUTER



type ActiveTab = 'accueil' | 'fiches' | 'manquants' | 'performance' | 'messages' | 'profil'

export default function DashboardAgent() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>('accueil')
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)

  // Data
  const [ficheDuJour, setFicheDuJour] = useState<any>(null)
  const [fiches, setFiches] = useState<any[]>([])
  const [objectifs, setObjectifs] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [classement, setClassement] = useState<any[]>([])

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

  const [mesZones, setMesZones] = useState<any[]>([])
  const [selectedFicheAgent, setSelectedFicheAgent] = useState<any>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateAnterieure, setDateAnterieure] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const dateMin = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    return d.toISOString().split('T')[0]
  })()

  // Online/offline
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => { loadAll() }, [])

  // Scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedContact])

  // Realtime
  useEffect(() => {
    if (!agent) return
    const channel = supabase.channel('agent-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (p) => { if (p.new.agent_id === agent.id) setNotifications(prev => [p.new, ...prev]) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (p) => { if (p.new.destinataire_id === agent.id) loadMessages(agent.id) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiches_journalieres' },
        (p) => {
          if (p.new.agent_id === agent.id) {
            setFiches(prev => prev.map(f => f.id === p.new.id ? { ...f, ...p.new } : f))
            if (ficheDuJour?.id === p.new.id) setFicheDuJour((prev: any) => ({ ...prev, ...p.new }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agent])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: a } = await supabase
      .from('agents')
      .select('*, agences(nom), equipes!agents_equipe_id_fkey(nom)')
      .eq('user_id', user.id).single()
    if (!a) { router.push('/login'); return }
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
      loadObjectifs(a),
      loadNotifications(a.id),
      loadMessages(a.id),
      loadClassement(a),
      loadMesZones(a.id),
    ])
    setLoading(false)
  }

  async function loadFiches(agentId: string) {
    const { data: fiche } = await supabase
      .from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', agentId).eq('date', today).maybeSingle()
    setFicheDuJour(fiche)
  
    const { data: all } = await supabase
      .from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', agentId).order('date', { ascending: false })
    setFiches((all || []).filter(Boolean))
  }

  async function loadObjectifs(a: any) {
    const { data } = await supabase.from('objectifs').select('*')
      .or(`agent_id.eq.${a.id},agence_id.eq.${a.agence_id || 'null'},type_cible.eq.global`)
      .eq('statut_objectif', 'actif')
    setObjectifs(data || [])
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

    const { data: me } = await supabase.from('agents')
      .select('agence_id').eq('id', agentId).single()
    if (me?.agence_id) {
      const { data: conts } = await supabase.from('agents')
        .select('id, nom, prenom, role')
        .eq('agence_id', me.agence_id)
        .in('role', ['chef', 'responsable', 'dg', 'admin'])
        .neq('id', agentId)
      setContacts(conts || [])
    }
  }

  async function loadMesZones(agentId: string) {
    const { data } = await supabase
      .from('agent_zones')
      .select('zone_id, zones(id, numero, nom, agences(nom))')
      .eq('agent_id', agentId)
    setMesZones(data || [])
  }

  async function loadClassement(a: any) {
    if (!a.agence_id) return
    const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const { data: agentsAgence } = await supabase.from('agents')
      .select('id, nom, prenom').eq('agence_id', a.agence_id).eq('statut', 'actif').eq('role', 'agent')
    if (!agentsAgence?.length) return
    const { data: fichesMois } = await supabase.from('fiches_journalieres')
    .select('agent_id, montant_smart, montant_mobilise').gte('date', moisDebut)
    .in('agent_id', agentsAgence.map(ag => ag.id))
  const scores: Record<string, number> = {}
  ;(fichesMois || []).forEach(f => { scores[f.agent_id] = (scores[f.agent_id] || 0) + (f.montant_smart ?? f.montant_mobilise ?? 0) })
    setClassement(agentsAgence.map(ag => ({ ...ag, score: scores[ag.id] || 0 })).sort((a, b) => b.score - a.score))
  }

  async function marquerNotifsLues() {
    if (!agent) return
    await supabase.from('notifications').update({ lu: true }).eq('agent_id', agent.id).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
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
    setProfilSaving(false)
    setProfilSuccess(true)
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
    const updated = { ...notifPrefs, [key]: value }
    setNotifPrefs(updated)
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

  // ── Calculs ──
// Helper écart
const getEcart = (f: any) => {
  if (!f) return 0
  return (f.montant_smart ?? f.montant_mobilise ?? 0) - (f.montant_caisse ?? f.montant_rapporte ?? 0)
}

const getRestant = (f: any) => {
  if (!f) return 0
  return Math.abs(getEcart(f)) - (f.montant_regularise || 0)
}

const fichesMois = fiches.filter(f => f && new Date(f.date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const totalComptesDat = fichesMois.reduce((s, f) => s + (f.comptes_ouverts_dat ?? f.comptes_ouverts ?? 0), 0)
const totalSmart = fichesMois.reduce((s, f) => s + (f.montant_smart ?? f.montant_mobilise ?? 0), 0)
const totalCaisse = fichesMois.reduce((s, f) => s + (f.montant_caisse ?? f.montant_rapporte ?? 0), 0)
const totalCommissions = fichesMois.reduce((s, f) => s + (f.commission_jour || 0), 0)
const totalAdhesions = fichesMois.reduce((s, f) => s + (f.nb_adhesions || 0), 0)
const totalLydeCash = fichesMois.reduce((s, f) => s + (f.nb_abonnements_lyde_cash || 0), 0)
const totalClientsParcourus = fichesMois.reduce((s, f) => s + (f.nb_clients_parcourus || 0), 0)
const totalReactivations = fichesMois.reduce((s, f) => s + (f.reactivations?.length || 0), 0)
const totalAugmentations = fichesMois.reduce((s, f) => s + (f.augmentations_mise?.length || 0), 0)
const totalAssurancesNb = fichesMois.reduce((s, f) => s + (f.assurances_details?.reduce((a: number, x: any) => a + (x.nb || 0), 0) || 0), 0)
const joursActifs = fichesMois.length
// Taux de conformité : % de jours sans écart
const joursSansEcart = fichesMois.filter(f => getEcart(f) === 0).length
const tauxConformite = joursActifs > 0 ? Math.round((joursSansEcart / joursActifs) * 100) : 0
const tauxRegularite = Math.min(100, Math.round((joursActifs / new Date().getDate()) * 100))
const scoreMensuel = joursActifs > 0 ? Math.min(100, Math.round((totalComptesDat / (joursActifs * 6)) * 100)) : 0

// Compat : totalCollecte = SMART
const totalCollecte = totalSmart

  // Streak
  const streak = (() => {
    let count = 0
    const now = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      if (fiches.find(f => f.date === d.toISOString().split('T')[0])) count++
      else if (i > 0) break
    }
    return count
  })()

  const ecartsListe = fiches.filter(f => f && getEcart(f) !== 0)
  const ecartsNonRegles = ecartsListe.filter(f => !f.manquant_regle)
  const manquantsNonRegles = ecartsNonRegles.filter(f => getEcart(f) > 0)
  const surplusNonRegles = ecartsNonRegles.filter(f => getEcart(f) < 0)
  const totalManquants = manquantsNonRegles.reduce((s, f) => s + getRestant(f), 0)
  const totalSurplus = surplusNonRegles.reduce((s, f) => s + getRestant(f), 0)
  const monRang = classement.findIndex(a => a.id === agent?.id) + 1
  const notifNonLues = notifications.filter(n => !n.lu).length
  const messagesNonLus = messages.filter(m => m.destinataire_id === agent?.id && !m.lu).length

  const fichesFiltrees = (() => {
    let f = fiches.filter(Boolean)
    const now = new Date()
    if (fichesPeriode === 'semaine') { const d = new Date(now); d.setDate(now.getDate() - 7); f = f.filter(x => new Date(x.date) >= d) }
    else if (fichesPeriode === 'mois') { f = f.filter(x => new Date(x.date) >= new Date(now.getFullYear(), now.getMonth(), 1)) }
    else { f = f.filter(x => new Date(x.date).getFullYear() === now.getFullYear()) }
    return f
  })()

  const sept7Jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const fiche = fiches.find(f => f.date === dateStr)
    return { jour: d.toLocaleDateString('fr-FR', { weekday: 'short' }), montant: (fiche?.montant_smart ?? fiche?.montant_mobilise ?? 0), comptes: (fiche?.comptes_ouverts_dat ?? fiche?.comptes_ouverts ?? 0) }
  })

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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {agent?.prenom?.[0]}{agent?.nom?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">PERCOM</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#E4322C', color: 'white' }}>
                  {agent?.role?.toUpperCase()}
                </span>
                {!isOnline && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#854D0E', color: '#FEF9C3' }}>
                    🔴 Hors ligne
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {agent?.prenom} {agent?.nom}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications badge */}
            <button type="button"
              onClick={() => { setShowNotifPanel(!showNotifPanel); if (notifNonLues > 0) marquerNotifsLues() }}
              className="relative p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <span className="text-lg">🔔</span>
              {notifNonLues > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#E4322C' }}>
                  {notifNonLues > 9 ? '9+' : notifNonLues}
                </span>
              )}
            </button>

            {ecartsNonRegles.length > 0 && (
              <button type="button" onClick={() => setActiveTab('manquants')}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: totalManquants > 0 ? '#E4322C' : '#2A4E94', color: 'white' }}>
                ⚖️ {ecartsNonRegles.length} écart(s)
              </button>
            )}
          </div>
        </div>

        {/* Notifications Panel */}
        {showNotifPanel && (
          <div className="max-w-2xl mx-auto px-4 pb-2">
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

      {/* ── CONTENU ── */}
      <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">

        {/* ════ ACCUEIL ════ */}
        {activeTab === 'accueil' && (
          <>
            {/* Hero Section */}
            <div className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg, #2A4E94, #1e3a6e)', color: 'white' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm opacity-75">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="text-xl font-bold mt-0.5">
                    Bonjour, {agent?.prenom} 👋
                  </h1>
                </div>
                <div className="text-right">
                  {streak > 0 && (
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-lg">🔥</span>
                      <span className="font-bold text-sm">{streak} jour{streak > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              

              {/* Score du mois */}
              <div className="grid grid-cols-3 gap-3">
              {[
                  { label: 'Conformité', value: `${tauxConformite}%`, icon: '🎯' },
                  { label: 'Régularité', value: `${tauxRegularite}%`, icon: '📅' },
                  { label: 'Score', value: `${scoreMensuel}%`, icon: '⭐' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="font-bold text-lg">{s.value}</div>
                    <div className="text-xs opacity-75">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Classement */}
              {monRang > 0 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <span className="text-lg">🏆</span>
                  <span className="text-sm font-medium">
                    {monRang === 1 ? '1er' : `${monRang}ème`} sur {classement.length} agents — {agent?.agences?.nom}
                  </span>
                </div>
              )}
            </div>

            {/* Équipe + Zones */}
<div className="grid grid-cols-2 gap-3">

{/* Badge équipe */}
<div className="rounded-2xl p-4 flex items-center gap-3"
  style={{ backgroundColor: card, border: `1px solid ${border}` }}>
  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
    style={{ backgroundColor: '#EEF2FF' }}>👥</div>
  <div>
    <div className="text-xs" style={{ color: sub }}>Mon équipe</div>
    {agent?.equipes?.nom ? (
      <div className="font-bold text-sm mt-0.5" style={{ color: '#2A4E94' }}>
        {agent.equipes.nom}
      </div>
    ) : (
      <div className="text-xs mt-0.5 italic" style={{ color: sub }}>
        Non affecté
      </div>
    )}
    {agent?.equipes?.nom && (
      <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block"
        style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
        En équipe ✅
      </span>
    )}
  </div>
</div>

{/* Zones assignées */}
<div className="rounded-2xl p-4 flex items-start gap-3"
  style={{ backgroundColor: card, border: `1px solid ${border}` }}>
  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
    style={{ backgroundColor: '#F0FDF4' }}>🗺️</div>
  <div className="flex-1">
    <div className="text-xs mb-1" style={{ color: sub }}>Mes zones</div>
    {mesZones.length === 0 ? (
      <div className="text-xs italic" style={{ color: sub }}>Aucune zone</div>
    ) : (
      <div className="flex flex-wrap gap-1">
        {mesZones.map(az => (
          <span key={az.zone_id}
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
            Z{az.zones?.numero}
          </span>
        ))}
      </div>
    )}
  </div>
</div>

</div>

{/* Alerte écarts */}
{ecartsNonRegles.length > 0 && (
              <button type="button" onClick={() => setActiveTab('manquants')}
                className="w-full rounded-2xl p-4 flex items-center justify-between text-left"
                style={{
                  backgroundColor: manquantsNonRegles.length > 0 ? '#FEF2F2' : '#EEF2FF',
                  border: `1px solid ${manquantsNonRegles.length > 0 ? '#FECACA' : '#C7D2FE'}`
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: manquantsNonRegles.length > 0 ? '#FEE2E2' : '#E0E7FF' }}>
                    {manquantsNonRegles.length > 0 ? '⚠️' : '🔵'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm"
                      style={{ color: manquantsNonRegles.length > 0 ? '#991B1B' : '#2A4E94' }}>
                      {ecartsNonRegles.length} écart(s) non réglé(s)
                    </div>
                    <div className="text-xs" style={{ color: manquantsNonRegles.length > 0 ? '#B91C1C' : '#2A4E94' }}>
                      {totalManquants > 0 && `⚠️ ${totalManquants.toLocaleString()} F manquant`}
                      {totalManquants > 0 && totalSurplus > 0 && ' · '}
                      {totalSurplus > 0 && `🔵 ${totalSurplus.toLocaleString()} F surplus`}
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: manquantsNonRegles.length > 0 ? '#FEE2E2' : '#E0E7FF',
                    color: manquantsNonRegles.length > 0 ? '#991B1B' : '#2A4E94'
                  }}>Voir →</span>
              </button>
            )}

            {/* Fiche du jour */}
            <div className="rounded-2xl p-5 flex items-center justify-between"
              style={{
                background: ficheDuJour ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                border: `1px solid ${ficheDuJour ? '#BBF7D0' : '#C7D2FE'}`
              }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: ficheDuJour ? '#DCFCE7' : '#E0E7FF' }}>
                  {ficheDuJour ? '✅' : '📝'}
                </div>
                <div>
                  <div className="font-bold" style={{ color: ficheDuJour ? '#166534' : '#2A4E94' }}>
                    {ficheDuJour ? 'Fiche soumise ✅' : 'Fiche du jour à remplir'}
                  </div>
                  {ficheDuJour && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor:
                            ficheDuJour.statut_validation === 'validee' ? '#DCFCE7' :
                            ficheDuJour.statut_validation === 'rejetee' ? '#FEE2E2' :
                            ficheDuJour.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF',
                          color:
                            ficheDuJour.statut_validation === 'validee' ? '#166534' :
                            ficheDuJour.statut_validation === 'rejetee' ? '#991B1B' :
                            ficheDuJour.statut_validation === 'a_corriger' ? '#854D0E' : '#2A4E94'
                        }}>
                        {ficheDuJour.statut_validation === 'validee' ? '✅ Validée' :
                         ficheDuJour.statut_validation === 'rejetee' ? '❌ Rejetée' :
                         ficheDuJour.statut_validation === 'a_corriger' ? '🔄 À corriger' : '⏳ En attente'}
                      </span>
                    </div>
                  )}
                  {ficheDuJour?.commentaire_chef && (
                    <div className="text-xs mt-1 italic" style={{ color: '#166534' }}>
                      💬 {ficheDuJour.commentaire_chef}
                    </div>
                  )}
                  {!ficheDuJour && (
                    <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                      {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  )}
                </div>
              </div>
              {!ficheDuJour && (
                <button onClick={() => router.push('/dashboard/agent/fiche')}
                  className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold shrink-0"
                  style={{ backgroundColor: '#2A4E94' }}>
                  Remplir →
                </button>
              )}
            </div>

            {/* Bouton fiche antérieure */}
            <button type="button" onClick={() => setShowDatePicker(true)}
              className="w-full rounded-2xl p-4 flex items-center justify-between text-left"
              style={{ backgroundColor: card, border: `1px dashed ${isDark ? '#475569' : '#cbd5e1'}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9' }}>📅</div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: text }}>
                    Saisir une fiche antérieure
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: sub }}>
                    Jusqu&apos;à 10 jours en arrière
                  </div>
                </div>
              </div>
              <span className="text-lg" style={{ color: sub }}>→</span>
            </button>

            {/* KPIs du jour */}
            {ficheDuJour && (
  <div>
    <h2 className="text-sm font-bold mb-3" style={{ color: text }}>🎯 Performance du jour</h2>
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'SMART', value: (ficheDuJour.montant_smart ?? ficheDuJour.montant_mobilise ?? 0).toLocaleString() + ' F', objectif: 25000, raw: ficheDuJour.montant_smart ?? ficheDuJour.montant_mobilise ?? 0 },
        { label: 'Commission', value: (ficheDuJour.commission_jour || 0).toLocaleString() + ' F', objectif: 5000, raw: ficheDuJour.commission_jour || 0 },
        { label: 'Comptes DAT', value: ficheDuJour.comptes_ouverts_dat || ficheDuJour.comptes_ouverts || 0, objectif: 6, raw: ficheDuJour.comptes_ouverts_dat || ficheDuJour.comptes_ouverts || 0 },
        { label: 'Adhésions', value: ficheDuJour.nb_adhesions || 0, objectif: 5, raw: ficheDuJour.nb_adhesions || 0 },
        { label: 'Réactivations', value: ficheDuJour.reactivations?.length || 0, objectif: 3, raw: ficheDuJour.reactivations?.length || 0 },
        { label: 'Augm. mise', value: ficheDuJour.augmentations_mise?.length || 0, objectif: 3, raw: ficheDuJour.augmentations_mise?.length || 0 },
      ].map(k => {
        const pct = Math.min(100, Math.round((k.raw / k.objectif) * 100))
        const color = pct >= 100 ? '#166534' : pct >= 50 ? '#854D0E' : '#991B1B'
        const barColor = pct >= 100 ? '#22C55E' : pct >= 50 ? '#EAB308' : '#EF4444'
        return (
          <div key={k.label} className="rounded-2xl p-3" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
            <div className="text-xs mb-1" style={{ color: sub }}>{k.label}</div>
            <div className="font-bold text-base" style={{ color }}>{k.value}</div>
            <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

            {/* Objectifs assignés */}
            {objectifs.length > 0 && (
              <div>
                <h2 className="text-sm font-bold mb-3" style={{ color: text }}>🎯 Mes objectifs</h2>
                <div className="space-y-2">
                  {objectifs.slice(0, 2).map(obj => {
                    const cible = obj.cible_montant_smart || 0
                    const progression = cible > 0
                      ? Math.min(100, Math.round((totalSmart / cible) * 100)) : 0
                    return (
                      <div key={obj.id} className="rounded-2xl p-4" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm" style={{ color: text }}>{obj.titre}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                            {obj.type_periodicite}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full mb-1" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9' }}>
                          <div className="h-2 rounded-full transition-all"
                            style={{ width: `${progression}%`, backgroundColor: progression >= 100 ? '#22C55E' : '#2A4E94' }} />
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: sub }}>
                          <span>{totalSmart.toLocaleString()} F</span>
                          <span>{progression}% — objectif {cible.toLocaleString()} F</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Résumé mensuel */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: text }}>📊 Résumé du mois</h2>
              <div className="grid grid-cols-2 gap-3">
              {[
                  { label: 'Jours actifs', value: joursActifs, icon: '📅' },
                  { label: 'Comptes DAT', value: totalComptesDat, icon: '🏦' },
                  { label: 'Collecté (SMART)', value: totalSmart.toLocaleString() + ' F', icon: '💵' },
                  { label: 'Commissions', value: totalCommissions.toLocaleString() + ' F', icon: '💰' },
                  { label: 'Adhésions', value: totalAdhesions, icon: '👥' },
                  { label: 'Lydé Cash', value: totalLydeCash, icon: '📱' },
                  { label: 'Réactivations', value: totalReactivations, icon: '🔄' },
                  { label: 'Augm. mise', value: totalAugmentations, icon: '📈' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 rounded-xl"
                    style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{item.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: sub }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Classement agence */}
            {classement.length > 1 && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <h2 className="text-sm font-bold mb-4" style={{ color: text }}>
                  🏆 Classement — {agent?.agences?.nom}
                </h2>
                <div className="space-y-2">
                  {classement.slice(0, 5).map((a, i) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl"
                      style={{ backgroundColor: a.id === agent?.id ? (isDark ? '#1e3a5f' : '#EEF2FF') : 'transparent' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: i === 0 ? '#FEF9C3' : i === 1 ? '#F1F5F9' : i === 2 ? '#FEF2F2' : (isDark ? '#334155' : '#f8fafc'),
                          color: i === 0 ? '#854D0E' : i === 1 ? '#475569' : i === 2 ? '#991B1B' : sub
                        }}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: a.id === agent?.id ? '#2A4E94' : text }}>
                          {a.prenom} {a.nom} {a.id === agent?.id ? '(moi)' : ''}
                        </div>
                        <div className="text-xs" style={{ color: sub }}>{(a.score || 0).toLocaleString()} F</div>
                      </div>
                      {i === 0 && <span>🥇</span>}
                      {i === 1 && <span>🥈</span>}
                      {i === 2 && <span>🥉</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════ FICHES ════ */}
        {activeTab === 'fiches' && (
  <div className="space-y-4">
    <h2 className="text-sm font-bold" style={{ color: text }}>📋 Mes fiches</h2>

    {/* Stats rapides */}
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: 'Total', value: fiches.length, color: '#2A4E94', bg: '#EEF2FF' },
        { label: 'Validées', value: fiches.filter(f => f.statut_validation === 'validee').length, color: '#166534', bg: '#F0FDF4' },
        { label: 'Rejetées', value: fiches.filter(f => f.statut_validation === 'rejetee').length, color: '#991B1B', bg: '#FEF2F2' },
        { label: 'En attente', value: fiches.filter(f => !f.statut_validation || f.statut_validation === 'en_attente').length, color: '#854D0E', bg: '#FEF9C3' },
      ].map(s => (
        <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: s.bg }}>
          <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
          <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Filtres */}
    <div className="flex gap-2 flex-wrap">
      {[{ key: 'semaine', label: '7 jours' }, { key: 'mois', label: 'Ce mois' }, { key: 'annee', label: 'Cette année' }].map(p => (
        <button key={p.key} type="button" onClick={() => setFichesPeriode(p.key as any)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ backgroundColor: fichesPeriode === p.key ? '#2A4E94' : (isDark ? '#334155' : '#f1f5f9'), color: fichesPeriode === p.key ? 'white' : sub }}>
          {p.label}
        </button>
      ))}
    </div>

    {/* Liste */}
    {fichesFiltrees.length === 0 ? (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
        <div className="text-4xl mb-3">📭</div>
        <div className="font-medium text-sm" style={{ color: text }}>Aucune fiche</div>
      </div>
    ) : (
      <div className="space-y-3">
        {fichesFiltrees.map(fiche => {
          const statutColor = fiche.statut_validation === 'validee'
            ? { bg: '#DCFCE7', color: '#166534', label: '✅ Validée' }
            : fiche.statut_validation === 'rejetee'
            ? { bg: '#FEE2E2', color: '#991B1B', label: '❌ Rejetée' }
            : fiche.statut_validation === 'a_corriger'
            ? { bg: '#FEF9C3', color: '#854D0E', label: '🔄 À corriger' }
            : { bg: '#EEF2FF', color: '#2A4E94', label: '⏳ En attente' }
          return (
            <div key={fiche.id} className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              {/* Résumé cliquable */}
              <button type="button"
                onClick={() => setSelectedFicheAgent(selectedFicheAgent?.id === fiche.id ? null : fiche)}
                className="w-full p-4 text-left">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: text }}>
                      {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: sub }}>
                      SMART {(fiche.montant_smart ?? fiche.montant_mobilise ?? 0).toLocaleString()} F
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: statutColor.bg, color: statutColor.color }}>
                      {statutColor.label}
                    </span>
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

                {/* Mini stats */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'SMART', value: ((fiche.montant_smart ?? fiche.montant_mobilise ?? 0) / 1000).toFixed(0) + 'k' },
                    { label: 'Caisse', value: ((fiche.montant_caisse ?? fiche.montant_rapporte ?? 0) / 1000).toFixed(0) + 'k' },
                    { label: 'Réact.', value: fiche.reactivations?.length || 0 },
                    { label: 'Augm.', value: fiche.augmentations_mise?.length || 0 },
                  ].map(k => (
                    <div key={k.label} className="text-center p-1.5 rounded-lg"
                      style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                      <div className="font-bold text-xs" style={{ color: '#2A4E94' }}>{k.value}</div>
                      <div style={{ fontSize: '9px', color: sub }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs mt-2 text-right" style={{ color: sub }}>
                  {selectedFicheAgent?.id === fiche.id ? '▲ Réduire' : '▼ Voir détails'}
                </div>
              </button>

              {/* Détail complet */}
              {selectedFicheAgent?.id === fiche.id && (
                <div className="border-t" style={{ borderColor: border }}>
                  <FicheDetail fiche={fiche} isDark={isDark} />
                </div>
              )}

              {/* Bouton modifier */}
              {fiche.statut_validation !== 'validee' && (
                <div className="px-4 pb-4">
                  <button type="button"
                    onClick={() => router.push(`/dashboard/agent/fiche?edit=${fiche.id}`)}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                    ✏️ Modifier cette fiche
                  </button>
                </div>
              )}



            </div>
          )
        })}
      </div>
    )}
  </div>
)}

        {/* ════ MANQUANTS ════ */}
{/* ════ ÉCARTS ════ */}
{activeTab === 'manquants' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>⚖️ Mes écarts</h2>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
            {[
                { label: 'Manquants restants', value: ecartsNonRegles.filter(f => getEcart(f) > 0).reduce((s, f) => s + getRestant(f), 0).toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                { label: 'Surplus restants', value: ecartsNonRegles.filter(f => getEcart(f) < 0).reduce((s, f) => s + getRestant(f), 0).toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                { label: 'Régularisé', value: ecartsListe.reduce((s, f) => s + (f.montant_regularise || 0), 0).toLocaleString() + ' F', color: '#166534', bg: '#F0FDF4' },
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
                <div className="text-xs mt-1" style={{ color: sub }}>Vos comptes sont parfaitement équilibrés 🎉</div>
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
                      style={{
                        backgroundColor: card,
                        border: `1px solid ${regle ? '#BBF7D0' : isManquant ? '#FECACA' : '#C7D2FE'}`
                      }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
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

                      {fiche.commentaire_chef && (
                        <div className="mt-2 p-2 rounded-xl" style={{ backgroundColor: '#F0FDF4' }}>
                          <p className="text-xs" style={{ color: '#166534' }}>💬 {fiche.commentaire_chef}</p>
                        </div>
                      )}

                      {/* Historique des régularisations */}
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
                        <EcartHistorique
                          ficheId={fiche.id}
                          ecartTotal={montant}
                          montantRegularise={fiche.montant_regularise || 0}
                          isManquant={isManquant}
                          isDark={isDark}
                        />
                      </div>

                      {!regle && getRestant(fiche) > 0 && (
                        <div className="mt-3 text-xs p-3 rounded-xl"
                          style={{
                            backgroundColor: isManquant ? '#FEF9C3' : '#EEF2FF',
                            color: isManquant ? '#854D0E' : '#2A4E94'
                          }}>
                          {isManquant
                            ? '⏳ Restant à régulariser auprès de la caisse'
                            : '⏳ Restant à reverser au client'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ PERFORMANCE ════ */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>📈 Mes performances</h2>

            {/* Indicateurs mois */}
            <div className="space-y-3">
            {[
                { titre: 'Taux de conformité', valeur: tauxConformite, objectif: 100, icon: '🎯', color: '#2A4E94' },
                { titre: 'Régularité', valeur: tauxRegularite, objectif: 100, icon: '📅', color: '#166534' },
                { titre: 'Score mensuel', valeur: scoreMensuel, objectif: 100, icon: '⭐', color: '#854D0E' },
              ].map(ind => {
                const atteint = ind.valeur >= ind.objectif
                const partiel = ind.valeur >= ind.objectif * 0.5
                const barColor = atteint ? '#22C55E' : partiel ? '#EAB308' : '#EF4444'
                const textC = atteint ? '#166534' : partiel ? '#854D0E' : '#991B1B'
                return (
                  <div key={ind.titre} className="rounded-2xl p-4" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ind.icon}</span>
                        <span className="font-semibold text-sm" style={{ color: text }}>{ind.titre}</span>
                      </div>
                      <span className="font-bold text-2xl" style={{ color: textC }}>{ind.valeur}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9' }}>
                      <div className="h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(ind.valeur, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: sub }}>
                      <span>{ind.valeur}%</span>
                      <span>Objectif : {ind.objectif}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Graphique 7 jours */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: text }}>📊 Collecte — 7 derniers jours</h3>
              {sept7Jours.every(d => d.montant === 0) ? (
                <div className="text-center py-6 text-sm" style={{ color: sub }}>Aucune donnée cette semaine</div>
              ) : (
                <div className="flex items-end gap-2 h-28">
                  {sept7Jours.map((d, i) => {
                    const maxVal = Math.max(...sept7Jours.map(x => x.montant), 1)
                    const pct = Math.max(4, (d.montant / maxVal) * 100)
                    const isToday = d.jour === new Date().toLocaleDateString('fr-FR', { weekday: 'short' })
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        {d.montant > 0 && (
                          <div className="text-xs font-medium" style={{ color: '#2A4E94' }}>
                            {(d.montant / 1000).toFixed(0)}k
                          </div>
                        )}
                        <div className="w-full rounded-t-lg"
                          style={{ height: `${pct}%`, backgroundColor: isToday ? '#E4322C' : '#2A4E94', opacity: d.montant === 0 ? 0.2 : 1 }} />
                        <div className="text-xs" style={{ color: sub }}>{d.jour}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Graphique comptes 7 jours */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: text }}>🏦 Comptes ouverts — 7 jours</h3>
              <div className="flex items-end gap-2 h-24">
                {sept7Jours.map((d, i) => {
                  const maxVal = Math.max(...sept7Jours.map(x => x.comptes), 1)
                  const pct = Math.max(4, (d.comptes / maxVal) * 100)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {d.comptes > 0 && (
                        <div className="text-xs font-medium" style={{ color: '#166534' }}>{d.comptes}</div>
                      )}
                      <div className="w-full rounded-t-lg"
                        style={{ height: `${pct}%`, backgroundColor: '#22C55E', opacity: d.comptes === 0 ? 0.2 : 1 }} />
                      <div className="text-xs" style={{ color: sub }}>{d.jour}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Radar simplifié */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: text }}>🎯 Radar performance mensuelle</h3>
              <div className="space-y-3">
              {[
                  { label: 'Conformité caisse', value: tauxConformite, max: 100 },
                  { label: 'Comptes DAT', value: joursActifs > 0 ? Math.min(100, Math.round((totalComptesDat / (joursActifs * 6)) * 100)) : 0, max: 100 },
                  { label: 'Adhésions', value: joursActifs > 0 ? Math.min(100, Math.round((totalAdhesions / (joursActifs * 5)) * 100)) : 0, max: 100 },
                  { label: 'Régularité', value: tauxRegularite, max: 100 },
                ].map(r => {
                  const color = r.value >= 80 ? '#22C55E' : r.value >= 50 ? '#EAB308' : '#EF4444'
                  return (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: text }}>{r.label}</span>
                        <span className="font-bold" style={{ color }}>{r.value}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9' }}>
                        <div className="h-2.5 rounded-full transition-all"
                          style={{ width: `${r.value}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comparaison mois précédent */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-3" style={{ color: text }}>📅 Ce mois vs mois précédent</h3>
              {(() => {
                const now = new Date()
                const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
                const fichesPrev = fiches.filter(f => new Date(f.date) >= prevStart && new Date(f.date) <= prevEnd)
                const collectePrev = fichesPrev.reduce((s, f) => s + (f.montant_smart ?? f.montant_mobilise ?? 0), 0)
                const diff = totalCollecte - collectePrev
                const pct = collectePrev > 0 ? Math.round((diff / collectePrev) * 100) : 0
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                      <div className="text-xs mb-1" style={{ color: sub }}>Mois précédent</div>
                      <div className="font-bold" style={{ color: text }}>{collectePrev.toLocaleString()} F</div>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                      <div className="text-xs mb-1" style={{ color: sub }}>Ce mois</div>
                      <div className="font-bold" style={{ color: text }}>{totalCollecte.toLocaleString()} F</div>
                    </div>
                    <div className="col-span-2 rounded-xl p-3 text-center"
                      style={{ backgroundColor: diff >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
                      <div className="font-bold text-lg" style={{ color: diff >= 0 ? '#166534' : '#991B1B' }}>
                        {diff >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
                      </div>
                      <div className="text-xs" style={{ color: diff >= 0 ? '#166534' : '#991B1B' }}>
                        {diff >= 0 ? 'Progression' : 'Régression'} vs mois dernier
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ════ MESSAGES ════ */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>💬 Messagerie</h2>

            {contacts.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">💬</div>
                <div className="font-medium text-sm" style={{ color: text }}>Aucun contact disponible</div>
                <div className="text-xs mt-1" style={{ color: sub }}>Votre chef ou responsable n&apos;est pas encore configuré</div>
              </div>
            ) : !selectedContact ? (
              <div className="space-y-2">
                {contacts.map(contact => {
                  const msgsContact = messages.filter(m =>
                    (m.expediteur_id === agent?.id && m.destinataire_id === contact.id) ||
                    (m.expediteur_id === contact.id && m.destinataire_id === agent?.id)
                  )
                  const lastMsg = msgsContact[msgsContact.length - 1]
                  const nonLus = messages.filter(m => m.expediteur_id === contact.id && m.destinataire_id === agent?.id && !m.lu).length
                  return (
                    <button key={contact.id} type="button"
                      onClick={() => setSelectedContact(contact)}
                      className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
                      style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shrink-0"
                        style={{ backgroundColor: '#2A4E94' }}>
                        {contact.prenom?.[0]}{contact.nom?.[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {contact.prenom} {contact.nom}
                          </div>
                          {nonLus > 0 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: '#E4322C' }}>{nonLus}</span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: sub }}>{contact.role}</div>
                        {lastMsg && (
                          <div className="text-xs mt-0.5 truncate" style={{ color: sub }}>
                            {lastMsg.expediteur_id === agent?.id ? 'Vous: ' : ''}{lastMsg.contenu}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
                {/* Header conv */}
                <div className="flex items-center gap-3 p-4 rounded-2xl mb-3"
                  style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                  <button type="button" onClick={() => setSelectedContact(null)}
                    className="p-1.5 rounded-lg" style={{ backgroundColor: isDark ? '#334155' : '#f1f5f9', color: sub }}>←</button>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
                    style={{ backgroundColor: '#2A4E94' }}>
                    {selectedContact.prenom?.[0]}{selectedContact.nom?.[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: text }}>{selectedContact.prenom} {selectedContact.nom}</div>
                    <div className="text-xs" style={{ color: sub }}>{selectedContact.role}</div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-1">
                  {messagesConv.length === 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: sub }}>
                      Démarrez la conversation 👋
                    </div>
                  )}
                  {messagesConv.map(msg => {
                    const isMine = msg.expediteur_id === agent?.id
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-xs px-4 py-2.5 rounded-2xl"
                          style={{
                            backgroundColor: isMine ? '#2A4E94' : (isDark ? '#334155' : '#f1f5f9'),
                            color: isMine ? 'white' : text,
                            borderBottomRightRadius: isMine ? '4px' : undefined,
                            borderBottomLeftRadius: !isMine ? '4px' : undefined,
                          }}>
                          <p className="text-sm">{msg.contenu}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <input type="text" value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
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

            {/* Avatar + infos */}
            <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl text-white mx-auto mb-3"
                style={{ backgroundColor: '#2A4E94' }}>
                {agent?.prenom?.[0]}{agent?.nom?.[0]}
              </div>
              <div className="font-bold text-lg" style={{ color: text }}>{agent?.prenom} {agent?.nom}</div>
              <div className="text-sm mt-0.5" style={{ color: sub }}>{agent?.email}</div>
              <div className="flex gap-2 justify-center mt-2">
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>{agent?.role}</span>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>{agent?.agences?.nom || '—'}</span>
              </div>
            </div>

            {/* Éditer profil */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>✏️ Informations personnelles</h3>
              {profilSuccess && (
                <div className="mb-3 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                  ✅ Profil mis à jour
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Prénom</label>
                    <input type="text" value={profilForm.prenom}
                      onChange={e => setProfilForm(p => ({ ...p, prenom: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Nom</label>
                    <input type="text" value={profilForm.nom}
                      onChange={e => setProfilForm(p => ({ ...p, nom: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Téléphone</label>
                  <input type="tel" value={profilForm.telephone}
                    onChange={e => setProfilForm(p => ({ ...p, telephone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }}
                    placeholder="+228 9X XX XX XX" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Agence</label>
                  <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: sub }}>
                    {agent?.agences?.nom || '—'} — non modifiable
                  </div>
                </div>
                <button type="button" onClick={saveProfilForm} disabled={profilSaving}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ backgroundColor: profilSaving ? '#818387' : '#2A4E94' }}>
                  {profilSaving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🔐 Sécurité</h3>
              {pwdSuccess && (
                <div className="mb-3 p-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                  ✅ Mot de passe modifié
                </div>
              )}
              {!showChangePwd ? (
                <button type="button" onClick={() => setShowChangePwd(true)}
                  className="w-full py-3 rounded-xl text-sm font-semibold border"
                  style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: '#2A4E94', backgroundColor: 'transparent' }}>
                  🔑 Changer le mot de passe
                </button>
              ) : (
                <div className="space-y-3">
                  {pwdError && (
                    <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                      ❌ {pwdError}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Nouveau mot de passe</label>
                    <input type="password" value={pwdForm.nouveau}
                      onChange={e => setPwdForm(p => ({ ...p, nouveau: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }}
                      placeholder="Min. 8 caractères" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: text }}>Confirmer</label>
                    <input type="password" value={pwdForm.confirmer}
                      onChange={e => setPwdForm(p => ({ ...p, confirmer: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : 'white', color: text }}
                      placeholder="Répétez le mot de passe" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowChangePwd(false); setPwdError('') }}
                      className="flex-1 py-2.5 rounded-xl text-sm border"
                      style={{ borderColor: isDark ? '#334155' : '#e2e8f0', color: sub }}>Annuler</button>
                    <button type="button" onClick={changePassword} disabled={pwdSaving}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ backgroundColor: pwdSaving ? '#818387' : '#2A4E94' }}>
                      {pwdSaving ? '...' : 'Modifier'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Thème */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🎨 Apparence</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: text }}>Mode sombre</div>
                  <div className="text-xs" style={{ color: sub }}>Thème {theme === 'dark' ? 'sombre actif' : 'clair actif'}</div>
                </div>
                <button type="button" onClick={toggleTheme}
                  className="relative w-12 h-6 rounded-full transition-all"
                  style={{ backgroundColor: theme === 'dark' ? '#2A4E94' : '#e2e8f0' }}>
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                    style={{ left: theme === 'dark' ? '26px' : '2px' }} />
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🔔 Notifications</h3>
              <div className="space-y-3">
                {[
                  { key: 'notif_validation', label: 'Validation de fiche', desc: 'Quand votre fiche est validée ou rejetée' },
                  { key: 'notif_rappel', label: 'Rappels', desc: 'Rappel si fiche non soumise' },
                  { key: 'notif_objectif', label: 'Objectifs', desc: 'Quand un objectif est atteint' },
                  { key: 'notif_message', label: 'Messages', desc: 'Nouveaux messages du chef' },
                ].map(pref => (
                  <div key={pref.key} className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: border }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: text }}>{pref.label}</div>
                      <div className="text-xs" style={{ color: sub }}>{pref.desc}</div>
                    </div>
                    <button type="button"
                      onClick={() => saveNotifPrefs(pref.key, !(notifPrefs as any)[pref.key])}
                      className="relative w-11 h-6 rounded-full transition-all shrink-0"
                      style={{ backgroundColor: (notifPrefs as any)[pref.key] ? '#2A4E94' : '#e2e8f0' }}>
                      <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm"
                        style={{ left: (notifPrefs as any)[pref.key] ? '23px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Infos compte */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: '#2A4E94' }}>🏦 Mon compte PADES</h3>
              <div className="space-y-2">
                {[
                  { label: 'Agence', value: agent?.agences?.nom || '—' },
                  { label: 'Équipe', value: agent?.equipes?.nom || '—' },
                  { label: 'Statut', value: agent?.actif ? '✅ Actif' : '❌ Inactif' },
                  { label: 'Membre depuis', value: new Date(agent?.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                  { label: 'Fiches soumises', value: fiches.length },
                  { label: 'Streak actuel', value: `🔥 ${streak} jour(s)` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b last:border-0"
                    style={{ borderColor: border }}>
                    <span className="text-xs" style={{ color: sub }}>{item.label}</span>
                    <span className="text-xs font-medium" style={{ color: text }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Déconnexion */}
            <button type="button" onClick={handleLogout}
              className="w-full py-3 rounded-2xl text-sm font-semibold border-2"
              style={{ borderColor: '#E4322C', color: '#E4322C', backgroundColor: 'transparent' }}>
              Se déconnecter
            </button>
          </div>
        )}

      </div>

      {/* ── NAVIGATION MOBILE BAS ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t shadow-lg"
        style={{ backgroundColor: card, borderColor: border }}>
        <div className="max-w-2xl mx-auto flex">
          {[
            { key: 'accueil', label: 'Accueil', icon: '🏠' },
            { key: 'fiches', label: 'Fiches', icon: '📋' },
            { key: 'manquants', label: 'Écarts', icon: '⚖️', badge: ecartsNonRegles.length },
            { key: 'performance', label: 'Stats', icon: '📈' },
            { key: 'messages', label: 'Messages', icon: '💬', badge: messagesNonLus },
            { key: 'profil', label: 'Profil', icon: '👤' },
          ].map(t => (
            <button key={t.key} type="button"
              onClick={() => setActiveTab(t.key as ActiveTab)}
              className="flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-all relative">
              <span className="text-xl mb-0.5">{t.icon}</span>
              <span style={{ color: activeTab === t.key ? '#2A4E94' : sub }}>{t.label}</span>
              {t.badge && t.badge > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#E4322C', fontSize: '10px' }}>
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
              {activeTab === t.key && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ backgroundColor: '#2A4E94' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Padding bas */}
      <div className="h-20" />

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