# Données GeoFact

- `countries.js` contient les 195 pays, leurs noms FR/EN, capitales, coordonnées, difficulté et continent de classement.
- `borders.js` contient les paires de frontières terrestres et leur index symétrique ; sources, conventions et maintenance dans `borders.md`, licence dans `BORDERS-LICENSE.txt`.
- `facts.js` contient les 201 faits utilisés après une bonne réponse.
- `flag-cards.js` contient les 195 textes de cartes de drapeau FR/EN et une URL source d’audit pour chaque pays.

Les cinq valeurs du champ continent dans les données sont : Afrique, Amériques, Asie, Europe et Océanie. Pour garder un classement simple et exclusif, les pays transcontinentaux sont affectés à un seul groupe de jeu.

Les capitales ont été reconstruites à partir de la base mledoze/countries (ODbL), puis adaptées aux besoins de GeoFact. Les faits de jeu proviennent du corpus GeoFact restauré ; les sources d’audit des cartes de drapeau sont conservées directement dans `flag-cards.js`.

L’album présente six continents en séparant les Amériques en Amérique du Nord (23 pays) et Amérique du Sud (12 pays), sans changer ces données. Totaux, conventions transcontinentales et présentation des récompenses : [documentation de l’album](../docs/continent-album.md).
