'use client'

import { formatDate, formatNumber } from '@/lib/agent-reporting'
import type { CollectiveObjectives } from '@/lib/agency-reporting'
import { ChartPanel } from './NetworkCharts'

export default function ObjectiveProgressCards({ goals }: { goals: CollectiveObjectives['objectifs'] }) {
  if (!goals.length) return <p className="text-sm text-slate-500">Aucun objectif actif à cette date.</p>
  return <div className="space-y-3">{goals.map(goal => <details key={goal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <summary className="cursor-pointer"><strong className="text-sm">{goal.titre}</strong><span className="mt-1 block text-xs text-slate-500">{formatDate(goal.date_debut)} – {formatDate(goal.date_fin)} · {goal.progressions.length} indicateur(s)</span></summary>
    {!goal.progressions.length && <p className="mt-4 text-sm text-slate-500">Aucune cible positive renseignée.</p>}
    <div className="my-4 grid gap-3 sm:grid-cols-2">{goal.progressions.map(p => <p key={p.champ} className="text-xs"><span className="block text-slate-500">{p.libelle}</span><strong>{p.mesurable && p.realise !== null ? `${formatNumber(p.realise)} / ${formatNumber(p.cible)} · ${p.pct===null?'—':formatNumber(p.pct)} %` : 'Non mesuré'}</strong></p>)}</div>
    {!!goal.progressions.length && <ChartPanel title="Avancement par indicateur" preference="ra-objectifs"><div className="space-y-5">{goal.progressions.map(p => {
      if (!p.mesurable || p.pct === null || !Number.isFinite(p.pct)) return <p key={p.champ} className="text-xs text-slate-500">{p.libelle} : non mesurable</p>
      const scale = Math.max(100, Math.ceil(p.pct / 50) * 50)
      return <div key={p.champ}><div className="flex justify-between gap-3 text-xs"><span>{p.libelle}</span><strong>{formatNumber(p.pct)} %</strong></div><div role="img" aria-label={`${p.libelle} : ${formatNumber(p.pct)} %, cible 100 %`} className="relative mt-2 h-3 rounded-full bg-slate-200"><div className={'h-full rounded-full '+(p.pct>=100?'bg-emerald-600':'bg-blue-600')} style={{width:`${Math.max(0,p.pct)/scale*100}%`}}/><span className="absolute -top-1 h-5 border-l-2 border-slate-700" style={{left:`${100/scale*100}%`}}/></div><p className="mt-2 text-right text-[10px] text-slate-500">Repère : cible 100 % · Échelle 0–{scale} %</p></div>
    })}</div></ChartPanel>}
  </details>)}</div>
}
