-- =====================================================================
-- PERCOM — Lot 16.2b : protection des colonnes de provenance des objectifs
-- Ordre de migration Lot 16 : 2/5.
-- Base : PERCOM (kuussvvtjjajvasfksnj). 30 septembre 2026.
--
-- Point 2 de la revue Codex du Lot 16.2 : origine/modele_id/modele_version
-- sont protégeables par le CHECK (valeurs), mais RIEN n'empêche un utilisateur
-- autorisé à éditer un objectif de CHANGER ces colonnes (ex. faire passer un
-- objectif personnalisé pour un objectif 'modele').
--
-- CHOIX D'IMPLÉMENTATION : plutôt que réémettre le long trigger Lot 15 (risque
-- d'écart sur 200 lignes déjà validées), on ajoute un trigger BEFORE UPDATE
-- DÉDIÉ à la provenance. Nommé 'trg_objectifs_provenance' → s'exécute APRÈS
-- 'trg_objectifs_guard_mutation' (ordre alphabétique des triggers BEFORE de même
-- niveau : guard < provenance). Il voit donc NEW déjà normalisé par la garde.
--
-- RÈGLES (à jour) :
--   - INSERT utilisateur : provenance FORCÉE à 'manuel' (modele_id/version NULL).
--     Seuls service_role et le canal interne de génération (flag) posent 'modele'.
--   - UPDATE : modele_id / modele_version NE SONT JAMAIS modifiables à la main,
--     ni par un non-admin NI par l'admin (ce sont des références de génération).
--   - TRANSITION AUTO modele→personnalise : dès qu'une édition MÉTIER est détectée
--     (libellés, cible principale, période canonique, TOUTES les mesures dont
--     cible_montant legacy) sur un objectif origine='modele', on bascule
--     origine='personnalise'. S'applique à TOUS, ADMIN INCLUS (pas d'exception
--     admin — sinon un objectif modèle édité par l'admin resterait 'modele' et
--     serait annulé comme non-personnalisé lors d'une mutation). modele_id/version
--     conservés pour la traçabilité.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Canal de génération SÉCURISÉ par JETON (revue Codex point 3).
-- Un GUC custom n'est pas réservé au propriétaire → le flag simple ne prouve
-- rien. On croise le GUC avec une table de jetons que SEULES les fonctions owner
-- peuvent écrire (revoke total + pas de policy d'écriture). La RPC de génération
-- (Lot 16.3) : insère un jeton aléatoire, le pose dans le GUC, génère, puis
-- supprime le jeton (restauration garantie même sur erreur via bloc exception).
-- Le trigger n'accepte 'modele' que si le GUC correspond à un jeton PRÉSENT.
-- Un client peut poser un GUC arbitraire mais NE PEUT PAS insérer un jeton
-- correspondant dans cette table protégée.
-- ---------------------------------------------------------------------
create table if not exists public._generation_jetons (
  jeton      uuid primary key,
  cree_at    timestamptz not null default now()
);
alter table public._generation_jetons enable row level security;
-- Aucune policy → aucun accès direct pour authenticated/anon ; seules les
-- fonctions SECURITY DEFINER (owner) lisent/écrivent en contournant la RLS.
revoke all on public._generation_jetons from public, anon, authenticated;

create or replace function public._objectifs_protege_provenance()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_is_service boolean := false;
  v_claims_role text;
  v_moi public.agents;
  v_cibles_changees boolean;
begin
  -- Contexte service_role (génération par modèle) : SEUL chemin autorisé à poser
  -- une provenance 'modele' + modele_id + modele_version, en INSERT comme UPDATE.
  if coalesce(current_setting('request.jwt.claim.role', true),'') = 'service_role' then
    v_is_service := true;
  else
    begin v_claims_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
    exception when others then v_claims_role := null; end;
    if coalesce(v_claims_role,'') = 'service_role' then v_is_service := true; end if;
  end if;
  if v_is_service then
    return NEW;   -- génération par modèle via cron/service : provenance libre.
  end if;

  -- Canal interne de génération, VÉRIFIÉ PAR JETON (revue Codex point 3).
  -- Le GUC porte un jeton ; on n'accepte 'modele' QUE si ce jeton existe dans la
  -- table protégée _generation_jetons (écrite uniquement par les RPC owner). Un
  -- client peut poser un GUC arbitraire mais ne peut pas y faire correspondre un
  -- jeton réel → il ne peut pas se faire passer pour une génération légitime.
  declare v_jeton text; v_ok boolean;
  begin
    v_jeton := current_setting('percom.generation_jeton', true);
    if v_jeton is not null and length(v_jeton) > 0 then
      begin
        select exists(select 1 from public._generation_jetons where jeton = v_jeton::uuid)
          into v_ok;
      exception when others then
        v_ok := false;   -- jeton non-uuid → invalide
      end;
      if coalesce(v_ok,false) then
        return NEW;   -- génération légitime prouvée par jeton : 'modele' autorisé.
      end if;
    end if;
  end;

  -- =============================================================
  -- INSERT (point 2) : une création UTILISATEUR est toujours 'manuel'.
  -- Interdit de revendiquer une provenance modèle à la création.
  -- =============================================================
  if TG_OP = 'INSERT' then
    NEW.origine        := 'manuel';
    NEW.modele_id      := null;
    NEW.modele_version := null;
    return NEW;
  end if;

  -- =============================================================
  -- UPDATE : gel de la provenance + transition auto modele→personnalise.
  -- =============================================================
  v_moi := public._agent_courant();

  -- Détecte une édition MÉTIER — commune admin et non-admin (point 2).
  -- Couvre : libellés, TOUTES les mesures chiffrées, cible_montant (legacy SMART),
  -- la CIBLE PRINCIPALE (agent/equipe/agence — reclassement admin) et la PÉRIODE
  -- canonique (périodicité + jour_date/mois/annee). On n'inclut PAS les ids
  -- secondaires dérivés automatiquement (ils changent sans intention métier).
  v_cibles_changees := (
       OLD.titre is distinct from NEW.titre
    or OLD.description is distinct from NEW.description
    -- cible principale selon le type (reclassement). On NE compare QUE l'id
    -- PRINCIPAL du type — pas les ids secondaires (equipe_id/agence_id pour un
    -- objectif agent) qui sont REDÉRIVÉS automatiquement par la garde Lot 15 et
    -- changent sans personnalisation réelle (point 2 revue Codex).
    or OLD.type_cible is distinct from NEW.type_cible
    or (NEW.type_cible = 'agent'  and OLD.agent_id  is distinct from NEW.agent_id)
    or (NEW.type_cible = 'equipe' and OLD.equipe_id is distinct from NEW.equipe_id)
    or (NEW.type_cible = 'agence' and OLD.agence_id is distinct from NEW.agence_id)
    -- 'global' : aucun id principal à comparer.
    -- période canonique
    or OLD.type_periodicite is distinct from NEW.type_periodicite
    or OLD.jour_date is distinct from NEW.jour_date
    or OLD.mois  is distinct from NEW.mois
    or OLD.annee is distinct from NEW.annee
    -- mesures (dont cible_montant legacy)
    or OLD.cible_montant is distinct from NEW.cible_montant
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
    or OLD.cible_assurances_montant is distinct from NEW.cible_assurances_montant
  );

  -- modele_id / modele_version JAMAIS modifiables à la main (ni admin ni RA) :
  -- ce sont des références de génération. On remet toujours les valeurs OLD.
  NEW.modele_id      := OLD.modele_id;
  NEW.modele_version := OLD.modele_version;

  -- Transition auto modele→personnalise : s'applique à TOUS (point 3 — l'admin
  -- aussi, sinon un objectif modèle édité par l'admin resterait 'modele' et
  -- serait annulé comme non-personnalisé à la mutation).
  if OLD.origine = 'modele' and v_cibles_changees then
    NEW.origine := 'personnalise';
  else
    -- origine JAMAIS modifiable directement (aucune exception, admin compris) :
    -- on la fige sur OLD. La seule transition possible est modele→personnalise
    -- ci-dessus, déclenchée par une édition métier réelle.
    NEW.origine := OLD.origine;
  end if;

  return NEW;
end;
$function$;

-- Nommé 'provenance' > 'guard' → s'exécute après la garde principale.
-- INSERT OR UPDATE (point 2 : couvre la création).
drop trigger if exists trg_objectifs_provenance on public.objectifs;
create trigger trg_objectifs_provenance
  before insert or update on public.objectifs
  for each row execute function public._objectifs_protege_provenance();

-- =====================================================================
-- Fin Lot 16.2b. À exécuter APRÈS 16.2 (colonnes provenance) et le Lot 15
-- (garde principale). Ordre des triggers BEFORE UPDATE sur objectifs :
--   trg_objectifs_guard_mutation (normalisation/unicité/gel) PUIS
--   trg_objectifs_provenance (gel provenance + transition modele→personnalise).
-- =====================================================================
