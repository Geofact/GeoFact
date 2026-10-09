# 4B.4 — Collection et Daily sur IndexedDB

## Activation et préservation

Le jeu ouvre désormais le dépôt au démarrage et active le Daily à la première utilisation. Si la base n'est pas encore active, l'import minimal 4B.3 est exécuté : lecture/validation des deux clés sources, collection et Daily écrits atomiquement, chaînes originales conservées. L'activation suivante ajoute les coffres historiques ayant une carte et un marqueur `dailyActive:1`. Chaque phase est transactionnelle et répétable : une interruption entre import et activation reprend l'activation sans réimport ni crédit supplémentaire.

Pour un nouveau joueur sans clés sources, l'activation enregistre explicitement cette origine vide. Les futures consultations n'importent pas de nouveau. En cas d'import impossible, le jeu n'utilise pas une collection vide : `collection` reste indisponible et un message persistant propose de réessayer. Le Daily peut être joué mais aucune récompense n'est annoncée sans sauvegarde confirmée. Les autres modes restent jouables.

Après activation, IndexedDB est l'autorité. Les clés `gf-collection-v1` et `gf-daily-v1` ne sont plus écrites par le jeu ; elles restent des copies de l'état antérieur à la migration. Les préférences, records classiques, anecdotes et statistiques personnelles utilisent toujours leurs clés habituelles. Les anciens scores Daily sur 5 000 restent stockés sans modification et sont convertis uniquement à l'affichage. Les champs historiques supplémentaires restent conservés.

## Transactions Daily

Les trois stores et la version de schéma IndexedDB 1 sont conservés : les champs et types Daily sont des ajouts compatibles, sans store supplémentaire. Les coffres Daily sont séparés des coffres bonus dans les lectures du dépôt.

- `activateDaily(storage)` importe si nécessaire, puis enregistre le Daily actif et les coffres historiques. Une carte historique n'est jamais recréditée.
- `completeDaily(command)` sérialise les écritures sur les trois stores. Elle enregistre ensemble le résultat, les compteurs Daily, la collection, le crédit, le coffre `daily:YYYY-MM-DD` et un reçu `daily-complete:YYYY-MM-DD`. Un résultat déjà présent est rendu tel quel, même si un autre onglet propose une autre carte ou un autre score. Aucun nouveau tirage enregistré ni crédit supplémentaire.
- `revealDaily({day,at})` enregistre ensemble l'indicateur de révélation du résultat, celui du coffre et le reçu `daily-reveal:YYYY-MM-DD`. La collection ne change pas à l'ouverture. Le deuxième appel retrouve le résultat révélé.

La carte reste créditée à la **fin du Daily**, comme avant cette étape. Les probabilités dépendant du score, le pool de pays, la source aléatoire, le score et les pénalités sont inchangés. Les animations d'ouverture conservent leurs délais de 4 650 ms puis 260 ms, ou 80 ms puis 0 ms avec réduction des animations. Les animations peuvent être interrompues par navigation, mais leur interruption ne supprime pas une récompense déjà enregistrée.

Le jour, le numéro et la série Daily sont fixés au lancement. Une fin après minuit UTC enregistre le jour de départ ; le nouveau Daily reste disponible. Une fin tardive ne ramène pas `lastDate` en arrière et peut compléter une série de jours déjà commencée dans un autre onglet.

## Interface et erreurs

Une consultation du Daily terminé affiche désormais son coffre non révélé, ou sa carte déjà révélée. Un bouton discret à l'accueil retrouve les coffres des jours précédents ; s'il en reste plusieurs, ils sont proposés un par un. Il n'y a aucun coffre d'entraînement.

Les vues sont relues lors des actions de consultation, du retour de focus et des notifications BroadcastChannel. La révision empêche l'application d'une lecture plus ancienne. La sûreté des récompenses repose sur les transactions, indépendamment de la disponibilité du canal de notifications.

Une erreur d'import, d'ouverture de base, d'écriture ou de révélation donne un message français/anglais et conserve les données existantes. Une récompense non confirmée n'est pas présentée comme acquise. La commande et son tirage restent en mémoire pour une nouvelle tentative tant que le joueur ne quitte pas ce résultat. Si l'écriture a été commitée avant la perte de réponse, une lecture ou un rechargement retrouve la carte fixée ; une nouvelle tentative pour le même jour ne crédite rien de plus.

Un ancien onglet peut encore écrire dans localStorage. Le jeu signale cette modification, également détectée au rechargement par comparaison avec les valeurs originales, et continue à utiliser IndexedDB sans fusion. Les gains réalisés ensuite dans cet ancien onglet ne sont donc pas intégrés automatiquement. Fermer les anciens onglets et vérifier manuellement les divergences demeure nécessaire. Une réouverture après migration n'exige plus l'accès à localStorage pour lire les récompenses canoniques.

Les événements Supabase existants restent envoyés après réussite ; seul l'appel qui crée ou révèle effectivement le coffre envoie l'événement correspondant. Le réseau et la base locale ne partagent pas de transaction : une fermeture entre commit et envoi peut manquer un événement public, sans perdre la récompense. Aucun nouveau mécanisme de statistiques n'est ajouté.

## Vérification et limites

Tests Node : équivalence exacte de la formule de rareté avec l'ancienne pour tous les scores entiers de 0 à 100 et 10 000 tirages par score ; copies, dates et historiques ; idempotence ; passage de minuit ; fin tardive ; validation des commandes. Les suites antérieures sont conservées, avec adaptation des assertions qui visaient les anciennes écritures localStorage.

Tests HTTP Chromium : migrations anciennes/actuelles, rechargement et coffre non révélé, ouverture répétée, deux onglets terminant/ouvrant le même Daily, quota simulé et nouvelle tentative, import malformé, IndexedDB indisponible, annulation native après écritures, perte de réponse après commit, minuit UTC et ancien onglet divergent. Les modes classique, entraînement, défis, traductions, mobile et statistiques simulées restent couverts par la suite complète.

Les profils de test sont synthétiques. Les interactions mobiles utilisent l'émulation Chromium, sans appareil physique. Firefox, Safari/WebKit, les coupures matérielles, un vrai disque plein et les politiques particulières des navigateurs privés ne sont pas validés ici. L'export portable historique est absent du dépôt et n'est pas testé. L'effacement du profil ou la perte d'IndexedDB après migration peut perdre les nouveaux gains : les anciennes clés ne contiennent pas ces gains. Aucun export complet, serveur de sauvegarde, compte utilisateur ou protection antifraude absolue n'est introduit.

Résultat de la validation finale : **66 tests Node réussis** et **1 578 assertions HTTP Chromium réussies**, sans erreur navigateur ni requête externe imprévue. Supabase est entièrement simulé. `git diff --check` ne signale aucune erreur.
