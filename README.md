# GeoFact

Jeu de géographie bilingue FR/EN : Daily, parties classiques, défis, entraînement et collection de drapeaux. La carte conserve le pays trouvé en vert et distingue les frontières terrestres des distances.

## Lancer localement

```sh
npm start
```

Ouvrir `http://localhost:8000`. Les modules de récompenses nécessitent HTTP ; `file://` n'est pas pris en charge. L'export autonome historique `GeoFact.html` et `export.py` sont absents de ce dépôt.

## Récompenses et sauvegardes

IndexedDB est la source de vérité des collections, Daily et coffres bonus. Les collections et Daily compatibles de `localStorage` sont importés automatiquement, sans suppression ni réécriture de leurs anciennes clés. Une importation illisible est signalée et ne devient pas une collection vide. Les préférences et certaines statistiques historiques restent dans `localStorage`.

Le Daily conserve ses règles et probabilités dépendantes du score. L'entraînement attribue un coffre après dix pays consécutifs, avec un plafond de deux attributions par journée UTC. Les cartes bonus sont fixées à l'attribution, créditées à l'ouverture, et les coffres non ouverts n'expirent pas. Les comptes et la synchronisation cloud ne sont pas implémentés.

Les statistiques publiques utilisent deux RPC Supabase. Les tests les interceptent systématiquement avant la navigation et ne transmettent aucun événement de test.

## Structure et tests

- `core.js`, `map.js`, `data/` : règles historiques, carte et données géographiques.
- `bonus-rules.mjs`, `daily-rewards.mjs` : transitions pures de récompenses.
- `reward-repository.mjs`, `legacy-rewards.mjs` : transactions IndexedDB et import minimal.
- `app.js`, `index.html`, `style.css`, `i18n.js` : interface bilingue.
- `tests/` : tests Node et parcours HTTP isolés.
- `docs/` : décisions, contrats et limites des étapes validées.

```sh
npm test
npm run test:browser
```

Voir `tests/README.md` pour les prérequis Playwright et les limites. Pour une nouvelle livraison, changer de façon cohérente la version des ressources dans `index.html` et tous les imports des modules de récompenses ; le test d'audit vérifie cette cohérence.

Le domaine déclaré dans `CNAME` est `geofact.app`. La configuration GitHub Pages doit être vérifiée dans GitHub avant publication. Une fusion dans sa branche source peut déclencher immédiatement le déploiement.
