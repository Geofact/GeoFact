# Tests GeoFact

Depuis la racine du dépôt :

```sh
npm test
npm run test:browser
```

La suite navigateur nécessite Playwright 1.63.0 et un navigateur installé. Elle démarre son propre serveur HTTP sur `127.0.0.1`, avec un port libre, puis le ferme. Aucun serveur de développement séparé n'est nécessaire. Elle ne navigue jamais avec `file://` et ne produit pas de captures dans le dépôt.

Dans l'environnement restauré, Playwright et Chromium sont installés en dehors du dépôt :

```sh
PLAYWRIGHT_MODULE=/workspace/.geofact-tools/node_modules/playwright/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Pour un moteur Playwright installé différent :

```sh
PLAYWRIGHT_BROWSER=webkit npm run test:browser
```

`PLAYWRIGHT_BROWSER` accepte `chromium` (défaut), `webkit` et `firefox`. `CHROMIUM_PATH` ne s'applique qu'à Chromium. Une exécution WebKit ne remplace pas un test sur un véritable iPhone.

## Isolation

Chaque contexte navigateur utilise un profil temporaire et intercepte les deux RPC Supabase avant la première navigation. Les événements et statistiques sont simulés ; aucune requête Supabase n'est transmise. Toute autre destination externe est bloquée et fait échouer la vérification finale. Les service workers sont bloqués pour empêcher un contournement des interceptions.

Une panne Supabase est simulée séparément pour vérifier le message d'indisponibilité et la poursuite du jeu. Ces tests valident les appels du client, pas le schéma, les permissions ou la disponibilité du serveur Supabase réel.

## Sauvegardes

`save-fixtures.mjs` contient uniquement des exemples fictifs : sauvegarde actuelle avec doublons et raretés, ancien format de collection et ancien barème de scores. Aucun profil réel de joueur n'est lu.

La suite compare toutes les clés et leurs valeurs textuelles exactes après chargement et rechargement. Elle vérifie les changements attendus après une réponse et un Daily : statistiques incrémentées, historique existant conservé, une seule copie ajoutée, raretés et dates antérieures préservées. Une double ouverture dans le même onglet et une consultation du Daily terminé ne doivent pas ajouter de carte.

Les imports compatibles, les données mal formées, le stockage inaccessible et les erreurs de quota sont simulés. Les anciennes clés de collection et Daily restent identiques. Une récompense n'est confirmée qu'après commit IndexedDB. Les pannes matérielles et l'effacement d'un profil ne sont pas simulés fidèlement.

## Interactions et géographie

`bonus-rules.test.mjs` vérifie séparément le modèle pur `bonus-rules.mjs` : seuils, progression, quotas UTC, rejeux, cartes fixes, ouverture idempotente et probabilités exactes. Le module est réutilisé par le dépôt transactionnel et l'intégration entraînement. Son contrat et les limites de cette sous-étape figurent dans `docs/bonus-rules-4b1.md`.

`reward-repository.test.mjs` vérifie l’isolation et les erreurs d’ouverture du dépôt. `repository.mjs` teste IndexedDB natif dans deux pages partageant le même profil : transactions concurrentes, abort après écritures, crédit atomique, reprise après confirmation perdue, rechargement, UTC, export et schéma. Les sauvegardes fictives v1 doivent rester identiques octet pour octet. Le dépôt est branché à la collection, au Daily et aux coffres bonus. Fidélité des injections et limites détaillées dans `docs/reward-repository-4b2.md`.

Les tests couvrent les territoires français et américains (bonne réponse, anecdote et historique du pays parent, mauvaise réponse et distance), ainsi que douze tours d'entraînement avec un seul pays. Les autres parcours couvrent les modes, les défis et le partage, la langue, les gestes de carte et six largeurs d'affichage.

`highlight.mjs` vérifie le vert réellement calculé par le navigateur après la fin de l’animation, puis le retour aux couleurs initiales au tour suivant ou à la sortie. Il couvre Daily, partie classique et entraînement, sur ordinateur et en simulation mobile, avec et sans réduction des animations. Les contrôles incluent zoom, déplacement tactile, pinch, recentrage, changement de langue, territoires séparés et marqueurs des micro-États. Les interactions après une réponse ne doivent modifier ni le score ni la progression sauvegardée ; le changement de langue conserve son enregistrement habituel de préférence. Des changements de tour et sorties pendant l’animation vérifient également l’annulation des anciens temporisateurs.

`borders.mjs` vérifie les messages exacts FR/EN, le remplacement des kilomètres et leur retour pour une réponse non frontalière, avec les pénalités et sauvegardes inchangées. Les parcours couvrent Daily, défis et entraînement personnalisé sur ordinateur et mobile, Guyane, Alaska/Hawaï, micro-États, interfaces contestées et traversées maritimes. Les tests Node contrôlent toutes les paires et leur symétrie ; les sources et conventions sont documentées dans `data/borders.md`.

Les sélections synthétiques désignent explicitement leur forme SVG et utilisent des coordonnées hors de la carte pour éviter de sélectionner une autre forme sous un point écran arbitraire. Des clics souris réels sur la France et la Belgique, un tap tactile réel sur la Belgique et les gestes de déplacement/pinch sont testés séparément. La simulation tactile sur Chromium n'est pas une validation de Safari mobile.

## Limites

L'export autonome `GeoFact.html` et son script `export.py` sont absents de ce dépôt. La suite le signale explicitement et ne revendique pas de validation de cet export.

`daily-storage.mjs` et `bonus-integration.mjs` vérifient les intégrations, les transactions concurrentes, les erreurs, les rechargements et minuit UTC. `legacy-import.mjs` vérifie la fidélité et l'idempotence de l'import minimal.

`release-audit.test.mjs` vérifie le catalogue FR/EN, les métadonnées, les ressources versionnées et l'absence de motifs de secrets privés dans le code client. Ce contrôle ne vérifie pas les autorisations du serveur Supabase. `release-audit.mjs` reproduit les régressions de journal d'entraînement et cache ancien ; il parcourt les écrans en FR/EN sur huit dimensions, dont 320×568 et le paysage 568×320. L'absence de débordement ne remplace pas une inspection visuelle sur appareil réel.

Le serveur de test sert les `.mjs` avec un MIME JavaScript. Les en-têtes et caches du véritable hébergement restent à vérifier. La croissance des reçus n'est pas limitée ; une éventuelle purge exige de préserver l'idempotence.

`iphone-regression.mjs` teste le Nigeria dans les quatre modes sur 320×568, avec touches natives, animations et réduction des animations. Il vérifie les réponses suivantes, l'opacité réelle de l'anecdote, la sauvegarde et sa récupération, les compteurs FR/EN immédiats sous verrou transactionnel, le rechargement et deux onglets. Le scénario iPhone rapporté n'est pas confirmé par l'émulation Chromium ; voir `docs/iphone-validation-bonus-ui.md`.
