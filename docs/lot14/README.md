# PERCOM — Lot 14 : rapports de direction par période exacte

Date : 29 septembre 2026. Décisions PADES après essai du Lot 13.2 en production. Ce lot remplace son modèle de lecture, sans réécrire son historique.

## État de livraison

Frontend local refondu. Aucune publication ni migration exécutée. Nouvelle RPC `rapport_objectifs_periode` requise ; l’ancienne RPC par chevauchement ne doit pas servir de remplacement automatique. Proposition SQL dans `PERCOM/percom/docs/lot14/rapport_objectifs_periode.sql` : à revoir et recetter par le volet backend avant application. Elle réutilise le Lot 13.2 uniquement pour les réalisés et les écarts, puis relit les objectifs par période exacte. Ce n’est pas une migration SQL certifiée ni le correctif des écritures.

## Décisions de référence

- Rapports indépendants : collaborateur (agent et chef collecteur), agence, société. Une seule cible A, un réalisé B, un taux B/A*100, un écart A-B.
- Choix Jour / Mois / Année : bornes calendaires complètes. Pas de proratisation ; période en cours = réalisé arrêté à aujourd’hui (Lomé), objectif complet. Période future : réalisé nul.
- Objectif du même niveau ET de la même périodicité ET de la période exacte. Pas de cumul entre jours/mois/années, pas de repli agence→agent ou réseau→agence.
- Les deux colonnes « Autres écarts » (manquant/surplus constaté) et « Régularisation / commentaire » apparaissent exclusivement pour collaborateur + SMART, à l’écran et dans le PDF/Excel.
- Rapport agence : N°, Agences, Objectifs, Réalisé, Taux de réalisation, Écart. Rapport collaborateurs : modèle PADES à neuf colonnes pour SMART, sept sinon.
- Total : sommes serveur des lignes du rapport. Taux = somme réalisés / somme objectifs, jamais moyenne. En cas d’objectif absent ou en conflit : somme connue affichée et signalée incomplète, taux et écart total nuls. Un objectif explicite à zéro conserve zéro et un taux nul.
- Les rapports collectifs incluent tous les comptes (actifs et suspendus) pour garder le périmètre de leur cible. Le filtre comptes reste dans le rapport collaborateurs. Rattachements actuels, conformément aux autres rapports.
- DG/Admin : trois rapports ; RA : collaborateurs/agence de son agence, pas société. Matrice d’écriture conservée : RA agent/équipe, DG agence/réseau, admin tous. Cette refonte n’autorise pas silencieusement la DG à créer des objectifs individuels.

## Contrat frontend à livrer côté backend

Signature :

```sql
rapport_objectifs_periode(
 p_mesure text, p_niveau text, p_periodicite text, p_date_reference date,
 p_agence_id uuid default null, p_statuts text[] default array['validee'],
 p_comptes text default 'tous'
) returns jsonb
```

- `p_niveau` : agent / agence / reseau.
- `p_periodicite` : journalier / mensuel / annuel.
- `p_mesure` : les 15 mesures Lot 13.2, SMART absorbant son historique seulement si la cible SMART est NULL.
- `p_agence_id` : NULL signifie réseau complet pour DG/Admin ; RA résolu côté serveur et agence étrangère refusée. Société : NULL obligatoire et DG/Admin uniquement.
- `p_comptes` : actif / inactif / tous ; obligatoirement tous pour agence/société.
- Accès actif, JWT, SECURITY DEFINER sécurisé et EXECUTE uniquement authenticated ; aucune clé service dans les exports.

Retour : `ok:true`, `meta`, `lignes`, `total`.

`meta` : contrat_version=2, niveau, periodicite, mesure, libelle_mesure, date_debut, date_fin, date_arrete (NULL pour futur), statuts, comptes, agence_id, agence_nom, objectifs_incomplets.

Chaque ligne : n, id, agence_id, agence_nom, agent_nom, objectif (nombre/NULL), objectif_statut (defini/absent/conflit), realise, taux, ecart. SMART/agent ajoute ecart_caisse_manquant, ecart_caisse_surplus, regularise, dernier_commentaire, dernier_commentaire_date, dernier_commentaire_fiche_id. Aucun mélange net entre manque et surplus.

Total : objectif (somme connue ou NULL si aucun), realise, taux, ecart ; champs SMART financiers pour SMART/agent seulement. Totaux calculés côté serveur. Sans agence conservé comme groupe explicite, sans objectif officiel d’agence possible.

## Écritures — correction backend obligatoire

Le script de lecture proposé ne change pas les triggers ni le Lot 12. Avant publication :

1. Adapter le contrôle des doublons au niveau + cible principale + périodicité + période exacte (et au modèle des mesures adopté dans la table). Deux objectifs mensuels identiques sont refusés ; un mensuel et un annuel peuvent coexister. Même protection pour INSERT, UPDATE, activation et masse, y compris en concurrence.
2. Conserver les permissions, le gel des cibles, la dérivation serveur et l’audit existants. Vérifier qu’un objectif réseau reste global strict.
3. Valider les bornes serveur : jour unique, mois complet, année complète. Ne pas modifier automatiquement les anciens objectifs à dates libres ; produire une liste des objectifs non compatibles à régulariser.
4. Préciser le traitement des objectifs multi-mesures : les formulaires existants envoient zéro pour une mesure non suivie. Ne pas changer NULL/0 silencieusement.
5. Faire approuver toute normalisation historique. La lecture proposée reconnaît uniquement les anciens mensuels mois/année sans dates ; les autres périodes non canoniques ne sont pas assimilées à un objectif annuel/mensuel.

## Frontend réalisé

Tableau unique, en-têtes et Total fixes, pagination 50 lignes ; exports du rapport choisi complet (une feuille Excel et tableau PDF), filtres visibles dans les documents. Pas de recomposition des objectifs/taux dans le navigateur. Compte-rendu des objectifs absents/conflits. Les formulaires individuels RA/DG/Admin et masse Admin/DG choisissent une période calendaire ; anciens objectifs conservés tant que l’utilisateur ne sélectionne pas explicitement une nouvelle période.

## Recette nécessaire

- Même agent avec objectif jour 10, mois 100, année 1000 : chaque rapport choisit un seul horizon, aucune somme 1110.
- Niveau agence : sa propre cible même si agents ont des objectifs différents ; société : sa propre cible, aucun repli.
- Objectif absent, zéro explicite, doublon détecté, total incomplet sans taux trompeur.
- Février bissextile, année bissextile, jour exact, mois en cours, futur ; bornes serveur et front identiques.
- 45 combinaisons mesure/niveau : colonnes financières de collecte présentes uniquement agent/SMART.
- 51+ lignes : pagination mais Total/export complets, ordre identique.
- Agent sans agence, agence sans agent, compte suspendu avec réalisé historique, RA sans agence/étrangère, anonyme/agent/chef refusés.
- PDF et Excel : un seul taux, mêmes valeurs que RPC, commentaires rattachés à la bonne fiche.

Tests frontend simulés et rendu documentaire local ne valent pas recette de la fonction SQL ni preuve de la règle d’unicité en base.


## Vérifications locales effectuées

- Compilation Next.js de production réussie (TypeScript et génération des 16 routes).
- ESLint ciblé sans erreur ; diff vérifié.
- `node scripts/test-consolidated-objectives.cjs` : dates calendaires (dont février bissextile), 45 combinaisons mesure/niveau, une seule colonne taux, absence/zéro, refus des anciens retours v1, rôle actif et autorisations d’export avec Supabase simulé, refus RA société et filtre collectif partiel.
- PDF et Excel réellement générés sur données fictives ; une feuille Excel relue ; page tableau PDF contrôlée visuellement (9 colonnes SMART/collaborateurs, Total et filtres lisibles).
- Inventaire PERCOM : 54 fichiers auteurs, 11 pages, 18 noms RPC lexicaux.
- SQL proposé : lecture/revue locale seulement, aucune exécution PostgreSQL. La migration des écritures et la recette en session réelle restent nécessaires. Rien n’a été poussé ni déployé.


## Reprise du 29 septembre — contrat final Lots 14/15

Raccordement local au contrat final (global, jour_date, mois/annee, nouvelle masse). Backend déclaré déployé par PADES ; frontend non publié. Voir `docs/sig/PERCOM-LOTS14-15-RACCORDEMENT-2026-09-29.md` dans le dossier PADES. Les propositions SQL antérieures restent historiques et ne doivent pas être appliquées.
