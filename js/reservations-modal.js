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
  var rm = document.getElementById('res-modal');
  var domId = rm && rm.dataset.editingResId ? String(rm.dataset.editingResId) : '';
  var editId = domId || (ctx.getEditingId() ? String(ctx.getEditingId()) : null);
  var currentRes = editId
   ? load(KEYS.res).find(function (r) { return String(r.id) === editId && !r._deleted; })
   : null;
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
   if (currentVehId != null && currentVehId !== '' && String(v.id) === String(currentVehId)) return true;
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
  if (global.invooEtatLieux && typeof global.invooEtatLieux.mount === 'function') {
   global.invooEtatLieux.mount('res-etat-lieux-root');
  }
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
  var v = vehs.find(function (x) { return String(x.id) === String(vId) && !x._deleted; });
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

 /** Rafraîchit toutes les vues qui lisent réservations / véhicules / clients (même page active). */
 function afterReservationDataChanged() {
  if (!ctx) return;
  global.renderReservations();
  if (typeof global.renderVehicules === 'function') global.renderVehicules();
  if (typeof global.renderCalendar === 'function') global.renderCalendar();
  if (typeof global.renderClients === 'function') global.renderClients();
  if (typeof ctx.renderDashboard === 'function') ctx.renderDashboard();
  if (typeof ctx.renderAlerts === 'function') ctx.renderAlerts();
 }

 /** Remet le véhicule en « disponible » s'il est « loué » et qu'aucune réservation active (non supprimée) ne l'utilise. */
 function releaseVehicleWhenNoActiveReservation(vehId) {
  if (!ctx || !vehId) return;
  var load = ctx.load;
  var save = ctx.save;
  var KEYS = ctx.KEYS;
  var now = new Date().toISOString();
  var vid = String(vehId);
  var hasActive = load(KEYS.res).some(function (x) {
   if (x._deleted) return false;
   if (String(x.vehId) !== vid) return false;
   if (x.statut !== 'en cours') return false;
   return true;
  });
  if (hasActive) return;
  var vehs = load(KEYS.veh);
  var changed = false;
  vehs = vehs.map(function (v) {
   if (String(v.id) !== vid || v.statut !== 'loué') return v;
   changed = true;
   return { ...v, statut: 'disponible', updatedAt: now };
  });
  if (changed) save(KEYS.veh, vehs);
 }

 /**
  * Met le véhicule en disponible s'il est encore « loué » et qu'aucune réservation
  * de resList n'est « en cours » pour ce véhicule (état final après sauvegarde).
  */
 function releaseVehIfNoActiveReservation(vehsIn, resList, vehId, now) {
  if (!vehId) return vehsIn;
  var vid = String(vehId);
  var hasActive = resList.some(function (x) {
   if (x._deleted) return false;
   if (String(x.vehId) !== vid) return false;
   if (x.statut !== 'en cours') return false;
   return true;
  });
  if (hasActive) return vehsIn;
  return vehsIn.map(function (v) {
   if (String(v.id) !== vid || v.statut !== 'loué') return v;
   return { ...v, statut: 'disponible', updatedAt: now };
  });
 }

 function saveReservation() {
  if (!ctx) return;
  var load = ctx.load;
  var save = ctx.save;
  var KEYS = ctx.KEYS;
  var uid = ctx.uid;
  var resModalEl = document.getElementById('res-modal');
  var domResId = resModalEl && resModalEl.dataset.editingResId ? String(resModalEl.dataset.editingResId) : '';
  var editingId = domResId || (ctx.getEditingId() ? String(ctx.getEditingId()) : null);
  if (editingId) ctx.setEditingId(editingId);

  var vId = document.getElementById('res-veh').value;
  var v = load(KEYS.veh).find(function (x) { return String(x.id) === String(vId) && !x._deleted; });
  var d1 = document.getElementById('res-debut').value;
  var d2 = document.getElementById('res-fin').value;
  var days = d1 && d2 ? Math.max(1, Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24))) : 0;
  var existingRaw = editingId
   ? load(KEYS.res).find(function (x) { return String(x.id) === editingId; })
   : null;
  var existing = existingRaw && !existingRaw._deleted ? existingRaw : {};
  var etatLieuxSnap =
   global.invooEtatLieux && typeof global.invooEtatLieux.getData === 'function'
    ? global.invooEtatLieux.getData('res-etat-lieux-root')
    : undefined;
  var r = Object.assign({}, existing, {
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
   caution: existing.caution != null ? existing.caution : 0,
   cautionStatut: existing.cautionStatut || 'non',
   etatLieux: etatLieuxSnap !== undefined ? etatLieuxSnap : existing.etatLieux || null,
  });
  delete r._deleted;
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
   if (x._deleted) return false;
   if (editingId && String(x.id) === editingId) return false;
   if (String(x.vehId) !== String(r.vehId)) return false;
   if (x.statut === 'annulée' || x.statut === 'terminée') return false;
   var xDebut = new Date(x.debut);
   var xFin = new Date(x.fin);
   return debut < xFin && fin > xDebut;
  });
  if (conflit) {
   var c = load(KEYS.cl).find(function (x) {
    if (x._deleted) return false;
    return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
     ? global.AutoLocCoreUtils.idEq(x.id, conflit.clientId)
     : String(x.id) === String(conflit.clientId);
   });
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
  var resSnapshot = load(KEYS.res);
  var oldRes = editingId
   ? resSnapshot.find(function (x) {
      return String(x.id) === editingId && !x._deleted;
     })
   : null;
  var data;
  if (editingId) {
   data = resSnapshot.map(function (x) {
    return String(x.id) === editingId ? r : x;
   });
   ctx.addLog('Réservation modifiée');
  } else {
   data = resSnapshot.slice();
   data.push(r);
   var cl = load(KEYS.cl).find(function (c) {
    if (c._deleted) return false;
    return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
     ? global.AutoLocCoreUtils.idEq(c.id, r.clientId)
     : String(c.id) === String(r.clientId);
   });
   ctx.addLog(
    'Nouvelle réservation — ' + (cl ? cl.prenom : '') + ' / ' + (v ? v.marque : '') + ' ' + (v ? v.modele : '')
   );
  }
  var vehs = load(KEYS.veh);
  var vehSnap = JSON.stringify(vehs);
  if (!editingId) {
   if (r.statut === 'en cours') {
    vehs = vehs.map(function (x) {
     return String(x.id) === String(vId) ? { ...x, statut: 'loué', updatedAt: _vNow } : x;
    });
   }
  } else {
   var oldStatut = oldRes && oldRes.statut;
   var oldVehId = oldRes && oldRes.vehId;
   if (oldStatut === 'en cours' && oldVehId != null && String(oldVehId) !== String(r.vehId)) {
    vehs = vehs.map(function (x) {
     return String(x.id) === String(oldVehId) ? { ...x, statut: 'disponible', updatedAt: _vNow } : x;
    });
   }
   if (r.statut === 'en cours') {
    vehs = vehs.map(function (x) {
     return String(x.id) === String(vId) ? { ...x, statut: 'loué', updatedAt: _vNow } : x;
    });
   } else if ((r.statut === 'terminée' || r.statut === 'annulée') && oldStatut === 'en cours') {
    var vehToRelease = oldVehId != null && String(oldVehId) !== String(r.vehId) ? oldVehId : vId;
    vehs = vehs.map(function (x) {
     return String(x.id) === String(vehToRelease) ? { ...x, statut: 'disponible', updatedAt: _vNow } : x;
    });
   }
  }
  vehs = releaseVehIfNoActiveReservation(vehs, data, r.vehId, _vNow);
  if (editingId && existing.vehId != null && String(existing.vehId) !== String(r.vehId)) {
   vehs = releaseVehIfNoActiveReservation(vehs, data, existing.vehId, _vNow);
  }
  if (JSON.stringify(vehs) !== vehSnap) {
   save(KEYS.veh, vehs);
  }
  save(KEYS.res, data);
  ctx.closeModal('res-modal');
  afterReservationDataChanged();
 }

 function editRes(id) {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var sid = String(id);
  var r = load(KEYS.res).find(function (x) { return String(x.id) === sid && !x._deleted; });
  if (!r) return;
  ctx.setEditingId(sid);
  var rm = document.getElementById('res-modal');
  if (rm) rm.dataset.editingResId = sid;
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
   if (global.invooEtatLieux && typeof global.invooEtatLieux.setData === 'function') {
    global.invooEtatLieux.setData('res-etat-lieux-root', r.etatLieux || null);
   }
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
    var sid = String(id);
    var data = load(KEYS.res);
    var r = data.find(function (x) { return String(x.id) === sid && !x._deleted; });
    if (!r) return;
    data = data.map(function (x) {
     return String(x.id) === sid ? { ...x, statut: 'terminée', updatedAt: new Date().toISOString() } : x;
    });
    save(KEYS.res, data);
    if (r) {
     releaseVehicleWhenNoActiveReservation(r.vehId);
     ctx.addLog('Location clôturée');
    }
    afterReservationDataChanged();
   },
  });
 }

 function sendWhatsApp(id) {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var sid = String(id);
  var res = load(KEYS.res).find(function (r) { return String(r.id) === sid && !r._deleted; });
  if (!res) return;
  var cl = load(KEYS.cl).find(function (c) { return !c._deleted && String(c.id) === String(res.clientId); });
  var veh = load(KEYS.veh).find(function (v) { return !v._deleted && String(v.id) === String(res.vehId); });
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
  var vehStr = veh ? veh.marque + ' ' + veh.modele + ' (' + veh.immat + ')' : '—';
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
    var sid = String(id);
    var r = load(KEYS.res).find(function (x) { return String(x.id) === sid && !x._deleted; });
    if (!r) return;
    save(
     KEYS.res,
     load(KEYS.res).map(function (x) {
      return String(x.id) === sid ? { ...x, _deleted: true, updatedAt: new Date().toISOString() } : x;
     })
    );
    if (r && r.vehId) {
     releaseVehicleWhenNoActiveReservation(r.vehId);
    }
    ctx.addLog('Réservation supprimée');
    afterReservationDataChanged();
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
