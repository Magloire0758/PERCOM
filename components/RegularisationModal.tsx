'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  fiche: any
  onClose: () => void
  onSuccess: () => void
}

export default function RegularisationModal({ fiche, onClose, onSuccess }: Props) {
  const [montant, setMontant] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [numeroCompte, setNumeroCompte] = useState('')
  const [nomClient, setNomClient] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  if (!fiche) return null

  const smart = fiche.montant_smart ?? fiche.montant_mobilise ?? 0
  const caisse = fiche.montant_caisse ?? fiche.montant_rapporte ?? 0
  const ecart = smart - caisse
  const isManquant = ecart > 0
  const ecartTotal = Math.abs(ecart)
  const dejaRegularise = fiche.montant_regularise || 0
  const restant = ecartTotal - dejaRegularise

  const montantNum = parseFloat(montant) || 0
  const nouveauRestant = restant - montantNum
  const soldera = montantNum > 0 && montantNum >= restant
  const depasse = montantNum > restant

  async function handleSubmit() {
    setErreur('')

    if (montantNum <= 0) { setErreur('Le montant doit être supérieur à zéro.'); return }
    if (depasse) { setErreur(`Le montant dépasse le restant à régulariser (${restant.toLocaleString()} F).`); return }
    if (!commentaire.trim()) { setErreur('Le commentaire est obligatoire.'); return }
    if (!isManquant) {
      if (!numeroCompte.trim()) { setErreur('Le numéro de compte du client est obligatoire.'); return }
      if (!nomClient.trim()) { setErreur('Le nom du client est obligatoire.'); return }
    }

    setSaving(true)

    // Upload pièce jointe
    let pieceUrl: string | null = null
    let pieceNom: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${fiche.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('regularisations').upload(path, file)
      if (upErr) { setSaving(false); setErreur('Erreur upload : ' + upErr.message); return }
      const { data: urlData } = supabase.storage.from('regularisations').getPublicUrl(path)
      pieceUrl = urlData.publicUrl
      pieceNom = file.name
    }

    // Appel de la fonction RPC
    const { data, error } = await supabase.rpc('enregistrer_regularisation', {
      p_fiche_id: fiche.id,
      p_montant: montantNum,
      p_commentaire: commentaire.trim(),
      p_piece_url: pieceUrl,
      p_piece_nom: pieceNom,
      p_numero_compte: isManquant ? null : numeroCompte.trim(),
      p_nom_client: isManquant ? null : nomClient.trim(),
    })

    setSaving(false)

    if (error) { setErreur(error.message); return }
    if (!data?.ok) { setErreur(data?.erreur || 'Erreur inconnue.'); return }

    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', fontFamily: 'var(--font-dm-sans)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: '#f1f5f9' }}>
          <h3 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
            {isManquant ? '💰 Régulariser un manquant' : '🔵 Régulariser un surplus'}
          </h3>
          <button type="button" onClick={onClose}
            className="p-2 rounded-lg" style={{ backgroundColor: '#f1f5f9', color: '#818387' }}>✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Contexte */}
          <div className="rounded-xl p-4"
            style={{ backgroundColor: isManquant ? '#FEF2F2' : '#EEF2FF', border: `1px solid ${isManquant ? '#FECACA' : '#C7D2FE'}` }}>
            <div className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>
              {fiche.agents?.prenom} {fiche.agents?.nom}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#818387' }}>
              Fiche du {new Date(fiche.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {fiche.agents?.agences?.nom ? ` · ${fiche.agents.agences.nom}` : ''}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: 'Écart initial', value: ecartTotal, color: isManquant ? '#991B1B' : '#2A4E94' },
                { label: 'Déjà régularisé', value: dejaRegularise, color: '#166534' },
                { label: 'Restant', value: restant, color: '#854D0E' },
              ].map(k => (
                <div key={k.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'white' }}>
                  <div className="font-bold text-sm" style={{ color: k.color }}>{k.value.toLocaleString()} F</div>
                  <div style={{ fontSize: '10px', color: '#818387' }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {erreur && (
            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              ❌ {erreur}
            </div>
          )}

          {/* Champs surplus */}
          {!isManquant && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                  N° de compte du client *
                </label>
                <input type="text" value={numeroCompte} onChange={e => setNumeroCompte(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                  placeholder="Ex : 00123456" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
                  Nom & prénoms du client *
                </label>
                <input type="text" value={nomClient} onChange={e => setNomClient(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
                  placeholder="Nom du bénéficiaire du reversement" />
              </div>
            </>
          )}

          {/* Montant */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Montant à régulariser (FCFA) *
            </label>
            <input type="number" min={0} max={restant} value={montant}
              onChange={e => setMontant(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: depasse ? '#FECACA' : '#e2e8f0', color: '#1a1a2e' }}
              placeholder="0" />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setMontant(String(restant))}
                className="flex-1 py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: '#F0FDF4', color: '#166534' }}>
                Solder ({restant.toLocaleString()} F)
              </button>
            </div>

            {/* Aperçu */}
            {montantNum > 0 && (
              <div className="mt-2 rounded-xl p-3 text-xs"
                style={{
                  backgroundColor: depasse ? '#FEF2F2' : soldera ? '#F0FDF4' : '#FEF9C3',
                  color: depasse ? '#991B1B' : soldera ? '#166534' : '#854D0E'
                }}>
                {depasse
                  ? `⚠️ Dépassement de ${(montantNum - restant).toLocaleString()} F — régularisation impossible`
                  : soldera
                  ? `✅ Cette régularisation soldera l'écart`
                  : `⏳ Régularisation partielle — il restera ${nouveauRestant.toLocaleString()} F`}
              </div>
            )}
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Commentaire *
            </label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
              style={{ borderColor: '#e2e8f0', color: '#1a1a2e' }}
              placeholder={isManquant
                ? 'Ex : Versement effectué en caisse le 22/07'
                : 'Ex : Reversement sur le compte du client'} />
          </div>

          {/* Pièce jointe */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              Pièce justificative (facultatif)
            </label>
            {!file ? (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer"
                style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}>
                <span className="text-xl mb-1">📎</span>
                <span className="text-xs" style={{ color: '#818387' }}>Photo, reçu, PDF</span>
                <input type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: '#f8fafc' }}>
                <span>📄</span>
                <span className="text-xs flex-1 truncate" style={{ color: '#1a1a2e' }}>{file.name}</span>
                <span className="text-xs" style={{ color: '#818387' }}>{(file.size / 1024).toFixed(0)} Ko</span>
                <button type="button" onClick={() => setFile(null)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-3" style={{ borderColor: '#f1f5f9' }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#e2e8f0', color: '#818387' }}>
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || depasse || montantNum <= 0}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: saving || depasse || montantNum <= 0 ? '#cbd5e1' : '#2A4E94' }}>
            {saving ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}