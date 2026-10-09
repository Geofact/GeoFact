# 4B.5 — Coffres bonus d'entraînement

## Règles et intégration

Le jeu appelle désormais `repository.answer(command, Object.keys(flagCards))` pour chaque réponse d'entraînement, correcte ou incorrecte. Les autres modes ne passent pas par cette méthode. Chaque tour reçoit un identifiant aléatoire indépendant des autres onglets ; chaque tentative reçoit un identifiant stable dérivé du tour et du numéro de tentative. Les horodatages et tirages sont fixés à la création de la commande, puis réutilisés à la récupération.

Toute la logique de seuil, série, quota UTC et rareté reste dans `bonus-rules.mjs`. La seule modification de ce fichier est son commentaire d'en-tête. Un coffre après 10 bonnes réponses consécutives, erreur remettant à zéro, deux attributions maximum par jour UTC, progression conservée entre sessions/jours et suspendue après le plafond. La reprise au changement UTC est calculée par `bonusProgress`, y compris si la partie reste ouverte. Les coffres n'expirent pas et leur carte est fixée à l'attribution.

Les tirages bonus restent Classic 62,25 %, Silver 25 %, Gold 10,5 %, Shiny 2,25 %. La carte n'entre dans la collection qu'à l'ouverture transactionnelle `repository.openChest`. L'identifiant d'ouverture `open:<chestId>` est stable ; reçus et crédit unique restent ceux du dépôt 4B.2. Les onglets partagent les quotas et la progression, avec sérialisation des transactions. Deux tours distincts concurrents comptent chacun, mais ne peuvent franchir deux fois le même seuil. L'ordre retenu est celui des transactions, pas un ordre absolu des clics entre machines ou onglets.

Le Daily conserve ses règles, probabilités et attribution de carte à la fin de la partie. Aucune écriture supplémentaire dans ses données n'est provoquée par un bonus. Les anciennes clés localStorage de collection et Daily restent inchangées. Les statistiques publiques Supabase ne reçoivent pas de nouveaux événements bonus ; les événements Daily existants restent inchangés. Les statistiques personnelles de bonnes réponses gardent leur comportement habituel.

## Interface et animations

Le texte français exact demandé apparaît sous le bouton Entraînement :

« Joue sans limite ! Trouve 10 pays d'affilée pour obtenir un coffre bonus. Jusqu'à 2 coffres supplémentaires par jour. »

Version anglaise vérifiée par comparaison des seuils, quantités et sens :

“Play as much as you like! Find 10 countries in a row to earn a bonus chest. Earn up to 2 extra chests per day.”

Une progression discrète apparaît à l'accueil et dans la partie d'entraînement, avec quota du jour et indication de reprise demain UTC. Après une erreur, elle affiche immédiatement zéro pendant l'enregistrement. Les bonnes réponses n'augmentent l'affichage confirmé qu'après lecture de l'état enregistré ; une réponse en attente affiche « Enregistrement… ». Une confirmation de coffre n'est montrée qu'après commit et relecture réussie.

Les coffres disponibles sont accessibles depuis l'accueil, l'entraînement et la collection. Une fenêtre native les liste par date d'obtention et permet de choisir un coffre. Elle ne quitte pas la partie : pays trouvé, anecdote et position de la carte restent conservés. Les cartes révélées sont ensuite dans la collection ; elles ne réapparaissent pas comme coffres disponibles après rechargement.

Le bouton du coffre bonus est cloné depuis le composant Daily et les deux ouvertures utilisent la même fonction d'animation. Les délais existants restent 4 650 ms puis 260 ms, ou 80 ms puis 0 ms avec réduction des animations. Fermer la fenêtre après avoir lancé une ouverture n'annule pas une transaction qui aboutit : la carte rejoint la collection une seule fois. Fermer l'onglet avant le commit laisse le coffre fermé, avec la même carte, pour une ouverture ultérieure.

Une correction indispensable du dépôt évite qu'un doublon bonus invente une nouvelle date d'acquisition pour une variante ancienne sans horodatage précis : sa date `firstUnlocked` reste la référence d'affichage. Les compteurs sont incrémentés sans modifier les dates déjà présentes.

## Erreurs et récupération

Les réponses d'un onglet sont enregistrées dans l'ordre. Une petite file dans sessionStorage, sous la **nouvelle** clé `gf-pending-practice-v1`, conserve uniquement les commandes en attente, pas la collection. Aucune ancienne clé n'est touchée. La commande est retirée après commit et relecture. Recharger le même onglet reprend la file ; un commit dont la réponse a été perdue est retrouvé par son identifiant, sans nouvelle attribution ni double crédit.

En cas d'échec, aucune nouvelle récompense n'est confirmée. La progression d'entraînement est bloquée dans cet onglet jusqu'à récupération ; le bouton « Réessayer la sauvegarde » réouvre le dépôt et rejoue les commandes stables. Un bouton de récupération est également accessible dans la fenêtre des coffres. Une ouverture échouée reste proposée ; une nouvelle tentative relit l'état et utilise le même identifiant de coffre.

Si sessionStorage ne peut pas être écrit, la file reste en mémoire : **garder l'onglet ouvert et réessayer avant de quitter**. sessionStorage n'est pas une sauvegarde entre navigateurs ni une garantie après fermeture définitive. Une file illisible n'est pas supprimée automatiquement ; la collection et la progression enregistrées ne sont pas modifiées. Une vérification manuelle de la clé temporaire est alors nécessaire, puis une nouvelle tentative. Ne pas supprimer les sauvegardes de collection/Daily pour résoudre ce problème.

Le quota d'une commande récupérée se rapporte à l'UTC du clic original, comme les règles pures validées en 4B.1. Une réponse qui n'a pas pu être écrite n'a pas encore d'effet durable ; un autre onglet peut enregistrer ses propres réponses avant sa récupération. Aucun repli sur une collection locale séparée ou sur des écritures non transactionnelles n'est utilisé.

## Vérification et limites

La suite Node conserve tous les tests précédents, notamment seuils 9/10/11, erreurs, UTC, plafond, cartes fixées, distribution exacte des raretés, identifiants stables et ouverture idempotente.

La suite HTTP ajoute le parcours réel d'entraînement : seuils, erreurs, pause quotidienne, reprise à minuit, progression après rechargement, coffres différés, ouverture répétée, deux onglets simultanés, échec d'attribution et reprise après rechargement, échec d'ouverture et nouvelle tentative, date des anciens doublons, file temporaire malformée, textes FR/EN, carte verte et indépendance du Daily/défi. Une ouverture animée et une ouverture avec réduction des animations sont vérifiées. Les autres suites HTTP sont conservées.

Tests sur profils synthétiques, Chromium ordinateur et mobile émulé. Firefox, Safari/WebKit, appareils physiques, panne électrique et véritable disque plein ne sont pas simulés fidèlement. Les limites 4B.4 restent valables : ancien onglet localStorage sans fusion, effacement d'IndexedDB pouvant perdre les nouveaux gains, absence de compte/synchronisation ou d'antifraude absolue. Les reçus de réponses s'accumulent ; aucune purge n'est ajoutée à cette étape, afin de préserver l'idempotence. Leur volume et les lectures complètes du dépôt devront être surveillés si l'usage augmente.

Validation finale : **66 tests Node réussis** et **1 651 assertions HTTP Chromium réussies**, sans erreur navigateur ni requête externe imprévue. `git diff --check` est propre. Les cas essentiels ont également été exécutés isolément (76 assertions avec les contrôles globaux).

Le jour UTC dépend de l'horloge locale, et les données navigateur restent modifiables par leur propriétaire : cette étape n'apporte aucune autorité serveur ni garantie antifraude.
