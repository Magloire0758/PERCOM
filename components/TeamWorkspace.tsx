'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Users, FileCheck2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { assertRpc, formatDate, formatNumber, monthPeriod, validPeriod, type DailyReport, type Statut } from '@/lib/agent-reporting'
import { dailyModel, type ExportModel } from '@/lib/agent-export-model'
import { checkTeamReport, availableTeamMetrics, type TeamAggregates, type TeamQueue, type TeamReport, type TeamRanking, type QueueRow } from '@/lib/team-reporting'
import { useTeamRpc } from '@/lib/use-team-rpc'
import AgentInsights from './AgentInsights'
import AgentExportButtons from './AgentExportButtons'

const button = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-900 disabled:opacity-40 disabled:cursor-not-allowed'
const input = 'mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm'
const labels = { en_attente: 'En attente', a_corriger: 'À corriger', validee: 'Validées' }

export default function TeamWorkspace({ teamId, mode, isDark, onDecision, explicitExport = false }: { teamId: string | null; mode: 'queue' | 'stats'; isDark: boolean; onDecision: () => void; explicitExport?: boolean }) {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [period, setPeriod] = useState(monthPeriod)
  const [preview, setPreview] = useState(false)
  const [includeChef, setIncludeChef] = useState(true)
  const [member, setMember] = useState('')
  const [status, setStatus] = useState<Statut>('en_attente')
  const [dates, setDates] = useState({ debut: '', fin: '' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<QueueRow | null>(null)
  const available = !!teamId
  const roster = useTeamRpc<TeamAggregates>('equipe_agregats', { p_equipe_id: teamId, p_date_debut: monthPeriod().debut, p_date_fin: monthPeriod().fin }, available)
  const dateOK = (!dates.debut || !dates.fin || dates.debut <= dates.fin)
  const queue = useTeamRpc<TeamQueue>('equipe_file_traitement', { p_equipe_id: teamId, p_statuts: [status], p_membre_id: member || null, p_date_debut: dates.debut || null, p_date_fin: dates.fin || null, p_page: page, p_taille: 20 }, available && mode === 'queue' && dateOK)
  const valid = validPeriod(period) && (Date.parse(period.fin) - Date.parse(period.debut)) / 86400000 < 366
  const statuts: Statut[] = preview ? ['en_attente', 'a_corriger', 'validee'] : ['validee']
  const report = useTeamRpc<TeamReport>('rapport_equipe', { p_equipe_id: teamId, p_date_debut: period.debut, p_date_fin: period.fin, p_statuts: statuts, p_inclure_chef: includeChef }, available && mode === 'stats' && !member && valid)
  const ranking = useTeamRpc<TeamRanking>('classement_equipe', { p_equipe_id: teamId, p_date_debut: period.debut, p_date_fin: period.fin, p_inclure_suspendus: includeInactive }, available && mode === 'stats' && !member && valid)
  let checked = report.data
  let consistencyError = ''
  if (checked) { try { checkTeamReport(checked) } catch (e) { consistencyError = e instanceof Error ? e.message : 'Rapport incohérent.'; checked = null } }
  const panel = { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }
  if (!teamId) return <div role="status" className="rounded-2xl border p-6" style={panel}>Aucune équipe rattachée à votre compte. Vos performances personnelles restent accessibles.</div>
  const selectedName = roster.data?.par_membre.find(m => m.agent_id === member)
  const refresh = () => { void roster.refresh(); void queue.refresh(); void report.refresh(); void ranking.refresh() }
  return <section className="space-y-5" style={{ color: isDark ? '#f1f5f9' : '#172554' }} aria-label={mode === 'queue' ? 'File équipe' : 'Statistiques équipe'}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Espace équipe</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{mode === 'queue' ? 'Fiches à traiter' : 'Les résultats de votre équipe'}</h2><p className="mt-2 text-sm opacity-70">{mode === 'queue' ? 'Les plus récentes d’abord. Vos fiches sont incluses.' : 'Des totaux consolidés, sans additionner deux fois vos résultats.'}</p></div>
      <button className={button} onClick={refresh}><RefreshCw size={16} />Actualiser l’équipe</button>
    </div>
    <div className="rounded-2xl border p-4" style={panel}>
      <label className="block text-sm font-medium">Membre<select aria-label="Membre" className={input} value={member} onChange={e => { setMember(e.target.value); setPage(1) }}><option value="">Toute l’équipe</option>{roster.data?.par_membre.map(m => <option key={m.agent_id} value={m.agent_id}>{m.prenom} {m.nom}{m.est_chef ? ' · Chef' : ''}{!m.actif ? ' · Inactif / suspendu' : ''}</option>)}</select></label>
      {roster.error && <p role="alert" className="mt-2 text-sm text-red-600">Liste des membres indisponible : {roster.error}</p>}
      {mode === 'queue' && <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm">Depuis<input type="date" className={input} value={dates.debut} onChange={e => { setDates(d => ({ ...d, debut: e.target.value })); setPage(1) }} /></label><label className="text-sm">Jusqu’au<input type="date" className={input} value={dates.fin} onChange={e => { setDates(d => ({ ...d, fin: e.target.value })); setPage(1) }} /></label><button className={button + ' self-end'} onClick={() => { setDates({ debut: '', fin: '' }); setMember(''); setPage(1) }}>Tout l’historique</button></div>}
    </div>
    {mode === 'queue' && <>
      {!dateOK && <p role="alert" className="text-red-600">La fin doit être postérieure au début.</p>}
      <div className="grid grid-cols-3 gap-2" aria-label="Statuts des fiches">
        {(['en_attente', 'a_corriger', 'validee'] as const).map(s => <button key={s} aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1) }} className={`rounded-2xl border p-3 text-left transition ${status === s ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'border-slate-300'}`}><span className="block text-xs sm:text-sm">{labels[s]}</span><span className="mt-1 block text-xl font-bold">{queue.data ? queue.data.compteurs[s === 'validee' ? 'validees' : s] : '—'}</span></button>)}
      </div>
      <p className="text-xs opacity-70">Compteurs selon le membre et les dates sélectionnés. Les comptes suspendus restent visibles.</p>
      {queue.busy && <p role="status">Chargement de la file…</p>}
      {queue.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{queue.error}</p>}
      {queue.data && <>
        <div className="flex items-center justify-between gap-2 text-sm"><span>{queue.data.total_filtre} fiche(s) · Page {page} / {Math.max(1, Math.ceil(queue.data.total_filtre / 20))}</span><div className="flex gap-2"><button aria-label="Page précédente" className={button} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button><button aria-label="Page suivante" className={button} disabled={page * 20 >= queue.data.total_filtre} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button></div></div>
        {!queue.data.fiches.length && <div className="rounded-2xl border p-8 text-center" style={panel}><FileCheck2 className="mx-auto mb-3 opacity-50" size={32} /><p>Aucune fiche sur cette page pour ces filtres.</p></div>}
        <div className="grid gap-3 lg:grid-cols-2">{queue.data.fiches.map(f => <article key={f.fiche_id} className="rounded-2xl border p-5 shadow-sm" style={panel}><div className="flex justify-between gap-2"><div><h3 className="font-semibold">{f.prenom} {f.nom}{f.est_moi ? ' · Moi' : ''}</h3><p className="mt-1 text-sm opacity-70">{formatDate(f.date)} · {f.anciennete_jours} jour(s)</p>{!f.membre_actif && <span className="text-xs text-amber-700">Compte inactif / suspendu</span>}</div><span className="h-fit rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{labels[f.statut]}</span></div><div className="my-4 grid grid-cols-2 gap-3"><div><p className="text-xs opacity-70">SMART</p><p className="font-bold">{formatNumber(f.smart)} F</p></div><div><p className="text-xs opacity-70">Caisse</p><p className="font-bold">{formatNumber(f.caisse)} F</p></div></div><button className={button + ' w-full'} onClick={() => setSelected(f)}>Ouvrir la fiche</button></article>)}</div>
      </>}
    </>}
    {mode === 'stats' && member && <div className="space-y-4"><h3 className="text-lg font-bold">Performances de {selectedName?.prenom} {selectedName?.nom}</h3><p className="text-sm opacity-70">Rapport individuel du membre sélectionné, distinct du rapport consolidé d’équipe.</p><AgentInsights key={member} agentId={member} hasAgency={false} mode="stats" isDark={isDark} /></div>}
    {mode === 'stats' && !member && <>
      <div className="rounded-2xl border p-4 space-y-4" style={panel}><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Du<input className={input} type="date" value={period.debut} onChange={e => setPeriod(p => ({ ...p, debut: e.target.value }))} /></label><label className="text-sm">Au<input className={input} type="date" value={period.fin} onChange={e => setPeriod(p => ({ ...p, fin: e.target.value }))} /></label><button className={button + ' self-end'} onClick={() => setPeriod(monthPeriod())}>Mois en cours</button></div><label className="block text-sm">Données équipe<select className={input} value={preview ? 'preview' : 'official'} onChange={e => setPreview(e.target.value === 'preview')}><option value="official">Officiel — fiches validées</option><option value="preview">Prévisualisation — tous statuts</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeChef} onChange={e => setIncludeChef(e.target.checked)} />Inclure les chefs dans les résultats</label><p className="text-xs opacity-70">FCFA · Lomé · 366 jours maximum · Membres actuellement rattachés, y compris suspendus.</p></div>
      {!valid && <p role="alert" className="text-red-600">Choisissez une période valide de 366 jours maximum.</p>}
      {preview && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Prévisualisation : inclut les fiches en attente et à corriger.</p>}
      {report.busy && <p role="status">Calcul du rapport équipe…</p>}
      {(report.error || consistencyError) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{report.error || consistencyError}</p>}
      {checked && <>
        <div className="rounded-2xl bg-blue-950 p-6 text-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-blue-200">{checked.equipe.nom} · {includeChef ? 'Chef inclus' : 'Collaborateurs seuls'}</p><h3 className="mt-2 text-3xl font-bold tracking-tight">{formatNumber(checked.synthese.total_smart)} <span className="text-base font-normal">FCFA</span></h3><p className="mt-2 text-sm text-blue-200">SMART · {formatDate(period.debut)} au {formatDate(period.fin)}</p></div><Users size={30} className="text-blue-300" /></div><div className="mt-5"><AgentExportButtons target={{ type: 'equipe', equipeId: explicitExport ? teamId : undefined, periode: period, statuts, inclureChef: includeChef }} /></div></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{availableTeamMetrics(checked.synthese).filter(([key]) => key !== 'total_smart').map(([key, label, money]) => <div key={key} className="rounded-2xl border p-4" style={panel}><p className="text-xs opacity-70">{label}</p><p className="mt-2 text-lg font-semibold">{formatNumber(checked.synthese[key]!)}{money ? ' F' : ''}</p></div>)}</div>
        <div className="rounded-2xl border p-4" style={panel}><h3 className="mb-3 font-bold">Contributions par membre</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Membre</th><th className="p-2">Fiches</th><th className="p-2 text-right">SMART</th><th className="p-2 text-right">Manquant restant</th></tr></thead><tbody>{checked.par_membre.map(m => <tr key={m.agent_id} className="border-b last:border-0"><td className="p-2"><button className="text-left underline" onClick={() => setMember(m.agent_id)}>{m.prenom} {m.nom}</button><div className="text-xs opacity-60">{m.est_chef ? 'Chef' : 'Agent'}{!m.actif ? ' · Inactif / suspendu' : ''}</div></td><td className="p-2">{m.nb_fiches}</td><td className="p-2 text-right whitespace-nowrap">{formatNumber(m.total_smart)} F</td><td className="p-2 text-right whitespace-nowrap">{formatNumber(m.total_manquant_restant)} F</td></tr>)}</tbody></table></div></div>
        <div className="rounded-2xl border p-4" style={panel}><h3 className="mb-3 font-bold">Rapport par jour</h3>{!checked.par_jour.length && <p className="text-sm">Aucune fiche pour cette période.</p>}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{['Date','Fiches','SMART','Caisse','Commission'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{checked.par_jour.map(j => <tr key={String(j.date)} className="border-b last:border-0"><td className="p-2 whitespace-nowrap">{formatDate(String(j.date))}</td>{['nb_fiches','smart','caisse','commission'].map(k => <td key={k} className="p-2 whitespace-nowrap">{formatNumber(Number(j[k]))}</td>)}</tr>)}</tbody></table></div></div>
      </>}
      <div className="rounded-2xl border p-4" style={panel}><h3 className="font-bold">Classement intra-équipe</h3><p className="my-2 text-xs opacity-70">SMART validé uniquement · Même période · {includeInactive ? 'Tous les rattachés, suspendus inclus.' : 'Membres actifs uniquement, chefs inclus.'} Ce classement conserve ce périmètre quels que soient les filtres ci-dessus.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />Inclure les comptes suspendus dans le classement</label>{ranking.busy && <p role="status">Chargement…</p>}{ranking.error && <p role="alert" className="text-red-600">{ranking.error}</p>}{ranking.data?.classement.map(m => <div key={m.agent_id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0 text-sm"><span><strong className="mr-3">{m.rang}</strong>{m.prenom} {m.nom}{m.est_moi ? ' · Moi' : ''}{!m.actif ? ' · Inactif' : ''}</span><strong className="whitespace-nowrap">{formatNumber(m.total_smart)} F</strong></div>)}</div>
    </>}
    {selected && <DecisionSheet key={selected.fiche_id} row={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); void queue.refresh(); void roster.refresh(); onDecision() }} />}
  </section>
}

export function DecisionSheet({ row, onClose, onDone }: { row: QueueRow; onClose: () => void; onDone: () => void }) {
  const detail = useTeamRpc<DailyReport>('rapport_fiche_journaliere', { p_fiche_id: row.fiche_id })
  const [action, setAction] = useState('valider')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const currentStatus = detail.data?.entete.statut
  const canAct = !!detail.data && currentStatus !== 'validee' && row.peut_traiter
  async function submit() {
    if (lock.current || !canAct) return
    if (action === 'demander_correction' && (currentStatus !== 'en_attente' || !comment.trim())) { setError('Indiquez la correction attendue sur une fiche en attente.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const r = await supabase.rpc('traiter_validation_fiche', { p_fiche_id: row.fiche_id, p_action: action, p_commentaire: comment.trim() || null })
      assertRpc(r.data, r.error); onDone()
    } catch (e) { setError(e instanceof Error ? e.message : 'Décision impossible.'); void detail.refresh() }
    finally { lock.current = false; setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!busy) onClose() }} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5"><div><h2 className="text-xl font-bold">Fiche du {formatDate(row.date)}</h2><p className="text-sm text-slate-500">{row.prenom} {row.nom}{row.est_moi ? ' · Votre fiche' : ''}</p></div><button className={button} disabled={busy} onClick={onClose}><ArrowLeft size={16} />Fermer</button></div>
    <div className="space-y-5 p-5">{detail.busy && <p role="status">Chargement du rapport complet…</p>}{detail.error && <p role="alert" className="text-red-700">{detail.error}</p>}
      {detail.data && <><AgentExportButtons target={{ type: 'fiche', ficheId: row.fiche_id }} /><ReportPreview model={dailyModel(detail.data)} /></>}
      {canAct && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3"><h3 className="font-bold">Décision sur cette fiche</h3><label className="block text-sm">Action<select className={input} value={action} disabled={busy} onChange={e => setAction(e.target.value)}><option value="valider">Valider la fiche</option>{currentStatus === 'en_attente' && <option value="demander_correction">Demander une correction</option>}</select></label><label className="block text-sm">Commentaire {action === 'demander_correction' ? '(obligatoire)' : '(facultatif)'}<textarea className={input} rows={3} value={comment} disabled={busy} onChange={e => setComment(e.target.value)} /></label><button className={button + ' bg-blue-900 text-white'} disabled={busy || detail.busy || (action === 'demander_correction' && !comment.trim())} onClick={() => void submit()}>{busy ? 'Enregistrement…' : 'Confirmer la décision'}</button></div>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>
  </dialog>
}

function ReportPreview({ model }: { model: ExportModel }) {
  return <div className="space-y-4"><p className="text-xs text-slate-500">{model.status}</p>{model.sections.map(s => <section key={s.title}><h3 className="mb-2 font-semibold">{s.title}</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{s.columns.map(c => <th className="border-b p-2" key={c.key}>{c.label}</th>)}</tr></thead><tbody>{s.rows.map((r, i) => <tr key={i}>{s.columns.map(c => <td className="border-b p-2" key={c.key}>{r[c.key] === null || r[c.key] === undefined ? '—' : typeof r[c.key] === 'boolean' ? r[c.key] ? 'Oui' : 'Non' : c.money ? formatNumber(Number(r[c.key])) : String(r[c.key])}</td>)}</tr>)}</tbody></table>{!s.rows.length && <p className="p-2 text-xs text-slate-500">Aucun détail.</p>}</div></section>)}</div>
}
