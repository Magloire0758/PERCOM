import type { ExportModel } from './agent-export-model'
export const NETWORK_SECTIONS = [
  ['synthese','Synthèse'], ['agences','Par agence'], ['equipes','Par équipe'],
  ['collaborateurs','Par collaborateur'], ['journees','Par journée'],
  ['reactivations','Réactivations'], ['augmentations','Augmentations'], ['assurances','Assurances'],
] as const
export type NetworkSectionId = typeof NETWORK_SECTIONS[number][0]
export function validNetworkSections(value: unknown): value is NetworkSectionId[] {
  return Array.isArray(value) && value.length>0 && value.length<=NETWORK_SECTIONS.length && new Set(value).size===value.length && value.every(v=>NETWORK_SECTIONS.some(([id])=>id===v))
}
export function selectNetworkSections(model: ExportModel, selected?: NetworkSectionId[]): ExportModel {
  if(selected===undefined) return model
  if(!validNetworkSections(selected)) throw new Error('Sections invalides.')
  const titles=NETWORK_SECTIONS.filter(([id])=>selected.includes(id)).map(([,title])=>title)
  return {...model,selectionLabel:selected.length===NETWORK_SECTIONS.length?'Rapport complet':`Rapport personnalisé · ${selected.length} section(s)`,sections:model.sections.filter(s=>titles.some(t=>t===s.title))}
}
