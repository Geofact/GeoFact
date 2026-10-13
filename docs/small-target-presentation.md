# Vue agrandie des îles et micro-États

La carte principale conserve ses frontières et ses distances. Ses petits points et regroupements ouvrent une vue agrandie sans réponse ni pénalité. La vue est identique pour tous les modes et ne dépend jamais du pays demandé.

Seules les cibles des petits territoires répondent dans cette vue : les polygones voisins, notamment l’Italie autour du Vatican, sont du contexte. Les cibles mesurent 28 px visuellement et 48 × 48 px CSS pour la sélection. Elles utilisent les points intérieurs vérifiés des géométries existantes. Les grands pays restent sélectionnables normalement par leurs frontières sur la carte principale ; aucun bouton Italie n’apparaît dans la vue des micro-États.

Des cibles trop proches deviennent un contrôle de zoom « + » sans réponse. Son ouverture cadre une zone plus précise avant d’autoriser la sélection individuelle. Une séparation avec un trait géographique reste réservée aux points confondus à la limite de zoom. Les zones tactiles ne se chevauchent pas et restent dans la vue. Le déplacement, le pincement, l’annulation de pointeur, le changement de disposition et les doubles touches rapides ne produisent aucune réponse.

La fermeture restitue la carte principale sans changer son cadrage. Une sélection explicite ferme la vue avant d’appeler la logique de réponse actuelle : distances, pénalités, couleurs et scores inchangés. Aucun changement à `app.js`, `core.js`, aux géométries, aux collections, aux sauvegardes, aux récompenses ni à Supabase.

Le titre, le conseil unique, la fermeture et tous les libellés accessibles utilisent les traductions FR/EN existantes. Aucun nom, drapeau ou indice lié à la question n’est ajouté aux cibles. Le dialogue natif gère le focus, Échap et l’interdiction d’interagir avec la carte derrière.

`npm run test:map` vérifie les micro-États, îles, frontières voisines, positions sourcées, cibles confondues au zoom maximal, clics tactiles natifs, clic sur l’Italie juste hors de la cible Vatican, absence de pénalité à l’ouverture, bonnes/mauvaises réponses, gestes, fermeture, FR/EN et 320 px. `GEOFACT_CAPTURE_DIR` enregistre les captures réelles du jeu sur ordinateur et mobile. Mobile émulé dans Chromium ; pas de test sur appareil physique.
