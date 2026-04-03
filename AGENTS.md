# INVOORENT — repères pour rester cohérent

Petit guide pour éviter les régressions entre modules (données, UI, PWA).

## Données

1. **Jointures par ID** : utiliser `window.AutoLocCoreUtils.idEq(a, b)` (import JSON, types nombre/chaîne).
2. **Fiches actives** : filtrer avec `!x._deleted` ou `AutoLocCoreUtils.isActiveRecord(x)` pour affichage, stats, exports, recherche.
3. **Stockage** : une seule source via `load` / `save` et `KEYS` du core ; l’événement `autoloc:saved` synchronise les vues.

## Modales (édition)

- Véhicule / client / réservation : IDs d’édition **séparés** ; ne pas réintroduire un `editingId` global unique.
- Boutons « Ajouter / Nouvelle » : utiliser `openNewVehModal`, `openNewClientModal`, `openNewResModal` pour repartir sans ID résiduel.

## Locations & parc

- Modifier le statut véhicule en lien avec les réservations **en cours** dans la logique existante (`reservations-modal.js`, libération si plus de location active).

## DOM

- Cibler une carte / ligne par attribut **`data-*-id`**, pas par index après filtre.

## Déploiement

- Toucher un asset caché par le SW : augmenter `CACHE_NAME` dans `sw.js`.

Pour le détail orienté assistant, voir `.cursor/rules/invoorent-data-coherence.mdc`.
