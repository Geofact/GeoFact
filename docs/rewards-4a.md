# Phase 4A — conception des récompenses GeoFact

Statut : proposition à valider avant 4B. Aucun coffre bonus, changement de sauvegarde ou changement d’attribution n’est implémenté. Les étapes 1 à 3 restent intactes sur `test/http-save-regressions`.

## 1. Audit du comportement actuel

Référence : `app.js` dans le commit `30861c6`.

- `storage.write` intercepte toutes les exceptions sans renvoyer un résultat. L’appelant ne sait donc pas si une sauvegarde a échoué.
- Les objets collection et Daily sont chargés une fois par page. Aucune relecture avant modification ni coordination entre onglets.
- La normalisation en mémoire accepte le prototype `{rarity}` et reconstitue les listes et compteurs. Le chargement seul ne réécrit pas les clés ; une future attribution écrit ensuite toute cette collection normalisée.
- `awardDailyCard(score)` tire uniformément un pays parmi les cartes disponibles, tire la rareté, incrémente une copie, conserve `firstUnlocked` et les dates des variantes déjà possédées, puis écrit `gf-collection-v1`.
- À la fin des cinq pays, `next()` appelle cette attribution **avant** d’écrire le résultat et ses compteurs dans `gf-daily-v1`. Ces deux écritures ne sont pas une transaction.
- L’ouverture ne donne pas une seconde carte : elle révèle la carte déjà créditée. Le bouton est désactivé immédiatement ; après 4 650 ms (80 ms avec réduction des animations), `cardOpened` est enregistré, puis le dévoilement est affiché après une transition de 260 ms.
- Le double clic est protégé dans le même onglet ; cette protection ne couvre pas deux onglets, une ancienne copie en mémoire ou une écriture qui échoue.
- Après rechargement, consulter un Daily terminé active `viewingDailyResult`, qui masque coffre et révélation, même si `cardOpened` est faux. La carte reste dans la collection si sa première écriture a réussi.
- Le jour Daily est recalculé à la fin, et non attaché à la série au lancement. Une partie traversant minuit peut donc enregistrer la série de la veille sous la date suivante. Le sélecteur d’ouverture recherche également uniquement le jour courant.

Conséquences : deux fins Daily simultanées peuvent écraser des copies et résultats ; une interruption entre les écritures peut laisser une carte sans résultat Daily ; la panne inverse peut laisser un Daily enregistré sans copie sauvegardée. Une reprise peut relancer un tirage ou manquer un crédit. Ces risques sont déduits du code, pas de nouveaux tests de concurrence effectués en 4A.

## 2. Comparaison des architectures

| Option | Ce qu’elle résout | Limites et complexité |
| --- | --- | --- |
| Un objet JSON sous une seule clé localStorage | Une seule écriture évite la demi-sauvegarde entre les champs de cet objet. | Pas de transaction lecture–modification–écriture entre onglets : le dernier écrivain peut écraser le précédent. Un numéro de version suivi d’une relecture ne constitue pas un compare-and-swap. Insuffisant seul. |
| Web Locks + localStorage + journal idempotent | Un verrou commun sérialise les clients coopérants ; des identifiants empêchent de réappliquer un gain après reprise. | Verrou, journal, application, récupération et nettoyage à écrire et tester. Plusieurs clés restent non transactionnelles ; un journal durable est nécessaire si elles sont conservées. Avec une seule enveloppe atomique et des reçus intégrés, le journal séparé est évitable, mais tous les écrivains doivent toujours prendre le verrou. API absente/bloquée : aucun repli concurrent non verrouillé fiable. Une ancienne page ignore le verrou. |
| IndexedDB, petit dépôt transactionnel | Sérialisation des transactions d’écriture qui partagent le store d’état ; validation, progression, quota, coffre et crédit peuvent être atomiques. | API asynchrone, import initial et gestion d’erreurs nécessaires. Ne supprime ni quotas, ni effacement des données, ni anciens clients écrivant ailleurs. |

**Recommandation : IndexedDB avec trois stores et une seule source d’autorité pour les récompenses.** Pour les cas demandés, cela évite de développer un moteur de transactions maison. Aucun besoin de framework, de serveur de récompenses ni de journal de rejeu multi-clés. Les préférences, anecdotes, scores et autres données sans rapport restent dans leurs clés actuelles.

Web Locks avec une seule enveloppe et reçus intégrés est une alternative valide, potentiellement plus courte en code, si les navigateurs retenus le permettent et si tous les écrivains coopèrent. IndexedDB est recommandé pour ses transactions natives, son ordonnancement et son stockage structuré, pas parce que le volume actuel exigerait une grosse base. Ne pas cumuler les deux moteurs ni ajouter un journal applicatif multi-clés par précaution.

Références techniques : [transactions et ordonnancement IndexedDB, W3C](https://w3c.github.io/IndexedDB/#transaction-scheduling), [absence de verrouillage garanti de localStorage, WHATWG](https://html.spec.whatwg.org/multipage/webstorage.html), [Web Locks, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

## 3. Modèle proposé

- `state` : un enregistrement versionné contenant la collection existante, l’historique et les compteurs Daily, la progression bonus 0–9, les attributions bonus par date UTC, la révision et les informations d’import. Une sauvegarde brute d’import est conservée séparément sous une clé dédiée de ce même store.
- `chests` : identifiant unique, type Daily/bonus, date UTC d’obtention, instant d’obtention, carte fixée `{iso, rarity}`, état ouvert/non ouvert, indicateur de crédit et date d’ouverture. Identifiant Daily déterministe `daily:AAAA-MM-JJ` ; identifiant bonus unique créé à l’attribution. Aucune expiration des coffres non ouverts.
- `sessions` : identifiant de session d’entraînement, dernier numéro d’opération appliqué et état du tour courant. Ce reçu compact protège des reprises de la même action et des réponses répétées sur un tour déjà résolu, sans stocker éternellement chaque clic.

Chaque page possède une session distincte, même si un onglet dupliqué copie sessionStorage. Les actions d’une session sont ordonnées ; les doublons et numéros antérieurs sont rejetés. Une réponse ne peut pas être réémise sous un nouvel identifiant lors d’un rechargement. Les sessions inactives pourront être nettoyées après 30 jours ; une commande visant une session supprimée est refusée, jamais réenregistrée automatiquement. La progression globale ne dépend pas de la durée de vie des sessions.

Toute mutation passe par le même dépôt et une transaction `readwrite` incluant `state` et les stores concernés. Relecture de l’état dans la transaction, calcul pur, puis écritures : pas de fetch, d’animation ou de minuterie dans cette transaction. Attendre `transaction.oncomplete`, pas seulement le succès d’une requête, avant de confirmer un gain. Demander la durabilité `strict` quand prise en charge, sans promettre une résistance absolue à une panne physique.

BroadcastChannel et une relecture au retour au premier plan actualisent les autres onglets. Ces notifications améliorent l’affichage ; elles ne sont pas le verrou de sécurité. Deux résultats simultanés sont traités dans l’ordre des transactions : l’état persistant fait foi.

## 4. Règles bonus et temps UTC

La progression représente les bonnes réponses depuis la dernière erreur ou le dernier bloc de dix consommé, pas la série Daily. Tous les entraînements comptent, y compris un seul pays répété ; aucune exigence nouvelle de dix pays distincts.

1. Une mauvaise réponse en entraînement remet la progression à zéro. La prochaine bonne réponse la porte à 1, y compris si elle corrige le pays courant. Les autres modes ne la modifient pas.
2. Une bonne réponse sur un tour non déjà résolu ajoute 1. À 10 : création atomique d’un coffre, incrément du nombre obtenu pour ce jour UTC et retour à 0.
3. Après la deuxième attribution du jour : progression suspendue. Le jeu continue librement ; aucune réserve de points pour un troisième coffre.
4. À la première action du lendemain : quota de cette nouvelle date disponible. Aucun effacement de progression lors du changement de jour. Exemple : 7/10 avant minuit reste 7/10 ; après le deuxième coffre, 0/10 reste suspendu jusqu’au lendemain puis repart de 0.
5. Quitter, changer de difficulté ou recharger conserve le dernier état confirmé. Rien n’est accordé pour une simple visite ou un nouveau jour.

La date d’attribution est déterminée lorsque la commande est traitée dans la transaction, avec l’horloge UTC du client, puis conservée. Les plafonds sont enregistrés par date plutôt que remis à zéro par une minuterie. Cela évite les doubles remises à zéro et conserve le quota d’une date déjà visitée si l’horloge recule. Une commande en attente qui est traitée après minuit relève du nouveau jour. L’ouverture ne consomme jamais de quota et ne change jamais la date d’obtention.

Pour sécuriser le Daily dans le futur dépôt, attacher le jour et la série au lancement ; sa fin et son coffre restent associés à ce jour, même si la partie traverse minuit. Le coffre Daily reste indépendant du plafond des deux bonus. Ce correctif temporel fait partie du plan à valider, pas du code actuel.

## 5. Attribution, ouverture et raretés

**Bonus :** choisir et enregistrer la carte lors de l’obtention, sans encore l’ajouter à la collection. Le coffre reste non ouvert, carte immuable, sans expiration. À l’ouverture, une transaction vérifie son identifiant et son état, ajoute exactement une copie, conserve les dates historiques, marque le crédit et l’ouverture, puis confirme. L’animation existante est jouée ensuite. Une interruption de l’animation permet de revoir cette même carte ; elle ne permet ni nouveau tirage ni nouvelle copie.

Pour une nouvelle carte ou variante bonus, la date d’acquisition correspond à ce crédit à l’ouverture ; la date d’obtention du coffre reste distincte. Pour une variante déjà détenue, aucune date historique n’est remplacée.

**Daily :** préserver sa sémantique actuelle : carte créditée à la fin de la partie. La transaction unique enregistrera ensemble le résultat, le coffre et la copie. L’ouverture marquera seulement la révélation. Les anciens Daily non ouverts seront donc importés comme coffres déjà crédités ; leur ouverture n’ajoutera rien.

Une liste des coffres non ouverts, consultable entre sessions et après minuit, utilisera leur identifiant, jamais « le coffre d’aujourd’hui ». Les Daily historiques sans champ `card` ne doivent pas recevoir rétroactivement de récompense inventée.

Référence de rareté proposée pour les bonus : le tirage Daily à **50/100**, point médian du barème, sans prétendre connaître le score moyen réel des joueurs. Les formules actuelles donnent :

| Classic | Silver | Gold | Shiny |
| --- | --- | --- | --- |
| 62,25 % | 25 % | 10,5 % | 2,25 % |

Réutiliser le tirage existant avec cette référence fixe ; aucun changement des probabilités Daily. Pays uniformément choisi dans le même catalogue ; doublons autorisés et comptés. L’aléa utilise crypto quand disponible. Une opération échouée et jamais confirmée n’est pas une attribution ; une attribution confirmée n’est jamais retirée au sort.

Texte FR obligatoire : « Joue sans limite ! Trouve 10 pays d'affilée pour obtenir un coffre bonus. Jusqu'à 2 coffres supplémentaires par jour. »

Progression discrète 7/10, mention de suspension après 2/2, nombre de coffres disponibles. Réutilisation des animations coffre/carte et de leur mode réduit. Exemple EN proposé : “Play without limits! Find 10 countries in a row to earn a bonus chest. Up to 2 extra chests per day.” Aucun changement du design de carte ou du score.

## 6. Import, préservation et récupération

1. Détecter si un import a déjà été confirmé. Une panne d’ouverture IndexedDB n’est jamais interprétée comme une base vide.
2. Lire et conserver les octets exacts de `gf-collection-v1` et `gf-daily-v1`, ainsi que les champs inconnus. Les autres clés ne sont ni déplacées ni modifiées. L’absence d’une clé est distincte d’un JSON invalide ou d’une lecture interdite.
3. Valider sur une copie. Importer copies, variantes, `firstUnlocked`, dates de variantes, historique, compteurs et données de cartes Daily sans nouvel aléa. Le prototype `{rarity}` reçoit sa copie minimale historique, sans inventer de dates précises absentes. La normalisation des anciens scores concerne uniquement la copie importée ; le brut reste intact.
4. Si une donnée requise est illisible ou ambiguë : arrêter l’activation des nouvelles récompenses, conserver les données, proposer export/récupération. Ne pas importer silencieusement une collection vide. Les incohérences historiques déjà présentes ne permettent pas toujours de déterminer quelles copies ont été créditées ; les signaler plutôt que sommer arbitrairement collection et cartes Daily.
5. Une transaction d’import enregistre sauvegardes brutes, état canonique, coffres historiques et marqueur d’import. Deux onglets nouveaux se coordonnent par cette transaction : le second observe l’import effectué et ne le rejoue pas.
6. Relire et comparer compteurs, variantes, dates et Daily avant activation. Garder les deux anciennes clés inchangées, sans suppression ni miroir continu : elles constituent un instantané de retour, pas une deuxième source d’autorité.
7. Prévoir un petit marqueur de bascule distinct dans localStorage, écrit avant l’import puis confirmé après vérification. Il détecte une base canonique absente après activation ; il n’est pas une transaction inter-stockages. Un marqueur « en préparation » avec une base absente déclenche une vérification et une reprise explicite, pas une réinitialisation. Tout désaccord reste en mode récupération.

**Anciennes pages ouvertes :** IndexedDB ne peut pas empêcher l’ancien JavaScript d’écrire dans les clés v1. Activer la bascule seulement après fermeture/rechargement des anciennes parties ; vérifier que les sources n’ont pas changé pendant l’import et surveiller les événements `storage` sur les clés anciennes après activation. Archiver tout instantané divergent et suspendre les nouvelles écritures en cas de conflit. Ne pas remplacer la collection canonique par cet ancien état, ni additionner ses compteurs automatiquement. Sans coopération des anciens clients, une garantie absolue de migration concurrente est impossible ; c’est un critère de préparation de 4B.

**Après erreur :** une transaction avortée ne confirme aucun changement partiel. Réessayer la même commande identifiée après relecture. Une commande déjà appliquée retourne l’état confirmé et, si conservé, son résultat, sans nouveau crédit. Si IndexedDB est indisponible, garder le jeu accessible et les données lisibles en lecture seule, mais désactiver les nouvelles attributions/ouvertures et signaler que la progression n’est pas enregistrée. Conserver les commandes en mémoire pour une reprise ordonnée tant que la page reste ouverte ; un rechargement peut perdre une commande non confirmée. Aucun succès fictif de sauvegarde.

Prévoir export manuel de l’état canonique versionné et de la sauvegarde brute ; import validé avec aperçu, sauvegarde préalable et confirmation, jamais fusion aveugle de deux collections dont les récompenses peuvent être communes. Les anciens v1 seuls ne récupèrent pas les gains obtenus après la bascule. Une restauration complète exige un export récent ou une base encore lisible. Revenir au vieux code après activation doit donc être précédé d’une procédure de restauration/export, pas d’un simple retour de version JavaScript.

## 7. Tests requis avant activation en 4B

### Node — règles pures et import

- 9 → 10 donne un coffre ; 19 → 20 donne le second ; aucune troisième attribution ni progression mise en réserve.
- Une erreur remet à zéro ; correction suivante à 1 ; autres modes sans effet ; répétition d’un seul pays valide ; tour déjà résolu ignoré.
- Conservation 7/10 entre sessions, changements de difficulté et jours ; pause 2/2 puis reprise le lendemain.
- Quotas UTC aux limites 23:59:59 / 00:00:00, commandes différées, fuseaux différents, recul de l’horloge, ouverture de plusieurs anciens coffres le même jour.
- Seuils exacts du tirage avec RNG injecté et probabilité totale 100 %, plutôt qu’un test aléatoire instable.
- Import actuel/prototype/anciens scores, copies multiples et dates, champs inconnus, clés absentes, JSON invalide, valeurs incohérentes, Daily sans carte et Daily non ouvert déjà crédité.
- Migration répétée sans nouveau crédit, aucune modification des octets v1, validation des exports et versions inconnues refusées.

### Navigateur HTTP — transactions réelles et interruptions

- Deux pages partageant le même contexte/profil, réponse simultanée à 9/10, deuxième coffre au plafond, mauvais et bon clic concurrents : état conforme à un ordre transactionnel, jamais perte d’incrément ni dépassement.
- Double clic/tap natif et deux ouvertures simultanées du même coffre : une copie et un seul tirage ; ouvertures de coffres différents : deux copies conservées.
- Interruption avant transaction, après requête mais avant commit, après commit avant confirmation UI, pendant animation, puis rechargement/réessai du même identifiant.
- Import interrompu, deux migrations simultanées, upgrade `blocked` / `versionchange`, source v1 modifiée par ancien onglet, marqueur/base discordants et récupération sans effacement.
- Échecs IndexedDB, refus/quota, transaction avortée, localStorage interdit, panne d’export et données invalides : message clair, aucune carte imaginaire ni écrasement.
- Coffre obtenu avant minuit, ouvert après minuit ou plusieurs jours après ; rechargement avec coffre non ouvert ; Daily commencé avant minuit et fini après ; anciens Daily ouverts/non ouverts.
- Sessions dupliquées, réponses rejouées, session expirée, reprise après retour au premier plan, notifications perdues et relecture indépendante.
- Comparaison intégrale collection/Daily avant/après import et erreurs : copies, variantes, dates, historique et champs supplémentaires.
- Animations existantes et mouvement réduit, français/anglais, ordinateur/mobile, puis toutes les régressions des étapes 1–3. Supabase toujours simulé ; aucun nouveau contrat de statistiques introduit implicitement.

Exécuter les suites Node et HTTP sur Chromium, puis Firefox et WebKit si disponibles ; prévoir Safari sur appareil réel avant publication future. Des doubles de stockage sont utiles pour injecter des erreurs, mais ne remplacent pas les transactions multi-pages sur le moteur réel. Les tests 4B sont prévus, **pas déjà exécutés ni prouvés en 4A**.

## 8. Limites de sécurité et conservation

Ce système protège surtout contre les erreurs, doublons et courses entre clients coopérants du même navigateur/origine. Sans compte ni serveur faisant autorité, un joueur peut modifier l’horloge, les données, le code ou les appels, effacer son profil, changer de navigateur et rejouer les mêmes pays. Le plafond est local au profil/origine, pas universel par personne. Crypto améliore le tirage, pas la résistance aux manipulations du client. Ne pas utiliser Supabase public comme registre de récompenses.

IndexedDB n’est pas une sauvegarde externe : suppression des données du site, navigation privée, changement d’origine et éviction peuvent perdre la collection. Une demande de persistance, si retenue en 4B, peut être refusée et parfois demander une permission navigateur. L’export manuel reste la voie de sauvegarde indépendante. Références : [durabilité des transactions, MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction), [quotas et éviction, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

La télémétrie existante reste facultative et ne conditionne aucun crédit. Sans identifiant idempotent accepté par le serveur, « exactement un événement Supabase malgré toute interruption » ne peut pas être garanti ; les statistiques ne doivent jamais servir de preuve de propriété d’une carte.

## 9. Plan d’implémentation 4B, après validation

1. Figer les invariants ci-dessus et créer le modèle pur : progression, quotas UTC, reçus, coffre et crédit. Ajouter les tests Node déterministes.
2. Créer un dépôt IndexedDB restreint, gestion de version/erreurs, transactions et tests multi-pages. Vérifier qu’aucun composant UI ne conserve un état périmé pour écrire.
3. Préparer import/reprise/export, copies brutes, comparaison et garde contre les anciens onglets. Tester la migration avant tout branchement bonus.
4. Faire passer lecture collection, attribution Daily et révélation par le dépôt unique, en conservant cartes/score/probabilités et sans réécrire les clés v1. Fixer l’identité du jour Daily et restaurer les coffres non ouverts par identifiant.
5. Brancher uniquement les résultats d’entraînement sur les commandes persistantes ; compteur discret, plafond et reprise UTC ; pas de changement des pénalités ni de statistiques publiques nouvelles.
6. Ajouter la liste des coffres et leur ouverture idempotente, avec animations réutilisées après commit, texte exact et variante anglaise.
7. Exécuter tous les tests, injections d’erreurs et comparaisons de sauvegarde ; rendre un compte rendu avec limites réelles. Rester sur la branche de développement, sans fusion ni déploiement.

Critères de validation : aucun crédit doublé, aucune perte de compteur par course entre nouveaux onglets, maximum deux attributions bonus par date UTC, anciens octets conservés, aucun faux succès d’écriture, coffre confirmé récupérable après rechargement, règles de jeu et étapes 1–3 intactes. Aucune garantie de récupération si toutes les copies locales et externes ont été supprimées.
