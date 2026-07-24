'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  ficheId: string
  ecartTotal: number
  montantRegularise: number
  isManquant: boolean
  isDark?: boolean
}

export default function EcartHistorique({
  ficheId, ecartTotal, montantRegularise, isManquant, isDark = false
}: Props) {
  const [regs, setRegs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const text = isDark ? '#f1f5f9' : '#1a1a2e'
  const sub = isDark ? '#94a3b8' : '#818387'

  useEffect(() => { load() }, [ficheId])

  async function load() {
    const { data } = await supabase.from('regularisations')
      .select('*, regularise_par_agent:regularise_par(nom, prenom, role)')
      .eq('fiche_id', ficheId)
      .order('created_at', { ascending: false })
    setRegs(data || [])
    setLoading(false)
  }

  const restant = ecartTotal - montantRegularise

  return (
    <div className="space-y-3">
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Écart initial', value: ecartTotal, color: isManquant ? '#991B1B' : '#2A4E94' },
          { label: 'Régularisé', value: montantRegularise, color: '#166534' },
          { label: 'Restant', value: restant, color: restant > 0 ? '#854D0E' : '#166534' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
            <div className="font-bold text-sm" style={{ color: k.color }}>{k.value.toLocaleString()} F</div>
            <div className="text-xs mt-0.5" style={{ color: sub }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre de progression */}
      {ecartTotal > 0 && (
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
          <div className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(100, (montantRegularise / ecartTotal) * 100)}%`,
              backgroundColor: restant <= 0 ? '#22C55E' : '#EAB308'
            }} />
        </div>
      )}

      {/* Historique */}
      {loading ? (
        <div className="text-center py-3 text-xs" style={{ color: sub }}>Chargement...</div>
      ) : regs.length === 0 ? (
        <div className="text-center py-3 rounded-xl text-xs" style={{ backgroundColor: bg, color: sub }}>
          Aucune régularisation enregistrée
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold" style={{ color: sub }}>HISTORIQUE ({regs.length})</div>
          {regs.map(r => (
            <div key={r.id} className="rounded-xl p-3" style={{ backgroundColor: bg }}>
              <div className="flex items-start justify-between mb-1">
                <div className="font-bold text-sm" style={{ color: '#166534' }}>
                  +{(r.montant || 0).toLocaleString()} F
                </div>
                <div className="text-xs" style={{ color: sub }}>
                  {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="text-xs" style={{ color: sub }}>
                par {r.regularise_par_agent?.prenom} {r.regularise_par_agent?.nom}
                {r.regularise_par_agent?.role ? ` (${r.regularise_par_agent.role})` : ''}
              </div>

              {r.type_ecart === 'surplus' && (r.numero_compte || r.nom_client) && (
                <div className="mt-2 px-2 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: isDark ? '#1e293b' : 'white', color: text }}>
                  💳 Compte {r.numero_compte} — {r.nom_client}
                </div>
              )}

              {r.commentaire && (
                <div className="mt-2 text-xs italic" style={{ color: sub }}>💬 {r.commentaire}</div>
              )}

              {r.piece_jointe_url && (
                <a href={r.piece_jointe_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#2A4E94' }}>
                  📎 {r.piece_jointe_nom || 'Pièce jointe'}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}