# PERCOM — Addendum Codex : Objectifs par période exacte (Lots 14 + 15)

> Document de référence unique pour le raccordement FRONT du nouveau modèle
> d'objectifs « période exacte ». Backend entièrement DÉPLOYÉ en base
> (PERCOM = kuussvvtjjajvasfksnj) et validé en revue. 29 septembre 2026.
>
> **Remplace le modèle de lecture du Lot 13.2** (`rapport_objectifs_consolide`,
> chevauchement/cumul) qui est **ABANDONNÉ** : retirer son branchement front,
> ne pas s'en servir en repli.

---

## 1. Modèle

**Une période exacte = un objectif exact = un taux.** Pas de chevauchement, pas
de cumul, pas de repli, pas de proratisation.
- 3 niveaux indépendants : **agent**, **agence**, **global** (société).
- 3 périodicités : **journalier**, **mensuel**, **annuel**.
- Rapports : collaborateur (agent + chef collecteur), agence, société.

## 2. Convention de stockage (garantie par le trigger)

| Périodicité | Champs déterminants | Autres |
|---|---|---|
| journalier | `jour_date` (le jour visé) | mois/annee dérivés de jour_date |
| mensuel | `mois` + `annee` | `jour_date` = NULL |
| annuel | `annee` | `mois` = 1 (convention, NOT NULL) ; `jour_date` = NULL |

- **Société = `type_cible='global'`** (PAS `'reseau'`). Le trigger accepte
  `'reseau'` en entrée et le normalise en `'global'`, mais le front DOIT envoyer
  `'global'`.
- `type_cible` ∈ (agent, equipe, agence, global). `type_periodicite` géré ∈
  (journalier, mensuel, annuel) ; hebdo/trimestriel/permanent REFUSÉS en création
  ou changement (invisibles dans les rapports).
- **15 mesures** (cible_montant legacy retirée ; SMART absorbe le fallback).

## 3. Trigger `_objectifs_guard_mutation` (BEFORE INSERT/UPDATE/DELETE)

Point de contrôle unique de toutes les écritures. Ce qu'il impose :
- **Rôles** : RA = agent/équipe de son agence ; DG = agence/global ; admin = tout ;
  chef = agent/équipe de son équipe ; agent = rien. service_role exempté des
  RÔLES seulement.
- **Convention** (§2) : normalisation + exigences (journalier→jour_date requis, etc.).
  S'applique AUSSI en service_role.
- **Unicité** : refus (`unique_violation`) si un objectif de même
  `type_cible + cible + type_periodicite + période exacte` existe déjà (statut
  ≠ 'supprime', donc 'expire' réserve la clé). Inclut l'équipe.
- **Gel en UPDATE** (non-admin) : cible ET période figées (supprimer + recréer
  pour changer). L'admin peut reclasser SAUF vers une périodicité non gérée.
- **Clôture** (statut → supprime/expire, cible+période inchangées) : assouplit la
  convention (permet de clôturer un ancien objectif non conforme) mais garde le
  gel et l'unicité.
- **NULL vs 0** : jamais transformé.

⚠️ **Maintenance directe en base** : l'éditeur SQL Supabase tourne sans JWT →
le trigger bloque toute écriture (« contexte non autorisé »). Pour une opération
de maintenance en masse, encadrer par, EN UNE TRANSACTION :
`alter table objectifs disable trigger trg_objectifs_guard_mutation; … ; enable trigger …`.
Les index uniques restent actifs et protègent quand même contre les doublons.

## 4. Filet d'unicité en concurrence (index uniques)

3 index partiels (statut ≠ 'supprime') sur cible canonique
`coalesce(agent_id, equipe_id, agence_id, sentinelle société)` :
`uniq_objectifs_journalier` (…, jour_date), `uniq_objectifs_mensuel`
(…, annee, mois), `uniq_objectifs_annuel` (…, annee). Deux créations
simultanées de même clé : une seule passe, l'autre reçoit `unique_violation`.

Deux limites à garder en tête :
- **journaliers sans `jour_date`** : exclus de l'index journalier (`WHERE
  jour_date IS NOT NULL`) — ils ne sont pas protégés par le filet tant qu'ils ne
  sont pas régularisés (au 29/09, aucun ne subsiste : tous requalifiés mensuel).
- **`IF NOT EXISTS`** ne vérifie que le NOM, pas la définition. Une vérification
  en base doit contrôler la définition et la validité (`pg_indexes` /
  `pg_index.indisvalid`), pas seulement l'existence du nom.

## 5. RPC LECTURE — `rapport_objectifs_periode`

```sql
rapport_objectifs_periode(
  p_mesure text, p_niveau text, p_periodicite text, p_date_reference date,
  p_agence_id uuid default null, p_statuts text[] default array['validee'],
  p_comptes text default 'tous'
) returns jsonb
```
- `p_niveau` : agent | agence | global. `p_periodicite` : journalier | mensuel | annuel.
- `p_mesure` : une des 15 mesures. `p_date_reference` : une date DANS la période
  (le serveur calcule les bornes calendaires).
- `p_agence_id` : null = réseau complet (DG/admin) ; RA forcé sur son agence ;
  global exige null. `p_comptes` : actif/inactif/tous, **forcé 'tous' pour
  agence/global**.
- Accès : admin/dg = 3 rapports ; RA = agent/agence de son agence, jamais société.

**Retour** : `{ ok, meta, lignes, total }`.
- `meta` : contrat_version=2, niveau, periodicite, mesure, libelle_mesure,
  date_debut, date_fin, **date_arrete** (null si période future), statuts,
  comptes, agence_id, agence_nom, **objectifs_incomplets**, smart.
- `lignes[]` — **l'identifiant de ligne DIFFÈRE selon le niveau** (le front doit
  le respecter) :
  - niveau **agent** : `id` (= agent_id), `agence_id`, `agence_nom`, `agent_nom`.
  - niveau **agence/global** : `agence_id` (PAS de champ `id`), `agence_nom`
    (« Société » pour global, « (Sans agence) » pour les orphelins).
  Champs communs : n, **objectif** (nombre|null), **objectif_statut**
  (`defini`|`absent`|`conflit`), realise, taux (null si absent/conflit/0), ecart.
  **SMART + niveau agent uniquement** ajoute : ecart_caisse_manquant,
  ecart_caisse_surplus, regularise, manquant_restant, surplus_restant,
  dernier_commentaire, dernier_commentaire_date, dernier_commentaire_fiche_id.
- `total` : **objectif = somme des objectifs CONNUS**, sans jamais être forcé à
  null quand certaines lignes sont connues. Cas précis :
  - au moins une ligne absent/conflit (`objectifs_incomplets=true`) → `taux` et
    `ecart` = null, mais `objectif` garde la somme des cibles connues ;
  - **AUCUN objectif connu** (toutes lignes absent/conflit) → `objectif` = null
    (la somme d'un ensemble vide), donc taux et ecart null aussi ;
  - **objectif total = 0 explicite ET périmètre complet** → `taux` = null
    (pas de division par zéro), mais **`ecart` RESTE calculé = 0 − realise**.
  realise toujours renvoyé. champs collecte agrégés pour SMART/agent seulement.
  Ligne société toujours présente ; groupe « (Sans agence) » conservé.

**Colonnes des tableaux** :
- Collaborateur SMART = **9 colonnes** : N°, Agence, Agent, Objectif, Réalisé,
  Taux, Écart, Autres écarts (manquant/surplus SÉPARÉS, jamais nettés),
  Régularisation/commentaire (regularise + dernier_commentaire).
- Collaborateur non-SMART = **7 colonnes** (sans les 2 colonnes de collecte).
- Agence = **6 colonnes** : N°, Agences, Objectifs, Réalisé, Taux, Écart.

**Statuts** :
- `absent` → objectif=null, taux=null, réalisé affiché (aucune cible posée).
- `conflit` → objectif=null, taux=null, `meta.objectifs_incomplets=true`
  (ne devrait plus arriver : l'unicité l'empêche à l'écriture).
- `defini` → objectif = valeur (peut être 0 explicite → taux null).

**Période partielle / futur** : `date_arrete`=null pour une période future
(réalisé nul, objectif complet). Période en cours : réalisé arrêté à aujourd'hui.
Pas de proratisation.

## 6. RPC MASSE — `attribuer_objectifs_en_masse_periode`

```sql
attribuer_objectifs_en_masse_periode(
  p_niveau text, p_periodicite text, p_date_reference date,
  p_cible_ids uuid[], p_titre text, p_description text,
  p_cibles jsonb, p_ignorer_doublons boolean default true
) returns jsonb
```
- Un appel = une périodicité + une période + N cibles (même gabarit `p_cibles`).
- Niveau global → `p_cible_ids` ignoré (une seule cible société).
- S'appuie sur le trigger (convention + unicité + droits). Capture
  `unique_violation` → doublon compté `ignore` (si p_ignorer_doublons) ou `refuse`.
- **absent ≠ zéro** : une mesure non fournie dans `p_cibles` reste NULL.
- Retour : `{ ok, cree, ignore, refuse, details[] }`.
- **Ancienne RPC `attribuer_objectifs_en_masse`** (modèle chevauchement) : encore
  en base pour compat ; à retirer après bascule front (DROP fourni, commenté).

## 7. Front à livrer (Codex)

- Brancher les 3 rapports sur `rapport_objectifs_periode` ; sélecteurs
  mesure (15) / niveau / périodicité / date ; filtres statuts + comptes.
- Création/édition/masse : envoyer la CONVENTION (global ; journalier→jour_date ;
  mensuel→mois/annee ; annuel→annee, mois=1). Geler type/cible/périodicité/période
  en édition (le trigger les refuse de toute façon).
- Bascule masse vers la nouvelle RPC ; retrait de l'ancienne + du modèle 13.2.
- Bandeau si `meta.objectifs_incomplets`. Taux null → « — ». Aucune somme
  recalculée navigateur. Exports PDF/Excel = mêmes valeurs/ordre, JWT utilisateur.

## 8. Recette en base (à faire)

- Création unitaire : chaque périodicité, chaque niveau ; convention respectée.
- Doublon même clé → refusé (message métier). Masse doublon + ignorer → `ignore`.
- **2 créations concurrentes même clé** (2 sessions) → une seule passe (index).
- Absent / zéro explicite / conflit → statuts corrects, taux null.
- Jour/mois/an, mois en cours, futur (réalisé nul), février bissextile.
- 45 combinaisons mesure × niveau ; colonnes collecte seulement agent/SMART.
- RA borné à son agence ; société refusée au RA ; anonyme/agent/chef refusés.
- Clôture d'un objectif ; réactivation ; PDF/Excel = mêmes chiffres que la RPC.

## 9. État de déploiement (fait en base le 29/09)

14A (jour_date + index) ✓ · 15 (trigger) ✓ · 15.1b (29 journaliers → mensuel :
61 mensuels, 0 journalier orphelin) ✓ · 15.1c (3 index uniques) ✓ · 15.2 (masse) ✓
· 14B (lecture) ✓. Modèle 13.2 abandonné.