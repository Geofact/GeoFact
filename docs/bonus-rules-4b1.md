# 4B.1 — règles pures des coffres bonus

Module : `bonus-rules.mjs`. Il n’est ni chargé dans `index.html`, ni appelé par `app.js`. Aucun accès au navigateur, au stockage, au réseau ou à la collection réelle. Aucun aléa ni lecture de l’heure système : les paramètres sont fournis par l’appelant.

## API

- `createBonusState()` : état indépendant, version 1, progression 0 et registres vides.
- `bonusUTCDate(at)` : journée UTC à partir d’un entier de millisecondes Unix explicite.
- `bonusProgress(state, at)` : progression, quota et état suspendu pour cette journée ; aucune remise à zéro ni mutation.
- `rollBonusRarity(draw)` : valeur de tirage dans `[0, 1)`, probabilités en dix-millièmes : Classic 6225, Silver 2500, Gold 1050, Shiny 225.
- `pickBonusCard(catalog, countryDraw, rarityDraw)` : pays uniformément choisi dans un catalogue explicite de codes distincts ; aucune dépendance aux données du jeu.
- `applyBonusAnswer(state, command, catalog)` : retourne `{state, status, chest, credit}`. `credit` est toujours nul lors d’une attribution.
- `openBonusChest(state, command)` : retourne le nouvel état et, pour une première ouverture, une instruction de crédit de carte unique. N’ajoute rien à une collection elle-même.

Commande de réponse : `{id, roundId, mode, correct, at, countryDraw, rarityDraw}`. Les tirages et le catalogue ne sont requis que lorsque cette réponse obtient un coffre. Seul `mode: 'practice'` agit sur le modèle.

Commande d’ouverture : `{id, chestId, at}`. Une ouverture inconnue ou antérieure à l’obtention échoue explicitement. Un coffre existant n’a aucune date d’expiration.

## Identités, temps et règles

`id` identifie une opération, `roundId` un tour logique. Ces identifiants sont stables et uniques dans l’ensemble de l’historique, sessions comprises ; ils ne sont pas de simples compteurs remis à zéro à chaque partie. Leur génération et leur persistance sont à intégrer ultérieurement. Le coffre a l’identifiant déterministe `bonus:<id de la réponse attributrice>` et son crédit `credit:<identifiant du coffre>`.

Le registre des opérations empêche le rejeu d’une bonne réponse, d’une erreur ancienne ou d’une ouverture. Rejouer une attribution avec une nouvelle heure ou de nouveaux tirages renvoie la carte déjà fixée, sans changer sa date ou son quota. Réutiliser un identifiant pour une autre réponse, un autre tour, un autre coffre ou un autre type d’opération provoque une erreur. Les tours résolus protègent également contre un deuxième clic ayant un nouvel identifiant, y compris après un changement de jour.

Le registre mémorise les opérations sans effet reçues sur un tour résolu ou un coffre déjà ouvert. Les commandes d’autres modes ne changent aucun champ du modèle. Une erreur sur un tour encore actif remet toujours la progression à zéro ; une réponse sur un tour déjà résolu est ignorée, conformément à la protection contre les doubles clics.

Le dixième pays donne un coffre, remet la progression à 0 et incrémente le quota du jour UTC fourni. Le onzième repart à 1. Au deuxième coffre, les bonnes réponses suivantes ne constituent aucune réserve pour demain. Une erreur remet à zéro, même si un état importé contient une progression non nulle en suspension. La progression partielle survit au changement de jour et à une sérialisation/restauration ; après un plafond atteint normalement, elle reste 0 jusqu’à la reprise du lendemain. Les anciens quotas sont conservés si l’horloge revient sur une date passée.

Les pays n’ont pas à être distincts : les tours répétés en entraînement avec un seul pays comptent. Les dates d’obtention restent fixes à l’ouverture. Plusieurs vieux coffres peuvent être ouverts un même jour sans consommer ses deux attributions.

## Immutabilité et intégration future

Les fonctions ne modifient pas leurs entrées. Elles produisent de nouveaux enregistrements pour les changements et partagent les objets inchangés ; l’appelant doit traiter états, reçus et cartes comme immuables. Les tests emploient des entrées récursivement gelées. Les erreurs de validation ne réinitialisent jamais un état.

Le modèle marque logiquement le coffre ouvert et renvoie une instruction `{id, chestId, iso, rarity, acquiredAt}`. **En 4B.2, cette transition et l’application de ce crédit devront être confirmées dans une même transaction.** Enregistrer l’une sans l’autre serait incorrect. Un rejeu ne renvoie pas de nouvelle instruction de crédit. Une ouverture déjà confirmée permet de retrouver la carte fixée.

Les registres complets de ce modèle permettent les tests d’idempotence ; ils ne sont pas une prescription de stockage d’un gros instantané par clic. Le dépôt futur devra conserver les reçus nécessaires ou employer des sessions à séquences monotones et des refus explicites des anciennes commandes. Aucune suppression naïve de reçus qui rendrait un ancien gain rejouable. La politique de rétention et les transactions multi-onglets restent hors de 4B.1.

Ce module ne peut pas garantir l’unicité de deux écritures concurrentes issues du même ancien état, ni la persistance après fermeture. Il ne valide pas l’honnêteté de `correct`, de l’heure ou des identifiants fournis. L’adaptateur et le jeu devront assurer ces contrats ; une défense antifraude absolue n’est pas possible dans le client seul.

## Validation

`npm test` exécute les tests historiques et `tests/bonus-rules.test.mjs`. Les nouveaux contrôles couvrent seuils 9/10/11, erreurs et corrections, suspension, UTC/minuit, sessions et sérialisation, autres modes, identifiants et rejeux, absence d’expiration, crédits uniques, invalidités et absence de mutation.

Les probabilités sont vérifiées sur les limites exactes et sur 10 000 intervalles équiprobables déterministes : aucun test statistique aléatoire susceptible d’échouer par hasard.

`npm run test:browser` exécute l’intégralité des régressions HTTP des étapes 1–3, avec Supabase simulé. Le module bonus reste volontairement absent des écrans et du stockage pendant cette sous-étape.
