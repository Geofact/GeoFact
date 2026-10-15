# Publication Braise sur geofact.app — 15 octobre 2026

La version Braise validée sur le site privé est destinée à la branche `main` du dépôt `Geofact/GeoFact`, servie par GitHub Pages à la racine. Le domaine `CNAME` reste `geofact.app` ; l’origine et les données des joueurs ne changent pas.

La musique et les effets sont activés lorsqu’aucune préférence n’existe. Les préférences individuelles enregistrées restent prioritaires et persistent séparément. Un ancien choix de silence est migré vers les deux catégories désactivées. Le navigateur attend toujours une interaction autorisée pour démarrer la lecture.

Aucun changement audio supplémentaire n’a été nécessaire pour ce comportement : il était déjà présent dans la version validée. Aucune sauvegarde, statistique ou règle n’est réinitialisée.

Validation avant publication :

- 9 fichiers de tests Node réussis.
- 30 assertions de mise à jour sur la même origine, depuis l’archive exacte de la branche de production : quatre sauvegardes fictives (progression partielle, coffre fermé, coffre ouvert, Daily commencé), cache de l’ancienne version, migration de l’ancien silence, IndexedDB et stockage existant préservés, nouvelle installation activée et choix musical conservé après rechargement.
- Les validations précédentes de la version publiée en privé restent applicables au même code d’exécution : 409 assertions audio, 357 de collection, 151 Daily et trois raccords stéréo de la boucle native.

Les tests interceptent les appels Supabase et n’utilisent aucune sauvegarde de joueur réel. Une écoute et un essai sur téléphone physique restent à effectuer. Le détail des gains historiques et des animations réduites est dans `audio-files.md`.
