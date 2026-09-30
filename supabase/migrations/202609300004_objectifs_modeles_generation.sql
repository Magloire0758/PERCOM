-- =====================================================================
-- PERCOM — Lot 16.3 : gestion des modèles + génération + attribution auto
-- Ordre de migration Lot 16 : 4/5.
-- Base : PERCOM (kuussvvtjjajvasfksnj). 30 septembre 2026.
--
-- Contenu :
--   (A) _generation_ouvrir() / _generation_fermer() : encadrent une génération
--       par un JETON aléatoire (croisé avec _generation_jetons du Lot 16.2b).
--       Restauration garantie via bloc exception dans chaque RPC appelante.
--   (B) _generer_objectifs_modele(modele, agent, date_reference) : helper interne
--       qui matérialise les objectifs 'modele' d'UN modèle pour UN agent sur les
--       périodes dues jusqu'à date_reference (idempotent via table application).
--   (C) admin_gerer_modele(...) : créer / mettre à jour / activer / désactiver un
--       modèle (droits RA=son agence, admin=toutes ; DG NON). Audit.
--   (D) admin_appliquer_modele(...) : appliquer un modèle actif à TOUS les
--       collaborateurs présents (activation, décision Elie). Aperçu + exécution.
--   (E) trigger AFTER sur agents : auto-attribution à la création / rattachement /
--       réactivation, + clôture des futurs de l'ancienne agence à la mutation.
--
-- SÉCURITÉ génération : origine='modele' n'est acceptée par le trigger 16.2b que
--   pendant une génération encadrée (jeton valide). Toute RPC ci-dessous valide
--   les droits AVANT d'ouvrir le jeton.
--
-- PRÉREQUIS : 16.2 (tables), 16.2b (jetons + trigger provenance), 15 (garde),
--   15.1c (index), 16.1 (helpers periodes/cibles). pg_cron ABSENT → le
--   renouvellement (Lot 16.4) est une RPC appelée par cron externe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (A) Encadrement de génération par jeton.
-- ---------------------------------------------------------------------
create or replace function public._generation_ouvrir()
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_jeton uuid := gen_random_uuid();
begin
  insert into public._generation_jetons(jeton) values (v_jeton);
  perform set_config('percom.generation_jeton', v_jeton::text, true);  -- local à la transaction
  return v_jeton;
end;
$function$;
revoke execute on function public._generation_ouvrir() from public, anon, authenticated;

create or replace function public._generation_fermer(p_jeton uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  delete from public._generation_jetons where jeton = p_jeton;
  perform set_config('percom.generation_jeton', '', true);
end;
$function$;
revoke execute on function public._generation_fermer(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- (B) Helper : matérialiser les objectifs d'UN modèle pour UN agent, sur les
--     périodes dues entre p_depuis et p_jusqua (bornes), en respectant :
--       - l'éligibilité (pas avant p_depuis = arrivée/réactivation) ;
--       - pas de rétroactif sur période terminée AVANT p_depuis ;
--       - idempotence (table application) ;
--       - convention (jour_date/mois/annee) ; absent ≠ zéro (NULL des mesures).
--     Suppose un jeton de génération déjà ouvert (appelé par C/D/E).
--     Retourne le nb d'objectifs créés.
-- ---------------------------------------------------------------------
create or replace function public._generer_objectifs_modele(
  p_modele public.objectifs_modeles,
  p_agent_id uuid,
  p_depuis date,        -- borne basse d'éligibilité (arrivée/réactivation/aujourd'hui)
  p_jusqua date         -- borne haute (fenêtre de matérialisation)
) returns int
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_dd date; v_df date; v_per record; v_cree int := 0; v_new_id uuid;
  v_debut date;
begin
  -- Fenêtre effective = intersection [modele.date_debut, modele.date_fin] ∩
  -- [p_depuis, p_jusqua]. date_fin NULL = ouvert.
  v_debut := greatest(p_modele.date_debut, p_depuis);
  v_df    := least(coalesce(p_modele.date_fin, p_jusqua), p_jusqua);
  if v_debut > v_df then
    return 0;   -- rien d'éligible dans la fenêtre
  end if;

  for v_per in
    select * from public._objectifs_periodes_intervalle(
      p_modele.type_periodicite, v_debut, v_df, p_modele.jours_semaine)
  loop
    declare
      -- Point 2 : pour l'annuel, la TRACE utilise mois=NULL (l'objectif garde
      -- mois=1). On calcule les valeurs de trace canoniques ici.
      v_trace_mois int := case when p_modele.type_periodicite='annuel' then null else v_per.mois end;
      v_obj_mois   int := case when p_modele.type_periodicite='annuel' then 1    else v_per.mois end;
      v_app_id uuid;
      v_deja_couvert boolean;
    begin
      -- Point 4 (A→B→A) : une période est "réellement couverte" seulement si une
      -- trace existe ET pointe vers un objectif encore présent NON supprimé.
      -- Une trace dont l'objectif a été supprimé (mutation B) ne bloque PAS la
      -- régénération au retour en A.
      -- Point 3 : "couvert" = la trace pointe vers un objectif NON supprimé QUI
      -- CORRESPOND TOUJOURS à l'agent + périodicité + période exacte de la trace.
      -- Un objectif déplacé (reclassé par l'admin vers un autre agent/période) ne
      -- compte plus comme couvrant cette période → régénération autorisée. Un
      -- objectif personnalisé qui garde la même clé reste, lui, protégé.
      select a.id,
             (a.objectif_id is not null
              and exists (select 1 from public.objectifs o
                          where o.id = a.objectif_id
                            and coalesce(o.statut_objectif,'') <> 'supprime'
                            and o.agent_id = p_agent_id
                            and o.type_periodicite = p_modele.type_periodicite
                            and coalesce(o.jour_date,'0001-01-01') = coalesce(v_per.jour_date,'0001-01-01')
                            and coalesce(o.mois,0)  = coalesce(v_obj_mois,0)   -- objectif : mois=1 pour annuel
                            and coalesce(o.annee,0) = coalesce(v_per.annee,0)))
        into v_app_id, v_deja_couvert
      from public.objectifs_modeles_application a
      where a.modele_id = p_modele.id and a.agent_id = p_agent_id
        and a.type_periodicite = p_modele.type_periodicite
        and coalesce(a.jour_date,'0001-01-01') = coalesce(v_per.jour_date,'0001-01-01')
        and coalesce(a.mois,0) = coalesce(v_trace_mois,0)
        and coalesce(a.annee,0) = coalesce(v_per.annee,0)
      limit 1;

      if coalesce(v_deja_couvert,false) then
        continue;   -- déjà un objectif vivant pour cette période
      end if;

      begin
        insert into public.objectifs (
          titre, type_cible, agent_id,
          type_periodicite, jour_date, mois, annee,
          description, statut_objectif, origine, modele_id, modele_version,
          cible_montant_smart, cible_montant_caisse, cible_commissions, cible_comptes_dat, cible_adhesions,
          cible_lyde_cash, cible_depot_dat, cible_depot_dav, cible_depot_pe,
          cible_reactivations_nb, cible_reactivations_montant, cible_augmentations_nb, cible_augmentations_montant,
          cible_assurances_nb, cible_assurances_montant
        ) values (
          p_modele.titre, 'agent', p_agent_id,
          p_modele.type_periodicite, v_per.jour_date, v_obj_mois, v_per.annee,
          p_modele.description, 'actif', 'modele', p_modele.id, p_modele.version,
          p_modele.cible_montant_smart, p_modele.cible_montant_caisse, p_modele.cible_commissions,
          p_modele.cible_comptes_dat, p_modele.cible_adhesions, p_modele.cible_lyde_cash,
          p_modele.cible_depot_dat, p_modele.cible_depot_dav, p_modele.cible_depot_pe,
          p_modele.cible_reactivations_nb, p_modele.cible_reactivations_montant,
          p_modele.cible_augmentations_nb, p_modele.cible_augmentations_montant,
          p_modele.cible_assurances_nb, p_modele.cible_assurances_montant
        ) returning id into v_new_id;

        -- trace : upsert (si une ancienne trace sans objectif vivant existait, on
        -- la met à jour avec le nouvel objectif).
        if v_app_id is not null then
          update public.objectifs_modeles_application set objectif_id = v_new_id where id = v_app_id;
        else
          insert into public.objectifs_modeles_application(
            modele_id, agent_id, type_periodicite, jour_date, mois, annee, objectif_id)
          values (p_modele.id, p_agent_id, p_modele.type_periodicite,
                  v_per.jour_date, v_trace_mois, v_per.annee, v_new_id);
        end if;
        v_cree := v_cree + 1;
      exception
        when unique_violation then
          -- un objectif de même clé existe déjà (manuel/personnalisé) : NE PAS
          -- remplacer. Tracer la période comme traitée (objectif_id NULL) pour ne
          -- pas re-tenter en boucle, sans écraser une trace existante.
          if v_app_id is null then
            insert into public.objectifs_modeles_application(
              modele_id, agent_id, type_periodicite, jour_date, mois, annee, objectif_id)
            values (p_modele.id, p_agent_id, p_modele.type_periodicite,
                    v_per.jour_date, v_trace_mois, v_per.annee, null)
            on conflict do nothing;
          end if;
      end;
    end;
  end loop;

  return v_cree;
end;
$function$;
revoke execute on function public._generer_objectifs_modele(public.objectifs_modeles,uuid,date,date) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- (C) Gestion des modèles : créer / éditer / activer / désactiver.
--     Droits : admin (toutes agences) ; RA (SON agence) ; DG NON.
-- ---------------------------------------------------------------------
create or replace function public.admin_gerer_modele(
  p_action     text,                 -- 'creer' | 'editer' | 'activer' | 'desactiver'
  p_modele_id  uuid default null,    -- requis sauf 'creer'
  p_agence_id  uuid default null,    -- requis pour 'creer'
  p_periodicite text default null,   -- requis pour 'creer'
  p_titre      text default null,
  p_description text default null,
  p_jours_semaine int[] default null,
  p_date_debut date default null,
  p_date_fin   date default null,
  p_cibles     jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_moi public.agents; v_id uuid; v_ag uuid; v_perr jsonb; v_m public.objectifs_modeles;
  v_app jsonb;   -- (point 1) résultat de l'application, déclaré au niveau principal.
  v_agence_lock uuid;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null then
    return jsonb_build_object('ok',false,'erreur','Compte introuvable, inactif ou suspendu.'); end if;
  if v_moi.role not in ('admin','responsable') then
    return jsonb_build_object('ok',false,'erreur','Gestion des modèles réservée à l''admin et au responsable.'); end if;

  -- ============================================================
  -- PROTOCOLE DE CONCURRENCE (revue Codex) : prendre le verrou consultatif
  -- d'AGENCE EN TOUT PREMIER, avant tout UPDATE / FOR UPDATE de ligne, pour
  -- TOUTES les branches (creer/editer/activer/desactiver). Même ordre que le
  -- trigger et admin_appliquer_modele → une seule ressource sérialise toute
  -- opération sur une agence, les verrous de ligne viennent toujours après.
  -- ============================================================
  if p_action = 'creer' then
    v_agence_lock := p_agence_id;
  else
    if p_modele_id is null then
      return jsonb_build_object('ok',false,'erreur','Modèle requis.'); end if;
    select agence_id into v_agence_lock from public.objectifs_modeles where id = p_modele_id;
    if v_agence_lock is null then
      return jsonb_build_object('ok',false,'erreur','Modèle introuvable.'); end if;
  end if;
  if v_agence_lock is not null then
    perform pg_advisory_xact_lock(hashtext('percom_modeles:'||v_agence_lock::text));
  end if;

  if p_action = 'creer' then
    if p_agence_id is null or p_periodicite is null or p_titre is null or length(btrim(p_titre))=0
       or p_date_debut is null then
      return jsonb_build_object('ok',false,'erreur','Agence, périodicité, titre et date de début requis.'); end if;
    if v_moi.role='responsable' and p_agence_id is distinct from v_moi.agence_id then
      return jsonb_build_object('ok',false,'erreur','Vous ne gérez que les modèles de votre agence.'); end if;
    v_perr := public._valider_cibles_chiffrees(p_cibles);
    if v_perr is not null then return v_perr; end if;

    insert into public.objectifs_modeles(
      agence_id, type_periodicite, jours_semaine, titre, description,
      date_debut, date_fin, created_by,
      cible_montant_smart, cible_montant_caisse, cible_commissions, cible_comptes_dat, cible_adhesions,
      cible_lyde_cash, cible_depot_dat, cible_depot_dav, cible_depot_pe,
      cible_reactivations_nb, cible_reactivations_montant, cible_augmentations_nb, cible_augmentations_montant,
      cible_assurances_nb, cible_assurances_montant
    ) values (
      p_agence_id, p_periodicite,
      case when p_periodicite='journalier' then p_jours_semaine else null end,
      btrim(p_titre), nullif(btrim(coalesce(p_description,'')),''),
      p_date_debut, p_date_fin, v_moi.id,
      (p_cibles->>'cible_montant_smart')::numeric,(p_cibles->>'cible_montant_caisse')::numeric,
      (p_cibles->>'cible_commissions')::numeric,(p_cibles->>'cible_comptes_dat')::numeric,
      (p_cibles->>'cible_adhesions')::numeric,(p_cibles->>'cible_lyde_cash')::numeric,
      (p_cibles->>'cible_depot_dat')::numeric,(p_cibles->>'cible_depot_dav')::numeric,
      (p_cibles->>'cible_depot_pe')::numeric,(p_cibles->>'cible_reactivations_nb')::numeric,
      (p_cibles->>'cible_reactivations_montant')::numeric,(p_cibles->>'cible_augmentations_nb')::numeric,
      (p_cibles->>'cible_augmentations_montant')::numeric,(p_cibles->>'cible_assurances_nb')::numeric,
      (p_cibles->>'cible_assurances_montant')::numeric
    ) returning id into v_id;

    perform public._audit_admin('modele_creer','objectifs_modeles',v_id,null,
      jsonb_build_object('agence_id',p_agence_id,'periodicite',p_periodicite,'titre',btrim(p_titre)),null);
    -- Point 7 : un modèle créé est actif → appliquer aussitôt aux présents.
    -- Point 2 : si l'application échoue, on ANNULE la création (exception → rollback).
    v_app := public.admin_appliquer_modele(v_id, null);
    if coalesce((v_app->>'ok')::boolean, false) is not true then
      raise exception 'Application initiale du modèle échouée : %', coalesce(v_app->>'erreur','erreur inconnue');
    end if;
    return jsonb_build_object('ok',true,'modele_id',v_id,'application',v_app);
  end if;

  -- actions sur un modèle existant
  if p_modele_id is null then
    return jsonb_build_object('ok',false,'erreur','Modèle requis.'); end if;
  select * into v_m from public.objectifs_modeles where id = p_modele_id;
  if not found then return jsonb_build_object('ok',false,'erreur','Modèle introuvable.'); end if;
  if v_moi.role='responsable' and v_m.agence_id is distinct from v_moi.agence_id then
    return jsonb_build_object('ok',false,'erreur','Vous ne gérez que les modèles de votre agence.'); end if;

  if p_action = 'desactiver' then
    update public.objectifs_modeles set actif=false where id=p_modele_id;
    perform public._audit_admin('modele_desactiver','objectifs_modeles',p_modele_id,
      jsonb_build_object('actif',true),jsonb_build_object('actif',false),null);
    return jsonb_build_object('ok',true,'modele_id',p_modele_id,'actif',false);

  elsif p_action = 'activer' then
    -- l'index unique partiel refuse un 2e modèle actif même agence/périodicité.
    begin
      update public.objectifs_modeles set actif=true where id=p_modele_id;
    exception when unique_violation then
      return jsonb_build_object('ok',false,'erreur','Un autre modèle actif existe déjà pour cette agence et cette périodicité.');
    end;
    perform public._audit_admin('modele_activer','objectifs_modeles',p_modele_id,
      jsonb_build_object('actif',false),jsonb_build_object('actif',true),null);
    -- Point 7 : activer applique aussitôt aux présents.
    -- Point 2 : échec application → annule l'activation (exception → rollback).
    v_app := public.admin_appliquer_modele(p_modele_id, null);
    if coalesce((v_app->>'ok')::boolean, false) is not true then
      raise exception 'Application du modèle après activation échouée : %', coalesce(v_app->>'erreur','erreur inconnue');
    end if;
    return jsonb_build_object('ok',true,'modele_id',p_modele_id,'actif',true,'application',v_app);

  elsif p_action = 'editer' then
    -- Point 8 : REMPLACEMENT COMPLET explicite (décision Elie). Le front envoie
    -- TOUJOURS l'état entier du modèle (titre, toutes les mesures, dates, jours).
    -- Un champ omis = effacé, assumé. Titre obligatoire pour éviter un effacement
    -- silencieux du libellé.
    if p_titre is null or length(btrim(p_titre))=0 then
      return jsonb_build_object('ok',false,'erreur','Titre requis (l''édition est un remplacement complet).'); end if;
    if p_date_debut is null then
      return jsonb_build_object('ok',false,'erreur','Date de début requise (remplacement complet).'); end if;
    v_perr := public._valider_cibles_chiffrees(p_cibles);
    if v_perr is not null then return v_perr; end if;
    update public.objectifs_modeles set
      titre = btrim(p_titre),
      description = nullif(btrim(coalesce(p_description,'')),''),
      jours_semaine = case when v_m.type_periodicite='journalier' then p_jours_semaine else null end,
      date_debut = p_date_debut,
      date_fin = p_date_fin,
      cible_montant_smart=(p_cibles->>'cible_montant_smart')::numeric,
      cible_montant_caisse=(p_cibles->>'cible_montant_caisse')::numeric,
      cible_commissions=(p_cibles->>'cible_commissions')::numeric,
      cible_comptes_dat=(p_cibles->>'cible_comptes_dat')::numeric,
      cible_adhesions=(p_cibles->>'cible_adhesions')::numeric,
      cible_lyde_cash=(p_cibles->>'cible_lyde_cash')::numeric,
      cible_depot_dat=(p_cibles->>'cible_depot_dat')::numeric,
      cible_depot_dav=(p_cibles->>'cible_depot_dav')::numeric,
      cible_depot_pe=(p_cibles->>'cible_depot_pe')::numeric,
      cible_reactivations_nb=(p_cibles->>'cible_reactivations_nb')::numeric,
      cible_reactivations_montant=(p_cibles->>'cible_reactivations_montant')::numeric,
      cible_augmentations_nb=(p_cibles->>'cible_augmentations_nb')::numeric,
      cible_augmentations_montant=(p_cibles->>'cible_augmentations_montant')::numeric,
      cible_assurances_nb=(p_cibles->>'cible_assurances_nb')::numeric,
      cible_assurances_montant=(p_cibles->>'cible_assurances_montant')::numeric
    where id = p_modele_id;
    -- (le trigger _objectifs_modeles_guard incrémente version + archive.)
    -- Les objectifs DÉJÀ créés ne sont PAS retouchés (règle : le modèle
    -- s'applique aux futures attributions ; MAJ des existants = op. explicite).
    perform public._audit_admin('modele_editer','objectifs_modeles',p_modele_id,null,null,null);
    return jsonb_build_object('ok',true,'modele_id',p_modele_id);
  end if;

  return jsonb_build_object('ok',false,'erreur','Action invalide.');
exception when others then
  return jsonb_build_object('ok',false,'erreur',SQLERRM);
end;
$function$;
revoke execute on function public.admin_gerer_modele(text,uuid,uuid,text,text,text,int[],date,date,jsonb) from public, anon;
grant  execute on function public.admin_gerer_modele(text,uuid,uuid,text,text,text,int[],date,date,jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- (D) Appliquer un modèle actif aux collaborateurs présents (activation).
--     Décision Elie : tous les présents immédiatement, idempotent, sans écraser.
--     Génère jusqu'à p_jusqua (défaut : fin du mois courant + fenêtre standard).
-- ---------------------------------------------------------------------
create or replace function public.admin_appliquer_modele(
  p_modele_id uuid,
  p_jusqua    date default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_moi public.agents; v_m public.objectifs_modeles; v_jeton uuid;
  v_agent record; v_cree int := 0; v_nb_agents int := 0; v_jusqua date;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null or v_moi.role not in ('admin','responsable') then
    return jsonb_build_object('ok',false,'erreur','Réservé à l''admin et au responsable.'); end if;

  -- Lire le modèle une 1re fois pour connaître l'agence (sans verrou), puis
  -- prendre le verrou consultatif AGENCE (point 4, même clé que le trigger),
  -- puis relire le modèle sous FOR UPDATE.
  select * into v_m from public.objectifs_modeles where id=p_modele_id;
  if not found then return jsonb_build_object('ok',false,'erreur','Modèle introuvable.'); end if;
  perform pg_advisory_xact_lock(hashtext('percom_modeles:'||v_m.agence_id::text));
  -- Point 6 : re-verrouiller le modèle (FOR UPDATE) après l'advisory, état à jour.
  select * into v_m from public.objectifs_modeles where id=p_modele_id for update;
  if not v_m.actif then return jsonb_build_object('ok',false,'erreur','Modèle inactif.'); end if;
  if v_moi.role='responsable' and v_m.agence_id is distinct from v_moi.agence_id then
    return jsonb_build_object('ok',false,'erreur','Modèle hors de votre agence.'); end if;

  -- fenêtre par défaut : fin du mois courant. Bornes (point 5) :
  --  - refuser une fin ANTÉRIEURE à aujourd'hui ;
  --  - jamais plus loin que fin d'année suivante.
  v_jusqua := coalesce(p_jusqua, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  if v_jusqua < current_date then
    return jsonb_build_object('ok',false,'erreur','Fenêtre de fin antérieure à aujourd''hui.'); end if;
  if v_jusqua > (date_trunc('year', current_date) + interval '2 years - 1 day')::date then
    return jsonb_build_object('ok',false,'erreur','Fenêtre trop lointaine (max fin d''année suivante).'); end if;

  -- Point 5 (corrigé point 3 de la revue) : PLAFOND calculé sur EXACTEMENT la
  -- même intersection de dates que le générateur, qui borne à modele.date_fin :
  --   [greatest(date_debut, current_date) , least(coalesce(date_fin, v_jusqua), v_jusqua)]
  -- Intersection vide → 0 période.
  declare
    v_nb_periodes bigint := 0;
    v_nb_agents_estim bigint;
    v_plafond bigint := 20000;
    v_gen_debut date := greatest(v_m.date_debut, current_date);
    v_gen_fin   date := least(coalesce(v_m.date_fin, v_jusqua), v_jusqua);
  begin
    if v_gen_debut <= v_gen_fin then
      select count(*) into v_nb_periodes
      from public._objectifs_periodes_intervalle(
        v_m.type_periodicite, v_gen_debut, v_gen_fin, v_m.jours_semaine);
    end if;
    select count(*) into v_nb_agents_estim
    from public.agents
    where agence_id = v_m.agence_id and role in ('agent','chef')
      and actif is true and coalesce(statut,'')='actif';
    if (v_nb_periodes * v_nb_agents_estim) > v_plafond then
      return jsonb_build_object('ok',false,'code','volume_excessif',
        'erreur',format('Trop d''objectifs (%s agents × %s périodes = %s, max %s). Réduisez la fenêtre.',
          v_nb_agents_estim, v_nb_periodes, v_nb_periodes*v_nb_agents_estim, v_plafond)); end if;
  end;

  v_jeton := public._generation_ouvrir();

  -- Point 6 : verrouiller les agents ciblés (FOR UPDATE) en ordre stable (id) —
  -- compatible avec les mutations qui verrouillent aussi la ligne agent — et
  -- REVALIDER le rattachement sous verrou dans la boucle (un agent peut avoir
  -- changé d'agence entre la sélection et la génération).
  for v_agent in
    select id, agence_id from public.agents
    where agence_id = v_m.agence_id
      and role in ('agent','chef')
      and actif is true and coalesce(statut,'')='actif'
    order by id
    for update
  loop
    -- revalidation sous verrou : l'agent est-il TOUJOURS dans l'agence du modèle ?
    if v_agent.agence_id is distinct from v_m.agence_id then
      continue;
    end if;
    v_nb_agents := v_nb_agents + 1;
    -- Point 3 : p_depuis = AUJOURD'HUI (pas début du mois) → pas de journaliers
    -- rétroactifs. Pour mensuel/annuel, le helper couvre quand même la période
    -- courante COMPLÈTE (troncature mois/année dans _objectifs_periodes_intervalle),
    -- ce qui réalise « arrivée en cours = objectif complet ».
    v_cree := v_cree + public._generer_objectifs_modele(
      v_m, v_agent.id,
      greatest(v_m.date_debut, current_date),
      v_jusqua);
  end loop;

  perform public._generation_fermer(v_jeton);

  perform public._audit_admin('modele_appliquer','objectifs_modeles',p_modele_id,null,
    jsonb_build_object('agents',v_nb_agents,'objectifs_crees',v_cree,'jusqua',v_jusqua),null);

  return jsonb_build_object('ok',true,'agents',v_nb_agents,'objectifs_crees',v_cree,'jusqua',v_jusqua);
exception when others then
  -- restauration du canal même en cas d'erreur
  if v_jeton is not null then perform public._generation_fermer(v_jeton); end if;
  return jsonb_build_object('ok',false,'erreur',SQLERRM);
end;
$function$;
revoke execute on function public.admin_appliquer_modele(uuid,date) from public, anon;
grant  execute on function public.admin_appliquer_modele(uuid,date) to authenticated;


-- ---------------------------------------------------------------------
-- (E) Trigger AFTER sur agents : auto-attribution + mutation.
--     Déclenché à : création (INSERT) d'un agent/chef actif avec agence ;
--     rattachement/mutation (UPDATE agence_id) ; réactivation (statut→actif).
--     Utilise SECURITY DEFINER (contourne RLS pour lire les modèles).
-- ---------------------------------------------------------------------
create or replace function public._agents_auto_objectifs()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_m public.objectifs_modeles; v_jeton uuid;
  v_actif_new boolean; v_actif_old boolean;
  v_mutation boolean := false; v_reactivation boolean := false; v_arrivee boolean := false;
  v_jusqua date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  -- Ne concerne que agents/chefs.
  if coalesce(NEW.role,'') not in ('agent','chef') then
    return NEW;
  end if;
  v_actif_new := (NEW.actif is true and coalesce(NEW.statut,'')='actif');

  if TG_OP = 'INSERT' then
    v_arrivee := v_actif_new and NEW.agence_id is not null;
  else
    v_actif_old := (OLD.actif is true and coalesce(OLD.statut,'')='actif');
    v_mutation     := (NEW.agence_id is distinct from OLD.agence_id) and NEW.agence_id is not null and v_actif_new;
    v_reactivation := (v_actif_new and not v_actif_old) and NEW.agence_id is not null;
    v_arrivee      := (NEW.agence_id is not null and OLD.agence_id is null and v_actif_new);
  end if;

  -- MUTATION : clôturer (supprime → libère la clé) les objectifs FUTURS non
  -- personnalisés issus d'un modèle de l'ANCIENNE agence (périodes non commencées).
  if TG_OP='UPDATE' and NEW.agence_id is distinct from OLD.agence_id and OLD.agence_id is not null then
    v_jeton := public._generation_ouvrir();   -- le passage supprime→... passe par la garde ; jeton non requis pour 'supprime' mais on garde un contexte cohérent
    update public.objectifs o
      set statut_objectif = 'supprime'
    where o.agent_id = NEW.id
      and o.origine = 'modele'                        -- jamais les manuels ni personnalisés
      and coalesce(o.statut_objectif,'') = 'actif'
      and o.modele_id in (select id from public.objectifs_modeles m where m.agence_id = OLD.agence_id)
      -- périodes FUTURES uniquement (pas commencées) :
      and (
           (o.type_periodicite='journalier' and o.jour_date > current_date)
        or (o.type_periodicite='mensuel'    and make_date(o.annee,o.mois,1) > date_trunc('month',current_date)::date)
        or (o.type_periodicite='annuel'     and o.annee > extract(year from current_date)::int)
      );
    perform public._generation_fermer(v_jeton);
    perform public._audit_admin('mutation_cloture_futurs','agent',NEW.id,
      jsonb_build_object('ancienne_agence',OLD.agence_id),jsonb_build_object('nouvelle_agence',NEW.agence_id),null);
  end if;

  -- GÉNÉRATION pour la nouvelle agence (arrivée / mutation / réactivation).
  if v_arrivee or v_mutation or v_reactivation then
    -- Point 4 : verrou consultatif PAR AGENCE, commun aux deux chemins
    -- (trigger + admin_appliquer_modele) → sérialise génération/mutation sur une
    -- même agence sans dépendre de l'ordre des verrous de lignes (pas de deadlock).
    perform pg_advisory_xact_lock(hashtext('percom_modeles:'||NEW.agence_id::text));
    v_jeton := public._generation_ouvrir();
    for v_m in
      -- relire les modèles actifs SOUS le verrou consultatif (état à jour).
      select * from public.objectifs_modeles
      where agence_id = NEW.agence_id and actif is true
    loop
      perform public._generer_objectifs_modele(
        v_m, NEW.id,
        greatest(v_m.date_debut, current_date),  -- point 3 : pas de journaliers rétroactifs
        v_jusqua);
    end loop;
    perform public._generation_fermer(v_jeton);
  end if;

  return NEW;
-- Point 5 (atomicité) : PAS de bloc exception absorbant. Si la clôture des
-- futurs OU la génération échoue, l'erreur remonte et TOUTE la transaction
-- (UPDATE agent inclus) est annulée → pas d'agent muté sans ses objectifs, ni de
-- clôture orpheline. L'admin réessaie. (Le jeton est nettoyé par le rollback.)
end;
$function$;

drop trigger if exists trg_agents_auto_objectifs on public.agents;
create trigger trg_agents_auto_objectifs
  after insert or update on public.agents
  for each row execute function public._agents_auto_objectifs();

-- =====================================================================
-- Fin Lot 16.3. Suite : 16.4 (renouvellement cron externe + contrat Codex).
-- =====================================================================
