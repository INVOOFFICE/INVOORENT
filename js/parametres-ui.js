/**
 * Page Paramètres : jauge stockage, formulaire, conditions par défaut (texte partagé avec contrat).
 * Expose window.INVOO_CONDITIONS_DEFAUT avant le core (contract-print).
 * Branchement : invooParametresUi.attach({ KEYS, save, getSettings, addLog, alAlert, alConfirm, renderDashboard })
 */
(function (global) {
 'use strict';

 global.INVOO_CONDITIONS_DEFAUT =
  "Le véhicule doit être restitué dans l'état dans lequel il a été remis au locataire.\n" +
  'Tout dommage causé au véhicule sera à la charge du locataire selon le contrat d\'assurance en vigueur.\n' +
  'Le carburant est à la charge du locataire — le véhicule doit être restitué avec le même niveau.\n' +
  'En cas de panne ou d\'accident, le locataire doit en informer immédiatement l\'agence.\n' +
  'Le dépassement de la date de retour sans accord préalable entraîne une facturation supplémentaire.\n' +
  "L'utilisation du véhicule hors du territoire convenu est interdite sans autorisation écrite de l'agence.\n" +
  'La caution sera restituée intégralement après vérification du bon état du véhicule.';

 var ctx = null;

 function condDef() {
  return global.INVOO_CONDITIONS_DEFAUT || '';
 }

 function renderStorageGauge() {
  var wrap = document.getElementById('storage-gauge-wrap');
  if (!wrap) return;
  if (global.OPFS && global.OPFS._ready) {
   wrap.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(45,212,191,0.14) 0%,rgba(20,31,43,0.96) 55%,rgba(94,234,212,0.1) 100%);border:1.5px solid rgba(45,212,191,0.35);border-radius:10px;padding:16px 18px"><div style="width:36px;height:36px;border-radius:10px;background:rgba(45,212,191,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg fill="none" viewBox="0 0 24 24" stroke="#5eead4" stroke-width="2" style="width:18px;height:18px"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><p style="font-size:0.88rem;font-weight:700;color:#ccfbf1;margin-bottom:2px">Stockage illimité actif</p><p style="font-size:0.78rem;color:#99f6e4">OPFS — Origin Private File System. Vos données et photos n\'ont aucune limite d\'espace.</p></div></div>';
   return;
  }
  var total = 0;
  var breakdown = {};
  for (var k in localStorage) {
   if (!Object.prototype.hasOwnProperty.call(localStorage, k)) continue;
   var bytes = (localStorage[k].length + k.length) * 2;
   total += bytes;
   if (k.startsWith('autoloc_photos')) breakdown.Photos = (breakdown.Photos || 0) + bytes;
   else if (k.startsWith('autoloc_veh')) breakdown.Véhicules = (breakdown.Véhicules || 0) + bytes;
   else if (k.startsWith('autoloc_res')) breakdown.Réservations = (breakdown.Réservations || 0) + bytes;
   else if (k.startsWith('autoloc_cl')) breakdown.Clients = (breakdown.Clients || 0) + bytes;
   else if (k.startsWith('autoloc_maint')) breakdown.Maintenance = (breakdown.Maintenance || 0) + bytes;
   else if (k.startsWith('autoloc_log')) breakdown.Journal = (breakdown.Journal || 0) + bytes;
   else breakdown.Autre = (breakdown.Autre || 0) + bytes;
  }
  var maxBytes = 5 * 1024 * 1024;
  var pct = Math.min(100, Math.round((total / maxBytes) * 100));
  var totalKb = Math.round(total / 1024);
  var color = pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981';
  var fmtKb = function (b) {
   return b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(2) + ' MB';
  };
  var rows = Object.entries(breakdown)
   .sort(function (a, b) {
    return b[1] - a[1];
   })
   .map(function (entry) {
    var kk = entry[0];
    var v = entry[1];
    var p = Math.round((v / total) * 100) || 0;
    return (
     '<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><span style="font-size:0.78rem;color:var(--text2);width:110px;flex-shrink:0">' +
     kk +
     '</span><div style="flex:1;height:5px;background:var(--surface3);border-radius:3px;overflow:hidden"><div style="height:100%;width:' +
     p +
     '%;background:' +
     color +
     ';border-radius:3px;transition:width 0.4s"></div></div><span style="font-size:0.73rem;color:var(--text3);width:60px;text-align:right;flex-shrink:0">' +
     fmtKb(v) +
     '</span></div>'
    );
   })
   .join('');
  wrap.innerHTML =
   '<div style="background:rgba(251,191,36,0.12);border:1.5px solid rgba(251,191,36,0.36);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:0.8rem;color:#fde68a">\n ⚠ OPFS non disponible — utilisez Chrome ou Edge pour un stockage illimité.\n</div><div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:0.82rem;font-weight:600;color:var(--text)">' +
   totalKb +
   ' KB utilisés sur ~5 120 KB</span><span style="font-size:0.78rem;font-weight:700;color:' +
   color +
   '">' +
   pct +
   '%</span></div><div style="height:8px;background:var(--surface3);border-radius:4px;overflow:hidden"><div style="height:100%;width:' +
   pct +
   '%;background:' +
   color +
   ';border-radius:4px;transition:width 0.6s var(--ease-out)"></div></div>\n ' +
   (pct > 80
    ? '<p style="font-size:0.75rem;color:#fca5a5;margin-top:6px">⚠️ Stockage presque plein — passez à Chrome ou Edge pour activer OPFS</p>'
    : '') +
   '\n</div>\n ' +
   (rows.length ? '<div style="border-top:1px solid var(--border);padding-top:8px">' + rows + '</div>' : '');
 }

 function renderParametres() {
  var s = ctx.getSettings();
  document.getElementById('p-nom').value = s.nom || 'INVOORENT';
  document.getElementById('p-slogan').value = s.slogan || 'Gérez, louez, développez';
  document.getElementById('p-tel').value = s.tel || '';
  document.getElementById('p-email').value = s.email || '';
  document.getElementById('p-adresse').value = s.adresse || '';
  document.getElementById('p-ville').value = s.ville || 'Tanger, Maroc';
  document.getElementById('p-site').value = s.site || '';
  document.getElementById('p-patente').value = s.patente || '';
  document.getElementById('p-iban').value = s.iban || '';
  document.getElementById('p-conditions').value = s.conditions || condDef();
 }

 function saveParametres() {
  var KEYS = ctx.KEYS;
  var s = {
   nom: document.getElementById('p-nom').value.trim(),
   slogan: document.getElementById('p-slogan').value.trim(),
   tel: document.getElementById('p-tel').value.trim(),
   email: document.getElementById('p-email').value.trim(),
   adresse: document.getElementById('p-adresse').value.trim(),
   ville: document.getElementById('p-ville').value.trim(),
   site: document.getElementById('p-site').value.trim(),
   patente: document.getElementById('p-patente').value.trim(),
   iban: document.getElementById('p-iban').value.trim(),
   conditions: document.getElementById('p-conditions').value,
  };
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
   if (typeof ctx.alAlert === 'function') {
    ctx.alAlert('Adresse email invalide.');
   }
   return;
  }
  if (typeof ctx.save === 'function') {
   ctx.save(KEYS.settings, s);
  } else {
   localStorage.setItem(KEYS.settings, JSON.stringify(s));
   if (global.OPFS && global.OPFS.write) {
    global.OPFS.write(KEYS.settings, s).catch(function () {});
   }
  }
  var brandH1 = document.querySelector('.sidebar-brand h1');
  if (brandH1 && s.nom) {
   var parts = s.nom.split(' ').filter(Boolean);
   brandH1.textContent = '';
   if (parts.length > 1) {
    brandH1.appendChild(document.createTextNode(parts.slice(0, -1).join(' ') + ' '));
    var span = document.createElement('span');
    span.textContent = parts[parts.length - 1];
    brandH1.appendChild(span);
   } else {
    var spanOne = document.createElement('span');
    spanOne.textContent = s.nom;
    brandH1.appendChild(spanOne);
   }
  }
  var toast = document.getElementById('save-toast');
  if (toast) {
   toast.classList.add('show');
   setTimeout(function () {
    toast.classList.remove('show');
   }, 2500);
  }
  ctx.addLog('Paramètres mis à jour');
  if (typeof ctx.renderDashboard === 'function') {
   ctx.renderDashboard();
  }
 }

 function resetConditions() {
  ctx.alConfirm({
   icon: '📄',
   danger: false,
   title: 'Remettre les conditions par défaut ?',
   msg: "Le texte actuel sera remplacé par les conditions générales d'origine.",
   okLabel: 'Remettre par défaut',
   onOk: function () {
    document.getElementById('p-conditions').value = condDef();
   },
  });
 }

 global.invooParametresUi = {
  attach: function (c) {
   ctx = c;
   global.renderParametres = renderParametres;
   global.saveParametres = saveParametres;
   global.resetConditions = resetConditions;
   global.renderStorageGauge = renderStorageGauge;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
