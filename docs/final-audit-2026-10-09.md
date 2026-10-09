# Audit avant publication — 9 octobre 2026

## Périmètre

Branche `test/http-save-regressions`, étapes précédentes conservées. Audit et corrections de régressions uniquement : aucune fusion, aucun push, aucun déploiement, aucune requête Supabase réelle. La référence locale `origin/main` reste `0e95cfa0247c4dc134f5353fcfa3c76d64bca729`.

## Fichiers modifiés

`app.js`, `index.html`, `style.css`, `i18n.js` ; imports versionnés dans `reward-repository.mjs`, `daily-rewards.mjs`, `legacy-rewards.mjs` ; `package.json`, `tests/browser.mjs`, nouveaux `tests/release-audit.mjs` et `tests/release-audit.test.mjs` ; `README.md`, `tests/README.md` et ce rapport.

## Corrections

1. **Daily bloqué par le journal d'entraînement.** Un accès refusé à sessionStorage ou un journal temporaire illisible renseignait l'erreur générale des récompenses. Le Daily pouvait alors refuser son enregistrement malgré un IndexedDB sain. Les erreurs d'entraînement sont désormais séparées ; la récupération Daily fonctionne également si ce journal demeure illisible. Le journal et les sauvegardes ne sont pas effacés.
2. **Récupération Daily désactivée.** Après échec d'écriture du résultat, le dernier rendu pouvait laisser « Réessayer » désactivé parce que l'opération était encore marquée occupée. Les contrôles sont recalculés dès sa fin. Le test provoque une erreur de quota, restaure le stockage et réessaie directement, sans changement de langue préalable.
3. **Cache incompatible.** La reproduction avec le `map.js` d'origin/main produit `map.clearFound is not a function`. Toutes les entrées JS/CSS et toutes les dépendances des récompenses utilisent désormais une version cohérente `20261009-audit1`. Un test simule des ressources incompatibles aux anciennes URL et vérifie le démarrage, le voisinage et le vert permanent aux nouvelles URL. Le HTML doit néanmoins être rafraîchi pour recevoir ces URL.
4. **Action de coffre vide.** Le style historique `.collection-link` imposait `display:block!important` et annulait le masquage du nouveau bouton bonus. Une règle ciblée respecte son état `hidden`, sans changer le style visible. Tests avant attribution et après la dernière ouverture.
5. **Textes et métadonnées incohérents.** Libellés accessibles traduits FR/EN, mention des cartes verrouillées compatible avec les coffres bonus, confirmation d'enregistrement qui ne prétend plus qu'une nouvelle carte était déjà possédée. Canonical et images sociales utilisent le domaine déclaré dans CNAME : `geofact.app`.

Aucun changement des scores, distributions, quotas, tables géographiques ou anciennes clés de sauvegarde. Les seuls changements des modules Daily/import/dépôt sont leurs URL d'import versionnées.

## Validation

- `npm test` : **71 tests Node réussis**. Toutes les suites antérieures plus contrôle intégral des clés/paramètres FR/EN, contenu bilingue des 195 pays, métadonnées, assets et versions des modules.
- **HTTP Chromium : 1 905 assertions réussies**, sans erreur JavaScript, ressource locale manquante ou requête externe imprévue. Exécution complète terminée avec code de sortie 0.
- Audit ciblé : **256 assertions réussies**, incluant contrôles globaux d'erreurs et de requêtes, huit dimensions (320×568, 360×640, 375×667, 390×844, 430×932, 568×320, 768×1024, 1280×800), FR/EN, sélection personnalisée, anecdote, tris de collection et ouverture bonus.
- Inspectées visuellement : captures d'accueil FR/EN et coffre bonus à 320 pixels. Ces captures ne remplacent pas une validation physique sur mobile.
- La suite complète couvre partie classique, difficultés, entraînement, Daily, défis, collection, partage, langues, gestes de carte, animations et réduction des animations. Elle contrôle seuils 9/10/11, erreur, deux coffres/jour UTC, pause/reprise, progression et coffres après rechargement, carte fixée, crédit unique, deux onglets, quota, abort natif et confirmation perdue.
- Migration : formats anciens et actuels fictifs, copies/raretés/dates/historiques, import répété et simultané, refus des données malformées, anciennes clés inchangées, ancien onglet divergent sans fusion automatique. Aucun profil réel lu.
- Probabilités bonus : Classic 62,25 %, Silver 25 %, Gold 10,5 %, Shiny 2,25 % ; seuils déterministes vérifiés. Formule Daily comparée à l'ancienne pour tous les scores entiers, sans modification.
- Géographie : vert calculé après animation puis retour normal ; Guyane, Alaska, Hawaï, marqueurs ; table terrestre symétrique, enclaves, cas contestés et exclusions maritimes. Sources/conventions conservées dans `data/borders.md`.
- Supabase : RPC, paramètres, événements et traitement de panne vérifiés par interception avant navigation. Autres réseaux bloqués. Aucun événement de test transmis. Cela ne valide pas les permissions/disponibilité du serveur réel.
- Secrets : aucun motif de clé privée ou credential privilégié détecté dans les fichiers client examinés ; la clé Supabase existante est explicitement `sb_publishable`. Aucun fichier de credentials trouvé parmi les fichiers suivis. Ce contrôle statique ne constitue pas un audit exhaustif du backend.
- WebKit : lancement tenté, impossible car `webkit-2359/pw_run.sh` absent. Firefox non installé/non exécuté. Safari/iPhone réel non testé.
- Hébergement : lecture HEAD de geofact.app et lecture GitHub Pages empêchées par la politique réseau de l'environnement (proxy CONNECT 403 / Forbidden by network). Ne pas interpréter ce 403 comme une panne du site. Configuration Pages, DNS, certificat, MIME `.mjs` et cache réels non certifiés ici.
- Export autonome historique `GeoFact.html`/`export.py` absent dès le début : non testé, sans nouvelle fonctionnalité d'export ajoutée.

Les premiers essais des nouveaux tests ont été corrigés pour attendre l'écran de jeu, fixer explicitement la langue et éviter une injection sessionStorage sur about:blank. Ces erreurs de harnais ne sont pas des bugs du jeu. Les régressions produit ci-dessus sont reproduites par les tests définitifs.

## Performances et risques

Mesures locales Chromium, données synthétiques, sans limitation CPU/réseau, en parallèle d'autres tests : disponibilité initiale approximative 1,07 s, DOMContentLoaded 0,86 s. Ce ne sont pas des mesures de débit mobile ou de geofact.app.

| Reçus synthétiques | Lecture complète médiane (5 lectures) | Écriture d'une réponse | Taille JSON du snapshot |
| --- | ---: | ---: | ---: |
| 1 000 | 31 ms | 9 ms | 76 327 octets |
| 10 000 | 121 ms | 24 ms | 776 827 octets |
| 50 000 | 308 ms | 9 ms | 3 941 827 octets |

Les lectures `getAll` et le clonage coûtent davantage à mesure que les reçus s'accumulent ; les écritures ciblées restent rapides dans cet échantillon. Aucune purge ajoutée : supprimer des reçus sans protocole permettrait le rejeu d'anciennes commandes. Si l'usage augmente, privilégier une lecture de résumé pour l'interface, puis concevoir une rétention sûre séparément. Les tailles synthétiques ne sont pas une estimation exacte du stockage disque.

Le client utilise `structuredClone`, `Object.hasOwn` et les dialogues natifs sans polyfills complets : les anciens Safari, notamment avant 15.4, ne constituent pas une cible validée. BroadcastChannel et la durabilité stricte ont leurs replis, sans garantir l'absence de particularités WebKit.

Risques restant : éviction/quota IndexedDB, mode privé et particularités Safari, perte des nouveaux gains si le profil est effacé (les anciennes clés sont figées), fermeture avant commit sans commande durable, journal illisible nécessitant intervention manuelle, divergences d'anciens onglets sans fusion. Les tests d'abort/ACK perdue ne simulent pas une panne électrique ou un véritable disque plein.

UTC et données dépendent du navigateur : l'horloge et les cartes restent modifiables, sans antifraude absolue. Transaction locale et télémétrie réseau ne sont pas atomiques : une fermeture après commit peut omettre un événement public sans perdre la récompense.

Un rollback vers l'ancien client localStorage masquerait les gains acquis depuis migration. Préparer un correctif conservant la lecture IndexedDB plutôt que revenir aveuglément à cette ancienne version ; ne supprimer ni stores ni anciennes clés.

## Avis et vérifications manuelles

**Non prêt à publier sans réserve.** Tous les tests Node et Chromium HTTP passent et aucun blocage connu ne subsiste dans ce périmètre ; toutefois, Safari/iPhone et la configuration effective de production sont des points de validation encore ouverts. Aucun nouveau système de migration/export/purge/comptes n'est demandé pour les lever.

Avant accord de publication : tester Safari récent sur iPhone physique (petit écran, paysage, gestes, rechargement, deux onglets, coffre différé, réduction des animations, erreurs de stockage), Chrome Android réel, lisibilité/focus/fermeture des fenêtres, partage natif. Utiliser un profil fictif avec les deux RPC interceptés avant le chargement. Vérifier séparément dans les consoles GitHub/Supabase les permissions RPC, protections des tables et configuration Pages/DNS/HTTPS, sans envoyer d'événement fictif.

## Procédure future — ne pas exécuter sans validation

1. Examiner ce rapport et lever les vérifications précédentes. Faire confirmer l'autorisation de fusion **et** publication : si Pages suit main, la fusion déploie automatiquement.
2. Dans GitHub, vérifier Settings → Pages : branche/source et répertoire (main / racine si publication par branche), domaine geofact.app et HTTPS. Aucun workflow Actions de déploiement n'est fourni dans ce dépôt ; si la configuration réelle diffère, établir sa procédure avant fusion.
3. Après validation, `git fetch origin`, vérifier la branche de développement et les nouveautés de main ; résoudre les conflits sur la branche de développement. Relancer `npm test` et `npm run test:browser` sur le candidat final, avec Playwright installé et Supabase simulé.
4. Après validation, pousser `test/http-save-regressions`, créer une PR vers main, contrôler le diff et la configuration déclenchant Pages, puis fusionner la PR autorisée. Ne pas utiliser de force-push.
5. Suivre la construction GitHub Pages jusqu'au succès ; ne pas ajouter de déploiement manuel parallèle. Si le site utilise un autre mécanisme que cette source Pages, employer uniquement le mécanisme préalablement vérifié.
6. Vérifier HTTPS, CNAME/canonical, réponse HTML nouvelle et version `20261009-audit1` de toutes les ressources, MIME JavaScript des `.mjs`, aucun 404 ni exception. Tester avec cache froid puis profil déjà chargé, sans effacer ses sauvegardes.
7. Faire le smoke test FR/EN, ancienne collection fictive, Daily, entraînement, bonus et ouverture/rechargement avec interception Supabase active avant navigation. Confirmer la préservation des anciennes clés et l'unicité des crédits. Surveiller les erreurs et conserver le correctif de retour compatible IndexedDB.

Aucune des étapes de publication n'a été exécutée pendant cet audit.
