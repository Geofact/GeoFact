# Correctif local : diagnostic iPhone et compteurs bonus

Branche `fix/iphone-validation-bonus-ui`, créée depuis la version publiée `78f8e0e`. Aucune fusion ni publication pendant cette intervention.

## Diagnostic du signalement

Le scénario rapporté est une carte encore interactive, avec des pays qui paraissent verts, sans anecdote ni progression. Le Nigeria est un cas de reproduction, pas une cause présumée.

La sélection passe par les événements pointer et la résolution du chemin SVG, puis `guess`. Une bonne réponse fixe `answered`, choisit le fait et effectue le rendu avant de célébrer le pays. Les réponses suivantes sont ignorées tant que le joueur n'appuie pas sur « Pays suivant ». Une erreur JavaScript avant ou pendant le rendu pourrait donc laisser une réponse acceptée avec une interface incomplète. Aucune erreur de ce type n'est observée dans les parcours exécutés.

Le vert clair de survol (`--land2`) est différent du vert vif de réussite (`.country-found`). Le survol peut encore réagir alors que la logique ignore les réponses supplémentaires. Ce constat de code peut expliquer une impression de validation, mais ne prouve pas la cause du signalement Safari.

Les données Nigeria, sa géométrie, les faits FR/EN, l'identification lors d'un toucher natif et le passage au tour suivant sont vérifiés. Les tests couvrent classique, Daily, défi et entraînement, avec et sans animations, sur écran 320×568.

Les opérations IndexedDB de réponse ne concernent que l'entraînement ; le Daily écrit son résultat après le dernier tour. Une erreur d'écriture simulée en entraînement laisse l'anecdote visible, bloque explicitement le bouton suivant, affiche une erreur et permet une récupération. Ce scénario ne reproduit donc pas, à lui seul, la disparition de l'anecdote décrite.

**Le bug Safari signalé n'est pas reproduit et sa cause réelle n'est pas identifiée.** La logique de validation, la résolution géographique et les transitions restent inchangées. Aucun correctif spéculatif de validation n'est introduit. WebKit a été tenté mais son exécutable est absent ; Chromium mobile ne valide pas Safari iOS, ses gestes de viewport ou ses politiques particulières de stockage.

Pour poursuivre : mode de jeu, version iOS, date du Daily éventuel, présence d'une coche et du vert vif, bouton suivant visible/activé, message de sauvegarde, comportement après changement de langue ou rechargement. Une courte vidéo et, si accessible, la première exception de la console Safari permettraient de différencier rendu, animation, sélection et stockage. Ne pas effacer les données du site pour diagnostiquer.

## Interface

Accueil : carte Entraînement et sous-titre « Joue sans limite » conservés, paragraphe supprimé, aucune série /10. Seul « Coffres bonus : 0/2 aujourd'hui » figure dans la ligne discrète de quota.

Entraînement : « Coffres bonus : 0/2 » et « Pays trouvés d'affilée : 2/10 », avec valeurs dynamiques et barre fine native accessible. L'ancien compteur de série de session est masqué uniquement dans ce mode. Traductions : « Bonus chests: 0/2 today », « Bonus chests: 0/2 », « Countries found in a row: 2/10 ».

Les réponses en attente sont projetées pour l'affichage avec `applyBonusAnswer`, la même fonction pure que le dépôt. Cette projection n'effectue aucune écriture et ne confirme aucune attribution. Quotas et coffres restent issus de l'état effectivement enregistré. Une réponse en attente indique « Enregistrement… » ou « En attente de sauvegarde » après erreur ; la dixième peut afficher 10/10 avant confirmation, puis la progression revient à zéro après attribution enregistrée. Le plafond continue de suspendre la progression.

Les anciennes clés, le schéma IndexedDB, les règles pures, probabilités, score Daily et statistiques Supabase restent inchangés. Les imports sont seulement versionnés `20261009-fix1`, de manière cohérente avec HTML/JS/CSS, pour préparer une future livraison sans cache incompatible.

## Tests

`tests/iphone-regression.mjs` : Nigeria touché à un véritable point intérieur, mauvais pays avant réussite, touches répétées après réussite, seul pays validé en vert, faits réellement opaques et non vides, prochain tour, langues, sauvegardes antérieures identiques ; compteurs immédiats malgré une transaction native qui retient la file d'écriture ; rechargement et deux onglets ; erreur de quota, absence d'écriture durable et récupération.

`tests/bonus-integration.mjs` est adapté à la nouvelle interface et conserve seuils 9/10/11, erreurs, deux coffres, UTC, ouvertures différées et concurrentes. La suite d'audit conserve huit dimensions FR/EN et les tests des autres modes, cartes, frontières et migrations.

Une attente explicite de l'écran de partie corrige un ancien test Daily qui pouvait envoyer un événement synthétique alors que la carte était encore masquée. Ce défaut de harnais ne prouve pas un défaut de validation du jeu.

**Validation finale : 71 tests Node et 2 043 assertions HTTP Chromium réussis**, sans exception JavaScript, ressource locale manquante ou requête externe imprévue. `git diff --check` est propre. Tous les profils sont fictifs et Supabase est intercepté avant navigation. Captures examinées sur 320 pixels, FR/EN et paysage 568×320. Appareil physique et Safari restent à vérifier.
