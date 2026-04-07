/**
 * Page Paramètres : jauge stockage, formulaire, conditions par défaut (texte partagé avec contrat).
 * Expose window.INVOO_CONDITIONS_DEFAUT avant le core (contract-print).
 * Branchement : invooParametresUi.attach({ KEYS, save, getSettings, addLog, alAlert, alConfirm, renderDashboard })
 */
(function (global) {
 'use strict';

 global.INVOO_CONDITIONS_DEFAUT =
  "Le véhicule doit être rendu propre et en bon état ; frais sur la caution en cas de dommage.\n" +
  "Respect obligatoire du Code de la Route marocain et des limitations de vitesse.\n" +
  "Seules les personnes mentionnées dans le contrat avec un permis valide peuvent conduire.\n" +
  "Interdiction de conduire sous alcool, drogues ou substances altérant les facultés.\n" +
  "Sortie du Maroc interdite sans autorisation écrite de l'agence.\n" +
  "Carburant à la charge du locataire, restitution au même niveau sous peine de majoration.\n" +
  "En cas d'accident, panne ou vol : contacter immédiatement l'agence et les autorités ; constat amiable requis.\n" +
  "Amendes et infractions à la charge du locataire.\n" +
  "Retard de restitution = facturation d'une journée complète par heure de dépassement non autorisée.\n" +
  "La caution est restituée après vérification ; l'agence peut récupérer le véhicule en cas de non-paiement ou usage frauduleux.";

 var ctx = null;
 var _logoPendingDataUrl = null;
 var _logoPendingW = 0;
 var _logoPendingH = 0;
 var _logoRemoveAfterSave = false;

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

 function setLogoFilenameUi(name) {
  var el = document.getElementById('p-logo-filename');
  if (el) el.textContent = name || '';
 }

 function syncLogoHeightSlider() {
  var el = document.getElementById('p-logo-height');
  var num = document.getElementById('p-logo-height-num');
  if (!el) return;
  var min = Number(el.min) || 16;
  var max = Number(el.max) || 400;
  var raw = Number(el.value);
  if (!Number.isFinite(raw)) raw = min;
  var v = Math.min(max, Math.max(min, Math.round(raw)));
  el.value = String(v);
  if (num) num.textContent = String(v);
  el.setAttribute('aria-valuenow', String(v));
  var pct = max <= min ? 0 : ((v - min) / (max - min)) * 100;
  el.style.setProperty('--p-logo-fill', pct + '%');
 }

 function bindLogoHeightSlider() {
  var el = document.getElementById('p-logo-height');
  if (!el || el.dataset.invooHeightSliderBound === '1') return;
  el.dataset.invooHeightSliderBound = '1';
  el.addEventListener('input', syncLogoHeightSlider);
  el.addEventListener('change', syncLogoHeightSlider);
  syncLogoHeightSlider();
 }

 function processLogoParamFile(file, fin) {
  if (!file || !fin) return;
  if (!/^image\//.test(file.type)) {
   if (typeof ctx.alAlert === 'function') {
    ctx.alAlert('Veuillez choisir une image (JPEG, PNG, WebP ou GIF).');
   }
   fin.value = '';
   setLogoFilenameUi('');
   return;
  }
  var fr = new FileReader();
  fr.onload = function () {
   var img = new Image();
   img.onload = function () {
    var maxH = 400;
    var nh = Math.min(img.height, maxH);
    var nw = Math.max(1, Math.round((img.width * nh) / img.height));
    var canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    var cx = canvas.getContext('2d');
    cx.drawImage(img, 0, 0, nw, nh);
    var url = canvas.toDataURL('image/jpeg', 0.88);
    _logoPendingDataUrl = url;
    _logoPendingW = nw;
    _logoPendingH = nh;
    _logoRemoveAfterSave = false;
    var prevImg = document.getElementById('p-logo-preview');
    var wrap = document.getElementById('p-logo-preview-wrap');
    if (prevImg) prevImg.src = url;
    if (wrap) wrap.style.display = 'flex';
    setLogoFilenameUi(file.name || 'Image sélectionnée');
   };
   img.onerror = function () {
    if (typeof ctx.alAlert === 'function') ctx.alAlert('Impossible de lire cette image.');
    fin.value = '';
    setLogoFilenameUi('');
   };
   img.src = fr.result;
  };
  fr.readAsDataURL(file);
 }

 function bindLogoParamControls() {
  if (global._invooLogoUiBound) return;
  global._invooLogoUiBound = true;
  var fin = document.getElementById('p-logo-file');
  var dz = document.getElementById('p-logo-dropzone');
  if (fin) {
   fin.addEventListener('change', function () {
    var file = fin.files && fin.files[0];
    if (!file) return;
    processLogoParamFile(file, fin);
   });
  }
  if (dz && fin) {
   ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) {
     e.preventDefault();
     e.stopPropagation();
    });
   });
   dz.addEventListener('dragover', function () {
    dz.classList.add('p-logo-dropzone--drag');
   });
   dz.addEventListener('dragleave', function (e) {
    var r = e.relatedTarget;
    if (!r || !dz.contains(r)) dz.classList.remove('p-logo-dropzone--drag');
   });
   dz.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove('p-logo-dropzone--drag');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    try {
     if (typeof DataTransfer !== 'undefined' && fin.files) {
      var dt = new DataTransfer();
      dt.items.add(f);
      fin.files = dt.files;
     }
    } catch (err) {}
    processLogoParamFile(f, fin);
   });
  }
  var btnRm = document.getElementById('p-logo-remove');
  if (btnRm) {
   btnRm.addEventListener('click', function () {
    _logoRemoveAfterSave = true;
    _logoPendingDataUrl = null;
    _logoPendingW = 0;
    _logoPendingH = 0;
    if (fin) fin.value = '';
    setLogoFilenameUi('');
    var wrap = document.getElementById('p-logo-preview-wrap');
    if (wrap) wrap.style.display = 'none';
   });
  }
 }

 function renderParametres() {
  var s = ctx.getSettings();
  _logoPendingDataUrl = null;
  _logoPendingW = 0;
  _logoPendingH = 0;
  _logoRemoveAfterSave = false;
  var fin = document.getElementById('p-logo-file');
  if (fin) fin.value = '';
  setLogoFilenameUi('');
  document.getElementById('p-nom').value = s.nom || 'INVOORENT';
  document.getElementById('p-slogan').value = s.slogan || 'Gérez, louez, développez';
  document.getElementById('p-tel').value = s.tel || '';
  document.getElementById('p-email').value = s.email || '';
  document.getElementById('p-adresse').value = s.adresse || '';
  document.getElementById('p-ville').value = s.ville || 'Tanger, Maroc';
  document.getElementById('p-site').value = s.site || '';
  document.getElementById('p-patente').value = s.patente || '';
  document.getElementById('p-iban').value = s.iban || '';
  document.getElementById('p-conditions').value =
   typeof s.conditions === 'string' ? s.conditions : condDef();
  var pEl = document.getElementById('p-etat-lieux-contrat');
  if (pEl) pEl.checked = s.etatLieuxContrat === true;
  var wrap = document.getElementById('p-logo-preview-wrap');
  var prevImg = document.getElementById('p-logo-preview');
  if (s.logoDataUrl && String(s.logoDataUrl).indexOf('data:image') === 0) {
   if (prevImg) prevImg.src = s.logoDataUrl;
   if (wrap) wrap.style.display = 'flex';
   setLogoFilenameUi('Logo enregistré');
  } else {
   if (wrap) wrap.style.display = 'none';
  }
  var lhEl = document.getElementById('p-logo-height');
  if (lhEl) {
   lhEl.value = s.logoHeightPx != null && s.logoHeightPx !== '' ? String(s.logoHeightPx) : '48';
   bindLogoHeightSlider();
   syncLogoHeightSlider();
  }
  var lia = document.getElementById('p-logo-infos-agence');
  if (lia) lia.checked = s.logoAfficherInfosAgence !== false;
  var ft = document.getElementById('p-document-footer');
  if (ft) ft.value = typeof s.documentFooter === 'string' ? s.documentFooter : '';
 }

 function saveParametres() {
  var KEYS = ctx.KEYS;
  var prev = ctx.getSettings() || {};
  var lhRaw = document.getElementById('p-logo-height');
  var lh = parseInt(lhRaw && lhRaw.value, 10);
  if (!Number.isFinite(lh)) lh = 48;
  lh = Math.min(400, Math.max(16, lh));
  var logoDataUrl = prev.logoDataUrl || '';
  var logoImgWidth = prev.logoImgWidth || 0;
  var logoImgHeight = prev.logoImgHeight || 0;
  if (_logoRemoveAfterSave) {
   logoDataUrl = '';
   logoImgWidth = 0;
   logoImgHeight = 0;
  } else if (_logoPendingDataUrl) {
   logoDataUrl = _logoPendingDataUrl;
   logoImgWidth = _logoPendingW;
   logoImgHeight = _logoPendingH;
  }
  var s = Object.assign({}, prev, {
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
   etatLieuxContrat: (function () {
    var pEl = document.getElementById('p-etat-lieux-contrat');
    return pEl ? !!pEl.checked : false;
   })(),
   logoDataUrl: logoDataUrl,
   logoImgWidth: logoImgWidth,
   logoImgHeight: logoImgHeight,
   logoHeightPx: lh,
   logoAfficherInfosAgence: (function () {
    var lia = document.getElementById('p-logo-infos-agence');
    return lia ? !!lia.checked : true;
   })(),
   documentFooter:
    (document.getElementById('p-document-footer') && document.getElementById('p-document-footer').value) || '',
  });
  _logoPendingDataUrl = null;
  _logoPendingW = 0;
  _logoPendingH = 0;
  _logoRemoveAfterSave = false;
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
  if (s.logoDataUrl && String(s.logoDataUrl).indexOf('data:image') === 0) {
   setLogoFilenameUi('Logo enregistré');
  } else {
   setLogoFilenameUi('');
  }
  if (typeof global.syncEtatLieuxBlockVisibility === 'function') {
   global.syncEtatLieuxBlockVisibility();
  }
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

 function reinitialiserConditions() {
  ctx.alConfirm({
   icon: '🔄',
   danger: true,
   title: 'Réinitialiser les conditions ?',
   msg:
    'Le texte des conditions générales sera effacé. Vous pourrez le saisir à nouveau, ou utiliser « Remettre par défaut » pour recharger les clauses officielles. Pensez à enregistrer les paramètres après modification.',
   okLabel: 'Effacer le texte',
   onOk: function () {
    var ta = document.getElementById('p-conditions');
    if (ta) ta.value = '';
   },
  });
 }

 global.invooParametresUi = {
  attach: function (c) {
   ctx = c;
   bindLogoParamControls();
   bindLogoHeightSlider();
   global.renderParametres = renderParametres;
   global.saveParametres = saveParametres;
   global.resetConditions = resetConditions;
   global.reinitialiserConditions = reinitialiserConditions;
   global.renderStorageGauge = renderStorageGauge;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
