# Album par continents et présentation des récompenses

## Catalogue et conventions

L’album calcule ses totaux à partir des pays de `data/countries.js` et des cartes réellement disponibles dans `data/flag-cards.js` : 195 identifiants identiques, tous affectés une seule fois. Aucune carte de territoire supplémentaire n’est créée. Les continents sans pays collectionnable ne sont pas proposés.

| Continent | Pays |
|---|---:|
| Afrique | 54 |
| Europe | 44 |
| Asie | 48 |
| Amérique du Nord | 23 |
| Amérique du Sud | 12 |
| Océanie | 14 |
| Total | 195 |

Le champ `continent` existant est conservé, sans modifier les modes de jeu ou la carte. Les Amériques sont séparées : Argentine, Bolivie, Brésil, Chili, Colombie, Équateur, Guyana, Paraguay, Pérou, Suriname, Uruguay et Venezuela constituent l’Amérique du Sud ; les autres pays du groupe existant forment l’Amérique du Nord, Caraïbes et Amérique centrale comprises. Cette convention continentale regroupe les sous-régions des Amériques décrites par [ONU M49](https://unstats.un.org/unsd/methodology/m49/).

Choix exclusifs repris des données GeoFact : Russie en Europe ; Turquie, Kazakhstan, Arménie, Azerbaïdjan, Géorgie et Chypre en Asie ; Égypte en Afrique ; Indonésie en Asie. France en Europe, États-Unis en Amérique du Nord : leurs territoires ultramarins, Alaska et Hawaï ne constituent pas de pays ou de cartes supplémentaires. Vatican en Europe et Palestine en Asie, comme avant. Il ne s’agit pas d’une modification des frontières ni du catalogue. Pour ajouter un pays à l’avenir, vérifier simultanément son groupe et sa carte ; le test d’exhaustivité vérifie l’absence de pays oublié ou dupliqué.

## Navigation et compteurs

L’ouverture de la collection affiche les six continents. Chaque compteur/barre représente les pays possédés, quelle que soit leur rareté ou leur nombre d’exemplaires. Les données anciennes sont lues directement : aucun compteur de progression distinct n’est sauvegardé ou réinitialisé.

Un continent conserve les cartes possédées et les emplacements nommés des pays absents. « Les continents » revient à l’accueil de l’album ; « Tous les drapeaux » conserve le parcours complet et les tris par nom, date, rareté et continent. Le détail continue de montrer les quatre raretés, les exemplaires et les textes de cartes. Le clavier et les traductions immédiates sont conservés.

## Récompenses et fidélité

`collection-album.js` fournit les calculs purs. Le dépôt utilise la collection canonique avant le crédit existant pour enregistrer une métadonnée optionnelle `discovery` : type (pays, rareté ou copie), continent, compte avant/après, total et nombre d’exemplaires. Aucun tirage, score, quota, événement Supabase ou calcul d’attribution n’est modifié. Les cartes elles-mêmes et les reçus de crédit gardent leur contenu actuel.

Le Daily crédite toujours à la fin de partie, avant sa révélation visuelle ; les coffres bonus créditent toujours lors de leur ouverture. La métadonnée est écrite dans la même transaction que ce crédit. Elle reste disponible après interruption, rechargement ou ouverture dans un autre onglet, sans recalculer un « nouveau pays » à partir d’un état déjà modifié. Aucun changement de version ni réinitialisation IndexedDB, aucune réécriture des anciennes clés localStorage, aucune migration supplémentaire.

Le continent affiche sa progression courante, y compris les autres cartes déjà créditées. Pour une première découverte, « À l’obtention : X → Y » décrit le passage réellement enregistré ; une autre carte obtenue ensuite ne falsifie pas ce passage. Les nouvelles raretés et copies ne montrent pas d’augmentation du nombre de pays. Un continent complété par cette carte reçoit une félicitation textuelle uniquement, sans récompense additionnelle.

Les coffres bonus anciens encore fermés bénéficient de la distinction lors de leur crédit. Certains anciens Daily déjà crédités ne contiennent pas les informations permettant de distinguer sûrement un premier pays d’une nouvelle rareté : leur affichage garde « Carte enregistrée dans ta collection », la progression réelle et l’accès au continent, sans inventer de provenance ni modifier l’historique. Les totaux et exemplaires existants restent exacts.

L’accès au continent réutilise la navigation de collection, ferme la fenêtre de résultat et le dialogue bonus avant de changer d’écran. Le bouton des autres coffres reste disponible dans la collection. La fenêtre de résultat et son bouton Suivant, déjà présents sur main, sont conservés.

## Vérification

Données fictives exclusivement ; Supabase intercepté. Tests de couverture du catalogue, collection vide/partielle/complète, raretés et exemplaires, navigation clavier et tris, FR/EN, 320/375/390/1280 px, premier pays/nouvelle rareté/copie, anciens Daily, rechargement, ouvertures successives et simultanées. Les tests de dépôt existants vérifient également les annulations et les interruptions de transaction. Les captures sont issues du navigateur HTTP réel. Safari/iPhone et Android physiques ne sont pas disponibles.

La métadonnée est compacte et ajoutée par récompense, sans copie de la collection complète ; elle accroît légèrement les historiques existants. Aucun nettoyage destructif des reçus n’est entrepris dans cette modification.

Résultats : 105 tests Node, 3 788 assertions navigateur HTTP complètes, 357 assertions ciblées de l’album et 21 assertions sur quatre redémarrages Chromium réussis. Aucun événement envoyé en production. WebKit non installé ; Safari/iPhone et Android physiques non testés. Les ajustements de tests pour la nouvelle navigation passent explicitement par « Tous les drapeaux ». Les simulations simultanées synchronisent leurs horloges et déclenchent les deux gestionnaires sans attendre l’actionabilité d’un bouton qu’un autre onglet peut déjà masquer après commit.

20 captures réelles, en français et anglais : aperçu des continents sur ordinateur et à 375 px, intérieur d’un continent, états vide/complet et trois types de récompense. Aucun déploiement ou fusion de la branche de développement.
