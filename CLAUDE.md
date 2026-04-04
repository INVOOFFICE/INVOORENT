# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # Validate JSON backup schema (scripts/verify-backup-schema.mjs)
npm run lint      # Check asset references (scripts/lint-assets.mjs)
node --check js/some-file.js   # Syntax check a JS module
```

No build step — this is a static app served directly. Open `index.html` via a local HTTPS server or `localhost` (OPFS and PWA require a secure context; `file://` does not work).

## Architecture

**INVOORENT** is a local-first PWA for vehicle rental management. All data stays in the browser (no required backend). It has a dual-heritage codebase: originally "AutoLoc", rebranded "INVOORENT" — both prefixes coexist intentionally (see NAMING.md).

### Page assembly

`js/partials-loader.js` runs first (synchronous XHR) and injects HTML partials before any other script executes:
- `partials/auth-shell.html` — login screen
- `partials/app-frame.html` — main shell with nav
- `partials/pages/page-*.html` — 8 feature pages (dashboard, véhicules, clients, réservations, calendrier, maintenance, paramètres, guide)
- `partials/modals-stack.html` — all modal dialogs

### Script load order (all `defer`, end of `<body>`)

1. `js/00-passive-touch.js`, `js/00-html-utils.js` — early polyfills/utils
2. `js/06-core-utils.js` — `window.AutoLocCoreUtils` (ID comparison, soft-delete helpers)
3. `js/storage.js` — `APP.storage` façade (OPFS priority, localStorage fallback)
4. `js/vendor-loader.js` — lazy loaders: `invooEnsureChart`, `invooEnsureXlsx`, `invooEnsureJsPdf`
5. Feature modules: `backup-validate.js`, `contract-print.js`, `rapport-modals.js`, `reservations-render.js`, `reservations-modal.js`, `parametres-ui.js`, `guide-html.js`, `data-export.js`, `dashboard-charts.js`, `calendar-view.js`, `maintenance-ui.js`, `photos-ui.js`, `global-search.js`, `history-modals.js`, `payment-modals.js`
6. `js/01-app-core.js` — **last**: orchestrates everything, calls `.attach()` on each module

### Storage

- **OPFS** (`autoloc_data.json`): primary store, AES-GCM encrypted, key stored in IndexedDB (`autoloc_secure_keys_v1`). Requires HTTPS/localhost.
- **localStorage**: fallback and mirror for OPFS; also used for settings and sync metadata. All keys prefixed `autoloc_*` or `invoo_*`.
- After any `save()`, the event `autoloc:saved` is dispatched — views must listen for this to refresh rather than maintaining their own state.

### `KEYS` object (01-app-core.js)

```js
{ veh: 'autoloc_veh', cl: 'autoloc_cl', res: 'autoloc_res',
  log: 'autoloc_log', maint: 'autoloc_maint', settings: 'autoloc_settings' }
```

Never bypass `load`/`save` for these collections.

### Module pattern

Each extracted module exposes an `invoo*.attach({ load, KEYS, … })` function called by `01-app-core.js`. Global handlers (used in `onclick=` attributes) are attached to `window` inside `.attach()`.

### PWA / Service Worker

`sw.js` precaches all static assets. `CACHE_NAME` (currently `INVOORENT-v58`) **must be incremented** whenever any precached file changes or is added/removed. `js/sw-register.js` manages SW lifecycle and shows an update toast.

## Critical rules

### Data integrity

- **ID comparison**: always use `AutoLocCoreUtils.idEq(a, b)` — IDs can be number or string depending on whether data came from localStorage or an imported JSON.
- **Soft-delete**: filter `!x._deleted` (or `AutoLocCoreUtils.isActiveRecord(x)`) for all display, stats, exports, and searches.
- **Vehicle status** must stay in sync with active reservations — use `releaseVehicleWhenNoActiveReservation` logic in `reservations-modal.js`; don't update `KEYS.veh` in isolation.
- **DOM targeting**: use `data-*-id` attributes to find rows/cards, not array indices after filtering.

### Storage keys

Do **not** rename existing `autoloc_*` localStorage keys — users already have data under them. Document any new key in `NAMING.md`.

### Separate editing IDs

Each entity type has its own editing ID variable (`editingVehId`, `editingClientId`, `editingResId`). Do not introduce a single shared `editingId`.

### Release checklist

Before every deploy: add new assets to `ASSETS` in `sw.js`, increment `CACHE_NAME`, run `npm test`. Full checklist: `RELEASE-CHECKLIST.md`.

## Key documentation files

| File | Purpose |
|------|---------|
| `AUDIT-STATUT.txt` | Audit progress tracking, current debt, April 2026 state |
| `NAMING.md` | `autoloc_*` vs `invoo*` prefix conventions |
| `RELEASE-CHECKLIST.md` | Pre-deploy checklist (SW cache, smoke tests) |
| `AGENTS.md` | Concise cross-module consistency rules |
| `.cursor/rules/invoorent-data-coherence.mdc` | Detailed data rules for JS modules |
