# Refonte Braise — 15 octobre 2026

Branche : `design/braise`. Aucun déploiement et aucune fusion.

## Présentation

Thème prune/charbon avec textes blanc cassé, accents corail/pêche et surfaces sombres. Les couleurs communes, surfaces, contrastes, rayons et effets principaux sont définis dans `:root` dans `style.css`. Les anciennes compositions successives de l’accueil ont été retirées.

L’accueil conserve les textes et les compteurs réels. Composition à deux colonnes sur ordinateur, une colonne sur mobile, horizon terrestre SVG, carte du monde décorative et coffre SVG isométrique. Les trois nouvelles ressources sont locales, sans requête graphique externe ; environ 306 ko non compressés au total. Elles sont dérivées des tracés géographiques déjà inclus dans le projet. Les décorations ne capturent pas les événements.

Les surfaces communes couvrent le jeu, les résultats, les anecdotes, l’album, les fenêtres, les statistiques, l’aide, le partage et les commandes. Les raretés Silver, Gold et Shiny gardent des traitements distincts. Les petits repères de carte sont pêche et les commandes de zoom sont regroupées horizontalement en haut pour libérer les cibles des deux côtés du Pacifique sur mobile. Aucun tracé ni rayon de sélection ne change.

Le coffre interactif conserve ses éléments, sa séquence d’ouverture et sa révélation, avec une nouvelle finition sombre et des jointures chaudes. Les actions de récompense ont une surface pêche et se superposent proprement sur mobile. Le nombre de récompenses/actions reste celui de l’application existante.

« Stats » reste le titre. Sous-texte : « GeoFact en chiffres » / « GeoFact in numbers ». Aucune mention de progression personnelle dans cette carte. Stats et aide figurent en bas de l’accueil et retournent dans l’en-tête des autres écrans. Les mêmes boutons sont déplacés, sans recréer leurs gestionnaires.

Le logo original, son animation, les traductions et les mécanismes de sauvegarde sont conservés. Les quatre lignes ajoutées à `app.js` concernent seulement le déplacement des commandes Stats/aide. Aucun changement aux règles, pays, anecdotes, probabilités, quotas, stockage ou intégrations.

## Vérifications

- `npm test` : huit suites passent.
- `npm run test:browser` : exécution complète réussie, 4 762 assertions, sans exception navigateur, ressource locale manquante ni requête externe inattendue.
- `npm run test:map` : 187 contrôles passent sur ordinateur et mobile tactile, y compris les petites îles, le zoom, le déplacement, les frontières et les zones de sélection.
- Régression accueil existante mise à jour pour la nouvelle composition : FR/EN, 1280/320/375/390 px, navigation, clavier, préférences, compteurs et sauvegardes.
- Coffres bonus et carte de récompense : 701 assertions passent, FR/EN, petits écrans et écrans bas, alignements, couleurs, ouverture transactionnelle, aller-retour vers l’album et la carte, conservation des données.
- Parcours Daily supplémentaires : cinq pays, résultats, anecdotes, coffre, récompense et rechargement ; FR/EN, 1280/320/375/390 px. Pas de débordement horizontal détecté.
- Navigation globale Stats/aide et préférence de mouvement réduit vérifiées à 1280/320/375/390 px.
- Contrastes des couples principaux : texte 14,09:1 ; sous-texte 7,94:1 ; actions pêche 9,70:1 ; bouton principal sur l’extrémité corail 5,98:1.
- Captures locales dans `work/captures/` : accueil, entraînement, collection, statistiques, aide, carte, anecdotes, coffres et récompenses, mobile et ordinateur.

Les contextes de navigateur et les données de récompense sont isolés ; les appels Supabase sont simulés. Aucun compte ni aucune sauvegarde de production n’ont été utilisés.

## Limites

Validation automatisée dans Chromium Linux. Les intégrations réseau réelles, le partage natif d’iOS/Android et un contrôle sur appareils physiques restent à effectuer. Le décor terrestre est un SVG léger, pas une photographie. Le dossier de livraison `/codex/.../output` n’est pas accessible dans cette machine ; les captures restent dans le répertoire local de travail.
