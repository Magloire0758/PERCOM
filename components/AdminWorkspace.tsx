'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { assertRpc } from '@/lib/agent-reporting';
import { fetchAllRows } from '@/lib/supabase-pagination';
import { useTeamRpc } from '@/lib/use-team-rpc';
import { NetworkState, NetworkTabs } from './NetworkWorkspace';
import { networkButton as button, networkInput as input, networkPanel as panel, type Directory } from './network-ui';
type Row = Record<string, unknown>;
type Result = {
    ok: true;
    total_filtre: number;
    [key: string]: unknown;
};
const text = (r: Row, k: string) => String(r[k] ?? '');
const labels: Record<string, string> = { nom: 'Nom', prenom: 'Prénom', email: 'Email', telephone: 'Téléphone', role: 'Rôle', agence_nom: 'Agence', equipe_nom: 'Équipe', statut: 'Statut', nb_equipes: 'Équipes', nb_membres: 'Membres', nb_chefs: 'Chefs', nb_zones: 'Zones', chef_nom: 'Référent', numero: 'Numéro', nb_agents: 'Agents', date_op: 'Date', operation: 'Opération', acteur_email: 'Auteur', cible_type: 'Type de cible', actif: 'Actif', region: 'Région', ville: 'Ville', description: 'Description', adresse: 'Adresse', ancienne_valeur: 'Avant', nouvelle_valeur: 'Après', motif: 'Motif' };
const anomalies: Record<string, string> = { agents_sans_agence: 'Collecteurs sans agence', agents_sans_equipe: 'Collecteurs sans équipe', equipes_sans_referent: 'Équipes sans référent', equipes_sans_membre: 'Équipes sans membre', chefs_sans_equipe: 'Chefs sans équipe', zones_orphelines: 'Zones sans agence', membres_role_gestion_en_equipe: 'Rôles de gestion rattachés à une équipe' };
const tabs = [['summary', 'Synthèse'], ['utilisateurs', 'Utilisateurs'], ['agences', 'Agences'], ['equipes', 'Équipes'], ['zones', 'Zones'], ['journal', 'Journal'], ['permissions', 'Droits']] as const;
const columns: Record<string, string[]> = { utilisateurs: ['prenom', 'nom', 'role', 'agence_nom', 'equipe_nom', 'statut'], agences: ['nom', 'ville', 'actif', 'nb_equipes', 'nb_membres', 'nb_zones'], equipes: ['nom', 'agence_nom', 'chef_nom', 'nb_chefs', 'nb_membres', 'nb_zones'], zones: ['numero', 'nom', 'agence_nom', 'nb_agents', 'nb_equipes'], journal: ['date_op', 'operation', 'acteur_email', 'cible_type'], anomalies: ['nom', 'prenom', 'role', 'agence_nom', 'equipe_nom'] };
const display = (value: unknown): string => value === null || value === undefined ? '—' : typeof value === 'boolean' ? value ? 'Oui' : 'Non' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export default function AdminWorkspace({ selfId, directory, onChange }: {
    selfId: string;
    directory: Directory;
    onChange: () => void;
}) {
    const [tab, setTab] = useState('summary'), [query, setQuery] = useState(''), [role, setRole] = useState(''), [agency, setAgency] = useState(''), [team, setTeam] = useState(''), [state, setState] = useState(''), [page, setPage] = useState(1), [anomaly, setAnomaly] = useState(''), [operation, setOperation] = useState(''), [actor, setActor] = useState(''), [kind, setKind] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [selected, setSelected] = useState<Row | null>(null), [creating, setCreating] = useState(false);
    const summary = useTeamRpc<{
        ok: true;
        totaux: Record<string, number>;
        anomalies: Record<string, number>;
        effectifs_par_role: Row[];
    }>('admin_synthese', {}, tab === 'summary');
    const name = tab === 'journal' ? 'admin_journal' : tab === 'anomalies' ? 'admin_anomalies_rattachement' : `admin_annuaire_${tab}`;
    const args = { p_page: page, p_taille: 20, ...(tab === 'utilisateurs' ? { p_role: role || null, p_agence_id: agency || null, p_equipe_id: team || null, p_etat: state || null, p_recherche: query || null } : tab === 'agences' ? { p_actif: state ? state === 'actif' : null, p_recherche: query || null } : tab === 'equipes' ? { p_agence_id: agency || null, p_recherche: query || null } : tab === 'zones' ? { p_agence_id: agency || null } : tab === 'anomalies' ? { p_type: anomaly } : tab === 'journal' ? { p_operation: operation || null, p_acteur_id: actor || null, p_cible_type: kind || null, p_date_debut: start || null, p_date_fin: end || null } : {}) };
    const validDates = !start || !end || start <= end;
    const rpc = useTeamRpc<Result>(name, args, !['summary', 'permissions'].includes(tab) && validDates);
    const dataKey = tab === 'journal' ? 'evenements' : tab === 'anomalies' ? 'elements' : tab;
    const rows = (rpc.data?.[dataKey] || []) as Row[];
    const changeTab = (value: string) => { setTab(value); setPage(1); setQuery(''); setState(''); setSelected(null); setCreating(false); };
    const changed = () => { void rpc.refresh(); void summary.refresh(); onChange(); };
    const selectFilter = (setter: (v: string) => void, v: string) => { setter(v); setPage(1); };
    return <div className="space-y-5"><NetworkTabs label="Administration" items={tabs.map(([a, b]) => [a, b])} value={tab} onChange={changeTab}/>
 {tab === 'summary' ? <><NetworkState {...summary}/>{summary.data && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['nb_agents_collecte', 'Agents et chefs'], ['nb_actifs', 'Comptes actifs'], ['nb_agences_actives', 'Agences actives'], ['nb_equipes', 'Équipes']].map(([k, label]) => <article className={panel} key={k}><p className="text-sm text-slate-500">{label}</p><strong className="mt-3 block text-3xl">{summary.data!.totaux[k]}</strong></article>)}</div><section className={panel}><h2 className="text-lg font-bold">Qualité des rattachements</h2><p className="my-2 text-sm text-slate-500">Ouvrez une anomalie pour retrouver les comptes ou structures concernés.</p><div className="grid gap-3 md:grid-cols-2">{Object.entries(anomalies).map(([key, label]) => <button key={key} className="flex justify-between rounded-xl border p-4 text-left hover:bg-blue-50" onClick={() => { setAnomaly(key); changeTab('anomalies'); }}><span>{label}</span><strong className={summary.data!.anomalies[key] ? 'text-amber-700' : 'text-emerald-700'}>{summary.data!.anomalies[key] ?? 0}</strong></button>)}</div></section><section className={panel}><h2 className="mb-4 font-bold">Effectifs par rôle</h2><div className="grid gap-3 md:grid-cols-5">{summary.data.effectifs_par_role.map(r => <div key={text(r, 'role')} className="rounded-xl bg-slate-50 p-4"><strong>{text(r, 'role')}</strong><p className="text-sm">{text(r, 'actifs')} actifs</p><p className="text-xs text-slate-500">{text(r, 'non_actifs')} non actifs · {text(r, 'total')} au total</p></div>)}</div></section></>}</> : tab === 'permissions' ? <section className={panel}><h2 className="text-xl font-bold">Droits fixes par rôle</h2><p className="my-3 text-sm text-slate-500">Les autorisations sont contrôlées côté serveur. Cette page présente les périmètres métier ; aucune case ne modifie les droits.</p>{[['Agent', 'Ses fiches, rapports, objectifs et performances.'], ['Chef', 'Ses données individuelles et celles de son équipe ; plusieurs chefs sont possibles. Le référent n’est pas le seul chef autorisé.'], ['Responsable d’agence', 'Son agence, ses équipes et collaborateurs ; objectifs individuels et d’équipe.'], ['Direction générale', 'Pilotage de tout le réseau ; objectifs agence et réseau.'], ['Admin', 'Pilotage réseau, administration et actions métier autorisées. Les contrôles de validation et de régularisation restent applicables.']].map(([r, d]) => <article key={r} className="border-t py-4"><strong>{r}</strong><p className="mt-1 text-sm text-slate-500">{d}</p></article>)}</section> : <section className={panel}>
 <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{tab === 'anomalies' ? anomalies[anomaly] : tabs.find(t => t[0] === tab)?.[1]}</h2><div className="flex gap-2"><button className={button} onClick={() => void rpc.refresh()}>Actualiser</button>{['utilisateurs', 'agences', 'equipes', 'zones'].includes(tab) && <button className={button + ' !bg-blue-700 !text-white'} onClick={() => setCreating(true)}>Créer</button>}</div></div>
 <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {['utilisateurs', 'agences', 'equipes'].includes(tab) && <label className="text-xs">Recherche<input className={input} value={query} placeholder="Nom, identité…" onChange={e => selectFilter(setQuery, e.target.value)}/></label>}
 {['utilisateurs', 'equipes', 'zones'].includes(tab) && <label className="text-xs">Agence<select className={input} value={agency} onChange={e => { selectFilter(setAgency, e.target.value); setTeam(''); }}><option value="">Toutes</option><option value="00000000-0000-0000-0000-000000000000">Sans agence</option>{directory.agencies.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select></label>}
 {tab === 'utilisateurs' && <><label className="text-xs">Rôle<select className={input} value={role} onChange={e => selectFilter(setRole, e.target.value)}><option value="">Tous</option>{['agent', 'chef', 'responsable', 'dg', 'admin'].map(r => <option key={r}>{r}</option>)}</select></label><label className="text-xs">Équipe<select className={input} value={team} onChange={e => selectFilter(setTeam, e.target.value)}><option value="">Toutes</option><option value="00000000-0000-0000-0000-000000000000">Sans équipe</option>{directory.teams.filter(t => !agency || t.agence_id === agency).map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></label></>}
 {['utilisateurs', 'agences'].includes(tab) && <label className="text-xs">État<select className={input} value={state} onChange={e => selectFilter(setState, e.target.value)}><option value="">Tous</option><option value="actif">Actifs</option><option value="suspendu">Non actifs</option></select></label>}
 {tab === 'journal' && <><label className="text-xs">Opération<select className={input} value={operation} onChange={e => selectFilter(setOperation, e.target.value)}><option value="">Toutes</option>{['definir_chef', 'retirer_chef', 'muter_membre_equipe', 'editer_agent', 'toggle_agent_statut', 'toggle_agence', 'supprimer_equipe', 'gerer_zones_agent', 'gerer_zones_equipe'].map(o => <option key={o}>{o}</option>)}</select></label><label className="text-xs">Type de cible<select className={input} value={kind} onChange={e => selectFilter(setKind, e.target.value)}><option value="">Tous</option>{['agent', 'equipe', 'agence'].map(k => <option key={k}>{k}</option>)}</select></label><label className="text-xs">Auteur (identifiant)<input className={input} value={actor} onChange={e => selectFilter(setActor, e.target.value)}/></label><label className="text-xs">Du<input type="date" className={input} value={start} onChange={e => selectFilter(setStart, e.target.value)}/></label><label className="text-xs">Au<input type="date" className={input} value={end} onChange={e => selectFilter(setEnd, e.target.value)}/></label></>}
 </div>{!validDates && <p role="alert">La fin doit suivre le début.</p>}<NetworkState {...rpc}/>{rpc.data && <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{columns[tab].map(k => <th className="border-b p-3 text-xs text-slate-500" key={k}>{labels[k] || k}</th>)}<th className="border-b p-3">Détail</th></tr></thead><tbody>{rows.map((r, i) => <tr className="border-b hover:bg-slate-50" key={text(r, 'id') || text(r, 'agent_id') || text(r, 'equipe_id') || text(r, 'zone_id') || i}>{columns[tab].map(k => <td className="p-3" key={k}>{display(r[k])}</td>)}<td className="p-3"><button className={button} onClick={() => setSelected(r)}>Ouvrir</button></td></tr>)}</tbody></table></div>{!rows.length && <p className="py-8 text-center text-slate-500">Aucun résultat pour ces filtres.</p>}<div className="mt-5 flex items-center justify-between gap-3 text-sm"><span>{rpc.data.total_filtre} résultat(s) · Page {page}</span><div className="flex gap-2"><button className={button} disabled={page === 1} onClick={() => setPage(page - 1)}>Précédent</button><button className={button} disabled={page * 20 >= rpc.data.total_filtre} onClick={() => setPage(page + 1)}>Suivant</button></div></div></>}
 </section>}
 {selected && <AdminDetail key={text(selected, 'id') || JSON.stringify(selected)} row={selected} kind={tab === 'anomalies' ? (selected.agent_id ? 'utilisateurs' : selected.equipe_id ? 'equipes' : 'zones') : tab} selfId={selfId} directory={directory} close={() => setSelected(null)} done={() => { setSelected(null); changed(); }}/>}
 {creating && <CreateEntity kind={tab} directory={directory} close={() => setCreating(false)} done={() => { setCreating(false); changed(); }}/>}
 </div>;
}
function Drawer({ title, close, children, busy = false }: {
    title: string;
    close: () => void;
    children: ReactNode;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const trigger = document.activeElement as HTMLElement | null; const d = ref.current; d?.showModal(); return () => { d?.close(); trigger?.focus(); }; }, []);
    return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy)
        close(); }} className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-slate-50 p-0 text-slate-900 backdrop:bg-slate-950/50 sm:w-[min(740px,90vw)]"><header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white p-5"><h2 className="text-xl font-bold">{title}</h2><button disabled={busy} className={button} onClick={close}>Fermer</button></header><div className="space-y-5 p-5">{children}</div></dialog>;
}
async function requestAdmin(path: string, body: Row) {
    const session = await supabase.auth.getSession();
    if (!session.data.session)
        throw new Error('Session expirée.');
    const r = await fetch('/api/admin/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, callerToken: session.data.session.access_token }) });
    const result = await r.json();
    if (!r.ok || result.ok !== true)
        throw new Error(result.error || 'Opération refusée.');
}
function password() { const bytes = crypto.getRandomValues(new Uint8Array(20)); return Array.from(bytes, b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'[b % 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#'.length]).join(''); }
function AdminDetail({ row, kind, selfId, directory, close, done }: {
    row: Row;
    kind: string;
    selfId: string;
    directory: Directory;
    close: () => void;
    done: () => void;
}) {
    const id = text(row, 'id') || text(row, 'agent_id') || text(row, 'equipe_id') || text(row, 'zone_id');
    const [form, setForm] = useState({ nom: text(row, 'nom'), prenom: text(row, 'prenom'), telephone: text(row, 'telephone') }), [team, setTeam] = useState(text(row, 'equipe_id')), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [secret, setSecret] = useState(''), [zones, setZones] = useState<string[]>([]), [choices, setChoices] = useState<Row[]>([]), [zonesReady, setZonesReady] = useState(false), [detailTab, setDetailTab] = useState('identity');
    const lock = useRef(false);
    useEffect(() => { let live = true; if (!['utilisateurs', 'equipes'].includes(kind))
        return; async function load() { const field = kind === 'utilisateurs' ? 'agent_id' : 'equipe_id'; const [links, available] = await Promise.all([fetchAllRows<Row>((a, b) => supabase.from(kind === 'utilisateurs' ? 'agent_zones' : 'equipe_zones').select('zone_id').eq(field, id).order('zone_id').range(a, b)), fetchAllRows<Row>((a, b) => supabase.from('zones').select('id,nom,numero').eq('agence_id', text(row, 'agence_id')).order('id').range(a, b))]); if (!live)
        return; if (links.error || available.error) {
        setError('Zones indisponibles. Fermez et réessayez.');
        return;
    } setZones((links.data || []).map(r => text(r, 'zone_id'))); setChoices(available.data || []); setZonesReady(true); } void load(); return () => { live = false; }; }, [id, kind, row]);
    async function action(run: () => Promise<unknown>, message: string, refresh = true) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); setNotice(''); try {
        await run();
        if (refresh)
            done();
        else
            setNotice(message);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Opération impossible.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    const mutate = (name: string, args: Row) => action(async () => { const r = await supabase.rpc(name, args); assertRpc(r.data, r.error); }, 'Enregistré.');
    const isUser = kind === 'utilisateurs', collector = ['agent', 'chef'].includes(text(row, 'role'));
    return <Drawer title={kind === 'journal' ? 'Événement administratif' : `${text(row, 'prenom')} ${text(row, 'nom')}`.trim() || 'Détail'} close={close} busy={busy}><section className={panel}><dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).filter(([k]) => k !== 'id' && !k.endsWith('_id') && (kind === 'journal' || ['prenom', 'nom', 'role', 'statut', 'actif', 'agence_nom', 'equipe_nom', 'chef_nom', 'nb_chefs', 'nb_membres', 'nb_zones', 'numero', 'email', 'telephone'].includes(k))).map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{labels[k] || k}</dt><dd className="break-words text-sm">{display(v)}</dd></div>)}</dl></section>{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{notice && <p role="status">{notice}</p>}
 {isUser && <><NetworkTabs label="Rubriques utilisateur" items={collector ? [['identity', 'Identité'], ['access', 'Accès'], ['team', 'Équipe'], ['zones', 'Zones']] : [['identity', 'Identité'], ['access', 'Accès']]} value={detailTab} onChange={setDetailTab}/><form className={panel + ' space-y-3 ' + (detailTab === 'identity' ? '' : 'hidden')} onSubmit={e => { e.preventDefault(); void mutate('admin_editer_agent', { p_agent_id: id, p_nom: form.nom.trim(), p_prenom: form.prenom.trim(), p_telephone: form.telephone.trim() }); }}><h3 className="font-bold">Identité</h3>{(['nom', 'prenom', 'telephone'] as const).map(k => <label className="block text-sm" key={k}>{labels[k]}<input required={k !== 'telephone'} disabled={busy} className={input} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}/></label>)}<p className="text-xs text-slate-500">L’email de connexion n’est pas modifié par ce formulaire.</p><button disabled={busy} className={button}>Enregistrer l’identité</button></form><section className={panel + ' space-y-3 ' + (detailTab === 'access' ? '' : 'hidden')}><h3 className="font-bold">Accès au compte</h3><button disabled={busy || selfId === id} className={button} onClick={() => { if (window.confirm('Confirmer le changement de statut de ce compte ?'))
        void mutate('admin_toggle_agent_statut', { p_agent_id: id, p_actif: !(row.actif === true && row.statut === 'actif') }); }}>{row.actif === true && row.statut === 'actif' ? 'Suspendre' : 'Activer'}</button>{selfId === id && <p className="text-xs text-slate-500">Vous ne pouvez pas modifier votre propre statut.</p>}{row.role !== 'admin' && <><label className="block text-sm">Nouveau mot de passe<input autoComplete="new-password" type="text" className={input} value={secret} onChange={e => setSecret(e.target.value)}/></label><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => setSecret(password())}>Générer</button><button className={button} disabled={busy || secret.length < 8} onClick={() => { if (window.confirm('Réinitialiser le mot de passe de ce compte ?'))
        void action(() => requestAdmin('reset-password', { agentId: id, newPassword: secret }), 'Mot de passe modifié. Transmettez-le par un canal sécurisé.', false); }}>Réinitialiser</button></div></>}</section>{collector && <section className={panel + ' space-y-3 ' + (detailTab === 'team' ? '' : 'hidden')}><h3 className="font-bold">Équipe et responsabilité</h3><label className="block text-sm">Nouvelle équipe<select className={input} value={team} onChange={e => setTeam(e.target.value)}><option value="">Choisir…</option>{directory.teams.map(t => <option key={t.id} value={t.id}>{t.nom} · {directory.agencies.find(a => a.id === t.agence_id)?.nom || 'Sans agence'}</option>)}</select></label><p className="text-xs text-slate-500">Le transfert change l’agence selon l’équipe. Les zones hors nouvelle agence sont retirées. Les rapports utilisent les rattachements actuels.</p><button className={button} disabled={busy || !team || team === row.equipe_id} onClick={() => { if (window.confirm('Confirmer le transfert et le nettoyage des zones hors agence ?'))
        void mutate('admin_muter_membre_equipe', { p_agent_id: id, p_equipe_id: team }); }}>Transférer</button><div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !row.equipe_id} onClick={() => void mutate('admin_definir_chef', { p_agent_id: id, p_equipe_id: row.equipe_id, p_referent: false })}>Nommer chef</button><button className={button} disabled={busy || !row.equipe_id} onClick={() => { if (window.confirm('Désigner ce membre comme chef référent ? Les autres chefs conservent leur rôle.'))
        void mutate('admin_definir_chef', { p_agent_id: id, p_equipe_id: row.equipe_id, p_referent: true }); }}>Désigner référent</button>{row.role === 'chef' && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Retirer le rôle chef ? Le référent sera recalculé si nécessaire.'))
        void mutate('admin_retirer_chef', { p_agent_id: id }); }}>Retirer le rôle chef</button>}</div></section>}</>}
 {['agences', 'equipes', 'zones'].includes(kind) && <StructureEditor kind={kind} id={id} done={done}/>}
 {kind === 'equipes' && <section className={panel}><h3 className="mb-3 font-bold">Membres et chefs</h3>{directory.members.filter(m => m.equipe_id === id).map(m => <p className="border-t py-3 text-sm" key={m.id}>{m.prenom} {m.nom} · {m.role}{m.id === row.chef_id ? ' · Référent' : ''}{!m.actif || m.statut !== 'actif' ? ' · Non actif' : ''}</p>)}<p className="mt-3 text-xs text-slate-500">Les nominations et transferts se font depuis la fiche Utilisateur. Plusieurs chefs peuvent appartenir à cette équipe.</p></section>}
 {kind === 'agences' && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Confirmer le changement d’état de cette agence ?'))
        void mutate('admin_toggle_agence', { p_agence_id: id, p_actif: row.actif !== true }); }}>{row.actif === true ? 'Désactiver' : 'Activer'} l’agence</button>}
 {kind === 'equipes' && <section className={panel}><p className="mb-3 text-sm">La suppression est refusée si des membres ou objectifs dépendent encore de l’équipe.</p><button className={button + ' text-red-700'} disabled={busy} onClick={() => { if (window.confirm('Supprimer définitivement cette équipe vide ?'))
        void mutate('admin_supprimer_equipe', { p_equipe_id: id }); }}>Supprimer l’équipe vide</button></section>}
 {((isUser && collector && detailTab === 'zones') || kind === 'equipes') && <section className={panel + ' space-y-3'}><h3 className="font-bold">Zones rattachées</h3>{!zonesReady ? <p>Chargement des zones…</p> : <>{choices.map(z => <label key={text(z, 'id')} className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={zones.includes(text(z, 'id'))} onChange={e => setZones(e.target.checked ? [...zones, text(z, 'id')] : zones.filter(v => v !== z.id))}/>{text(z, 'numero')} · {text(z, 'nom')}</label>)}{!choices.length && <p className="text-sm text-slate-500">Aucune zone disponible dans cette agence.</p>}<button disabled={busy} className={button} onClick={() => void mutate(isUser ? 'admin_gerer_zones_agent' : 'admin_gerer_zones_equipe', { [isUser ? 'p_agent_id' : 'p_equipe_id']: id, p_zone_ids: zones })}>Enregistrer les zones</button></>}</section>}
 </Drawer>;
}
function CreateEntity({ kind, directory, close, done }: {
    kind: string;
    directory: Directory;
    close: () => void;
    done: () => void;
}) {
    const [form, setForm] = useState<Record<string, string>>({ nom: '', prenom: '', email: '', telephone: '', role: 'agent', agence_id: '', equipe_id: '', password: '', numero: '', region: '', adresse: '', description: '' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const lock = useRef(false);
    const field = (key: string, type = 'text') => <label className="block text-sm" key={key}>{labels[key] || (key === 'password' ? 'Mot de passe' : key)}<input required={['nom', 'prenom', 'email', 'password', 'numero'].includes(key)} type={type} className={input} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>;
    async function submit(e: React.FormEvent) { e.preventDefault(); if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        if (kind === 'utilisateurs')
            await requestAdmin('create-user', form);
        else {
            const payload: Row = kind === 'agences' ? { nom: form.nom.trim(), region: form.region, adresse: form.adresse, telephone: form.telephone, actif: true } : kind === 'equipes' ? { nom: form.nom.trim(), agence_id: form.agence_id, description: form.description, chef_id: null, actif: true } : { nom: form.nom.trim(), numero: Number(form.numero), agence_id: form.agence_id };
            const r = await supabase.from(kind).insert(payload).select('id').single();
            if (r.error || !r.data)
                throw new Error('Création refusée. Vérifiez les informations et les droits.');
        }
        done();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Création impossible.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    return <Drawer title={'Créer · ' + kind} close={close} busy={busy}><form onSubmit={submit} className={panel}><fieldset disabled={busy} className="space-y-4">{field('nom')}{kind === 'utilisateurs' && <>{field('prenom')}{field('email', 'email')}{field('telephone')}{field('password')}<button type="button" className={button} onClick={() => setForm({ ...form, password: password() })}>Générer un mot de passe</button><label className="block text-sm">Rôle<select className={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value, equipe_id: '' })}>{['agent', 'chef', 'responsable', 'dg'].map(r => <option key={r}>{r}</option>)}</select></label></>}{kind === 'agences' && <>{field('region')}{field('adresse')}{field('telephone')}</>}{kind === 'equipes' && field('description')}{kind === 'zones' && field('numero', 'number')}{kind !== 'agences' && <label className="block text-sm">Agence<select required={kind !== 'utilisateurs' || form.role !== 'dg'} className={input} value={form.agence_id} onChange={e => setForm({ ...form, agence_id: e.target.value, equipe_id: '' })}><option value="">Choisir…</option>{directory.agencies.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</select></label>}{kind === 'utilisateurs' && ['agent', 'chef'].includes(form.role) && <label className="block text-sm">Équipe<select required={form.role === 'chef'} className={input} value={form.equipe_id} onChange={e => setForm({ ...form, equipe_id: e.target.value })}><option value="">Sans équipe</option>{directory.teams.filter(t => t.agence_id === form.agence_id).map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></label>}{error && <p role="alert" className="text-red-700">{error}</p>}<button className={button + ' !bg-blue-700 !text-white'}>{busy ? 'Création…' : 'Créer'}</button></fieldset></form></Drawer>;
}
function StructureEditor({ kind, id, done }: {
    kind: string;
    id: string;
    done: () => void;
}) {
    const [form, setForm] = useState<Record<string, string> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const fields = kind === 'agences' ? ['nom', 'ville', 'region', 'adresse', 'telephone', 'email'] : kind === 'equipes' ? ['nom', 'description'] : ['nom', 'numero'];
    useEffect(() => { let live = true; async function load() { const r = await supabase.from(kind).select('*').eq('id', id).single(); if (!live)
        return; if (r.error || !r.data)
        setError('Détail indisponible.');
    else
        setForm(Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, String(v ?? '')]))); } void load(); return () => { live = false; }; }, [id, kind]);
    return <form className={panel + ' space-y-3'} onSubmit={async (e) => { e.preventDefault(); if (lock.current || !form)
        return; lock.current = true; setBusy(true); setError(''); try {
        const payload: Row = Object.fromEntries(fields.map(k => [k, k === 'numero' ? Number(form[k]) : form[k]?.trim() || null]));
        const r = await supabase.from(kind).update(payload).eq('id', id).select('id').single();
        if (r.error || !r.data)
            throw new Error('Modification non enregistrée.');
        done();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Modification refusée.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }}><h3 className="font-bold">Informations</h3>{error && <p role="alert" className="text-red-700">{error}</p>}{form && <fieldset disabled={busy} className="space-y-3">{fields.map(k => <label className="block text-sm" key={k}>{labels[k]}<input required={['nom', 'numero'].includes(k)} type={k === 'numero' ? 'number' : k === 'email' ? 'email' : 'text'} className={input} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}/></label>)}<button className={button}>{busy ? 'Enregistrement…' : 'Enregistrer les informations'}</button></fieldset>}</form>;
}
