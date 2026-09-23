import type { NetworkReport } from './network-reporting'
import { formatDate, type Period, type ReportRow } from './agent-reporting'
export type ChartPoint = { label: string; value: number; second?: number; row?: ReportRow }
export const COMMERCIAL_METRICS = [
 ['reactivations_nb','Réactivations effectives',false],['reactivations_montant','Montant réactivé',true],
 ['augmentations_nb','Augmentations de mise',false],['augmentations_montant','Hausse des mises',true],
 ['assurances_nb','Assurances',false],['assurances_montant','Montant assurances',true],
] as const
export function commercialSeries(r:Pick<NetworkReport,'par_agence'|'par_equipe'|'details_reactivations'|'details_augmentations'|'details_assurances'>,level:'agence'|'equipe',metric:string):ChartPoint[] {
 const agencies=new Map(r.par_agence.map(a=>[a.agence_id,a.agence_nom]))
 const teams=new Map(r.par_equipe.filter(t=>t.equipe_id).map(t=>[t.equipe_id,t.equipe_nom]))
 const groups=new Map<string,ChartPoint>()
 const rows=metric.startsWith('reactivations')?r.details_reactivations.filter(row=>row.reactif===true):metric.startsWith('augmentations')?r.details_augmentations:r.details_assurances
 for(const row of rows) {
   const key=JSON.stringify(level==='agence'?[row.agence_id]:[row.agence_id,row.equipe_id])
   const agency=String(agencies.get(row.agence_id) || row.agence_nom || (row.agence_id?'Agence rattachée':'Sans agence'))
   const label=level==='agence'?agency:`${teams.get(row.equipe_id) || (row.equipe_id?'Équipe rattachée':'Sans équipe')} · ${agency}`
   const value=metric==='reactivations_nb'||metric==='augmentations_nb'?1:metric==='reactivations_montant'?Number(row.montant_cotise ?? 0):metric==='augmentations_montant'?Math.max(Number(row.nouvelle_mise ?? 0)-Number(row.ancienne_mise ?? 0),0):Number(row[metric==='assurances_nb'?'nb':'montant'] ?? 0)
   const current=groups.get(key) || {label,value:0};current.value+=value;groups.set(key,current)
 }
 return [...groups.values()]
}
// Fill missing dates with zero and group long periods without dropping contributions.
export function collectionSeries(rows:ReportRow[],period:Period) {
 const start=Date.parse(period.debut+'T00:00:00Z'),end=Date.parse(period.fin+'T00:00:00Z')
 const days=Math.round((end-start)/86400000)+1,unit=days<=45?'jour':days<=180?'semaine':'mois'
 const key=(date:string)=>unit==='mois'?date.slice(0,7):unit==='semaine'?String(Math.floor((Date.parse(date+'T00:00:00Z')-start)/604800000)):date
 const points=new Map<string,ChartPoint>()
 if(unit==='mois') {
   const d=new Date(start);d.setUTCDate(1)
   while(d.getTime()<=end){const month=d.toISOString().slice(0,7);points.set(month,{label:month,value:0,second:0});d.setUTCMonth(d.getUTCMonth()+1)}
 } else for(let time=start;time<=end;time+=unit==='semaine'?604800000:86400000){const date=new Date(time).toISOString().slice(0,10);points.set(key(date),{label:(unit==='semaine'?'Sem. du ':'')+formatDate(date),value:0,second:0})}
 for(const row of rows){const point=points.get(key(String(row.date)));if(point){point.value+=Number(row.smart);point.second!+=Number(row.caisse)}}
 return {points:[...points.values()],unit}
}
export function topPoints(points:ChartPoint[]) {return [...points].sort((a,b)=>b.value-a.value || a.label.localeCompare(b.label,'fr')).slice(0,10)}
