'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { METRICS, assertRpc, checkReport, formatDate, formatNumber, monthPeriod, todayLome, validPeriod, type Aggregates, type Comparison, type IntervalReport, type Objectives, type Ranking, type Regularity, type Statut } from '@/lib/agent-reporting'
import AgentExportButtons from './AgentExportButtons'

type Snapshot = { totals: Aggregates; regularity: Regularity; objectives: Objectives; ranking: Ranking | null; report: IntervalReport | null; comparison: Comparison | null }
export default function AgentInsights({ agentId, hasAgency, mode, isDark }: { agentId: string; hasAgency: boolean; mode: 'home' | 'stats'; isDark: boolean }) {
  const [period, setPeriod] = useState(() => monthPeriod())
  const [preview, setPreview] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [updated, setUpdated] = useState('')
  const sequence = useRef(0)
  const cancelPending = useCallback(() => { sequence.current++ }, [])
  const valid = validPeriod(period) && (Date.parse(period.fin) - Date.parse(period.debut)) / 86400000 < 366
  const statuts: Statut[] = preview ? ['en_attente', 'a_corriger', 'validee'] : ['validee']
  const load = useCallback(async () => {
    const id = ++sequence.current
    setSnapshot(null); setError(''); setBusy(true)
    if (!validPeriod(period) || (Date.parse(period.fin) - Date.parse(period.debut)) / 86400000 >= 366) { setError('Choisissez une période valide de 366 jours maximum.'); setBusy(false); return }
    try {
      const args = { p_agent_id: agentId, p_date_debut: period.debut, p_date_fin: period.fin }
      const filtered = { ...args, p_statuts: preview ? ['en_attente', 'a_corriger', 'validee'] : ['validee'] }
      const month = monthPeriod()
      const [totalsResult, regularityResult, objectivesResult, rankingResult, reportResult, comparisonResult] = await Promise.all([
        supabase.rpc('agent_agregats', filtered),
        supabase.rpc('agent_regularite', args),
        supabase.rpc('agent_objectifs_avec_progression', { p_agent_id: agentId, p_date: todayLome() }),
        hasAgency && mode === 'home' ? supabase.rpc('obtenir_classement_agence', { p_date_debut: month.debut, p_date_fin: month.fin }) : null,
        mode === 'stats' ? supabase.rpc('rapport_intervalle', filtered) : null,
        mode === 'stats' ? supabase.rpc('agent_comparaison', filtered) : null,
      ])
      const totals = assertRpc<Aggregates>(totalsResult.data, totalsResult.error)
      const report = reportResult ? assertRpc<IntervalReport>(reportResult.data, reportResult.error) : null
      const comparison = comparisonResult ? assertRpc<Comparison>(comparisonResult.data, comparisonResult.error) : null
      if (report) checkReport(report)
      for (const [key] of METRICS) {
        if (!Number.isFinite(Number(totals[key]))) throw new Error('Indicateurs incomplets.')
        if ((report && Math.abs(Number(report.totaux[key]) - Number(totals[key])) > 0.01) || (comparison && Math.abs(Number(comparison.actuel[key]) - Number(totals[key])) > 0.01)) throw new Error('Les données ont changé pendant la lecture. Actualisez pour obtenir des totaux cohérents.')
      }
      const next = { totals, report, comparison, regularity: assertRpc<Regularity>(regularityResult.data, regularityResult.error), objectives: assertRpc<Objectives>(objectivesResult.data, objectivesResult.error), ranking: rankingResult ? assertRpc<Ranking>(rankingResult.data, rankingResult.error) : null }
      if (id === sequence.current) { setSnapshot(next); setUpdated(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Lome' })) }
    } catch (e) { if (id === sequence.current) setError(e instanceof Error ? e.message : 'Lecture impossible.') }
    finally { if (id === sequence.current) setBusy(false) }
  }, [agentId, hasAgency, mode, period, preview])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const timer = window.setInterval(refresh, 60_000)
    const channel = supabase.channel(`agent-insights-${agentId}-${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiches_journalieres', filter: `agent_id=eq.${agentId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectifs', filter: `agent_id=eq.${agentId}` }, refresh).subscribe()
    return () => { cancelPending(); clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); void supabase.removeChannel(channel) }
  }, [agentId, cancelPending, load, mode])

  const card = { backgroundColor: isDark ? '#1e293b' : 'white', color: isDark ? '#f1f5f9' : '#172554', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }
  return <section className="space-y-4" aria-label={mode === 'home' ? 'Bilan agent' : 'Statistiques et rapports'}>
    <div className="rounded-2xl p-4 space-y-3" style={card}>
      <div className="flex items-center justify-between gap-2"><h2 className="font-bold">{mode === 'home' ? 'Mon bilan du mois' : 'Statistiques et rapports'}</h2><button type="button" className="text-sm underline disabled:opacity-50" disabled={busy || !valid} onClick={() => void load()}>Actualiser</button></div>
      {mode === 'stats' && <p className="text-xs opacity-75">Sélectionnez jusqu’à 366 jours par rapport.</p>}
      {mode === 'stats' && <div className="flex flex-wrap gap-3">
        <label className="text-sm">Du<input aria-label="Date de début" className="block border rounded-lg p-2 bg-transparent" type="date" value={period.debut} onChange={e => { cancelPending(); setSnapshot(null); setBusy(true); setPeriod(p => ({ ...p, debut: e.target.value })) }} /></label>
        <label className="text-sm">Au<input aria-label="Date de fin" className="block border rounded-lg p-2 bg-transparent" type="date" value={period.fin} onChange={e => { cancelPending(); setSnapshot(null); setBusy(true); setPeriod(p => ({ ...p, fin: e.target.value })) }} /></label>
        <button type="button" className="text-sm underline" onClick={() => setPeriod(monthPeriod())}>Mois en cours</button>
      </div>}
      <label className="block text-sm">Données<select className="block w-full border rounded-lg p-2 mt-1 bg-transparent" value={preview ? 'preview' : 'official'} onChange={e => { cancelPending(); setSnapshot(null); setBusy(true); setPreview(e.target.value === 'preview') }}><option value="official">Officiel — fiches validées</option><option value="preview">Prévisualisation — tous statuts</option></select></label>
      <p className="text-xs">Du {formatDate(period.debut)} au {formatDate(period.fin)} · FCFA · Lomé{updated && ` · Actualisé à ${updated}`}</p>
      {preview && <p className="rounded-lg bg-amber-50 text-amber-900 p-2 text-sm">Prévisualisation : inclut les fiches en attente et à corriger.</p>}
    </div>
    {busy && <p role="status" className="text-sm" style={{ color: card.color }}>Chargement des indicateurs…</p>}
    {error && <div role="alert" className="rounded-xl p-4 bg-red-50 text-red-800">{error}</div>}
    {!busy && snapshot && <>
      {snapshot.totals.nb_fiches === 0 && <p className="rounded-xl p-3 text-sm" style={card}>Aucune fiche pour cette période et ces statuts.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {METRICS.filter(([key]) => mode === 'stats' || ['total_smart', 'total_caisse', 'total_commission', 'total_restant', 'total_surplus_restant', 'total_comptes_dat', 'reactivations_effectives', 'total_adhesions', 'nb_fiches'].includes(key)).map(([key, label, money]) => <div key={key} className="rounded-2xl p-3" style={card}><div className="text-xs opacity-75">{label}</div><div className="font-bold mt-1 break-words">{formatNumber(snapshot.totals[key])}{money ? ' F' : ''}</div></div>)}
      </div>
      <div className="rounded-2xl p-4 space-y-2 text-sm" style={card}>
        <h3 className="font-bold">Régularité et conformité</h3>
        <p>Régularité : <strong>{snapshot.regularity.pct === null ? 'Non applicable' : `${snapshot.regularity.pct} %`}</strong> — {snapshot.regularity.jours_renseignes} / {snapshot.regularity.jours_ouvres} jours ouvrés renseignés.</p>
        <p className="text-xs opacity-75">Lundi à vendredi, tous statuts, jusqu’à aujourd’hui. Les jours fériés ne sont pas déduits.</p>
        <p>Sans écart initial : <strong>{snapshot.totals.conformite_sans_ecart_initial}</strong> · Écart soldé après régularisation : <strong>{snapshot.totals.conformite_ecart_solde}</strong></p>
        <p className="text-xs">Répartition sur la période, tous statuts : {snapshot.totals.par_statut.validee ?? 0} validées · {snapshot.totals.par_statut.en_attente ?? 0} en attente · {snapshot.totals.par_statut.a_corriger ?? 0} à corriger.</p>
      </div>
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <h3 className="font-bold">Mes objectifs actuels</h3><p className="text-xs opacity-75">Objectifs individuels, progression sur leur propre période et sur les fiches validées.</p>
        {snapshot.objectives.objectifs.length === 0 && <p className="text-sm">Aucun objectif individuel actif aujourd’hui.</p>}
        {snapshot.objectives.objectifs.map(o => <article key={o.id} className="border-t pt-3 space-y-2"><h4 className="font-semibold text-sm">{o.titre}</h4><p className="text-xs">{formatDate(o.date_debut)} – {formatDate(o.date_fin)}</p>{o.progressions.length === 0 && <p className="text-xs">Aucune cible positive définie.</p>}{o.progressions.map(p => <div key={p.champ}><div className="flex justify-between gap-2 text-xs"><span>{p.libelle} : {formatNumber(p.realise)} / {formatNumber(p.cible)}</span><strong>{p.pct} %</strong></div><div className="h-2 bg-slate-200 rounded mt-1 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} /></div></div>)}</article>)}
      </div>
      {mode === 'home' && <div className="rounded-2xl p-4 space-y-2" style={card}><h3 className="font-bold">Classement de mon agence</h3><p className="text-xs opacity-75">SMART validé · mois en cours jusqu’à aujourd’hui · agents et chefs actifs, y compris à zéro.</p>{!snapshot.ranking ? <p className="text-sm">Aucune agence affectée.</p> : snapshot.ranking.classement.length === 0 ? <p className="text-sm">Aucun participant.</p> : <ol className="space-y-2">{snapshot.ranking.classement.map(row => <li key={row.agent_id} className={`flex justify-between gap-2 rounded-lg p-2 text-sm ${row.est_moi ? 'bg-blue-50 text-blue-900 font-bold' : ''}`}><span>{row.rang}. {row.prenom} {row.nom}{row.est_moi && ' (moi)'}</span><span>{formatNumber(row.total_smart)} F</span></li>)}</ol>}</div>}
      {snapshot.comparison && <div className="rounded-2xl p-4 space-y-3" style={card}><h3 className="font-bold">Comparaison à durée égale</h3><p className="text-xs">Période précédente : {formatDate(snapshot.comparison.periode_precedente.debut)} – {formatDate(snapshot.comparison.periode_precedente.fin)}. Même filtre de statuts.</p><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead><tr><th className="text-left p-2">Indicateur</th><th>Précédent</th><th>Actuel</th><th>Écart</th><th>Variation</th></tr></thead><tbody>{METRICS.map(([key, label]) => { const v = snapshot.comparison?.variations[key]; return v && <tr key={key} className="border-t"><th className="text-left font-normal p-2">{label}</th><td>{formatNumber(v.precedent)}</td><td>{formatNumber(v.actuel)}</td><td>{formatNumber(v.delta)}</td><td>{v.pct === null ? '—' : `${v.pct} %`}</td></tr> })}</tbody></table></div><p className="text-xs opacity-75">— : variation non calculable lorsque la valeur précédente est zéro.</p></div>}
      {snapshot.report && <div className="rounded-2xl p-4 space-y-3" style={card}>
        <h3 className="font-bold">Rapport par journée</h3><p className="text-xs">{snapshot.report.jours_renseignes} journées renseignées. Les jours sans fiche sont absents du tableau.</p>
        <AgentExportButtons target={{ type: 'intervalle', agentId, periode: period, statuts }} />
        <div className="overflow-x-auto"><table className="text-xs w-full text-right"><thead><tr>{['Date', 'Statut', 'SMART', 'Caisse', 'Manquant restant', 'Surplus restant'].map(h => <th key={h} className="p-2 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{snapshot.report.lignes.map(row => <tr key={String(row.date)} className="border-t"><td className="p-2 whitespace-nowrap">{formatDate(String(row.date))}</td><td>{row.statut === 'validee' ? 'Validée' : row.statut === 'a_corriger' ? 'À corriger' : 'En attente'}</td>{['smart', 'caisse', 'restant', 'surplus_restant'].map(k => <td key={k} className="p-2 whitespace-nowrap">{formatNumber(Number(row[k]))}</td>)}</tr>)}</tbody></table></div>
        <h3 className="font-bold pt-2">Exporter les statistiques</h3><p className="text-xs">Inclut les indicateurs, la régularité et la comparaison sur les filtres sélectionnés.</p><AgentExportButtons target={{ type: 'statistiques', agentId, periode: period, statuts }} />
      </div>}
    </>}
  </section>
}
