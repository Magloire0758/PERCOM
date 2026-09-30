-- =====================================================================
-- PERCOM — Lots 16.3c + 16.4 : mutations, reprise et renouvellement
-- Ordre de migration Lot 16 : 5/5.
-- Base cible : PERCOM (kuussvvtjjajvasfksnj). 30 septembre 2026.
--
-- PREREQUIS : Lots 15, 15.1c, 16.1, 16.2, 16.2b et 16.3 appliques.
-- Ce fichier remplace le projet 16.3b : le front conserve la RPC existante
-- admin_muter_membre_equipe(uuid, uuid).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. File de reprise et canal interne des mutations de rattachement.
-- ---------------------------------------------------------------------
create table if not exists public.objectifs_attribution_attente (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  motif text not null,
  cree_at timestamptz not null default now()
);

alter table public.objectifs_attribution_attente enable row level security;
create or replace function public._peut_lire_attribution_attente(p_agent_id uuid)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_moi public.agents;
  v_agence uuid;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null then
    return false;
  end if;
  if v_moi.role in ('admin', 'dg') then
    return true;
  end if;
  if v_moi.role <> 'responsable' or v_moi.agence_id is null then
    return false;
  end if;
  select a.agence_id into v_agence from public.agents a where a.id = p_agent_id;
  return found and v_agence = v_moi.agence_id;
end;
$function$;
revoke execute on function public._peut_lire_attribution_attente(uuid)
  from public, anon;
grant execute on function public._peut_lire_attribution_attente(uuid)
  to authenticated;

drop policy if exists objectifs_attribution_attente_select
  on public.objectifs_attribution_attente;
create policy objectifs_attribution_attente_select
  on public.objectifs_attribution_attente
  for select to authenticated
  using (
    public._peut_lire_attribution_attente(agent_id)
  );
revoke all on public.objectifs_attribution_attente from public, anon;
grant select on public.objectifs_attribution_attente to authenticated;

create table if not exists public._mutation_objectifs_jetons (
  jeton uuid primary key,
  agent_id uuid not null references public.agents(id) on delete cascade,
  source_agence_id uuid,
  destination_agence_id uuid not null,
  cree_at timestamptz not null default now()
);
alter table public._mutation_objectifs_jetons enable row level security;
revoke all on public._mutation_objectifs_jetons from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Auto-attribution : creation/reactivation non bloquante.
--    Tout changement d'agence doit porter le jeton emis par la RPC de mutation.
-- ---------------------------------------------------------------------
create or replace function public._agents_auto_objectifs()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_m public.objectifs_modeles;
  v_jeton uuid;
  v_actif_new boolean;
  v_actif_old boolean := false;
  v_arrivee boolean := false;
  v_reactivation boolean := false;
  v_mutation_ok boolean := false;
  v_mutation_jeton text;
  v_jusqua date := (date_trunc('month', current_date)
                    + interval '1 month - 1 day')::date;
begin
  if coalesce(NEW.role, '') not in ('agent', 'chef') then
    return NEW;
  end if;

  v_actif_new := NEW.actif is true and coalesce(NEW.statut, '') = 'actif';

  if TG_OP = 'UPDATE' and NEW.agence_id is distinct from OLD.agence_id then
    v_mutation_jeton := current_setting('percom.mutation_objectifs_jeton', true);
    if coalesce(v_mutation_jeton, '') <> '' then
      begin
        select exists (
          select 1
          from public._mutation_objectifs_jetons j
          where j.jeton = v_mutation_jeton::uuid
            and j.agent_id = NEW.id
            and j.source_agence_id is not distinct from OLD.agence_id
            and j.destination_agence_id = NEW.agence_id
        ) into v_mutation_ok;
      exception when others then
        v_mutation_ok := false;
      end;
    end if;
    if coalesce(v_mutation_ok, false) is not true then
      raise exception 'Rattachement: utilisez admin_muter_membre_equipe pour changer l''agence.';
    end if;
    -- La RPC encadrante cloture les anciens objectifs et genere les nouveaux.
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    v_arrivee := v_actif_new and NEW.agence_id is not null;
  else
    v_actif_old := OLD.actif is true and coalesce(OLD.statut, '') = 'actif';
    v_reactivation := v_actif_new and not v_actif_old
                      and NEW.agence_id is not null;
  end if;

  if not (v_arrivee or v_reactivation) then
    return NEW;
  end if;

  -- Un trigger AFTER possede deja le verrou de la ligne agent. Il ne doit donc
  -- jamais attendre le verrou applicatif d'agence.
  if pg_try_advisory_xact_lock(
       hashtext('percom_modeles:' || NEW.agence_id::text)
     ) then
    v_jeton := public._generation_ouvrir();
    for v_m in
      select *
      from public.objectifs_modeles
      where agence_id = NEW.agence_id and actif is true
      order by type_periodicite, id
    loop
      perform public._generer_objectifs_modele(
        v_m, NEW.id, greatest(v_m.date_debut, current_date), v_jusqua
      );
    end loop;
    perform public._generation_fermer(v_jeton);
    delete from public.objectifs_attribution_attente where agent_id = NEW.id;
  else
    insert into public.objectifs_attribution_attente(agent_id, motif)
    values (NEW.id, case when v_arrivee then 'arrivee' else 'reactivation' end)
    on conflict (agent_id) do update
      set motif = excluded.motif, cree_at = now();
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_agents_auto_objectifs on public.agents;
create trigger trg_agents_auto_objectifs
  after insert or update on public.agents
  for each row execute function public._agents_auto_objectifs();

-- L'ancienne proposition 16.3b ne doit pas rester comme chemin alternatif.
drop function if exists public.admin_muter_agent(uuid, uuid, uuid);

-- ---------------------------------------------------------------------
-- 3. Mutation equipe/agence : contrat deja utilise par le front admin.
-- ---------------------------------------------------------------------
create or replace function public.admin_muter_membre_equipe(
  p_agent_id uuid,
  p_equipe_id uuid
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_moi public.agents;
  v_agent_initial public.agents;
  v_agent public.agents;
  v_equipe_initial public.equipes;
  v_equipe public.equipes;
  v_ancienne_eq uuid;
  v_ancienne_ag uuid;
  v_nouvelle_ag uuid;
  v_lock_a uuid;
  v_lock_b uuid;
  v_ancien_ref uuid;
  v_nouveau_ref uuid;
  v_nb_zones_ret integer := 0;
  v_nb_clotures integer := 0;
  v_nb_generes integer := 0;
  v_mutation_jeton uuid;
  v_generation_jeton uuid;
  v_m public.objectifs_modeles;
  v_jusqua date := (date_trunc('month', current_date)
                    + interval '1 month - 1 day')::date;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null or v_moi.role <> 'admin' then
    return jsonb_build_object(
      'ok', false, 'erreur', 'Acces reserve a un administrateur actif.'
    );
  end if;
  if p_agent_id is null or p_equipe_id is null then
    return jsonb_build_object('ok', false, 'erreur', 'Agent et equipe requis.');
  end if;

  -- Lectures sans verrou uniquement pour connaitre les deux agences. Toute
  -- decision est revalidee apres les advisory locks et le verrou de ligne.
  select * into v_agent_initial from public.agents where id = p_agent_id;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'Agent introuvable.');
  end if;
  select * into v_equipe_initial from public.equipes where id = p_equipe_id;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'Equipe introuvable.');
  end if;

  v_ancienne_ag := v_agent_initial.agence_id;
  v_nouvelle_ag := v_equipe_initial.agence_id;
  if v_nouvelle_ag is null then
    return jsonb_build_object('ok', false, 'erreur', 'Equipe sans agence.');
  end if;

  v_lock_a := least(
    coalesce(v_ancienne_ag, '00000000-0000-0000-0000-000000000000'::uuid),
    v_nouvelle_ag
  );
  v_lock_b := greatest(
    coalesce(v_ancienne_ag, '00000000-0000-0000-0000-000000000000'::uuid),
    v_nouvelle_ag
  );
  perform pg_advisory_xact_lock(hashtext('percom_modeles:' || v_lock_a::text));
  if v_lock_b is distinct from v_lock_a then
    perform pg_advisory_xact_lock(hashtext('percom_modeles:' || v_lock_b::text));
  end if;

  -- L'agent est verrouille et relu apres les advisory locks.
  select * into v_agent from public.agents where id = p_agent_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'Agent introuvable.');
  end if;
  if v_agent.agence_id is distinct from v_ancienne_ag
     or v_agent.equipe_id is distinct from v_agent_initial.equipe_id then
    return jsonb_build_object(
      'ok', false, 'erreur', 'Le rattachement a change entre-temps. Reessayez.'
    );
  end if;
  if v_agent.role in ('responsable', 'dg', 'admin') then
    raise exception 'Un responsable/DG/admin ne peut pas etre ajoute comme membre d''equipe.';
  end if;

  -- Verrouiller les equipes concernees dans un ordre stable, puis relire la
  -- destination et son agence.
  perform 1
  from public.equipes
  where id in (p_equipe_id, v_agent.equipe_id)
  order by id
  for update;
  select * into v_equipe from public.equipes where id = p_equipe_id;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'Equipe introuvable.');
  end if;
  if v_equipe.agence_id is distinct from v_nouvelle_ag then
    return jsonb_build_object(
      'ok', false, 'erreur', 'L''agence de l''equipe a change. Reessayez.'
    );
  end if;
  if v_agent.equipe_id is not distinct from p_equipe_id then
    return jsonb_build_object('ok', false, 'erreur', 'L''agent appartient deja a cette equipe.');
  end if;

  v_ancienne_eq := v_agent.equipe_id;

  -- Jeton croise avec le trigger : un UPDATE direct de l'agence reste refuse.
  v_mutation_jeton := gen_random_uuid();
  insert into public._mutation_objectifs_jetons(
    jeton, agent_id, source_agence_id, destination_agence_id
  ) values (
    v_mutation_jeton, p_agent_id, v_ancienne_ag, v_nouvelle_ag
  );
  perform set_config(
    'percom.mutation_objectifs_jeton', v_mutation_jeton::text, true
  );

  update public.agents
  set equipe_id = p_equipe_id, agence_id = v_nouvelle_ag
  where id = p_agent_id;

  delete from public._mutation_objectifs_jetons where jeton = v_mutation_jeton;
  perform set_config('percom.mutation_objectifs_jeton', '', true);

  if v_ancienne_ag is distinct from v_nouvelle_ag then
    delete from public.agent_zones az
    where az.agent_id = p_agent_id
      and exists (
        select 1 from public.zones z
        where z.id = az.zone_id
          and z.agence_id is distinct from v_nouvelle_ag
      );
    get diagnostics v_nb_zones_ret = row_count;
  end if;

  if v_ancienne_eq is not null and v_ancienne_eq is distinct from p_equipe_id then
    select chef_id into v_ancien_ref
    from public.equipes where id = v_ancienne_eq;
    if v_ancien_ref is not distinct from p_agent_id then
      select a.id into v_nouveau_ref
      from public.agents a
      where a.equipe_id = v_ancienne_eq
        and a.role = 'chef'
        and a.id <> p_agent_id
      order by a.created_at, a.id
      limit 1;
      update public.equipes
      set chef_id = v_nouveau_ref
      where id = v_ancienne_eq;
    end if;
  end if;

  if v_ancienne_ag is distinct from v_nouvelle_ag then
    update public.objectifs o
    set statut_objectif = 'supprime'
    where o.agent_id = p_agent_id
      and o.origine = 'modele'
      and coalesce(o.statut_objectif, '') = 'actif'
      and v_ancienne_ag is not null
      and o.modele_id in (
        select m.id from public.objectifs_modeles m
        where m.agence_id = v_ancienne_ag
      )
      and (
        (o.type_periodicite = 'journalier' and o.jour_date > current_date)
        or (o.type_periodicite = 'mensuel'
            and make_date(o.annee, o.mois, 1)
                > date_trunc('month', current_date)::date)
        or (o.type_periodicite = 'annuel'
            and o.annee > extract(year from current_date)::int)
      );
    get diagnostics v_nb_clotures = row_count;

    if v_agent.actif is true and coalesce(v_agent.statut, '') = 'actif' then
      v_generation_jeton := public._generation_ouvrir();
      for v_m in
        select * from public.objectifs_modeles
        where agence_id = v_nouvelle_ag and actif is true
        order by type_periodicite, id
      loop
        v_nb_generes := v_nb_generes + public._generer_objectifs_modele(
          v_m, p_agent_id, greatest(v_m.date_debut, current_date), v_jusqua
        );
      end loop;
      perform public._generation_fermer(v_generation_jeton);
    end if;
  end if;

  delete from public.objectifs_attribution_attente where agent_id = p_agent_id;

  perform public._audit_admin(
    'muter_membre_equipe', 'agent', p_agent_id,
    jsonb_build_object(
      'equipe_id', v_ancienne_eq,
      'agence_id', v_ancienne_ag,
      'chef_referent', v_ancien_ref
    ),
    jsonb_build_object(
      'equipe_id', p_equipe_id,
      'agence_id', v_nouvelle_ag,
      'nouveau_chef_referent', v_nouveau_ref,
      'nb_zones_retirees', v_nb_zones_ret,
      'futurs_clotures', v_nb_clotures,
      'objectifs_generes', v_nb_generes
    ),
    null
  );

  return jsonb_build_object(
    'ok', true,
    'agent_id', p_agent_id,
    'equipe_id', p_equipe_id,
    'agence_id', v_nouvelle_ag,
    'nb_zones_retirees', v_nb_zones_ret,
    'futurs_clotures', v_nb_clotures,
    'objectifs_generes', v_nb_generes
  );
exception when others then
  -- Le bloc EXCEPTION annule les ecritures du bloc avant d'entrer ici.
  perform set_config('percom.mutation_objectifs_jeton', '', true);
  perform set_config('percom.generation_jeton', '', true);
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

revoke execute on function public.admin_muter_membre_equipe(uuid, uuid)
  from public, anon;
grant execute on function public.admin_muter_membre_equipe(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. Apercu avant application d'un modele.
-- ---------------------------------------------------------------------
create or replace function public.apercu_application_modele(
  p_modele_id uuid,
  p_jusqua date default null
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_moi public.agents;
  v_m public.objectifs_modeles;
  v_fin date;
  v_debut date;
  v_nb_agents bigint := 0;
  v_nb_periodes bigint := 0;
  v_total bigint := 0;
begin
  v_moi := public._agent_courant();
  if v_moi.id is null or v_moi.role not in ('admin', 'responsable') then
    return jsonb_build_object('ok', false, 'erreur', 'Acces non autorise.');
  end if;
  select * into v_m from public.objectifs_modeles where id = p_modele_id;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'Modele introuvable.');
  end if;
  if v_moi.role = 'responsable'
     and v_m.agence_id is distinct from v_moi.agence_id then
    return jsonb_build_object('ok', false, 'erreur', 'Modele hors de votre agence.');
  end if;

  v_fin := coalesce(
    p_jusqua,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  );
  if v_fin < current_date then
    return jsonb_build_object('ok', false, 'erreur', 'Fin anterieure a aujourd''hui.');
  end if;
  if v_fin > (date_trunc('year', current_date)
              + interval '2 years - 1 day')::date then
    return jsonb_build_object('ok', false, 'erreur', 'Fenetre trop lointaine.');
  end if;

  v_debut := greatest(v_m.date_debut, current_date);
  v_fin := least(coalesce(v_m.date_fin, v_fin), v_fin);
  if v_debut <= v_fin then
    select count(*) into v_nb_periodes
    from public._objectifs_periodes_intervalle(
      v_m.type_periodicite, v_debut, v_fin, v_m.jours_semaine
    );
  end if;
  select count(*) into v_nb_agents
  from public.agents a
  where a.agence_id = v_m.agence_id
    and a.role in ('agent', 'chef')
    and a.actif is true
    and coalesce(a.statut, '') = 'actif';
  v_total := v_nb_agents * v_nb_periodes;

  return jsonb_build_object(
    'ok', true,
    'modele_id', v_m.id,
    'agence_id', v_m.agence_id,
    'periodicite', v_m.type_periodicite,
    'agents', v_nb_agents,
    'periodes', v_nb_periodes,
    'combinaisons', v_total,
    'plafond', 20000,
    'autorise', v_total <= 20000,
    'date_debut_effective', case when v_debut <= v_fin then v_debut end,
    'date_fin_effective', case when v_debut <= v_fin then v_fin end
  );
exception when others then
  return jsonb_build_object('ok', false, 'erreur', SQLERRM);
end;
$function$;

revoke execute on function public.apercu_application_modele(uuid, date)
  from public, anon;
grant execute on function public.apercu_application_modele(uuid, date)
  to authenticated;

-- ---------------------------------------------------------------------
-- 5. Renouvellement et reprise. Appel reserve au service_role.
-- ---------------------------------------------------------------------
create or replace function public.generer_objectifs_modeles_echeance(
  p_reference date default current_date
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_claim_role text;
  v_agence record;
  v_m public.objectifs_modeles;
  v_agent record;
  v_jeton uuid;
  v_jusqua date;
  v_nb_periodes bigint;
  v_nb_agents bigint;
  v_volume bigint;
  v_total_crees integer := 0;
  v_agence_crees integer := 0;
  v_total_agents integer := 0;
  v_total_agences integer := 0;
  v_agences_ignorees integer := 0;
  v_erreurs jsonb := '[]'::jsonb;
begin
  v_claim_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if v_claim_role = '' then
    begin
      v_agence_crees := 0;
      v_claim_role := coalesce(
        current_setting('request.jwt.claims', true)::jsonb->>'role', ''
      );
    exception when others then
      v_claim_role := '';
    end;
  end if;
  if v_claim_role <> 'service_role' then
    return jsonb_build_object(
      'ok', false, 'erreur', 'Execution reservee au service_role.'
    );
  end if;
  if p_reference is null then
    return jsonb_build_object('ok', false, 'erreur', 'Date de reference requise.');
  end if;

  -- Hygiene : les jetons normaux sont supprimes par leurs fonctions. Cette
  -- purge traite uniquement les residus d'une ancienne session interrompue.
  delete from public._generation_jetons
  where cree_at < now() - interval '30 minutes';
  delete from public._mutation_objectifs_jetons
  where cree_at < now() - interval '30 minutes';

  for v_agence in
    select distinct m.agence_id
    from public.objectifs_modeles m
    where m.actif is true
    order by m.agence_id
  loop
    -- Ne pas bloquer les mutations interactives : l'agence sera reprise au
    -- prochain passage si elle est occupee.
    if not pg_try_advisory_xact_lock(
      hashtext('percom_modeles:' || v_agence.agence_id::text)
    ) then
      v_agences_ignorees := v_agences_ignorees + 1;
      continue;
    end if;

    begin
      select count(*) into v_nb_agents
      from public.agents a
      where a.agence_id = v_agence.agence_id
        and a.role in ('agent', 'chef')
        and a.actif is true
        and coalesce(a.statut, '') = 'actif';

      v_volume := 0;
      for v_m in
        select * from public.objectifs_modeles
        where agence_id = v_agence.agence_id and actif is true
        order by type_periodicite, id
      loop
        v_jusqua := case v_m.type_periodicite
          when 'journalier' then
            (date_trunc('month', p_reference) + interval '2 months - 1 day')::date
          when 'mensuel' then
            (date_trunc('month', p_reference) + interval '2 months - 1 day')::date
          when 'annuel' then
            (date_trunc('year', p_reference) + interval '2 years - 1 day')::date
        end;
        v_nb_periodes := 0;
        if greatest(v_m.date_debut, p_reference)
           <= least(coalesce(v_m.date_fin, v_jusqua), v_jusqua) then
          select count(*) into v_nb_periodes
          from public._objectifs_periodes_intervalle(
            v_m.type_periodicite,
            greatest(v_m.date_debut, p_reference),
            least(coalesce(v_m.date_fin, v_jusqua), v_jusqua),
            v_m.jours_semaine
          );
        end if;
        v_volume := v_volume + (v_nb_agents * v_nb_periodes);
      end loop;
      if v_volume > 20000 then
        raise exception 'Volume agence excessif: % combinaisons (max 20000).', v_volume;
      end if;

      v_jeton := public._generation_ouvrir();
      for v_m in
        select * from public.objectifs_modeles
        where agence_id = v_agence.agence_id and actif is true
        order by type_periodicite, id
      loop
        v_jusqua := case v_m.type_periodicite
          when 'journalier' then
            (date_trunc('month', p_reference) + interval '2 months - 1 day')::date
          when 'mensuel' then
            (date_trunc('month', p_reference) + interval '2 months - 1 day')::date
          when 'annuel' then
            (date_trunc('year', p_reference) + interval '2 years - 1 day')::date
        end;
        for v_agent in
          select a.id
          from public.agents a
          where a.agence_id = v_agence.agence_id
            and a.role in ('agent', 'chef')
            and a.actif is true
            and coalesce(a.statut, '') = 'actif'
          order by a.id
        loop
          v_agence_crees := v_agence_crees + public._generer_objectifs_modele(
            v_m,
            v_agent.id,
            greatest(v_m.date_debut, p_reference),
            v_jusqua
          );
        end loop;
      end loop;
      perform public._generation_fermer(v_jeton);

      delete from public.objectifs_attribution_attente q
      using public.agents a
      where q.agent_id = a.id
        and a.agence_id = v_agence.agence_id
        and a.role in ('agent', 'chef')
        and a.actif is true
        and coalesce(a.statut, '') = 'actif';

      v_total_agents := v_total_agents + v_nb_agents::integer;
      v_total_crees := v_total_crees + v_agence_crees;
      v_total_agences := v_total_agences + 1;
    exception when others then
      -- Le sous-bloc annule uniquement cette agence ; les autres continuent.
      v_erreurs := v_erreurs || jsonb_build_array(jsonb_build_object(
        'agence_id', v_agence.agence_id,
        'erreur', SQLERRM
      ));
    end;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_erreurs) = 0,
    'reference', p_reference,
    'agences_traitees', v_total_agences,
    'agences_occupees', v_agences_ignorees,
    'agents_parcourus', v_total_agents,
    'objectifs_crees', v_total_crees,
    'erreurs', v_erreurs
  );
end;
$function$;

revoke execute on function public.generer_objectifs_modeles_echeance(date)
  from public, anon, authenticated;
grant execute on function public.generer_objectifs_modeles_echeance(date)
  to service_role;

-- =====================================================================
-- Fin Lots 16.3c + 16.4.
-- =====================================================================
