# Convention de noms (INVOORENT / AutoLoc)

Le projet a un historique **AutoLoc** (`autoloc_*`) et un branding **INVOORENT**. Les deux coexistent volontairement.

## Préfixes `localStorage` / clés techniques

| Préfixe / motif | Rôle |
|-----------------|------|
| `autoloc_*` | Données métier et technique historiques (véhicules, clients, réservations, réglages, etc.). |
| `invoo_*` | Fonctions ou clés liées à la marque INVOORENT (ex. activation licence). |

Ne pas renommer massivement les clés `autoloc_*` sans **migration** explicite : les utilisateurs ont déjà des données stockées sous ces noms.

## Fichiers et code

- **`01-app-core.js`** : cœur applicatif (beaucoup de symboles internes encore `AutoLoc` dans les messages console).
- **`OPFS` / `KEYS`** : identifiants stables pour le stockage local ; à traiter comme API interne.

## Nouveau code

- Préférer les libellés utilisateur **INVOORENT**.
- Pour de nouvelles clés de stockage, rester cohérent avec le préfixe existant (`autoloc_` ou `invoo_`) et documenter ici en une ligne.
- APIs globales optionnelles : `invoo*` (ex. `invooDashboardCharts.render({ load, KEYS })`, `invooHistoryModals.attach({ load, KEYS })`, `invooPaymentModals.attach({ … })`, `invooContractPrint.attach({ load, KEYS, getSettings, conditionsDefaut, openModal, alAlert })`, `invooRapportModals.attach({ load, KEYS, getSettings, addLog })`, `invooReservationsRender.attach({ load, KEYS })`, `invooDataExport.attach({ load, KEYS, alAlert, addLog })`, `invooEnsureChart` / `invooEnsureXlsx` / `invooEnsureJsPdf`) — préfixe produit, pas clés de stockage.
- Handlers `onclick` : `showHistClient`, `showHistVeh` (`history-modals.js`) ; `openPayModal`, `addPaiement`, `deletePaiement`, `saveCaution`, `setCautionStatut` (`payment-modals.js`) ; `printContrat`, `printContratDirect` (`contract-print.js`) ; `openRapportModal`, `genererRapport` (`rapport-modals.js`) ; `filterRes`, `renderReservations` (`reservations-render.js`) ; `exportCSV`, `exportExcel` (`data-export.js`).
- Markup partiel : `partials/auth-shell.html`, `partials/app-frame.html`, `partials/pages/page-*.html` (8 pages), `partials/modals-stack.html` — assemblage dans `js/partials-loader.js` (XHR synchrone, premier script du `<body>`) — precache `sw.js`.
