'use client'
import { useState } from 'react'
import { monthPeriod, validPeriod, STATUTS, type Statut } from '@/lib/agent-reporting'
import { useTeamRpc } from '@/lib/use-team-rpc'
import { OBJECTIVE_MEASURES, consolidatedArgs, consolidatedModel, type ConsolidatedReport, type ObjectiveMeasure, type ObjectiveAccounts } from '@/lib/consolidated-objectives'
import { NetworkTable, NetworkState, NetworkTabs, NetworkFiche } from './NetworkWorkspace'
import { networkPanel as panel, networkInput as input, networkButton as button } from './network-ui'
import AgentExportButtons from './AgentExportButtons'

export default function ConsolidatedObjectives({agencies=[],agencyId=null}:{agencies?:{id:string;nom:string}[];agencyId?:string|null}) {
  const [period,setPeriod]=useState(monthPeriod),[measure,setMeasure]=useState<ObjectiveMeasure>('cible_montant_smart')
  const [agency,setAgency]=useState(agencyId),[accounts,setAccounts]=useState<ObjectiveAccounts>('actif')
  const [statuses,setStatuses]=useState<Statut[]>(['validee']),[section,setSection]=useState('agents'),[fiche,setFiche]=useState<string|null>(null)
  const valid=validPeriod(period) && (Date.parse(period.fin)-Date.parse(period.debut))/86400000<366 && statuses.length>0
  const args=consolidatedArgs(measure,accounts,agencyId || agency,period,statuses)
  const rpc=useTeamRpc<ConsolidatedReport>('rapport_objectifs_consolide',args,valid)
  let model:ReturnType<typeof consolidatedModel>|null=null,error=rpc.error
  if(rpc.data && !rpc.busy && !error)try{model=consolidatedModel(rpc.data)}catch{error='Rapport incomplet. Actualisez pour réessayer.'}
  const sections=section==='agents'?[2]:section==='agencies'?[1]:section==='gaps'?[3]:section==='comments'?[4]:[0]
  return <div className="space-y-5">
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Objectifs · Réalisation</p><h2 className="mt-2 text-2xl font-bold">Rapport consolidé</h2><p className="mt-2 text-sm text-slate-500">Agents, agences et total du périmètre. Valeurs calculées par le serveur, rattachements actuels.</p></div><AgentExportButtons disabled={!model || rpc.busy} target={{type:'objectifs_consolides',mesure:measure,comptes:accounts,agenceId:agencyId || agency,periode:period,statuts:statuses}}/></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Indicateur<select className={input} value={measure} onChange={e=>setMeasure(e.target.value as ObjectiveMeasure)}>{OBJECTIVE_MEASURES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {!agencyId && <label className="text-sm">Agence<select className={input} value={agency || ''} onChange={e=>setAgency(e.target.value || null)}><option value="">Tout le réseau</option>{agencies.map(a=><option key={a.id} value={a.id}>{a.nom}</option>)}</select></label>}
        <label className="text-sm">Comptes<select className={input} value={accounts} onChange={e=>setAccounts(e.target.value as ObjectiveAccounts)}><option value="actif">Actifs</option><option value="inactif">Inactifs / suspendus</option><option value="tous">Tous</option></select></label>
        {(['debut','fin'] as const).map(key=><label className="text-sm" key={key}>{key==='debut'?'Du':'Au'}<input type="date" className={input} value={period[key]} onChange={e=>setPeriod({...period,[key]:e.target.value})}/></label>)}
      </div>
      <fieldset className="mt-5 flex flex-wrap gap-4 text-sm"><legend className="mb-2 font-semibold">Statuts des fiches</legend>{STATUTS.map(s=><label key={s} className="flex items-center gap-2"><input type="checkbox" checked={statuses.includes(s)} onChange={e=>setStatuses(e.target.checked?[...statuses,s]:statuses.filter(v=>v!==s))}/>{{validee:'Validées',en_attente:'En attente',a_corriger:'À corriger'}[s]}</label>)}</fieldset>
      <div className="mt-4 flex gap-3"><button className={button} onClick={()=>setPeriod(monthPeriod())}>Ce mois</button><button className={button} disabled={!valid || rpc.busy} onClick={()=>void rpc.refresh()}>Actualiser</button></div>
      {!valid && <p role="alert" className="mt-3 text-red-700">Choisissez une période de 366 jours maximum et au moins un statut.</p>}
    </section>
    <NetworkState busy={rpc.busy} error={error} refresh={rpc.refresh}/>
    {model && <>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><strong>{model.status}</strong><p className="mt-2">Deux bases : objectif officiel et objectifs cumulés des agents. Le réalisé suit les filtres sélectionnés ; avec des comptes exclus, il représente une contribution au total officiel.</p><p className="mt-1">Les exports contiennent toutes les sections et toutes les lignes du périmètre ; la recherche dans un tableau ne modifie pas les totaux ni les exports.</p></div>
      {rpc.data?.meta.periode_partielle && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Période partielle : progression vers les objectifs complets, sans proratisation. Ces taux ne représentent pas un objectif limité aux dates sélectionnées.</p>}
      <NetworkTable section={model.sections[0]}/>
      <NetworkTabs label="Détails du rapport consolidé" value={section} onChange={setSection} items={[["agents","Agents"],["agencies","Agences"],["gaps","Écarts & régularisations"],["comments","Commentaires"]]}/>
      {sections.map(index=><NetworkTable key={`${index}-${JSON.stringify(args)}`} section={model.sections[index]} searchable onRow={index===4?r=>{if(r.dernier_commentaire_fiche_id)setFiche(String(r.dernier_commentaire_fiche_id))}:undefined}/>)}
    </>}
    {fiche && <NetworkFiche id={fiche} rows={[]} select={setFiche} close={()=>setFiche(null)} onDone={()=>void rpc.refresh()}/>}
  </div>
}
