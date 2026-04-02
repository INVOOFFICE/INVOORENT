/**
 * Modal réservation : listes, total, enregistrement, clôture, suppression, WhatsApp.
 * Branchement : invooReservationsModal.attach({ ... }) depuis 01-app-core.js
 */
(function (global) {
 'use strict';

 var ctx = null;

 function populateResSelects() {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var selC = document.getElementById('res-client');
  var selV = document.getElementById('res-veh');
  if (!selC || !selV) return;
  var editId = ctx.getEditingId();
  var currentRes = editId ? load(KEYS.res).find(function (r) { return r.id === editId; }) : null;
  var currentVehId = currentRes ? currentRes.vehId : null;

  var clients = load(KEYS.cl).filter(function (c) { return !c._deleted; });
  selC.innerHTML =
   '<option value="">-- Sélectionner un client --</option>' +
   clients
    .map(function (c) {
     return (
      '<option value="' +
      window.AutoLocUtils.escapeHtml(c.id) +
      '">' +
      window.AutoLocUtils.escapeHtml(c.prenom + ' ' + c.nom) +
      '</option>'
     );
    })
    .join('');

  var vehs = load(KEYS.veh).filter(function (v) { return !v._deleted; });
  var listV = vehs.filter(function (v) {
   if (v.statut === 'disponible') return true;
   if (currentVehId && v.id === currentVehId) return true;
   return false;
  });
  selV.innerHTML =
   '<option value="">-- Sélectionner un véhicule --</option>' +
   listV
    .map(function (v) {
     return (
      '<option value="' +
      window.AutoLocUtils.escapeHtml(v.id) +
      '">' +
      window.AutoLocUtils.escapeHtml(v.marque + ' ' + v.modele + ' (' + v.immat + ')') +
      '</option>'
     );
    })
    .join('');
 }

 function updateResTotal() {
  if (!ctx) return;
  var d1El = document.getElementById('res-debut');
  var d2El = document.getElementById('res-fin');
  var vEl = document.getElementById('res-veh');
  var preview = document.getElementById('res-total-preview');
  if (!preview || !d1El || !d2El || !vEl) return;
  var d1 = d1El.value;
  var d2 = d2El.value;
  var vId = vEl.value;
  if (!d1 || !d2 || !vId) {
   preview.style.display = 'none';
   return;
  }
  var vehs = ctx.load(ctx.KEYS.veh);
  var v = vehs.find(function (x) { return x.id === vId; });
  var days = Math.max(1, Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24)));
  var tarif = v && Number.isFinite(v.tarif) ? v.tarif : 0;
  var total = days * tarif;
  preview.style.display = 'block';
  preview.innerHTML =
   '<strong>' +
   days +
   '</strong> jour' +
   (days > 1 ? 's' : '') +
   ' × <strong>' +
   tarif.toLocaleString('fr-FR') +
   ' MAD</strong>/jour = <strong style="color:var(--success)">' +
   total.toLocaleString('fr-FR') +
   ' MAD</strong>';
 }

 function saveReservation() {
  if (!ctx) return;
  var load = ctx.load;
  var save = ctx.save;
  var KEYS = ctx.KEYS;
  var uid = ctx.uid;
  var editingId = ctx.getEditingId();

  var vId = document.getElementById('res-veh').value;
  var v = load(KEYS.veh).find(function (x) { return x.id === vId; });
  var d1 = document.getElementById('res-debut').value;
  var d2 = document.getElementById('res-fin').value;
  var days = d1 && d2 ? Math.max(1, Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24))) : 0;
  var existing = editingId ? load(KEYS.res).find(function (x) { return x.id === editingId; }) || {} : {};
  var r = {
   id: editingId || uid(),
   clientId: document.getElementById('res-client').value,
   vehId: vId,
   debut: d1,
   fin: d2,
   lieu: document.getElementById('res-lieu').value.trim(),
   statut: document.getElementById('res-statut').value,
   notes: document.getElementById('res-notes').value.trim(),
   total: days * (v ? v.tarif || 0 : 0),
   createdAt: existing.createdAt || new Date().toISOString(),
   updatedAt: new Date().toISOString(),
   paiements: existing.paiements || [],
   caution: existing.caution || 0,
   cautionStatut: existing.cautionStatut || 'non',
  };
  if (!r.clientId || !r.vehId || !r.debut || !r.fin) {
   ctx.alAlert('Veuillez remplir tous les champs obligatoires.');
   return;
  }
  if (new Date(r.fin) <= new Date(r.debut)) {
   ctx.alAlert('La date de fin doit être postérieure à la date de début.');
   return;
  }
  if (!v) {
   ctx.alAlert('Véhicule introuvable. Veuillez recharger la page.');
   return;
  }
  if (!['en cours', 'terminée', 'annulée'].includes(r.statut)) {
   ctx.alAlert('Statut de réservation invalide.');
   return;
  }
  if (r.total < 0 || (v && v.tarif < 0)) {
   ctx.alAlert('Le tarif journalier ne peut pas être négatif.');
   return;
  }
  var reservations = load(KEYS.res);
  var debut = new Date(r.debut);
  var fin = new Date(r.fin);
  var conflit = reservations.find(function (x) {
   if (x.id === editingId) return false;
   if (x.vehId !== r.vehId) return false;
   if (x.statut === 'annulée' || x.statut === 'terminée') return false;
   var xDebut = new Date(x.debut);
   var xFin = new Date(x.fin);
   return debut < xFin && fin > xDebut;
  });
  if (conflit) {
   var c = load(KEYS.cl).find(function (x) { return x.id === conflit.clientId; });
   var nomClient = c ? c.prenom + ' ' + c.nom : 'un autre client';
   ctx.alAlert(
    '⚠️ Conflit de réservation !\n\nCe véhicule est déjà réservé par ' +
     nomClient +
     ' du ' +
     conflit.debut +
     ' au ' +
     conflit.fin +
     '.\n\nChoisissez un autre véhicule ou des dates différentes.'
   );
   return;
  }
  var _vNow = new Date().toISOString();
  var vehs = load(KEYS.veh);
  if (!editingId) {
   if (r.statut === 'en cours') {
    vehs = vehs.map(function (x) {
     return x.id === vId ? { ...x, statut: 'loué', updatedAt: _vNow } : x;
    });
    save(KEYS.veh, vehs);
   }
  } else {
   var oldRes = load(KEYS.res).find(function (x) { return x.id === editingId; });
   var oldStatut = oldRes && oldRes.statut;
   var oldVehId = oldRes && oldRes.vehId;
   if (oldStatut === 'en cours' && oldVehId && oldVehId !== r.vehId) {
    vehs = vehs.map(function (x) {
     return x.id === oldVehId ? { ...x, statut: 'disponible', updatedAt: _vNow } : x;
    });
   }
   if (r.statut === 'en cours') {
    vehs = vehs.map(function (x) {
     return x.id === vId ? { ...x, statut: 'loué', updatedAt: _vNow } : x;
    });
   } else if ((r.statut === 'terminée' || r.statut === 'annulée') && oldStatut === 'en cours') {
    var vehToRelease = oldVehId && oldVehId !== r.vehId ? oldVehId : vId;
    vehs = vehs.map(function (x) {
     return x.id === vehToRelease ? { ...x, statut: 'disponible', updatedAt: _vNow } : x;
    });
   }
   save(KEYS.veh, vehs);
  }
  var data = load(KEYS.res);
  if (editingId) {
   data = data.map(function (x) {
    return x.id === editingId ? r : x;
   });
   ctx.addLog('Réservation modifiée');
  } else {
   data.push(r);
   var cl = load(KEYS.cl).find(function (c) { return c.id === r.clientId; });
   ctx.addLog(
    'Nouvelle réservation — ' + (cl ? cl.prenom : '') + ' / ' + (v ? v.marque : '') + ' ' + (v ? v.modele : '')
   );
  }
  save(KEYS.res, data);
  ctx.closeModal('res-modal');
  global.renderReservations();
 }

 function editRes(id) {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var r = load(KEYS.res).find(function (x) { return x.id === id; });
  if (!r) return;
  ctx.setEditingId(id);
  document.getElementById('res-modal-title').textContent = 'Modifier la réservation';
  populateResSelects();
  setTimeout(function () {
   document.getElementById('res-client').value = r.clientId;
   document.getElementById('res-veh').value = r.vehId;
   document.getElementById('res-debut').value = window.AutoLocCoreUtils.normalizeDateInputValue(r.debut) || '';
   document.getElementById('res-fin').value = window.AutoLocCoreUtils.normalizeDateInputValue(r.fin) || '';
   document.getElementById('res-lieu').value = r.lieu || '';
   document.getElementById('res-statut').value = r.statut;
   document.getElementById('res-notes').value = r.notes || '';
   document.getElementById('res-debut').dispatchEvent(new Event('input'));
   document.getElementById('res-fin').dispatchEvent(new Event('input'));
   updateResTotal();
  }, 50);
  ctx.openModal('res-modal');
 }

 function closeRental(id) {
  if (!ctx) return;
  ctx.alConfirm({
   icon: '✅',
   danger: false,
   title: 'Clôturer cette location ?',
   msg: 'Le véhicule sera remis en statut "disponible".',
   okLabel: 'Clôturer',
   onOk: function () {
    var load = ctx.load;
    var save = ctx.save;
    var KEYS = ctx.KEYS;
    var data = load(KEYS.res);
    var r = data.find(function (x) { return x.id === id; });
    data = data.map(function (x) {
     return x.id === id ? { ...x, statut: 'terminée', updatedAt: new Date().toISOString() } : x;
    });
    save(KEYS.res, data);
    if (r) {
     var vehs = load(KEYS.veh);
     vehs = vehs.map(function (v) {
      return v.id === r.vehId ? { ...v, statut: 'disponible', updatedAt: new Date().toISOString() } : v;
     });
     save(KEYS.veh, vehs);
     ctx.addLog('Location clôturée');
    }
    global.renderReservations();
    ctx.renderAlerts();
   },
  });
 }

 function sendWhatsApp(id) {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var res = load(KEYS.res).find(function (r) { return r.id === id; });
  if (!res) return;
  var cl = load(KEYS.cl).find(function (c) { return c.id === res.clientId; });
  var veh = load(KEYS.veh).find(function (v) { return v.id === res.vehId; });
  var rawTel = cl && cl.tel ? cl.tel.replace(/[\s\-().]/g, '') : '';
  var tel = rawTel;
  if (tel.startsWith('00')) tel = '+' + tel.slice(2);
  if (tel.startsWith('0') && !tel.startsWith('00')) tel = '+212' + tel.slice(1);
  if (!tel.startsWith('+')) tel = '+212' + tel;
  tel = tel.replace('+', '');
  var agence = (function () {
   try {
    return ctx.getSettings().nom || 'notre agence';
   } catch (e) {
    return 'notre agence';
   }
  })();
  var prenom = cl ? cl.prenom : 'Client';
  var vehStr = veh ? veh.marque + ' ' + veh.modele + '(' + veh.immat + ')' : '—';
  var debut = res.debut || '—';
  var fin = res.fin || '—';
  var lieu = res.lieu || 'notre agence';
  var total = res.total ? res.total + ' MAD' : '—';
  var paid = (res.paiements || []).reduce(function (s, p) {
   return s + p.montant;
  }, 0);
  var reste = res.total ? Math.max(0, res.total - paid) : 0;
  var msg =
   'Bonjour ' +
   prenom +
   '👋,\nVoici le récapitulatif de votre location chez *' +
   agence +
   '* :\n🚗 *Véhicule :* ' +
   vehStr +
   '\n📅 *Période :* ' +
   debut +
   '→ ' +
   fin +
   '\n📍 *Lieu de prise en charge :* ' +
   lieu +
   '\n💰 *Total :* ' +
   total +
   (reste > 0 ? '\n✅ *Reste à payer :* ' + reste + ' MAD' : '\n✅ *Solde : Réglé*') +
   (res.notes ? '\n📝 *Notes :* ' + res.notes : '') +
   '\nMerci de votre confiance!🙏\n_' +
   agence +
   '_';
  var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(msg);
  global.open(url, '_blank');
 }

 function deleteRes(id) {
  if (!ctx) return;
  ctx.alConfirm({
   icon: '🗑',
   danger: true,
   title: 'Supprimer cette réservation ?',
   msg: 'Cette action est irréversible. Le véhicule sera remis disponible si la location était en cours.',
   okLabel: 'Supprimer',
   onOk: function () {
    var load = ctx.load;
    var save = ctx.save;
    var KEYS = ctx.KEYS;
    var r = load(KEYS.res).find(function (x) { return x.id === id; });
    save(
     KEYS.res,
     load(KEYS.res).map(function (x) {
      return x.id === id ? { ...x, _deleted: true, updatedAt: new Date().toISOString() } : x;
     })
    );
    if (r && r.statut === 'en cours') {
     var vehs = load(KEYS.veh);
     vehs = vehs.map(function (v) {
      return v.id === r.vehId ? { ...v, statut: 'disponible', updatedAt: new Date().toISOString() } : v;
     });
     save(KEYS.veh, vehs);
    }
    ctx.addLog('Réservation supprimée');
    global.renderReservations();
    ctx.renderDashboard();
   },
  });
 }

 global.invooReservationsModal = {
  attach: function (c) {
   ctx = c;
   global.populateResSelects = populateResSelects;
   global.updateResTotal = updateResTotal;
   global.saveReservation = saveReservation;
   global.editRes = editRes;
   global.closeRental = closeRental;
   global.sendWhatsApp = sendWhatsApp;
   global.deleteRes = deleteRes;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
