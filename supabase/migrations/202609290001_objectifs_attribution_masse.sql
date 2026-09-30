-- PERCOM — Attribution d'objectifs en masse
-- Fonction appelée par components/NetworkObjectives.tsx (BulkGoalEditor).
-- À exécuter dans l'éditeur SQL du projet Supabase PERCOM.
-- Contrat : docs/sig/PERCOM-OBJECTIFS-ATTRIBUTION-MASSE-BACKEND-2026-09-29.md
--
-- Audit : les écritures dans `objectifs` sont journalisées par le trigger d'audit
-- existant de la table (cf. DECISIONS-PERCOM-ADMIN-2026-09-23 : « objectifs déjà gérés
-- par trigger »). Chaque insert ci-dessous se fait dans CETTE transaction, avec l'auteur
-- réel obtenu via auth.uid() (non nul sous le JWT de l'admin). Pas de second journal ici
-- pour éviter un double comptage. Un événement de synthèse « attribution de masse » peut
-- être ajouté si la table/fonction de journal est communiquée.

create or replace function public.attribuer_objectifs_en_masse(
  p_type_cible       text,
  p_cible_ids        uuid[],
  p_titre            text,
  p_date_debut       date,
  p_date_fin         date,
  p_type_periodicite text,
  p_description      text,
  p_cibles           jsonb,
  p_ignorer_doublons boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text;
  v_agence   uuid;
  v_actif    boolean;
  v_statut   text;
  v_ids      uuid[];
  v_cible    uuid;
  v_ag       uuid;
  v_eq       uuid;
  v_exists   boolean;
  v_cree     int := 0;
  v_ignore   int := 0;
  v_refuse   int := 0;
  v_details  jsonb := '[]'::jsonb;
  v_keys     text[] := array[
    'cible_montant_smart','cible_montant_caisse','cible_commissions','cible_comptes_dat','cible_adhesions',
    'cible_lyde_cash','cible_depot_dat','cible_depot_dav','cible_depot_pe',
    'cible_reactivations_nb','cible_reactivations_montant','cible_augmentations_nb','cible_augmentations_montant',
    'cible_assurances_nb','cible_assurances_montant'];
  k     text;
  v_val numeric;
begin
  -- Identité de l'appelant (jamais fournie par le client)
  select role::text, agence_id, actif, statut::text
    into v_role, v_agence, v_actif, v_statut
    from agents where user_id = auth.uid();

  if v_role is null then
    return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'Session non identifiée.');
  end if;
  -- Gardes NULL explicites : un statut/actif NULL ne doit pas passer.
  if coalesce(v_actif, false) is not true or coalesce(v_statut, '') <> 'actif' then
    return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'Compte non actif.');
  end if;

  -- Portée : refus explicite du réseau et des valeurs NULL/inconnues
  if p_type_cible = 'reseau' then
    return jsonb_build_object('ok', false, 'code', 'reseau_interdit_en_masse', 'erreur', 'Le réseau est une cible unique, pas une distribution.');
  end if;
  if p_type_cible is null or p_type_cible not in ('agent', 'equipe', 'agence') then
    return jsonb_build_object('ok', false, 'code', 'portee_invalide', 'erreur', 'Portée invalide.');
  end if;

  -- Droit par rôle
  if v_role = 'admin' then
    null; -- toutes portées
  elsif v_role = 'dg' then
    if p_type_cible <> 'agence' then
      return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'La direction attribue uniquement par agence.');
    end if;
  elsif v_role = 'responsable' then
    if p_type_cible = 'agence' then
      return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'Le responsable attribue par agent ou équipe.');
    end if;
    if v_agence is null then
      return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'Responsable sans agence.');
    end if;
  else
    return jsonb_build_object('ok', false, 'code', 'role_non_autorise', 'erreur', 'Droit insuffisant.');
  end if;

  -- Titre / périodicité / dates (refus bloquants : annulent tout)
  if p_titre is null or length(btrim(p_titre)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'titre_requis', 'erreur', 'Titre requis.');
  end if;
  if p_type_periodicite is null or p_type_periodicite not in
     ('journalier', 'hebdomadaire', 'mensuel', 'trimestriel', 'annuel', 'permanent') then
    return jsonb_build_object('ok', false, 'code', 'periodicite_invalide', 'erreur', 'Périodicité invalide.');
  end if;
  if p_date_debut is null or p_date_fin is null or p_date_debut > p_date_fin or (p_date_fin - p_date_debut) > 366 then
    return jsonb_build_object('ok', false, 'code', 'dates_invalides', 'erreur', 'Période invalide (max 366 jours).');
  end if;

  -- Cibles chiffrées : objet, valeurs finies, positives, entières pour les compteurs
  if p_cibles is not null and jsonb_typeof(p_cibles) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'cibles_invalides', 'erreur', 'Cibles chiffrées mal formées.');
  end if;
  foreach k in array v_keys loop
    begin
      v_val := coalesce((p_cibles->>k)::numeric, 0);
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'cibles_invalides', 'erreur', 'Cible chiffrée non numérique : ' || k || '.');
    end;
    if v_val is null or v_val = 'NaN'::numeric or v_val < 0 then
      return jsonb_build_object('ok', false, 'code', 'cibles_invalides', 'erreur', 'Cible chiffrée invalide : ' || k || '.');
    end if;
    if (right(k, 3) = '_nb' or k in ('cible_comptes_dat', 'cible_adhesions', 'cible_lyde_cash'))
       and v_val <> trunc(v_val) then
      return jsonb_build_object('ok', false, 'code', 'cibles_invalides', 'erreur', 'Compteur non entier : ' || k || '.');
    end if;
  end loop;

  -- Cibles : refus des identifiants NULL, puis normalisation (dédoublonnage)
  if p_cible_ids is null or array_length(p_cible_ids, 1) is null then
    return jsonb_build_object('ok', false, 'code', 'aucune_cible', 'erreur', 'Aucune cible sélectionnée.');
  end if;
  if exists (select 1 from unnest(p_cible_ids) e where e is null) then
    return jsonb_build_object('ok', false, 'code', 'cible_nulle', 'erreur', 'Identifiant de cible nul.');
  end if;
  select array(select distinct e from unnest(p_cible_ids) e) into v_ids;
  if array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'code', 'aucune_cible', 'erreur', 'Aucune cible sélectionnée.');
  end if;

  -- Distribution : une copie indépendante du gabarit par cible
  foreach v_cible in array v_ids loop
    v_ag := null; v_eq := null;

    if p_type_cible = 'agent' then
      select agence_id, equipe_id into v_ag, v_eq from agents where id = v_cible;
      if not found then
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'agent_introuvable');
        continue;
      end if;
      if v_role = 'responsable' and v_ag is distinct from v_agence then
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'hors_agence');
        continue;
      end if;

    elsif p_type_cible = 'equipe' then
      select agence_id into v_ag from equipes where id = v_cible;
      if not found then
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'equipe_introuvable');
        continue;
      end if;
      v_eq := v_cible;
      if v_role = 'responsable' and v_ag is distinct from v_agence then
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'hors_agence');
        continue;
      end if;

    else -- agence
      perform 1 from agences where id = v_cible;
      if not found then
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'agence_introuvable');
        continue;
      end if;
      v_ag := v_cible;
    end if;

    -- Verrou transactionnel par cible : deux appels simultanés sur la même cible se
    -- sérialisent, le second voit l'objectif inséré par le premier (anti-doublon fiable).
    perform pg_advisory_xact_lock(hashtextextended(p_type_cible || ':' || v_cible::text, 0));

    -- Anti-doublon : même type_cible + même cible + périodes chevauchantes.
    -- Couvre aussi les anciens objectifs datés par mois/annee sans date_debut/date_fin.
    select exists (
      select 1 from objectifs o
       where o.type_cible::text = p_type_cible
         and coalesce(o.statut_objectif::text, '') <> 'supprime'
         and (case p_type_cible
                when 'agent'  then o.agent_id
                when 'equipe' then o.equipe_id
                else o.agence_id end) = v_cible
         and coalesce(o.date_debut, make_date(o.annee, coalesce(o.mois, 1), 1)) <= p_date_fin
         and coalesce(o.date_fin, (make_date(o.annee, coalesce(o.mois, 12), 1) + interval '1 month - 1 day')::date) >= p_date_debut
    ) into v_exists;

    if v_exists then
      if p_ignorer_doublons then
        v_ignore := v_ignore + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'ignore', 'motif', 'doublon');
      else
        v_refuse := v_refuse + 1;
        v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'refuse', 'motif', 'doublon');
      end if;
      continue;
    end if;

    -- Le trigger d'audit de `objectifs` journalise cet insert dans la même transaction,
    -- auteur = auth.uid() (l'admin).
    insert into objectifs (
      titre, type_cible, agence_id, equipe_id, agent_id, zone_id,
      date_debut, date_fin, mois, annee, type_periodicite, description, statut_objectif,
      cible_montant_smart, cible_montant_caisse, cible_commissions, cible_comptes_dat, cible_adhesions,
      cible_lyde_cash, cible_depot_dat, cible_depot_dav, cible_depot_pe,
      cible_reactivations_nb, cible_reactivations_montant, cible_augmentations_nb, cible_augmentations_montant,
      cible_assurances_nb, cible_assurances_montant
    ) values (
      btrim(p_titre), p_type_cible,
      case when p_type_cible = 'agence' then v_cible else v_ag end,
      case when p_type_cible = 'equipe' then v_cible when p_type_cible = 'agent' then v_eq else null end,
      case when p_type_cible = 'agent' then v_cible else null end,
      null,
      p_date_debut, p_date_fin,
      extract(month from p_date_debut)::int, extract(year from p_date_debut)::int,
      p_type_periodicite, nullif(btrim(coalesce(p_description, '')), ''), 'actif',
      coalesce((p_cibles->>'cible_montant_smart')::numeric, 0),
      coalesce((p_cibles->>'cible_montant_caisse')::numeric, 0),
      coalesce((p_cibles->>'cible_commissions')::numeric, 0),
      coalesce((p_cibles->>'cible_comptes_dat')::numeric, 0),
      coalesce((p_cibles->>'cible_adhesions')::numeric, 0),
      coalesce((p_cibles->>'cible_lyde_cash')::numeric, 0),
      coalesce((p_cibles->>'cible_depot_dat')::numeric, 0),
      coalesce((p_cibles->>'cible_depot_dav')::numeric, 0),
      coalesce((p_cibles->>'cible_depot_pe')::numeric, 0),
      coalesce((p_cibles->>'cible_reactivations_nb')::numeric, 0),
      coalesce((p_cibles->>'cible_reactivations_montant')::numeric, 0),
      coalesce((p_cibles->>'cible_augmentations_nb')::numeric, 0),
      coalesce((p_cibles->>'cible_augmentations_montant')::numeric, 0),
      coalesce((p_cibles->>'cible_assurances_nb')::numeric, 0),
      coalesce((p_cibles->>'cible_assurances_montant')::numeric, 0)
    );

    v_cree := v_cree + 1;
    v_details := v_details || jsonb_build_object('cible_id', v_cible, 'etat', 'cree');
  end loop;

  return jsonb_build_object('ok', true, 'cree', v_cree, 'ignore', v_ignore, 'refuse', v_refuse, 'details', v_details);
end;
$$;

-- Droits : retirer le droit par défaut de PUBLIC/anon, n'autoriser que les comptes connectés.
revoke execute on function public.attribuer_objectifs_en_masse(
  text, uuid[], text, date, date, text, text, jsonb, boolean
) from public, anon;

grant execute on function public.attribuer_objectifs_en_masse(
  text, uuid[], text, date, date, text, text, jsonb, boolean
) to authenticated;
