# Sélection des petits territoires

La carte commune à tous les modes calcule la surface et les dimensions du plus grand polygone connecté de chaque pays ou région. Elle projette ces mesures par la matrice SVG réelle à chaque zoom, déplacement et redimensionnement. Une île dispersée ne devient donc pas artificiellement « grande » à cause de la largeur de son archipel.

Une pastille de 9 px (plus son trait de 1,4 px) apparaît quand ce polygone est trop petit : seuil de 44 px avec pointeur principal tactile, 24 px à la souris. Son opacité diminue sur les derniers 35 % du seuil. Le contour géographique reste sélectionnable. Les cercles historiques du fond sont masqués : ce ne sont pas des frontières.

Le point d’ancrage est vérifié à l’intérieur du polygone. Les 29 territoires anciennement représentés uniquement par un cercle ont maintenant les côtes Natural Earth 1:10m, dont les quatre micro-États européens et les États insulaires. Voir les sources et l’empreinte dans `data/small-territories.md`.

Le clic direct sur le point choisit le pays. La zone invisible de confort est utilisée uniquement sur un fond sans territoire ; un vrai contour voisin reste prioritaire. Les zones ambiguës sont regroupées. Le regroupement neutre zoome sans appeler la logique de réponse. Les positions moyennes des groupes sont elles aussi vérifiées pour éviter de nouveaux chevauchements. Au zoom maximal, les points impossibles à séparer géographiquement sont espacés et reliés à leur territoire. Les points proches du bord sont aussi reliés lorsqu’ils sont ramenés dans la carte.

Les identifiants transmis à `guess` sont inchangés. Les nouvelles côtes sont dans une classe distincte de celle lue par le calcul des distances ; les positions historiques ponctuelles restent uniquement ses références. Ni la surface d’une pastille ni sa zone de confort n’interviennent dans les distances, frontières terrestres ou pénalités. Aucun changement des récompenses, de la collection, de Supabase ou des formats de sauvegarde.

Les repères utilisent les couleurs actuelles de succès/erreur et des libellés accessibles FR/EN neutres, sans nom avant la réponse. Entrée et Espace activent une pastille ou un regroupement. Les glissements, pincements, annulations de pointeur, zooms pendant une pression et relâchements natifs hors carte ne produisent pas de réponse.

## Vérification

- `npm test` : règles, distances, frontières, stockage, récompenses et audit FR/EN.
- `npm run test:browser` : parcours complets existants, distances ultramarines, bonnes/mauvaises réponses, sauvegardes, récompenses, modes, couleurs, langues et mobile.
- `npm run test:map` : couverture des 195 pays, souris et toucher natifs, micro-États et îles, ancrages réels, voisins dans la zone élargie, tailles écran, regroupements, séparation au zoom maximal, contour après disparition de la pastille, gestes sans réponse et scores via les pastilles.

Les tests navigateur utilisent les variables `PLAYWRIGHT_MODULE` et `CHROMIUM_PATH` documentées dans `tests/README.md`. `GEOFACT_CAPTURE_DIR` produit les captures réelles ordinateur/mobile de la carte dans le jeu. Les requêtes externes sont interceptées pendant les tests ; aucun enregistrement Supabase réel. Le mobile est émulé dans Chromium, pas vérifié sur appareil physique.
