# Présentation des petites cibles — révision non publiée

La vue mondiale utilise des points compacts et des boutons de regroupement blancs, marqués d’un « + » vert. Les regroupements sont limités à des zones proches ; aucune bordure pointillée ni gros cercle jaune. Le point central distingue visuellement la sélection d’un pays du « + » de zoom.

La taille dépend du zoom et évolue progressivement. Au zoom local, les cibles mesurent environ 26 px, avec une zone carrée de 44 × 44 px CSS au toucher et de 32 × 32 px à la souris. Les petits groupes deviennent des cibles espacées, reliées à leurs positions géographiques si elles doivent être décalées. Les groupes plus denses restent des « + » qui poursuivent le zoom. Le zoom garde les positions du groupe dans son cadrage ; les commandes de zoom disposent d’une marge exclue du placement et des zones tactiles.

Une cible individuelle locale passe avant les polygones voisins dans sa zone de clic. Hors de cette zone, les frontières restent sélectionnables. Une ambiguïté ne choisit aucun pays. Un « + » déclenche uniquement le zoom. La disparition progressive d’un ancien repère et les doubles touches rapides après ouverture ne traversent pas le repère pour répondre au pays derrière. Les déplacements, pincements et annulations de pointeur restent exclus de la logique de réponse.

Le conseil est une seule ligne, traduite par le système FR/EN : conseil général de zoom, ou invitation à toucher les « + » si des regroupements sont présents. Les noms et drapeaux ne sont pas ajoutés à la carte. Aucune information sur le pays recherché n’entre dans la présentation des repères.

Les géométries Natural Earth vérifiées, les anciennes références de distance, les identifiants des territoires ultramarins et les callbacks de réponse sont conservés. Aucun changement de règles, scores, sauvegardes, récompenses ou Supabase. Seul le rafraîchissement du conseil est ajouté au rendu de l’application.

`npm run test:map` inclut les tests de présentation : vue mondiale, ouverture native de regroupements, double toucher sans réponse, Vatican/Saint-Marin, îles, cible agrandie, priorité sur les polygones, gestes, FR/EN, largeur de 320 px et absence de recouvrement des commandes. `GEOFACT_CAPTURE_DIR` enregistre les captures réelles ordinateur et mobile aux niveaux monde, région, micro-États et île. Les tests bloquent les requêtes externes. Mobile émulé dans Chromium, sans test sur appareil physique.
