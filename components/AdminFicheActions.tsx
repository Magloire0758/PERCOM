'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { assertRpc } from '@/lib/agent-reporting';
import { getRestant, type FicheAvecEcart } from '@/lib/ecarts';
import RegularisationModal from './RegularisationModal';
import { networkButton as button, networkPanel as panel, networkInput as input } from './network-ui';
type Fiche = FicheAvecEcart & {
    id: string;
    date: string;
    statut_validation: string;
};
export default function AdminFicheActions({ id, onDone }: {
    id: string;
    onDone: () => void;
}) {
    const [fiche, setFiche] = useState<Fiche | null>(null), [comment, setComment] = useState(''), [action, setAction] = useState('valider'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [regul, setRegul] = useState(false), [version, setVersion] = useState(0);
    const lock = useRef(false);
    useEffect(() => { let live = true; async function load() { const r = await supabase.from('fiches_journalieres').select('id,date,statut_validation,montant_smart,montant_mobilise,montant_caisse,montant_rapporte,montant_regularise').eq('id', id).single(); if (!live)
        return; if (r.error)
        setError('Actions indisponibles.');
    else {
        setFiche(r.data);
        setError('');
    } } void load(); return () => { live = false; }; }, [id, version]);
    const done = () => { setRegul(false); setVersion(v => v + 1); onDone(); };
    async function submit() { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        const r = await supabase.rpc('traiter_validation_fiche', { p_fiche_id: id, p_action: action, p_commentaire: comment.trim() || null });
        assertRpc(r.data, r.error);
        done();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Décision refusée.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    return <section className={panel + ' space-y-3'}><h3 className="font-bold">Actions administratives</h3>{error && <p role="alert" className="text-red-700">{error}</p>}{fiche && <>{fiche.statut_validation !== 'validee' && <><label className="block text-sm">Décision<select className={input} value={action} onChange={e => setAction(e.target.value)}><option value="valider">Valider</option>{fiche.statut_validation === 'en_attente' && <option value="demander_correction">Demander une correction</option>}</select></label><label className="block text-sm">Commentaire<textarea className={input} value={comment} onChange={e => setComment(e.target.value)}/></label><button className={button} disabled={busy || (action === 'demander_correction' && !comment.trim())} onClick={() => void submit()}>Confirmer la décision</button></>}{getRestant(fiche) > 0 && <button className={button} disabled={busy} onClick={() => setRegul(true)}>Régulariser l’écart restant</button>}{regul && <RegularisationModal fiche={fiche} onClose={() => setRegul(false)} onSuccess={done}/>}</>}</section>;
}
