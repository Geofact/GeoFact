# Sélection des petits territoires

La carte commune à tous les modes calcule la surface et les dimensions du plus grand polygone connecté de chaque pays ou région. Elle projette ces mesures par la matrice SVG réelle à chaque zoom, déplacement et redimensionnement. Une île dispersée ne devient donc pas artificiellement « grande » à cause de la largeur de son archipel.

La vue mondiale utilise de petits points et des regroupements compacts avec un « + ». Au zoom local, les points deviennent des contrôles d’environ 26 px ; la zone tactile est carrée, de 44 × 44 px CSS (32 × 32 px à la souris). Taille et opacité suivent le zoom. Le contour reste sélectionnable quand le territoire devient assez grand. Les cercles historiques sont masqués : ce ne sont pas des frontières. Présentation, placement et interactions détaillés dans `small-target-presentation.md`.

Le point d’ancrage est vérifié à l’intérieur du polygone. Les 29 territoires anciennement représentés uniquement par un cercle ont maintenant les côtes Natural Earth 1:10m, dont les quatre micro-États européens et les États insulaires. Voir les sources et l’empreinte dans `data/small-territories.md`.

Le clic sur une cible individuelle locale, y compris sa zone de confort, est prioritaire sur les polygones voisins. Hors de ce contrôle, les contours gardent la sélection habituelle. Un cas ambigu ne choisit aucun pays. Le « + » zoome seulement et le fondu des anciens repères ne transmet pas de réponse au territoire derrière. Les groupes locaux assez petits sont espacés avec des traits vers leurs positions exactes ; les groupes plus denses poursuivent le zoom. Les commandes de zoom sont exclues des zones de placement et de sélection.

Les identifiants transmis à `guess` sont inchangés. Les nouvelles côtes sont dans une classe distincte de celle lue par le calcul des distances ; les positions historiques ponctuelles restent uniquement ses références. Ni la surface d’une pastille ni sa zone de confort n’interviennent dans les distances, frontières terrestres ou pénalités. Aucun changement des récompenses, de la collection, de Supabase ou des formats de sauvegarde.

Les repères utilisent les couleurs actuelles de succès/erreur et des libellés accessibles FR/EN neutres, sans nom avant la réponse. Entrée et Espace activent une pastille ou un regroupement. Les glissements, pincements, annulations de pointeur, zooms pendant une pression et relâchements natifs hors carte ne produisent pas de réponse.

## Vérification

- `npm test` : règles, distances, frontières, stockage, récompenses et audit FR/EN.
- `npm run test:browser` : parcours complets existants, distances ultramarines, bonnes/mauvaises réponses, sauvegardes, récompenses, modes, couleurs, langues et mobile.
- `npm run test:map` : couverture des 195 pays, souris et toucher natifs, micro-États et îles, ancrages réels, voisins dans la zone élargie, tailles écran, regroupements, séparation au zoom maximal, contour après disparition de la pastille, gestes sans réponse et scores via les pastilles.

Les tests navigateur utilisent les variables `PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` documentées dans `tests/README.md`. `GEOFACT_CAPTURE_DIR` produit les captures réelles ordinateur/mobile de la carte dans le jeu. Les requêtes externes sont interceptées pendant les tests ; aucun enregistrement Supabase réel. Le mobile est émulé dans Chromium, pas vérifié sur appareil physique.
