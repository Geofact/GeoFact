# 4B.2 — dépôt transactionnel IndexedDB isolé

`reward-repository.mjs` importe les règles pures de 4B.1. Il n’est pas chargé dans `index.html`, n’est pas appelé par `app.js` et n’ouvre aucune base à l’import. Aucun accès à localStorage, Supabase, au Daily ou à la collection visible.

## Schéma et API

Base proposée : `geofact-rewards`, version IndexedDB **1**. Version du document canonique **1**, modèle bonus **1**, export **1**. Les tests utilisent d’autres noms de base dans des profils temporaires.

- `state`, clé `id` : enregistrement `rewards` contenant révision, progression, quotas UTC, collection interne isolée et registre des crédits.
- `chests`, clé `id` : coffres, carte fixe, dates d’obtention et d’ouverture.
- `sessions`, clé `id` : reçus `op:<identifiant>` et tours résolus `round:<identifiant>`. Le store sert à la déduplication durable ; il ne lit aucun état de session du jeu actuel.

`openRewardRepository({name?, indexedDB?})` renvoie une connexion avec :

- `answer(command, catalog)` : applique la réponse aux règles pures et persiste le résultat ; le temps, les identifiants et les tirages restent des entrées explicites.
- `openChest(command)` : ouvre et applique une fois le crédit à la **collection interne** de ce dépôt.
- `read()` : instantané cohérent de progression, quotas, coffres, reçus, collection et crédits.
- `export()` : objet sérialisable versionné contenant cet instantané. Aucun téléchargement, import ou écriture ailleurs.
- `close()` : ferme cette connexion.

Les paramètres de commande et catalogue sont copiés à l’entrée. Modifier un instantané retourné ne modifie pas la base.

## Atomicité et idempotence

Toutes les mutations utilisent une transaction `readwrite` sur les trois stores. Elles relisent l’état canonique, le reçu de l’opération, le tour et le coffre concernés ; elles ne chargent pas tout l’historique pour chaque clic. Ces transactions partagent `state`, donc les connexions concurrentes sont ordonnées par IndexedDB.

Le dépôt construit la vue minimale attendue par `applyBonusAnswer` ou `openBonusChest` : il ne redéfinit ni seuil, ni plafond, ni probabilités. Il persiste uniquement les reçus/tours/coffres nouveaux ou modifiés. Les quotas et la progression sont enregistrés avec eux.

Lors d’une ouverture, l’instruction de crédit pure est appliquée dans **la même transaction** que l’état ouvert et le reçu : incrément d’une copie, conservation de la première acquisition et de la date d’une variante déjà possédée, enregistrement de l’identité du crédit. Un abort annule l’ensemble.

La promesse de mutation n’est résolue qu’à `transaction.oncomplete`, jamais au succès d’une requête `put`. Aucune attente de réseau, animation ou minuterie dans la transaction. Durabilité `strict` demandée pour les écritures, avec repli sur une transaction standard si le moteur ne reconnaît pas cet argument.

Deux commandes identiques donnent une application puis un résultat `duplicate`. Deux identifiants différents pour le même tour résolu ne donnent pas deux pays trouvés. Deux ouvertures du même coffre ne donnent qu’un crédit. Le résultat de `openChest` indique un crédit déjà appliqué à la collection interne : un futur appelant ne doit pas le réappliquer ailleurs hors transaction.

Si la confirmation est perdue après commit, une nouvelle connexion retrouve le coffre et sa carte. Le rejeu du même identifiant ne retire aucune carte au sort et ne recrédite pas une ouverture. Les cartes, reçus et quotas persistent après fermeture/rechargement tant que le navigateur conserve la base.

## Erreurs et cycle de vie

`RewardStorageError` expose `code`, `cause` et `committed` : indisponibilité, ouverture échouée/bloquée, schéma incompatible, état canonique absent/invalide, commande conflictuelle, abort, quota, erreur de contrainte ou connexion fermée. Les erreurs rejettent la promesse ; aucune récompense n’est renvoyée comme nouvellement enregistrée.

Un échec de confirmation connu après `oncomplete` est signalé `ACKNOWLEDGEMENT_FAILED`, `committed: true`, pour distinguer ce cas d’un abort. Une vraie interruption du processus peut laisser le résultat inconnu au client : la récupération par identifiant reste la règle.

Une version supérieure n’est jamais rétrogradée ; un document canonique absent n’est jamais recréé silencieusement. Les stores et leurs clés sont contrôlés. `versionchange` ferme la connexion, afin de permettre une évolution future ; le code appelant devra rouvrir/recharger. Une ouverture bloquée échoue clairement et ferme une éventuelle connexion obtenue tardivement.

Le paramètre facultatif `transactionProbe` est un point de test **synchrone**, aux étapes `staged` et `committed`. Il n’est pas nécessaire au fonctionnement normal. Les tests l’utilisent pour déclencher un abort après des requêtes réussies, une véritable erreur native de contrainte, une erreur de quota injectée ou une perte de confirmation contrôlée.

## Tests et fidélité des simulations

`npm test` comprend les tests antérieurs, les règles pures et les erreurs d’ouverture du dépôt. Les erreurs sans moteur sont testées avec de petits doubles : absence/refus de stockage, erreur d’ouverture asynchrone, blocage avec connexion tardive et import du module sans accès au stockage.

`npm run test:browser` inclut `tests/repository.mjs` sur un IndexedDB **natif**, avec deux pages et connexions partageant le même profil/origine. Une page HTML de test isolée charge uniquement le dépôt à la demande. Le serveur de test sert désormais `.mjs` avec le type JavaScript.

Scénarios :

- Même réponse simultanée, même tour sous deux identifiants, tours différents atteignant le seuil : une attribution au seuil partagé et aucune perte d’incrément.
- Deux prétendants au deuxième coffre, maintien du plafond et absence de réserve.
- Bonne et mauvaise réponse simultanées : résultat identique à l’ordre transactionnel des règles pures.
- Même coffre ouvert simultanément : une copie ; coffres différents ouverts simultanément : toutes les copies conservées.
- Abort natif après les écritures réussies, ouverture avortée, erreur native de contrainte : tous les champs et reçus restaurés à l’état antérieur.
- Commit suivi d’une confirmation perdue, puis reprise sur une autre connexion : carte fixe, pas de nouvelle attribution ni copie.
- Erreur de quota injectée et stockage refusé : rejet explicite et état précédent conservé.
- Nouvelle page avec coffre scellé, ouverture après minuit, nouvelles attributions UTC, copies et dates préservées, export cohérent et instantanés indépendants.
- Bornes des raretés via le dépôt ; les 10 000 intervalles probabilistes restent vérifiés dans les règles pures.
- Connexion fermée avant l’opération, évolution native vers une version future, état canonique manquant : aucune écriture/réinitialisation cachée.
- Toutes les clés et valeurs exactes des sauvegardes v1 fictives sont inchangées.

Après les scénarios valides, les tests rapprochent quotas et coffres attribués, ouvertures et crédits uniques, ainsi que chaque compteur de collection avec les crédits effectivement enregistrés. Les profils sont temporaires, Supabase reste simulé et aucune sauvegarde réelle de joueur n’est lue.

Un abort et une erreur native de requête sont testés réellement. Le refus/quota et la perte de confirmation sont injectés ; **ils ne constituent pas un test de disque physiquement plein ou de panne matérielle**. Fermer une page et rouvrir la base teste une reprise normale, pas une coupure d’alimentation. Une éviction du navigateur, un arrêt brutal de son processus ou une perte disque après `complete` ne sont pas simulés fidèlement ici. La durabilité stricte ne justifie aucune promesse de sauvegarde absolue.

## Limites et prochaines étapes

Ce dépôt ne possède encore ni migration/import v1, ni interface, ni logique Daily, ni activation dans le jeu. Le catalogue et les identifiants restent fournis par l’appelant. Leur honnêteté n’est pas garantie contre un client volontairement modifié.

Les reçus et tours sont conservés sans suppression pour préserver l’idempotence. Leur volume augmente avec l’entraînement ; une politique de rétention basée sur sessions/séquences et refus des anciennes commandes reste à concevoir avant un nettoyage. Les supprimer simplement rendrait des réponses rejouables.

Les versions du schéma sont explicites, mais aucune migration vers une version supérieure n’est implémentée. L’export conserve l’état, mais aucune fonction d’import/restauration ni sauvegarde externe automatique n’est ajoutée. Ces points, la récupération des anciennes données et les anciens onglets relèvent des étapes suivantes après validation.

Validation de 4B.2 : **51 tests Node et 1 419 assertions HTTP sous Chromium réussis**, dont 195 assertions du dépôt natif. Firefox/WebKit et Safari sur appareil réel ne sont pas validés dans cet environnement. L’export autonome du jeu absent n’est pas testé ; l’export JSON du dépôt est testé.
