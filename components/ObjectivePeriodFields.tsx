 'use client'
import { objectivePeriod, REPORT_FREQUENCIES, type ObjectiveFrequency } from '@/lib/consolidated-objectives'
import { networkInput as input } from './network-ui'

type Value={debut:string;fin:string;periodicite:string}
export default function ObjectivePeriodFields({value,onChange,disabled=false}:{disabled?:boolean;value:Value;onChange:(next:Value)=>void}) {
  const known=REPORT_FREQUENCIES.some(([key])=>key===value.periodicite)
  const frequency=value.periodicite as ObjectiveFrequency
  const expected=known?objectivePeriod(frequency,value.debut):null
  const canonical=expected?.debut===value.debut && expected?.fin===value.fin
  function select(periodicite:string,reference:string){const period=objectivePeriod(periodicite as ObjectiveFrequency,reference);if(period)onChange({...period,periodicite})}
  return <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Périodicité<select disabled={disabled} className={input} value={value.periodicite} onChange={e=>select(e.target.value,value.debut)}>{!known && <option value={value.periodicite}>Ancienne périodicité : {value.periodicite}</option>}{REPORT_FREQUENCIES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{known && <label className="text-sm">{frequency==='journalier'?'Date':frequency==='mensuel'?'Mois':'Année'}<input disabled={disabled} required className={input} type={frequency==='journalier'?'date':frequency==='mensuel'?'month':'number'} min={frequency==='annuel'?'1900':undefined} max={frequency==='annuel'?'9999':undefined} value={frequency==='journalier'?value.debut:frequency==='mensuel'?value.debut.slice(0,7):value.debut.slice(0,4)} onChange={e=>select(frequency,frequency==='journalier'?e.target.value:frequency==='mensuel'?e.target.value+'-01':e.target.value+'-01-01')}/></label>}</div><p className="text-xs text-slate-600">Période enregistrée : {value.debut} au {value.fin}.</p>{!canonical && <p className="text-xs text-amber-800">Ancienne période conservée. Choisissez une période calendaire pour l’utiliser dans les nouveaux rapports ; aucune conversion automatique.</p>}</div>
}
