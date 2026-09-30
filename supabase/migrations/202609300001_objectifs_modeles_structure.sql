-- =====================================================================
-- PERCOM — Lot 16.2 : structure des modèles d'objectifs d'agence + traçabilité
-- Ordre de migration Lot 16 : 1/5.
-- Base : PERCOM (kuussvvtjjajvasfksnj). 30 septembre 2026.
--
-- Fondations (DDL) de la Partie 2 :
--   (A) Colonnes de traçabilité d'origine sur objectifs :
--       origine ('manuel'|'modele'|'personnalise'), modele_id, modele_version.
--   (B) Table objectifs_modeles : gabarit par agence + périodicité (PAS un
--       objectif ; ne s'additionne jamais aux objectifs des collaborateurs).
--   (C) Table objectifs_modeles_application : trace idempotente de ce qui a été
--       généré (modèle × agent × période) pour éviter les doublons et permettre
--       le rattrapage.
--
-- À EXÉCUTER AVANT le Lot 16.1 (qui insère origine='manuel') et avant 16.3/16.4.
--
-- ⚠️ DÉPLOIEMENT (revue Codex) : `create table if not exists` N'AJOUTE PAS les
-- colonnes/contraintes à une table déjà existante. Si une version ANTÉRIEURE de
-- ce fichier a déjà créé objectifs_modeles / _application avec un schéma
-- différent, il faut une migration corrective explicite (alter table add
-- column/constraint). À la première exécution sur une base sans ces tables
-- (cas actuel : aucune version 16.x exécutée), ce fichier est complet et suffit.
--
-- RÈGLES (revue Codex) :
--   - Agence d'un modèle IMMUABLE (un modèle ne change pas d'agence ; on en crée
--     un nouveau). Trigger l'empêche.
--   - Pas de DELETE dur d'un modèle : on le passe à actif=false (historique
--     conservé pour la traçabilité modele_id).
--   - Pas de DEUX modèles ACTIFS concurrents pour la même (agence, périodicité)
--     — index unique partiel.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (A) Traçabilité d'origine sur objectifs.
-- ---------------------------------------------------------------------
alter table public.objectifs
  add column if not exists origine text not null default 'manuel',
  add column if not exists modele_id uuid,
  add column if not exists modele_version int;

-- FK vers le modèle source (point 4). ON DELETE RESTRICT n'est pas nécessaire
-- car la suppression physique des modèles est interdite (trigger), mais on
-- pose la FK pour l'intégrité référentielle. La colonne créée plus haut ; la FK
-- est ajoutée après la création de la table objectifs_modeles (voir plus bas).

-- Valeurs d'origine contraintes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='objectifs_origine_check') then
    alter table public.objectifs
      add constraint objectifs_origine_check
      check (origine in ('manuel','modele','personnalise'));
  end if;
end$$;

comment on column public.objectifs.origine is
  'Provenance : manuel (créé à la main), modele (généré par un modèle d''agence), '
  'personnalise (issu d''un modèle puis édité — jamais réécrasé par le modèle).';
comment on column public.objectifs.modele_id is
  'Modèle source (si origine modele/personnalise). Conservé même après perso, pour traçabilité.';
comment on column public.objectifs.modele_version is
  'Version du modèle au moment de la génération.';


-- ---------------------------------------------------------------------
-- (B) Table des modèles d'agence.
-- ---------------------------------------------------------------------
create table if not exists public.objectifs_modeles (
  id             uuid primary key default gen_random_uuid(),
  agence_id      uuid not null references public.agences(id),
  type_periodicite text not null,
  -- jours de semaine (journalier) : ISO 1..7 ; NULL = tous ; jamais vide (CHECK).
  jours_semaine  int[],
  titre          text not null,
  description    text,
  -- 15 mesures ; NULL = mesure non suivie par ce modèle (absent ≠ zéro).
  cible_montant_smart        numeric,
  cible_montant_caisse       numeric,
  cible_commissions          numeric,
  cible_comptes_dat          integer,
  cible_adhesions            integer,
  cible_lyde_cash            integer,
  cible_depot_dat            numeric,
  cible_depot_dav            numeric,
  cible_depot_pe             numeric,
  cible_reactivations_nb     integer,
  cible_reactivations_montant numeric,
  cible_augmentations_nb     integer,
  cible_augmentations_montant numeric,
  cible_assurances_nb        integer,
  cible_assurances_montant   numeric,
  -- dates d'application (bornes du modèle ; NULL fin = renouvellement continu).
  date_debut     date not null,
  date_fin       date,
  -- versionnement : incrémenté à chaque modification des cibles/dates.
  version        int not null default 1,
  actif          boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  -- contraintes de convention
  constraint objectifs_modeles_periodicite_check
    check (type_periodicite in ('journalier','mensuel','annuel')),
  -- jours_semaine : NULL ok ; sinon non vide, valeurs 1..7, pas de NULL.
  -- (Pas de sous-requête dans un CHECK : on utilise l'opérateur <@ « contenu
  -- dans » array[1..7] ; array_position(...,null) est autorisé.)
  constraint objectifs_modeles_jours_check
    check (
      jours_semaine is null
      or ( cardinality(jours_semaine) > 0          -- refuse le tableau vide (array_length renvoie NULL)
           and array_position(jours_semaine, null) is null
           and jours_semaine <@ array[1,2,3,4,5,6,7] )
    ),
  -- jours_semaine seulement pertinent pour journalier
  constraint objectifs_modeles_jours_journalier_check
    check (type_periodicite = 'journalier' or jours_semaine is null),
  constraint objectifs_modeles_dates_check
    check (date_fin is null or date_fin >= date_debut)
);

-- Un seul modèle ACTIF par (agence, périodicité).
create unique index if not exists uniq_objectifs_modeles_actif
  on public.objectifs_modeles (agence_id, type_periodicite)
  where actif is true;

-- Index de recherche.
create index if not exists idx_objectifs_modeles_agence
  on public.objectifs_modeles (agence_id, type_periodicite, actif);

comment on table public.objectifs_modeles is
  'Gabarit d''objectifs INDIVIDUELS par agence et périodicité. Génère des '
  'objectifs type_cible=agent pour les collaborateurs. N''est PAS un objectif '
  'collectif et ne s''additionne jamais aux objectifs des collaborateurs.';

-- FK objectifs.modele_id → objectifs_modeles(id) (point 4). RESTRICT : un modèle
-- référencé ne peut pas être supprimé physiquement (cohérent avec l'interdiction
-- de DELETE ; en pratique on désactive un modèle, on ne le supprime pas).
do $$
begin
  if not exists (select 1 from pg_constraint where conname='objectifs_modele_id_fkey') then
    alter table public.objectifs
      add constraint objectifs_modele_id_fkey
      foreign key (modele_id) references public.objectifs_modeles(id) on delete restrict;
  end if;
end$$;


-- ---------------------------------------------------------------------
-- (C) Trace d'application (idempotence + rattrapage).
--     Une ligne par (modèle, agent, période exacte) réellement générée.
--     Permet : anti-doublon de génération, savoir jusoù le renouvellement est
--     allé, et ne pas recréer sur une période déjà couverte.
-- ---------------------------------------------------------------------
create table if not exists public.objectifs_modeles_application (
  id           uuid primary key default gen_random_uuid(),
  modele_id    uuid not null references public.objectifs_modeles(id) on delete restrict,
  agent_id     uuid not null references public.agents(id) on delete cascade,
  -- périodicité explicite (représentation canonique, point 5).
  type_periodicite text not null,
  -- période exacte couverte, cohérente avec la périodicité (CHECK).
  jour_date    date,
  mois         int,
  annee        int,
  -- objectif généré ; ON DELETE SET NULL réalise réellement le "mis à NULL"
  -- annoncé quand l'objectif est supprimé (point 4).
  objectif_id  uuid references public.objectifs(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint modeles_app_periodicite_check
    check (type_periodicite in ('journalier','mensuel','annuel')),
  -- REPRÉSENTATION CANONIQUE (point 5) : selon la périodicité, seules les bonnes
  -- colonnes sont renseignées, les autres NULL. Empêche les périodes incohérentes.
  constraint modeles_app_periode_canonique_check
    check (
      -- journalier : jour_date présent, ET mois/annee DÉRIVÉS de jour_date
      -- (empêche jour_date=2026-10-05 avec mois=11 — point 4).
      (type_periodicite='journalier'
        and jour_date is not null
        and mois  is not null and annee is not null       -- explicite : un CHECK
        and mois  = extract(month from jour_date)::int    -- NULL "passe" en Postgres,
        and annee = extract(year  from jour_date)::int)   -- d'où ces is not null.
      or (type_periodicite='mensuel'  and jour_date is null and mois is not null and annee is not null)
      or (type_periodicite='annuel'   and jour_date is null and mois is null and annee is not null)
    ),
  constraint modeles_app_mois_check check (mois is null or (mois between 1 and 12))
  -- NB : la cohérence "périodicité de l'application = périodicité du modèle référencé"
  -- ne peut pas être un CHECK (sous-requête interdite) → imposée par la RPC de
  -- génération (Lot 16.3) qui lit toujours la périodicité depuis le modèle.
);

-- Idempotence : une seule application par (modèle, agent, périodicité, période).
-- La représentation canonique (CHECK ci-dessus) garantit que les colonnes de
-- période non pertinentes sont NULL → pas de coexistence même-jour/mois-différent.
create unique index if not exists uniq_modeles_application
  on public.objectifs_modeles_application (
    modele_id, agent_id, type_periodicite,
    coalesce(jour_date, '0001-01-01'::date),
    coalesce(mois, 0),
    coalesce(annee, 0)
  );

comment on table public.objectifs_modeles_application is
  'Trace idempotente : (modèle, agent, période) déjà générés. Sert à éviter les '
  'doublons et à permettre le rattrapage d''un renouvellement manqué.';


-- ---------------------------------------------------------------------
-- (D) Trigger : agence d'un modèle IMMUABLE + updated_at + version.
-- ---------------------------------------------------------------------
-- Historique des versions (point 5) : archive le contenu AVANT chaque
-- modification des valeurs surveillées → on peut retrouver ce que la version N
-- contenait (utile pour un objectif généré par une ancienne version).
create table if not exists public.objectifs_modeles_versions (
  id           uuid primary key default gen_random_uuid(),
  modele_id    uuid not null references public.objectifs_modeles(id) on delete restrict,
  version      int not null,
  contenu      jsonb not null,          -- snapshot complet de la ligne à cette version
  archive_at   timestamptz not null default now(),
  archive_by   uuid
);
create index if not exists idx_modeles_versions on public.objectifs_modeles_versions(modele_id, version);
alter table public.objectifs_modeles_versions enable row level security;
drop policy if exists objectifs_modeles_versions_select on public.objectifs_modeles_versions;
create policy objectifs_modeles_versions_select on public.objectifs_modeles_versions
  for select to authenticated
  using (
    public._est_admin_actif()
    or (public._agent_courant()).role = 'dg'
    or ( (public._agent_courant()).role = 'responsable'
         and exists (
           select 1 from public.objectifs_modeles m
           where m.id = objectifs_modeles_versions.modele_id
             and m.agence_id = (public._agent_courant()).agence_id
         ) )
  );
revoke all on public.objectifs_modeles_versions from public, anon;
grant select on public.objectifs_modeles_versions to authenticated;

create or replace function public._objectifs_modeles_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_change boolean;
begin
  -- Point 4 : suppression physique INTERDITE (historique/traçabilité). On
  -- désactive un modèle (actif=false), on ne le supprime pas.
  if TG_OP = 'DELETE' then
    raise exception 'Modèle: suppression physique interdite (désactiver via actif=false).';
  end if;

  if TG_OP = 'UPDATE' then
    -- agence + périodicité immuables.
    if OLD.agence_id is distinct from NEW.agence_id then
      raise exception 'Modèle: l''agence d''un modèle ne peut pas être modifiée (créer un nouveau modèle).';
    end if;
    if OLD.type_periodicite is distinct from NEW.type_periodicite then
      raise exception 'Modèle: la périodicité d''un modèle ne peut pas être modifiée.';
    end if;

    -- Y a-t-il un changement des valeurs SURVEILLÉES (cibles/dates/jours) ?
    v_change := (OLD.jours_semaine is distinct from NEW.jours_semaine
        or OLD.date_debut is distinct from NEW.date_debut
        or OLD.date_fin  is distinct from NEW.date_fin
        or OLD.cible_montant_smart is distinct from NEW.cible_montant_smart
        or OLD.cible_montant_caisse is distinct from NEW.cible_montant_caisse
        or OLD.cible_commissions is distinct from NEW.cible_commissions
        or OLD.cible_comptes_dat is distinct from NEW.cible_comptes_dat
        or OLD.cible_adhesions is distinct from NEW.cible_adhesions
        or OLD.cible_lyde_cash is distinct from NEW.cible_lyde_cash
        or OLD.cible_depot_dat is distinct from NEW.cible_depot_dat
        or OLD.cible_depot_dav is distinct from NEW.cible_depot_dav
        or OLD.cible_depot_pe is distinct from NEW.cible_depot_pe
        or OLD.cible_reactivations_nb is distinct from NEW.cible_reactivations_nb
        or OLD.cible_reactivations_montant is distinct from NEW.cible_reactivations_montant
        or OLD.cible_augmentations_nb is distinct from NEW.cible_augmentations_nb
        or OLD.cible_augmentations_montant is distinct from NEW.cible_augmentations_montant
        or OLD.cible_assurances_nb is distinct from NEW.cible_assurances_nb
        or OLD.cible_assurances_montant is distinct from NEW.cible_assurances_montant);

    -- Point 5 : version imposée = OLD.version (pas de changement surveillé)
    -- OU OLD.version+1 (changement surveillé). Toute autre valeur refusée.
    if v_change then
      if NEW.version is distinct from OLD.version + 1 then
        NEW.version := OLD.version + 1;   -- on force la bonne valeur
      end if;
      -- archive l'ANCIEN contenu (la version OLD) avant écrasement.
      insert into public.objectifs_modeles_versions(modele_id, version, contenu)
      values (OLD.id, OLD.version, to_jsonb(OLD));
    else
      if NEW.version is distinct from OLD.version then
        NEW.version := OLD.version;       -- pas de changement surveillé → version figée
      end if;
    end if;

    NEW.updated_at := now();
  end if;
  return NEW;
end;
$function$;

-- BEFORE UPDATE OR DELETE : couvre le refus de suppression physique.
drop trigger if exists trg_objectifs_modeles_guard on public.objectifs_modeles;
create trigger trg_objectifs_modeles_guard
  before update or delete on public.objectifs_modeles
  for each row execute function public._objectifs_modeles_guard();


-- ---------------------------------------------------------------------
-- (E) RLS : lecture/écriture des modèles réservée. La logique fine de droits
--     (RA = son agence, admin = toutes, DG = NON) est portée par les RPC de
--     gestion (Lot 16.3). Ici on pose une RLS de base : lecture admin/RA/DG,
--     écriture bloquée en direct (seules les RPC SECURITY DEFINER écrivent).
-- ---------------------------------------------------------------------
alter table public.objectifs_modeles enable row level security;
alter table public.objectifs_modeles_application enable row level security;

-- Point 1 : RA limité à SON agence ; admin ACTIF (pas est_admin() sans contrôle
-- d'activité) ; dg en lecture globale (visibilité direction, sans écriture).
drop policy if exists objectifs_modeles_select on public.objectifs_modeles;
create policy objectifs_modeles_select on public.objectifs_modeles
  for select to authenticated
  using (
    public._est_admin_actif()
    or (public._agent_courant()).role = 'dg'
    or ( (public._agent_courant()).role = 'responsable'
         and agence_id = (public._agent_courant()).agence_id )
  );
-- (aucune policy insert/update/delete : écriture via RPC owner uniquement.)

-- Applications : RA limité aux modèles de SON agence (via l'agence du modèle).
drop policy if exists objectifs_modeles_app_select on public.objectifs_modeles_application;
create policy objectifs_modeles_app_select on public.objectifs_modeles_application
  for select to authenticated
  using (
    public._est_admin_actif()
    or (public._agent_courant()).role = 'dg'
    or ( (public._agent_courant()).role = 'responsable'
         and exists (
           select 1 from public.objectifs_modeles m
           where m.id = objectifs_modeles_application.modele_id
             and m.agence_id = (public._agent_courant()).agence_id
         ) )
  );

revoke all on public.objectifs_modeles from public, anon;
revoke all on public.objectifs_modeles_application from public, anon;
grant select on public.objectifs_modeles to authenticated;
grant select on public.objectifs_modeles_application to authenticated;

-- =====================================================================
-- Fin Lot 16.2. Structure prête. Suite : 16.1 (multi-périodes, dépend de
-- origine), 16.3 (RPC gestion modèles + génération + trigger agents + mutation),
-- 16.4 (renouvellement + contrat Codex).
-- =====================================================================
