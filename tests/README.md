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

Les normalisations historiques déjà présentes dans l'application sont conservées. Les tests ne créent aucune migration et ne changent aucune clé du jeu. Les données mal formées, le stockage inaccessible et les erreurs de quota sont aussi simulés. Le jeu peut continuer sans sauvegarder quand l'écriture est impossible : ces tests ne garantissent pas la persistance dans ce cas.

## Interactions et géographie

Les tests couvrent les territoires français et américains (bonne réponse, anecdote et historique du pays parent, mauvaise réponse et distance), ainsi que douze tours d'entraînement avec un seul pays. Les autres parcours couvrent les modes, les défis et le partage, la langue, les gestes de carte et six largeurs d'affichage.

`highlight.mjs` vérifie le vert réellement calculé par le navigateur après la fin de l’animation, puis le retour aux couleurs initiales au tour suivant ou à la sortie. Il couvre Daily, partie classique et entraînement, sur ordinateur et en simulation mobile, avec et sans réduction des animations. Les contrôles incluent zoom, déplacement tactile, pinch, recentrage, changement de langue, territoires séparés et marqueurs des micro-États. Les interactions après une réponse ne doivent modifier ni le score ni la progression sauvegardée ; le changement de langue conserve son enregistrement habituel de préférence. Des changements de tour et sorties pendant l’animation vérifient également l’annulation des anciens temporisateurs.

`borders.mjs` vérifie les messages exacts FR/EN, le remplacement des kilomètres et leur retour pour une réponse non frontalière, avec les pénalités et sauvegardes inchangées. Les parcours couvrent Daily, défis et entraînement personnalisé sur ordinateur et mobile, Guyane, Alaska/Hawaï, micro-États, interfaces contestées et traversées maritimes. Les tests Node contrôlent toutes les paires et leur symétrie ; les sources et conventions sont documentées dans `data/borders.md`.

Les sélections synthétiques désignent explicitement leur forme SVG et utilisent des coordonnées hors de la carte pour éviter de sélectionner une autre forme sous un point écran arbitraire. Des clics souris réels sur la France et la Belgique, un tap tactile réel sur la Belgique et les gestes de déplacement/pinch sont testés séparément. La simulation tactile sur Chromium n'est pas une validation de Safari mobile.

## Limites

L'export autonome `GeoFact.html` et son script `export.py` sont absents de ce dépôt. La suite le signale explicitement et ne revendique pas de validation de cet export.

Les interruptions entre les écritures Daily/collection, les écritures concurrentes entre onglets, l'ouverture interrompue d'un coffre et le passage à minuit nécessitent une conception dédiée des récompenses. Cette étape ne modifie pas ce mécanisme.
