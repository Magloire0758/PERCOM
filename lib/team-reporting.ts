import { formatDate, type Period, type ReportRow, type Statut } from './agent-reporting'
import type { ExportModel, Column } from './agent-export-model'

export const TEAM_METRICS = [
  ['total_smart', 'SMART', true], ['total_caisse', 'Caisse', true],
  ['total_commission', 'Commissions', true], ['total_comptes_dat', 'Comptes DAT', false],
  ['total_adhesions', 'Adhésions', false], ['total_lyde_cash', 'Lydé Cash', false],
  ['total_manquant', 'Manquant initial', true], ['total_surplus', 'Surplus initial', true],
  ['total_regularise', 'Régularisations', true], ['total_restant', 'Manquant restant', true],
  ['total_surplus_restant', 'Surplus restant', true], ['nb_fiches', 'Fiches', false],
  ['nb_membres', 'Membres rattachés', false], ['nb_membres_actifs', 'Membres actifs', false],
] as const
export const COLLECTIVE_METRICS = [
  ['total_reactivations_effectives', 'Réactivations effectives', false], ['total_reactivations_montant', 'Montant réactivé', true],
  ['total_augmentations_nb', 'Augmentations de mise', false], ['total_augmentations_montant', 'Hausse des mises', true],
  ['total_assurances_nb', 'Assurances', false], ['total_assurances_montant', 'Montant assurances', true],
  ['total_depot_dat', 'Dépôts DAT', true], ['total_depot_dav', 'Dépôts DAV', true], ['total_depot_pe', 'Dépôts PE', true],
] as const
// Lot 6 reports remain readable; Lot 7.1 adds these measures without changing signatures.
export function availableTeamMetrics(totals: TeamTotals) {
  return [...TEAM_METRICS, ...COLLECTIVE_METRICS.filter(([key]) => totals[key] != null && Number.isFinite(Number(totals[key])))]
}
export type TeamMember = { agent_id: string; nom: string; prenom: string; role: string; actif: boolean; est_chef: boolean; nb_fiches: number; total_smart: number; total_manquant_restant: number }
export type TeamTotals = Record<typeof TEAM_METRICS[number][0], number> & Partial<Record<typeof COLLECTIVE_METRICS[number][0], number>>
export type TeamAggregates = { ok: true; equipe_id: string; totaux: TeamTotals; par_membre: TeamMember[] }
export type TeamReport = { ok: true; equipe: { id: string; nom: string; agence: string }; periode: Period; statuts: Statut[]; chef_inclus: boolean; synthese: TeamTotals; par_membre: TeamMember[]; par_jour: ReportRow[]; details_reactivations: ReportRow[]; details_augmentations: ReportRow[]; details_assurances: ReportRow[] }
export type QueueRow = { fiche_id: string; agent_id: string; nom: string; prenom: string; membre_actif: boolean; est_moi: boolean; date: string; anciennete_jours: number; statut: Statut; smart: number; caisse: number; ecart: number; peut_traiter: boolean }
export type TeamQueue = { ok: true; total_filtre: number; page: number; taille: number; compteurs: { en_attente: number; a_corriger: number; validees: number }; fiches: QueueRow[] }
export type TeamRanking = { ok: true; classement: { agent_id: string; nom: string; prenom: string; actif: boolean; est_chef: boolean; est_moi: boolean; rang: number; total_smart: number }[] }

export function checkTeamReport(r: TeamReport) {
  if (!r.synthese || !Array.isArray(r.par_jour) || !Array.isArray(r.par_membre) || !Array.isArray(r.details_reactivations) || !Array.isArray(r.details_augmentations) || !Array.isArray(r.details_assurances)) throw new Error('Rapport équipe incomplet.')
  for (const [key] of TEAM_METRICS) if (!Number.isFinite(Number(r.synthese[key]))) throw new Error('Totaux équipe incomplets.')
  const check = (rows: ReportRow[], col: string, key: keyof TeamTotals) => {
    const sum = rows.reduce((s, row) => s + Number(row[col]), 0)
    if (!Number.isFinite(sum) || Math.abs(sum - Number(r.synthese[key])) > 0.01) throw new Error('Les totaux équipe divergent. Actualisez le rapport.')
  }
  for (const [col, key] of [['smart','total_smart'], ['caisse','total_caisse'], ['commission','total_commission'], ['manquant','total_manquant'], ['surplus','total_surplus'], ['comptes_dat','total_comptes_dat'], ['adhesions','total_adhesions'], ['nb_fiches','nb_fiches']] as const) check(r.par_jour, col, key)
  check(r.par_membre, 'total_smart', 'total_smart'); check(r.par_membre, 'nb_fiches', 'nb_fiches'); check(r.par_membre, 'total_manquant_restant', 'total_restant')
  if (r.par_membre.length !== Number(r.synthese.nb_membres) || r.par_membre.filter(m => m.actif).length !== Number(r.synthese.nb_membres_actifs)) throw new Error('Effectif équipe incohérent.')
}
export function teamModel(r: TeamReport): ExportModel {
  checkTeamReport(r)
  const columns = (items: [string, string, boolean?][]): Column[] => items.map(([key, label, money]) => ({ key, label, money }))
  const dated = (rows: ReportRow[]) => rows.map(row => ({ ...row, date: formatDate(String(row.date)) }))
  return {
    title: 'Rapport de collecte — équipe', agent: `${r.equipe.nom} · ${r.equipe.agence || ''}`,
    period: `${formatDate(r.periode.debut)} – ${formatDate(r.periode.fin)}`,
    status: `${r.statuts.length === 1 && r.statuts[0] === 'validee' ? 'OFFICIEL — fiches validées' : 'PRÉVISUALISATION — ' + r.statuts.map(s => ({ en_attente: 'En attente', a_corriger: 'À corriger', validee: 'Validées' })[s]).join(', ')} · ${r.chef_inclus ? 'Chef inclus' : 'Collaborateurs seuls'} · Rattachement actuel, membres suspendus inclus`,
    generated: new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' }), sections: [
      { title: 'Synthèse', columns: columns([['label','Indicateur'],['value','Valeur'],['unit','Unité']]), rows: availableTeamMetrics(r.synthese).map(([key,label,money]) => ({ label, value: r.synthese[key]!, unit: money ? 'FCFA' : 'Nombre' })) },
      { title: 'Par membre', columns: columns([['membre','Membre'],['fonction','Rôle'],['etat','Compte'],['nb_fiches','Fiches'],['total_smart','SMART',true],['total_manquant_restant','Manquant restant',true]]), rows: r.par_membre.map(m => ({ ...m, membre: `${m.prenom} ${m.nom}`, fonction: m.est_chef ? 'Chef' : 'Agent', etat: m.actif ? 'Actif' : 'Inactif / suspendu' })) },
      { title: 'Par jour', columns: columns([['date','Date'],['nb_fiches','Fiches'],['smart','SMART',true],['caisse','Caisse',true],['manquant','Manquant initial',true],['surplus','Surplus initial',true],['commission','Commission',true],['comptes_dat','Comptes DAT'],['adhesions','Adhésions']]), rows: dated(r.par_jour) },
      { title: 'Réactivations', columns: columns([['date','Date'],['membre','Membre'],['n_client','N° client'],['nom_prenom','Client'],['produit','Produit'],['mise','Mise',true],['nouvelle_mise','Nouvelle mise',true],['montant_cotise','Cotisation',true],['reactif','Effective'],['commentaire','Commentaire']]), rows: dated(r.details_reactivations) },
      { title: 'Augmentations', columns: columns([['date','Date'],['membre','Membre'],['nom_client','Client'],['ancienne_mise','Ancienne mise',true],['nouvelle_mise','Nouvelle mise',true],['hausse','Hausse',true],['motif','Motif']]), rows: dated(r.details_augmentations) },
      { title: 'Assurances', columns: columns([['date','Date'],['membre','Membre'],['type_assurance','Type'],['nb','Nombre'],['montant','Montant',true]]), rows: dated(r.details_assurances) },
    ],
  }
}
