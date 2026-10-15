# Audio Braise — fichiers validés et commandes indépendantes

Modification locale, sans fusion ni déploiement. La musique MP3 jointe a été expressément acceptée par l’utilisateur à la place du WAV mentionné initialement.

## Fichiers et niveaux

Les quatre fichiers dans `assets/audio/` sont des copies binaires des pièces jointes, sans conversion, normalisation, modification de hauteur ou de vitesse :

- `GeoFact-Braise-Aventure-boucle.mp3` : musique.
- `GeoFact-Coffre-scintillant.wav` : coffres Daily et bonus.
- `GeoFact-Bonne-reponse.wav` et `GeoFact-Mauvaise-reponse.wav` : réponses.

Les empreintes originales sont contrôlées par `tests/audio-assets.test.js`.

L’ancien moteur n’avait ni volume utilisateur ni gain musical général. Ses voix synthétisées utilisaient respectivement 0,036 (mélodie), 0,040 (basse) et 0,024 (pulsation). Le fichier musical prémixé passe par le gain de référence mélodique existant, **0,036**, sans amplification ni normalisation. Les niveaux instrumentaux individuels ne peuvent pas être reproduits séparément à partir d’un prémix. Les trois constantes historiques restent documentées dans `music.js`.

Les nouveaux effets utilisent le gain existant **0,035**. Les autres notifications synthétisées conservent leurs notes et gains. Le scintillement synthétique de bonne réponse à 0,012 faisait partie de la composition remplacée ; il n’est pas superposé au fichier validé. Aucun curseur ni volume enregistré n’est ajouté ou réinitialisé.

## Lecture et commandes

Un contexte partagé décode les fichiers ; la musique utilise un seul `AudioBufferSourceNode` natif en boucle. Aucun minuteur ne relance le morceau. Les écrans, questions et fenêtres ne recréent pas la musique. Couper la musique mémorise sa position ; une reprise crée uniquement le lecteur nécessaire à cette position, sans lecteur superposé.

Les deux préférences `gf-music-v1` et `gf-effects-v1` sont indépendantes. Chacune reprend l’ancien `gf-sound-v1` si elle n’existe pas : `off` donne désactivé, `on` donne activé, absence donne activé comme auparavant. L’ancienne clé et les sauvegardes du jeu restent intactes. Les erreurs de stockage ne bloquent pas le jeu.

Couper les effets arrête aussi les effets déjà commencés ou programmés et invalide les décodages en attente. Les événements passés ne sont pas rejoués. L’arrière-plan arrête les sons et conserve la position musicale ; une reprise nécessitant une autorisation attend une interaction. Les refus de lecture automatique restent sans conséquence pour le jeu.

Le bouton ouvre un panneau Braise FR/EN avec deux interrupteurs natifs accessibles, des cibles tactiles de 52 px, fermeture extérieure et Échap, et retour du focus au bouton. Son icône est muette uniquement si les deux catégories sont désactivées.

## Coffres

Le repère de scintillement du fichier est à environ 0,55 s. L’animation normale révèle la carte à 4,91 s : le fichier commence donc à 4,36 s. Les délais, récompenses et règles existants ne changent pas. Une navigation ou une fermeture invalide le son programmé.

Avec les animations réduites, le fichier complet démarre immédiatement. La révélation accélérée existante (environ 0,08 s) précède alors son scintillement : aligner exactement les deux imposerait de couper le fichier ou de retarder la révélation. Aucun de ces changements n’a été effectué.

## Validation

- `npm test` : 9 fichiers de tests réussis, dont les empreintes, migrations, gains, interruptions, courses asynchrones et erreurs audio.
- `npm run test:audio` : 409 assertions navigateur réussies, en FR/EN, aux largeurs 1280, 320, 375 et 390 px ; quatre combinaisons, rechargement, sauvegardes, clavier, gestes tactiles simulés, transitions, réponses et coffres Daily/bonus avec et sans mouvement réduit.
- Suites musique et reprise mobile : 22 assertions supplémentaires réussies, dont une reprise asynchrone de type Safari simulée.
- Daily après adaptation des attentes de migration audio : 151 assertions réussies (rechargement, onglets concurrents, erreurs et UTC).
- Collection : 357 assertions réussies sur totaux, sauvegardes, récompenses et rechargement. Contrôle complémentaire réussi : préférences indépendantes entre deux onglets et six silhouettes chargées à 32 px.

Le moteur natif a rendu **quatre répétitions** du MP3 décodé (73,84615625 s à 32 kHz), soit trois raccords stéréo. Aucun échantillon de silence ou décalage n’a été ajouté ; l’erreur maximale contre la répétition attendue est de 2,2×10⁻⁹. Le saut intrinsèque entre les extrémités du fichier reste inchangé (environ 0,00060 après gain). Cette vérification numérique ne remplace pas une écoute humaine ni un essai sur un téléphone physique.

## Collection

Les six anciens globes ronds des cartes de continents sont remplacés par des silhouettes SVG issues des tracés géographiques déjà présents. Leur boîte reste de 32 × 32 px ; le masquage existant sur les cartes les plus étroites est conservé. Comptages, filtres et interactions restent inchangés.

La suite navigateur générale a rencontré une attente historique comparant le stockage aux seules anciennes clés. Le test a été adapté pour attendre explicitement les deux nouvelles préférences, tout en comparant chaque valeur de sauvegarde originale. Les résultats ci-dessus concernent les suites ciblées exécutées ; ils ne constituent pas une validation complète de toutes les suites historiques.
