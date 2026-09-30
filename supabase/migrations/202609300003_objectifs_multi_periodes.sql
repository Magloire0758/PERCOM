-- =====================================================================
-- PERCOM — Lot 16.1 : attribution d'objectifs sur PLUSIEURS périodes
-- Ordre de migration Lot 16 : 3/5 (après 16.2 et 16.2b).
-- Base : PERCOM (kuussvvtjjajvasfksnj). 30 septembre 2026.
--
-- Un intervalle (jour/mois/an) déplié en périodes exactes, valeurs RÉPÉTÉES à
-- l'identique (aucune proratisation). Chaque objectif passe par le trigger
-- _objectifs_guard_mutation (unicité/convention/droits) + index uniques.
--
-- CORRECTIONS 1re revue Codex (30/09) :
--   C1 — équipe : insère bien equipe_id (était NULL → refusé par le trigger).
--   C2 — validation des valeurs (montants ≥0 finis, compteurs entiers ≥0),
--        réutilisée du Lot 15.2, NULL préservé pour absent.
--   C3 — aperçu ET écriture partagent une validation commune (rôle actif, droits
--        par niveau, existence/périmètre des cibles) AVANT expansion ; le trigger
--        reste la protection finale. Aperçu distingue tentatives / créables
--        (déduit les doublons déjà présents).
--   C4 — params : NULL refusés explicitement ; jours_semaine ∈ 1..7 sans NULL ;
--        tableau VIDE = ERREUR (décision Elie) ; NULL = tous les jours ;
--        bornes de dates AVANT expansion (garde-fou volume sans overflow) ;
--        helper _objectifs_periodes_intervalle rendu réellement interne.
--   Prérequis : colonne `origine` (Lot 16.2) → exécuter 16.2 AVANT 16.1.
-- =====================================================================

-- Bornes de sécurité (avant toute expansion) : intervalle max par périodicité,
-- pour éviter de générer des millions de lignes ou un overflow de comptage.
--   journalier : 366 jours ; mensuel : 60 mois ; annuel : 20 ans.

-- ---------------------------------------------------------------------
-- Helper interne : déplie un intervalle en périodes exactes. INTERNE (revoke).
-- ---------------------------------------------------------------------
create or replace function public._objectifs_periodes_intervalle(
  p_periodicite   text,
  p_date_debut    date,
  p_date_fin      date,
  p_jours_semaine int[] default null   -- ISO 1..7 ; NULL = tous ; [] refusé en amont
) returns table(jour_date date, mois int, annee int)
language plpgsql immutable
as $function$
begin
  if p_periodicite = 'journalier' then
    return query
      select d::date, extract(month from d)::int, extract(year from d)::int
      from generate_series(p_date_debut, p_date_fin, interval '1 day') as d
      where p_jours_semaine is null
         or extract(isodow from d)::int = any(p_jours_semaine);
  elsif p_periodicite = 'mensuel' then
    return query
      select null::date, extract(month from m)::int, extract(year from m)::int
      from generate_series(date_trunc('month',p_date_debut), date_trunc('month',p_date_fin), interval '1 month') as m;
  elsif p_periodicite = 'annuel' then
    return query
      select null::date, 1, extract(year from y)::int
      from generate_series(date_trunc('year',p_date_debut), date_trunc('year',p_date_fin), interval '1 year') as y;
  end if;
end;
$function$;

revoke execute on function public._objectifs_periodes_intervalle(text,date,date,int[]) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Helper interne : validation commune (rôle actif + droits niveau + params).
-- Retourne NULL si OK, sinon un jsonb d'erreur {ok:false,code,erreur}.
-- INTERNE (revoke). v_type normalisé renvoyé via OUT.
-- ---------------------------------------------------------------------
create or replace function public._valider_attribution_multi(
  p_role text, p_agence uuid, p_actif boolean, p_statut text,
  p_niveau text, p_periodicite text, p_date_debut date, p_date_fin date,
  p_jours_semaine int[], p_cibles jsonb,
  out v_type text, out v_err jsonb, out v_nb_max_periodes int
)
language plpgsql immutable
as $function$
begin
  v_err := null; v_type := null; v_nb_max_periodes := null;

  if p_role is null then v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Session non identifiée.'); return; end if;
  if not (coalesce(p_actif,false) and coalesce(p_statut,'')='actif') then
    v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Compte non actif.'); return; end if;

  v_type := case when p_niveau='reseau' then 'global' else p_niveau end;
  if p_niveau is null or v_type not in ('agent','equipe','agence','global') then
    v_err := jsonb_build_object('ok',false,'code','portee_invalide','erreur','Niveau invalide.'); return; end if;

  -- Droits par niveau (le trigger revalide la cible précise).
  if p_role='admin' then null;
  elsif p_role='dg' then
    if v_type not in ('agence','global') then
      v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','La direction attribue par agence ou société.'); return; end if;
  elsif p_role='responsable' then
    if v_type not in ('agent','equipe') then
      v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Le responsable attribue par agent ou équipe.'); return; end if;
    if p_agence is null then
      v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Responsable sans agence.'); return; end if;
  elsif p_role='chef' then
    if v_type not in ('agent','equipe') then
      v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Le chef attribue par agent ou équipe.'); return; end if;
  else
    v_err := jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Droit insuffisant.'); return;
  end if;

  if p_periodicite is null or p_periodicite not in ('journalier','mensuel','annuel') then
    v_err := jsonb_build_object('ok',false,'code','periodicite_invalide','erreur','Périodicité invalide.'); return; end if;
  if p_date_debut is null or p_date_fin is null or p_date_fin < p_date_debut then
    v_err := jsonb_build_object('ok',false,'code','dates_invalides','erreur','Intervalle invalide.'); return; end if;

  -- Bornes AVANT expansion (garde-fou volume/overflow). v_nb_max_periodes = NOMBRE
  -- de périodes (bornes inclusives). Limites : 366 jours, 60 mois, 20 ans.
  if p_periodicite='journalier' then
    v_nb_max_periodes := (p_date_fin - p_date_debut) + 1;      -- nb de jours inclus
    if v_nb_max_periodes > 366 then
      v_err := jsonb_build_object('ok',false,'code','intervalle_trop_long','erreur','Intervalle journalier > 366 jours.'); return; end if;
  elsif p_periodicite='mensuel' then
    v_nb_max_periodes := ((extract(year from p_date_fin)-extract(year from p_date_debut))*12
                          + (extract(month from p_date_fin)-extract(month from p_date_debut)))::int + 1;  -- nb de mois inclus
    if v_nb_max_periodes > 60 then
      v_err := jsonb_build_object('ok',false,'code','intervalle_trop_long','erreur','Intervalle mensuel > 60 mois.'); return; end if;
  else
    v_nb_max_periodes := (extract(year from p_date_fin)-extract(year from p_date_debut))::int + 1;         -- nb d'années incluses
    if v_nb_max_periodes > 20 then
      v_err := jsonb_build_object('ok',false,'code','intervalle_trop_long','erreur','Intervalle annuel > 20 ans.'); return; end if;
  end if;

  -- Jours de semaine : NULL = tous ; VIDE = erreur ; sinon 1..7 sans NULL.
  if p_periodicite='journalier' and p_jours_semaine is not null then
    if array_length(p_jours_semaine,1) is null then
      v_err := jsonb_build_object('ok',false,'code','jours_invalides','erreur','Aucun jour de semaine sélectionné.'); return; end if;
    if array_position(p_jours_semaine, null) is not null then
      v_err := jsonb_build_object('ok',false,'code','jours_invalides','erreur','Jour de semaine NULL.'); return; end if;
    if exists (select 1 from unnest(p_jours_semaine) j where j < 1 or j > 7) then
      v_err := jsonb_build_object('ok',false,'code','jours_invalides','erreur','Jour de semaine hors 1..7.'); return; end if;
  end if;

  if p_cibles is null or jsonb_typeof(p_cibles) <> 'object' then
    v_err := jsonb_build_object('ok',false,'code','cibles_invalides','erreur','Cibles invalides (objet attendu).'); return; end if;
end;
$function$;

revoke execute on function public._valider_attribution_multi(text,uuid,boolean,text,text,text,date,date,int[],jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Helper interne : valide le gabarit chiffré (montants/compteurs). NULL=absent.
-- Retourne NULL si OK sinon jsonb d'erreur.
-- ---------------------------------------------------------------------
create or replace function public._valider_cibles_chiffrees(p_cibles jsonb)
returns jsonb language plpgsql immutable as $function$
declare
  v_keys_int text[] := array['cible_comptes_dat','cible_adhesions','cible_lyde_cash',
                             'cible_reactivations_nb','cible_augmentations_nb','cible_assurances_nb'];
  v_keys_num text[] := array['cible_montant_smart','cible_montant_caisse','cible_commissions',
                             'cible_depot_dat','cible_depot_dav','cible_depot_pe',
                             'cible_reactivations_montant','cible_augmentations_montant','cible_assurances_montant'];
  k text; v_txt text; v_val numeric;
begin
  -- Règle chaîne vide (revue Codex) : une clé présente mais vide/espaces est
  -- INVALIDE (l'appelant envoie un nombre OU omet la clé, jamais ""). Ainsi la
  -- règle est identique ici et à l'INSERT (qui utilise nullif(->>,'')). Valeurs
  -- finies uniquement : NaN ET ±Infinity rejetés. NULL (clé absente) = OK.
  foreach k in array v_keys_num loop
    if p_cibles ? k then                          -- clé présente
      v_txt := p_cibles->>k;
      if v_txt is null then
        null;                                     -- valeur JSON null = absent, OK
      elsif length(btrim(v_txt))=0 then
        return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Valeur vide : %s.',k));
      else
        begin v_val := v_txt::numeric; exception when others then
          return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Valeur non numérique : %s.',k)); end;
        if v_val is null or v_val = 'NaN'::numeric or v_val = 'Infinity'::numeric or v_val = '-Infinity'::numeric or not (v_val >= 0) then
          return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Valeur invalide : %s.',k)); end if;
      end if;
    end if;
  end loop;
  foreach k in array v_keys_int loop
    if p_cibles ? k then
      v_txt := p_cibles->>k;
      if v_txt is null then
        null;
      elsif length(btrim(v_txt))=0 then
        return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Compteur vide : %s.',k));
      else
        begin v_val := v_txt::numeric; exception when others then
          return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Compteur non numérique : %s.',k)); end;
        if v_val is null or v_val = 'NaN'::numeric or v_val = 'Infinity'::numeric or v_val = '-Infinity'::numeric or not (v_val >= 0) or v_val <> trunc(v_val) then
          return jsonb_build_object('ok',false,'code','cibles_invalides','erreur',format('Compteur invalide (entier) : %s.',k)); end if;
      end if;
    end if;
  end loop;
  return null;
end;
$function$;

revoke execute on function public._valider_cibles_chiffrees(jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Helper interne : contrôle de PÉRIMÈTRE des cibles (SÉCURITÉ — revue Codex).
-- L'aperçu comme l'écriture tournent en SECURITY DEFINER et lisent les objectifs
-- des cibles : il FAUT vérifier que l'appelant a le droit de viser ces cibles,
-- AVANT toute lecture. Retourne NULL si OK, sinon jsonb d'erreur.
--   agent  : la cible existe ; RA → même agence ; chef → même équipe.
--   equipe : la cible existe ; RA → même agence ; chef → son équipe.
--   agence : la cible existe ; (dg/admin uniquement, déjà filtré en amont).
--   global : rien à vérifier.
-- chef sans équipe / RA sans agence → refus.
-- ---------------------------------------------------------------------
create or replace function public._valider_cibles_perimetre(
  p_role text, p_agence uuid, p_equipe uuid,
  p_type text, p_cible_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_c uuid; v_ag uuid; v_eq uuid;
begin
  if p_type = 'global' then return null; end if;

  if p_role='chef' and p_equipe is null then
    return jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Chef sans équipe.'); end if;
  if p_role='responsable' and p_agence is null then
    return jsonb_build_object('ok',false,'code','role_non_autorise','erreur','Responsable sans agence.'); end if;

  foreach v_c in array p_cible_ids loop
    if p_type='agent' then
      select agence_id, equipe_id into v_ag, v_eq from public.agents where id=v_c;
      if not found then return jsonb_build_object('ok',false,'code','cible_introuvable','erreur','Agent introuvable.'); end if;
      if p_role='responsable' and v_ag is distinct from p_agence then
        return jsonb_build_object('ok',false,'code','hors_perimetre','erreur','Agent hors de votre agence.'); end if;
      if p_role='chef' and v_eq is distinct from p_equipe then
        return jsonb_build_object('ok',false,'code','hors_perimetre','erreur','Agent hors de votre équipe.'); end if;
    elsif p_type='equipe' then
      select agence_id into v_ag from public.equipes where id=v_c;
      if not found then return jsonb_build_object('ok',false,'code','cible_introuvable','erreur','Équipe introuvable.'); end if;
      if p_role='responsable' and v_ag is distinct from p_agence then
        return jsonb_build_object('ok',false,'code','hors_perimetre','erreur','Équipe hors de votre agence.'); end if;
      if p_role='chef' and v_c is distinct from p_equipe then
        return jsonb_build_object('ok',false,'code','hors_perimetre','erreur','Équipe autre que la vôtre.'); end if;
    elsif p_type='agence' then
      perform 1 from public.agences where id=v_c;
      if not found then return jsonb_build_object('ok',false,'code','cible_introuvable','erreur','Agence introuvable.'); end if;
    end if;
  end loop;
  return null;
end;
$function$;

revoke execute on function public._valider_cibles_perimetre(text,uuid,uuid,text,uuid[]) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- (A) APERÇU (lecture seule) : tentatives prévues ET créables (hors doublons).
-- ---------------------------------------------------------------------
create or replace function public.apercu_attribution_multi_periodes(
  p_niveau text, p_periodicite text, p_date_debut date, p_date_fin date,
  p_cible_ids uuid[] default null, p_jours_semaine int[] default null,
  p_cibles jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_role text; v_agence uuid; v_equipe uuid; v_actif boolean; v_statut text;
  v_type text; v_err jsonb; v_maxp int; v_max int := 5000; v_maxcib int := 2000;
  v_ids uuid[]; v_nb_per int; v_nb_cib int; v_deja int := 0; v_perr jsonb;
begin
  select role::text, agence_id, equipe_id, actif, statut::text
    into v_role,v_agence,v_equipe,v_actif,v_statut
    from agents where user_id = auth.uid();

  select vt.v_type, vt.v_err into v_type, v_err
  from public._valider_attribution_multi(v_role,v_agence,v_actif,v_statut,
       p_niveau,p_periodicite,p_date_debut,p_date_fin,p_jours_semaine,p_cibles) vt;
  if v_err is not null then return v_err; end if;

  -- validation des valeurs chiffrées (identique à l'écriture — revue Codex).
  v_perr := public._valider_cibles_chiffrees(p_cibles);
  if v_perr is not null then return v_perr; end if;

  -- cibles
  if v_type='global' then v_ids := array[null::uuid];
  else
    if p_cible_ids is null or array_length(p_cible_ids,1) is null then
      return jsonb_build_object('ok',false,'code','aucune_cible','erreur','Aucune cible.'); end if;
    if array_position(p_cible_ids,null) is not null then
      return jsonb_build_object('ok',false,'code','cibles_invalides','erreur','Identifiant NULL.'); end if;
    select array_agg(distinct x) into v_ids from unnest(p_cible_ids) x;
    -- borne du nombre de cibles.
    if array_length(v_ids,1) > v_maxcib then
      return jsonb_build_object('ok',false,'code','trop_de_cibles','erreur',format('Trop de cibles (%s, max %s).',array_length(v_ids,1),v_maxcib)); end if;
    -- CONTRÔLE DE PÉRIMÈTRE des cibles AVANT toute lecture (sécurité).
    v_perr := public._valider_cibles_perimetre(v_role,v_agence,v_equipe,v_type,v_ids);
    if v_perr is not null then return v_perr; end if;
  end if;

  v_nb_cib := coalesce(array_length(v_ids,1),0);

  -- nb de périodes réel, puis LIMITE DE VOLUME (bigint) AVANT la requête doublons.
  select count(*) into v_nb_per
  from public._objectifs_periodes_intervalle(p_periodicite,p_date_debut,p_date_fin,p_jours_semaine);
  if v_nb_per=0 then
    return jsonb_build_object('ok',false,'code','aucune_periode','erreur','Aucune période (vérifier les jours de semaine).'); end if;
  if (v_nb_cib::bigint * v_nb_per::bigint) > v_max then
    return jsonb_build_object('ok',false,'code','volume_excessif',
      'erreur',format('Trop d''objectifs (%s×%s=%s, max %s).',v_nb_per,v_nb_cib,v_nb_per::bigint*v_nb_cib::bigint,v_max)); end if;

  -- doublons déjà présents (mêmes clés, statut <> supprime) — APRÈS périmètre+limite
  select count(*) into v_deja
  from unnest(v_ids) as c(id)
  cross join public._objectifs_periodes_intervalle(p_periodicite,p_date_debut,p_date_fin,p_jours_semaine) as p
  join public.objectifs o
    on o.type_cible = v_type
   and coalesce(o.statut_objectif,'') <> 'supprime'
   and o.type_periodicite = p_periodicite
   and ( (v_type='agent' and o.agent_id=c.id)
      or (v_type='equipe' and o.equipe_id=c.id)
      or (v_type='agence' and o.agence_id=c.id)
      or (v_type='global') )
   and ( (p_periodicite='journalier' and o.jour_date=p.jour_date)
      or (p_periodicite='mensuel' and o.mois=p.mois and o.annee=p.annee)
      or (p_periodicite='annuel' and o.annee=p.annee) );

  return jsonb_build_object('ok',true,
    'nb_periodes',v_nb_per,'nb_cibles',v_nb_cib,
    'tentatives', v_nb_per*v_nb_cib,
    'deja_existants', v_deja,
    'creables_estimes', (v_nb_per*v_nb_cib) - v_deja,
    'limite',v_max,
    'depasse_limite', (v_nb_per*v_nb_cib) > v_max);
end;
$function$;

revoke execute on function public.apercu_attribution_multi_periodes(text,text,date,date,uuid[],int[],jsonb) from public, anon;
grant  execute on function public.apercu_attribution_multi_periodes(text,text,date,date,uuid[],int[],jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- (B) ATTRIBUTION (écriture).
-- ---------------------------------------------------------------------
create or replace function public.attribuer_objectifs_multi_periodes(
  p_niveau text, p_periodicite text, p_date_debut date, p_date_fin date,
  p_cible_ids uuid[], p_titre text, p_description text, p_cibles jsonb,
  p_jours_semaine int[] default null, p_ignorer_doublons boolean default true
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_role text; v_agence uuid; v_equipe uuid; v_actif boolean; v_statut text;
  v_type text; v_err jsonb; v_max int := 5000; v_maxcib int := 2000;
  v_ids uuid[]; v_cible uuid; v_per record; v_new_id uuid;
  v_cree int:=0; v_ignore int:=0; v_refuse int:=0; v_details jsonb:='[]'::jsonb;
  v_nb_per int; v_nb_cib int; v_perr jsonb;
begin
  select role::text, agence_id, equipe_id, actif, statut::text
    into v_role,v_agence,v_equipe,v_actif,v_statut
    from agents where user_id = auth.uid();

  -- Validation commune (rôle actif + droits + params + bornes).
  select vt.v_type, vt.v_err into v_type, v_err
  from public._valider_attribution_multi(v_role,v_agence,v_actif,v_statut,
       p_niveau,p_periodicite,p_date_debut,p_date_fin,p_jours_semaine,p_cibles) vt;
  if v_err is not null then return v_err; end if;

  -- Validation des valeurs chiffrées (C2).
  v_perr := public._valider_cibles_chiffrees(p_cibles);
  if v_perr is not null then return v_perr; end if;

  if p_titre is null or length(btrim(p_titre))=0 then
    return jsonb_build_object('ok',false,'code','titre_requis','erreur','Titre requis.'); end if;

  -- Cibles.
  if v_type='global' then v_ids := array[null::uuid];
  else
    if p_cible_ids is null or array_length(p_cible_ids,1) is null then
      return jsonb_build_object('ok',false,'code','aucune_cible','erreur','Aucune cible.'); end if;
    if array_position(p_cible_ids,null) is not null then
      return jsonb_build_object('ok',false,'code','cibles_invalides','erreur','Identifiant NULL.'); end if;
    select array_agg(distinct x) into v_ids from unnest(p_cible_ids) x;
    if array_length(v_ids,1) > v_maxcib then
      return jsonb_build_object('ok',false,'code','trop_de_cibles','erreur',format('Trop de cibles (%s, max %s).',array_length(v_ids,1),v_maxcib)); end if;
    -- CONTRÔLE DE PÉRIMÈTRE des cibles AVANT la boucle (sécurité, revue Codex).
    v_perr := public._valider_cibles_perimetre(v_role,v_agence,v_equipe,v_type,v_ids);
    if v_perr is not null then return v_perr; end if;
  end if;

  select count(*) into v_nb_per
  from public._objectifs_periodes_intervalle(p_periodicite,p_date_debut,p_date_fin,p_jours_semaine);
  v_nb_cib := coalesce(array_length(v_ids,1),0);
  if v_nb_per=0 then
    return jsonb_build_object('ok',false,'code','aucune_periode','erreur','Aucune période (vérifier les jours de semaine).'); end if;
  if (v_nb_per::bigint * v_nb_cib::bigint) > v_max then
    return jsonb_build_object('ok',false,'code','volume_excessif',
      'erreur',format('Trop d''objectifs (%s×%s=%s, max %s).',v_nb_per,v_nb_cib,(v_nb_per::bigint*v_nb_cib::bigint),v_max)); end if;

  foreach v_cible in array v_ids loop
    for v_per in
      select * from public._objectifs_periodes_intervalle(p_periodicite,p_date_debut,p_date_fin,p_jours_semaine)
    loop
      begin
        insert into objectifs (
          titre, type_cible,
          agent_id, agence_id, equipe_id, zone_id,
          type_periodicite, jour_date, mois, annee,
          description, statut_objectif, origine,
          cible_montant_smart, cible_montant_caisse, cible_commissions, cible_comptes_dat, cible_adhesions,
          cible_lyde_cash, cible_depot_dat, cible_depot_dav, cible_depot_pe,
          cible_reactivations_nb, cible_reactivations_montant, cible_augmentations_nb, cible_augmentations_montant,
          cible_assurances_nb, cible_assurances_montant
        ) values (
          btrim(p_titre), v_type,
          case when v_type='agent'  then v_cible else null end,
          case when v_type='agence' then v_cible else null end,
          case when v_type='equipe' then v_cible else null end,   -- C1 : équipe renseignée
          null,
          p_periodicite, v_per.jour_date, v_per.mois, v_per.annee,
          nullif(btrim(coalesce(p_description,'')),''), 'actif', 'manuel',
          (p_cibles->>'cible_montant_smart')::numeric,
          (p_cibles->>'cible_montant_caisse')::numeric,
          (p_cibles->>'cible_commissions')::numeric,
          (p_cibles->>'cible_comptes_dat')::numeric,
          (p_cibles->>'cible_adhesions')::numeric,
          (p_cibles->>'cible_lyde_cash')::numeric,
          (p_cibles->>'cible_depot_dat')::numeric,
          (p_cibles->>'cible_depot_dav')::numeric,
          (p_cibles->>'cible_depot_pe')::numeric,
          (p_cibles->>'cible_reactivations_nb')::numeric,
          (p_cibles->>'cible_reactivations_montant')::numeric,
          (p_cibles->>'cible_augmentations_nb')::numeric,
          (p_cibles->>'cible_augmentations_montant')::numeric,
          (p_cibles->>'cible_assurances_nb')::numeric,
          (p_cibles->>'cible_assurances_montant')::numeric
        ) returning id into v_new_id;

        v_cree := v_cree+1;
        v_details := v_details || jsonb_build_object('cible_id',v_cible,
          'periode',coalesce(v_per.jour_date::text, v_per.annee||'-'||lpad(v_per.mois::text,2,'0')),
          'etat','cree','objectif_id',v_new_id);
      exception
        when unique_violation then
          if p_ignorer_doublons then
            v_ignore:=v_ignore+1;
            v_details:=v_details||jsonb_build_object('cible_id',v_cible,
              'periode',coalesce(v_per.jour_date::text, v_per.annee||'-'||lpad(v_per.mois::text,2,'0')),
              'etat','ignore','motif','doublon');
          else
            v_refuse:=v_refuse+1;
            v_details:=v_details||jsonb_build_object('cible_id',v_cible,
              'periode',coalesce(v_per.jour_date::text, v_per.annee||'-'||lpad(v_per.mois::text,2,'0')),
              'etat','refuse','motif','doublon');
          end if;
        when others then
          v_refuse:=v_refuse+1;
          v_details:=v_details||jsonb_build_object('cible_id',v_cible,
            'periode',coalesce(v_per.jour_date::text, v_per.annee||'-'||lpad(v_per.mois::text,2,'0')),
            'etat','refuse','motif',SQLERRM);
      end;
    end loop;
  end loop;

  if v_cree>0 then
    perform public._audit_admin('objectifs_multi_periodes','objectifs',null,null,
      jsonb_build_object('niveau',v_type,'periodicite',p_periodicite,
        'date_debut',p_date_debut,'date_fin',p_date_fin,'jours_semaine',to_jsonb(p_jours_semaine),
        'nb_periodes',v_nb_per,'nb_cibles',v_nb_cib,'cree',v_cree,'ignore',v_ignore,'refuse',v_refuse),
      nullif(btrim(coalesce(p_description,'')),''));
  end if;

  return jsonb_build_object('ok',true,'cree',v_cree,'ignore',v_ignore,'refuse',v_refuse,
    'nb_periodes',v_nb_per,'nb_cibles',v_nb_cib,'details',v_details);
exception when others then
  return jsonb_build_object('ok',false,'code','erreur_interne','erreur',SQLERRM);
end;
$function$;

revoke execute on function public.attribuer_objectifs_multi_periodes(text,text,date,date,uuid[],text,text,jsonb,int[],boolean) from public, anon;
grant  execute on function public.attribuer_objectifs_multi_periodes(text,text,date,date,uuid[],text,text,jsonb,int[],boolean) to authenticated;

-- =====================================================================
-- Fin Lot 16.1 (corrigé). Prérequis : Lot 15 (trigger), 15.1c (index),
-- colonne `origine` (Lot 16.2 — exécuter AVANT).
-- =====================================================================
