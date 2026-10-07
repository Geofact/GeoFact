# Données GeoFact

- `countries.js` contient les 195 pays, leurs noms FR/EN, capitales, coordonnées, difficulté et continent de classement.
- `facts.js` contient les 201 faits utilisés après une bonne réponse.
- `flag-cards.js` contient les 195 textes de cartes de drapeau FR/EN et une URL source d’audit pour chaque pays.

Les cinq groupes de continent utilisés dans l’album sont : Afrique, Amériques, Asie, Europe et Océanie. Pour garder un classement simple et exclusif, les pays transcontinentaux sont affectés à un seul groupe de jeu.

Les capitales ont été reconstruites à partir de la base mledoze/countries (ODbL), puis adaptées aux besoins de GeoFact. Les faits de jeu proviennent du corpus GeoFact restauré ; les sources d’audit des cartes de drapeau sont conservées directement dans `flag-cards.js`.
