# Déploiement PERCOM

## Cible confirmée le 21 septembre 2026

- Production : https://percom-ten.vercel.app
- Dépôt privé : https://github.com/Magloire0758/PERCOM.git
- Déploiement automatique Vercel à chaque push sur `main` (confirmation utilisateur).
- Base Supabase PERCOM : `kuussvvtjjajvasfksnj`, distincte du SIG PADES.
- Variables serveur : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (aucune valeur dans le dépôt).

## Livraison du 21 septembre 2026

Corrections communes, parcours agent/chef/RA, rapports PDF/Excel, cohérence des agrégats et objectifs, file de traitement, accès directs aux exports des fiches agent, cache local PWA et durcissement des routes administratives déjà préparés dans cette campagne. La refonte complète DG/Admin reste à venir.

Contrôles avant publication : build Next de production et TypeScript réussis ; `npm run test:agent` réussi (rapports agent/équipe/agence, fichiers PDF/Excel et frontière HTTP simulée). Recettes connectées réelles distinctes des tests synthétiques.

Les migrations SQL ne sont pas exécutées par le push GitHub. Les Lots backend reçus doivent être présents sur PERCOM ; l’application du Lot 8 reste à confirmer séparément. Les deux migrations locales de tri reprennent les cinq fonctions du Lot 8. Ne pas confondre livraison frontend et application SQL.

## Procédure

1. Vérifier la synchronisation de `main`, le contenu du commit et l’absence de secrets.
2. Lancer `npm run build`, puis `npm run test:agent` (les fixtures sont générées dans `.next`).
3. Pousser le commit validé sur `origin/main`.
4. Vérifier la fin du déploiement Vercel, les réponses HTTP et les nouveaux assets ; recetter les parcours avec les comptes métier.
5. Sur PWA ouverte, utiliser « Mettre à jour » si proposé, ou fermer puis rouvrir l’application en ligne.

Retour arrière frontend : redéployer le précédent déploiement Vercel validé, ou révoquer le commit par un commit `git revert` relu puis poussé. Un retour arrière frontend ne révoque aucune migration SQL.
