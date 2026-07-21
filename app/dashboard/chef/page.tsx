'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FicheDetail from '@/components/FicheDetail'

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
  const [objectifs, setObjectifs] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [classement, setClassement] = useState<any[]>([])
  const [mesZones, setMesZones] = useState<any[]>([])

  // Équipe (données chef)
  const [equipeInfo, setEquipeInfo] = useState<any>(null)
  const [equipeMembers, setEquipeMembers] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [memberFiches, setMemberFiches] = useState<any[]>([])
  const [memberLoadingFiches, setMemberLoadingFiches] = useState(false)
  const [equipeStats, setEquipeStats] = useState({
    totalComptes: 0, totalCollecte: 0, totalManquants: 0, fichesNonValidees: 0
  })

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
        (p) => { if (p.new.destinataire_id === agent.id) loadMessages(agent.id) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiches_journalieres' },
        (p) => {
          if (p.new.agent_id === agent.id) {
            setFiches(prev => prev.map(f => f.id === p.new.id ? { ...f, ...p.new } : f))
            if (ficheDuJour?.id === p.new.id) setFicheDuJour((prev: any) => ({ ...prev, ...p.new }))
          }
          // Mettre à jour les fiches du membre sélectionné
          if (selectedMember && p.new.agent_id === selectedMember.id) {
            setMemberFiches(prev => prev.map(f => f.id === p.new.id ? { ...f, ...p.new } : f))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agent, selectedMember])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: a } = await supabase
      .from('agents')
      .select('*, agences(nom), equipes!agents_equipe_id_fkey(id, nom, chef_id)')
      .eq('user_id', user.id).single()
    if (!a) { router.push('/login'); return }
    if (a.role !== 'chef') { router.push('/dashboard/agent'); return }
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
      loadEquipe(a),
    ])
    setLoading(false)
  }

  async function loadFiches(agentId: string) {
    const { data: fiche } = await supabase.from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', agentId).eq('date', today).maybeSingle()
    setFicheDuJour(fiche)
    const { data: all } = await supabase.from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', agentId).order('date', { ascending: false })
    setFiches(all || [])
  }

  async function loadObjectifs(a: any) {
    const { data } = await supabase.from('objectifs').select('*')
      .or(`agent_id.eq.${a.id},equipe_id.eq.${a.equipe_id || 'null'},agence_id.eq.${a.agence_id || 'null'},type_cible.eq.global`)
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

  async function loadMesZones(agentId: string) {
    const { data } = await supabase.from('agent_zones')
      .select('zone_id, zones(id, numero, nom)').eq('agent_id', agentId)
    setMesZones(data || [])
  }

  async function loadClassement(a: any) {
    if (!a.agence_id) return
    const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const { data: agentsAgence } = await supabase.from('agents')
      .select('id, nom, prenom').eq('agence_id', a.agence_id).eq('statut', 'actif').eq('role', 'agent')
    if (!agentsAgence?.length) return
    const { data: fichesMois } = await supabase.from('fiches_journalieres')
      .select('agent_id, montant_mobilise').gte('date', moisDebut)
      .in('agent_id', agentsAgence.map(ag => ag.id))
    const scores: Record<string, number> = {}
    ;(fichesMois || []).forEach(f => { scores[f.agent_id] = (scores[f.agent_id] || 0) + (f.montant_mobilise || 0) })
    setClassement(agentsAgence.map(ag => ({ ...ag, score: scores[ag.id] || 0 })).sort((a, b) => b.score - a.score))
  }

  async function loadEquipe(a: any) {
    if (!a.equipe_id) return
    // Info équipe
    const { data: eq } = await supabase.from('equipes')
      .select('*, agences(nom)').eq('id', a.equipe_id).single()
    setEquipeInfo(eq)

    // Membres (sans le chef lui-même)
    const { data: members } = await supabase.from('agents')
      .select('*, agences(nom)').eq('equipe_id', a.equipe_id).neq('id', a.id)
    setEquipeMembers(members || [])

    // Stats équipe ce mois
    const moisDebut = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const allMemberIds = [...(members || []).map(m => m.id), a.id]
    if (allMemberIds.length > 0) {
      const { data: fichesMois } = await supabase.from('fiches_journalieres')
        .select('*').gte('date', moisDebut).in('agent_id', allMemberIds)
      const totalComptes = (fichesMois || []).reduce((s, f) => s + (f.comptes_ouverts || 0), 0)
      const totalCollecte = (fichesMois || []).reduce((s, f) => s + (f.montant_mobilise || 0), 0)
      const { data: manqs } = await supabase.from('fiches_journalieres')
        .select('montant_mobilise, montant_rapporte').eq('manquant_regle', false).in('agent_id', allMemberIds)
      const totalManquants = (manqs || []).reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
      const { count: fichesNonValidees } = await supabase.from('fiches_journalieres')
        .select('*', { count: 'exact', head: true }).eq('valide_chef', false).in('agent_id', allMemberIds)
      setEquipeStats({ totalComptes, totalCollecte, totalManquants, fichesNonValidees: fichesNonValidees || 0 })
    }
  }

  async function selectMember(member: any) {
    setSelectedMember(member)
    setMemberLoadingFiches(true)
    const { data } = await supabase.from('fiches_journalieres')
      .select('*, reactivations(*), augmentations_mise(*), assurances_details(*)')
      .eq('agent_id', member.id)
      .order('date', { ascending: false }).limit(15)
    setMemberFiches(data || [])
    setMemberLoadingFiches(false)
  }

  async function validerFicheChef(ficheId: string, statut: string, commentaire?: string) {
    await supabase.from('fiches_journalieres').update({
      valide_chef: statut === 'validee',
      statut_validation: statut,
      commentaire_chef: commentaire || null,
      valide_par: agent?.id || null,
    }).eq('id', ficheId)

    // Notification à l'agent
    const fiche = memberFiches.find(f => f.id === ficheId)
    if (fiche) {
      const titres: Record<string, string> = {
        validee: '✅ Fiche validée', rejetee: '❌ Fiche rejetée', a_corriger: '🔄 Fiche à corriger'
      }
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

    setMemberFiches(prev => prev.map(f => f.id === ficheId
      ? { ...f, valide_chef: statut === 'validee', statut_validation: statut, commentaire_chef: commentaire || null } : f))
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

  // ── Calculs agent ──
  const fichesMois = fiches.filter(f => new Date(f.date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const totalComptes = fichesMois.reduce((s, f) => s + (f.comptes_ouverts || 0), 0)
  const totalActives = fichesMois.reduce((s, f) => s + (f.comptes_actives || 0), 0)
  const totalCollecte = fichesMois.reduce((s, f) => s + (f.montant_mobilise || 0), 0)
  const totalRapporte = fichesMois.reduce((s, f) => s + (f.montant_rapporte || 0), 0)
  const totalProspects = fichesMois.reduce((s, f) => s + (f.prospects_visites || 0), 0)
  const joursActifs = fichesMois.length
  const tauxActivation = totalComptes > 0 ? Math.round((totalActives / totalComptes) * 100) : 0
  const tauxCollecte = totalCollecte > 0 ? Math.round((totalRapporte / totalCollecte) * 100) : 0
  const scoreMensuel = joursActifs > 0 ? Math.min(100, Math.round((totalComptes / (joursActifs * 6)) * 100)) : 0

  const streak = (() => {
    let count = 0; const now = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i)
      if (fiches.find(f => f.date === d.toISOString().split('T')[0])) count++
      else if (i > 0) break
    }
    return count
  })()

  const manquantsListe = fiches.filter(f => Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)) > 0)
  const manquantsNonRegles = manquantsListe.filter(f => !f.manquant_regle)
  const totalManquants = manquantsNonRegles.reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0)
  const monRang = classement.findIndex(a => a.id === agent?.id) + 1
  const notifNonLues = notifications.filter(n => !n.lu).length
  const messagesNonLus = messages.filter(m => m.destinataire_id === agent?.id && !m.lu).length

  const fichesFiltrees = (() => {
    let f = [...fiches]; const now = new Date()
    if (fichesPeriode === 'semaine') { const d = new Date(now); d.setDate(now.getDate() - 7); f = f.filter(x => new Date(x.date) >= d) }
    else if (fichesPeriode === 'mois') { f = f.filter(x => new Date(x.date) >= new Date(now.getFullYear(), now.getMonth(), 1)) }
    else { f = f.filter(x => new Date(x.date).getFullYear() === now.getFullYear()) }
    return f
  })()

  const sept7Jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const fiche = fiches.find(f => f.date === dateStr)
    return { jour: d.toLocaleDateString('fr-FR', { weekday: 'short' }), montant: fiche?.montant_mobilise || 0, comptes: fiche?.comptes_ouverts || 0 }
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
              onClick={() => { setShowNotifPanel(!showNotifPanel); if (notifNonLues > 0) marquerNotifsLues() }}
              className="relative p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <span className="text-lg">🔔</span>
              {notifNonLues > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#E4322C' }}>
                  {notifNonLues > 9 ? '9+' : notifNonLues}
                </span>
              )}
            </button>
            {equipeStats.fichesNonValidees > 0 && (
              <button type="button" onClick={() => setActiveTab('equipe')}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: '#EAB308', color: 'white' }}>
                📋 {equipeStats.fichesNonValidees} à valider
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
            {/* Hero */}
            <div className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg, #2A4E94, #1e3a6e)', color: 'white' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm opacity-75">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="text-xl font-bold mt-0.5">Bonjour, {agent?.prenom} 👋</h1>
                  {equipeInfo && (
                    <p className="text-xs mt-1 opacity-75">Chef — {equipeInfo.nom}</p>
                  )}
                </div>
                {streak > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <span className="text-lg">🔥</span>
                    <span className="font-bold text-sm">{streak}j</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: 'Mon activation', value: `${tauxActivation}%`, icon: '🎯' },
                  { label: 'Ma collecte', value: `${tauxCollecte}%`, icon: '💰' },
                  { label: 'Mon score', value: `${scoreMensuel}%`, icon: '⭐' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="font-bold text-lg">{s.value}</div>
                    <div className="text-xs opacity-75">{s.label}</div>
                  </div>
                ))}
              </div>

              {monRang > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <span className="text-lg">🏆</span>
                  <span className="text-sm font-medium">
                    {monRang === 1 ? '1er' : `${monRang}ème`} — {agent?.agences?.nom}
                  </span>
                </div>
              )}
            </div>

            {/* Stats équipe rapide */}
            {equipeInfo && (
              <div className="rounded-2xl p-4"
                style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold" style={{ color: text }}>
                    👥 {equipeInfo.nom} — Ce mois
                  </h2>
                  <button type="button" onClick={() => setActiveTab('equipe')}
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                    Voir →
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Membres', value: equipeMembers.length + 1, icon: '👤', color: '#2A4E94' },
                    { label: 'Comptes', value: equipeStats.totalComptes, icon: '🏦', color: '#166534' },
                    { label: 'Collecté', value: (equipeStats.totalCollecte / 1000).toFixed(0) + 'k F', icon: '💰', color: '#854D0E' },
                    { label: 'À valider', value: equipeStats.fichesNonValidees, icon: '📋', color: equipeStats.fichesNonValidees > 0 ? '#991B1B' : '#166534' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-xl"
                      style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                      <div className="text-lg mb-0.5">{s.icon}</div>
                      <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs" style={{ color: sub }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {equipeStats.fichesNonValidees > 0 && (
                  <button type="button" onClick={() => setActiveTab('equipe')}
                    className="mt-3 w-full py-2 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                    ⚠️ {equipeStats.fichesNonValidees} fiche(s) en attente de validation
                  </button>
                )}
              </div>
            )}

            {/* Équipe + Zones */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: '#FEF9C3' }}>👨‍💼</div>
                <div>
                  <div className="text-xs" style={{ color: sub }}>Chef de</div>
                  <div className="font-bold text-sm mt-0.5" style={{ color: '#854D0E' }}>
                    {equipeInfo?.nom || '—'}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block"
                    style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                    {equipeMembers.length} membre(s)
                  </span>
                </div>
              </div>
              <div className="rounded-2xl p-4 flex items-start gap-3"
                style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: '#F0FDF4' }}>🗺️</div>
                <div className="flex-1">
                  <div className="text-xs mb-1" style={{ color: sub }}>Mes zones</div>
                  {mesZones.length === 0 ? (
                    <div className="text-xs italic" style={{ color: sub }}>Aucune zone</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {mesZones.map(az => (
                        <span key={az.zone_id} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                          Z{az.zones?.numero}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alerte manquants */}
            {totalManquants > 0 && (
              <button type="button" onClick={() => setActiveTab('manquants')}
                className="w-full rounded-2xl p-4 flex items-center justify-between text-left"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: '#FEE2E2' }}>⚠️</div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#991B1B' }}>
                      {manquantsNonRegles.length} manquant(s) non réglé(s)
                    </div>
                    <div className="text-xs" style={{ color: '#B91C1C' }}>{totalManquants.toLocaleString()} FCFA</div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>Voir →</span>
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
                    {ficheDuJour ? 'Fiche soumise ✅' : 'Ma fiche du jour'}
                  </div>
                  {ficheDuJour && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: ficheDuJour.statut_validation === 'validee' ? '#DCFCE7' :
                            ficheDuJour.statut_validation === 'rejetee' ? '#FEE2E2' :
                            ficheDuJour.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF',
                          color: ficheDuJour.statut_validation === 'validee' ? '#166534' :
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

            {/* Résumé mensuel perso */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: text }}>📊 Mon résumé du mois</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Jours actifs', value: joursActifs, icon: '📅' },
                  { label: 'Comptes ouverts', value: totalComptes, icon: '🏦' },
                  { label: 'Prospects visités', value: totalProspects, icon: '👥' },
                  { label: 'Montant collecté', value: totalCollecte.toLocaleString() + ' F', icon: '💵' },
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
          </>
        )}

        {/* ════ FICHES (propres fiches du chef) ════ */}
        {activeTab === 'fiches' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>📋 Mes fiches</h2>
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
                  const manq = Math.max(0, (fiche.montant_mobilise || 0) - (fiche.montant_rapporte || 0))
                  const statutColor = fiche.statut_validation === 'validee' ? { bg: '#DCFCE7', color: '#166534', label: '✅ Validée' } :
                    fiche.statut_validation === 'rejetee' ? { bg: '#FEE2E2', color: '#991B1B', label: '❌ Rejetée' } :
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
                          {manq > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: fiche.manquant_regle ? '#DCFCE7' : '#FEE2E2', color: fiche.manquant_regle ? '#166534' : '#991B1B' }}>
                              {fiche.manquant_regle ? '✅' : '⚠️'} {manq.toLocaleString()} F
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'Comptes', value: fiche.comptes_ouverts },
                          { label: 'Activés', value: fiche.comptes_actives },
                          { label: 'Collecté', value: `${(fiche.montant_mobilise || 0).toLocaleString()}F` },
                          { label: 'Prospects', value: fiche.prospects_visites },
                          { label: 'Dépôts', value: fiche.nb_depots },
                          { label: 'Clients', value: fiche.clients_suivis },
                        ].map(k => (
                          <div key={k.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                            <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value}</div>
                            <div className="text-xs" style={{ color: sub }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                      {fiche.commentaire_chef && (
                        <div className="rounded-xl p-3 flex items-start gap-2"
                          style={{ backgroundColor: fiche.statut_validation === 'validee' ? '#F0FDF4' : fiche.statut_validation === 'rejetee' ? '#FEF2F2' : '#FEF9C3' }}>
                          <span>💬</span>
                          <p className="text-xs" style={{ color: statutColor.color }}>{fiche.commentaire_chef}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ ÉQUIPE ════ */}
        {activeTab === 'equipe' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>
              👥 Mon équipe — {equipeInfo?.nom || '—'}
            </h2>

            {/* Stats équipe */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total collecté', value: equipeStats.totalCollecte.toLocaleString() + ' F', color: '#166534', bg: '#F0FDF4', icon: '💰' },
                { label: 'Comptes ouverts', value: equipeStats.totalComptes, color: '#2A4E94', bg: '#EEF2FF', icon: '🏦' },
                { label: 'Manquants', value: equipeStats.totalManquants.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2', icon: '⚠️' },
                { label: 'Fiches à valider', value: equipeStats.fichesNonValidees, color: '#854D0E', bg: '#FEF9C3', icon: '📋' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: s.bg }}>
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs" style={{ color: s.color, opacity: 0.8 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Membres */}
            {equipeMembers.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">👥</div>
                <div className="font-medium text-sm" style={{ color: text }}>Aucun membre dans votre équipe</div>
              </div>
            ) : (
              <div className="space-y-3">
                {equipeMembers.map(member => {
                  const isSelected = selectedMember?.id === member.id
                  return (
                    <div key={member.id}>
                      {/* Card membre */}
                      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: card, border: `1px solid ${isSelected ? '#2A4E94' : border}`, boxShadow: isSelected ? '0 0 0 2px #2A4E94' : undefined }}>
                        <button type="button"
                          onClick={() => isSelected ? setSelectedMember(null) : selectMember(member)}
                          className="w-full p-4 flex items-center gap-3 text-left">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                            style={{ backgroundColor: '#2A4E94' }}>
                            {member.prenom?.[0]}{member.nom?.[0]}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm" style={{ color: text }}>{member.prenom} {member.nom}</div>
                            <div className="text-xs" style={{ color: sub }}>{member.telephone || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: member.statut === 'actif' ? '#DCFCE7' : '#FEE2E2', color: member.statut === 'actif' ? '#166534' : '#991B1B' }}>
                              {member.statut === 'actif' ? '✅' : '❌'}
                            </span>
                            <span className="text-sm" style={{ color: sub }}>{isSelected ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {/* Fiches du membre */}
                        {isSelected && (
                          <div className="border-t px-4 pb-4" style={{ borderColor: border }}>
                            <div className="pt-3 mb-3">
                              <h4 className="text-xs font-semibold" style={{ color: sub }}>FICHES DE {member.prenom?.toUpperCase()}</h4>
                            </div>

                            {memberLoadingFiches ? (
                              <div className="text-center py-4 text-sm" style={{ color: sub }}>Chargement...</div>
                            ) : memberFiches.length === 0 ? (
                              <div className="text-center py-4 text-sm" style={{ color: sub }}>Aucune fiche soumise</div>
                            ) : (
                              <div className="space-y-2">
                                {/* Stats rapides membre */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  {[
                                    { label: 'Comptes (mois)', value: memberFiches.filter(f => new Date(f.date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).reduce((s, f) => s + (f.comptes_ouverts || 0), 0) },
                                    { label: 'Collecte (mois)', value: (memberFiches.filter(f => new Date(f.date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).reduce((s, f) => s + (f.montant_mobilise || 0), 0) / 1000).toFixed(0) + 'k F' },
                                    { label: 'Fiches total', value: memberFiches.length },
                                  ].map(k => (
                                    <div key={k.label} className="text-center p-2 rounded-xl" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                                      <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value}</div>
                                      <div className="text-xs" style={{ color: sub }}>{k.label}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Liste fiches */}
                                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
                                  {memberFiches.map(f => {
                                    const manq = Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0))
                                    const peutValider = !f.statut_validation || f.statut_validation === 'en_attente' || f.statut_validation === 'a_corriger'
                                    return (
                                      <div key={f.id} className="rounded-xl p-3 border"
                                        style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: border }}>
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <div className="text-xs font-medium" style={{ color: text }}>
                                              {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </div>
                                            <div className="text-xs" style={{ color: sub }}>
                                              {f.comptes_ouverts} comptes · {(f.montant_mobilise || 0).toLocaleString()} F
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                              style={{
                                                backgroundColor: f.statut_validation === 'validee' ? '#DCFCE7' :
                                                  f.statut_validation === 'rejetee' ? '#FEE2E2' :
                                                  f.statut_validation === 'a_corriger' ? '#FEF9C3' : '#EEF2FF',
                                                color: f.statut_validation === 'validee' ? '#166534' :
                                                  f.statut_validation === 'rejetee' ? '#991B1B' :
                                                  f.statut_validation === 'a_corriger' ? '#854D0E' : '#2A4E94'
                                              }}>
                                              {f.statut_validation === 'validee' ? '✅' : f.statut_validation === 'rejetee' ? '❌' : f.statut_validation === 'a_corriger' ? '🔄' : '⏳'}
                                            </span>
                                            {manq > 0 && (
                                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ backgroundColor: f.manquant_regle ? '#DCFCE7' : '#FEE2E2', color: f.manquant_regle ? '#166534' : '#991B1B' }}>
                                                ⚠️ {manq.toLocaleString()} F
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Détails */}
                                        <div className="grid grid-cols-4 gap-1 mb-2">
                                          {[
                                            { label: 'Activés', value: f.comptes_actives },
                                            { label: 'Dépôts', value: f.nb_depots },
                                            { label: 'Prospects', value: f.prospects_visites },
                                            { label: 'Clients', value: f.clients_suivis },
                                          ].map(k => (
                                            <div key={k.label} className="text-center">
                                              <div className="text-xs font-semibold" style={{ color: '#2A4E94' }}>{k.value}</div>
                                              <div style={{ fontSize: '10px', color: sub }}>{k.label}</div>
                                            </div>
                                          ))}
                                        </div>

                                        {f.commentaire_chef && (
                                          <div className="mb-2 px-2 py-1 rounded-lg text-xs italic"
                                            style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: sub }}>
                                            💬 {f.commentaire_chef}
                                          </div>
                                        )}

                                        {peutValider && (
                                          <button type="button"
                                            onClick={() => { setValidationFiche(f); setValidationStatut('validee'); setValidationCommentaire(''); setShowValidationModal(true) }}
                                            className="w-full py-1.5 rounded-lg text-xs font-semibold"
                                            style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                                            ✅ Prendre une décision
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ MANQUANTS (propres manquants) ════ */}
        {activeTab === 'manquants' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold" style={{ color: text }}>⚠️ Mes manquants</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total', value: manquantsListe.reduce((s, f) => s + Math.max(0, (f.montant_mobilise || 0) - (f.montant_rapporte || 0)), 0).toLocaleString() + ' F', color: '#2A4E94', bg: '#EEF2FF' },
                { label: 'Non réglés', value: totalManquants.toLocaleString() + ' F', color: '#991B1B', bg: '#FEF2F2' },
                { label: 'Réglés', value: manquantsListe.filter(f => f.manquant_regle).length, color: '#166534', bg: '#F0FDF4' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: s.bg }}>
                  <div className="font-bold text-base" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>
            {manquantsListe.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="text-4xl mb-3">✅</div>
                <div className="font-medium text-sm" style={{ color: '#166534' }}>Aucun manquant !</div>
                <div className="text-xs mt-1" style={{ color: sub }}>Excellent travail 🎉</div>
              </div>
            ) : (
              <div className="space-y-3">
                {manquantsListe.map(fiche => {
                  const montant = Math.max(0, (fiche.montant_mobilise || 0) - (fiche.montant_rapporte || 0))
                  return (
                    <div key={fiche.id} className="rounded-2xl p-4" style={{ backgroundColor: card, border: `1px solid ${fiche.manquant_regle ? '#BBF7D0' : '#FECACA'}` }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm" style={{ color: text }}>
                            {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                          </div>
                          <div className="font-bold text-xl mt-1" style={{ color: fiche.manquant_regle ? '#166534' : '#E4322C' }}>
                            {montant.toLocaleString()} FCFA
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ backgroundColor: fiche.manquant_regle ? '#DCFCE7' : '#FEE2E2', color: fiche.manquant_regle ? '#166534' : '#991B1B' }}>
                          {fiche.manquant_regle ? '✅ Réglé' : '⚠️ Non réglé'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl p-2" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                          <div className="text-xs" style={{ color: sub }}>Collecté</div>
                          <div className="font-semibold text-sm" style={{ color: text }}>{(fiche.montant_mobilise || 0).toLocaleString()} F</div>
                        </div>
                        <div className="rounded-xl p-2" style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
                          <div className="text-xs" style={{ color: sub }}>Rapporté</div>
                          <div className="font-semibold text-sm" style={{ color: text }}>{(fiche.montant_rapporte || 0).toLocaleString()} F</div>
                        </div>
                      </div>
                      {!fiche.manquant_regle && (
                        <div className="mt-3 text-xs p-3 rounded-xl" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>
                          ⏳ En attente de confirmation par le responsable
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
            <div className="space-y-3">
              {[
                { titre: "Taux d'activation", valeur: tauxActivation, objectif: 70, icon: '🎯' },
                { titre: 'Taux de collecte', valeur: tauxCollecte, objectif: 100, icon: '💰' },
                { titre: 'Score mensuel', valeur: scoreMensuel, objectif: 100, icon: '⭐' },
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
                      <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(ind.valeur, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: sub }}>
                      <span>{ind.valeur}%</span>
                      <span>Objectif : {ind.objectif}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: text }}>📊 Collecte — 7 derniers jours</h3>
              <div className="flex items-end gap-2 h-28">
                {sept7Jours.map((d, i) => {
                  const maxVal = Math.max(...sept7Jours.map(x => x.montant), 1)
                  const pct = Math.max(4, (d.montant / maxVal) * 100)
                  const isToday = d.jour === new Date().toLocaleDateString('fr-FR', { weekday: 'short' })
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {d.montant > 0 && <div className="text-xs font-medium" style={{ color: '#2A4E94' }}>{(d.montant / 1000).toFixed(0)}k</div>}
                      <div className="w-full rounded-t-lg" style={{ height: `${pct}%`, backgroundColor: isToday ? '#E4322C' : '#2A4E94', opacity: d.montant === 0 ? 0.2 : 1 }} />
                      <div className="text-xs" style={{ color: sub }}>{d.jour}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comparaison mois */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: card, border: `1px solid ${border}` }}>
              <h3 className="font-semibold text-sm mb-3" style={{ color: text }}>📅 Ce mois vs mois précédent</h3>
              {(() => {
                const now = new Date()
                const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
                const fichesPrev = fiches.filter(f => new Date(f.date) >= prevStart && new Date(f.date) <= prevEnd)
                const collectePrev = fichesPrev.reduce((s, f) => s + (f.montant_mobilise || 0), 0)
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
                    <div className="col-span-2 rounded-xl p-3 text-center" style={{ backgroundColor: diff >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
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
                    <button key={contact.id} type="button" onClick={() => setSelectedContact(contact)}
                      className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
                      style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white flex-shrink-0"
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
                  { label: 'Membres dans l\'équipe', value: equipeMembers.length },
                  { label: 'Mes fiches', value: fiches.length },
                  { label: 'Streak', value: `🔥 ${streak} jour(s)` },
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

      {/* ── NAVIGATION BAS ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t shadow-lg"
        style={{ backgroundColor: card, borderColor: border }}>
        <div className="max-w-2xl mx-auto flex">
          {[
            { key: 'accueil', label: 'Accueil', icon: '🏠' },
            { key: 'fiches', label: 'Mes fiches', icon: '📋' },
            { key: 'equipe', label: 'Équipe', icon: '👥', badge: equipeStats.fichesNonValidees },
            { key: 'manquants', label: 'Manquants', icon: '⚠️', badge: manquantsNonRegles.length },
            { key: 'performance', label: 'Stats', icon: '📈' },
            { key: 'messages', label: 'Messages', icon: '💬', badge: messagesNonLus },
            { key: 'profil', label: 'Profil', icon: '👤' },
          ].map(t => (
            <button key={t.key} type="button"
              onClick={() => setActiveTab(t.key as ActiveTab)}
              className="flex-1 flex flex-col items-center py-2 text-xs font-medium transition-all relative">
              <span className="text-lg mb-0.5">{t.icon}</span>
              <span style={{ fontSize: '9px', color: activeTab === t.key ? '#2A4E94' : sub }}>{t.label}</span>
              {t.badge && t.badge > 0 && (
                <span className="absolute top-1 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#E4322C', fontSize: '9px' }}>
                  {t.badge > 9 ? '9+' : t.badge}
                </span>
              )}
              {activeTab === t.key && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                  style={{ backgroundColor: '#2A4E94' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Padding bas */}
      <div className="h-20" />

      {/* MODAL VALIDATION FICHE */}
      {showValidationModal && validationFiche && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f1f5f9' }}>
              <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>📋 Décision sur la fiche</h3>
              <button type="button" onClick={() => setShowValidationModal(false)}
                className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                <div className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>
                  Fiche du {new Date(validationFiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                  {(validationFiche.montant_mobilise || 0).toLocaleString()} FCFA · {validationFiche.comptes_ouverts} comptes
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-3" style={{ color: '#1a1a2e' }}>Décision</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'validee', label: '✅ Valider', bg: '#F0FDF4', color: '#166534', activeBg: '#166534' },
                    { key: 'rejetee', label: '❌ Rejeter', bg: '#FEF2F2', color: '#991B1B', activeBg: '#991B1B' },
                    { key: 'a_corriger', label: '🔄 Corriger', bg: '#FEF9C3', color: '#854D0E', activeBg: '#854D0E' },
                  ].map(s => (
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
                    await validerFicheChef(validationFiche.id, validationStatut, validationCommentaire)
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

    </div>
  )
}