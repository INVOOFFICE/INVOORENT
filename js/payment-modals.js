/**
 * Modal paiements / caution (dashboard impayés + réservations).
 * invooPaymentModals.attach({ load, save, KEYS, alAlert, alConfirm, addLog, renderReservations, renderDashboard, renderAlerts, initNativeDatePickers })
 * — renderReservations : window.renderReservations (js/reservations-render.js après attach)
 */
(function (global) {
  'use strict';

  var ctx = null;
  var payResId = null;

  function c() {
    return ctx;
  }

  function renderPayModal() {
    var x = c();
    if (!x) return;
    var load = x.load;
    var KEYS = x.KEYS;
    var pid = payResId != null ? String(payResId) : '';
    var r = load(KEYS.res).find(function (it) {
      return String(it.id) === pid;
    });
    if (!r) return;
    var cl = load(KEYS.cl).find(function (it) {
      return String(it.id) === String(r.clientId);
    });
    var v = load(KEYS.veh).find(function (it) {
      return String(it.id) === String(r.vehId);
    });
    var paiements = r.paiements || [];
    var caution = r.caution || 0;
    var cautionStatut = r.cautionStatut || 'non';
    var total = r.total || 0;
    var paid = paiements.reduce(function (s, p) {
      return s + p.montant;
    }, 0);
    var reste = Math.max(0, total - paid);
    var pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    var fmt = function (d) {
      return d ? new Date(d).toLocaleDateString('fr-FR') : '';
    };
    var modeIcons = {
      Espèces:
        '<path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/>',
      Virement: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
      Chèque:
        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'
    };
    var avancePaid = paiements
      .filter(function (p) {
        return p.type === 'avance';
      })
      .reduce(function (s, p) {
        return s + p.montant;
      }, 0);
    var soldePaid = paiements
      .filter(function (p) {
        return p.type === 'solde';
      })
      .reduce(function (s, p) {
        return s + p.montant;
      }, 0);
    document.getElementById('pay-modal-title').textContent =
      'Paiements — ' + (cl ? cl.prenom + ' ' + cl.nom : '');
    document.getElementById('pay-modal-body').innerHTML =
      '<p style="font-size:0.8rem;color:var(--text2);margin-bottom:14px">' +
      (v
        ? global.AutoLocUtils.escapeHtml(v.marque) +
          ' ' +
          global.AutoLocUtils.escapeHtml(v.modele) +
          '(' +
          global.AutoLocUtils.escapeHtml(v.immat) +
          ')'
        : '') +
      '· ' +
      global.AutoLocUtils.escapeHtml(r.debut) +
      '→ ' +
      global.AutoLocUtils.escapeHtml(r.fin) +
      '</p><div class="pay-summary"><div class="pay-box total"><strong>' +
      total.toLocaleString('fr-FR') +
      'MAD</strong><span>Total contrat</span></div><div class="pay-box paid"><strong>' +
      paid.toLocaleString('fr-FR') +
      'MAD</strong><span>Encaissé</span></div><div class="pay-box ' +
      (reste === 0 ? 'reste-zero' : 'reste') +
      '"><strong>' +
      reste.toLocaleString('fr-FR') +
      'MAD</strong><span>' +
      (reste === 0 ? 'Soldé ✓' : 'Reste dû') +
      '</span></div></div><div class="pay-progress-wrap"><div class="pay-progress-label"><span>Progression du paiement</span><span><strong>' +
      pct +
      '%</strong></span></div><div class="pay-progress-track"><div class="pay-progress-fill" style="width:' +
      pct +
      '%;background:' +
      (pct >= 100 ? 'var(--success)' : 'var(--accent2)') +
      '"></div></div></div> ' +
      (avancePaid > 0 || soldePaid > 0
        ? '<div class="pay-breakdown"><div class="pay-breakdown-item"><span>Avances versées</span><strong style="color:var(--accent2)">' +
          avancePaid.toLocaleString('fr-FR') +
          'MAD</strong></div><div class="pay-breakdown-item"><span>Soldes versés</span><strong style="color:var(--success)">' +
          soldePaid.toLocaleString('fr-FR') +
          'MAD</strong></div></div>'
        : '') +
      '<div class="pay-section-title">Caution</div><div class="caution-row"><label>Montant</label><input type="number" id="caution-input" value="' +
      caution +
      '" placeholder="0" style="width:90px;padding:6px 10px;border:1.5px solid #93c5fd;border-radius:8px;font-size:0.85rem;font-family:inherit;background:#dcedfd;color:#0f1923;"><span style="font-size:0.83rem;color:var(--text2)">MAD</span><div class="caution-status"><button type="button" class="caution-btn ' +
      (cautionStatut === 'encaissee' ? 'active-encaissee' : '') +
      '" onclick="setCautionStatut(\'encaissee\')" aria-label="Marquer la caution comme encaissée">Encaissée</button><button type="button" class="caution-btn ' +
      (cautionStatut === 'restituee' ? 'active-restituee' : '') +
      '" onclick="setCautionStatut(\'restituee\')" aria-label="Marquer la caution comme restituée">Restituée</button></div><button type="button" class="btn btn-sm btn-outline" onclick="saveCaution()" aria-label="Enregistrer le montant de la caution">Enreg.</button></div> ' +
      (caution > 0
        ? '<p style="font-size:0.74rem;color:var(--text3);margin:-4px 0 10px;padding-left:4px">Statut caution :<strong style="color:' +
          (cautionStatut === 'restituee'
            ? '#93c5fd'
            : cautionStatut === 'encaissee'
              ? '#99f6e4'
              : '#94a3b8') +
          '">' +
          (cautionStatut === 'restituee'
            ? 'Restituée'
            : cautionStatut === 'encaissee'
              ? 'Encaissée'
              : 'En attente') +
          '</strong></p>'
        : '') +
      '<div class="pay-section-title">Versements(' +
      paiements.length +
      ')</div><div class="pay-list" id="pay-list"> ' +
      (paiements.length === 0
        ? '<p style="text-align:center;color:var(--text3);font-size:0.83rem;padding:12px">Aucun versement enregistré</p>'
        : paiements
            .map(function (p, i) {
              var typeClass =
                p.type === 'avance' ? 'pay-type-avance' : p.type === 'solde' ? 'pay-type-solde' : 'pay-type-autre';
              var typeLabel = p.type === 'avance' ? 'Avance' : p.type === 'solde' ? 'Solde' : 'Autre';
              var iconColor = p.type === 'avance' ? '#93c5fd' : p.type === 'solde' ? '#99f6e4' : '#cbd5e1';
              var iconBg =
                p.type === 'avance'
                  ? 'rgba(59,130,246,0.16)'
                  : p.type === 'solde'
                    ? 'rgba(45,212,191,0.15)'
                    : 'rgba(148,163,184,0.14)';
              return (
                '<div class="pay-item"><div class="pay-item-icon" style="background:' +
                iconBg +
                '"><svg fill="none" viewBox="0 0 24 24" stroke="' +
                iconColor +
                '" stroke-width="2">' +
                (modeIcons[p.mode] || modeIcons['Espèces']) +
                '</svg></div><div class="pay-item-info"><strong>' +
                p.montant.toLocaleString('fr-FR') +
                'MAD<span class="pay-type-tag ' +
                typeClass +
                '">' +
                typeLabel +
                '</span></strong><small>' +
                global.AutoLocUtils.escapeHtml(p.mode) +
                '· ' +
                global.AutoLocUtils.escapeHtml(fmt(p.date)) +
                (p.note ? ' · ' + global.AutoLocUtils.escapeHtml(p.note) : '') +
                '</small></div><button type="button" class="pay-item-del" onclick="deletePaiement(' +
                i +
                ')" title="Supprimer ce versement" aria-label="Supprimer ce versement"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div>'
              );
            })
            .join('')) +
      '</div><div class="pay-section-title">Ajouter un versement</div><div class="pay-add-top" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:end;"><div class="form-group"><label>Montant(MAD)</label><input type="number" id="pay-montant" placeholder="' +
      (reste > 0 ? reste : '') +
      '" class="inline-input"></div><div class="form-group"><label>Type</label><select id="pay-type" class="inline-input"><option value="avance">Avance</option><option value="solde">Solde</option><option value="autre">Autre</option></select></div><div class="form-group"><label>Mode</label><select id="pay-mode" class="inline-input"><option>Espèces</option><option>Virement</option><option>Chèque</option></select></div><button type="button" class="btn btn-primary pay-add-submit" onclick="addPaiement()" aria-label="Ajouter le versement" style="margin-bottom:0;align-self:flex-end;height:38px"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><div class="pay-add-bottom" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;"><div class="form-group"><label>Date du versement</label><input type="date" id="pay-date" value="' +
      new Date().toISOString().slice(0, 10) +
      '" class="inline-input"></div><div class="form-group"><label>Note(optionnel)</label><input type="text" id="pay-note" placeholder="ex: solde final,reçu N°…" class="inline-input"></div></div> ';
    x.initNativeDatePickers();
  }

  function getUnpaidActiveCount() {
    var x = c();
    if (!x) return 0;
    return x.load(x.KEYS.res).filter(function (r) {
      if ((r.statut || '') !== 'en cours') return false;
      var total = Number(r.total) || 0;
      var paid = (r.paiements || []).reduce(function (s, p) {
        return s + (Number(p.montant) || 0);
      }, 0);
      return total - paid > 0;
    }).length;
  }

  function showAlertSyncToast(beforeCount, afterCount) {
    if (beforeCount === afterCount) return;
    var existing = document.getElementById('payment-alert-sync-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'payment-alert-sync-toast';
    toast.style.cssText =
      'position:fixed;right:18px;bottom:18px;z-index:10050;background:#0f172a;border:1px solid rgba(45,212,191,0.35);color:#ccfbf1;padding:10px 12px;border-radius:10px;font-size:0.8rem;font-weight:600;box-shadow:0 10px 26px rgba(0,0,0,0.32);';
    toast.textContent =
      afterCount < beforeCount ? 'Paiement enregistré, alertes synchronisées.' : 'Mise à jour effectuée.';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 1800);
  }

  global.openPayModal = function (resId) {
    payResId = resId != null ? String(resId) : null;
    renderPayModal();
    document.getElementById('pay-modal').classList.add('open');
  };

  global.addPaiement = function () {
    var x = c();
    if (!x) return;
    var unpaidBefore = getUnpaidActiveCount();
    var montant = parseFloat(document.getElementById('pay-montant').value);
    if (!montant || montant <= 0) {
      x.alAlert('Montant invalide');
      return;
    }
    var mode = document.getElementById('pay-mode').value;
    var type = document.getElementById('pay-type').value;
    var note = document.getElementById('pay-note').value.trim();
    var date = document.getElementById('pay-date').value || new Date().toISOString().slice(0, 10);
    var data = x.load(x.KEYS.res);
    var pid = payResId != null ? String(payResId) : '';
    data = data.map(function (r) {
      if (String(r.id) !== pid) return r;
      var paiements = (r.paiements || []).concat([{ montant: montant, mode: mode, type: type, note: note, date: date }]);
      return Object.assign({}, r, { paiements: paiements, updatedAt: new Date().toISOString() });
    });
    x.save(x.KEYS.res, data);
    x.addLog('Paiement enregistré — ' + montant + 'MAD(' + type + ',' + mode + ')');
    renderPayModal();
    x.renderReservations();
    x.renderDashboard();
    x.renderAlerts();
    showAlertSyncToast(unpaidBefore, getUnpaidActiveCount());
  };

  global.deletePaiement = function (idx) {
    var x = c();
    if (!x) return;
    var unpaidBefore = getUnpaidActiveCount();
    x.alConfirm({
      icon: '💸',
      danger: true,
      title: 'Supprimer ce versement ?',
      msg: 'Ce paiement sera définitivement retiré de la réservation.',
      okLabel: 'Supprimer',
      onOk: function () {
        var data = x.load(x.KEYS.res);
        var pid = payResId != null ? String(payResId) : '';
        data = data.map(function (r) {
          if (String(r.id) !== pid) return r;
          var paiements = (r.paiements || []).filter(function (_, i) {
            return i !== idx;
          });
          return Object.assign({}, r, { paiements: paiements, updatedAt: new Date().toISOString() });
        });
        x.save(x.KEYS.res, data);
        renderPayModal();
        x.renderReservations();
        x.renderDashboard();
        x.renderAlerts();
        showAlertSyncToast(unpaidBefore, getUnpaidActiveCount());
      }
    });
  };

  global.saveCaution = function () {
    var x = c();
    if (!x) return;
    var unpaidBefore = getUnpaidActiveCount();
    var montant = parseFloat(document.getElementById('caution-input').value) || 0;
    var data = x.load(x.KEYS.res);
    var pid = payResId != null ? String(payResId) : '';
    data = data.map(function (r) {
      return String(r.id) === pid
        ? Object.assign({}, r, { caution: montant, updatedAt: new Date().toISOString() })
        : r;
    });
    x.save(x.KEYS.res, data);
    x.addLog('Caution mise à jour — ' + montant + 'MAD');
    renderPayModal();
    x.renderReservations();
    x.renderDashboard();
    x.renderAlerts();
    showAlertSyncToast(unpaidBefore, getUnpaidActiveCount());
  };

  global.setCautionStatut = function (statut) {
    var x = c();
    if (!x) return;
    var unpaidBefore = getUnpaidActiveCount();
    var data = x.load(x.KEYS.res);
    var pid = payResId != null ? String(payResId) : '';
    var cur = data.find(function (r) {
      return String(r.id) === pid;
    });
    var newStatut = cur && cur.cautionStatut === statut ? 'non' : statut;
    data = data.map(function (r) {
      return String(r.id) === pid
        ? Object.assign({}, r, { cautionStatut: newStatut, updatedAt: new Date().toISOString() })
        : r;
    });
    x.save(x.KEYS.res, data);
    renderPayModal();
    x.renderReservations();
    x.renderDashboard();
    x.renderAlerts();
    showAlertSyncToast(unpaidBefore, getUnpaidActiveCount());
  };

  global.invooPaymentModals = {
    attach: function (config) {
      ctx = config;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
