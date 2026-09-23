import { formatDate, type ReportRow } from './agent-reporting'
import { checkTeamReport, teamModel, TEAM_METRICS, COLLECTIVE_METRICS, type TeamReport, type TeamTotals, type TeamMember } from './team-reporting'

export { COLLECTIVE_METRICS } from './team-reporting'
export const AGENCY_METRICS = [...TEAM_METRICS, ...COLLECTIVE_METRICS] as const
export type AgencyTotals = TeamTotals & Record<typeof COLLECTIVE_METRICS[number][0], number> & { nb_equipes: number; nb_sans_equipe: number }
export type AgencyMember = TeamMember & { equipe_id: string | null }
export type AgencyTeam = { equipe_id: string | null; equipe_nom: string; nb_fiches: number; total_smart: number; total_restant: number }
export type AgencyReport = Omit<TeamReport, 'equipe' | 'chef_inclus' | 'synthese' | 'par_membre'> & { agence: { id: string; nom: string }; synthese: AgencyTotals; par_membre: AgencyMember[]; par_equipe: AgencyTeam[] }
export type CollectiveObjectives = { ok: true; objectifs: { id: string; titre: string; date_debut: string; date_fin: string; progressions: { champ: string; libelle: string; cible: number; realise: number | null; pct: number | null; mesurable: boolean }[] }[] }
export function asTeam(r: AgencyReport): TeamReport { return { ...r, equipe: { id: r.agence.id, nom: r.agence.nom, agence: '' }, chef_inclus: true } }
export function checkAgencyReport(r: AgencyReport) {
  checkTeamReport(asTeam(r))
  for (const [key] of COLLECTIVE_METRICS) if (r.synthese[key] == null || !Number.isFinite(Number(r.synthese[key]))) throw new Error('Mesures agence incomplètes. Vérifiez le Lot 7.1.')
  for (const [col, key] of [['total_smart','total_smart'],['nb_fiches','nb_fiches'],['total_restant','total_restant']] as const) {
    const sum = r.par_equipe.reduce((s, row) => s + Number(row[col]), 0)
    if (!Number.isFinite(sum) || Math.abs(sum - Number(r.synthese[key])) > 0.01) throw new Error('Ventilation agence incohérente. Actualisez.')
  }
  const effective = r.details_reactivations.filter(row => row.reactif === true)
  const sum = (rows: ReportRow[], key: string) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)
  const detailTotals = {
    total_reactivations_effectives: effective.length,
    total_reactivations_montant: sum(effective, 'montant_cotise'),
    total_augmentations_nb: r.details_augmentations.length,
    total_augmentations_montant: r.details_augmentations.reduce((total, row) => total + Math.max(Number(row.nouvelle_mise ?? 0) - Number(row.ancienne_mise ?? 0), 0), 0),
    total_assurances_nb: sum(r.details_assurances, 'nb'),
    total_assurances_montant: sum(r.details_assurances, 'montant'),
  }
  for (const key of Object.keys(detailTotals) as (keyof typeof detailTotals)[]) if (!Number.isFinite(detailTotals[key]) || Math.abs(detailTotals[key] - Number(r.synthese[key])) > 0.01) throw new Error('Les détails métier divergent de la synthèse. Actualisez.')
}
export function agencyModel(r: AgencyReport) {
  checkAgencyReport(r)
  const model = teamModel(asTeam(r))
  model.title = 'Rapport de collecte — agence'
  model.agent = r.agence.nom
  model.sections[0].rows = AGENCY_METRICS.map(([key, label, money]) => ({ label, value: r.synthese[key], unit: money ? 'FCFA' : 'Nombre' }))
  model.sections.splice(1, 0, { title: 'Par équipe', columns: [{ key: 'equipe_nom', label: 'Équipe' }, { key: 'nb_fiches', label: 'Fiches' }, { key: 'total_smart', label: 'SMART', money: true }, { key: 'total_restant', label: 'Manquant restant', money: true }], rows: r.par_equipe })
  const names = new Map(r.par_equipe.map(t => [t.equipe_id, t.equipe_nom]))
  for (const section of model.sections.filter(s => ['Réactivations','Augmentations','Assurances'].includes(s.title))) {
    // The agency RPC does not return these fields; do not export empty invented columns.
    section.columns = section.columns.filter(c => !['commentaire', 'motif'].includes(c.key))
    section.columns.splice(2, 0, { key: 'equipe_nom', label: 'Équipe' })
    section.rows = section.rows.map(row => ({ ...row, equipe_nom: names.get(row.equipe_id as string | null) || (row.equipe_id ? 'Équipe rattachée' : 'Sans équipe') }))
    if (section.title === 'Augmentations') section.rows = section.rows.map(row => ({ ...row, hausse: Math.max(Number(row.nouvelle_mise ?? 0) - Number(row.ancienne_mise ?? 0), 0) }))
  }
  model.scope = [
    { label: 'Agence', value: r.agence.nom },
    { label: 'Période', value: model.period },
    { label: 'Équipe', value: 'Toutes les équipes, sans équipe inclus' },
    { label: 'Collaborateurs', value: 'Agents et chefs, contributions des suspendus conservées' },
    { label: 'Données incluses', value: r.statuts.map(s => ({validee:'Fiches validées',en_attente:'En attente',a_corriger:'À corriger'})[s]).join(', ') },
  ]
  return model
}
// UTC construction on day 1 prevents end-of-month rollover and local timezone shifts.
export function sixMonths(end: string) {
  const [year, month] = end.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 6 + i, 1))
    const key = date.toISOString().slice(0, 7)
    return { key, label: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }), debut: key + '-01' }
  })
}
export function monthlySeries(rows: ReportRow[], end: string) {
  return sixMonths(end).map(m => ({ ...m, total: rows.filter(r => String(r.date).startsWith(m.key)).reduce((s, r) => s + Number(r.smart), 0) }))
}
export const periodLabel = (p: { debut: string; fin: string }) => `${formatDate(p.debut)} – ${formatDate(p.fin)}`
