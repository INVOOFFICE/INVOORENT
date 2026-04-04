/**
 * Rendu tableau de bord : KPIs, sparklines, activité, flotte, impayés, charts.
 * Branchement : invooDashboardUi.attach({ load, KEYS, getSettings, shouldSkipRender,
 *   renderAlerts, renderDocsAlerts }) depuis 01-app-core.js
 */
(function (global) {
  'use strict';

  var ctx = null;
  var _dashRafId = null;

  function renderDashboard() {
    if (ctx.shouldSkipRender()) return;
    if (_dashRafId != null) return;
    _dashRafId = requestAnimationFrame(function () {
      _dashRafId = null;
      _renderDashboardCore();
    });
  }

  function _renderDashboardCore() {
    if (ctx.shouldSkipRender()) return;
    const load = ctx.load;
    const KEYS = ctx.KEYS;
    const getSettings = ctx.getSettings;
    const vehs = load(KEYS.veh).filter((v) => !v._deleted),
      cls = load(KEYS.cl).filter((c) => !c._deleted),
      res = load(KEYS.res).filter((r) => !r._deleted);
    const settings = getSettings();
    const agencyName = settings.nom || 'INVOORENT';
    const h = new Date().getHours();
    const greeting = h < 12 ? 'Bonjour 👋' : h < 18 ? 'Bon après-midi 👋' : 'Bonsoir 👋';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const el_greeting = document.getElementById('dash-greeting');
    const el_title = document.getElementById('dash-agency-name');
    const el_date = document.getElementById('dash-hero-date');
    if (el_greeting) el_greeting.textContent = greeting;
    if (el_title) el_title.textContent = agencyName;
    if (el_date) el_date.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    const dispo = vehs.filter((v) => v.statut === 'disponible').length;
    const loues = vehs.filter((v) => v.statut === 'loué').length;
    const enCours = res.filter((r) => r.statut === 'en cours').length;
    const ca = res.filter((r) => r.statut === 'terminée').reduce((s, r) => s + (r.total || 0), 0);
    const stats = [
      {
        label: 'Véhicules',
        val: vehs.length,
        sub: (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const docsExp = vehs.filter((v) =>
            [v.assurance, v.vignette, v.visite, v.assistance].some((d) => {
              if (!d) return false;
              const dt = new Date(d);
              dt.setHours(0, 0, 0, 0);
              return !isNaN(dt) && (dt - today) / 86400000 <= 30;
            })
          ).length;
          return (
            dispo +
            ' dispo · ' +
            loues +
            ' en location' +
            (docsExp > 0 ? ' · ⚠️ ' + docsExp + ' doc' + (docsExp > 1 ? 's' : '') : '')
          );
        })(),
        color: 'rgba(45,212,191,0.15)',
        iconColor: '#2dd4bf',
        icon:
          '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
      },
      {
        label: 'Clients',
        val: cls.length,
        sub: 'clients enregistrés',
        color: 'rgba(45,212,191,0.12)',
        iconColor: '#2dd4bf',
        icon:
          '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
      },
      {
        label: 'Locations en cours',
        val: enCours,
        sub: `${res.length} au total`,
        color: 'rgba(251,191,36,0.14)',
        iconColor: '#f59e0b',
        icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      },
      {
        label: 'CA réalisé',
        val: ca.toLocaleString('fr-FR') + ' MAD',
        sub: 'locations terminées',
        color: 'rgba(94,234,212,0.12)',
        iconColor: '#5eead4',
        icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
      },
    ];
    function sparkline(val, color) {
      const n = 8;
      const pts = [];
      let v = Math.max(1, val);
      let seed = ((Number(val) || 1) * 2654435761) % 2147483647;
      const rand = () => {
        seed = (seed * 48271) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < n; i++) {
        v = Math.max(0.5, v + (rand() - 0.45) * Math.max(1, val * 0.18));
        pts.push(v);
      }
      const mx = Math.max(...pts),
        mn = Math.min(...pts);
      const range = mx - mn || 1;
      const coords = pts
        .map((p, i) => `${Math.round((i * 56) / (n - 1))},${Math.round(18 - ((p - mn) / range) * 14)}`)
        .join(' ');
      return `<svg class="stat-sparkline" width="56" height="18" viewBox="0 0 56 18" fill="none"><polyline points="${coords}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg>`;
    }
    document.getElementById('stats-grid').innerHTML = stats
      .map(
        (s, i) => `
<div class="stat-card"><div class="stat-icon" style="background:${s.color}"><svg fill="none" viewBox="0 0 24 24" stroke="${s.iconColor}" stroke-width="2">${s.icon}</svg></div><h3>${s.label}</h3><div class="stat-number-row"><p>${s.val}</p></div><small>${s.sub}</small>
 ${sparkline(typeof s.val === 'number' ? s.val : parseInt(s.val, 10) || 5, s.iconColor)}
</div>`
      )
      .join('');
    const logs = load(KEYS.log);
    const actEl = document.getElementById('activity-list');
    if (!logs.length) {
      actEl.innerHTML = '<p style="color:var(--text3);font-size:0.85rem">Aucune activité récente</p>';
    } else {
      actEl.innerHTML = logs
        .slice(0, 8)
        .map(
          (l, i) => `
<div class="activity-item"><div class="activity-dot" style="background:${['#2dd4bf', '#34d399', '#F59E0B', '#F87171'][i % 4]}"></div><div><p>${window.AutoLocUtils.escapeHtml(l.msg)}</p><small>${window.AutoLocUtils.escapeHtml(l.ts)}</small></div></div>`
        )
        .join('');
    }
    const total = vehs.length || 1;
    const fleetEl = document.getElementById('fleet-status');
    const bars = [
      { label: 'Disponibles', count: dispo, color: '#10B981' },
      { label: 'Loués', count: loues, color: '#2dd4bf' },
      { label: 'Maintenance', count: vehs.filter((v) => v.statut === 'maintenance').length, color: '#F59E0B' },
    ];
    fleetEl.innerHTML = bars
      .map(
        (b) => `
<div class="fleet-bar-wrap" style="margin-bottom:14px"><div class="fleet-bar-label"><span>${b.label}</span><span><strong>${b.count}</strong>/ ${vehs.length}</span></div><div class="fleet-bar-track"><div class="fleet-bar-fill" style="width:${Math.round((b.count / total) * 100)}%;background:${b.color}"></div></div></div>`
      )
      .join('');
    if (typeof ctx.renderAlerts === 'function') ctx.renderAlerts();
    if (typeof ctx.renderDocsAlerts === 'function') ctx.renderDocsAlerts();
    const impayesWrap = document.getElementById('impayes-wrap');
    if (impayesWrap) {
      const enCoursList = load(KEYS.res).filter((r) => !r._deleted && r.statut === 'en cours');
      const impayes = enCoursList
        .map((r) => {
          const paid2 = (r.paiements || []).reduce((s, p) => s + p.montant, 0);
          const reste2 = Math.max(0, (r.total || 0) - paid2);
          return { ...r, paid2, reste2 };
        })
        .filter((r) => r.reste2 > 0);
      if (!impayes.length) {
        impayesWrap.innerHTML = '';
        return;
      }
      const clsD = load(KEYS.cl).filter((c) => !c._deleted),
        vehsD = load(KEYS.veh).filter((v) => !v._deleted);
      const idEqI = (a, b) =>
        window.AutoLocCoreUtils && typeof window.AutoLocCoreUtils.idEq === 'function'
          ? window.AutoLocCoreUtils.idEq(a, b)
          : String(a) === String(b);
      impayesWrap.innerHTML = `
<div class="impaye-alert"><div class="impaye-alert-header"><svg fill="none" viewBox="0 0 24 24" stroke="#C0392B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h4>${impayes.length}location${impayes.length > 1 ? 's' : ''}avec solde impayé</h4></div>
 ${impayes
   .map((r) => {
     const c2 = clsD.find((x) => idEqI(x.id, r.clientId)),
       v2 = vehsD.find((x) => idEqI(x.id, r.vehId));
     const pct = r.total > 0 ? Math.round((r.paid2 / r.total) * 100) : 0;
     const ariaPay =
       'Enregistrer un paiement — ' +
       (c2 ? window.AutoLocUtils.escapeHtml(c2.prenom + ' ' + c2.nom) : 'client') +
       (v2 ? ', ' + window.AutoLocUtils.escapeHtml(v2.marque + ' ' + v2.modele) : '');
     return `<div class="impaye-row"><div class="impaye-row-left"><strong>${c2 ? window.AutoLocUtils.escapeHtml(c2.prenom) + ' ' + window.AutoLocUtils.escapeHtml(c2.nom) : '—'}</strong><span>${v2 ? window.AutoLocUtils.escapeHtml(v2.marque) + ' ' + window.AutoLocUtils.escapeHtml(v2.modele) : ''}· ${pct}% payé</span></div><span class="impaye-amount">${r.reste2.toLocaleString('fr-FR')}MAD</span><button type="button" class="btn btn-sm btn-outline" aria-label="${ariaPay}" onclick="openPayModal('${window.AutoLocUtils.escapeHtml(r.id)}')" style="margin-left:8px;font-size:0.72rem">Payer</button></div>`;
   })
   .join('')}
</div>`;
    }
    requestAnimationFrame(function () {
      setTimeout(renderCharts, 0);
    });
  }

  function renderCharts() {
    function doRender() {
      if (typeof invooDashboardCharts === 'object' && typeof invooDashboardCharts.render === 'function') {
        invooDashboardCharts.render({ load: ctx.load, KEYS: ctx.KEYS });
      }
    }
    if (typeof invooEnsureChart === 'function') {
      invooEnsureChart()
        .then(doRender)
        .catch(function (e) {
          console.warn('Chart:', e && e.message ? e.message : e);
        });
    } else {
      doRender();
    }
  }

  global.invooDashboardUi = {
    attach: function (c) {
      ctx = c;
      global.renderDashboard = renderDashboard;
      global.renderCharts = renderCharts;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
