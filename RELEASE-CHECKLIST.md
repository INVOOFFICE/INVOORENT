# Checklist de publication — INVOORENT (offline)

À cocher avant chaque déploiement ou release.

> État du projet et repères : voir **[AVANCEMENT.md](./AVANCEMENT.md)**.

## 1. Service worker et cache

- [ ] Tout nouveau fichier **`.js` / `.css` / asset** référencé par l’app est ajouté à la liste **`ASSETS`** dans `sw.js` (ou retiré si supprimé).
- [ ] Incrémenter **`CACHE_NAME`** dans `sw.js` (ex. `INVOORENT-v46` → `v47`) dès que la liste precache ou des fichiers critiques changent.
- [ ] Vérifier que `sw.js` lui-même figure dans **`ASSETS`** (pour mise à jour du SW).

## 2. Vérifications rapides (smoke test)

- [ ] Ouvrir l’app **hors ligne** (DevTools → Network → Offline) : écran de connexion + navigation après login.
- [ ] Créer / modifier une donnée, recharger : persistance OK (OPFS ou localStorage selon navigateur).
- [ ] **Exporter** une sauvegarde JSON puis **importer** sur une session de test (ou autre onglet).
- [ ] Avec réseau : déclencher une mise à jour SW (ou simuler) — toast **Mise à jour disponible** puis rechargement.

## 3. Automatique (optionnel)

```bash
npm test
```

Valide le schéma minimal des sauvegardes (voir `scripts/verify-backup-schema.mjs`). À garder aligné avec `js/backup-validate.js`.

## 4. Après déploiement

- [ ] Première visite en ligne pour installer le nouveau SW, puis contrôle hors ligne une dernière fois.
