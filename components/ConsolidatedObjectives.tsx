 'use client'
import { useState } from 'react'
import { todayLome, formatDate, formatNumber, STATUTS, type Statut } from '@/lib/agent-reporting'
import { useTeamRpc } from '@/lib/use-team-rpc'
import { OBJECTIVE_MEASURES, REPORT_LEVELS, REPORT_FREQUENCIES, objectivePeriod, consolidatedArgs, consolidatedModel, type ConsolidatedReport, type ObjectiveMeasure, type ObjectiveAccounts, type ObjectiveLevel, type ObjectiveFrequency } from '@/lib/consolidated-objectives'
import { NetworkState, NetworkTabs, NetworkFiche } from './NetworkWorkspace'
import { networkPanel as panel, networkInput as input, networkButton as button } from './network-ui'
import AgentExportButtons from './AgentExportButtons'

export default function ConsolidatedObjectives({agencies=[],agencyId=null,initialLevel='agent'}:{initialLevel?:ObjectiveLevel;agencies?:{id:string;nom:string}[];agencyId?:string|null}) {
  const [level,setLevel]=useState<ObjectiveLevel>(agencyId && initialLevel==='global'?'agence':initialLevel),[frequency,setFrequency]=useState<ObjectiveFrequency>('mensuel'),[reference,setReference]=useState(todayLome)
  const [measure,setMeasure]=useState<ObjectiveMeasure>('cible_montant_smart'),[agency,setAgency]=useState(agencyId),[accounts,setAccounts]=useState<ObjectiveAccounts>('tous')
  const [statuses,setStatuses]=useState<Statut[]>(['validee']),[fiche,setFiche]=useState<string|null>(null),[page,setPage]=useState(1)
  const selectedAgency=level==='global'?null:agencyId || agency,selectedAccounts=level==='agent'?accounts:'tous'
  const period=objectivePeriod(frequency,reference),valid=!!period && statuses.length>0
  const args=consolidatedArgs(measure,selectedAccounts,selectedAgency,level,frequency,reference,statuses)
  const rpc=useTeamRpc<ConsolidatedReport>('rapport_objectifs_periode',args,valid)
  let model:ReturnType<typeof consolidatedModel>|null=null,error=rpc.error
  if(rpc.data && !rpc.busy && !error)try{model=consolidatedModel(rpc.data)}catch(e){error=(e as Error).message}
  const table=model?.sections[0],rows=table?.rows.slice(0,-1) || [],total=table?.rows.at(-1),pages=Math.max(1,Math.ceil(rows.length/50)),current=Math.min(page,pages)
  const dateValue=frequency==='journalier'?reference:frequency==='mensuel'?reference.slice(0,7):reference.slice(0,4)
  function selectDate(value:string){setReference(frequency==='journalier'?value:frequency==='mensuel'?value+'-01':value+'-01-01');setPage(1)}
  return <div className="space-y-5">
    <NetworkTabs label="Type de rapport" value={level} items={REPORT_LEVELS.filter(([id])=>!agencyId || id!=='global').map(([id,label])=>[id,label])} onChange={v=>{setLevel(v as ObjectiveLevel);setPage(1)}}/>
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Objectifs et réalisations</p><h2 className="mt-2 text-2xl font-bold">{REPORT_LEVELS.find(([id])=>id===level)?.[1]}</h2><p className="mt-2 text-sm text-slate-500">Un objectif, un réalisé, un taux pour la période choisie.</p></div><AgentExportButtons disabled={!model || rpc.busy} target={{type:'objectifs_consolides',niveau:level,periodicite:frequency,dateReference:reference,mesure:measure,comptes:selectedAccounts,agenceId:selectedAgency,statuts:statuses}}/></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">Période<select className={input} value={frequency} onChange={e=>{setFrequency(e.target.value as ObjectiveFrequency);setPage(1)}}>{REPORT_FREQUENCIES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold">{frequency==='journalier'?'Date':frequency==='mensuel'?'Mois':'Année'}<input type={frequency==='journalier'?'date':frequency==='mensuel'?'month':'number'} min={frequency==='annuel'?'1900':undefined} max={frequency==='annuel'?'9999':undefined} className={input} value={dateValue} onChange={e=>selectDate(e.target.value)}/></label>
        <label className="text-sm font-semibold">Indicateur<select className={input} value={measure} onChange={e=>{setMeasure(e.target.value as ObjectiveMeasure);setPage(1)}}>{OBJECTIVE_MEASURES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {!agencyId && level!=='global' && <label className="text-sm font-semibold">Agence<select className={input} value={agency || ''} onChange={e=>{setAgency(e.target.value || null);setPage(1)}}><option value="">Toutes les agences</option>{agencies.map(a=><option key={a.id} value={a.id}>{a.nom}</option>)}</select></label>}
      </div>
      <details className="mt-5 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Filtres complémentaires</summary><div className="mt-4 flex flex-wrap items-end gap-5">
        {level==='agent' && <label className="text-sm">Comptes<select className={input} value={accounts} onChange={e=>{setAccounts(e.target.value as ObjectiveAccounts);setPage(1)}}><option value="tous">Tous</option><option value="actif">Actifs</option><option value="inactif">Inactifs / suspendus</option></select></label>}
        <fieldset className="flex flex-wrap gap-4 text-sm"><legend className="mb-2">Statuts des fiches</legend>{STATUTS.map(s=><label key={s} className="flex items-center gap-2"><input type="checkbox" checked={statuses.includes(s)} onChange={e=>setStatuses(e.target.checked?[...statuses,s]:statuses.filter(v=>v!==s))}/>{{validee:'Validées',en_attente:'En attente',a_corriger:'À corriger'}[s]}</label>)}</fieldset>
      </div></details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{period?`${formatDate(period.debut)} au ${formatDate(period.fin)}`:'Choisissez une période valide.'}</p><button className={button} disabled={!valid || rpc.busy} onClick={()=>void rpc.refresh()}>Actualiser</button></div>
      {!valid && <p role="alert" className="mt-3 text-red-700">Choisissez une période valide et au moins un statut.</p>}
    </section>
    <NetworkState busy={rpc.busy} error={error?'Rapport indisponible. '+error:''} refresh={rpc.refresh}/>
    {model && table && <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="rounded-full bg-blue-50 px-3 py-2 font-semibold text-blue-800">{model.status}</span><span className="text-slate-500">{rpc.data?.meta.date_arrete?`Réalisé au ${formatDate(rpc.data.meta.date_arrete)}`:'Période future'} · Objectif de la période complète</span></div>
      {rpc.data?.meta.objectifs_incomplets && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Objectifs incomplets : certaines cibles sont absentes ou en conflit. Le taux et l’écart du total ne sont pas calculés.</p>}
      <section className={panel+' !p-0 overflow-hidden'}><div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><caption className="sr-only">{model.title}</caption><thead className="sticky top-0 z-10 bg-slate-100"><tr>{table.columns.map(c=><th key={c.key} className="border-b px-4 py-4 text-xs font-bold uppercase text-slate-600">{c.label}</th>)}</tr></thead><tbody>{rows.slice((current-1)*50,current*50).map((row,index)=><tr key={String(row.id || row.agence_id || row.n || index)} className="border-b border-slate-100 hover:bg-blue-50/40">{table.columns.map(c=><td key={c.key} className={'px-4 py-4 '+(c.money?'text-right tabular-nums':'')}>
        {c.key==='regularisation_commentaire' && row.dernier_commentaire_fiche_id?<button className="max-w-sm text-left text-blue-700 underline decoration-blue-200 underline-offset-4" onClick={()=>setFiche(String(row.dernier_commentaire_fiche_id))}>{String(row[c.key])}</button>:row[c.key]===null?'—':typeof row[c.key]==='number'?formatNumber(row[c.key] as number)+(c.key==='taux'?' %':''):String(row[c.key] ?? '—')}
      </td>)}</tr>)}</tbody>{total && <tfoot className="sticky bottom-0 bg-blue-950 font-bold text-white"><tr>{table.columns.map(c=><td key={c.key} className="px-4 py-4">{total[c.key]===null?'—':typeof total[c.key]==='number'?formatNumber(total[c.key] as number)+(c.key==='taux'?' %':''):String(total[c.key] ?? '')}</td>)}</tr></tfoot>}</table>{!rows.length && <p className="p-8 text-center text-slate-500">Aucune donnée sur ce périmètre.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-slate-500"><span>{rows.length} lignes · Total et exports sur toutes les lignes</span><div className="flex items-center gap-3"><button className={button} disabled={current===1} onClick={()=>setPage(current-1)}>Précédent</button><span>{current} / {pages}</span><button className={button} disabled={current===pages} onClick={()=>setPage(current+1)}>Suivant</button></div></div></section>
    </>}
    {fiche && <NetworkFiche id={fiche} rows={[]} select={setFiche} close={()=>setFiche(null)} onDone={()=>void rpc.refresh()}/>}
  </div>
}
