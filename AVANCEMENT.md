# INVOORENT — avancement & repères

**Dernière mise à jour :** avril 2026.  
Ce fichier remplace les anciens documents épars (audit long, stratégie, doublons assistants). **À jour pour reprendre le travail.**

## Où on en est (produit)

- **Contrat / PDF** : export depuis le modal réservation via **jsPDF** dans `js/contract-print.js` (style bleu `#1a3c6e`, colonnes, bloc total, signatures). Option hors navigateur : `scripts/contrat_pdf_reportlab.py` + `scripts/requirements-pdf.txt`.
- **Paramètres** : logo avec zone de dépôt + curseur de hauteur ; **état des lieux dans le contrat / PDF** : **désactivé par défaut** — à activer explicitement dans *Contrat & état des lieux* puis *Enregistrer*.
- **PWA** : incrémenter `CACHE_NAME` dans `sw.js` quand vous touchez aux assets precachés.

## Repères code (éviter les régressions)

- Comparer les IDs avec `window.AutoLocCoreUtils.idEq(a, b)` (chaîne vs nombre).
- En affichage / stats : ignorer les fiches supprimées avec `!x._deleted`.
- Données : `load` / `save` + `KEYS` du core ; pas renommer les clés `autoloc_*` en localStorage sans migration.
- Modales véhicule / client / réservation : IDs d’édition séparés (pas un seul `editingId` global).

## Noms (AutoLoc / INVOORENT)

Historique **AutoLoc** (`autoloc_*` en stockage) + branding **INVOORENT** ; les deux coexistent. Nouveau code : libellés INVOORENT ; nouvelles APIs globales souvent préfixées `invoo*`.

## Supabase (optionnel)

Script SQL et rappels RLS / **Realtime** dans *Paramètres → Sync multi-appareils*. Pour le temps réel : ajouter les tables `invoo_*` à la publication `supabase_realtime` (voir commentaires dans le SQL de la page).

## Publication

Checklist : **[RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)**.

## Déploiement & tests

Voir **[README.md](./README.md)** (`npm test`, déploiement statique, OPFS).
