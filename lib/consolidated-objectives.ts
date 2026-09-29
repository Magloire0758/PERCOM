import { formatDate, type Period, type ReportRow, type Statut } from './agent-reporting'
import type { ExportModel, Column } from './agent-export-model'

export const OBJECTIVE_MEASURES = [
  ['cible_montant_smart','Montant SMART'],['cible_montant_caisse','Montant caisse'],['cible_commissions','Commissions'],
  ['cible_comptes_dat','Comptes DAT'],['cible_adhesions','Adhésions'],['cible_lyde_cash','Lydé Cash'],
  ['cible_reactivations_nb','Réactivations (nombre)'],['cible_reactivations_montant','Réactivations (montant)'],
  ['cible_augmentations_nb','Augmentations (nombre)'],['cible_augmentations_montant','Augmentations (montant)'],
  ['cible_assurances_nb','Assurances (nombre)'],['cible_assurances_montant','Assurances (montant)'],
  ['cible_depot_dat','Dépôts DAT'],['cible_depot_dav','Dépôts DAV'],['cible_depot_pe','Dépôts PE'],
] as const
export type ObjectiveMeasure = typeof OBJECTIVE_MEASURES[number][0]
export type ObjectiveAccounts = 'actif' | 'inactif' | 'tous'
export type ConsolidatedReport = {
  ok: true
  meta: { mesure: ObjectiveMeasure; libelle_mesure: string; date_debut: string; date_fin: string; statuts: Statut[]; comptes: ObjectiveAccounts; agence_id: string|null; periode_partielle: boolean }
  lignes_agent: ReportRow[]; sous_totaux: ReportRow[]; total_general: ReportRow
}
export function validObjectiveSelection(mesure: unknown, comptes: unknown, agenceId: unknown) {
  return OBJECTIVE_MEASURES.some(([key])=>key===mesure) && ['actif','inactif','tous'].includes(String(comptes)) &&
    (agenceId===null || typeof agenceId==='string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(agenceId))
}
export function consolidatedArgs(mesure: ObjectiveMeasure, comptes: ObjectiveAccounts, agenceId: string|null, periode: Period, statuts: Statut[]) {
  return {p_mesure:mesure,p_comptes:comptes,p_agence_id:agenceId,p_date_debut:periode.debut,p_date_fin:periode.fin,p_statuts:statuts}
}
const sources:Record<string,string>={reseau:'Objectif réseau',somme_agences_officielles:'Somme des objectifs officiels des agences',somme_agents:'Somme des objectifs agents',officiel:'Objectif agence',somme:'Objectifs agents'}
export function objectiveSource(value:unknown) { return sources[String(value)] || 'Non défini' }
export function consolidatedModel(report: ConsolidatedReport): ExportModel {
  if(report.ok!==true || !report.meta || !Array.isArray(report.lignes_agent) || !Array.isArray(report.sous_totaux) || !report.total_general) throw new Error('Rapport consolidé incomplet.')
  const money=!['_nb','comptes_dat','adhesions','lyde_cash'].some(s=>report.meta.mesure.endsWith(s))
  const column=(key:string,label:string,amount=false):Column=>({key,label,money:amount})
  const aggregateColumns=[column('agence_nom','Périmètre'),column('objectif_officiel','Objectif de référence',money),column('objectif_cumule_agents','Objectifs agents',money),column('realise','Réalisé',money),column('taux_officiel','Taux référence (%)'),column('taux_agents','Taux agents (%)'),column('ecart_officiel','Écart référence',money),column('ecart_agents','Écart agents',money),column('objectif_source','Origine de la référence'),column('objectif_partiel','Période partielle')]
  const totals=[{...report.total_general,agence_nom:report.meta.agence_id?'Total agence':'Total réseau',objectif_source:objectiveSource(report.total_general.objectif_source),objectif_partiel:report.meta.periode_partielle}]
  const agencies=report.sous_totaux.map(r=>({...r,objectif_source:objectiveSource(r.objectif_source)}))
  const gaps=[column('membre','Collaborateur / périmètre'),column('agence_nom','Agence'),column('ecart_caisse_manquant','Manquant initial',true),column('ecart_caisse_surplus','Surplus initial',true),column('regularise','Régularisé',true),column('manquant_restant','Manquant restant',true),column('surplus_restant','Surplus restant',true)]
  return {
    title:'Rapport consolidé des objectifs',agent:'PERCOM',period:`${formatDate(report.meta.date_debut)} – ${formatDate(report.meta.date_fin)}`,
    status:report.meta.statuts.length===1 && report.meta.statuts[0]==='validee'?'Fiches validées':'PROVISOIRE · inclut des fiches non validées',
    generated:new Date().toLocaleString('fr-FR',{timeZone:'Africa/Lome'}),
    scope:[{label:'Mesure',value:report.meta.libelle_mesure},{label:'Unité',value:money?'FCFA':'Nombre'},
      {label:'Agence',value:report.meta.agence_id?(report.sous_totaux.find(r=>r.agence_id===report.meta.agence_id)?.agence_nom as string || report.meta.agence_id):'Toutes les agences · sans agence inclus'},
      {label:'Comptes',value:{actif:'Actifs',inactif:'Inactifs / suspendus',tous:'Tous'}[report.meta.comptes]},
      {label:'Statuts des fiches',value:report.meta.statuts.map(s=>({validee:'Validées',en_attente:'En attente',a_corriger:'À corriger'}[s])).join(', ')},
      {label:'Lecture des taux',value:'Même réalisé filtré ; référence officielle et objectifs agents distincts.'},
      {label:'Période',value:report.meta.periode_partielle?'Progression vers les objectifs complets ; période partielle, sans proratisation.':'Période couvrant les objectifs retenus.'}],
    sections:[
      {title:'Total du périmètre',columns:aggregateColumns,rows:totals},
      {title:'Résultats par agence',columns:aggregateColumns,rows:agencies},
      {title:'Résultats par agent',columns:[column('membre','Agent'),column('n','N°'),column('agence_nom','Agence'),column('objectif','Objectif',money),column('realise','Réalisé',money),column('taux','Taux (%)'),column('ecart','Écart A − B',money),column('nb_objectifs','Objectifs cumulés'),column('objectif_partiel','Période partielle')],rows:report.lignes_agent.map(r=>({...r,membre:r.agent_nom}))},
      {title:'Écarts et régularisations',columns:gaps,rows:[...report.lignes_agent.map(r=>({...r,membre:r.agent_nom})),...agencies.map(r=>({...r,membre:'Sous-total agence'})),...totals.map(r=>({...r,membre:'Total'}))]},
      {title:'Commentaires des fiches',columns:[column('membre','Agent'),column('agence_nom','Agence'),column('nb_commentaires','Fiches commentées'),column('dernier_commentaire_date','Date de la fiche'),column('dernier_commentaire','Dernier commentaire')],rows:report.lignes_agent.map(r=>({...r,membre:r.agent_nom,dernier_commentaire_date:r.dernier_commentaire_date?formatDate(String(r.dernier_commentaire_date)):null}))},
    ],
  }
}
