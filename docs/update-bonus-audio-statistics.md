# Mise à jour depuis ec24462 — audit et changements locaux

Branche : `feat/bonus-modes-audio-preferences`. Aucun déploiement, aucune fusion et aucune modification de Supabase pendant cette intervention.

## Changements fonctionnels

- Sous-titre exact FR : « Joue sans limite, obtiens des coffres bonus ». EN : « Play without limits, earn bonus chests ».
- Série bonus partagée entre entraînement par difficulté, partie Défis de cinq pays et défi ouvert depuis un lien. Les listes personnalisées ne progressent ni ne réinitialisent cette série. Le Daily reste indépendant. Plafond commun de deux coffres attribués par journée UTC ; probabilités inchangées : Classic 62,25 %, Silver 25 %, Gold 10,5 %, Shiny 2,25 %.
- Les commandes et reçus gardent leurs identifiants stables. Le mode est ajouté aux nouveaux reçus pour interdire la réutilisation d'une opération sous un autre mode. Les anciens reçus sans mode sont interprétés comme `practice`. Aucun changement de schéma IndexedDB, de version d'état ou de clés historiques.
- Les coffres, cartes et séries acquis avant cette mise à jour sont conservés, même s'ils provenaient d'une ancienne liste personnalisée. Une commande historique en attente marquée `practice` reste rejouable : l'ancien format ne permet pas de connaître sa liste d'origine. L'exclusion s'applique aux nouvelles réponses personnalisées. Un onglet resté ouvert sur l'ancienne version garde son ancien code et peut encore compter sa liste personnalisée ; lors d'une future publication, recharger les onglets est nécessaire. Le format historique ne permet pas de les reconnaître sans une migration plus intrusive.
- Fin d'une partie Défis : attendre l'enregistrement des réponses bonus avant de quitter le dernier tour. En cas d'erreur, le résultat reste récupérable avec le mécanisme existant ; aucune récompense non enregistrée n'est annoncée.
- Accès « Voir ma collection » / « View my collection » après attribution et dans le dialogue des coffres, avant ou après ouverture. Voir la collection n'ouvre pas un coffre. L'ouverture transactionnelle reste l'unique crédit bonus. Si le joueur rejoint la collection pendant l'animation, elle est rafraîchie après le commit, sans crédit anticipé ni nouvelle ouverture.
- Carte Collection : transition de survol cohérente avec les cartes voisines, réservée au pointeur précis ; déplacement et transition supprimés avec mouvement réduit.
- Sons synthétisés par Web Audio, sans bibliothèque ou ressources externes : bonne réponse, mauvaise réponse, carte révélée avec mélodies Gold/Shiny distinctes. Activés par défaut ; bouton 44×44 avec libellé traduit et état accessible. Coupure immédiate, mémorisée dans `gf-sound-v1`, propagée entre onglets. Reprise de l'AudioContext dans le geste utilisateur, prise en charge de `webkitAudioContext` et du contexte interrompu. Échec audio sans effet sur le jeu. Survol, réponses ignorées, consultation et nouveau rendu ne déclenchent pas de son.
- Langue : conservation de `wg-lang` et de la détection du navigateur sans préférence. Traduction du balisage pendant son analyse, avant la fin du chargement du jeu, pour limiter un affichage dans la mauvaise langue. Changement de langue appliqué aux cartes agrandies et aux messages de statistiques en attente/en erreur. Secours en mémoire lorsque le stockage est refusé.

## Ce que représentent les 21 visiteurs

Sources de cet audit : code client publié `ec24462`, deux fonctions SQL et contraintes collées par le propriétaire, tests HTTP avec Supabase simulé. Aucune lecture des lignes de production, aucun événement de test envoyé et aucune modification de base. Le SQL collé mélange les deux définitions ; l'analyse porte sur leurs corps distincts, pas sur l'exécution de ce texte comme script.

La fonction `geofact_stats` fournie calcule exactement :

| Affichage | Calcul SQL |
| --- | --- |
| Visiteurs uniques | `count(distinct visitor_id)` parmi les événements `visit` |
| Joueurs uniques | Identifiants distincts parmi `game_started`, `daily_started`, `daily_completed`, `challenge_completed` |
| Daily commencés / terminés | Nombre de lignes de chaque type |
| Coffres ouverts | Nombre de lignes `chest_opened` ; le client l'envoie pour la révélation Daily, pas pour les bonus |
| Défis terminés | Nombre de lignes `challenge_completed` ; le client l'envoie pour toute partie de cinq pays hors Daily, même sans lien partagé |

Le client transmet `period_days:30` par défaut, ou `0` depuis « Depuis le début ». SQL : zéro = toutes les lignes ; trente = fenêtre glissante `now() - interval '30 days'`, et non trente jours calendaires UTC. Tout autre paramètre ne sélectionne aucune ligne. Le propriétaire observe 21 sur les deux périodes : cohérent si tous les identifiants ayant une visite sont présents dans cette fenêtre. Cela n'implique ni duplication ni erreur SQL.

**Si 21 est renvoyé par cette RPC, il représente 21 identifiants de navigateur ayant une visite, pas 21 personnes ni 21 comptes.** Un simple rechargement avec le même identifiant ne peut pas augmenter ce nombre. Le nombre est plausible, mais sa provenance exacte ne peut pas être établie sans les agrégats ou lignes de production. Le chiffre n'est pas remplacé.

### Identifiants et déclencheurs

Clé historique : `gf-anonymous-visitor-v1`, UUID encodé en JSON dans localStorage. Un même profil/origine le réutilise entre sessions. Navigateur différent, autre appareil, navigation privée terminée, stockage effacé ou changement d'origine (ancien domaine GitHub Pages, HTTP/HTTPS) peuvent produire une autre identité pour une même personne. Aucune identification humaine ou empreinte numérique n'est faite.

Déclencheurs existants :

- `visit` à chaque chargement de l'application, même sans jouer. Le SQL ne compte l'identifiant qu'une fois pour le total unique.
- `game_started` au début de l'entraînement normal, personnalisé et des Défis ; `daily_started` au début d'un Daily. Les démarrages sont des événements, pas des réponses.
- `daily_completed` uniquement après le commit gagnant du Daily ; `chest_opened` uniquement après la première révélation enregistrée de ce Daily.
- `challenge_completed` à la fin d'une partie Défis, liée ou non.
- Les ouvertures bonus n'ajoutent aucun événement Daily.

Les visites du propriétaire ne sont pas exclues. Plusieurs profils de test peuvent donc compter comme plusieurs visiteurs. Les tests automatisés de cette intervention interceptent toutes les requêtes Supabase et bloquent les autres requêtes externes ; ils ne contribuent pas au chiffre. Impossible de certifier les tests ou visites antérieurs réalisés hors de ce harnais. Un robot qui exécute JavaScript peut être compté ; un simple crawler HTML n'exécute pas l'appel de visite.

### Défauts et corrections côté client

1. **Stockage indisponible :** l'ancien client créait un UUID en mémoire et envoyait quand même une visite, même si sa sauvegarde échouait. Chaque chargement suivant pouvait alors produire un nouvel identifiant. Nouveau comportement : n'envoyer des événements que si l'identifiant est relu après écriture, ou si une identité sauvegardée valide existe. Quand localStorage est refusé, pas de télémétrie éphémère ; la télémétrie elle-même ne bloque pas le jeu ; langue et son restent utilisables en mémoire. Une erreur distincte d'import des récompenses garde ses protections existantes. Les données malformées ne sont pas supprimées.
2. **Premiers onglets concurrents :** lire, générer et écrire dans localStorage n'est pas une opération atomique entre onglets. Deux onglets peuvent créer deux IDs avant de constater l'écriture de l'autre. Nouveau comportement : sérialiser la création avec Web Locks quand disponibles, puis relire la clé dans le verrou. Les identifiants existants sont conservés. Sans Web Locks, le secours réutilise la clé et vérifie l'écriture, mais une course de première création reste possible ; aucune garantie absolue n'est annoncée.
3. **Réponses de périodes hors ordre :** une ancienne requête de trente jours pouvait écraser l'affichage après sélection de la période cumulée. Le client ignore désormais une réponse dont l'identifiant de requête n'est plus courant. Aucun comptage serveur n'est modifié.
4. **Présentation :** la note explique maintenant le comptage par identifiants de navigateur. « Coffres Daily ouverts » précise la portée réelle du compteur existant, sans y ajouter les bonus.

Les deux premiers défauts peuvent expliquer une partie des identifiants historiques ; **leur contribution aux 21 n'est pas prouvée**. Pas de suppression, fusion d'IDs, correction rétroactive ou remise à zéro.

### Fonction d'enregistrement et limites serveur

La fonction fournie refuse le UUID nul/zéro et les types non prévus, sérialise les événements d'un identifiant avec un verrou consultatif transactionnel et limite `game_started` et `challenge_completed` à vingt lignes par identifiant/type/jour UTC. Ces protections ne fusionnent pas deux UUID, n'excluent pas le propriétaire et ne reconnaissent pas les robots.

Contraintes communiquées : `PRIMARY KEY(id)` et `CHECK(event_type...)`. Elles ne dédupliquent pas les événements Daily ou `visit` par visiteur/jour. Le bloc `unique_violation` ne prouve donc pas cette déduplication. Un index unique supplémentaire pourrait exister sans figurer parmi les contraintes collées : à vérifier dans `pg_indexes`. Sans cet index, plusieurs démarrages Daily du même navigateur peuvent produire plusieurs lignes, tout en ne comptant qu'un seul visiteur unique. Les opérations de récompense IndexedDB gardent leur propre idempotence, indépendante de ces statistiques.

L'API utilise une clé **publishable**, destinée au client public. Un appelant peut inventer des UUID ; la limite de vingt événements par UUID ne bloque pas leur rotation. Le comptage n'est pas une mesure antifraude des humains. Droits SQL, RLS, index réellement installés, colonnes/défauts et logs ne sont pas disponibles pour certification. Aucune modification SQL n'est proposée à appliquer sans une décision distincte.

### Vérifications de production facultatives, en lecture seule

À exécuter manuellement dans Supabase pour compléter l'audit, sans afficher de UUID ni supprimer de lignes :

```sql
select * from public.geofact_stats(30);
select * from public.geofact_stats(0);
select event_type, count(*) as events, count(distinct visitor_id) as browser_ids,
       min(created_at) as first_event, max(created_at) as last_event
from public.geofact_events group by event_type order by event_type;
select indexname, indexdef from pg_catalog.pg_indexes
where schemaname = 'public' and tablename = 'geofact_events';
```

Ces requêtes ne permettent pas d'identifier combien de personnes se cachent derrière les identifiants. Aucun numéro affiché n'est corrigé sur la seule base du nombre d'amis contactés.

## Risques et vérifications manuelles

- Le stockage local est par origine et peut être évincé par le navigateur ou effacé par le joueur. Aucune migration de compte ou synchronisation Supabase n'est développée.
- Une réponse bonus enregistrée survit à la fermeture ; les tests transfèrent un état IndexedDB complet dans un nouveau contexte et vérifient aussi quatre fermetures/relancements réels de Chromium avec le même profil sur disque. Ce n'est pas une coupure physique d'iPhone. Une fermeture avant commit peut perdre une réponse non confirmée ; le secours des commandes en attente est toujours sessionStorage et ne survit pas nécessairement à la fermeture définitive de l'onglet. Ne jamais annoncer cette réponse comme un coffre enregistré.
- Le format historique ne permet pas de retirer rétrospectivement la série des listes personnalisées sans risquer des pertes ; choix retenu : conserver tout et appliquer la règle aux nouvelles réponses.
- Les reçus IndexedDB continuent de croître ; aucun élagage risqué ou changement de schéma n'est ajouté.
- Les sons sont optionnels techniquement : Safari, le mode silencieux, la sortie choisie ou l'autoplay peuvent empêcher leur restitution. À écouter sur appareil physique pour juger volume et confort, vérifier coupure immédiate, verrouillage/reprise et absence de son sur survol. Mouvement réduit n'est pas une préférence de coupure audio ; le bouton est indépendant et activé par défaut conformément à la demande.
- Vérifier sur iPhone la ligne de sous-titre, les gestes carte, les dialogues, les boutons et les langues. La validation WebKit et le résultat complet des tests sont consignés après exécution.


## Résultats finaux

- `npm test` : **85 tests Node réussis**. Seuils, erreurs, quota partagé, UTC, probabilités exactes (10 000 cases déterministes), compatibilité des reçus anciens, idempotence, préférences, audio et télémétrie.
- `npm run test:browser` : **2 142 assertions HTTP Chromium réussies**, ordinateur et mobile, FR/EN, avec et sans animations. Zéro exception JavaScript, ressource locale manquante ou requête externe imprévue. Supabase simulé avant chaque navigation.
- `npm run test:restart` : **21 assertions HTTP réussies**, quatre lancements réels de Chromium avec profil persistant temporaire, Supabase simulé. Les sauvegardes des joueurs ne sont jamais accessibles au test.
- Vérification du survol Collection : deux assertions supplémentaires réussies, mouvement normal et préférence réduite. Captures FR/EN examinées sur 320×568 ; bouton son 44×44, sous-titre 13 px, retour à la ligne naturel. La suite teste également 360, 375, 390, 430, 568×320, 768 et 1280 pixels.
- WebKit explicitement tenté : exécutable `webkit-2359/pw_run.sh` absent. **Safari/iPhone non certifié.** Le préfixe Web Audio, les états suspendu/interrompu/fermé et les erreurs sont testés avec un périphérique simulé ; écoute, volume réel, interruption iOS et gestes doivent être vérifiés sur téléphone.
- Export portable non testé : `GeoFact.html` et `export.py` sont absents du dépôt. La demande vise le navigateur HTTP.
- Comparaison à `ec24462` : géométrie SVG, carte, données géographiques/cartes, score et `CNAME` inchangés. Dépôt IndexedDB, import et règles Daily ne changent que leurs URL d'import versionnées. `git diff --check` propre. Pas de réinitialisation, de SQL exécuté, de fusion ou de publication.
