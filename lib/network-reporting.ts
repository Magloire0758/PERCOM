import { formatDate, type Period, type Statut, type ReportRow } from './agent-reporting'
import { AGENCY_METRICS } from './agency-reporting'
import type { ExportModel, Section } from './agent-export-model'
export const NO_ATTACHMENT = '00000000-0000-0000-0000-000000000000'
export type NetworkFilters = { agenceId: string | null; equipeId: string | null; membreId: string | null; agenceActive: boolean | null }
export const emptyNetworkFilters: NetworkFilters = { agenceId: null, equipeId: null, membreId: null, agenceActive: null }
export function networkArgs(f: NetworkFilters) { return { p_agence_id: f.agenceId, p_equipe_id: f.equipeId, p_membre_id: f.membreId, p_agence_active: f.agenceActive } }
export function validNetworkFilters(f: unknown): f is NetworkFilters {
  if (!f || typeof f !== 'object') return false
  const v = f as NetworkFilters
  return [v.agenceId, v.equipeId, v.membreId].every(id => id === null || typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) && v.membreId !== NO_ATTACHMENT && (v.agenceActive === null || typeof v.agenceActive === 'boolean')
}
export type NetworkReport = { ok: true; periode: Period; statuts: Statut[]; filtres: Record<string, string | boolean | null>; synthese: Record<string, number>; par_agence: ReportRow[]; par_equipe: ReportRow[]; par_membre: ReportRow[]; par_jour: ReportRow[]; details_reactivations: ReportRow[]; details_augmentations: ReportRow[]; details_assurances: ReportRow[] }
export function checkNetworkReport(r: NetworkReport) {
  if (!r.synthese || !r.filtres || !r.periode || !Array.isArray(r.statuts)) throw new Error('Rapport réseau incomplet.')
  for (const key of ['par_agence','par_equipe','par_membre','par_jour','details_reactivations','details_augmentations','details_assurances'] as const) if (!Array.isArray(r[key])) throw new Error('Ventilation réseau absente.')
  for (const [key] of AGENCY_METRICS) if (r.synthese[key] == null || !Number.isFinite(Number(r.synthese[key]))) throw new Error('Synthèse réseau incomplète.')
  const check = (rows: ReportRow[], col: string, key: string) => {
    if (rows.some(row => row[col] == null || !Number.isFinite(Number(row[col])))) throw new Error('Mesure réseau absente.')
    if (Math.abs(rows.reduce((s,row) => s + Number(row[col]),0) - Number(r.synthese[key])) > 0.01) throw new Error('Les ventilations divergent de la synthèse. Actualisez.')
  }
  for (const [col,key] of [['smart','total_smart'],['caisse','total_caisse'],['commission','total_commission'],['manquant','total_manquant'],['surplus','total_surplus'],['nb_fiches','nb_fiches'],['comptes_dat','total_comptes_dat'],['adhesions','total_adhesions']]) check(r.par_jour,col,key)
  for (const rows of [r.par_equipe,r.par_membre]) { check(rows,'total_smart','total_smart'); check(rows,'total_manquant_restant','total_restant') }
  for (const key of ['total_smart','total_caisse','total_restant','total_surplus_restant','nb_fiches']) check(r.par_agence,key,key)
  const effective=r.details_reactivations.filter(row=>row.reactif===true)
  const sum=(rows:ReportRow[],key:string)=>rows.reduce((total,row)=>total+Number(row[key] ?? 0),0)
  const details={total_reactivations_effectives:effective.length,total_reactivations_montant:sum(effective,'montant_cotise'),total_augmentations_nb:r.details_augmentations.length,total_augmentations_montant:r.details_augmentations.reduce((total,row)=>total+Math.max(Number(row.nouvelle_mise ?? 0)-Number(row.ancienne_mise ?? 0),0),0),total_assurances_nb:sum(r.details_assurances,'nb'),total_assurances_montant:sum(r.details_assurances,'montant')}
  for(const [key,value] of Object.entries(details)) if(!Number.isFinite(value) || Math.abs(value-Number(r.synthese[key]))>0.01) throw new Error('Détails métier incohérents avec la synthèse.')
}
const section = (title: string, rows: ReportRow[], fields: [string,string,boolean?][]): Section => ({ title, rows, columns: fields.map(([key,label,money]) => ({key,label,money})) })
export type NetworkNames = { agence?: string; equipe?: string; membre?: string }
export function networkModel(r: NetworkReport, names: NetworkNames = {}): ExportModel {
  checkNetworkReport(r)
  const agencies=new Map(r.par_agence.map(a=>[a.agence_id,a.agence_nom]))
  const teams=new Map(r.par_equipe.filter(t=>t.equipe_id).map(t=>[t.equipe_id,t.equipe_nom]))
  const named=(rows:ReportRow[])=>rows.map(row=>({...row,agence_nom:agencies.get(row.agence_id) || (row.agence_id?'Agence rattachée':'Sans agence'),equipe_nom:teams.get(row.equipe_id) || (row.equipe_id?'Équipe rattachée':'Sans équipe')}))
  const member=r.par_membre.find(m=>m.agent_id===r.filtres.membre_id)
  const scope = [
    {label:'Période',value:`Du ${formatDate(r.periode.debut)} au ${formatDate(r.periode.fin)}`},
    {label:'Agence',value:!r.filtres.agence_id?'Toutes les agences':r.filtres.agence_id===NO_ATTACHMENT?'Sans agence':names.agence || String(agencies.get(r.filtres.agence_id) || 'Agence sélectionnée indisponible')},
    {label:'Équipe',value:!r.filtres.equipe_id?'Toutes les équipes':r.filtres.equipe_id===NO_ATTACHMENT?'Sans équipe':names.equipe || String(teams.get(r.filtres.equipe_id) || 'Équipe sélectionnée indisponible')},
    {label:'Collaborateur',value:!r.filtres.membre_id?'Tous les agents et chefs':names.membre || (member?`${member.prenom} ${member.nom}`:'Collaborateur sélectionné indisponible')},
    {label:'État des agences',value:r.filtres.agence_active===null?'Toutes':r.filtres.agence_active?'Actives uniquement':'Inactives et sans agence'},
    {label:'Données incluses',value:r.statuts.map(s=>({validee:'Fiches validées',en_attente:'Fiches en attente',a_corriger:'Fiches à corriger'})[s]).join(' · ')},
  ]
  return { scope, title: 'Rapport de collecte — réseau', agent: 'Direction générale', period: `${formatDate(r.periode.debut)} – ${formatDate(r.periode.fin)}`, status: r.statuts.length === 1 && r.statuts[0] === 'validee' ? 'OFFICIEL — fiches validées' : 'PRÉVISUALISATION — ' + r.statuts.join(', '), generated: new Date().toLocaleString('fr-FR',{timeZone:'Africa/Lome'}), sections: [
    section('Synthèse',AGENCY_METRICS.map(([key,label,money]) => ({label,value:r.synthese[key],unit:money?'FCFA':'Nombre'})),[['label','Indicateur'],['value','Valeur'],['unit','Unité']]),
    section('Par agence',r.par_agence,[['agence_nom','Agence'],['nb_fiches','Fiches'],['total_smart','SMART',true],['total_caisse','Caisse',true],['total_restant','Manquant restant',true],['total_surplus_restant','Surplus restant',true]]),
    section('Par équipe',named(r.par_equipe),[['equipe_nom','Équipe'],['agence_nom','Agence'],['total_smart','SMART',true],['total_manquant_restant','Manquant restant',true]]),
    section('Par collaborateur',named(r.par_membre),[['prenom','Prénom'],['nom','Nom'],['role','Rôle'],['agence_nom','Agence'],['equipe_nom','Équipe'],['total_smart','SMART',true],['total_manquant_restant','Manquant restant',true]]),
    section('Par journée',r.par_jour,[['date','Date'],['nb_fiches','Fiches'],['smart','SMART',true],['caisse','Caisse',true],['commission','Commissions',true],['manquant','Manquant initial',true],['surplus','Surplus initial',true],['comptes_dat','Comptes DAT'],['adhesions','Adhésions']]),
    section('Réactivations',r.details_reactivations,[['date','Date'],['membre','Collaborateur'],['agence_nom','Agence'],['n_client','N° client'],['nom_prenom','Client'],['produit','Produit'],['mise','Mise',true],['nouvelle_mise','Nouvelle mise',true],['montant_cotise','Cotisation',true],['reactif','Effective']]),
    section('Augmentations',r.details_augmentations,[['date','Date'],['membre','Collaborateur'],['agence_nom','Agence'],['nom_client','Client'],['ancienne_mise','Ancienne mise',true],['nouvelle_mise','Nouvelle mise',true],['hausse','Hausse',true],['motif','Motif']]),
    section('Assurances',r.details_assurances,[['date','Date'],['membre','Collaborateur'],['agence_nom','Agence'],['type_assurance','Type'],['nb','Nombre'],['montant','Montant',true]])
  ] }
}
