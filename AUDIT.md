# Audit technique — INVOORENT (offline)

**Date de rédaction :** 2 avril 2026  
**Périmètre :** application web statique « offline-first », PWA, stockage navigateur, structure du code, tests automatisés mineurs, documentation.  
**Hors périmètre :** aucune section dédiée à la sécurité (analyse des menaces, durcissement, conformité réglementaire). Les mécanismes d’accès utilisateur sont mentionnés uniquement comme fonctionnalités produit.

---

## 1. Synthèse

INVOORENT est une application de gestion de location de véhicules conçue pour fonctionner en local dans le navigateur, avec installation PWA et mise en cache des ressources via service worker. Les données métier (véhicules, clients, réservations, maintenance, journal, paramètres) sont persistées côté client, avec priorité au stockage **OPFS** lorsqu’il est disponible et repli sur **localStorage** avec limite d’environ 5 Mo.

Points forts observés :

- Découpage progressif du noyau `01-app-core.js` en modules chargés en `defer`, avec convention `invoo*.attach({ … })` pour l’injection de dépendances.
- Précache explicite dans `sw.js` (liste `ASSETS`) et versionnement par `CACHE_NAME` (actuellement **INVOORENT-v58**).
- Schéma de sauvegarde JSON validé par un test Node (`npm test` → `scripts/verify-backup-schema.mjs`).
- Documentation de déploiement et checklist de release présentes (`README.md`, `RELEASE-CHECKLIST.md`).

Axes d’amélioration récurrents :

- Le fichier `js/01-app-core.js` reste volumineux (navigation, tableau de bord, alertes, CRUD véhicules/clients, auth, import/export backup, orchestration des modules).
- Peu de tests automatisés au-delà du validateur de backup ; pas de chaîne ESLint/Prettier intégrée au dépôt.
- Accessibilité et scénarios de test navigateur non formalisés dans des fichiers dédiés.

---

## 2. Architecture applicative

| Élément | Rôle |
|--------|------|
| `index.html` | Point d’entrée ; CSP meta ; enchaînement des scripts `defer`. |
| `js/partials-loader.js` | Chargement des fragments HTML (`partials/*`). |
| `js/01-app-core.js` | Cœur : OPFS, `load`/`save`, navigation, dashboard, listes véhicules/clients, alertes, `getSettings`, enregistrement des modules. |
| `js/auth.js` / écran login | Flux de session (hors analyse sécurité). |
| `js/sw-register.js` | Enregistrement et mise à jour du service worker. |
| `sw.js` | Stratégie de cache, liste des ressources hors ligne. |
| `manifest.json` | Métadonnées PWA. |

Les pages internes sont des partials (`partials/pages/*.html`) injectés dans `app-frame` ; les modales sont centralisées dans `partials/modals-stack.html`.

---

## 3. PWA et mise en cache

- **Service worker** : installation avec `cache.addAll(ASSETS)` ; activation avec suppression des anciens caches. Tout fichier critique pour le mode hors ligne doit figurer dans `ASSETS` **et** dans l’ordre de chargement de `index.html` si nécessaire.
- **Mises à jour** : `sw-register.js` gère la proposition de rechargement ; incrémenter `CACHE_NAME` à chaque modification d’`ASSETS` ou de ressources clés (voir `RELEASE-CHECKLIST.md`).
- **Manifest** : `start_url` et `scope` documentés pour une installation cohérente.

---

## 4. Données et persistance

- **Double couche** : OPFS comme stockage principal chiffré lorsque la clé est disponible ; miroir `localStorage` pour compatibilité et lectures rapides.
- **Réconciliation** : logique de réparation si le fichier OPFS est absent mais `localStorage` contient des données ; comparaison d’horodatages pour éviter les régressions.
- **Sauvegarde / restauration** : export JSON structuré ; import avec validation de structure (`backup-validate.js` + script de test).
- **Photos** : module `photos-ui.js` présent ; indicateur `PHOTOS_ENABLED` dans le core (état produit à documenter dans les guides utilisateur).

---

## 5. Modularisation JavaScript

Modules extraits du monolithe (non exhaustif) :

| Fichier | Responsabilité principale |
|---------|---------------------------|
| `reservations-render.js` | Grille et filtres des réservations. |
| `reservations-modal.js` | Modale réservation, total, WhatsApp, clôture, suppression. |
| `parametres-ui.js` | Paramètres agence, jauge stockage, `INVOO_CONDITIONS_DEFAUT`. |
| `guide-html.js` | Contenu HTML volumineux du guide (`invooGuideHTML`). |
| `contract-print.js` | Contrat / PDF. |
| `payment-modals.js` | Paiements et caution. |
| `rapport-modals.js` | Rapport mensuel. |
| `dashboard-charts.js` | Graphiques tableau de bord. |
| `calendar-view.js` | Calendrier. |
| `maintenance-ui.js` | Maintenance et alertes associées. |
| `data-export.js` | Export CSV / Excel. |
| `global-search.js` | Recherche globale. |
| `history-modals.js` | Historiques. |
| `vendor-loader.js` | Chargement paresseux Chart / XLSX / jsPDF. |
| `02-backup.js`, `04-import.js`, `05-save-patch.js` | Flux sauvegarde / import / correctifs. |
| `03-supabase-sync.js` | Synchronisation optionnelle. |

Le core appelle `invoo*.attach({ … })` en fin de `01-app-core.js`. Des garde-fous `typeof … === 'function'` protègent l’ouverture de la modale réservation et la page paramètres si un script ne charge pas.

---

## 6. Qualité et tests

- **Automatisé** : `npm test` valide le schéma des sauvegardes JSON.
- **Manuel** : recommandé de suivre `RELEASE-CHECKLIST.md` après chaque livraison (precache, smoke hors ligne).
- **Non couvert** : parcours complets (import CSV, sync Supabase, tous les états de réservation), régression UI, accessibilité (WCAG).

---

## 7. Score d’état du code et maintenabilité

Objectif : résumer **à quel point le dépôt est facile à faire évoluer** sans prétendre mesurer la sécurité. Échelle par critère : **0–10** (10 = excellent). Les notes reflètent l’état observé au **2 avril 2026** ; à réévaluer après gros refactor ou ajout de tests.

| Critère | Note /10 | Niveau | Commentaire |
|--------|:--------:|--------|-------------|
| **Modularisation** | **7** | Bon | Nombreux modules `invoo*.attach` ; `01-app-core.js` concentre encore beaucoup de logique (dashboard, CRUD, auth, backup). |
| **Tests automatisés** | **4** | À renforcer | Un test Node fiable sur le schéma backup ; pas de tests UI ni de non-régression sur les flux métier. |
| **Documentation projet** | **8** | Très bon | README, release checklist, NAMING, audits, commentaires d’en-tête sur plusieurs modules. |
| **PWA / precache** | **8** | Très bon | Liste `ASSETS` explicite, `CACHE_NAME` versionné ; discipline requise à chaque nouveau fichier critique. |
| **Cohérence & conventions** | **7** | Bon | Préfixes `invoo` / clés `autoloc_*` documentés ; mélange de styles (ES5/ES6+) selon les fichiers. |
| **Robustesse chargement** | **7** | Bon | Garde-fous `typeof` sur fonctions exposées par modules si script absent. |
| **Dette technique visible** | **6** | Correct | Monolithe résiduel, guide en gros fichier JS, pas de lint/formatage imposé dans le repo. |

**Moyenne simple des critères ci-dessus : ~6,7 / 10.**

**Synthèse en une phrase :** le projet est **bien maintenu au sens produit et documentation** ; la **maintenabilité à long terme** dépend surtout de **réduire encore le core** et d’**élargir les tests** (même légers). Une évolution vers **7,5–8/10** est réaliste en traitant en priorité extraction du core + scénarios de test manuels formalisés, puis ESLint optionnel.

*Mise à jour recommandée de cette section : après chaque lot majeur (extraction, nouvelle suite de tests, changement PWA).*

---

## 8. Documentation livrée avec le projet

- `README.md` : déploiement, tests, structure.
- `RELEASE-CHECKLIST.md` : publication et PWA.
- `NAMING.md` : conventions `autoloc_*` / `invoo*`.
- `AUDIT-STATUT.txt` : checklist d’avancement (alignée avec les chantiers).
- `AUDIT.md` : le présent document (vue d’ensemble technique sans section sécurité).

---

## 9. Recommandations (priorité indicative)

1. **Poursuivre l’extraction** depuis `01-app-core.js` (dashboard + alertes documentaires, puis CRUD véhicules/clients) pour réduire le risque de régression lors des évolutions.
2. **Formaliser des scénarios de test manuel** courts (fichier dédié ou section dans `RELEASE-CHECKLIST.md`).
3. **Aligner precache et HTML** : à chaque nouveau `js/*.js` ou CSS, mettre à jour `sw.js` et incrémenter `CACHE_NAME`.
4. **Option build** : générer `guide-html.js` à partir d’une source unique pour éviter la divergence de contenu.
5. **Qualité de code** : introduire ESLint minimal + `npm run lint` si l’équipe valide l’ajout de dépendances de développement.

---

## 10. Suivi de ce document

Mettre à jour **AUDIT.md** lors d’un changement d’architecture majeur ou d’une refonte du périmètre fonctionnel. **Recalculer ou ajuster la section 7 (score)** lors des mêmes jalons. Pour le suivi au fil de l’eau des tâches, conserver **AUDIT-STATUT.txt** comme grille de coches.

---

*Fin du document d’audit technique (sans section sécurité).*
