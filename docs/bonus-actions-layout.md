# Actions après un coffre bonus

Après révélation, deux actions restent sous la progression : explorer la collection du continent et voir le pays sur la carte. L’accès général à la collection est masqué pour éviter le doublon ; il reste disponible avant ouverture d’un coffre scellé. Son nœud et son écouteur sont conservés.

Deux colonnes égales sur ordinateur, une colonne jusqu’à 600 px, espacement de 12 px. Les boutons reprennent exactement les couleurs Daily #fae1cf et #294553 et les états existants. Les libellés longs se replient. Le défilement existant de la fenêtre garde les actions et la fermeture accessibles.

Aucun changement des destinations, cartes, tirages, raretés, progression, animations, récompenses, sauvegardes ou Supabase. Seules les URL des deux ressources modifiées reçoivent un paramètre de renouvellement du cache.

## Validation

- 1 210 contrôles navigateur pertinents passent : collection, coffres bonus, intégration des récompenses, actions et carte de récompense. Parmi eux, 518 contrôles ciblent cette disposition.
- FR/EN, 1280×900, 320×568, 375×667, 390×844, 568×320 et 1280×400 : alignements, couleurs, textes longs, survol/appui/focus, défilement, fermeture et destinations.
- Profils locaux isolés, coffres obtenus selon les règles normales ; RPC Supabase simulés. Aucune donnée de joueur ou limite en production modifiée.
- npm test, syntaxe JavaScript et git diff --check passent. Les tests existants utilisent désormais l’action continent visible après révélation, sans affaiblir les contrôles de récompenses et sauvegardes.
- Chromium et émulation mobile uniquement, sans test Safari ou iPhone physique.

[Captures réelles ordinateur et mobile, FR/EN et faible hauteur](https://github.com/Geofact/GeoFact/tree/549e4f3d3147c8bbb6c8cc6b7dcb79b3f0e7095a/docs/previews).
