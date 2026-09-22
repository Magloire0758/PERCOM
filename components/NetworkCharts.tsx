 'use client'
import { useEffect, useId, useState, type ReactNode } from 'react'
import type { NetworkReport } from '@/lib/network-reporting'
import { collectionSeries, commercialSeries, COMMERCIAL_METRICS, topPoints, type ChartPoint } from '@/lib/network-charts'
import { formatNumber, type ReportRow } from '@/lib/agent-reporting'
import { networkInput as input } from './network-ui'
export function ChartPanel({title,preference,children}:{title:string;preference:string;children:ReactNode}) {
 const [open,setOpen]=useState(false),id=useId()
 useEffect(()=>{const timer=setTimeout(()=>{try{const saved=localStorage.getItem('percom:chart:'+preference);setOpen(saved===null?matchMedia('(min-width:1024px)').matches:saved==='open')}catch{setOpen(false)}},0);return()=>clearTimeout(timer)},[preference])
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={title}>
   <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold text-slate-700">{title}</h2><button className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" aria-expanded={open} aria-controls={id} onClick={()=>{setOpen(!open);try{localStorage.setItem('percom:chart:'+preference,open?'closed':'open')}catch{}}}>{open?'Masquer le graphique':'Afficher le graphique'}</button></div>
   {open && <div id={id} className="mt-4">{children}</div>}
 </section>
}
export function HorizontalBars({points,unit,onPoint}:{points:ChartPoint[];unit:string;onPoint?:(point:ChartPoint)=>void}) {
 const top=topPoints(points),minimum=Math.min(0,...points.map(p=>p.value)),maximum=Math.max(0,...points.map(p=>p.value)),range=Math.max(1,maximum-minimum),origin=-minimum/range*100
 if(!points.length)return <p className="py-3 text-sm text-slate-500">Aucune donnée pour cette sélection.</p>
 return <><p className="mb-3 text-xs text-slate-500">{points.length>10?`10 premières cibles sur ${points.length}`:`${points.length} cible(s)`} · {unit} · échelle commune · repère zéro</p><div className="max-h-80 space-y-3 overflow-y-auto pr-1">{top.map((point,i)=>{
 const content=<><span className="block truncate text-xs font-medium" title={point.label}>{point.label}</span><span className="mt-1 flex items-center gap-3"><span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute block h-full rounded-full bg-blue-600" style={{left:`${point.value>=0?origin:origin+point.value/range*100}%`,width:`${Math.abs(point.value)/range*100}%`}}/><span className="absolute h-full border-l border-slate-400" style={{left:`${origin}%`}}/></span><strong className="min-w-20 text-right text-xs tabular-nums">{formatNumber(point.value)} {unit}</strong></span></>
 return onPoint?<button key={i} type="button" aria-label={`${point.label} : ${formatNumber(point.value)} ${unit}, consulter`} onClick={()=>onPoint(point)} className="block w-full rounded-lg p-1 text-left hover:bg-blue-50">{content}</button>:<div key={i} className="p-1">{content}</div>})}</div>{points.every(p=>p.value===0) && <p className="mt-2 text-xs text-slate-500">Aucune activité pour cet indicateur sur la sélection.</p>}</>
}
export function CollectionLines({points,second=true}:{points:ChartPoint[];second?:boolean}) {
 const [hover,setHover]=useState<number|null>(null)
 const values=points.flatMap(p=>[p.value,second?p.second || 0:0]),min=Math.min(0,...values),max=Math.max(1,...values),range=Math.max(1,max-min),n=points.length,x=(i:number)=>55+i*540/Math.max(1,n-1),y=(v:number)=>175-(v-min)/range*145
 if(!n)return <p className="text-sm text-slate-500">Aucune donnée pour cette sélection.</p>
 const active=points[Math.min(hover ?? n-1,n-1)]
 return <><div className="mb-2 flex gap-5 text-xs"><span className="font-bold text-blue-700">● SMART</span>{second && <span className="font-bold text-emerald-700">● Caisse</span>}<span className="text-slate-500">FCFA</span></div><svg viewBox="0 0 640 210" className="max-h-60 w-full" role="img" aria-label="Évolution de la collecte, SMART et caisse en FCFA">
 {[0,0.5,1].map(v=><g key={v}><line x1="55" x2="600" y1={y(min+v*range)} y2={y(min+v*range)} stroke="#e2e8f0"/><text x="48" y={y(min+v*range)+4} textAnchor="end" fontSize="10" fill="#64748b">{Intl.NumberFormat('fr',{notation:'compact'}).format(min+v*range)}</text></g>)}
 <polyline points={points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="#1d4ed8" strokeWidth="2.5"/>
 {second && <polyline points={points.map((p,i)=>`${x(i)},${y(p.second || 0)}`).join(' ')} fill="none" stroke="#047857" strokeDasharray="5 3" strokeWidth="2.5"/>}
 {points.map((p,i)=><g key={i}><circle cx={x(i)} cy={y(p.value)} r={n<46?3:1.5} fill="#1d4ed8"/><rect x={x(i)-270/Math.max(1,n-1)} y="20" width={540/Math.max(1,n-1)} height="160" fill="transparent" onMouseEnter={()=>setHover(i)} onClick={()=>setHover(i)}><title>{p.label} : SMART {formatNumber(p.value)} F{second?`, caisse ${formatNumber(p.second || 0)} F`:''}</title></rect></g>)}
 <text x="55" y="201" fontSize="11" fill="#64748b">{points[0].label}</text><text x="600" y="201" textAnchor="end" fontSize="11" fill="#64748b">{points[n-1].label}</text>
 </svg><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><label>Valeurs au <select aria-label="Point de la courbe" className="ml-2 rounded border bg-white p-1" value={Math.min(hover ?? n-1,n-1)} onChange={e=>setHover(Number(e.target.value))}>{points.map((p,i)=><option key={i} value={i}>{p.label}</option>)}</select></label><span>SMART : <strong>{formatNumber(active.value)} F</strong>{second && <> · Caisse : <strong>{formatNumber(active.second || 0)} F</strong></>}</span></div></>
}
export default function NetworkCharts({report,statistics,section,group,onInspect}:{report:NetworkReport;statistics:boolean;section:string;group:string;onInspect:(kind:string,id:string|null,agency?:string|null)=>void}) {
 const [metric,setMetric]=useState('total_smart'),[business,setBusiness]=useState('reactivations_nb'),[businessLevel,setBusinessLevel]=useState<'agence'|'equipe'>('agence')
 const temporal=collectionSeries(report.par_jour,report.periode)
 const phase=report.statuts.length===1 && report.statuts[0]==='validee'?'Officiel · fiches validées':'Prévisualisation · statuts sélectionnés'
 if(!statistics && section==='ranking' || statistics && group==='evolution')return null
 let content:ReactNode
 if(statistics && group==='collecte' || !statistics && section==='days') content=<><p className="mb-3 text-xs text-slate-500">Par {temporal.unit} · {report.periode.debut} → {report.periode.fin} · Les dates sans collecte sont à zéro.</p>{Number(report.synthese.nb_fiches)===0?<p className="text-sm text-slate-500">Aucune donnée pour cette sélection.</p>:<CollectionLines points={temporal.points}/>}</>
 else if(statistics && group==='ecarts')content=<HorizontalBars unit="FCFA" points={[{label:'Manquant restant',value:report.synthese.total_restant},{label:'Surplus restant',value:report.synthese.total_surplus_restant}]}/>
 else if(statistics && group==='activite') {
   const chosen=COMMERCIAL_METRICS.find(([id])=>id===business)!
   content=<><div className="mb-4 flex flex-wrap gap-3"><select aria-label="Indicateur commercial" className={input+' sm:!w-auto'} value={business} onChange={e=>setBusiness(e.target.value)}>{COMMERCIAL_METRICS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><select aria-label="Niveau commercial" className={input+' sm:!w-auto'} value={businessLevel} onChange={e=>setBusinessLevel(e.target.value as 'agence'|'equipe')}><option value="agence">Par agence</option><option value="equipe">Par équipe</option></select></div><HorizontalBars unit={chosen[2]?'FCFA':'Nombre'} points={commercialSeries(report,businessLevel,business)}/><p className="mt-3 text-xs text-slate-500">Réactivations effectives uniquement. Les autres indicateurs restent disponibles dans les cartes chiffrées.</p></>
 } else {
   const source=section==='agencies'?report.par_agence:section==='teams'?report.par_equipe:report.par_membre
   const options=section==='agencies'?[['total_smart','SMART'],['total_caisse','Caisse'],['total_restant','Manquant restant']]:[['total_smart','SMART'],['total_manquant_restant','Manquant restant']]
   const actual=options.some(([key])=>key===metric)?metric:'total_smart'
   const points=source.map(row=>({label:String(section==='agencies'?row.agence_nom:(section==='teams'?row.equipe_nom:`${row.prenom} ${row.nom}`)+' · '+(report.par_agence.find(a=>a.agence_id===row.agence_id)?.agence_nom || 'Agence non renseignée')),value:Number(row[actual]),row}))
   content=<><label className="mb-4 block text-xs text-slate-500">Indicateur<select aria-label="Indicateur du graphique" className={input+' mt-1 sm:!w-60'} value={actual} onChange={e=>setMetric(e.target.value)}>{options.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><HorizontalBars unit="FCFA" points={points} onPoint={p=>{const row=p.row as ReportRow;onInspect(section,row[section==='agencies'?'agence_id':section==='teams'?'equipe_id':'agent_id'] as string|null,row.agence_id as string|null)}}/>{section!=='agencies' && <p className="mt-3 text-xs text-slate-500">La caisse n’est pas ventilée par équipe ou collaborateur dans le rapport actuel.</p>}</>
 }
 return <ChartPanel preference={statistics?'stats-'+group:'overview-'+section} title="Repère visuel du périmètre sélectionné"><p className="mb-3 text-xs font-semibold text-slate-500">{phase} · Recherche du tableau non appliquée au graphique</p>{content}</ChartPanel>
}
