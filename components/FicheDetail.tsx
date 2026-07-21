'use client'

interface FicheDetailProps {
  fiche: any
  onClose?: () => void
  canValidate?: boolean
  onValidate?: () => void
  isDark?: boolean
}

export default function FicheDetail({
  fiche, onClose, canValidate = false, onValidate, isDark = false
}: FicheDetailProps) {
  const card = isDark ? '#1e293b' : 'white'
  const text = isDark ? '#f1f5f9' : '#1a1a2e'
  const sub = isDark ? '#94a3b8' : '#818387'
  const border = isDark ? '#334155' : '#f1f5f9'
  const bg = isDark ? '#0f172a' : '#f8fafc'

  const manq = Math.max(0, (fiche.montant_mobilise || 0) - (fiche.montant_rapporte || 0))
  const totalDepots = (fiche.montant_depot_pe || 0) + (fiche.montant_depot_dat || 0) + (fiche.montant_depot_dav || 0)

  const statutColor = fiche.statut_validation === 'validee'
    ? { bg: '#DCFCE7', color: '#166534', label: '✅ Validée' }
    : fiche.statut_validation === 'rejetee'
    ? { bg: '#FEE2E2', color: '#991B1B', label: '❌ Rejetée' }
    : fiche.statut_validation === 'a_corriger'
    ? { bg: '#FEF9C3', color: '#854D0E', label: '🔄 À corriger' }
    : { bg: '#EEF2FF', color: '#2A4E94', label: '⏳ En attente' }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: '85vh' }}>

      {/* Header */}
      <div className="p-5 border-b flex items-start justify-between sticky top-0 z-10"
        style={{ borderColor: border, backgroundColor: card }}>
        <div>
          <div className="font-bold text-base" style={{ color: text }}>
            📋 {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {fiche.agents && (
            <div className="text-sm mt-0.5" style={{ color: sub }}>
              {fiche.agents?.prenom} {fiche.agents?.nom} · {fiche.agents?.agences?.nom}
            </div>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: statutColor.bg, color: statutColor.color }}>
              {statutColor.label}
            </span>
            {fiche.heure_soumission && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: bg, color: sub }}>
                🕐 {new Date(fiche.heure_soumission).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ backgroundColor: bg, color: sub }}>✕</button>
        )}
      </div>

      {/* ── Montants ── */}
      <div className="p-5 border-b" style={{ borderColor: border }}>
        <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>💰 MONTANTS COLLECTÉS</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Montant SMART', value: (fiche.montant_smart || 0).toLocaleString() + ' F', color: '#2A4E94' },
            { label: 'Montant Caisse', value: (fiche.montant_caisse || 0).toLocaleString() + ' F', color: '#2A4E94' },
            { label: 'Total collecté', value: (fiche.montant_mobilise || 0).toLocaleString() + ' F', color: '#166534' },
            { label: 'Commission', value: (fiche.commission_jour || 0).toLocaleString() + ' F', color: '#854D0E' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: bg }}>
              <div className="text-xs" style={{ color: sub }}>{k.label}</div>
              <div className="font-bold text-sm mt-0.5" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Manquant */}
        {manq > 0 && (
          <div className="mt-3 rounded-xl p-3 flex items-center justify-between"
            style={{ backgroundColor: fiche.manquant_regle ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${fiche.manquant_regle ? '#BBF7D0' : '#FECACA'}` }}>
            <div>
              <div className="text-xs font-medium" style={{ color: fiche.manquant_regle ? '#166534' : '#991B1B' }}>
                {fiche.manquant_regle ? '✅ Manquant réglé' : '⚠️ Manquant non réglé'}
              </div>
              <div className="font-bold text-lg" style={{ color: fiche.manquant_regle ? '#166534' : '#E4322C' }}>
                {manq.toLocaleString()} FCFA
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Activités ── */}
      <div className="p-5 border-b" style={{ borderColor: border }}>
        <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>📊 ACTIVITÉS</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Comptes DAT', value: fiche.comptes_ouverts_dat || fiche.comptes_ouverts || 0 },
            { label: 'Adhésions', value: fiche.nb_adhesions || 0 },
            { label: 'Lydé Cash', value: fiche.nb_abonnements_lyde_cash || 0 },
            { label: 'Clients parcourus', value: fiche.nb_clients_parcourus || 0 },
            { label: 'Réactivations', value: fiche.reactivations?.length || 0 },
            { label: 'Augm. mise', value: fiche.augmentations_mise?.length || 0 },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
              <div className="font-bold text-lg" style={{ color: '#2A4E94' }}>{k.value}</div>
              <div className="text-xs mt-0.5" style={{ color: sub }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Autres dépôts ── */}
      {totalDepots > 0 && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>🏧 AUTRES DÉPÔTS</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'PE', value: fiche.montant_depot_pe || 0 },
              { label: 'DAT', value: fiche.montant_depot_dat || 0 },
              { label: 'DAV', value: fiche.montant_depot_dav || 0 },
            ].map(k => (
              <div key={k.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
                <div className="font-bold text-sm" style={{ color: '#2A4E94' }}>{(k.value).toLocaleString()} F</div>
                <div className="text-xs mt-0.5" style={{ color: sub }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#EEF2FF' }}>
            <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
              Total : {totalDepots.toLocaleString()} F
            </span>
          </div>
        </div>
      )}

      {/* ── Réactivations ── */}
      {fiche.reactivations && fiche.reactivations.length > 0 && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>
            🔄 RÉACTIVATIONS ({fiche.reactivations.length})
          </h4>
          <div className="space-y-2">
            {fiche.reactivations.map((r: any, i: number) => (
              <div key={r.id || i} className="rounded-xl p-3" style={{ backgroundColor: bg }}>
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: text }}>
                      {r.nom_prenom}
                      {r.n_client && <span className="ml-1 text-xs" style={{ color: sub }}>#{r.n_client}</span>}
                    </div>
                    <div className="text-xs" style={{ color: sub }}>{r.produit}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: r.reactif ? '#DCFCE7' : '#FEE2E2', color: r.reactif ? '#166534' : '#991B1B' }}>
                    {r.reactif ? '✅ Réactivé' : '❌ Non réactivé'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Mise</div>
                    <div className="font-semibold text-xs" style={{ color: text }}>{(r.mise || 0).toLocaleString()} F</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Nvelle mise</div>
                    <div className="font-semibold text-xs" style={{ color: '#2A4E94' }}>{(r.nouvelle_mise || 0).toLocaleString()} F</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Cotisé</div>
                    <div className="font-semibold text-xs" style={{ color: '#166534' }}>{(r.montant_cotise || 0).toLocaleString()} F</div>
                  </div>
                </div>
                {r.commentaire && (
                  <div className="mt-2 text-xs italic" style={{ color: sub }}>💬 {r.commentaire}</div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#EEF2FF' }}>
            <span className="text-xs font-semibold" style={{ color: '#2A4E94' }}>
              Total cotisé : {fiche.reactivations.reduce((s: number, r: any) => s + (r.montant_cotise || 0), 0).toLocaleString()} F
            </span>
          </div>
        </div>
      )}

      {/* ── Augmentations de mise ── */}
      {fiche.augmentations_mise && fiche.augmentations_mise.length > 0 && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>
            📈 AUGMENTATIONS DE MISE ({fiche.augmentations_mise.length})
          </h4>
          <div className="space-y-2">
            {fiche.augmentations_mise.map((a: any, i: number) => (
              <div key={a.id || i} className="rounded-xl p-3" style={{ backgroundColor: bg }}>
                <div className="font-semibold text-xs mb-2" style={{ color: text }}>{a.nom_client}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Ancienne</div>
                    <div className="font-semibold text-xs" style={{ color: '#991B1B' }}>{(a.ancienne_mise || 0).toLocaleString()} F</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Nouvelle</div>
                    <div className="font-semibold text-xs" style={{ color: '#166534' }}>{(a.nouvelle_mise || 0).toLocaleString()} F</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: sub }}>Motif</div>
                    <div className="font-semibold text-xs" style={{ color: text }}>{a.motif}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assurances ── */}
      {fiche.assurances_details && fiche.assurances_details.length > 0 && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-3" style={{ color: sub }}>🛡️ ASSURANCES</h4>
          <div className="grid grid-cols-2 gap-3">
            {fiche.assurances_details.map((a: any, i: number) => (
              <div key={a.id || i} className="rounded-xl p-3"
                style={{ backgroundColor: a.type_assurance === 'Honaméto' ? '#EEF2FF' : '#F0FDF4' }}>
                <div className="font-semibold text-xs mb-2"
                  style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                  {a.type_assurance === 'Honaméto' ? '🔵' : '🟢'} {a.type_assurance}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-xs" style={{ color: sub }}>Nb contrats</div>
                    <div className="font-bold text-sm" style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                      {a.nb || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: sub }}>Montant</div>
                    <div className="font-bold text-sm" style={{ color: a.type_assurance === 'Honaméto' ? '#2A4E94' : '#166534' }}>
                      {(a.montant || 0).toLocaleString()} F
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl p-2 text-center" style={{ backgroundColor: '#F0FDF4' }}>
            <span className="text-xs font-semibold" style={{ color: '#166534' }}>
              Total : {fiche.assurances_details.reduce((s: number, a: any) => s + (a.nb || 0), 0)} contrats —{' '}
              {fiche.assurances_details.reduce((s: number, a: any) => s + (a.montant || 0), 0).toLocaleString()} F
            </span>
          </div>
        </div>
      )}

      {/* ── Observations ── */}
      {fiche.observations && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-2" style={{ color: sub }}>📝 OBSERVATIONS</h4>
          <p className="text-sm" style={{ color: text }}>{fiche.observations}</p>
        </div>
      )}

      {/* ── Commentaire chef ── */}
      {fiche.commentaire_chef && (
        <div className="p-5 border-b" style={{ borderColor: border }}>
          <h4 className="font-semibold text-xs mb-2" style={{ color: sub }}>💬 COMMENTAIRE CHEF</h4>
          <div className="rounded-xl p-3 flex items-start gap-2"
            style={{
              backgroundColor: fiche.statut_validation === 'validee' ? '#F0FDF4' :
                fiche.statut_validation === 'rejetee' ? '#FEF2F2' : '#FEF9C3'
            }}>
            <span>{fiche.statut_validation === 'validee' ? '✅' : fiche.statut_validation === 'rejetee' ? '❌' : '🔄'}</span>
            <p className="text-sm" style={{ color: statutColor.color }}>{fiche.commentaire_chef}</p>
          </div>
        </div>
      )}

      {/* ── Action validation ── */}
      {canValidate && onValidate && (
        <div className="p-5">
          <button type="button" onClick={onValidate}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#166534' }}>
            ✅ Prendre une décision
          </button>
        </div>
      )}
    </div>
  )
}