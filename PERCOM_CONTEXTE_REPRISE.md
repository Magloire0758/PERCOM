# PERCOM — Contexte de reprise

Mise à jour : 30 septembre 2026. Application Next.js dans ce dépôt ; base Supabase PERCOM distincte du SIG PADES. Production : https://percom-ten.vercel.app ; GitHub Magloire0758/PERCOM, publication automatique Vercel après push main.

## État vérifié

Dernier commit publié avant cette livraison : 7d92389 (RA/Chef et Admin). Livraison du 29 septembre : attribution en masse Admin et DG via attribuer_objectifs_en_masse ; DG limitée aux agences, admin aux agents/équipes/agences. Backend corrigé déclaré par PADES, sans recette connectée par Codex. La nouvelle vue consolidée et les campagnes restent une proposition non implémentée. Ne pas assimiler compilation locale, déclaration d’exécution SQL et recette réelle.

Agent/chef/RA/DG : reporting et exports partagés, filtres, performances et ergonomie modernisés lors des lots précédents. Admin : NetworkDashboard admin + AdminWorkspace, annuaires paginés, mutations atomiques, chefs multiples et référent, objectifs quatre niveaux, droits fixes et journal. Backend Admin jusqu’au Lot 11.5 fourni ; utilisateur confirme exécution des derniers correctifs. Aucune interrogation de base ni recette concurrente par Codex.

## Décisions

Droits fixes par rôle ; pas d’éditeur role_permissions. Plusieurs chefs par équipe, une équipe par chef, chef_id = référent. Mutation vers une autre agence nettoie les zones incompatibles ; backend fait autorité. Auto-suspension interdite. Désactivation par défaut ; suppression d’équipe seulement via RPC avec dépendances vérifiées. Aucun nouveau compte admin créé depuis l’UI.

## Vérification et suite

Build, TypeScript, lint ciblé, scripts de reporting/exports/reset, recettes navigateur simulées Admin/DG/RA/Chef réussis. Faire la recette avec comptes réels et les scénarios concurrents SQL avant publication. Les exports utilisent le JWT connecté, jamais un contournement service_role.

Limites : email de connexion non modifiable dans le formulaire d’identité ; pas de mutation générique RA/DG ni de rattachement de structure existante sans contrat atomique ; pas de suppression Auth depuis le navigateur. Journal des RPC non exhaustif des créations/resets. SEC-05 stockage/cache et SEC-06 dépendances restent ouverts. Ne jamais publier .env.local ni de clés serveur.

Référence commune : ../../ARCHITECTURE.md ; rapport détaillé ../../docs/sig/RACCORDEMENT-PERCOM-ADMIN-2026-09-23.md et validation associée. Mettre à jour la documentation commune avec les changements significatifs ; préserver les validations historiques.

## Extension validée après raccordement Admin

Gestion complète des fiches, utilisateurs, agences, équipes et zones validée, avec Fiches dans Administration. Contrats manquants préparés dans ../../docs/sig/PERCOM-ADMIN-CRUD-COMPLEMENT-BACKEND-2026-09-23.md. Livraison SQL/serveur à obtenir avant raccordement des nouvelles mutations ; les limites de la livraison précédente restent effectives jusque-là. Aucun nouveau déploiement.


## Lot 13.2 — raccordement local (29 septembre 2026)

Migration déclarée appliquée par PADES. Vue Objectifs consolidés ajoutée aux statistiques DG/Admin/RA, RPC rapport_objectifs_consolide, exports PDF/Excel sous JWT utilisateur, filtres et deux taux conformes au contrat. TypeScript, ESLint et tests simulés modèle/API validés. Pas de recette connectée ni publication dans cette intervention.


## Lot 14 — refonte locale après retour PADES

Rapports collaborateurs/agences/société distincts et calendaires (jour/mois/année). Un taux ; Total ; colonnes collecte uniquement collaborateurs SMART. Nouvelle RPC `rapport_objectifs_periode` requise (contrat v2), proposition SQL non appliquée dans docs/lot14. Droits et unicité des écritures à revoir côté backend pour coexistence jour/mois/année. Ne pas publier le front avant migration et recette ; production reste au Lot 13.2 (6629da2).


## Reprise du 29 septembre — contrat final Lots 14/15

Raccordement local au contrat final (global, jour_date, mois/annee, nouvelle masse). Backend déclaré déployé par PADES ; frontend non publié. Voir `docs/sig/PERCOM-LOTS14-15-RACCORDEMENT-2026-09-29.md` dans le dossier PADES. Les propositions SQL antérieures restent historiques et ne doivent pas être appliquées.


## Lot 16 — reprise backend par Codex (30 septembre 2026)

Claude n’étant plus disponible, Codex reprend la finalisation. Le complément local `supabase/migrations/202609300005_objectifs_modeles_finalisation.sql` conserve `admin_muter_membre_equipe`, protège les changements directs d’agence, ajoute file de reprise, aperçu et renouvellement `service_role`. Il remplace la proposition 16.3b avec `admin_muter_agent`.

Statut : fichier revu statiquement, non appliqué et non recetté en base. Les Lots 16.1/16.2/16.2b/16.3 fournis séparément restent prérequis. Ne pas raccorder ni publier l’interface des modèles avant compilation SQL, vérification des grants et recette réelle, notamment les scénarios concurrents.
