'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, FileCheck2, Users, Network, ChartNoAxesCombined, Target, Scale, Settings2, LogOut, Menu, X, ChevronRight, ArrowLeft, Building2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/supabase-pagination'
import { useTeamRpc } from '@/lib/use-team-rpc'
import { monthPeriod } from '@/lib/agent-reporting'
import type { TeamQueue } from '@/lib/team-reporting'
import { AgencyQueue, CollectiveGoals, ReadState, agencyButton as button, agencyInput as input, agencyPanel as panel, type TeamOption } from './AgencyWorkspace'
import { AgencyObjectives, AgencyGaps, AgencyProfile, type AgencyPerson, type AgencySelf } from './AgencyManagement'
import AgencyAnalytics, { initialAgencyView } from './AgencyAnalytics'
import AgentInsights from './AgentInsights'
import TeamWorkspace from './TeamWorkspace'

type Tab = 'dashboard' | 'fiches' | 'agents' | 'equipes' | 'statistiques' | 'objectifs' | 'ecarts' | 'profil'
const navigation = [
  { key:'dashboard',label:'Vue d’ensemble',icon:LayoutDashboard }, { key:'fiches',label:'Fiches à traiter',icon:FileCheck2 },
  { key:'agents',label:'Collaborateurs',icon:Users }, { key:'equipes',label:'Équipes',icon:Network },
  { key:'statistiques',label:'Statistiques & rapports',icon:ChartNoAxesCombined }, { key:'objectifs',label:'Objectifs',icon:Target }, { key:'ecarts',label:'Écarts & alertes',icon:Scale },
] as const

export default function AgencyDashboard() {
  const router = useRouter()
  const [self,setSelf]=useState<AgencySelf | null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [members,setMembers]=useState<AgencyPerson[]>([]),[teams,setTeams]=useState<TeamOption[]>([]),[directoryError,setDirectoryError]=useState(''),[directoryBusy,setDirectoryBusy]=useState(false)
  const [tab,setTab]=useState<Tab>('dashboard'),[mobile,setMobile]=useState(false),[revision,setRevision]=useState(0)
  const [overviewPeriod,setOverviewPeriod]=useState(monthPeriod),[overviewPreview,setOverviewPreview]=useState(false)
  const [analysisViews,setAnalysisViews]=useState({dashboard:initialAgencyView,statistiques:initialAgencyView})
  const [analysisReturn,setAnalysisReturn]=useState<'dashboard'|'statistiques'|null>(null)
  const directorySequence = useRef(0)
  const [member,setMember]=useState(''),[team,setTeam]=useState(''),[search,setSearch]=useState(''),[role,setRole]=useState('tous'),[state,setState]=useState('tous'),[teamFilter,setTeamFilter]=useState(''),[page,setPage]=useState(1)
  const badge=useTeamRpc<TeamQueue>('agence_file_traitement',{ p_agence_id:self?.agence_id,p_taille:1 },!!self?.agence_id)
  const loadDirectory=useCallback(async (agencyId:string) => {
    const sequence = ++directorySequence.current
    setDirectoryBusy(true);setDirectoryError('')
    try {
      const results=await Promise.all([
        fetchAllRows<AgencyPerson>((from,to)=>supabase.from('agents').select('id,nom,prenom,role,actif,statut,equipe_id,telephone,email').eq('agence_id',agencyId).in('role',['agent','chef']).order('nom').order('id').range(from,to)),
        fetchAllRows<TeamOption>((from,to)=>supabase.from('equipes').select('id,nom').eq('agence_id',agencyId).order('nom').order('id').range(from,to)),
      ])
      if(results.some(r=>r.error)) throw new Error('Annuaire indisponible. Réessayez avant de sélectionner une cible.')
      if (sequence === directorySequence.current) { setMembers(results[0].data || []);setTeams(results[1].data || []) }
    } catch(e) {if(sequence === directorySequence.current){setMembers([]);setTeams([]);setDirectoryError((e as Error).message)}} finally {if(sequence === directorySequence.current)setDirectoryBusy(false)}
  },[])
  const authenticate=useCallback(async()=>{
    setLoading(true);setError('')
    try {
      const auth=await supabase.auth.getUser()
      if(auth.error || !auth.data.user) {router.replace('/login');return}
      const r=await supabase.from('agents').select('id,nom,prenom,telephone,email,role,actif,statut,agence_id,equipe_id,agences(nom)').eq('user_id',auth.data.user.id).single()
      if(r.error) throw new Error('Votre profil ne peut pas être chargé. Réessayez.')
      if(!r.data || r.data.role!=='responsable' || r.data.actif!==true || r.data.statut!=='actif') {router.replace('/login');return}
      if(!r.data.agence_id) throw new Error('Aucune agence rattachée à ce compte. Contactez un administrateur.')
      const profile=r.data as unknown as AgencySelf
      setSelf(profile);void loadDirectory(profile.agence_id)
    } catch(e) {setError((e as Error).message)} finally {setLoading(false)}
  },[loadDirectory,router])
  useEffect(()=>{const timer=setTimeout(()=>void authenticate(),0);return()=>clearTimeout(timer)},[authenticate])
  function navigate(next:Tab){window.scrollTo({top:0});setAnalysisReturn(null);setTab(next);setMobile(false);setMember('');setTeam('');setPage(1)}
  function openMember(id:string){window.scrollTo({top:0});setTab('agents');setMember(id);setTeam('');setMobile(false)}
  function openTeam(id:string){window.scrollTo({top:0});setTab('equipes');setTeam(id);setMember('');setMobile(false)}
  function changed(){setRevision(v=>v+1);void badge.refresh()}
  const person=members.find(m=>m.id===member), selectedTeam=teams.find(t=>t.id===team)
  const filtered=members.filter(m=>(`${m.prenom} ${m.nom}`).toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (role==='tous'||m.role===role) && (state==='tous'||(state==='actif'?(m.actif&&m.statut==='actif'):!(m.actif&&m.statut==='actif'))) && (!teamFilter||(teamFilter==='none'?!m.equipe_id:m.equipe_id===teamFilter)))
  if(loading || !self) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-xl"><ReadState busy={loading} error={error} retry={authenticate} /></div></main>
  return <div className="min-h-screen bg-[#f4f6fa] text-slate-900" style={{fontFamily:'var(--font-dm-sans), sans-serif'}}>
    <a href="#agency-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Aller au contenu</a>
    {mobile && <button aria-label="Fermer la navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={()=>setMobile(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#101f3d] text-white transition-transform lg:translate-x-0 ${mobile?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center justify-between px-6 pb-8 pt-8"><div><p className="text-2xl font-extrabold tracking-[.12em]">PERCOM<span className="text-blue-400">.</span></p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.24em] text-slate-400">PADES · Performance</p></div><button aria-label="Fermer le menu" className="lg:hidden" onClick={()=>setMobile(false)}><X size={20}/></button></div>
      <div className="mx-4 mb-6 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Votre agence</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><Building2 size={16}/>{self.agences?.nom || 'Agence'}</p></div>
      <nav aria-label="Navigation responsable" className="flex-1 space-y-1 overflow-y-auto px-3">{navigation.map(({key,label,icon:Icon})=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>navigate(key)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm transition ${tab===key?'bg-blue-600 font-semibold text-white shadow-lg shadow-blue-950/20':'text-slate-300 hover:bg-white/5 hover:text-white'}`}><Icon size={18}/><span className="flex-1">{label}</span>{key==='fiches'&&badge.data&&badge.data.compteurs.en_attente>0&&<span className="rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{badge.data.compteurs.en_attente}</span>}</button>)}</nav>
      <div className="space-y-1 border-t border-white/10 p-3"><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5" onClick={()=>navigate('profil')}><Settings2 size={18}/>Mon profil</button><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5" onClick={async()=>{const r=await supabase.auth.signOut();if(r.error)setError('Déconnexion impossible. Réessayez.');else router.replace('/login')}}><LogOut size={18}/>Déconnexion</button></div>
    </aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button aria-label="Ouvrir le menu" className={button+' lg:hidden'} onClick={()=>setMobile(true)}><Menu size={18}/></button><div><p className="text-xs text-slate-400">Espace responsable</p><p className="mt-1 text-sm font-semibold">{navigation.find(n=>n.key===tab)?.label || 'Mon profil'}</p></div></div><button className="flex items-center gap-3 text-left" onClick={()=>navigate('profil')}><span className="hidden text-right sm:block"><strong className="block text-sm">{self.prenom} {self.nom}</strong><span className="text-xs text-slate-500">Responsable d’agence</span></span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{self.prenom[0]}{self.nom[0]}</span></button></header>
      <main id="agency-main" className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8 xl:p-10"><ReadState busy={false} error={error}/>
        {(tab==='dashboard'||tab==='statistiques')&&<AgencyAnalytics view={analysisViews[tab]} setView={v=>setAnalysisViews({...analysisViews,[tab]:v})} members={members} teams={teams} period={overviewPeriod} setPeriod={setOverviewPeriod} preview={overviewPreview} setPreview={setOverviewPreview} key={tab+revision} agencyId={self.agence_id} stats={tab==='statistiques'} onQueue={()=>navigate('fiches')} onMember={id=>{setAnalysisReturn(tab as 'dashboard'|'statistiques');openMember(id)}} onTeam={id=>{setAnalysisReturn(tab as 'dashboard'|'statistiques');openTeam(id)}}/>}
        {tab==='fiches'&&<><ReadState busy={directoryBusy} error={directoryError} retry={()=>void loadDirectory(self.agence_id)}/><AgencyQueue agencyId={self.agence_id} members={members} teams={teams} onDecision={changed}/></>}
        {(tab==='agents'||tab==='equipes')&&<>{analysisReturn && <button className={button} onClick={()=>{setTab(analysisReturn);setMember('');setTeam('');setAnalysisReturn(null)}}>← Retour à l’analyse de l’agence</button>}<div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Votre collectif</p><h2 className="mt-2 text-3xl font-bold">{tab==='agents'?'Les collaborateurs':'Les équipes'}</h2><p className="mt-2 text-sm text-slate-500">Comptes en lecture seule · Contributions des suspendus conservées.</p></div><div className="flex gap-2"><button className={button} onClick={()=>void loadDirectory(self.agence_id)}>Actualiser</button>{(member||team)&&<button className={button} onClick={()=>{setMember('');setTeam('')}}><ArrowLeft size={16}/>Retour à la liste</button>}</div></div><ReadState busy={directoryBusy} error={directoryError} retry={()=>void loadDirectory(self.agence_id)}/>
          {member&&person?<><section className={panel}><h3 className="text-xl font-bold">{person.prenom} {person.nom}</h3><p className="mt-1 text-sm text-slate-500">{person.role==='chef'?'Chef d’équipe':'Agent de collecte'} · {teams.find(t=>t.id===person.equipe_id)?.nom || 'Sans équipe'} · {person.actif&&person.statut==='actif'?'Actif':'Inactif / suspendu'}</p><p className="mt-3 text-sm text-slate-500">{person.telephone || 'Téléphone non renseigné'} · {person.email || ''}</p></section><AgentInsights initialPeriod={analysisReturn?overviewPeriod:undefined} initialPreview={analysisReturn?overviewPreview:undefined} key={person.id} agentId={person.id} hasAgency mode="stats" isDark={false}/></>:team&&selectedTeam?<><section className={panel}><h3 className="text-xl font-bold">{selectedTeam.nom}</h3><p className="mt-1 text-sm text-slate-500">{members.filter(m=>m.equipe_id===team).length} membre(s) rattaché(s)</p><div className="mt-4 flex flex-wrap gap-2">{members.filter(m=>m.equipe_id===team).map(m=><button key={m.id} className={button} onClick={()=>openMember(m.id)}>{m.prenom} {m.nom}<ChevronRight size={14}/></button>)}</div></section><TeamWorkspace initialPeriod={analysisReturn?overviewPeriod:undefined} initialPreview={analysisReturn?overviewPreview:undefined} key={team} teamId={team} mode="stats" isDark={false} explicitExport onDecision={changed}/><CollectiveGoals type="equipe" id={team}/></>:tab==='agents'?<><section className={panel+' flex flex-wrap gap-3'}><input aria-label="Rechercher un collaborateur" className={input+' min-w-40 flex-1'} placeholder="Nom ou prénom…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/><select aria-label="Rôle" className={input+' !w-auto'} value={role} onChange={e=>{setRole(e.target.value);setPage(1)}}><option value="tous">Tous les rôles</option><option value="agent">Agents</option><option value="chef">Chefs</option></select><select aria-label="État du compte" className={input+' !w-auto'} value={state} onChange={e=>{setState(e.target.value);setPage(1)}}><option value="tous">Tous les états</option><option value="actif">Actifs</option><option value="inactif">Inactifs / suspendus</option></select><select aria-label="Équipe du collaborateur" className={input+' !w-auto'} value={teamFilter} onChange={e=>{setTeamFilter(e.target.value);setPage(1)}}><option value="">Toutes les équipes</option><option value="none">Sans équipe</option>{teams.map(t=><option value={t.id} key={t.id}>{t.nom}</option>)}</select></section><section className={panel}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Collaborateur','Rôle','Équipe','État',''].map((s,i)=><th className="p-3 text-xs text-slate-500" key={i}>{s}</th>)}</tr></thead><tbody>{filtered.slice((page-1)*20,page*20).map(m=><tr key={m.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{m.prenom} {m.nom}</td><td className="p-3">{m.role==='chef'?'Chef':'Agent'}</td><td className="p-3">{teams.find(t=>t.id===m.equipe_id)?.nom || 'Sans équipe'}</td><td className="p-3"><span className={'rounded-full px-2.5 py-1 text-xs '+(m.actif&&m.statut==='actif'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{m.actif&&m.statut==='actif'?'Actif':m.statut || 'Inactif'}</span></td><td className="p-3"><button className={button} onClick={()=>openMember(m.id)}>Performances<ChevronRight size={14}/></button></td></tr>)}</tbody></table>{!directoryBusy&&!directoryError&&!filtered.length&&<p className="py-8 text-center text-slate-500">Aucun collaborateur trouvé.</p>}</div><div className="mt-5 flex justify-between gap-3 text-sm"><span>{filtered.length} collaborateurs · Page {page}</span><div className="flex gap-2"><button className={button} disabled={page===1} onClick={()=>setPage(page-1)}>Précédent</button><button className={button} disabled={page*20>=filtered.length} onClick={()=>setPage(page+1)}>Suivant</button></div></div></section></>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{teams.map(t=><button key={t.id} className={panel+' text-left transition hover:border-blue-300 hover:shadow-md'} onClick={()=>openTeam(t.id)}><span className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Network size={22}/></span><h3 className="text-lg font-bold">{t.nom}</h3><p className="mt-2 text-sm text-slate-500">{members.filter(m=>m.equipe_id===t.id).length} membres rattachés</p><p className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-700">Voir les résultats<ChevronRight size={15}/></p></button>)}{!directoryBusy&&!directoryError&&!teams.length&&<p className={panel}>Aucune équipe rattachée à l’agence.</p>}</div>}
        </>}
        {tab==='objectifs'&&<><ReadState busy={directoryBusy} error={directoryError}/><AgencyObjectives self={self} members={members} teams={teams} onChange={changed}/></>}
        {tab==='ecarts'&&<AgencyGaps agencyId={self.agence_id} members={members} onChange={changed}/>}
        {tab==='profil'&&<AgencyProfile self={self} onSaved={p=>setSelf({...self,...p})}/>}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400"><span>PERCOM · PADES</span><span className="flex items-center gap-1.5"><ShieldCheck size={14}/>Espace agence · Accès authentifié</span></footer>
      </main>
    </div>
  </div>
}
