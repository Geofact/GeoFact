# Daily toutes les 12 heures

À partir du 13 octobre 2026 à 00:00 UTC, nouveaux Daily à 00:00 et 12:00 UTC. Le changement intervient à la prochaine bascule du Daily déjà publié pour ne pas invalider le défi en cours. Numéros historiques inchangés : le Daily du 12 octobre reste #6, puis #7 le 13 au matin, #8 à midi, etc.

Les clés historiques YYYY-MM-DD sont conservées. La période du matin conserve cette clé ; la période de midi utilise YYYY-MM-DD~12. Le tirage reste déterministe et équilibré, identique pour tous dans une période. Le compte à rebours et le rafraîchissement de l’accueil utilisent la même définition des périodes.

Une partie conserve la période de son lancement, même si elle termine après midi ou minuit. Les transactions existantes créditent un seul coffre/carte par période, sans migration de base ni réinitialisation. Les coffres antérieurs restent ouvrables ; leurs dates de midi sont présentées avec « 12:00 UTC ». Les collections et localStorage d’origine restent inchangés. La série continue de compter les jours UTC consécutifs (un ou deux Daily terminés le même jour comptent pour un jour) ; les deux coffres bonus quotidiens, les scores, les probabilités et les effets restent inchangés. Aucune modification Supabase.

Tests ajoutés : clés, numéros, tirages et compte à rebours aux frontières UTC ; historique ; récompenses distinctes par période et répétitions idempotentes ; partie commencée avant une bascule puis terminée après ; récupération de coffre après rechargement ; deux onglets ; accueil automatique à midi, FR/EN, 320 et 1280 px. Les tests utilisent Supabase simulé. Appareils Safari/iPhone et Android réels non disponibles.

Validation finale : 100 tests Node réussis ; 151 assertions HTTP Daily ciblées réussies ; 21 assertions de persistance sur quatre lancements Chromium réussies. Suite HTTP complète réussie, ordinateur/mobile, Supabase simulé ; aucun événement de test envoyé en production. L’export portable et file:// restent hors périmètre, comme dans la suite existante.
