# 4B.3 — Import minimal, isolé du jeu

`repository.importLegacy(storage)` lit uniquement `gf-collection-v1` et `gf-daily-v1`. L'appel est explicite : aucun import, ouverture de base ou accès au stockage n'est déclenché par le chargement des modules. Le jeu n'utilise pas cette méthode à cette étape.

## Fidélité et atomicité

Les cartes, variantes, nombres de copies, dates et champs supplémentaires sont conservés. L'ancien champ `rarity` est conservé et complété par `rarities` et une copie si aucun compteur n'existait. Aucune date manquante n'est inventée. Le Daily est conservé dans sa représentation originale, y compris anciens scores sur 5000, cases emoji, historiques, records et indicateur de révélation. Les éventuelles normalisations utilisées par le jeu ne sont pas activées ici.

Un Daily non révélé ne constitue pas un nouveau coffre bonus : sa carte déjà créditée à la collection reste dans le résultat Daily, sans deuxième crédit. Une référence à une carte absente de la collection, des compteurs incomplets ou un historique incohérent provoquent un refus explicite.

Une seule transaction IndexedDB sur les trois stores existants écrit la collection, le Daily et un marqueur d'import versionné contenant les deux chaînes originales exactes dans `state`. `chests` et `sessions`, la progression et les quotas bonus restent inchangés. La réussite n'est rendue qu'après commit. Les clés localStorage ne sont jamais écrites ni supprimées.

L'import exige une base encore inutilisée, sauf répétition d'un import déjà terminé. Deux connexions concurrentes sont sérialisées par IndexedDB : une importe, l'autre retrouve le marqueur. Un import répété ne crédite aucune carte. Une transaction avortée ne laisse aucune écriture ; un nouvel appel peut recommencer. Si le commit a réussi mais sa réponse a été perdue, le marqueur rend la répétition inoffensive.

## Refus et limites

- `INVALID_LEGACY_SAVES` : JSON illisible, structure inconnue ou incohérence. Aucun remplacement par une collection vide.
- `LEGACY_SOURCE_UNAVAILABLE` : lecture refusée ou stockage indisponible.
- `LEGACY_SOURCE_CHANGED` : valeurs instables pendant la lecture, modifiées avant l'écriture ou différentes de l'import achevé. Aucun rapprochement automatique.
- `IMPORT_TARGET_NOT_EMPTY` : destination déjà utilisée. Aucun écrasement.
- Les erreurs transactionnelles conservent les codes du dépôt existant. Sans clés sources, `no-data` n'enregistre pas de marqueur et autorise un import ultérieur.

localStorage et IndexedDB ne partagent pas de transaction : les doubles lectures et la vérification juste avant l'écriture réduisent les courses mais ne peuvent empêcher un ancien onglet d'écrire immédiatement après la vérification ou le commit. Le prochain appel détectera une différence ; aucune surveillance continue n'est ajoutée. Avant activation future, il faudra demander de fermer les anciens onglets et résoudre manuellement les divergences. Les valeurs originales sont conservées pour comparaison, mais aucun système complet de restauration, fusion, export ou réimport n'est ajouté.

Une sauvegarde partiellement corrompue, une destination déjà utilisée ou deux historiques divergents nécessitent une vérification manuelle des copies originales. Ne pas supprimer les anciennes clés pour contourner le refus. L'effacement du profil navigateur, sa destruction ou la perte des deux stockages ne sont pas récupérables par ce mécanisme. Les comptes facultatifs et Supabase sont hors périmètre.

## Validation

Tests Node : formats anciens/actuels, doublons et dates, Daily non révélé, champs supplémentaires, JSON et données incohérentes, lectures sans écriture, source instable ou indisponible.

Tests HTTP Chromium : deux connexions concurrentes, répétition, réouverture, fidélité des clés sources, coffre Daily non révélé, corruption sans écrasement, changement des sources, annulation après mise en file des écritures, perte d'accusé après commit, destination utilisée et absence de données. Les interruptions sont simulées par annulation native ou perte d'accusé, pas par coupure matérielle. La suite existante reste exécutée intégralement.
