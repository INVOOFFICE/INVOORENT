/**
 * Modales « Historique client / véhicule » (timeline locations).
 * Contexte : invooHistoryModals.attach({ load, KEYS }) depuis 01-app-core.
 */
(function (global) {
  'use strict';

  var ctx = null;

  function idEq(a, b) {
    return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
      ? global.AutoLocCoreUtils.idEq(a, b)
      : String(a) === String(b);
  }

  function esc(s) {
    if (global.AutoLocUtils && typeof global.AutoLocUtils.escapeHtml === 'function') {
      return global.AutoLocUtils.escapeHtml(s);
    }
    return String(s == null ? '' : s);
  }

  function buildHistTimeline(reservations, vehs, clients) {
    var fmt = function (d) {
      return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    };
    if (!reservations.length) {
      return (
        '<div class="hist-empty"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Aucune location enregistrée</p></div>'
      );
    }
    var sorted = reservations.slice().sort(function (a, b) {
      return new Date(b.createdAt || b.debut) - new Date(a.createdAt || a.debut);
    });
    var colors = { 'en cours': '#93c5fd', terminée: '#99f6e4', annulée: '#fca5a5' };
    var bgs = {
      'en cours': 'rgba(59,130,246,0.16)',
      terminée: 'rgba(45,212,191,0.15)',
      annulée: 'rgba(239,68,68,0.14)'
    };
    return (
      '<div class="hist-timeline">' +
      sorted
        .map(function (r) {
          var v = vehs.find(function (x) {
            return idEq(x.id, r.vehId);
          });
          var c = clients.find(function (x) {
            return idEq(x.id, r.clientId);
          });
          var days =
            r.debut && r.fin
              ? Math.max(1, Math.round((new Date(r.fin) - new Date(r.debut)) / (1000 * 60 * 60 * 24)))
              : 0;
          var color = colors[r.statut] || '#9A9A9A';
          var bg = bgs[r.statut] || '#F2F3F4';
          return (
            '<div class="hist-item"><div class="hist-dot" style="background:' +
            bg +
            '"><svg fill="none" viewBox="0 0 24 24" stroke="' +
            color +
            '" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><div class="hist-item-body"><div class="hist-item-header"><span class="hist-item-title">' +
            (v ? esc(v.marque) + ' ' + esc(v.modele) : '—') +
            (v ? '(' + esc(v.immat) + ')' : '') +
            '</span><span class="hist-item-date">' +
            esc(fmt(r.debut)) +
            '→ ' +
            esc(fmt(r.fin)) +
            '</span></div><div class="hist-item-detail">' +
            (c
              ? '<strong>Client :</strong>' + esc(c.prenom) + ' ' + esc(c.nom) + '<br>'
              : '') +
            '<strong>Durée :</strong>' +
            days +
            'jour' +
            (days > 1 ? 's' : '') +
            '&nbsp;·&nbsp;<strong>Montant :</strong>' +
            (r.total || 0).toLocaleString('fr-FR') +
            'MAD&nbsp;·&nbsp;<strong>Lieu :</strong>' +
            esc(r.lieu || '—') +
            '<br><span class="badge ' +
            (r.statut === 'en cours'
              ? 'badge-info'
              : r.statut === 'terminée'
                ? 'badge-success'
                : 'badge-danger') +
            '" style="margin-top:5px">' +
            esc(r.statut) +
            '</span>' +
            (r.notes
              ? '<br><span style="color:var(--text3);font-size:0.73rem">💬 ' + esc(r.notes) + '</span>'
              : '') +
            '</div></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function needCtx() {
    if (!ctx || typeof ctx.load !== 'function' || !ctx.KEYS) return null;
    return ctx;
  }

  global.showHistClient = function (id) {
    var c = needCtx();
    if (!c) return;
    var load = c.load;
    var KEYS = c.KEYS;
    var sid = String(id);
    var cl = load(KEYS.cl).find(function (x) {
      return idEq(x.id, sid);
    });
    if (!cl) return;
    var reservations = load(KEYS.res).filter(function (r) {
      return !r._deleted && idEq(r.clientId, sid);
    });
    var vehs = load(KEYS.veh).filter(function (x) {
      return !x._deleted;
    });
    var clientsActive = load(KEYS.cl).filter(function (x) {
      return !x._deleted;
    });
    var totalCA = reservations
      .filter(function (r) {
        return r.statut === 'terminée';
      })
      .reduce(function (s, r) {
        return s + (r.total || 0);
      }, 0);
    var enCours = reservations.filter(function (r) {
      return r.statut === 'en cours';
    }).length;
    var titleEl = document.getElementById('hist-modal-title');
    var bodyEl = document.getElementById('hist-modal-body');
    var modalEl = document.getElementById('hist-modal');
    if (!titleEl || !bodyEl || !modalEl) return;
    titleEl.textContent = 'Historique client';
    bodyEl.innerHTML =
      '<div class="hist-hero"><div class="hist-hero-icon" style="background:rgba(45,212,191,0.15)"><svg fill="none" viewBox="0 0 24 24" stroke="#99f6e4" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="hist-hero-info"><h4>' +
      esc(cl.prenom) +
      esc(cl.nom) +
      '</h4><p>' +
      esc(cl.tel) +
      (cl.email ? '· ' + esc(cl.email) : '') +
      '</p><p style="margin-top:2px">CIN : ' +
      esc(cl.cin || '—') +
      '· Permis : ' +
      esc(cl.permis || '—') +
      '· ' +
      esc(cl.ville || '') +
      '</p></div></div><div class="hist-stats"><div class="hist-stat"><strong>' +
      reservations.length +
      '</strong><span>Total locations</span></div><div class="hist-stat"><strong>' +
      enCours +
      '</strong><span>En cours</span></div><div class="hist-stat"><strong>' +
      totalCA.toLocaleString('fr-FR') +
      'MAD</strong><span>CA généré</span></div></div> ' +
      buildHistTimeline(reservations, vehs, clientsActive);
    if (typeof global.openModal === 'function') global.openModal('hist-modal');
    else {
      modalEl.classList.add('open');
      modalEl.setAttribute('aria-hidden', 'false');
    }
  };

  global.showHistVeh = function (id) {
    var c = needCtx();
    if (!c) return;
    var load = c.load;
    var KEYS = c.KEYS;
    var sid = String(id);
    var v = load(KEYS.veh).find(function (x) {
      return idEq(x.id, sid);
    });
    if (!v) return;
    var reservations = load(KEYS.res).filter(function (r) {
      return !r._deleted && idEq(r.vehId, sid);
    });
    var clients = load(KEYS.cl).filter(function (x) {
      return !x._deleted;
    });
    var totalCA = reservations
      .filter(function (r) {
        return r.statut === 'terminée';
      })
      .reduce(function (s, r) {
        return s + (r.total || 0);
      }, 0);
    var totalJours = reservations
      .filter(function (r) {
        return r.debut && r.fin;
      })
      .reduce(function (s, r) {
        return s + Math.max(1, Math.round((new Date(r.fin) - new Date(r.debut)) / (1000 * 60 * 60 * 24)));
      }, 0);
    var titleEl = document.getElementById('hist-modal-title');
    var bodyEl = document.getElementById('hist-modal-body');
    var modalEl = document.getElementById('hist-modal');
    if (!titleEl || !bodyEl || !modalEl) return;
    titleEl.textContent = 'Historique véhicule';
    bodyEl.innerHTML =
      '<div class="hist-hero"><div class="hist-hero-icon" style="background:rgba(59,130,246,0.16)"><svg fill="none" viewBox="0 0 24 24" stroke="#93c5fd" stroke-width="2"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div><div class="hist-hero-info"><h4>' +
      esc(v.marque) +
      esc(v.modele) +
      '— ' +
      esc(v.immat) +
      '</h4><p>' +
      esc(String(v.annee)) +
      '· ' +
      esc(v.cat) +
      '· ' +
      esc(v.carburant) +
      '· ' +
      esc(v.couleur) +
      '</p><p style="margin-top:2px">Kilométrage : ' +
      (v.km || 0).toLocaleString('fr-FR') +
      'km · Tarif : ' +
      esc(String(v.tarif || '—')) +
      'MAD/j</p></div></div><div class="hist-stats"><div class="hist-stat"><strong>' +
      reservations.length +
      '</strong><span>Total locations</span></div><div class="hist-stat"><strong>' +
      totalJours +
      '</strong><span>Jours loués</span></div><div class="hist-stat"><strong>' +
      totalCA.toLocaleString('fr-FR') +
      'MAD</strong><span>CA généré</span></div></div> ' +
      buildHistTimeline(
        reservations,
        load(KEYS.veh).filter(function (x) {
          return !x._deleted;
        }),
        clients
      );
    if (typeof global.openModal === 'function') global.openModal('hist-modal');
    else {
      modalEl.classList.add('open');
      modalEl.setAttribute('aria-hidden', 'false');
    }
  };

  global.invooHistoryModals = {
    attach: function (c) {
      ctx = c;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
