import { formatDate, formatNumber, validDate, type Period, type ReportRow, type Statut } from './agent-reporting'
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
export type ObjectiveLevel = 'agent' | 'agence' | 'global'
export type ObjectiveFrequency = 'journalier' | 'mensuel' | 'annuel'
export const REPORT_LEVELS = [['agent','Par collaborateur'],['agence','Par agence'],['global','Société']] as const
export const REPORT_FREQUENCIES = [['journalier','Jour'],['mensuel','Mois'],['annuel','Année']] as const
export type ConsolidatedReport = {
  ok: true
  meta: { contrat_version: 2; niveau: ObjectiveLevel; periodicite: ObjectiveFrequency; mesure: ObjectiveMeasure; libelle_mesure: string; date_debut: string; date_fin: string; date_arrete: string|null; statuts: Statut[]; comptes: ObjectiveAccounts; agence_id: string|null; agence_nom: string|null; objectifs_incomplets: boolean }
  lignes: ReportRow[]; total: ReportRow
}
export function objectivePeriod(frequency: ObjectiveFrequency, reference: string): Period|null {
  if(!validDate(reference))return null
  const year=Number(reference.slice(0,4)),month=Number(reference.slice(5,7))
  if(frequency==='journalier')return {debut:reference,fin:reference}
  if(frequency==='annuel')return {debut:`${reference.slice(0,4)}-01-01`,fin:`${reference.slice(0,4)}-12-31`}
  if(frequency!=='mensuel')return null
  const last=new Date(Date.UTC(year,month,0)).getUTCDate()
  return {debut:reference.slice(0,7)+'-01',fin:reference.slice(0,7)+'-'+last}
}
export function validObjectiveSelection(mesure: unknown, comptes: unknown, agenceId: unknown) {
  return OBJECTIVE_MEASURES.some(([key])=>key===mesure) && ['actif','inactif','tous'].includes(String(comptes)) &&
    (agenceId===null || typeof agenceId==='string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(agenceId))
}
export function validObjectiveReport(level: unknown, frequency: unknown, reference: unknown, agency: unknown, accounts: unknown) {
  return REPORT_LEVELS.some(([key])=>key===level) && REPORT_FREQUENCIES.some(([key])=>key===frequency) && validDate(reference) &&
    (level!=='global' || agency===null) && (level==='agent' || accounts==='tous')
}
export function consolidatedArgs(mesure: ObjectiveMeasure, comptes: ObjectiveAccounts, agenceId: string|null, niveau: ObjectiveLevel, periodicite: ObjectiveFrequency, reference: string, statuts: Statut[]) {
  return {p_mesure:mesure,p_comptes:comptes,p_agence_id:agenceId,p_niveau:niveau,p_periodicite:periodicite,p_date_reference:reference,p_statuts:statuts}
}
export function smartAgentReport(level: ObjectiveLevel, measure: ObjectiveMeasure) { return level==='agent' && measure==='cible_montant_smart' }
const numberOrNull=(v:unknown)=>v===null || typeof v==='number' && Number.isFinite(v)
export function consolidatedModel(report: ConsolidatedReport): ExportModel {
  if(report?.ok!==true || report.meta?.contrat_version!==2 || !Array.isArray(report.lignes) || !report.total || !validObjectiveReport(report.meta.niveau,report.meta.periodicite,report.meta.date_debut,report.meta.agence_id,report.meta.comptes) || !validObjectiveSelection(report.meta.mesure,report.meta.comptes,report.meta.agence_id))throw new Error('Rapport de période indisponible. Le nouveau contrat backend est requis.')
  for(const row of [...report.lignes,report.total]) for(const key of ['objectif','realise','taux','ecart'])if(!numberOrNull(row[key]))throw new Error('Rapport incomplet : valeur de calcul absente.')
  const money=!['_nb','comptes_dat','adhesions','lyde_cash'].some(s=>report.meta.mesure.endsWith(s))
  const column=(key:string,label:string,amount=false):Column=>({key,label,money:amount})
  const level=report.meta.niveau,smart=smartAgentReport(level,report.meta.mesure)
  const title=level==='agent'?'Rapport par collaborateur':level==='agence'?'Rapport par agence':'Rapport global société'
  const columns=[column('n','N°'),...(level==='agent'?[column('agence_nom','Agences'),column('agent_nom',"Nom de l’agent")]:[column('agence_nom',level==='agence'?'Agences':'Société')]),column('objectif','Objectifs',money),column('realise','Réalisé',money),column('taux','Taux de réalisation (%)'),column('ecart','Écart (A - B)',money),...(smart?[column('autres_ecarts','Autres écarts'),column('regularisation_commentaire','Régularisation / commentaire')]:[])]
  const present=(row:ReportRow):ReportRow=>({...row,
    objectif:row.objectif_statut==='conflit'?'À régulariser':row.objectif===null?'Non défini':row.objectif,
    ...(smart?{autres_ecarts:`Manquant : ${formatNumber(Number(row.ecart_caisse_manquant || 0))} F · Surplus : ${formatNumber(Number(row.ecart_caisse_surplus || 0))} F`,regularisation_commentaire:[`${formatNumber(Number(row.regularise || 0))} F régularisés`,row.dernier_commentaire_date?formatDate(String(row.dernier_commentaire_date)):null,row.dernier_commentaire].filter(Boolean).join(' · ')}:{})})
  const total=present({...report.total,n:'Total',agence_nom:report.meta.objectifs_incomplets?'Objectifs incomplets':'',agent_nom:''})
  return {title,agent:'PERCOM',period:`${formatDate(report.meta.date_debut)} – ${formatDate(report.meta.date_fin)}`,
    status:report.meta.statuts.length===1 && report.meta.statuts[0]==='validee'?'OFFICIEL · fiches validées':'PROVISOIRE · fiches non validées incluses',
    generated:new Date().toLocaleString('fr-FR',{timeZone:'Africa/Lome'}),
    scope:[{label:'Indicateur',value:report.meta.libelle_mesure+' · '+(money?'FCFA':'Nombre')},
      {label:'Périodicité',value:REPORT_FREQUENCIES.find(([key])=>key===report.meta.periodicite)![1]},
      {label:'Périmètre',value:level==='global'?'Toute la société':report.meta.agence_nom || 'Toutes les agences'},
      {label:'Réalisé arrêté au',value:report.meta.date_arrete?formatDate(report.meta.date_arrete):'Période future · aucun réalisé'},
      {label:'Comptes',value:{actif:'Actifs',inactif:'Inactifs / suspendus',tous:'Tous'}[report.meta.comptes]},
      {label:'Lecture',value:report.meta.objectifs_incomplets?'Objectifs incomplets : taux et écart du total non calculés.':'Un objectif du même niveau et de la période exacte. Aucun remplacement ni proratisation.'},
      {label:'Statuts des fiches',value:report.meta.statuts.map(s=>({validee:'Validées',en_attente:'En attente',a_corriger:'À corriger'}[s])).join(', ')}],
    sections:[{title,columns,rows:[...report.lignes.map(present),total]}],
  }
}

// Storage keys, rather than historical free dates, determine the reporting period.
export function storedObjectivePeriod(goal: {type_periodicite:string;jour_date?:unknown;mois:number|null;annee:number|null;date_debut:string|null;date_fin:string|null}) {
  const reference=goal.type_periodicite==='journalier'?String(goal.jour_date || ''):goal.annee?`${goal.annee}-${String(goal.type_periodicite==='annuel'?1:goal.mois || 1).padStart(2,'0')}-01`:''
  return objectivePeriod(goal.type_periodicite as ObjectiveFrequency,reference) || {debut:goal.date_debut || '',fin:goal.date_fin || ''}
}
export function objectiveStorage(periodicite:string, reference:string) {
  const period=objectivePeriod(periodicite as ObjectiveFrequency,reference)
  if(!period)throw new Error('Choisissez une période jour, mois ou année valide.')
  return {type_periodicite:periodicite,jour_date:periodicite==='journalier'?reference:null,mois:periodicite==='annuel'?1:Number(reference.slice(5,7)),annee:Number(reference.slice(0,4)),date_debut:period.debut,date_fin:period.fin}
}
export function objectiveValues(values:Record<string,string>) {
  return Object.fromEntries(Object.entries(values).map(([key,value])=>{
    if(value.trim()==='')return [key,null]
    const n=Number(value),integer=key.endsWith('_nb') || ['cible_comptes_dat','cible_adhesions','cible_lyde_cash'].includes(key)
    if(!Number.isFinite(n) || n<0 || integer && !Number.isInteger(n))throw new Error('Les cibles doivent être positives ou nulles ; les compteurs doivent être entiers.')
    return [key,n]
  }))
}
