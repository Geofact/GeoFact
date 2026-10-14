# Voir le pays d’une carte d’exploration

Après révélation d’un coffre Daily, quatre actions sont regroupées dans une grille centrée 2 × 2 : explorer la collection du continent, voir le pays sur la carte, partager le résultat, accueil. Avant révélation, les actions liées à la carte restent masquées. Les résultats des autres modes conservent leurs actions habituelles.

La carte de consultation utilise le pays de la récompense canonique (`result.card.iso` ou `chest.card.iso`), jamais la dernière réponse du quiz. Elle reprend les géométries actuelles, met le pays en vert et place un repère sur son point intérieur vérifié. Les parties voisines d’un archipel sont cadrées ensemble ; les territoires très dispersés disposent aussi de la vue mondiale. Zoom, déplacement, pincement, vue mondiale et recentrage sont disponibles.

Cette carte est en lecture seule : aucun clic ne répond au jeu. Elle possède sa propre instance et ne change ni le zoom du quiz, ni ses questions, ni son score. Elle ne tire pas de nouvelle carte et n’écrit aucune récompense. La fermeture restaure le focus et le résultat du coffre. Depuis un coffre bonus, elle revient au même coffre, en préservant l’entraînement en cours.

Tous les textes et libellés accessibles utilisent le système FR/EN. Le dialogue natif gère le focus et Échap. Les petites cibles du quiz restent identiques ; à la vue mondiale, les frontières ont priorité sur les zones invisibles des points voisins pour éviter qu’un clic sur un grand pays soit intercepté.

Validation : `tests/reward-map.mjs` vérifie les actions, le pays tiré, les micro-États et îles, les territoires ultramarins, le retour au coffre bonus en plein entraînement, le clavier, les largeurs 320/390/1280 px, FR/EN et l’égalité des sauvegardes avant/après consultation. `npm run test:browser` intègre ce test. `REWARD_MAP_CAPTURE_DIR` enregistre des captures réelles ; mobile émulé dans Chromium, sans appareil physique.
