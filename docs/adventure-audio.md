# Commandes centrées et musique d’aventure

Travail sur `fix/mobile-audio-shared-layout`, sans fusion ni déploiement.

Les quatre commandes existantes restent uniques : son, langue, Stats et Comment jouer. Une ligne centrée affiche des SVG de 20 px dans des cibles de 44 px. Le sélecteur natif FR/EN conserve son identifiant, sa préférence et ses événements ; il recouvre l’icône globe et son petit indicateur FR/EN. Les labels accessibles et infobulles réutilisent les traductions existantes. Les autres écrans conservent les tons chauds précédemment préparés. Le vrai logo et son animation ne changent pas.

## Composition originale

`music.js` compose un thème original de 16 mesures à 96 BPM, soit 40 secondes. Deux sections de huit mesures évitent une répétition trop courte. La mélodie utilise une onde périodique adoucie (fondamentale et harmoniques 3/5 atténuées), entre do4 et do5. La basse est triangulaire, à deux notes par mesure. Quatre pulses sinusoïdales descendantes servent de percussion. Il n’y a ni échantillon externe ni téléchargement audio dans le jeu.

Les crêtes programmées sont 0,0045 pour la mélodie, 0,005 pour la basse et 0,003 pour les pulses, contre 0,035 pour les effets conservés. Le rendu natif du WAV de revue atteint une crête de 0,00895 et un RMS de 0,00100. Il n’est pas normalisé : il permet de juger le volume réellement prévu. L’aperçu est rendu hors ligne avec Chromium Web Audio et la même fabrique de musique, les mêmes oscillateurs et enveloppes.

## Cycle de vie

La musique et les effets partagent le même AudioContext et la clé `gf-sound-v1` (valeurs `on`/`off` inchangées). Aucun contexte ne se crée avant une interaction lorsque le son est activé. Sur tactile, le démarrage attend le relâchement ; les anciennes API Safari et l’amorçage silencieux restent disponibles.

Une seule instance musicale et un seul intervalle de 50 ms sont actifs. L’ordonnanceur anticipe seulement 200 ms et ignore les anciennes notes après un retard important : aucun rattrapage en rafale. Les changements d’écran, de langue et les clics ne relancent pas la boucle. Les oscillateurs et gains sont déconnectés après leur lecture.

Mute : arrêt immédiat de tous les effets et des notes musicales déjà programmées, annulation de l’intervalle. Arrière-plan : même annulation audio, sans réécrire la préférence ; la position de la boucle est conservée. Au retour, un contexte encore actif reprend. Un contexte suspendu ou interrompu attend le prochain geste, sans erreur affichée et sans demande automatique de reprise non autorisée. Un contexte fermé est remplacé au prochain geste. Une erreur de musique ne bloque ni les effets ni le jeu.

## Limites de validation

Le navigateur de test est Chromium. Le test musical utilise son moteur Web Audio natif et un vrai geste tactile Playwright, puis simule explicitement `document.hidden` et une suspension de l’AudioContext. Les tests unitaires vérifient aussi l’absence d’ordonnanceurs multiples, le passage de la boucle, les erreurs et le mute sauvegardé. Ce n’est pas une certification d’iOS, de son routage physique ou de l’arrêt d’un processus en arrière-plan. WebKit et un iPhone réel ne sont pas disponibles. Le problème sonore précédemment signalé sur l’iPhone ne peut donc pas être déclaré résolu sans test sur cet appareil.

Les règles, scores, probabilités, récompenses, collections, sauvegardes, statistiques, traductions et configuration Supabase ne sont pas modifiés. Les requêtes Supabase sont interceptées dans les tests.

Un test historique de deux ouvertures simultanées attendait la visibilité des boutons via Playwright. Le premier commit pouvait déjà masquer le bouton dans le second onglet pendant cette attente, produisant un timeout. Le test déclenche désormais les deux clics avec `evaluate(button => button.click())`, comme le scénario existant de `bonus-integration.mjs`, et conserve les assertions d’un seul crédit. Aucune modification du dépôt, de l’attribution ou de l’ouverture des récompenses.

L’audit lisait également la couleur verte aussitôt après le succès, sans laisser passer la première image de l’animation réduite. Une lecture intermédiaire a échoué. Il attend maintenant le vert final avant le changement de langue, puis conserve sa vérification immédiate après ce changement, conformément à l’approche du test dédié `highlight.mjs`. Les styles de carte et la logique géographique restent inchangés.

Validation finale : 95 tests Node et 2 672 assertions navigateur HTTP réussis (Chromium, Supabase simulé), incluant Web Audio natif, les gestuelles tactiles, le mute et son rechargement, l’arrière-plan, le retour de cache de page, les activations répétées, la jonction de boucle et les non-régressions des modes, récompenses, sauvegardes et cartes. Captures de l’accueil FR/EN à 1280, 320, 375 et 390 px. WebKit et Safari/iPhone réel non testés. Export portable non testé, GeoFact.html/export.py absents.

## Notification de réussite plus positive

Branche `fix/joyful-success-sound` : seule la mélodie `correct` change. Trois notes ascendantes de sol majeur (784, 988, 1175 Hz), avec un effet de 225 ms et l’amplitude précédente de 0,035. Musique, sons d’erreur et mélodies des coffres inchangés. La requête de cache de sound.js est actualisée sans changer les sauvegardes.

L’aperçu `joyful-success-preview.wav` est rendu par Chromium OfflineAudioContext avec le même code, sans normalisation (fichier de 300 ms incluant la fin silencieuse). 95 tests Node et 104 assertions HTTP ciblant musique, mute, reprise audio simulée, interactions et récompenses passent, Supabase intercepté. La suite complète HTTP n’est pas relancée pour ce changement de notes seul. Safari/iPhone réel reste non vérifié. Aucun déploiement de ce correctif.

Scintillement final : ajout d’un sol6 à 1568 Hz, lancé à 205 ms pendant 60 ms, à une amplitude de 0,012 (contre 0,035 pour les trois premières notes). Durée totale : 280 ms. Le volume optionnel par note conserve 0,035 par défaut pour tous les effets existants. Musique, erreur et coffres restent inchangés. Aperçu WAV natif de 350 ms, sans normalisation. Validation : 95 tests Node et 104 assertions HTTP ciblées réussis ; pas de nouvelle suite HTTP complète ni de test Safari réel. Aucune publication du correctif.

## Bascule de langue directe

Le contrôle existant `lang` devient un bouton FR ↔ EN : un toucher ou un clic change immédiatement la langue, sans menu. La même préférence `wg-lang` est conservée. Le badge affiche la langue actuelle ; le libellé accessible et l’infobulle indiquent la prochaine langue. Les dimensions de 44 px et les icônes de 20 px restent harmonisées. Les tests navigateur utilisent désormais ce bouton ; un test de rerendu derrière une modale conserve explicitement une activation programmatique.

Revue visuelle : 36 captures et vérifications de largeur sur neuf écrans, en français et anglais, à 375 et 1280 px ; aucun débordement détecté. Tests ciblés accueil (avant simplification du Daily) : 546 assertions réussies, avec touches natives à 320/375/390 px et clavier. Redémarrage réel : 21 assertions réussies sur quatre lancements Chromium (préférences, série, coffre non ouvert, crédit unique). Supabase simulé ; aucune donnée de production modifiée. Safari/iPhone physique et WebKit ne sont pas disponibles dans cet environnement.

Accueil après un Daily terminé : suppression du score, du nombre d’erreurs et des cinq marques du résumé d’accueil. La série, le compteur UTC, le bouton « Voir mon résultat » et les coffres en attente sont conservés. Le résultat détaillé reste intégralement visible dans son écran existant ; aucune donnée Daily n’est modifiée. Tests FR/EN pour les coffres ouverts/non ouverts, le détail du résultat et le passage à minuit UTC.

Après simplification du Daily : 562 assertions accueil ciblées réussies et 95 tests Node réussis. Le test de changement de langue derrière le dialogue de coffre bonus utilise lui aussi une activation programmatique, comme l’ancien test de sélection ; les interactions réelles restent couvertes séparément.

Validation de publication de l’ensemble final : 95 tests Node et 2 737 assertions navigateur HTTP réussis (Chromium ordinateur/mobile, Supabase simulé), plus les 21 assertions de redémarrage persistant. La suite complète confirme les modes, les collections, le Daily, les coffres, les frontières, le vert permanent, les préférences et le système audio. Les interruptions des premières exécutions servaient à intégrer les nouvelles demandes ; le seul échec de test réel provenait du clic derrière le dialogue modal de coffre, corrigé dans le scénario de test sans changer le jeu. Les fichiers de stockage/récompenses, core, carte, musique, traductions et statistiques sont identiques à main.

## Présence de la musique sur petits haut-parleurs

Branche `fix/music-speaker-presence` : harmoniques 3 et 5 de la mélodie renforcées (rapports 0,35 et 0,10, précédemment 0,15 et 0,04). Les coefficients sont compensés pour conserver l’énergie RMS théorique précédente. Gains, notes, basse, percussion, ordonnanceur et effets restent identiques. Aucun traitement particulier par système ou navigateur : le rendu est commun à tous les appareils et doit être comparé sur Android, iPhone et ordinateur.

Validation : 96 tests Node et 592 assertions HTTP ciblées réussis (Chromium, Supabase simulé), incluant musique native, mute, reprises, mobile et accueil FR/EN. Rendu Web Audio natif de 40 secondes : crête 0,03482, RMS 0,00367, aucune saturation numérique. Aucun Android physique ou Safari/iPhone réel disponible : l’amélioration perceptive signalée reste à confirmer, sans diagnostic matériel établi. Correctif non publié.
