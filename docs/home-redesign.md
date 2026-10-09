# Refonte de l’accueil — validation avant publication

Branche : `redesign/home-only`, issue du commit publié `e63dee7`.

## Périmètre

- Nouvelle hiérarchie et textes FR/EN de l’accueil, Daily vert, coffre SVG décoratif, accès Entraînement / Défis, bloc collection.
- Véritable `assets/geofact-logo.svg`, textes en arc et animation `heroBrandJourney` conservés. Animation réduite toujours respectée.
- Compteur unique : « Coffres bonus obtenus », utilisant la valeur déjà calculée par le jeu, sans progression /10.
- Identifiants et gestionnaires existants conservés. Aucun changement dans `app.js`, la carte, les données, les règles, le stockage ou Supabase.
- Styles ajoutés limités à `#home` et au header lorsque l’accueil est visible. Paramètre de cache supplémentaire uniquement pour les deux ressources modifiées (`style.css`, `i18n.js`).

## Vérifications

Le module HTTP `tests/home-redesign.mjs` vérifie les deux langues à 1280, 320, 375 et 390 px, l’absence de débordement, les tailles du texte, les cibles tactiles, le véritable logo animé, les accès, la préférence de langue/son et la conservation des sauvegardes originales. Les Daily terminés avec coffre révélé ou non sont vérifiés avec des données fictives en FR/EN, y compris le passage réel de l’horloge simulée à minuit UTC. Les lectures et changements de jour ne créditent ni ne réinitialisent les récompenses.

Les anciens tests de libellés ont été adaptés aux textes demandés ; les assertions de récompenses restent conservées. La suite HTTP existante couvre aussi les Daily en cours, les animations réduites, les coffres anciens en attente, la concurrence entre onglets, les modes, la carte et les erreurs de sauvegarde. Supabase est entièrement simulé.

Pour produire les captures lors de `npm run test:browser`, définir `HOME_CAPTURE_DIR` vers un dossier local de sortie. Huit captures d’accueil (FR/EN × quatre largeurs) et quatre états Daily terminés sont produites.

## Limites

La maquette a été fournie sous forme de deux captures : comparaison visuelle avec celles-ci, pas avec un fichier de conception original. Les vérifications navigateur utilisent Chromium ; WebKit/Safari iPhone n’est pas installé dans cet environnement. Aucun nouveau mécanisme de reprise de partie Daily n’a été ajouté : le comportement de démarrage/reprise reste exactement celui du jeu existant.

Aucune fusion, publication ou modification distante pour cette refonte. Validation du rendu requise avant publication.

## Résultats de cette livraison

- `npm test` : 85 tests Node réussis, aucun échec ni test ignoré.
- `npm run test:browser` : 2 558 assertions HTTP Chromium réussies, dont 416 contrôles ciblés de l’accueil.
- Captures contrôlées : accueil FR/EN sur ordinateur et mobile ; captures disponibles à 320, 375 et 390 px, et Daily terminé avec coffre ouvert/non ouvert.
- Aucun débordement horizontal, cible tactile des commandes vérifiées ≥ 44 px, aucune erreur JavaScript ni ressource locale manquante dans la suite.
- `GeoFact.html`/`export.py` absents : export portable non testé. Safari/iPhone réel reste à vérifier.
