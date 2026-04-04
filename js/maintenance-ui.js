/**
 * Page Maintenance + alertes tableau de bord + modale intervention.
 *
 * Branchement dans js/01-app-core.js — fin de fichier :
 *   invooMaintenanceUi.attach({
 *     load, save, KEYS, uid, alAlert, alConfirm, addLog, closeModal,
 *     renderDashboard, shouldSkipRender
 *   });
 *
 * Globaux pour onclick : filterMaint, openMaintModal, saveMaintenance,
 * deleteMaintenance, markMaintDone, renderMaintenance, renderMaintAlerts.
 * window.renderMaintenance utilisé par js/03-supabase-sync.js après pull.
 */
(function (global) {
  'use strict';

  var ctx = null;
  var maintFilter = 'all';
  var editingMaintId = null;

  function idEq(a, b) {
    return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
      ? global.AutoLocCoreUtils.idEq(a, b)
      : String(a) === String(b);
  }

  function load() {
    return ctx.load.apply(null, arguments);
  }
  function save() {
    return ctx.save.apply(null, arguments);
  }

  global.filterMaint = function (el, f) {
    document.querySelectorAll('#maint-filters .filter-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    el.classList.add('active');
    maintFilter = f;
    global.renderMaintenance();
  };

  global.openMaintModal = function (id) {
    var vehs = load(ctx.KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var sel = document.getElementById('maint-veh');
    if (!sel) return;
    sel.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '--Sélectionner--';
    sel.appendChild(opt0);
    vehs.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = (v.marque || '') + ' ' + (v.modele || '') + ' (' + (v.immat || '') + ')';
      sel.appendChild(opt);
    });
    if (id) {
      editingMaintId = String(id);
      var mid = editingMaintId;
      var m = load(ctx.KEYS.maint).find(function (x) {
        return String(x.id) === mid && !x._deleted;
      });
      if (m) {
        sel.value = m.vehId;
        document.getElementById('maint-type').value = m.type;
        document.getElementById('maint-statut').value = m.statut;
        document.getElementById('maint-date').value =
          window.AutoLocCoreUtils.normalizeDateInputValue(m.date) || '';
        document.getElementById('maint-date').dispatchEvent(new Event('input'));
        document.getElementById('maint-cout').value = m.cout || '';
        document.getElementById('maint-km').value = m.km || '';
        document.getElementById('maint-km-seuil').value = m.kmSeuil || '';
        document.getElementById('maint-notes').value = m.notes || '';
        document.getElementById('maint-modal-title').textContent = 'Modifier maintenance';
      }
    } else {
      editingMaintId = null;
      document.getElementById('maint-modal-title').textContent = 'Planifier une maintenance';
      ['maint-date', 'maint-cout', 'maint-km', 'maint-km-seuil', 'maint-notes'].forEach(function (i) {
        var el = document.getElementById(i);
        if (el) el.value = '';
      });
      var _md = document.getElementById('maint-date');
      if (_md) _md.dispatchEvent(new Event('input'));
      document.getElementById('maint-veh').value = '';
      document.getElementById('maint-type').selectedIndex = 0;
      document.getElementById('maint-statut').selectedIndex = 0;
    }
    document.getElementById('maint-modal').classList.add('open');
  };

  global.saveMaintenance = function () {
    var vehId = document.getElementById('maint-veh').value;
    var date = document.getElementById('maint-date').value;
    if (!vehId || !date) {
      ctx.alAlert('Véhicule et date sont obligatoires.');
      return;
    }
    var now = new Date().toISOString();
    var m = {
      id: editingMaintId || ctx.uid(),
      vehId: vehId,
      type: document.getElementById('maint-type').value,
      statut: document.getElementById('maint-statut').value,
      date: date,
      cout: parseFloat(document.getElementById('maint-cout').value) || 0,
      km: parseInt(document.getElementById('maint-km').value, 10) || 0,
      kmSeuil: parseInt(document.getElementById('maint-km-seuil').value, 10) || 0,
      notes: document.getElementById('maint-notes').value.trim(),
      createdAt: (function () {
        if (!editingMaintId) return now;
        var prev = load(ctx.KEYS.maint).find(function (x) {
          return String(x.id) === String(editingMaintId);
        });
        return (prev && prev.createdAt) || now;
      })(),
      updatedAt: now
    };
    if (m.cout < 0 || m.km < 0 || m.kmSeuil < 0) {
      ctx.alAlert('Coût, km et km seuil doivent être positifs.');
      return;
    }
    if (!['planifiée', 'effectuée'].includes(m.statut)) {
      ctx.alAlert('Statut de maintenance invalide.');
      return;
    }
    var oldM = editingMaintId
      ? load(ctx.KEYS.maint).find(function (x) {
          return String(x.id) === String(editingMaintId) && !x._deleted;
        })
      : null;
    var data = load(ctx.KEYS.maint);
    if (editingMaintId) {
      data = data.map(function (x) {
        return String(x.id) === String(editingMaintId) ? m : x;
      });
    } else {
      data.push(m);
    }
    save(ctx.KEYS.maint, data);
    if (m.km > 0) {
      var vehs = load(ctx.KEYS.veh);
      vehs = vehs.map(function (v) {
        return idEq(v.id, vehId)
          ? { ...v, km: Math.max(v.km || 0, m.km), updatedAt: new Date().toISOString() }
          : v;
      });
      save(ctx.KEYS.veh, vehs);
    }
    if (m.statut === 'planifiée') {
      var vehsPlan = load(ctx.KEYS.veh);
      vehsPlan = vehsPlan.map(function (v) {
        return idEq(v.id, vehId) && v.statut === 'disponible'
          ? { ...v, statut: 'maintenance', updatedAt: new Date().toISOString() }
          : v;
      });
      save(ctx.KEYS.veh, vehsPlan);
    }
    if (oldM && oldM.statut === 'planifiée' && m.statut === 'effectuée') {
      var autresPlanifiees = data.filter(function (x) {
        return (
          !x._deleted &&
          !idEq(x.id, m.id) &&
          idEq(x.vehId, m.vehId) &&
          x.statut === 'planifiée'
        );
      });
      if (!autresPlanifiees.length) {
        var vehsBack = load(ctx.KEYS.veh);
        vehsBack = vehsBack.map(function (v) {
          return idEq(v.id, m.vehId) && v.statut === 'maintenance'
            ? { ...v, statut: 'disponible', updatedAt: new Date().toISOString() }
            : v;
        });
        save(ctx.KEYS.veh, vehsBack);
      }
    }
    ctx.addLog('Maintenance ' + m.statut + ' — ' + m.type);
    ctx.closeModal('maint-modal');
    global.renderMaintenance();
    global.renderMaintAlerts();
    if (typeof ctx.renderDashboard === 'function') ctx.renderDashboard();
    if (typeof ctx.renderVehicules === 'function') ctx.renderVehicules();
    if (typeof global.renderCalendar === 'function') global.renderCalendar();
  };

  global.deleteMaintenance = function (id) {
    ctx.alConfirm({
      icon: '🔧',
      danger: true,
      title: 'Supprimer cette intervention ?',
      msg: 'Cette action est irréversible.',
      okLabel: 'Supprimer',
      onOk: function () {
        var sid = String(id);
        var all = load(ctx.KEYS.maint);
        var row = all.find(function (x) {
          return String(x.id) === sid && !x._deleted;
        });
        if (!row) return;
        save(
          ctx.KEYS.maint,
          all.map(function (x) {
            return String(x.id) === sid
              ? { ...x, _deleted: true, updatedAt: new Date().toISOString() }
              : x;
          })
        );
        if (row.statut === 'planifiée') {
          var reste = load(ctx.KEYS.maint).filter(function (x) {
            return (
              !x._deleted &&
              idEq(x.vehId, row.vehId) &&
              x.statut === 'planifiée'
            );
          });
          if (!reste.length) {
            var vehsRel = load(ctx.KEYS.veh);
            vehsRel = vehsRel.map(function (v) {
              return idEq(v.id, row.vehId) && v.statut === 'maintenance'
                ? { ...v, statut: 'disponible', updatedAt: new Date().toISOString() }
                : v;
            });
            save(ctx.KEYS.veh, vehsRel);
          }
        }
        global.renderMaintenance();
        global.renderMaintAlerts();
        if (typeof ctx.renderDashboard === 'function') ctx.renderDashboard();
        if (typeof ctx.renderVehicules === 'function') ctx.renderVehicules();
        if (typeof global.renderCalendar === 'function') global.renderCalendar();
      }
    });
  };

  global.markMaintDone = function (id) {
    var sid = String(id);
    var data = load(ctx.KEYS.maint);
    var m = data.find(function (x) {
      return String(x.id) === sid && !x._deleted;
    });
    if (!m) return;
    data = data.map(function (x) {
      return String(x.id) === sid
        ? { ...x, statut: 'effectuée', updatedAt: new Date().toISOString() }
        : x;
    });
    save(ctx.KEYS.maint, data);
    if (m) {
      var autresMaint = data.filter(function (x) {
        return !x._deleted && idEq(x.vehId, m.vehId) && x.statut === 'planifiée';
      });
      if (!autresMaint.length) {
        var vehs = load(ctx.KEYS.veh);
        vehs = vehs.map(function (v) {
          return idEq(v.id, m.vehId) && v.statut === 'maintenance'
            ? { ...v, statut: 'disponible', updatedAt: new Date().toISOString() }
            : v;
        });
        save(ctx.KEYS.veh, vehs);
      }
    }
    ctx.addLog('Maintenance marquée effectuée');
    global.renderMaintenance();
    global.renderMaintAlerts();
    if (typeof ctx.renderDashboard === 'function') ctx.renderDashboard();
    if (typeof ctx.renderVehicules === 'function') ctx.renderVehicules();
    if (typeof global.renderCalendar === 'function') global.renderCalendar();
  };

  global.renderMaintenance = function () {
    var data = load(ctx.KEYS.maint).filter(function (m) {
      return !m._deleted;
    });
    if (maintFilter !== 'all') data = data.filter(function (m) {
      return m.statut === maintFilter;
    });
    data = [].concat(data).sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    var vehs = load(ctx.KEYS.veh);
    var tbody = document.getElementById('maint-tbody');
    if (!tbody) return;
    global.renderMaintAlerts();
    if (!data.length) {
      tbody.innerHTML =
        '<tr><td colspan="8"><div class="empty-state"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg><p>Aucune intervention enregistrée</p></div></td></tr>';
      return;
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    tbody.innerHTML = data
      .map(function (m) {
        var v = vehs.find(function (x) {
          return idEq(x.id, m.vehId);
        });
        var dateD = new Date(m.date);
        dateD.setHours(0, 0, 0, 0);
        var overdue = m.statut === 'planifiée' && dateD < today;
        var kmPct =
          m.km && m.kmSeuil ? Math.min(100, Math.round((m.km / m.kmSeuil) * 100)) : 0;
        var kmAlert = m.kmSeuil && m.km >= m.kmSeuil * 0.9;
        var badgeCls =
          m.statut === 'effectuée'
            ? 'maint-badge-effectuee'
            : overdue
              ? 'maint-badge-alerte'
              : 'maint-badge-planifiee';
        var badgeLbl =
          m.statut === 'effectuée' ? 'Effectuée' : overdue ? 'En retard' : 'Planifiée';
        return (
          '<tr style="' +
          (overdue ? 'background:rgba(251,191,36,0.10);' : '') +
          '"><td data-label="Véhicule"><strong>' +
          (v
            ? window.AutoLocUtils.escapeHtml(v.marque) +
              ' ' +
              window.AutoLocUtils.escapeHtml(v.modele)
            : '—') +
          '</strong><br><span style="font-size:0.72rem;color:var(--text3)">' +
          (v ? window.AutoLocUtils.escapeHtml(v.immat) : '') +
          '</span></td><td data-label="Type">' +
          window.AutoLocUtils.escapeHtml(m.type) +
          '</td><td data-label="Date" style="color:' +
          (overdue ? 'var(--danger)' : 'var(--text)') +
          ';font-weight:' +
          (overdue ? '600' : '400') +
          '">' +
          new Date(m.date).toLocaleDateString('fr-FR') +
          '</td><td data-label="Km">' +
          (m.km ? m.km.toLocaleString('fr-FR') + ' km' : '—') +
          '</td><td data-label="Seuil km">\n ' +
          (m.kmSeuil
            ? '<div style="font-size:0.8rem;color:' +
              (kmAlert ? '#fbbf24' : 'var(--text2)') +
              '">\n ' +
              m.kmSeuil.toLocaleString('fr-FR') +
              'km\n ' +
              (kmAlert
                ? '<span class="maint-badge-alerte" style="margin-left:4px">⚠ Seuil!</span>'
                : '') +
              '\n<div class="maint-km-bar-track" style="margin-top:4px"><div class="maint-km-bar-fill" style="width:' +
              kmPct +
              '%;background:' +
              (kmAlert ? '#f59e0b' : '#2dd4bf') +
              '"></div></div></div>'
            : '—') +
          '\n</td><td data-label="Statut"><span class="' +
          badgeCls +
          '">' +
          window.AutoLocUtils.escapeHtml(badgeLbl) +
          '</span></td><td data-label="Notes" style="font-size:0.78rem;color:var(--text2);max-width:150px">' +
          window.AutoLocUtils.escapeHtml(m.notes || '—') +
          '</td><td><div class="row-actions">\n ' +
          (m.statut !== 'effectuée'
            ? '<button type="button" class="btn btn-sm btn-outline" aria-label="Marquer comme effectuée — ' +
              window.AutoLocUtils.escapeHtml(
                (v ? v.marque + ' ' + v.modele + ' · ' : '') + (m.type || 'intervention')
              ) +
              '" onclick="markMaintDone(\'' +
              window.AutoLocUtils.escapeHtml(m.id) +
              '\')" style="color:var(--success);border-color:var(--success);font-size:0.72rem">✓ Fait</button>'
            : '') +
          '<button type="button" class="btn-icon" title="Modifier" aria-label="Modifier l\'intervention" onclick="openMaintModal(\'' +
          window.AutoLocUtils.escapeHtml(m.id) +
          '\')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button type="button" class="btn-icon" title="Supprimer" aria-label="Supprimer l\'intervention" onclick="deleteMaintenance(\'' +
          window.AutoLocUtils.escapeHtml(m.id) +
          '\')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td></tr>'
        );
      })
      .join('');
  };

  global.renderMaintAlerts = function () {
    if (ctx.shouldSkipRender()) return;
    var vehs = load(ctx.KEYS.veh);
    var maints = load(ctx.KEYS.maint).filter(function (m) {
      return !m._deleted && m.statut === 'planifiée';
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var alerts = [];
    maints.forEach(function (m) {
      var v = vehs.find(function (x) {
        return idEq(x.id, m.vehId);
      });
      var dateD = new Date(m.date);
      dateD.setHours(0, 0, 0, 0);
      var overdue = dateD < today;
      var kmAlert = m.kmSeuil && m.km && m.km >= m.kmSeuil * 0.9;
      if (overdue || kmAlert) alerts.push({ m: m, v: v, overdue: overdue, kmAlert: kmAlert });
    });
    var dot = document.getElementById('maint-notif-dot');
    if (dot) dot.style.display = alerts.length ? 'inline-block' : 'none';
    var wrap = document.getElementById('maint-alerts-wrap');
    if (!wrap) return;
    if (!alerts.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML =
      '<div class="maint-alert-km"><div class="maint-alert-km-header"><svg fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4>' +
      alerts.length +
      ' alerte' +
      (alerts.length > 1 ? 's' : '') +
      ' maintenance</h4></div>\n ' +
      alerts
        .map(function (_ref) {
          var m = _ref.m;
          var v = _ref.v;
          var overdue = _ref.overdue;
          var kmAlert = _ref.kmAlert;
          return (
            '<div class="maint-km-row"><div><strong>' +
            (v
              ? window.AutoLocUtils.escapeHtml(v.marque) +
                ' ' +
                window.AutoLocUtils.escapeHtml(v.modele)
              : '—') +
            '</strong><span style="color:var(--text3);font-size:0.72rem">' +
            (v ? window.AutoLocUtils.escapeHtml(v.immat) : '') +
            '</span><br><span style="font-size:0.72rem;color:var(--text2)">' +
            window.AutoLocUtils.escapeHtml(m.type) +
            ' · ' +
            new Date(m.date).toLocaleDateString('fr-FR') +
            '</span></div><div class="maint-km-bar-wrap">\n ' +
            (kmAlert && m.kmSeuil
              ? '<div style="font-size:0.72rem;color:#fbbf24;margin-bottom:3px">' +
                m.km.toLocaleString('fr-FR') +
                ' / ' +
                m.kmSeuil.toLocaleString('fr-FR') +
                ' km</div><div class="maint-km-bar-track"><div class="maint-km-bar-fill" style="width:' +
                Math.min(100, Math.round((m.km / m.kmSeuil) * 100)) +
                '%"></div></div>'
              : '') +
            '\n</div><span class="' +
            (overdue ? 'maint-badge-alerte' : 'maint-badge-planifiee') +
            '">' +
            (overdue ? 'En retard' : kmAlert ? '⚠ Km seuil' : '') +
            '</span><button type="button" class="btn btn-sm btn-primary" aria-label="Marquer comme effectuée — ' +
            window.AutoLocUtils.escapeHtml(
              (v ? v.marque + ' ' + v.modele + ' · ' : '') + (m.type || 'intervention')
            ) +
            '" onclick="markMaintDone(\'' +
            window.AutoLocUtils.escapeHtml(m.id) +
            '\')" style="margin-left:8px;font-size:0.72rem">✓ Fait</button></div>'
          );
        })
        .join('') +
      '\n</div>';
  };

  global.invooMaintenanceUi = {
    attach: function (c) {
      ctx = c;
      global.resetMaintenanceEditState = function () {
        editingMaintId = null;
      };
    }
  };
})(typeof window !== 'undefined' ? window : this);
