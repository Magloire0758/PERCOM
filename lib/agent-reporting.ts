export const STATUTS = ['en_attente', 'a_corriger', 'validee'] as const
export type Statut = typeof STATUTS[number]
export type Period = { debut: string; fin: string }
export type ExportRequest = { format: 'pdf' | 'xlsx' } & (
  | { type: 'fiche'; ficheId: string }
  | { type: 'equipe'; equipeId?: string; periode: Period; statuts: Statut[]; inclureChef: boolean }
  | { type: 'reseau'; sections?: import('./network-export-sections').NetworkSectionId[]; filtres: import('./network-reporting').NetworkFilters; periode: Period; statuts: Statut[] }
  | { type: 'agence'; agenceId?: string; periode: Period; statuts: Statut[] }
  | { type: 'intervalle' | 'statistiques'; agentId?: string; periode: Period; statuts: Statut[] }
)

export const METRICS = [
  ['total_smart', 'SMART', true], ['total_caisse', 'Caisse', true],
  ['total_commission', 'Commissions', true], ['total_manquant', 'Manquant initial', true],
  ['total_surplus', 'Surplus initial', true], ['total_regularise', 'Régularisations', true],
  ['total_restant', 'Manquant restant', true], ['total_surplus_restant', 'Surplus restant', true],
  ['total_comptes_dat', 'Comptes DAT', false], ['total_comptes_actives', 'Comptes activés', false],
  ['total_clients_parcourus', 'Clients parcourus', false], ['total_adhesions', 'Adhésions', false],
  ['total_lyde_cash', 'Lydé Cash', false], ['reactivations_dossiers', 'Dossiers de réactivation', false],
  ['reactivations_effectives', 'Réactivations effectives', false], ['reactivations_montant', 'Montant réactivé', true],
  ['augmentations_nb', 'Augmentations de mise', false], ['augmentations_hausse', 'Hausse des mises', true],
  ['assurances_nb', 'Assurances', false], ['assurances_montant', 'Montant assurances', true],
  ['total_depot_pe', 'Dépôts PE', true], ['total_depot_dat', 'Dépôts DAT', true], ['total_depot_dav', 'Dépôts DAV', true],
  ['conformite_sans_ecart_initial', 'Fiches sans écart initial', false],
  ['conformite_ecart_solde', 'Fiches avec écart soldé', false], ['nb_fiches', 'Fiches retenues', false],
] as const
export type Metric = typeof METRICS[number][0]
export type Aggregates = { ok: true; par_statut: Partial<Record<Statut, number>> } & Record<Metric, number>
export type Regularity = { ok: true; jours_ouvres: number; jours_renseignes: number; pct: number | null }
export type Objectives = { ok: true; objectifs: { id: string; titre: string; date_debut: string; date_fin: string; progressions: { champ: string; libelle: string; cible: number; realise: number; pct: number }[] }[] }
export type Ranking = { ok: true; classement: { agent_id: string; nom: string; prenom: string; rang: number; est_moi: boolean; total_smart: number }[] }
export type Comparison = { ok: true; periode_actuelle: Period; periode_precedente: Period; actuel: Aggregates; precedent: Aggregates; variations: Partial<Record<Metric, { actuel: number; precedent: number; delta: number; pct: number | null }>> }
export type ReportRow = Record<string, string | number | boolean | null>
export type IntervalReport = { ok: true; agent: { nom: string; prenom: string }; periode: Period; statuts: Statut[]; jours_renseignes: number; lignes: ReportRow[]; details_reactivations: ReportRow[]; details_augmentations: ReportRow[]; details_assurances: ReportRow[]; totaux: Aggregates }
export type DailyReport = { ok: true; entete: { agent: string; agence: string | null; equipe: string | null; zone: string | null; date: string; statut: Statut; heure_soumission: string | null; valideur: { nom: string; prenom: string } | null; commentaire_chef: string | null }; montants: ReportRow; activite: ReportRow; reactivations: ReportRow[]; augmentations: ReportRow[]; assurances: ReportRow[]; observations: string | null }

export function todayLome() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function monthPeriod(date = todayLome()): Period { return { debut: date.slice(0, 7) + '-01', fin: date } }
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function validPeriod(p: Period) { return validDate(p.debut) && validDate(p.fin) && p.debut <= p.fin }
export function formatNumber(value: number) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value) }
export function formatDate(value: string) { return validDate(value) ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Lome' }).format(new Date(value + 'T12:00:00Z')) : value }
export function assertRpc<T>(data: unknown, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    throw new Error(data && typeof data === 'object' && 'erreur' in data ? String(data.erreur) : 'Réponse serveur invalide.')
  }
  return data as T
}

// The report is refused if its summary and daily rows disagree: never publish an inconsistent export.
export function checkReport(report: IntervalReport) {
  const pairs = [ ['smart','total_smart'], ['caisse','total_caisse'], ['commission','total_commission'], ['manquant','total_manquant'], ['surplus','total_surplus'], ['regularise','total_regularise'], ['restant','total_restant'], ['surplus_restant','total_surplus_restant'], ['comptes_dat','total_comptes_dat'], ['clients','total_clients_parcourus'], ['adhesions','total_adhesions'], ['lyde_cash','total_lyde_cash'], ['reactivations_effectives','reactivations_effectives'], ['reactivations_montant','reactivations_montant'], ['augmentations_nb','augmentations_nb'], ['augmentations_hausse','augmentations_hausse'], ['assurances_nb','assurances_nb'], ['assurances_montant','assurances_montant'], ['depot_pe','total_depot_pe'], ['depot_dat','total_depot_dat'], ['depot_dav','total_depot_dav'] ] as const
  if (!Array.isArray(report.lignes) || report.totaux?.ok !== true) throw new Error('Rapport incomplet.')
  for (const [column, metric] of pairs) {
    const total = report.lignes.reduce((sum, row) => sum + Number(row[column]), 0)
    if (!Number.isFinite(total) || !Number.isFinite(Number(report.totaux[metric])) || Math.abs(total - Number(report.totaux[metric])) > 0.01) throw new Error('Les données ont changé ou les totaux divergent. Actualisez le rapport.')
  }
  if (report.lignes.length !== Number(report.totaux.nb_fiches) || new Set(report.lignes.map(row => row.date)).size !== report.lignes.length) throw new Error('Le détail journalier est incohérent. Actualisez le rapport.')
}
