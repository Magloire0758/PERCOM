import { METRICS, formatDate, type Comparison, type DailyReport, type IntervalReport, type Objectives, type Regularity, type ReportRow } from './agent-reporting'

export type Column = { key: string; label: string; money?: boolean }
export type Section = { title: string; columns: Column[]; rows: ReportRow[] }
export type ExportModel = { title: string; agent: string; period: string; status: string; generated: string; sections: Section[] }
const cols = (items: [string, string, boolean?][]): Column[] => items.map(([key, label, money]) => ({ key, label, money }))
const summaryColumns = cols([['label', 'Indicateur'], ['value', 'Valeur'], ['unit', 'Unité']])
const reactivationColumns = cols([['date', 'Date'], ['n_client', 'N° client'], ['nom_prenom', 'Client'], ['produit', 'Produit'], ['mise', 'Mise', true], ['nouvelle_mise', 'Nouvelle mise', true], ['montant_cotise', 'Cotisation', true], ['reactif', 'Effective'], ['commentaire', 'Commentaire']])
const augmentationColumns = cols([['date', 'Date'], ['nom_client', 'Client'], ['ancienne_mise', 'Ancienne mise', true], ['nouvelle_mise', 'Nouvelle mise', true], ['hausse', 'Hausse', true], ['motif', 'Motif']])
const assuranceColumns = cols([['date', 'Date'], ['type_assurance', 'Type'], ['nb', 'Nombre'], ['montant', 'Montant', true]])
const statusLabels: Record<string, string> = { validee: 'Validée', en_attente: 'En attente', a_corriger: 'À corriger' }
function base(title: string, agent: string, period: string, status: string): ExportModel {
  return { title, agent, period, status, generated: new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' }), sections: [] }
}
export function intervalModel(report: IntervalReport, statistics?: { comparison: Comparison; regularity: Regularity; objectives: Objectives }): ExportModel {
  const model = base(statistics ? 'Statistiques de collecte' : 'Rapport de collecte par journée', `${report.agent.prenom} ${report.agent.nom}`, `${formatDate(report.periode.debut)} – ${formatDate(report.periode.fin)}`, report.statuts.length === 1 && report.statuts[0] === 'validee' ? 'OFFICIEL — fiches validées' : 'PRÉVISUALISATION — ' + report.statuts.map(s => statusLabels[s]).join(', '))
  model.sections.push({ title: 'Synthèse', columns: summaryColumns, rows: [
    ...METRICS.map(([key, label, money]) => ({ label, value: report.totaux[key], unit: money ? 'FCFA' : 'Nombre' })),
    ...Object.entries(report.totaux.par_statut).map(([s, n]) => ({ label: `Période tous statuts — ${statusLabels[s] || s}`, value: n ?? 0, unit: 'Fiches' })),
  ] })
  const lines = report.lignes.map(row => ({ ...row, date: formatDate(String(row.date)), statut: statusLabels[String(row.statut)] || String(row.statut) }))
  model.sections.push({ title: 'Détail journalier', columns: cols([
    ['date','Date'], ['statut','Statut'], ['smart','SMART',true], ['caisse','Caisse',true], ['manquant','Manquant initial',true], ['surplus','Surplus initial',true], ['regularise','Régularisé',true], ['restant','Manquant restant',true], ['surplus_restant','Surplus restant',true], ['commission','Commission',true],
    ['clients','Clients'], ['comptes_dat','Comptes DAT'], ['adhesions','Adhésions'], ['lyde_cash','Lydé Cash'], ['reactivations_effectives','Réactivations effectives'], ['reactivations_montant','Montant réactivé',true], ['augmentations_nb','Augmentations'], ['augmentations_hausse','Hausse des mises',true], ['assurances_nb','Assurances'], ['assurances_montant','Montant assurances',true], ['depot_pe','Dépôt PE',true], ['depot_dat','Dépôt DAT',true], ['depot_dav','Dépôt DAV',true],
  ]), rows: lines })
  const dated = (rows: ReportRow[]) => rows.map(row => ({ ...row, date: formatDate(String(row.date)) }))
  model.sections.push({ title: 'Réactivations', columns: reactivationColumns, rows: dated(report.details_reactivations) }, { title: 'Augmentations', columns: augmentationColumns, rows: dated(report.details_augmentations) }, { title: 'Assurances', columns: assuranceColumns, rows: dated(report.details_assurances) })
  if (statistics) {
    const { regularity, comparison, objectives } = statistics
    model.sections[0].rows.push({ label: 'Jours ouvrés (lundi-vendredi, tous statuts, jusqu’à aujourd’hui)', value: regularity.jours_ouvres, unit: 'Jours' }, { label: 'Jours ouvrés renseignés', value: regularity.jours_renseignes, unit: 'Jours' }, { label: 'Régularité', value: regularity.pct, unit: '%' })
    model.sections.push({ title: 'Comparaison', columns: cols([['label','Indicateur'], ['previousPeriod','Période précédente'], ['precedent','Précédent'], ['actuel','Actuel'], ['delta','Écart'], ['pct','Variation (%)'], ['unit','Unité']]), rows: METRICS.flatMap(([key, label, money]) => { const v = comparison.variations[key]; return v ? [{ label, previousPeriod: `${formatDate(comparison.periode_precedente.debut)} – ${formatDate(comparison.periode_precedente.fin)}`, ...v, unit: money ? 'FCFA' : 'Nombre' }] : [] }) })
    model.sections.push({ title: 'Objectifs actuels', columns: cols([['titre','Objectif'], ['periode','Période effective'], ['libelle','Cible'], ['cible','Attendu'], ['realise','Réalisé validé'], ['pct','Progression (%)']]), rows: objectives.objectifs.flatMap(o => o.progressions.map(p => ({ titre: o.titre, periode: `${formatDate(o.date_debut)} – ${formatDate(o.date_fin)}`, libelle: p.libelle, cible: p.cible, realise: p.realise, pct: p.pct }))) })
  }
  return model
}
export function dailyModel(report: DailyReport): ExportModel {
  const h = report.entete
  const model = base('Fiche de rapport journalier', h.agent, formatDate(h.date), h.statut === 'validee' ? 'OFFICIEL — fiche validée' : `BROUILLON — ${statusLabels[h.statut]}`)
  const labels: Record<string, string> = { smart: 'SMART', caisse: 'Caisse', ecart_initial: 'Écart initial (SMART - caisse)', type_ecart: 'Nature de l’écart', regularise: 'Régularisé', restant: 'Manquant restant', surplus_restant: 'Surplus restant', commission: 'Commission', comptes_dat: 'Comptes DAT', comptes_actives: 'Comptes activés', clients_parcourus: 'Clients parcourus', adhesions: 'Adhésions', lyde_cash: 'Lydé Cash', depot_pe: 'Dépôt PE', depot_dat: 'Dépôt DAT', depot_dav: 'Dépôt DAV' }
  model.sections.push({ title: 'Synthèse', columns: summaryColumns, rows: [
    ...Object.entries(report.montants).map(([key, value]) => ({ label: labels[key] || key, value, unit: key === 'type_ecart' ? '' : 'FCFA' })),
    ...Object.entries(report.activite).map(([key, value]) => ({ label: labels[key] || key, value, unit: key.startsWith('depot_') ? 'FCFA' : 'Nombre' })),
  ] })
  model.sections.push({ title: 'Informations', columns: cols([['label','Rubrique'], ['value','Valeur']]), rows: [
    { label: 'Agence actuelle', value: h.agence }, { label: 'Équipe de la fiche', value: h.equipe }, { label: 'Zone', value: h.zone },
    { label: 'Soumission (Lomé)', value: h.heure_soumission ? new Date(h.heure_soumission).toLocaleString('fr-FR', { timeZone: 'Africa/Lome' }) : null },
    { label: 'Validateur', value: h.valideur ? `${h.valideur.prenom} ${h.valideur.nom}` : null },
    { label: 'Commentaire du chef', value: h.commentaire_chef }, { label: 'Observations', value: report.observations },
  ] })
  const dated = (rows: ReportRow[]): ReportRow[] => rows.map(row => ({ ...row, date: formatDate(h.date) }))
  model.sections.push({ title: 'Réactivations', columns: reactivationColumns, rows: dated(report.reactivations) }, { title: 'Augmentations', columns: augmentationColumns, rows: dated(report.augmentations).map(row => ({ ...row, hausse: Math.max(0, Number(row.nouvelle_mise ?? 0) - Number(row.ancienne_mise ?? 0)) })) }, { title: 'Assurances', columns: assuranceColumns, rows: dated(report.assurances) })
  return model
}
