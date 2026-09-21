export interface FicheAvecEcart {
  montant_smart?: number | null
  montant_mobilise?: number | null
  montant_caisse?: number | null
  montant_rapporte?: number | null
  montant_regularise?: number | null
}

export function getEcart(fiche?: FicheAvecEcart | null) {
  if (!fiche) return 0

  const smart = fiche.montant_smart ?? fiche.montant_mobilise ?? 0
  const caisse = fiche.montant_caisse ?? fiche.montant_rapporte ?? 0
  return smart - caisse
}

export function getRestant(fiche?: FicheAvecEcart | null) {
  if (!fiche) return 0
  return Math.max(0, Math.abs(getEcart(fiche)) - (fiche.montant_regularise ?? 0))
}
