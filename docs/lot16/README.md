# Lot 16 — modèles d’objectifs d’agence

Le Lot 16 couvre deux fonctions complémentaires :

- attribution manuelle d’un même objectif sur plusieurs jours, mois ou années ;
- modèles individuels par agence, appliqués automatiquement aux agents et chefs actifs.

Toutes les migrations du Lot 16 sont désormais versionnées dans `supabase/migrations`. Leur préfixe impose l'ordre de dépendance réel : 16.2, 16.2b, 16.1, 16.3, puis la finalisation 16.3c/16.4.

Ordre exact :

1. `202609300001_objectifs_modeles_structure.sql` — Lot 16.2 ;
2. `202609300002_objectifs_modeles_provenance.sql` — Lot 16.2b ;
3. `202609300003_objectifs_multi_periodes.sql` — Lot 16.1 ;
4. `202609300004_objectifs_modeles_generation.sql` — Lot 16.3 ;
5. `202609300005_objectifs_modeles_finalisation.sql` — Lots 16.3c et 16.4.

Points de contrat :

- le front admin conserve `admin_muter_membre_equipe(uuid, uuid)` ;
- création/réactivation sont différées si l’agence est occupée ;
- mutation inter-agences conserve objectifs manuels/personnalisés et clôture seulement les futurs issus du modèle précédent ;
- `generer_objectifs_modeles_echeance(date)` est réservé au `service_role` ;
- le frontend des modèles ne doit être raccordé qu’après compilation et recette SQL.

Le renouvellement est appelé quotidiennement à 00:05 UTC par `/api/cron/objectifs-modeles`. Vercel doit contenir les variables serveur `CRON_SECRET` et `SUPABASE_SERVICE_ROLE_KEY`. Le dépôt ne contient que leurs noms, jamais leurs valeurs.

Le runbook complet et la matrice de recette sont consignés dans `../../../docs/sig/PERCOM-LOT16-MODELES-OBJECTIFS-2026-09-30.md` depuis la racine PADES.
