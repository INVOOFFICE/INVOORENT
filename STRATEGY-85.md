# STRATEGY-85.md

Feuille de route pour passer de **69/100 → 88/100** (marge de 3 pts au-dessus de la cible 85).
Sécurité côté client : **inchangée à 12/15**.

Contexte : pas de build step, pas de framework, usage personnel, PWA offline.

---

## Complément — état du dépôt & démarrage (à jour code)

**Déjà en place (hors ce document initial) :**

- Raccourcis manifest `./index.html#vehicules` / `#reservations` + routage hash au login (`consumeInvooHashRoute` dans `01-app-core.js`).
- Rafraîchissement croisé après réservations / véhicules / clients / maintenance (`afterReservationDataChanged`, appels `renderCalendar` / `renderReservations`, etc.).
- `npm run lint` : vérifie que tous les `<script src>` de `index.html` sont dans `sw.js` **et** que chaque entrée `ASSETS` existe sur le disque (évite un `cache.addAll` cassé).
- `CACHE_NAME` actuel : voir `sw.js` (incrémenter à chaque livraison).

**Ordre recommandé pour « commencer à améliorer » (rapide → structurant) :**

1. **Lot 10–15 min** : **Q-1** (`uid`), **U-1**, **U-2**, **A-1** — peu de risque, gain UX / fiabilité IDs immédiat.  
2. **Lot perf** : **P-1** (RAF dashboard) puis **F-1** (un seul `save` véhicules dans `saveReservation`) — moins d’événements `autoloc:saved` / re-renders.  
3. **P-2 avec prudence** : voir encadré ci-dessous.  
4. **P-3** seulement si le comportement « page active » reste correct après tests (éviter les régressions de synchro UI).  
5. **A-2 → A-4** puis **U-3 → U-5** — accessibilité et mobile.  
6. **Q-2 / Q-3** en fin de vague (gros refactor, bien tester + `npm run lint` après ajout des scripts).

**Avis (P-2 — dirty `autoloc_cl`) :** retirer `'dashboard'` de la map pour `autoloc_cl` peut laisser **périmés** les libellés client sur le tableau de bord (cartes d’alertes retards / retours, bloc impayés, activité) si l’utilisateur **reste** sur le dashboard pendant une modification de fiche client. Les KPIs numériques ne changent pas, mais le **texte** oui. Pistes : garder `'dashboard'` pour `autoloc_cl`, ou n’appeler que `renderAlerts()` / une partie légère du dashboard au lieu d’un `renderDashboard` complet — à valider manuellement avant de suivre la spec P-2 telle quelle.

---

## Scores cibles

| Critère                   | Actuel | Cible | Delta |
|---------------------------|--------|-------|-------|
| Performance PWA/offline   | 15/20  | 18/20 | +3    |
| Qualité du code JS        | 14/20  | 18/20 | +4    |
| Sécurité côté client      | 12/15  | 12/15 |  0    |
| UI/UX Mobile              | 12/20  | 18/20 | +6    |
| Accessibilité             |  4/10  |  8/10 | +4    |
| Fiabilité des données     | 12/15  | 14/15 | +2    |
| **TOTAL**                 | **69** | **88**| **+19**|

---

## Ordre d'exécution optimal (ratio gain/effort)

| # | ID     | Description                                   | Effort | Gain pts | Critère      |
|---|--------|-----------------------------------------------|--------|----------|--------------|
| 1 | Q-1    | uid() → crypto.randomUUID()                  | 5 min  | +1.0     | Q + Fiab     |
| 2 | U-1    | btn-icon touch target 44 px (CSS)             | 5 min  | +1.0     | UI/UX        |
| 3 | A-1    | Skip link                                     | 5 min  | +0.5     | A11y         |
| 4 | U-2    | iOS input zoom fix (font-size 16px)           | 5 min  | +0.5     | UI/UX        |
| 5 | U-3    | Calendrier — conteneur scroll horizontal      | 10 min | +0.5     | UI/UX        |
| 6 | P-1    | RAF guard renderDashboard                     | 15 min | +1.0     | Perf         |
| 7 | A-2    | ARIA sur toutes les modales (HTML partials)   | 20 min | +1.5     | A11y         |
| 8 | F-1    | Consolidation saves dans saveReservation()    | 25 min | +1.0     | Fiab         |
| 9 | U-4    | Card layout tables mobile (CSS + data-label)  | 40 min | +2.0     | UI/UX        |
|10 | A-3    | aria-label sur tous les btn-icon (render fns) | 25 min | +1.0     | A11y         |
|11 | A-4    | Focus trap dans openModal/closeModal          | 30 min | +1.0     | A11y         |
|12 | P-2    | Dirty flag séparé pour renderAlerts           | 20 min | +1.0     | Perf         |
|13 | U-5    | Actions mobile — colonne boutons compact      | 30 min | +1.5     | UI/UX        |
|14 | Q-2    | Extraction js/alerts-ui.js                   | 50 min | +1.5     | Qualité      |
|15 | Q-3    | Extraction js/dashboard-ui.js                | 60 min | +1.5     | Qualité + P  |
|16 | P-3    | Debounce global autoloc:saved → renders       | 20 min | +1.0     | Perf         |

**Cumul théorique : +19 pts → 88/100**

---

## PERFORMANCE PWA / OFFLINE  (+3 pts, 15 → 18)

---

### P-1 — RAF guard sur renderDashboard  *(15 min, +1 pt)*

`renderDashboard()` peut être appelée jusqu'à 3 fois de suite lors d'un
`saveReservation()` (via `autoloc:saved` → dirty + appels directs des modules).
Un guard `requestAnimationFrame` coalesce les appels dans une seule frame.

**Fichier :** `js/01-app-core.js`  
**Chercher :**
```js
function renderDashboard(){
 if(shouldSkipRender())return;
```

**Remplacer par :**
```js
let _dashRafId=null;
function renderDashboard(){
 if(shouldSkipRender())return;
 if(_dashRafId)return;
 _dashRafId=requestAnimationFrame(function(){
  _dashRafId=null;
  _renderDashboardCore();
 });
}
function _renderDashboardCore(){
 if(shouldSkipRender())return;
```

Et renommer la fin de la fonction existante en remplaçant la dernière accolade
fermante de `renderDashboard()` (avant `function today()`) pour fermer
`_renderDashboardCore()`.

---

### P-2 — Dirty flag séparé pour les alertes  *(20 min, +1 pt)*

Actuellement `autoloc:saved` sur `autoloc_cl` marque la page `dashboard`
entière comme dirty, ce qui déclenche `renderDashboard` + `renderAlerts` +
`renderDocsAlerts` même si seul un nom de client a changé.

**Fichier :** `js/01-app-core.js`  
**Chercher** le bloc de la map dans l'IIFE `_dirtyPatchDone` (autour de la ligne 735) :
```js
var map={
 'autoloc_veh':['dashboard','vehicules','reservations','calendrier','maintenance'],
 'autoloc_cl':['dashboard','clients','reservations'],
 'autoloc_res':['dashboard','reservations','calendrier'],
 'autoloc_maint':['dashboard','maintenance'],
 'autoloc_log':[],
 'autoloc_settings':['parametres']
};
```

**Remplacer par :**
```js
var map={
 'autoloc_veh':['dashboard','vehicules','reservations','calendrier','maintenance'],
 'autoloc_cl':['clients','reservations'],
 'autoloc_res':['dashboard','reservations','calendrier'],
 'autoloc_maint':['dashboard','maintenance'],
 'autoloc_log':[],
 'autoloc_settings':['parametres']
};
```

Dans le listener, après `pages.forEach(...)`, ajouter :

```js
if(k===KEYS.cl){_dirty.dashboard=true;}
```

> Retirer `'dashboard'` de `autoloc_cl` : une modification de fiche client
> ne change pas les KPIs ni les alertes de retard — seule la liste clients
> et les réservations sont impactées.

> ⚠️ **Revoir l’encadré « Avis (P-2) » en tête du document** : les noms clients
> apparaissent aussi sur le dashboard (alertes, impayés). Sans `renderDashboard`
> ou équivalent ciblé, l’UI peut rester fausse si l’utilisateur édite un client
> sans changer de page.

**Implémentation retenue dans le dépôt :** la map `autoloc_cl` liste `clients` et `réservations` ; dès qu’une sauvegarde touche `KEYS.cl`, `_dirty.dashboard` est forcé à `true` dans le listener `autoloc:saved`, pour conserver des KPI / impayés / libellés corrects à la prochaine visite du tableau de bord. Le gain perf pur de la spec d’origine est donc limité ; la structure du code documente l’intention P-2 sans régression fonctionnelle.

---

### P-3 — Debounce global autoloc:saved → renders  *(20 min, +1 pt)*

**Fichier :** `js/01-app-core.js`  
**Juste avant** `const save=(k,d)=>{`, ajouter :
```js
let _saveRenderTimer=null;
function _scheduleDirtyRender(){
 if(_saveRenderTimer)return;
 _saveRenderTimer=setTimeout(function(){
  _saveRenderTimer=null;
  const pg=sessionStorage.getItem('autoloc_current_page')||'dashboard';
  const link=document.querySelector('nav a[data-page="'+pg+'"]');
  if(link&&_dirty[pg]){
   _dirty[pg]=false;
   if(pg==='dashboard'){renderDashboard();if(typeof renderMaintAlerts==='function')renderMaintAlerts();}
   else if(pg==='vehicules'&&typeof renderVehicules==='function')renderVehicules();
   else if(pg==='clients'&&typeof renderClients==='function')renderClients();
   else if(pg==='reservations'&&typeof window.renderReservations==='function')window.renderReservations();
   else if(pg==='calendrier'&&typeof renderCalendar==='function')renderCalendar();
   else if(pg==='maintenance'&&typeof renderMaintenance==='function')renderMaintenance();
  }
 },30);
}
```

**Dans** le listener `autoloc:saved` de `_dirtyPatchDone`, ajouter en fin :
```js
 pages.forEach(function(p){_dirty[p]=true;});
 _scheduleDirtyRender(); // ← ajouter cette ligne
```

---

## QUALITÉ DU CODE JS  (+4 pts, 14 → 18)

---

### Q-1 — uid() → crypto.randomUUID()  *(5 min, +0.5 pt qualité + 0.5 pt fiabilité)*

**Fichier :** `js/01-app-core.js`  
**Chercher :**
```js
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
```

**Remplacer par :**
```js
const uid=()=>{
 if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
 return Date.now().toString(36)+Math.random().toString(36).slice(2,9);
};
```

> `crypto.randomUUID()` disponible dans Chrome 92+, Firefox 95+, Safari 15.4+.
> Tous nécessitent HTTPS/localhost — déjà requis par l'app. Fallback 9 chars
> (contre 6 avant) améliore l'entropie si la fonction n'est pas disponible.

---

### Q-2 — Extraction js/alerts-ui.js  *(50 min, +1.5 pts)*

Extraire les 6 fonctions d'alerte depuis `01-app-core.js` dans un nouveau module.
Réduction estimée : ~145 lignes retirées du core.

**Créer** le fichier `js/alerts-ui.js` :

```js
/**
 * Alertes tableau de bord : retards, retours imminents, docs véhicules.
 * Branchement : invooAlertsUi.attach({ load, KEYS, shouldSkipRender }) depuis 01-app-core.js
 */
(function(global){
 'use strict';
 var ctx=null;

 function computeAlerts(){
  /* === copier-coller exact de computeAlerts() depuis 01-app-core.js === */
 }
 function renderAlerts(){
  /* === copier-coller exact de renderAlerts() depuis 01-app-core.js === */
 }
 function scrollToAlerts(){
  /* === copier-coller exact === */
 }
 function scrollToDocsAlerts(){
  /* === copier-coller exact === */
 }
 function computeDocsAlerts(){
  /* === copier-coller exact === */
 }
 function renderDocsAlerts(){
  /* === copier-coller exact === */
 }
 function renderMaintAlerts(){
  if(typeof global.invooMaintenanceUi==='object'&&
     typeof global.invooMaintenanceUi.renderMaintAlerts==='function'){
   global.invooMaintenanceUi.renderMaintAlerts();
  }
 }

 global.invooAlertsUi={
  attach:function(c){
   ctx=c;
   global.computeAlerts=computeAlerts;
   global.renderAlerts=renderAlerts;
   global.scrollToAlerts=scrollToAlerts;
   global.scrollToDocsAlerts=scrollToDocsAlerts;
   global.computeDocsAlerts=computeDocsAlerts;
   global.renderDocsAlerts=renderDocsAlerts;
   global.renderMaintAlerts=renderMaintAlerts;
  }
 };
})(typeof window!=='undefined'?window:globalThis);
```

**Dans `01-app-core.js`**, en bas du fichier dans le bloc `.attach()` final :
```js
if(typeof invooAlertsUi==='object'&&typeof invooAlertsUi.attach==='function'){
 invooAlertsUi.attach({load,KEYS,shouldSkipRender});
}
```

**Dans `index.html`**, ajouter avant `01-app-core.js` :
```html
<script defer src="js/alerts-ui.js"></script>
```

**Dans `sw.js`**, ajouter dans ASSETS :
```js
'js/alerts-ui.js',
```

**Supprimer** de `01-app-core.js` les 6 fonctions extraites (conserver les appels
`renderAlerts()`, `renderDocsAlerts()`, `renderMaintAlerts()` qui seront désormais
des références aux globals exposés par le module).

---

### Q-3 — Extraction js/dashboard-ui.js  *(60 min, +1.5 pts)*

Extraire `renderDashboard()` et `renderCharts()` du core (~110 lignes).

**Créer** le fichier `js/dashboard-ui.js` :

```js
/**
 * Rendu tableau de bord : KPIs, sparklines, activité, flotte, impayés, charts.
 * Branchement : invooDashboardUi.attach({ load, KEYS, getSettings, shouldSkipRender,
 *   renderAlerts, renderDocsAlerts, renderMaintAlerts }) depuis 01-app-core.js
 */
(function(global){
 'use strict';
 var ctx=null;

 function renderDashboard(){
  /* === copier-coller exact de renderDashboard() depuis 01-app-core.js === */
  /* Remplacer les appels renderAlerts()/renderDocsAlerts() par :           */
  /* if(typeof ctx.renderAlerts==='function')ctx.renderAlerts();            */
 }

 function renderCharts(){
  /* === copier-coller exact de renderCharts() depuis 01-app-core.js === */
 }

 global.invooDashboardUi={
  attach:function(c){
   ctx=c;
   global.renderDashboard=renderDashboard;
   global.renderCharts=renderCharts;
  }
 };
})(typeof window!=='undefined'?window:globalThis);
```

**Dans `01-app-core.js`**, en bas dans le bloc `.attach()` final :
```js
if(typeof invooDashboardUi==='object'&&typeof invooDashboardUi.attach==='function'){
 invooDashboardUi.attach({
  load,KEYS,getSettings,shouldSkipRender,
  renderAlerts:global.renderAlerts,
  renderDocsAlerts:global.renderDocsAlerts,
  renderMaintAlerts:global.renderMaintAlerts
 });
}
```

**Dans `index.html`**, ajouter avant `01-app-core.js` :
```html
<script defer src="js/dashboard-ui.js"></script>
```

**Dans `sw.js`**, ajouter dans ASSETS :
```js
'js/dashboard-ui.js',
```

> ⚠️ Incrémenter CACHE_NAME après ajout de ces deux fichiers.

---

## UI/UX MOBILE  (+6 pts, 12 → 18)

---

### U-1 — Touch target 44 px sur les boutons icônes  *(5 min, +1 pt)*

Apple et Google recommandent 44×44 px minimum pour les zones de tap.

**Fichier :** `css/styles.css`  
**Chercher** la règle `.btn-icon` (chercher `btn-icon{` dans le fichier) et ajouter :

```css
.btn-icon{min-width:36px;min-height:36px;}
@media(max-width:768px){
 .btn-icon{min-width:44px;min-height:44px;}
}
```

---

### U-2 — iOS input zoom fix  *(5 min, +0.5 pt)*

iOS zoome automatiquement sur les `<input>` dont `font-size < 16px`, ce qui
brise le layout sur iPhone.

**Fichier :** `css/styles.css`  
**Ajouter** dans le bloc `@media (max-width:768px)` existant (ligne ~311) :

```css
input,select,textarea{font-size:16px !important;}
```

---

### U-3 — Calendrier : conteneur scroll horizontal  *(10 min, +0.5 pt)*

**Fichier :** `partials/pages/page-calendrier.html`  
**Chercher** l'élément parent de la grille calendrier (class `cal-grid` ou `calendar-wrap`) :

```html
<!-- AVANT -->
<div id="cal-grid-wrap">

<!-- APRÈS -->
<div id="cal-grid-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;">
```

---

### U-4 — Card layout pour les tables sur mobile  *(40 min, +2 pts)*

La technique : sur mobile, masquer les `<thead>` et transformer chaque `<td>`
en ligne "label : valeur" via un attribut `data-label`.

#### Étape 1 — CSS (ajouter à la fin de `css/styles.css`)

```css
/* ── Card layout tables (mobile ≤ 600 px) ─────────────────────────────── */
@media (max-width:600px){
 .data-table thead{display:none;}
 .data-table tbody tr{
  display:block;
  background:var(--surface2);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  margin-bottom:10px;
  padding:10px 12px;
 }
 .data-table tbody td{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:5px 0;
  border:none;
  font-size:0.82rem;
  gap:8px;
 }
 .data-table tbody td[data-label]::before{
  content:attr(data-label);
  font-weight:600;
  color:var(--text3);
  font-size:0.75rem;
  min-width:100px;
  flex-shrink:0;
 }
 .data-table tbody td:last-child{
  border-top:1px solid var(--border);
  margin-top:6px;
  padding-top:8px;
  justify-content:flex-end;
  flex-wrap:wrap;
  gap:6px;
 }
}
```

#### Étape 2 — Ajouter `class="data-table"` aux tables dans les partials

**`partials/pages/page-vehicules.html`** — chercher `<table` et ajouter la classe :
```html
<!-- AVANT -->
<table>
<!-- APRÈS -->
<table class="data-table">
```

Idem dans `page-clients.html`, `page-reservations.html`, `page-maintenance.html`.

#### Étape 3 — Ajouter `data-label` dans les fonctions de rendu

**`js/01-app-core.js` — `renderVehicules()`** : modifier le template de chaque `<td>`.

Chercher dans le `tbody.innerHTML=data.map(v=>{...})` le début du `return` :
```js
return `<tr><td><strong>${window.AutoLocUtils.escapeHtml(v.immat)}</strong></td><td>${...marque modele...}</td><td>${catDisp}</td><td>${anneeDisp}</td><td><strong>${tarifDisp} MAD</strong></td><td>...badge...</td><td style="display:flex;gap:6px;">...boutons...</td></tr>`;
```

**Remplacer par** (ajouter `data-label` sur chaque `<td>`) :
```js
return `<tr>
 <td data-label="Immat"><strong>${window.AutoLocUtils.escapeHtml(v.immat)}</strong></td>
 <td data-label="Véhicule">${window.AutoLocUtils.escapeHtml(v.marque)} ${window.AutoLocUtils.escapeHtml(v.modele)}</td>
 <td data-label="Catégorie">${catDisp}</td>
 <td data-label="Année">${window.AutoLocUtils.escapeHtml(anneeDisp)}</td>
 <td data-label="Tarif/j"><strong>${window.AutoLocUtils.escapeHtml(tarifDisp)} MAD</strong></td>
 <td data-label="Statut"><span class="badge ${v.statut==='disponible'?'badge-success':v.statut==='loué'?'badge-info':'badge-warning'}">${window.AutoLocUtils.escapeHtml(v.statut)}</span>${docBadge}</td>
 <td>${photosBtn}...boutons...</td>
</tr>`;
```

> Même principe pour `renderClients()` (labels : Nom, Tél, CIN, Email, Permis,
> Locations) et `js/reservations-render.js` (labels : Contrat, Client, Véhicule,
> Période, Statut, Montant).

---

### U-5 — Colonne actions : boutons compacts sur mobile  *(30 min, +1.5 pts)*

La dernière colonne des tables contient 4-5 `btn-icon` serrés. Sur mobile, les
regrouper dans un wrapper flex qui passe à la ligne si nécessaire.

**CSS à ajouter dans `css/styles.css`** (dans le bloc `@media (max-width:600px)`) :

```css
 .row-actions{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  justify-content:flex-end;
 }
 .row-actions .btn-icon{
  min-width:40px;
  min-height:40px;
  border-radius:10px;
 }
```

**Dans les render functions**, entourer les boutons d'actions avec `<div class="row-actions">` :

Dans `renderVehicules()` — chercher le `<td style="display:flex;gap:6px;">` et remplacer par :
```js
<td><div class="row-actions">${photosBtn}...boutons...</div></td>
```

Idem dans `renderClients()`.

---

## ACCESSIBILITÉ  (+4 pts, 4 → 8)

---

### A-1 — Skip link  *(5 min, +0.5 pt)*

Permet aux utilisateurs clavier/lecteur d'écran d'aller directement au contenu.

**Fichier :** `partials/app-frame.html`  
**Ajouter en tout début du fichier** (avant `<div id="sidebar">`) :

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
```

**Fichier :** `css/styles.css` — **ajouter** :
```css
.skip-link{
 position:absolute;top:-100%;left:16px;z-index:9999;
 background:var(--accent2);color:#0f1923;padding:8px 16px;
 border-radius:0 0 8px 8px;font-weight:700;font-size:0.88rem;
 transition:top 0.15s;
}
.skip-link:focus{top:0;}
```

---

### A-2 — ARIA sur toutes les modales  *(20 min, +1.5 pts)*

**Fichiers :** `partials/modals-stack.html` (8 modales) + `partials/pages/page-*.html`
(modales inline éventuelles).

**Pattern à appliquer sur chaque `.modal-overlay`** :

```html
<!-- AVANT -->
<div class="modal-overlay" id="veh-modal">
 <div class="modal">
  <div class="modal-header">
   <h3 id="veh-modal-title">Ajouter un véhicule</h3>

<!-- APRÈS -->
<div class="modal-overlay" id="veh-modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="veh-modal-title"
     aria-hidden="true">
 <div class="modal">
  <div class="modal-header">
   <h3 id="veh-modal-title">Ajouter un véhicule</h3>
```

**Liste des modales et leurs `aria-labelledby`** :

| ID modal          | ID du titre             |
|-------------------|-------------------------|
| `veh-modal`       | `veh-modal-title`       |
| `client-modal`    | `client-modal-title`    |
| `res-modal`       | `res-modal-title`       |
| `maint-modal`     | `maint-modal-title`     |
| `pay-modal`       | `pay-modal-title`       |
| `hist-modal`      | `hist-modal-title`      |
| `contrat-modal`   | *(ajouter un id h3)*    |
| `rapport-modal`   | `rapport-modal-title`   |
| `al-confirm-overlay` | `al-confirm-title`   |
| `al-alert-overlay`   | `al-alert-msg`        |

**Fichier :** `js/01-app-core.js` — `openModal()` et `closeModal()` :

```js
// AVANT
function openModal(id){
 if(id==='res-modal'&&typeof populateResSelects==='function')populateResSelects();
 const el=document.getElementById(id);if(el)el.classList.add('open');
}
function closeModal(id){
 const el=document.getElementById(id);if(el)el.classList.remove('open');
 ...
}

// APRÈS
function openModal(id){
 if(id==='res-modal'&&typeof populateResSelects==='function')populateResSelects();
 const el=document.getElementById(id);
 if(!el)return;
 el.classList.add('open');
 el.setAttribute('aria-hidden','false');
 // mémoriser l'élément qui avait le focus pour le restaurer à la fermeture
 el._returnFocus=document.activeElement;
 // focus sur le premier champ interactif de la modale
 const first=el.querySelector('input,select,textarea,button:not(.close-btn)');
 if(first)setTimeout(()=>first.focus(),50);
}
function closeModal(id){
 const el=document.getElementById(id);
 if(!el)return;
 el.classList.remove('open');
 el.setAttribute('aria-hidden','true');
 // restaurer le focus
 if(el._returnFocus&&typeof el._returnFocus.focus==='function'){
  el._returnFocus.focus();
  el._returnFocus=null;
 }
 if(id==='veh-modal'){editingVehId=null;clearVehForm();}
 else if(id==='client-modal'){editingClientId=null;clearClientForm();}
 else if(id==='res-modal'){editingResId=null;clearResForm();}
 else if(id==='maint-modal'&&typeof window.resetMaintenanceEditState==='function'){
  window.resetMaintenanceEditState();
 }
}
```

---

### A-3 — aria-label sur les boutons icônes  *(25 min, +1 pt)*

**Fichier :** `js/01-app-core.js`

Dans `renderVehicules()`, modifier chaque `<button class="btn-icon"` pour ajouter
`aria-label` (remplacer `title` par `aria-label` — les deux peuvent coexister) :

```js
// AVANT
<button class="btn-icon" title="Historique" onclick="showHistVeh('${...}')">
<button class="btn-icon" title="Maintenance" onclick="openMaintModal();...">
<button class="btn-icon" title="Modifier" onclick="editVeh('${...}')">
<button class="btn-icon" title="Supprimer" onclick="deleteVeh('${...}')">

// APRÈS
<button class="btn-icon" title="Historique" aria-label="Voir l'historique du véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="showHistVeh('${...}')">
<button class="btn-icon" title="Maintenance" aria-label="Ajouter une maintenance pour ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="openMaintModal();...">
<button class="btn-icon" title="Modifier" aria-label="Modifier le véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="editVeh('${...}')">
<button class="btn-icon" title="Supprimer" aria-label="Supprimer le véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="deleteVeh('${...}')">
```

**Même principe** dans `renderClients()` :
```js
aria-label="Voir l'historique de ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}"
aria-label="Modifier le client ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}"
aria-label="Supprimer le client ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}"
```

Et dans `js/reservations-render.js` pour les boutons de la grille réservations.

---

### A-4 — Focus trap dans les modales  *(30 min, +1 pt)*

**Fichier :** `js/01-app-core.js`  
**Ajouter** après la définition de `closeModal()` :

```js
(function(){
 document.addEventListener('keydown',function(e){
  if(e.key!=='Tab'&&e.key!=='Escape')return;
  const openModal=document.querySelector('.modal-overlay.open');
  if(!openModal)return;
  if(e.key==='Escape'){
   // Trouver l'id de la modale ouverte et la fermer
   if(openModal.id)closeModal(openModal.id);
   return;
  }
  // Focus trap : garder le focus dans la modale
  const focusable=Array.from(openModal.querySelectorAll(
   'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  ));
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey){
   if(document.activeElement===first){last.focus();e.preventDefault();}
  }else{
   if(document.activeElement===last){first.focus();e.preventDefault();}
  }
 });
})();
```

> Gère aussi `Escape` pour fermer la modale au clavier (UX bonus).

---

## FIABILITÉ DES DONNÉES  (+2 pts, 12 → 14)

---

### F-1 — Consolidation des saves dans saveReservation()  *(25 min, +1 pt)*

`saveReservation()` peut déclencher jusqu'à 3 `save(KEYS.veh, ...)` successifs,
causant 3 événements `autoloc:saved` et 3 re-renders.

**Fichier :** `js/reservations-modal.js`

**Principe :** construire le tableau `vehs` final une seule fois, puis appeler
`save(KEYS.veh, vehs)` une seule fois à la fin.

```js
// AVANT (structure actuelle — sauvegardes éparses)
if(!editingId){
 if(r.statut==='en cours'){
  vehs=vehs.map(...loué...);
  save(KEYS.veh,vehs);          // save #1
 }
}else{
 ...
 save(KEYS.veh,vehs);           // save #2
}
save(KEYS.res,data);
releaseVehicleWhenNoActiveReservation(r.vehId);    // save #3 éventuel
if(editingId&&...)releaseVehicleWhenNoActiveReservation(existing.vehId); // save #4 éventuel

// APRÈS — une seule passe sur vehs, un seul save
var _vNow=new Date().toISOString();
var vehsToSave=null;  // null = pas de changement nécessaire

if(!editingId){
 if(r.statut==='en cours'){
  vehsToSave=vehs.map(function(x){
   return String(x.id)===String(vId)?{...x,statut:'loué',updatedAt:_vNow}:x;
  });
 }
}else{
 var oldRes=load(KEYS.res).find(function(x){return String(x.id)===editingId&&!x._deleted;});
 var oldStatut=oldRes&&oldRes.statut;
 var oldVehId=oldRes&&oldRes.vehId;
 vehsToSave=vehs.slice(); // copie de travail
 // libérer l'ancien véhicule si changement de véhicule
 if(oldStatut==='en cours'&&oldVehId!=null&&String(oldVehId)!==String(r.vehId)){
  vehsToSave=vehsToSave.map(function(x){
   return String(x.id)===String(oldVehId)?{...x,statut:'disponible',updatedAt:_vNow}:x;
  });
 }
 // statut du nouveau véhicule
 if(r.statut==='en cours'){
  vehsToSave=vehsToSave.map(function(x){
   return String(x.id)===String(vId)?{...x,statut:'loué',updatedAt:_vNow}:x;
  });
 }else if((r.statut==='terminée'||r.statut==='annulée')&&oldStatut==='en cours'){
  var vehToRelease=(oldVehId!=null&&String(oldVehId)!==String(r.vehId))?oldVehId:vId;
  vehsToSave=vehsToSave.map(function(x){
   return String(x.id)===String(vehToRelease)?{...x,statut:'disponible',updatedAt:_vNow}:x;
  });
 }
}
// vérifier qu'aucune réservation active ne bloque la libération
if(vehsToSave){
 [r.vehId,editingId&&existing.vehId].filter(Boolean).forEach(function(vid){
  var hasActive=load(KEYS.res).some(function(x){
   if(x._deleted||String(x.id)===editingId)return false;
   return String(x.vehId)===String(vid)&&x.statut==='en cours';
  });
  if(!hasActive&&r.statut!=='en cours'){
   vehsToSave=vehsToSave.map(function(x){
    return String(x.id)===String(vid)&&x.statut==='loué'
     ?{...x,statut:'disponible',updatedAt:_vNow}:x;
   });
  }
 });
 save(KEYS.veh,vehsToSave);   // UN SEUL SAVE
}
save(KEYS.res,data);
```

---

### F-1b — uid() → crypto.randomUUID() (voir Q-1, partagé)

Déjà décrit en Q-1. Élimine le risque de collision sur les IDs.  
Gain fiabilité : **+0.5 pt** (restant vers les 14/15).

---

## Checklist post-implémentation

Après chaque groupe de modifications :

```bash
# 1. Vérification syntaxe
node --check js/01-app-core.js
node --check js/alerts-ui.js        # si créé
node --check js/dashboard-ui.js     # si créé
node --check js/reservations-modal.js

# 2. Lint precache (scripts + fichiers ASSETS)
npm run lint

# 3. Tests backup schema
npm test

# 4. Incrémenter CACHE_NAME dans sw.js
#    pour chaque nouveau fichier ajouté à ASSETS
#    (ex. v92 → v93, etc.)

# 5. Smoke tests manuels (voir RELEASE-CHECKLIST.md)
#    - Offline DevTools → Network → Offline
#    - Créer/modifier une réservation → véhicule change de statut
#    - Exporter backup → réimporter
#    - Naviguer avec Tab → focus visible, modales
```

---

## Récapitulatif des fichiers modifiés

| Fichier                              | Actions                                        |
|--------------------------------------|------------------------------------------------|
| `js/01-app-core.js`                  | P-1, P-2, P-3, Q-1, A-2, A-3, A-4, U-4, U-5  |
| `js/reservations-modal.js`           | F-1                                            |
| `js/alerts-ui.js`                    | Créer (Q-2)                                    |
| `js/dashboard-ui.js`                 | Créer (Q-3)                                    |
| `css/styles.css`                     | U-1, U-2, U-4, U-5, A-1                       |
| `partials/app-frame.html`            | A-1                                            |
| `partials/modals-stack.html`         | A-2                                            |
| `partials/pages/page-vehicules.html` | U-4 (class data-table)                         |
| `partials/pages/page-clients.html`   | U-4                                            |
| `partials/pages/page-reservations.html` | U-4                                         |
| `partials/pages/page-maintenance.html`  | U-4                                         |
| `partials/pages/page-calendrier.html`   | U-3                                         |
| `sw.js`                              | Ajouter alerts-ui.js + dashboard-ui.js, ++ CACHE_NAME |
| `index.html`                         | Ajouter les 2 nouveaux scripts defer           |

---

## État final implémentation (avril 2026)

Tous les points du tableau **#1–#16** sont traités dans le code, avec la variante **P-2** décrite ci-dessus (map + `_dirty.dashboard` explicite sur `KEYS.cl`).

**Reste côté humain :** la checklist « Smoke tests manuels » en fin de document (offline, réservation/véhicule, backup, navigation clavier) avant une release.

---

*STRATEGY-85 — rapport initial 4 avril 2026 ; complément état dépôt & P-2 (avis) : avril 2026.*
