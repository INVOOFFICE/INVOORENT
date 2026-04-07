# INVOORENT (offline)

Application web **statique** (HTML / CSS / JS), **local-first** : OPFS + `localStorage`, PWA avec service worker.

## Déploiement

1. Servir le dossier à la racine du site **ou** dans un sous-dossier (ex. GitHub Pages : `https://user.github.io/repo/`).
2. HTTPS recommandé (requis pour OPFS / PWA sur la plupart des navigateurs).
3. Si l’app est dans un **sous-dossier**, vérifier que `manifest.json` (`start_url`, `scope`) et les chemins relatifs restent cohérents avec l’URL publique.

## Mise à jour d’une release

Voir **[RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)** : liste `ASSETS` + `CACHE_NAME` dans `sw.js`, tests rapides hors ligne.

## Tests (optionnel)

```bash
npm test
```

Valide le schéma JSON des sauvegardes (`scripts/verify-backup-schema.mjs` — à garder aligné avec `js/backup-validate.js`).

## Structure des scripts (ordre de chargement)

Les vendors lourds (Chart.js, SheetJS, jsPDF) sont **chargés à la demande** via `js/vendor-loader.js` (toujours **precachés** par le SW pour le mode hors ligne).

Modules métier extraits : `backup-validate.js`, `dashboard-charts.js`, `history-modals.js`, `payment-modals.js`.

## Accessibilité

Pas d’audit WCAG formalisé dans ce dépôt. Pour un usage professionnel large, prévoir une passe dédiée (focus clavier, contrastes, annonces des modales).

## Documentation interne

- **[AVANCEMENT.md](./AVANCEMENT.md)** — état du projet, dernières évolutions, repères code pour reprendre le travail  
- `APP-GUIDE.txt` — cible d’architecture type INVOOFFICE (si présent)  
- `TECHNIQUE.txt` — procédures admin (hors périmètre code, si présent)
