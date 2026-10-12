# Carte de résultat dans une fenêtre

Branche : `ui/result-modal`. Publication autorisée par le joueur après réussite des vérifications.

La section existante `#result`, ses champs et ses boutons sont conservés une seule fois, dans `#resultDialog`. Le calcul de la réponse, le choix du fait, le score, les récompenses et leurs gestionnaires restent ceux du jeu. Le défilement temporisé vers le résultat est supprimé ; le comportement du pays suivant et des fins de partie est conservé.

La fenêtre native assombrit légèrement le fond et apparaît en 180 ms, sans animation si le joueur préfère les animations réduites. La croix et Échap ferment sans changer le tour. « Revoir le résultat » / « View result again », sous la carte, rouvrent le même résultat. La région de texte défile intérieurement seulement quand elle dépasse l’espace disponible ; les actions et la croix restent hors de cette région. En petit paysage, les actions sont côte à côte.

Le focus arrive sur le titre. Tab/Shift+Tab restent dans la fenêtre, avec une région de texte accessible au clavier. La fermeture restaure le focus antérieur s’il est encore visible, ou le bouton de réouverture. Le corps de page est temporairement fixé à sa position ; ses styles et les coordonnées de défilement sont restaurés à la fermeture, sans toucher au viewBox ou aux gestionnaires de la carte. La lecture repart en haut à chaque ouverture, notamment après une longue anecdote.

Le bouton suivant ferme la fenêtre avant d’appeler la logique existante. Le résultat ne se rouvre pas sur un simple rerendu ou rafraîchissement des récompenses. Les fenêtres de collection, coffres et aide referment le résultat avant de s’afficher. Le repli de partage par copie manuelle ferme temporairement le résultat ; à la fermeture de la copie, le même résultat est restitué si le joueur est toujours au même tour. La confirmation de copie existante rejoint temporairement la carte pour rester visible dans la couche modale, puis retrouve son emplacement habituel.

Fichiers produit : `index.html`, `style.css`, `app.js`, `i18n.js`. Les tests historiques utilisent la croix et le bouton de réouverture lorsqu’ils doivent inspecter la carte ou agir depuis le résultat. Les fichiers de score, carte, musique/effets, stockage, récompenses et Supabase ne sont pas modifiés.

Captures vérifiées HTTP 200 et image/png : [galerie](https://github.com/Geofact/GeoFact/tree/28d4fc9c6276291113bcf01a02070611ca12f37d). PNG sur ordinateur FR/EN, mobiles 320 et 375 px FR/EN, petit paysage et état fermé avec réouverture. Cette branche distincte contient uniquement des fichiers de revue ; elle ne déploie pas le site.

Limites : Chromium ordinateur et émulation tactile, aucun téléphone Android/iPhone physique disponible. Exécutable WebKit absent. Le partage système est simulé ; l’affichage de la feuille système native et les particularités de focus/défilement de Safari restent à confirmer sur appareil réel. Supabase est intercepté avant les navigations.

## Validation finale

96 tests Node, 3 340 assertions de la suite navigateur HTTP complète et 21 assertions de redémarrage réel Chromium réussis. Les 603 assertions ciblées de la fenêtre et les 406 assertions du vert permanent ont aussi été exécutées séparément. Contrôles visuels à 320/375/390/1280 px et 568×320 ; les quatre liens PNG principaux ont été téléchargés et vérifiés HTTP 200, type image/png et dimensions attendues. Les tests de stockage et statistiques utilisent des données fictives et Supabase simulé.

Corrections issues de la revue : les actions et la croix restent hors de la région de texte défilante ; la confirmation de copie reste dans la couche visible ; chaque ouverture remet la lecture en haut. Les tests historiques ferment/réouvrent explicitement la fenêtre avant de toucher les commandes ou survoler la carte, sans modifier la logique du jeu.
