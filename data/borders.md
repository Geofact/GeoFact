# Frontières terrestres GeoFact

La table `borders.js` contient 317 paires de pays, chacune écrite une seule fois, dans l’ordre alphabétique des codes ISO à trois lettres. L’index de voisinage est construit dans les deux sens au chargement puis figé. Aucune distance, aucun contour SVG et aucun accès réseau n’interviennent dans la décision de voisinage.

## Sources et version

Base : [mledoze/countries, countries.json au commit c2ac0049c14edcf2436c7aa1b2493222a020b462](https://github.com/mledoze/countries/blob/c2ac0049c14edcf2436c7aa1b2493222a020b462/countries.json), champ `borders`. Seuls les 195 codes présents dans GeoFact sont retenus ; doublons et sens inverses sont fusionnés. Licence ODbL 1.0 : attribution et texte conservés dans `BORDERS-LICENSE.txt`. SHA-256 de la source téléchargée : `913e5d716f9dc6b59881ee23488d47f5fda52070d1a34cac5fa327c9e61d8f7c`.

La paire Inde–Sri Lanka, présente seulement dans la liste sri-lankaise de la source, est retirée : le détroit de Palk et le golfe de Mannar séparent ces pays par la mer. Référence : [Haut-commissariat de l’Inde à Colombo, fiche géographique](https://www.hcicolombo.gov.in/page/fact-sheet-india/). C’est la seule paire asymétrique du fichier source ; la symétrisation ne doit pas réintroduire cette erreur.

Les six ajouts ci-dessous complètent les frontières ultramarines absentes de cette sélection. Leur paire et leur URL sont également enregistrées dans `overseasSources` dans la donnée JavaScript.

| Paire | Territoire et référence complémentaire |
| --- | --- |
| BRA–FRA | Guyane : [Préfecture de Guyane, coopération transfrontalière France–Brésil](https://www.guyane.gouv.fr/layout/set/print/Actions-de-l-Etat/Cooperation/Cooperation-transfrontaliere-France-Bresil). |
| FRA–SUR | Guyane : [France Diplomatie, délimitation avec le Suriname](https://www.diplomatie.gouv.fr/fr/information-par-pays/suriname/politique-et-economie). |
| FRA–NLD | Saint-Martin / Sint Maarten : [Ministère de l’Intérieur, accord du 26 mai 2023](https://www.interieur.gouv.fr/actualites/communiques-de-presse/signature-dun-accord-entre-france-et-pays-bas-relatif-a-frontiere-commune-a-saint-martin). |
| CAN–DNK | Groenland, île Tartupaluk/Hans : [Affaires mondiales Canada, frontière terrestre créée par l’accord de 2022](https://www.canada.ca/en/global-affairs/news/2022/06/boundary-dispute.html). |
| CYP–GBR | Bases souveraines d’Akrotiri et Dhekelia : [accord de retrait, protocole des bases souveraines](https://www.legislation.gov.uk/eut/withdrawal-agreement/data.xht?view=snippet&wrap=true) ; [GOV.UK, réseau de défense et souveraineté des bases](https://www.gov.uk/government/publications/permanent-joint-operating-bases-pjobs/fd). |
| ESP–GBR | Gibraltar : [GOV.UK, Overseas Territories biodiversity strategy, chapitre Gibraltar](https://www.gov.uk/government/publications/uk-overseas-territories-biodiversity-strategy/uk-overseas-territories-biodiversity-strategy). |

Revue de la table : 8 octobre 2026. Cette date correspond à la vérification du jeu de données et de ses compléments, pas à une nouvelle expertise de chaque tracé international.

## Conventions

- Le voisinage porte sur les **pays du jeu**, territoires souverains compris, et non sur la proximité du point cliqué. Une frontière sur une autre portion du pays suffit : France–Brésil est voisinage même si le joueur clique en métropole. `NLD` regroupe ici le Royaume des Pays-Bas, y compris Sint Maarten ; `DNK` inclut le Groenland ; `GBR` inclut Gibraltar et les bases souveraines chypriotes.
- `FRA-GF`, `USA-AK` et `USA-HI` sont les trois identifiants séparés de la carte actuelle. Ils sont associés explicitement à `FRA` et `USA` pour le voisinage, sans modifier les identifiants utilisés par la carte ou les distances. Aucun suffixe arbitraire n’est accepté. Un territoire et son propre pays ne sont pas voisins : ils constituent une bonne réponse selon les règles existantes.
- Frontières sur terre et frontières fluviales ou lacustres entre territoires contigus incluses. Enclaves, exclaves et micro-États inclus : Vatican–Italie, Monaco–France, Lesotho–Afrique du Sud, Kaliningrad–Pologne/Lituanie, Nakhitchevan–Turquie, Alaska–Canada.
- Les frontières peuvent être fermées, contestées ou correspondre à des interfaces de contrôle présentes dans la source. Le booléen ne tranche ni le tracé précis ni la souveraineté. Inde–Pakistan, Inde–Chine, Pakistan–Chine, Israël–Palestine, Palestine–Égypte/Jordanie, Russie–Ukraine/Géorgie et Arménie–Azerbaïdjan restent dans la table. Voir [ONU, Cachemire et ligne de contrôle](https://india.un.org/en/162951-un-security-council-discusses-kashmir-china-urges-india-and-pakistan-ease-tensions).
- Une revendication seule ne crée pas une nouvelle paire. Inde–Afghanistan n’est pas ajouté au titre des revendications sur le Cachemire. Les territoires absents des 195 pays ne sont pas automatiquement fusionnés avec un pays revendiquant : Kosovo et Sahara occidental restent exclus. Le Kosovo n’ajoute donc pas une frontière Serbie–Albanie. Le Sahara occidental ne crée pas de voisinage Maroc–Mauritanie ; Maroc–Algérie et Maroc–Espagne (Ceuta/Melilla) sont inclus. Voir [ONU, Sahara occidental](https://www.un.org/dppa/decolonization/en/nsgt/western-sahara). Aucun rattachement automatique de Chypre du Nord à la Turquie.
- Pas de voisinage uniquement maritime. France–Royaume-Uni, Danemark–Suède, Singapour–Malaisie, Bahreïn–Arabie saoudite, Inde–Sri Lanka et États-Unis–Cuba sont exclus. Ponts et tunnels en mer ne créent pas une frontière terrestre naturelle. Les bases louées sur le territoire souverain d’un autre État (Guantánamo) et les revendications antarctiques ne sont pas projetées sur les pays du jeu.
- Botswana–Zambie est inclus, malgré la très courte frontière de Kazungula ; Namibie–Zimbabwe est exclu. Namibie–Zambie reste inclus. Aucun seuil kilométrique n’est utilisé.

## Affichage et pénalités

Pour une mauvaise réponse frontalière, le message FR/EN remplace l’affichage des kilomètres ; le nom et la capitale du pays cliqué restent affichés. Les autres erreurs gardent leur distance et leur réaction existantes.

Le calcul territorial de distance et le barème des pénalités sont **inchangés**, y compris pour les territoires séparés. Une paire frontalière au niveau du pays peut donc avoir une pénalité dépendant d’une portion cliquée très éloignée. La table ne doit jamais remplacer la distance dans `penalise`.

## Maintenance

Modifier une seule paire canonique dans `pairs`, et ajouter une source/une justification pour tout nouvel ajout exceptionnel. Ne pas modifier à la main les voisins inverses : l’index les produit automatiquement. Pour revoir la base, télécharger un commit précis, filtrer les deux extrémités par les codes GeoFact, trier/dédoublonner les paires, retirer Inde–Sri Lanka, réappliquer les six compléments et examiner le diff avant de changer le commit et l’empreinte de référence.

Exécuter `npm test` et `npm run test:browser`. Les tests vérifient les codes, doublons, symétrie, aliases et cas particuliers, puis les textes FR/EN, le retour aux kilomètres, les pénalités inchangées, le vert persistant et les parcours desktop/mobile. Les sources ne sont pas chargées pendant le jeu ou ces tests.
