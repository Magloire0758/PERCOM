-- PERCOM : fiches chef et RA, plus recentes en premier.
-- Sources : file equipe Lot 6.1 et file agence Lot 7.
-- Ordre global applique AVANT LIMIT/OFFSET, puis conserve dans le JSON.
-- Signatures, perimetres, filtres, compteurs et droits inchanges.
-- A appliquer sur la base PERCOM uniquement. Pas de modification des donnees.
begin;

-- Require the existing functions so CREATE OR REPLACE retains their owners/ACLs.
do $check$
begin
  if to_regprocedure('public.equipe_file_traitement(uuid,text[],uuid,date,date,integer,integer)') is null
     or to_regprocedure('public.agence_file_traitement(uuid,text[],uuid,uuid,date,date,integer,integer)') is null then
    raise exception 'Prerequis manquants : appliquer les Lots 6.1 et 7 sur PERCOM avant ce correctif.';
  end if;
end;
$check$;

create or replace function public.equipe_file_traitement(
  p_equipe_id  uuid default null,
  p_statuts    text[] default array['en_attente','a_corriger'],
  p_membre_id  uuid default null,
  p_date_debut date default null,
  p_date_fin   date default null,
  p_page       int  default 1,
  p_taille     int  default 20
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_equipe uuid; v_moi uuid; v_offset int;
  v_total int; v_cnt_attente int; v_cnt_corriger int; v_cnt_validees int;
  v_lignes jsonb;
begin
  v_moi := public._agent_courant_id();
  if v_moi is null then
    return jsonb_build_object('ok', false, 'erreur', 'Compte introuvable, inactif ou suspendu.');
  end if;
  v_equipe := coalesce(p_equipe_id, public._mon_equipe_de_chef());
  if v_equipe is null then
    return jsonb_build_object('ok', false, 'erreur', 'Aucune équipe déterminée.');
  end if;
  if public._peut_lire_equipe(v_equipe) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Accès non autorisé.');
  end if;
  if public._statuts_valides(p_statuts) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Statuts invalides.');
  end if;
  if p_date_debut is not null and p_date_fin is not null and p_date_fin < p_date_debut then
    return jsonb_build_object('ok', false, 'erreur', 'Intervalle invalide.');
  end if;
  p_page   := greatest(coalesce(p_page,1), 1);
  p_taille := least(greatest(coalesce(p_taille,20), 1), 100);
  v_offset := (p_page - 1) * p_taille;

  -- Compteurs globaux du périmètre (rattachement, tous statuts membre) indépendants de p_statuts/pagination
  select
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='en_attente'),
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='a_corriger'),
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='validee')
  into v_cnt_attente, v_cnt_corriger, v_cnt_validees
  from public.fiches_journalieres fj
  join public.agents a on a.id = fj.agent_id
  where a.equipe_id = v_equipe and a.role in ('agent','chef')
    and (p_membre_id is null or a.id = p_membre_id)
    and (p_date_debut is null or fj.date >= p_date_debut)
    and (p_date_fin   is null or fj.date <= p_date_fin);

  select count(*)
  into v_total
  from public.fiches_journalieres fj
  join public.agents a on a.id = fj.agent_id
  where a.equipe_id = v_equipe and a.role in ('agent','chef')
    and (p_membre_id is null or a.id = p_membre_id)
    and (p_date_debut is null or fj.date >= p_date_debut)
    and (p_date_fin   is null or fj.date <= p_date_fin)
    and coalesce(fj.statut_validation,'en_attente') = any(p_statuts);

  select coalesce(jsonb_agg(x order by x.date desc, x.heure_soumission desc nulls last, x.fiche_id desc), '[]'::jsonb)
  into v_lignes
  from (
    select fj.id as fiche_id, fj.agent_id, a.nom, a.prenom,
           (a.actif is true and coalesce(a.statut,'')='actif') as membre_actif,
           fj.date, fj.heure_soumission,
           (fj.agent_id = v_moi) as est_moi,
           (current_date - fj.date) as anciennete_jours,
           coalesce(fj.statut_validation,'en_attente') as statut,
           coalesce(fj.montant_smart,fj.montant_mobilise,0) as smart,
           coalesce(fj.montant_caisse,fj.montant_rapporte,0) as caisse,
           (coalesce(fj.montant_smart,fj.montant_mobilise,0) - coalesce(fj.montant_caisse,fj.montant_rapporte,0)) as ecart,
           (coalesce(fj.statut_validation,'en_attente') <> 'validee') as peut_traiter
    from public.fiches_journalieres fj
    join public.agents a on a.id = fj.agent_id
    where a.equipe_id = v_equipe and a.role in ('agent','chef')
      and (p_membre_id is null or a.id = p_membre_id)
      and (p_date_debut is null or fj.date >= p_date_debut)
      and (p_date_fin   is null or fj.date <= p_date_fin)
      and coalesce(fj.statut_validation,'en_attente') = any(p_statuts)
    order by fj.date desc, fj.heure_soumission desc nulls last, fj.id desc
    limit p_taille offset v_offset
  ) x;

  return jsonb_build_object(
    'ok', true, 'equipe_id', v_equipe, 'page', p_page, 'taille', p_taille,
    'total_filtre', v_total,
    'compteurs', jsonb_build_object('en_attente', v_cnt_attente, 'a_corriger', v_cnt_corriger, 'validees', v_cnt_validees),
    'fiches', v_lignes
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

create or replace function public.agence_file_traitement(
  p_agence_id  uuid default null,
  p_statuts    text[] default array['en_attente','a_corriger'],
  p_equipe_id  uuid default null,
  p_membre_id  uuid default null,
  p_date_debut date default null,
  p_date_fin   date default null,
  p_page       int default 1,
  p_taille     int default 20
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_agence uuid; v_moi public.agents; v_offset int;
  v_total int; v_cnt_attente int; v_cnt_corriger int; v_cnt_validees int; v_lignes jsonb;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null then return jsonb_build_object('ok', false, 'erreur', 'Compte introuvable, inactif ou suspendu.'); end if;
  v_agence := coalesce(p_agence_id, case when v_moi.role='responsable' then v_moi.agence_id end);
  if v_agence is null then return jsonb_build_object('ok', false, 'erreur', 'Aucune agence déterminée.'); end if;
  if public._peut_lire_agence(v_agence) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Accès non autorisé.'); end if;
  if public._statuts_valides(p_statuts) is not true then
    return jsonb_build_object('ok', false, 'erreur', 'Statuts invalides.'); end if;
  if p_date_debut is not null and p_date_fin is not null and p_date_fin < p_date_debut then
    return jsonb_build_object('ok', false, 'erreur', 'Intervalle invalide.'); end if;
  p_page := greatest(coalesce(p_page,1),1);
  p_taille := least(greatest(coalesce(p_taille,20),1),100);
  v_offset := (p_page-1)*p_taille;

  select
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='en_attente'),
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='a_corriger'),
    count(*) filter (where coalesce(fj.statut_validation,'en_attente')='validee')
  into v_cnt_attente, v_cnt_corriger, v_cnt_validees
  from public.fiches_journalieres fj join public.agents a on a.id=fj.agent_id
  where a.agence_id=v_agence and a.role in ('agent','chef')
    and (p_equipe_id is null or a.equipe_id=p_equipe_id)
    and (p_membre_id is null or a.id=p_membre_id)
    and (p_date_debut is null or fj.date>=p_date_debut)
    and (p_date_fin is null or fj.date<=p_date_fin);

  select count(*) into v_total
  from public.fiches_journalieres fj join public.agents a on a.id=fj.agent_id
  where a.agence_id=v_agence and a.role in ('agent','chef')
    and (p_equipe_id is null or a.equipe_id=p_equipe_id)
    and (p_membre_id is null or a.id=p_membre_id)
    and (p_date_debut is null or fj.date>=p_date_debut)
    and (p_date_fin is null or fj.date<=p_date_fin)
    and coalesce(fj.statut_validation,'en_attente')=any(p_statuts);

  select coalesce(jsonb_agg(x order by x.date desc, x.heure_soumission desc nulls last, x.fiche_id desc),'[]'::jsonb)
  into v_lignes
  from (
    select fj.id as fiche_id, fj.agent_id, a.nom, a.prenom, a.equipe_id,
           (a.actif is true and coalesce(a.statut,'')='actif') as membre_actif,
           fj.date, fj.heure_soumission, (current_date-fj.date) as anciennete_jours,
           coalesce(fj.statut_validation,'en_attente') as statut,
           coalesce(fj.montant_smart,fj.montant_mobilise,0) as smart,
           coalesce(fj.montant_caisse,fj.montant_rapporte,0) as caisse,
           (coalesce(fj.montant_smart,fj.montant_mobilise,0)-coalesce(fj.montant_caisse,fj.montant_rapporte,0)) as ecart,
           (coalesce(fj.statut_validation,'en_attente')<>'validee') as peut_traiter
    from public.fiches_journalieres fj join public.agents a on a.id=fj.agent_id
    where a.agence_id=v_agence and a.role in ('agent','chef')
      and (p_equipe_id is null or a.equipe_id=p_equipe_id)
      and (p_membre_id is null or a.id=p_membre_id)
      and (p_date_debut is null or fj.date>=p_date_debut)
      and (p_date_fin is null or fj.date<=p_date_fin)
      and coalesce(fj.statut_validation,'en_attente')=any(p_statuts)
    order by fj.date desc, fj.heure_soumission desc nulls last, fj.id desc
    limit p_taille offset v_offset
  ) x;

  return jsonb_build_object(
    'ok', true, 'agence_id', v_agence, 'page', p_page, 'taille', p_taille,
    'total_filtre', v_total,
    'compteurs', jsonb_build_object('en_attente',v_cnt_attente,'a_corriger',v_cnt_corriger,'validees',v_cnt_validees),
    'fiches', v_lignes
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

notify pgrst, 'reload schema';
commit;
