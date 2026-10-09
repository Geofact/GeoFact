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

## Ajustement mobile compact

À la demande du propriétaire, l’accroche « Trouve le pays… » est supprimée dans les deux langues. Logo animé et ligne secondaire conservés. La disposition mobile réduit les espacements, conserve le coffre à côté du texte Daily, affiche Entraînement / Défis côte à côte à partir de 365 px et conserve une colonne compacte en dessous. Les règles restent limitées à l’accueil ; aucune modification du jeu ou des sauvegardes.

Validation adaptée après ce changement : 85 tests Node et 442 assertions HTTP ciblées d’accueil, FR/EN à 320/375/390/1280 px, y compris textes, absence de chevauchement du logo, modes, préférences, sauvegardes, Daily et minuit UTC. La suite HTTP complète n’a pas été relancée pour ce seul ajustement visuel ; son dernier résultat reste 2 558 assertions sur la première refonte.

Accueil français à 375 px : hauteur de capture complète réduite de 1 355 à 945 px (environ 30 %), en conservant les textes secondaires, le compteur et les accès.

## Commandes intégrées à l’accueil

Le petit logo de l’en-tête est masqué à l’accueil. Les commandes existantes (son, langue FR/EN, Stats et Comment jouer) sont intégrées en haut à droite du bloc crème, sur une ligne avec des cibles tactiles de 44 px. Le grand logo et son animation restent conservés. Sur les autres écrans, le même header est remis à sa place habituelle ; aucun identifiant ou gestionnaire n’est dupliqué. La seule modification d’`app.js` concerne le parent du header et les libellés courts du sélecteur à l’accueil. Aucune logique de jeu, de sauvegarde ou de statistiques modifiée.

Validation : 85 tests Node, 466 assertions ciblées d’accueil et 2 608 assertions de la suite HTTP complète réussis (Supabase simulé). La capture française à 375 px tient désormais dans la hauteur de 900 px du navigateur de test, y compris l’accès à la collection. Les captures couvrent aussi 320 et 390 px en FR/EN. Safari/iPhone réel reste à vérifier.
