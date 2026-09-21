-- PERCOM Lot 8 : complement rapports, apres 202609210001_recent_fiches_first.sql.
-- Corps du SQL fourni le 21/09/2026 ; seuls les tris changent face aux Lots 5.1/6.1/7.
-- Ne pas creer accidentellement des RPC avec les ACL par defaut.
begin;
do $check$
begin
  if to_regprocedure('public.rapport_intervalle(uuid,date,date,text[])') is null
     or to_regprocedure('public.rapport_equipe(uuid,date,date,text[],boolean)') is null
     or to_regprocedure('public.rapport_agence(uuid,date,date,text[])') is null then
    raise exception 'Prerequis manquants : appliquer les Lots 5.1, 6.1 et 7 sur PERCOM.';
  end if;
end;
$check$;

create or replace function public.rapport_intervalle(
  p_agent_id uuid, p_date_debut date, p_date_fin date,
  p_statuts text[] default array['validee']
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_lignes jsonb; v_totaux jsonb; v_agent jsonb; v_react jsonb; v_augm jsonb; v_assur jsonb;
begin
  if public._agent_courant_id() is null then
    return jsonb_build_object('ok', false, 'erreur', 'Compte introuvable, inactif ou suspendu.');
  end if;
  if not public._peut_lire_agent(p_agent_id) then
    return jsonb_build_object('ok', false, 'erreur', 'Accès non autorisé.');
  end if;
  if p_date_debut is null or p_date_fin is null or p_date_fin < p_date_debut then
    return jsonb_build_object('ok', false, 'erreur', 'Intervalle invalide.');
  end if;
  if public._statuts_valides(p_statuts) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Statuts invalides.');
  end if;

  -- UN SEUL WITH englobant les 4 agrégations (corrige PC-EXP-01)
  with f as (
    select *, (coalesce(montant_smart,montant_mobilise,0) - coalesce(montant_caisse,montant_rapporte,0)) as ecart
    from public.fiches_journalieres
    where agent_id=p_agent_id and date between p_date_debut and p_date_fin
      and coalesce(statut_validation,'en_attente') = any(p_statuts)
  ),
  lignes as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', f.date, 'statut', coalesce(f.statut_validation,'en_attente'),
      'smart', coalesce(f.montant_smart,f.montant_mobilise,0),
      'caisse', coalesce(f.montant_caisse,f.montant_rapporte,0),
      'manquant', case when f.ecart>0 then f.ecart else 0 end,
      'surplus', case when f.ecart<0 then -f.ecart else 0 end,
      'regularise', coalesce(f.montant_regularise,0),
      'restant', case when f.ecart>0 then greatest(f.ecart-coalesce(f.montant_regularise,0),0) else 0 end,
      'surplus_restant', case when f.ecart<0 then greatest((-f.ecart)-coalesce(f.montant_regularise,0),0) else 0 end,
      'commission', coalesce(f.commission_jour,0),
      'clients', coalesce(f.nb_clients_parcourus,0),
      'comptes_dat', coalesce(f.comptes_ouverts_dat,f.comptes_ouverts,0),
      'adhesions', coalesce(f.nb_adhesions,0),
      'lyde_cash', coalesce(f.nb_abonnements_lyde_cash,0),
      'reactivations_effectives', (select count(*) from public.reactivations r where r.fiche_id=f.id and r.reactif is true),
      'reactivations_montant', (select coalesce(sum(montant_cotise),0) from public.reactivations r where r.fiche_id=f.id and r.reactif is true),
      'augmentations_nb', (select count(*) from public.augmentations_mise a where a.fiche_id=f.id),
      'augmentations_hausse', (select coalesce(sum(greatest(coalesce(nouvelle_mise,0)-coalesce(ancienne_mise,0),0)),0) from public.augmentations_mise a where a.fiche_id=f.id),
      'assurances_nb', (select coalesce(sum(nb),0) from public.assurances_details s where s.fiche_id=f.id),
      'assurances_montant', (select coalesce(sum(montant),0) from public.assurances_details s where s.fiche_id=f.id),
      'depot_pe', coalesce(f.montant_depot_pe,0), 'depot_dat', coalesce(f.montant_depot_dat,0), 'depot_dav', coalesce(f.montant_depot_dav,0)
    ) order by f.date desc), '[]'::jsonb) as v from f
  ),
  d_react as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', f.date, 'n_client', r.n_client, 'nom_prenom', r.nom_prenom, 'produit', r.produit,
      'mise', r.mise, 'nouvelle_mise', r.nouvelle_mise, 'montant_cotise', r.montant_cotise,
      'reactif', r.reactif, 'commentaire', r.commentaire) order by f.date desc, r.nom_prenom),'[]'::jsonb) as v
    from public.reactivations r join f on f.id = r.fiche_id
  ),
  d_augm as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', f.date, 'nom_client', a.nom_client, 'ancienne_mise', a.ancienne_mise,
      'nouvelle_mise', a.nouvelle_mise, 'hausse', greatest(coalesce(a.nouvelle_mise,0)-coalesce(a.ancienne_mise,0),0),
      'motif', a.motif) order by f.date desc, a.nom_client),'[]'::jsonb) as v
    from public.augmentations_mise a join f on f.id = a.fiche_id
  ),
  d_assur as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', f.date, 'type_assurance', s.type_assurance, 'nb', s.nb, 'montant', s.montant)
      order by f.date desc, s.type_assurance),'[]'::jsonb) as v
    from public.assurances_details s join f on f.id = s.fiche_id
  )
  select lignes.v, d_react.v, d_augm.v, d_assur.v
  into v_lignes, v_react, v_augm, v_assur
  from lignes, d_react, d_augm, d_assur;

  -- Totaux via la source unique ; on propage un échec éventuel
  v_totaux := public.agent_agregats(p_agent_id, p_date_debut, p_date_fin, p_statuts);
  if coalesce((v_totaux->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'erreur', coalesce(v_totaux->>'erreur','Échec du calcul des totaux.'));
  end if;

  select jsonb_build_object('nom', nom, 'prenom', prenom) into v_agent from public.agents where id = p_agent_id;

  return jsonb_build_object(
    'ok', true, 'agent', v_agent,
    'periode', jsonb_build_object('debut', p_date_debut, 'fin', p_date_fin),
    'statuts', to_jsonb(p_statuts),
    'jours_renseignes', jsonb_array_length(v_lignes),
    'lignes', v_lignes,
    'details_reactivations', v_react,
    'details_augmentations', v_augm,
    'details_assurances', v_assur,
    'totaux', v_totaux
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

create or replace function public.rapport_equipe(
  p_equipe_id    uuid default null,
  p_date_debut   date default (date_trunc('month', current_date))::date,
  p_date_fin     date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  p_statuts      text[] default array['validee'],
  p_inclure_chef boolean default true
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_equipe uuid; v_agregats jsonb; v_equipe_nom text; v_agence_nom text;
  v_par_jour jsonb; v_react jsonb; v_augm jsonb; v_assur jsonb;
begin
  if public._agent_courant_id() is null then
    return jsonb_build_object('ok', false, 'erreur', 'Compte introuvable, inactif ou suspendu.');
  end if;
  v_equipe := coalesce(p_equipe_id, public._mon_equipe_de_chef());
  if v_equipe is null then
    return jsonb_build_object('ok', false, 'erreur', 'Aucune équipe déterminée.');
  end if;
  if public._peut_lire_equipe(v_equipe) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Accès non autorisé.');
  end if;
  if p_date_debut is null or p_date_fin is null or p_date_fin < p_date_debut then
    return jsonb_build_object('ok', false, 'erreur', 'Intervalle de dates invalide.');
  end if;
  if public._statuts_valides(p_statuts) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Statuts invalides.');
  end if;

  v_agregats := public.equipe_agregats(v_equipe, p_date_debut, p_date_fin, p_statuts, p_inclure_chef, null);
  if coalesce((v_agregats->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'erreur', coalesce(v_agregats->>'erreur','Échec du calcul des agrégats équipe.'));
  end if;

  select e.nom, ag.nom into v_equipe_nom, v_agence_nom
  from public.equipes e left join public.agences ag on ag.id = e.agence_id
  where e.id = v_equipe;

  with membres as (
    select a.id from public.agents a
    where a.equipe_id = v_equipe and a.role in ('agent','chef')
      and (p_inclure_chef or a.role <> 'chef')
  ),
  f as (
    select fj.*,
      (coalesce(fj.montant_smart,fj.montant_mobilise,0) - coalesce(fj.montant_caisse,fj.montant_rapporte,0)) as ecart
    from public.fiches_journalieres fj
    join membres m on m.id = fj.agent_id
    where fj.date between p_date_debut and p_date_fin
      and coalesce(fj.statut_validation,'en_attente') = any(p_statuts)
  )
  select coalesce(jsonb_agg(j order by (j->>'date') desc), '[]'::jsonb)
  into v_par_jour
  from (
    select jsonb_build_object(
      'date', f.date, 'nb_fiches', count(*),
      'smart', coalesce(sum(coalesce(montant_smart,montant_mobilise,0)),0),
      'caisse', coalesce(sum(coalesce(montant_caisse,montant_rapporte,0)),0),
      'manquant', coalesce(sum(ecart) filter (where ecart>0),0),
      'surplus', coalesce(sum(-ecart) filter (where ecart<0),0),
      'commission', coalesce(sum(commission_jour),0),
      'comptes_dat', coalesce(sum(coalesce(comptes_ouverts_dat,comptes_ouverts,0)),0),
      'adhesions', coalesce(sum(nb_adhesions),0)
    ) as j
    from f group by f.date
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom,
    'n_client', r.n_client, 'nom_prenom', r.nom_prenom, 'produit', r.produit,
    'mise', r.mise, 'nouvelle_mise', r.nouvelle_mise, 'montant_cotise', r.montant_cotise,
    'reactif', r.reactif, 'commentaire', r.commentaire) order by f.date desc, ag.nom),'[]'::jsonb)
  into v_react
  from public.reactivations r
  join public.fiches_journalieres f on f.id = r.fiche_id
  join public.agents ag on ag.id = f.agent_id
  where ag.equipe_id = v_equipe and ag.role in ('agent','chef') and (p_inclure_chef or ag.role <> 'chef')
    and f.date between p_date_debut and p_date_fin
    and coalesce(f.statut_validation,'en_attente') = any(p_statuts);

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom,
    'nom_client', a.nom_client, 'ancienne_mise', a.ancienne_mise, 'nouvelle_mise', a.nouvelle_mise,
    'hausse', greatest(coalesce(a.nouvelle_mise,0)-coalesce(a.ancienne_mise,0),0), 'motif', a.motif)
    order by f.date desc, ag.nom),'[]'::jsonb)
  into v_augm
  from public.augmentations_mise a
  join public.fiches_journalieres f on f.id = a.fiche_id
  join public.agents ag on ag.id = f.agent_id
  where ag.equipe_id = v_equipe and ag.role in ('agent','chef') and (p_inclure_chef or ag.role <> 'chef')
    and f.date between p_date_debut and p_date_fin
    and coalesce(f.statut_validation,'en_attente') = any(p_statuts);

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom,
    'type_assurance', s.type_assurance, 'nb', s.nb, 'montant', s.montant)
    order by f.date desc, ag.nom),'[]'::jsonb)
  into v_assur
  from public.assurances_details s
  join public.fiches_journalieres f on f.id = s.fiche_id
  join public.agents ag on ag.id = f.agent_id
  where ag.equipe_id = v_equipe and ag.role in ('agent','chef') and (p_inclure_chef or ag.role <> 'chef')
    and f.date between p_date_debut and p_date_fin
    and coalesce(f.statut_validation,'en_attente') = any(p_statuts);

  return jsonb_build_object(
    'ok', true,
    'equipe', jsonb_build_object('id', v_equipe, 'nom', v_equipe_nom, 'agence', v_agence_nom),
    'periode', jsonb_build_object('debut', p_date_debut, 'fin', p_date_fin),
    'statuts', to_jsonb(p_statuts), 'chef_inclus', p_inclure_chef,
    'synthese', v_agregats->'totaux',
    'par_membre', v_agregats->'par_membre',
    'par_jour', v_par_jour,
    'details_reactivations', v_react,
    'details_augmentations', v_augm,
    'details_assurances', v_assur
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

create or replace function public.rapport_agence(
  p_agence_id  uuid default null,
  p_date_debut date default (date_trunc('month', current_date))::date,
  p_date_fin   date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  p_statuts    text[] default array['validee']
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_agence uuid; v_moi public.agents; v_agregats jsonb; v_agence_nom text;
  v_par_jour jsonb; v_react jsonb; v_augm jsonb; v_assur jsonb;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null then return jsonb_build_object('ok', false, 'erreur', 'Compte introuvable, inactif ou suspendu.'); end if;
  v_agence := coalesce(p_agence_id, case when v_moi.role='responsable' then v_moi.agence_id end);
  if v_agence is null then return jsonb_build_object('ok', false, 'erreur', 'Aucune agence déterminée.'); end if;
  if public._peut_lire_agence(v_agence) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Accès non autorisé.'); end if;
  if p_date_debut is null or p_date_fin is null or p_date_fin < p_date_debut then
    return jsonb_build_object('ok', false, 'erreur', 'Intervalle de dates invalide.'); end if;
  if public._statuts_valides(p_statuts) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Statuts invalides.'); end if;

  v_agregats := public.agence_agregats(v_agence, p_date_debut, p_date_fin, p_statuts, null);
  if coalesce((v_agregats->>'ok')::boolean,false) is not true then
    return jsonb_build_object('ok', false, 'erreur', coalesce(v_agregats->>'erreur','Échec agrégats agence.'));
  end if;

  select nom into v_agence_nom from public.agences where id = v_agence;

  with membres as (
    select a.id from public.agents a where a.agence_id=v_agence and a.role in ('agent','chef')
  ),
  f as (
    select fj.*, (coalesce(fj.montant_smart,fj.montant_mobilise,0)-coalesce(fj.montant_caisse,fj.montant_rapporte,0)) as ecart
    from public.fiches_journalieres fj join membres m on m.id=fj.agent_id
    where fj.date between p_date_debut and p_date_fin and coalesce(fj.statut_validation,'en_attente')=any(p_statuts)
  )
  select coalesce(jsonb_agg(j order by (j->>'date') desc),'[]'::jsonb) into v_par_jour
  from (
    select jsonb_build_object(
      'date', f.date, 'nb_fiches', count(*),
      'smart', coalesce(sum(coalesce(montant_smart,montant_mobilise,0)),0),
      'caisse', coalesce(sum(coalesce(montant_caisse,montant_rapporte,0)),0),
      'manquant', coalesce(sum(ecart) filter (where ecart>0),0),
      'surplus', coalesce(sum(-ecart) filter (where ecart<0),0),
      'commission', coalesce(sum(commission_jour),0),
      'comptes_dat', coalesce(sum(coalesce(comptes_ouverts_dat,comptes_ouverts,0)),0),
      'adhesions', coalesce(sum(nb_adhesions),0)
    ) as j from f group by f.date
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom, 'equipe_id', ag.equipe_id,
    'n_client', r.n_client, 'nom_prenom', r.nom_prenom, 'produit', r.produit,
    'mise', r.mise, 'nouvelle_mise', r.nouvelle_mise, 'montant_cotise', r.montant_cotise,
    'reactif', r.reactif) order by f.date desc, ag.nom),'[]'::jsonb) into v_react
  from public.reactivations r
  join public.fiches_journalieres f on f.id=r.fiche_id
  join public.agents ag on ag.id=f.agent_id
  where ag.agence_id=v_agence and ag.role in ('agent','chef')
    and f.date between p_date_debut and p_date_fin and coalesce(f.statut_validation,'en_attente')=any(p_statuts);

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom, 'equipe_id', ag.equipe_id,
    'nom_client', a.nom_client, 'ancienne_mise', a.ancienne_mise, 'nouvelle_mise', a.nouvelle_mise,
    'hausse', greatest(coalesce(a.nouvelle_mise,0)-coalesce(a.ancienne_mise,0),0), 'motif', a.motif)
    order by f.date desc, ag.nom),'[]'::jsonb) into v_augm
  from public.augmentations_mise a
  join public.fiches_journalieres f on f.id=a.fiche_id
  join public.agents ag on ag.id=f.agent_id
  where ag.agence_id=v_agence and ag.role in ('agent','chef')
    and f.date between p_date_debut and p_date_fin and coalesce(f.statut_validation,'en_attente')=any(p_statuts);

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', f.date, 'membre', ag.prenom||' '||ag.nom, 'equipe_id', ag.equipe_id,
    'type_assurance', s.type_assurance, 'nb', s.nb, 'montant', s.montant)
    order by f.date desc, ag.nom),'[]'::jsonb) into v_assur
  from public.assurances_details s
  join public.fiches_journalieres f on f.id=s.fiche_id
  join public.agents ag on ag.id=f.agent_id
  where ag.agence_id=v_agence and ag.role in ('agent','chef')
    and f.date between p_date_debut and p_date_fin and coalesce(f.statut_validation,'en_attente')=any(p_statuts);

  return jsonb_build_object(
    'ok', true,
    'agence', jsonb_build_object('id', v_agence, 'nom', v_agence_nom),
    'periode', jsonb_build_object('debut', p_date_debut, 'fin', p_date_fin),
    'statuts', to_jsonb(p_statuts),
    'synthese', v_agregats->'totaux',
    'par_equipe', v_agregats->'par_equipe',
    'par_membre', v_agregats->'par_membre',
    'par_jour', v_par_jour,
    'details_reactivations', v_react,
    'details_augmentations', v_augm,
    'details_assurances', v_assur
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

notify pgrst, 'reload schema';
commit;
