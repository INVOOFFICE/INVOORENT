/**
 * Alertes tableau de bord : retards, retours imminents, documents véhicules.
 * Branchement : invooAlertsUi.attach({ load, KEYS, shouldSkipRender, navigate }) depuis 01-app-core.js
 */
(function (global) {
  'use strict';

  var ctx = null;

  function load(k) {
    return ctx.load(k);
  }

  function computeAlerts() {
    var idEq =
      global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
        ? global.AutoLocCoreUtils.idEq
        : function (a, b) {
            return String(a) === String(b);
          };
    var res = load(ctx.KEYS.res).filter(function (r) {
      return !r._deleted && r.statut === 'en cours';
    });
    var vehs = load(ctx.KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var clients = load(ctx.KEYS.cl).filter(function (c) {
      return !c._deleted;
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    var retards = [];
    var today24h = [];
    var soon48h = [];
    res.forEach(function (r) {
      if (!r.fin) return;
      var fin = new Date(r.fin);
      fin.setHours(0, 0, 0, 0);
      var v = vehs.find(function (x) {
        return idEq(x.id, r.vehId);
      });
      var c = clients.find(function (x) {
        return idEq(x.id, r.clientId);
      });
      var info = {
        r: r,
        v: v,
        c: c,
        vName: v
          ? [v.marque, v.modele].filter(Boolean).join(' ') + (v.immat ? ' (' + v.immat + ')' : '') || '—'
          : '—',
        cName: c ? [c.prenom, c.nom].filter(Boolean).join(' ') || '—' : '—',
        finStr: fin.toLocaleDateString('fr-FR'),
        diffDays: Math.round((today - fin) / (1000 * 60 * 60 * 24)),
      };
      if (fin < today) retards.push(info);
      else if (fin.getTime() === today.getTime()) today24h.push(info);
      else if (fin.getTime() === tomorrow.getTime() || fin.getTime() === dayAfter.getTime()) soon48h.push(info);
    });
    return { retards: retards, today24h: today24h, soon48h: soon48h };
  }

  function computeDocsAlerts() {
    var vehs = load(ctx.KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var alerts = [];
    vehs.forEach(function (v) {
      var name = (v.marque || '') + ' ' + (v.modele || '') + '(' + (v.immat || '') + ')';
      function checkDoc(dateStr, label, icon) {
        if (!dateStr) return;
        var d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        if (isNaN(d)) return;
        var diffDays = Math.round((d - today) / 86400000);
        if (diffDays <= 30) {
          alerts.push({
            vehId: v.id,
            name: name,
            label: label,
            icon: icon,
            dateStr: dateStr,
            diffDays: diffDays,
            level: diffDays < 0 ? 'expired' : diffDays <= 7 ? 'urgent' : 'soon',
          });
        }
      }
      checkDoc(v.assurance, 'Assurance', '🛡️');
      checkDoc(v.vignette, 'Vignette', '📋');
      checkDoc(v.visite, 'Visite technique', '🔧');
      checkDoc(v.assistance, 'Assistance', '🆘');
    });
    return alerts.sort(function (a, b) {
      return a.diffDays - b.diffDays;
    });
  }

  function renderAlerts() {
    if (ctx.shouldSkipRender()) return;
    var computed = computeAlerts();
    var retards = computed.retards;
    var today24h = computed.today24h;
    var soon48h = computed.soon48h;
    var docsAlerts = computeDocsAlerts();
    var totalDocs = docsAlerts.filter(function (a) {
      return a.level !== 'soon';
    }).length;
    var total = retards.length + today24h.length + soon48h.length;
    var dot = document.getElementById('notif-dot');
    if (dot) dot.classList.toggle('visible', total > 0 || totalDocs > 0);
    var banner = document.getElementById('alert-banner');
    if (total > 0 || totalDocs > 0) {
      banner.classList.add('visible');
      var title = document.getElementById('alert-banner-title');
      var chips = document.getElementById('alert-chips');
      var totalAll = total + totalDocs;
      title.textContent = totalAll + ' alerte' + (totalAll > 1 ? 's' : '') + ' — action requise';
      var chipsHtml = '';
      if (retards.length)
        chipsHtml +=
          '<button type="button" class="alert-chip alert-chip-danger" onclick="scrollToAlerts()">🔴 ' +
          retards.length +
          ' retard' +
          (retards.length > 1 ? 's' : '') +
          '</button>';
      if (today24h.length)
        chipsHtml +=
          '<button type="button" class="alert-chip alert-chip-danger" onclick="scrollToAlerts()">🟠 ' +
          today24h.length +
          ' retour' +
          (today24h.length > 1 ? 's' : '') +
          " aujourd'hui</button>";
      if (soon48h.length)
        chipsHtml +=
          '<button type="button" class="alert-chip alert-chip-warning" onclick="scrollToAlerts()">🟡 ' +
          soon48h.length +
          ' retour' +
          (soon48h.length > 1 ? 's' : '') +
          ' dans 48h</button>';
      if (totalDocs > 0)
        chipsHtml +=
          '<button type="button" class="alert-chip alert-chip-warning" onclick="scrollToDocsAlerts()">📄 ' +
          totalDocs +
          ' doc' +
          (totalDocs > 1 ? 's' : '') +
          ' à renouveler</button>';
      chips.innerHTML = chipsHtml;
    } else {
      banner.classList.remove('visible');
    }
    var wrap = document.getElementById('alerts-card-wrap');
    if (!wrap) return;
    if (total === 0) {
      wrap.innerHTML = '';
      return;
    }
    var all = []
      .concat(
        retards.map(function (i) {
          return Object.assign({}, i, {
            type: 'retard',
            label: 'Retard de ' + i.diffDays + 'jour' + (i.diffDays > 1 ? 's' : ''),
            badgeCls: 'alert-badge-retard',
            bg: '#FDEDEC',
            ic: '#C0392B',
          });
        })
      )
      .concat(
        today24h.map(function (i) {
          return Object.assign({}, i, {
            type: 'today',
            label: "Retour aujourd'hui",
            badgeCls: 'alert-badge-retard',
            bg: 'rgba(251,191,36,0.12)',
            ic: '#f59e0b',
          });
        })
      )
      .concat(
        soon48h.map(function (i) {
          return Object.assign({}, i, {
            type: 'soon',
            label: 'Retour le ' + i.finStr,
            badgeCls: 'alert-badge-soon',
            bg: 'rgba(251,191,36,0.12)',
            ic: '#f59e0b',
          });
        })
      );
    wrap.innerHTML =
      '<div class="alert-card" id="alerts-section"><div class="alert-card-header"><svg fill="none" viewBox="0 0 24 24" stroke="#C0392B" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4>Alertes — Retards & retours imminents</h4><span class="badge badge-danger">' +
      total +
      '</span></div>\n ' +
      all
        .map(function (item) {
          return (
            '<div class="alert-row"><div class="alert-row-icon" style="background:' +
            item.bg +
            '"><svg fill="none" viewBox="0 0 24 24" stroke="' +
            item.ic +
            '" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="alert-row-info"><strong>' +
            global.AutoLocUtils.escapeHtml(item.cName) +
            '</strong><span>' +
            global.AutoLocUtils.escapeHtml(item.vName) +
            '— Retour prévu : ' +
            global.AutoLocUtils.escapeHtml(item.finStr) +
            '</span></div><span class="' +
            item.badgeCls +
            '">' +
            global.AutoLocUtils.escapeHtml(item.label) +
            '</span><button type="button" class="btn btn-sm btn-outline" aria-label="Clôturer la location — ' +
            global.AutoLocUtils.escapeHtml(String(item.cName) + ' — ' + String(item.vName)) +
            '" onclick="closeRental(\'' +
            global.AutoLocUtils.escapeHtml(item.r.id) +
            "')\">Clôturer</button></div>"
          );
        })
        .join('') +
      '\n</div>';
  }

  function scrollToAlerts() {
    var dashLink = document.querySelector('nav a[data-page="dashboard"]');
    if (dashLink && !dashLink.classList.contains('active')) ctx.navigate(dashLink);
    setTimeout(function () {
      var el = document.getElementById('alerts-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function scrollToDocsAlerts() {
    var dashLink = document.querySelector('nav a[data-page="dashboard"]');
    if (dashLink && !dashLink.classList.contains('active')) ctx.navigate(dashLink);
    setTimeout(function () {
      var el = document.getElementById('docs-alerts-wrap');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function renderDocsAlerts() {
    if (ctx.shouldSkipRender()) return;
    var wrap = document.getElementById('docs-alerts-wrap');
    if (!wrap) return;
    var alerts = computeDocsAlerts();
    if (!alerts.length) {
      wrap.innerHTML = '';
      return;
    }
    var dot = document.getElementById('notif-dot');
    if (dot) dot.classList.add('visible');
    var fmt = function (dateStr) {
      var d = new Date(dateStr);
      return isNaN(d)
        ? dateStr
        : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    var rowHtml = function (a) {
      var bg =
        a.level === 'expired'
          ? 'rgba(239,68,68,0.12)'
          : a.level === 'urgent'
            ? 'rgba(251,191,36,0.14)'
            : 'rgba(45,212,191,0.12)';
      var color = a.level === 'expired' ? '#fecaca' : a.level === 'urgent' ? '#fde68a' : '#99f6e4';
      var badge =
        a.level === 'expired'
          ? '<span style="background:rgba(239,68,68,0.16);color:#fecaca;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700;border:1px solid rgba(248,113,113,0.35)">Expiré</span>'
          : a.level === 'urgent'
            ? '<span style="background:rgba(251,191,36,0.16);color:#fde68a;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700;border:1px solid rgba(251,191,36,0.35)">Dans ' +
              a.diffDays +
              'j</span>'
            : '<span style="background:rgba(45,212,191,0.14);color:#99f6e4;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700;border:1px solid rgba(45,212,191,0.32)">Dans ' +
              a.diffDays +
              'j</span>';
      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(45,212,191,0.12);background:' +
        bg +
        '"><span style="font-size:1rem">' +
        a.icon +
        '</span><div style="flex:1;min-width:0"><strong style="font-size:0.83rem;color:' +
        color +
        ';display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        global.AutoLocUtils.escapeHtml(a.name) +
        '</strong><span style="font-size:0.75rem;color:var(--text3)">' +
        global.AutoLocUtils.escapeHtml(a.label) +
        '— expire le ' +
        global.AutoLocUtils.escapeHtml(fmt(a.dateStr)) +
        '</span></div>\n ' +
        badge +
        '<button type="button" class="btn btn-sm btn-outline" style="flex-shrink:0;font-size:0.72rem;padding:4px 10px" aria-label="Modifier le véhicule ' +
        global.AutoLocUtils.escapeHtml(a.name) +
        '" onclick="editVeh(\'' +
        global.AutoLocUtils.escapeHtml(a.vehId) +
        "')\">Modifier</button></div>"
      );
    };
    wrap.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-xs);margin-top:14px"><div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface2)"><svg fill="none" viewBox="0 0 24 24" stroke="#D97706" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4 style="font-family:var(--font-display);font-size:0.875rem;font-weight:600;color:var(--text)">Documents véhicules à renouveler</h4><span class="badge badge-warning" style="margin-left:auto">' +
      alerts.length +
      '</span></div>\n ' +
      alerts.map(rowHtml).join('') +
      '\n</div>';
  }

  global.invooAlertsUi = {
    attach: function (c) {
      ctx = c;
      global.computeAlerts = computeAlerts;
      global.renderAlerts = renderAlerts;
      global.scrollToAlerts = scrollToAlerts;
      global.scrollToDocsAlerts = scrollToDocsAlerts;
      global.computeDocsAlerts = computeDocsAlerts;
      global.renderDocsAlerts = renderDocsAlerts;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
