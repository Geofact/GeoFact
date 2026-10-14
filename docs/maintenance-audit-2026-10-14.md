# Audit et nettoyage prudent — 14 octobre 2026

Base : `1d50251242c00194d03618320c0ef37ad8952fda`, dernière version de production au démarrage. Branche : `cleanup/geofact-maintenance-20261014`. Aucun changement de main, fusion ou publication dans ce chantier.

La seule évolution d’apparence autorisée séparément est la teinte pêche des quatre actions après révélation d’une carte Daily. Le nettoyage conserve le rendu et le comportement du reste du jeu.

## Inventaire et décisions

L’inventaire initial compte 82 fichiers suivis, dont 21 fichiers exécutés ou servis par le client. Comparaison SHA-256 : aucun fichier strictement identique à un autre. Les ressources locales référencées par HTML, CSS et imports sont présentes (30 liens statiques vérifiés). Les chemins dynamiques de l’interface, imports différés de récompenses, clones SVG, classes générées, logos, sources de cartes et URLs de partage ont également été examinés ; les tests HTTP contrôlent les requêtes réellement émises.

- `assets/` : les cinq ressources sont utilisées, y compris les métadonnées de partage et l’icône Apple. Aucune suppression.
- `data/` : pays, faits, cartes, frontières, géométries des petits territoires, sources et licences conservés intégralement.
- `tests/` : les tests autonomes, helpers et fixture HTML sont utilisés par les commandes ou imports. Aucun test supprimé ou affaibli.
- `docs/` : les analyses historiques documentent les contrats de stockage et les étapes déjà livrées. Conservées, avec un index distinguant présentation actuelle et anciennes étapes.
- Racine : chemins publics et imports conservés ; les déplacer ajouterait des modifications de caches, de tests et d’hébergement sans bénéfice suffisant. La structure existante reste simple : modules, styles et entrée à la racine ; données, ressources, tests et documentation dans leurs dossiers dédiés.
- Dépendance : Playwright `1.63.0`, inchangé. Aucun framework ou paquet ajouté. Aucun script de construction ni workflow de déploiement suivi ; le projet est statique.
- Hébergement : `CNAME`, domaine, métadonnées et configuration distante non modifiés. Aucun manifest d’installation, service worker ou Cache Storage applicatif dans cette version. Ne pas ajouter de purge de stockage pour compenser leur absence.

## Nettoyage réalisé

- `map.js` : retrait du cercle décoratif `target-core`, créé pour chaque repère mais toujours masqué par JavaScript et CSS. Recherche des références : uniquement sa création, son masquage et ses propres styles ; aucun gestionnaire, calcul géographique ou test existant n’en dépend. Les cibles réelles, repères noirs, traits aux bords, hitboxes, gestes et ancrages restent identiques. Cela retire un élément SVG inutile par repère, également dans la carte de consultation.
- `style.css` : retrait des styles associés à ce cercle absent et des déclarations de couleur de repères remplacées par la présentation noire validée. Conservation de la cascade utile, des épaisseurs pour les erreurs, du focus et des animations. Les anciennes couleurs encore utilisées par une animation ne sont pas supprimées.
- `.gitignore` : exclusion durable de `work/`, dépendances locales et résultats Playwright. Les archives et captures temporaires ne deviennent pas des ressources de production.
- `README.md`, `data/README.md`, `docs/README.md`, `tests/README.md` : structure, index, commande de mise à jour et limites documentés.
- `tests/maintenance-update.mjs`, `package.json` : commande reproductible de comparaison de sauvegardes entre version archivée et candidat. Ce harnais est hors du code du jeu.

Aucun fichier de production supprimé ou déplacé. Aucun refactor global, changement d’identifiant partagé, d’API, de schéma ou d’algorithme de jeu. Les quatre actions utilisent une teinte pêche explicite, sans recolorer d’autre bouton.

## Compatibilité des sauvegardes

Avant les modifications du jeu, la version initiale a créé quatre profils fictifs : série bonus partielle, coffre scellé, coffre déjà ouvert et Daily commencé dans la période suivant un Daily terminé. Les fixtures incluent cartes, raretés, doublons, statistiques, séries, préférences, anciens formats importés et reçus de récompenses.

Le même serveur HTTP passe ensuite de l’archive au candidat, sans changer l’origine ni fermer les contextes, et sans effacer aucun stockage. Comparaison exacte de **tous les enregistrements** des stores IndexedDB `state`, `chests`, `sessions`, du nom/version de base et de chaque valeur localStorage/sessionStorage. Vérification supplémentaire du crédit unique après ouverture/rejeu et d’un profil neuf.

Les ressources anciennes sont conservées par URL complète dans un cache simulé du harnais : Playwright désactive le cache HTTP natif quand les requêtes sont interceptées. Les URL de `map.js` et `style.css` changent pour renouveler ces deux ressources ; les paramètres de version existants restent compatibles. Les ressources non modifiées conservent leurs URL.

Un Daily en cours n’est pas persisté tour par tour dans la version initiale : son tour reste en mémoire. Le test garantit les données réellement sauvegardées après mise à jour, pas la restauration d’un état que le jeu n’enregistrait pas. Aucun nouveau mécanisme de sauvegarde ou de migration n’a été ajouté.

Clés conservées : `wg-lang`, `wg-best` historique, `wg-stats`, `wg-seen-facts`, `gf-best-scores`, `gf-anonymous-visitor-v1`, `gf-sound-v1`, `gf-collection-v1`, `gf-daily-v1`, `gf-pending-practice-v1` et clés tierces inconnues. Base `geofact-rewards`, version `1`, inchangée. Aucun effacement des anciennes clés, changement de migration ou opération sur les données de joueurs.

## Validation

| Vérification | Avant nettoyage | Candidat |
| --- | --- | --- |
| `npm test` | 8 fichiers passent | 8 fichiers passent |
| `npm run test:browser` | 4 013 assertions passent | 4 013 assertions passent |
| `npm run test:map` | 187 contrôles passent | 187 contrôles passent |
| `npm run test:restart` | 21 assertions, quatre lancements | 21 assertions, quatre lancements |
| `npm run test:update` | Quatre sauvegardes initiales préparées avant modification | 26 assertions passent sur la même origine |
| Carte d’une récompense, suite ciblée | Couverte par la suite initiale | 186 assertions passent |
| Captures de carte stabilisées | Six captures de référence | Six captures identiques pixel par pixel |
| Styles de repères et traits | États mondial/local, normal/erreur/succès | Couleurs, traits, transitions et interactions CSS identiques dans les six états |

Les captures ordinaires prises pendant l’animation d’entrée avaient quelques pixels différents ; les captures avec cette animation terminée sont identiques. La stabilisation s’applique uniquement au harnais de capture, sans modifier le jeu ou ses tests historiques. Comparaison de fichiers : 75 des 82 fichiers suivis initiaux sont strictement inchangés, dont `app.js`, règles, sauvegardes, son, statistiques, traductions, données, géométries SVG et domaine. Dans `index.html`, seuls les paramètres de cache de CSS et carte changent.

Les premiers essais du nouveau harnais ont nécessité de normaliser le chemin de son serveur HTTP et d’attendre la fin de la transition de couleur, en ciblant les quatre boutons visibles. Corrections du harnais, sans changement du jeu ni affaiblissement de ses tests. Vérifications de syntaxe et `git diff --check` propres. Journaux et archives dans `work/audit/`, ignorés par Git.

Captures réelles de la grille pêche, hors déploiement : [mobile](https://github.com/Geofact/GeoFact/blob/e40ecb8863cc0ade8aba318870e307727609a7da/docs/previews/peach-actions-mobile.png), [ordinateur](https://github.com/Geofact/GeoFact/blob/e40ecb8863cc0ade8aba318870e307727609a7da/docs/previews/peach-actions-desktop.png). Elles sont conservées dans un commit de revue séparé, sans modification d’une branche de publication.

Les RPC Supabase sont interceptés avant navigation et simulés ; aucun événement fictif n’est envoyé. Les tests couvrent ordinateur et mobile émulé, FR/EN, les 195 pays, territoires ultramarins, distances, frontières, Daily UTC, coffres et crédits, collection, partage, fenêtres, animation du logo et audio. Aucun schéma ou accès serveur Supabase n’est modifié ou validé par ces tests.

## Éléments conservés et limites

La feuille de styles contient encore des couches anciennes superposées ; hors des déclarations prouvées remplacées pour les petits repères, une réécriture générale risquerait de changer les spécificités, media queries et états. Elle est conservée. Les grandes responsabilités de `app.js` sont identifiables mais déplacer ses fonctions vers des modules demanderait un chantier séparé, avec contrats explicites ; aucune extraction spéculative.

Les reçus IndexedDB continuent de croître : une purge pourrait réautoriser des gains déjà crédités et reste hors périmètre. Les sauvegardes malformées et anciens documents sont conservés. Le nom historique du package n’est pas un élément exécuté par les joueurs : pas de renommage cosmétique.

Limites : Chromium desktop et émulation tactile, pas d’appareil iPhone/Android physique ni Safari. Le cache HTTP est simulé, les en-têtes effectifs de production ne sont pas certifiés. La lecture des réglages GitHub Pages par le connecteur n’est pas disponible ; la configuration distante n’a pas été changée. Aucun déploiement n’est déclenché pour valider ce nettoyage. Les scénarios ne simulent ni panne électrique, éviction du navigateur ni disque réellement saturé.
