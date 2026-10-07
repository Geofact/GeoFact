# GeoFact — version locale

GeoFact est un jeu de géographie bilingue FR/EN, mobile-first. La version locale ne dépend d’aucun backend.

## Jouer

Double-cliquer sur `GeoFact.html`. C’est l’export autonome du jeu et le moyen le plus simple de le tester.

Pour travailler sur le code source, utiliser `index.html`, `style.css`, `app.js`, `core.js`, `map.js`, `i18n.js` et `data/`. Après une modification, lancer `python3 export.py` pour régénérer `GeoFact.html`. Ne pas modifier directement l’export autonome.

## Fonctionnalités actuelles

- Daily : 5 pays identiques pour tous pour une date UTC, score sur 100, erreurs, série et partage spoiler-free.
- Entraînement : par difficulté ou avec une sélection personnalisée de pays, sans score.
- Défis : même série de 5 pays via un lien, comparaison des scores et revanche.
- Carte : zoom, déplacement, pinch tactile, micro-États et distances territoriales.
- 195 pays, capitales FR/EN et 201 faits bilingues.
- Collection : 195 drapeaux × 4 raretés = 780 variantes, doublons comptabilisés, tri A–Z/date/rareté/continent.
- Coffre : un coffre après le Daily, pays aléatoire et rareté influencée par le score.
- Sauvegarde locale : langue, statistiques, Daily et collection dans `localStorage`. Les comptes/cloud viendront plus tard.

## Structure

- `data/countries.js` : pays, noms, capitales, coordonnées, difficulté et continent.
- `data/facts.js` : faits de jeu bilingues.
- `data/flag-cards.js` : textes des cartes de drapeau et sources d’audit.
- `core.js` : score, Daily, défis, rotation des faits et distances.
- `map.js` : interactions avec la carte.
- `app.js` : état et rendu du jeu.
- `i18n.js` : interface FR/EN.
- `style.css` : identité visuelle et responsive.
- `assets/` : logo, favicon et image de partage.
- `tests/` : tests de régression Node et parcours navigateur.

## Vérifications

`npm test` lance les tests Node. `npm run test:browser` lance les parcours Playwright après installation de Playwright/Chromium.

Avant une mise en ligne publique, remplacer l’ancienne URL GitHub Pages encore utilisée dans les métadonnées/partages par l’URL du nouvel hébergement, puis régénérer `GeoFact.html`.
