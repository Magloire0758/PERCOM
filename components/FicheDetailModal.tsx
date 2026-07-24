'use client'

import EcartHistorique from './EcartHistorique'

interface FicheDetailModalProps {
  fiche: any
  onClose: () => void
  canValidate?: boolean
  onValidate?: () => void
}

export default function FicheDetailModal({
  fiche, onClose, canValidate = false, onValidate
}: FicheDetailModalProps) {
  if (!fiche) return null

  const smart = fiche.montant_smart ?? fiche.montant_mobilise ?? 0
  const caisse = fiche.montant_caisse ?? fiche.montant_rapporte ?? 0
  const ecart = smart - caisse
  const typeEcart = ecart > 0 ? 'manquant' : ecart < 0 ? 'surplus' : 'ok'
  const totalDepots = (fiche.montant_depot_pe || 0) + (fiche.montant_depot_dat || 0) + (fiche.montant_depot_dav || 0)

  const statutColor = fiche.statut_validation === 'validee'
    ? { bg: '#DCFCE7', color: '#166534', label: '✅ Validée' }
    : fiche.statut_validation === 'rejetee'
    ? { bg: '#FEE2E2', color: '#991B1B', label: '❌ Rejetée' }
    : fiche.statut_validation === 'a_corriger'
    ? { bg: '#FEF9C3', color: '#854D0E', label: '🔄 À corriger' }
    : { bg: '#EEF2FF', color: '#2A4E94', label: '⏳ En attente' }

  const reacts = fiche.reactivations || []
  const augs = fiche.augmentations_mise || []
  const assurs = fiche.assurances_details || []

  const totalReactCotise = reacts.reduce((s: number, r: any) => s + (r.montant_cotise || 0), 0)
  const totalAssurNb = assurs.reduce((s: number, a: any) => s + (a.nb || 0), 0)
  const totalAssurMontant = assurs.reduce((s: number, a: any) => s + (a.montant || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', fontFamily: 'var(--font-dm-sans)' }}
        onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div className="px-5 py-4 border-b flex items-start justify-between shrink-0"
          style={{ borderColor: '#f1f5f9', backgroundColor: 'white' }}>
          <div className="flex-1">
            <div className="font-bold text-base" style={{ color: '#1a1a2e' }}>
              📋 Fiche du {new Date(fiche.date).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </div>
            {fiche.agents && (
              <div className="text-sm mt-0.5" style={{ color: '#818387' }}>
                {fiche.agents?.prenom} {fiche.agents?.nom}
                {fiche.agents?.agences?.nom ? ` · ${fiche.agents.agences.nom}` : ''}
              </div>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: statutColor.bg, color: statutColor.color }}>
                {statutColor.label}
              </span>
              {fiche.heure_soumission && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                  🕐 Soumise à {new Date(fiche.heure_soumission).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-2 rounded-xl shrink-0 ml-2"
            style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
        </div>

        {/* ── CONTENU SCROLLABLE ── */}
        <div className="overflow-y-auto flex-1">

          {/* 💰 MONTANTS */}
          <Section titre="💰 MONTANTS">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'SMART (théorique)', value: smart.toLocaleString() + ' F', color: '#2A4E94' },
                { label: 'Caisse (rapporté)', value: caisse.toLocaleString() + ' F', color: '#2A4E94' },
                { label: 'Commission', value: (fiche.commission_jour || 0).toLocaleString() + ' F', color: '#854D0E' },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                  <div className="font-bold text-sm mt-0.5" style={{ color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Écart */}
            <div className="rounded-xl p-4"
              style={{
                backgroundColor: typeEcart === 'ok' ? '#F0FDF4'
                  : fiche.manquant_regle ? '#F0FDF4'
                  : typeEcart === 'manquant' ? '#FEF2F2' : '#EEF2FF',
                border: `1px solid ${typeEcart === 'ok' ? '#BBF7D0'
                  : fiche.manquant_regle ? '#BBF7D0'
                  : typeEcart === 'manquant' ? '#FECACA' : '#C7D2FE'}`
              }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium"
                    style={{
                      color: typeEcart === 'ok' || fiche.manquant_regle ? '#166534'
                        : typeEcart === 'manquant' ? '#991B1B' : '#2A4E94'
                    }}>
                    {typeEcart === 'ok' ? '✅ Aucun écart'
                      : fiche.manquant_regle
                        ? (typeEcart === 'manquant' ? '✅ Manquant réglé' : '✅ Surplus régularisé')
                        : (typeEcart === 'manquant' ? '⚠️ Manquant non réglé' : '🔵 Surplus non régularisé')}
                  </div>
                  {typeEcart !== 'ok' && (
                    <div className="font-bold text-xl mt-0.5"
                      style={{
                        color: fiche.manquant_regle ? '#166534'
                          : typeEcart === 'manquant' ? '#E4322C' : '#2A4E94'
                      }}>
                      {typeEcart === 'manquant' ? '−' : '+'} {Math.abs(ecart).toLocaleString()} FCFA
                    </div>
                  )}
                </div>
                {fiche.manquant_regle_at && (
                  <div className="text-xs text-right" style={{ color: '#818387' }}>
                    Réglé le<br />{new Date(fiche.manquant_regle_at).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* 💰 RÉGULARISATIONS */}
          {typeEcart !== 'ok' && (
            <Section titre="💰 RÉGULARISATIONS">
              <EcartHistorique
                ficheId={fiche.id}
                ecartTotal={Math.abs(ecart)}
                montantRegularise={fiche.montant_regularise || 0}
                isManquant={typeEcart === 'manquant'}
              />
            </Section>
          )}

          {/* 📊 ACTIVITÉS */}
          <Section titre="📊 ACTIVITÉS TERRAIN">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Comptes DAT', value: fiche.comptes_ouverts_dat ?? fiche.comptes_ouverts ?? 0 },
                { label: 'Adhésions', value: fiche.nb_adhesions || 0 },
                { label: 'Lydé Cash', value: fiche.nb_abonnements_lyde_cash || 0 },
                { label: 'Clients parcourus', value: fiche.nb_clients_parcourus || 0 },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#f8fafc' }}>
                  <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{k.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{k.label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* 🏧 AUTRES DÉPÔTS */}
          {totalDepots > 0 && (
            <Section titre="🏧 AUTRES DÉPÔTS">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'PE (Prêt Épargne)', value: fiche.montant_depot_pe || 0 },
                  { label: 'DAT (Dépôt À Terme)', value: fiche.montant_depot_dat || 0 },
                  { label: 'DAV (Dépôt À Vue)', value: fiche.montant_depot_dav || 0 },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{k.value.toLocaleString()} F</div>
                    <div className="text-xs mt-0.5" style={{ color: '#818387' }}>{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#EEF2FF' }}>
                <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
                  Total : {totalDepots.toLocaleString()} F
                </span>
              </div>
            </Section>
          )}

          {/* 🔄 RÉACTIVATIONS */}
          <Section titre={`🔄 RÉACTIVATIONS (${reacts.length})`}>
            {reacts.length === 0 ? (
              <div className="text-center py-4 rounded-xl text-xs"
                style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                Aucune réactivation ce jour
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {reacts.map((r: any, i: number) => (
                    <div key={r.id || i} className="rounded-xl p-3 border"
                      style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>
                            {r.nom_prenom}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
                            {r.n_client ? `N° ${r.n_client} · ` : ''}{r.produit || 'TONTINE'}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{
                            backgroundColor: r.reactif ? '#DCFCE7' : '#FEE2E2',
                            color: r.reactif ? '#166534' : '#991B1B'
                          }}>
                          {r.reactif ? '✅ Réactivé' : '❌ Non réactivé'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Mise actuelle', value: (r.mise || 0).toLocaleString() + ' F', color: '#818387' },
                          { label: 'Nouvelle mise', value: (r.nouvelle_mise || 0).toLocaleString() + ' F', color: '#2A4E94' },
                          { label: 'Montant cotisé', value: (r.montant_cotise || 0).toLocaleString() + ' F', color: '#166534' },
                        ].map(k => (
                          <div key={k.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                            <div className="text-xs" style={{ color: '#818387' }}>{k.label}</div>
                            <div className="font-semibold text-xs mt-0.5" style={{ color: k.color }}>{k.value}</div>
                          </div>
                        ))}
                      </div>
                      {r.commentaire && (
                        <div className="mt-2 px-2 py-1.5 rounded-lg text-xs italic"
                          style={{ backgroundColor: 'white', color: '#818387' }}>
                          💬 {r.commentaire}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#EEF2FF' }}>
                  <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
                    Total cotisé : {totalReactCotise.toLocaleString()} F
                  </span>
                </div>
              </>
            )}
          </Section>

          {/* 📈 AUGMENTATIONS DE MISE */}
          <Section titre={`📈 AUGMENTATIONS DE MISE (${augs.length})`}>
            {augs.length === 0 ? (
              <div className="text-center py-4 rounded-xl text-xs"
                style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                Aucune augmentation ce jour
              </div>
            ) : (
              <div className="space-y-2">
                {augs.map((a: any, i: number) => (
                  <div key={a.id || i} className="rounded-xl p-3 border"
                    style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }}>
                    <div className="text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>
                      {a.nom_client}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                        <div className="text-xs" style={{ color: '#818387' }}>Ancienne</div>
                        <div className="font-semibold text-xs mt-0.5" style={{ color: '#991B1B' }}>
                          {(a.ancienne_mise || 0).toLocaleString()} F
                        </div>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                        <div className="text-xs" style={{ color: '#818387' }}>Nouvelle</div>
                        <div className="font-semibold text-xs mt-0.5" style={{ color: '#166534' }}>
                          {(a.nouvelle_mise || 0).toLocaleString()} F
                        </div>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                        <div className="text-xs" style={{ color: '#818387' }}>Motif</div>
                        <div className="font-semibold text-xs mt-0.5" style={{ color: '#1a1a2e' }}>
                          {a.motif || '—'}
                        </div>
                      </div>
                    </div>
                    {(a.nouvelle_mise || 0) > (a.ancienne_mise || 0) && (
                      <div className="mt-2 text-xs text-center font-medium" style={{ color: '#166534' }}>
                        ↗ +{((a.nouvelle_mise || 0) - (a.ancienne_mise || 0)).toLocaleString()} F
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 🛡️ ASSURANCES */}
          <Section titre="🛡️ ASSURANCES">
            {assurs.length === 0 ? (
              <div className="text-center py-4 rounded-xl text-xs"
                style={{ backgroundColor: '#f8fafc', color: '#818387' }}>
                Aucune assurance ce jour
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {assurs.map((a: any, i: number) => (
                    <div key={a.id || i} className="rounded-xl p-3"
                      style={{ backgroundColor: a.type_assurance === 'Honaméto' ? '#EEF2FF' : '#F0FDF4' }}>
                      <div className="font-semibold text-xs mb-2"
                        style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                        {a.type_assurance === 'Honaméto' ? '🔵' : '🟢'} {a.type_assurance}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                          <div className="text-xs" style={{ color: '#818387' }}>Contrats</div>
                          <div className="font-bold text-sm"
                            style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                            {a.nb || 0}
                          </div>
                        </div>
                        <div className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                          <div className="text-xs" style={{ color: '#818387' }}>Montant</div>
                          <div className="font-bold text-sm"
                            style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                            {(a.montant || 0).toLocaleString()} F
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#F0FDF4' }}>
                  <span className="text-xs font-semibold" style={{ color: '#166534' }}>
                    Total : {totalAssurNb} contrat(s) — {totalAssurMontant.toLocaleString()} F
                  </span>
                </div>
              </>
            )}
          </Section>

          {/* 📝 OBSERVATIONS */}
          {fiche.observations && (
            <Section titre="📝 OBSERVATIONS DE L'AGENT">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc' }}>
                <p className="text-sm" style={{ color: '#1a1a2e' }}>{fiche.observations}</p>
              </div>
            </Section>
          )}

          {/* 💬 COMMENTAIRE VALIDATEUR */}
          {fiche.commentaire_chef && (
            <Section titre="💬 COMMENTAIRE DU VALIDATEUR">
              <div className="rounded-xl p-3 flex items-start gap-2"
                style={{
                  backgroundColor: fiche.statut_validation === 'validee' ? '#F0FDF4' :
                    fiche.statut_validation === 'rejetee' ? '#FEF2F2' : '#FEF9C3'
                }}>
                <span>{fiche.statut_validation === 'validee' ? '✅' : fiche.statut_validation === 'rejetee' ? '❌' : '🔄'}</span>
                <p className="text-sm" style={{ color: statutColor.color }}>{fiche.commentaire_chef}</p>
              </div>
            </Section>
          )}

          {/* Espace bas */}
          <div className="h-4" />
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-3"
          style={{ borderColor: '#f1f5f9', backgroundColor: 'white' }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Fermer
          </button>
          {canValidate && onValidate && (
            <button type="button" onClick={onValidate}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#166534' }}>
              ✅ Prendre une décision
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Composant Section ──
function Section({ titre, children }: { titre: string, children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
      <h4 className="font-semibold text-xs mb-3" style={{ color: '#818387' }}>{titre}</h4>
      {children}
    </div>
  )
}