/**
 * Barre de recherche globale (véhicules, clients, réservations).
 *
 * Branchement dans js/01-app-core.js :
 *   invooGlobalSearch.attach({ load, KEYS, navigate });
 */
(function (global) {
  'use strict';

  function idEq(a, b) {
    return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
      ? global.AutoLocCoreUtils.idEq(a, b)
      : String(a) === String(b);
  }

  var ctx = null;
  var searchActiveIdx = -1;
  var _srchT = null;

  function load() {
    return ctx.load.apply(null, arguments);
  }

  global.onGlobalSearch = function (e) {
    var q = e.target.value.trim();
    var clr = document.getElementById('search-clear');
    if (clr) clr.style.display = q ? 'block' : 'none';
    if (!q) {
      global.closeSearchDropdown();
      return;
    }
    if (q.length < 2) {
      global.closeSearchDropdown();
      return;
    }
    clearTimeout(_srchT);
    _srchT = setTimeout(function () {
      global.renderSearchResults(q);
    }, 180);
  };

  global.onSearchKey = function (e) {
    var dd = document.getElementById('search-dropdown');
    if (!dd) return;
    var items = dd.querySelectorAll('.search-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
      items.forEach(function (el, i) {
        el.classList.toggle('active', i === searchActiveIdx);
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
      items.forEach(function (el, i) {
        el.classList.toggle('active', i === searchActiveIdx);
      });
    } else if (e.key === 'Enter') {
      if (searchActiveIdx >= 0 && items[searchActiveIdx]) items[searchActiveIdx].click();
    } else if (e.key === 'Escape') {
      global.clearSearch();
    }
  };

  global.clearSearch = function () {
    var inp = document.getElementById('global-search');
    if (inp) inp.value = '';
    var clr = document.getElementById('search-clear');
    if (clr) clr.style.display = 'none';
    global.closeSearchDropdown();
  };

  global.closeSearchDropdown = function () {
    var dd = document.getElementById('search-dropdown');
    if (!dd) return;
    dd.classList.remove('open');
    dd.innerHTML = '';
    searchActiveIdx = -1;
  };

  function highlight(text, q) {
    var safe = window.AutoLocUtils.escapeHtml(String(text));
    if (!q) return safe;
    var safeQ = window.AutoLocUtils.escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(' + safeQ + ')', 'gi');
    return safe.replace(re, '<span class="search-highlight">$1</span>');
  }

  global.renderSearchResults = function (q) {
    var ql = q.toLowerCase();
    var vehs = load(ctx.KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var cls = load(ctx.KEYS.cl).filter(function (c) {
      return !c._deleted;
    });
    var res = load(ctx.KEYS.res).filter(function (r) {
      return !r._deleted;
    });
    var results = [];
    vehs
      .filter(function (v) {
        return ('' + v.immat + v.marque + v.modele + v.cat + v.couleur).toLowerCase().includes(ql);
      })
      .slice(0, 4)
      .forEach(function (v) {
        results.push({
          type: 'veh',
          v: v,
          label: '' + v.marque + v.modele,
          sub: '' + v.immat + ' · ' + v.cat + ' · ' + v.statut,
          action: function () {
            global.goToVeh(v.id);
          }
        });
      });
    cls
      .filter(function (c) {
        return ('' + c.prenom + c.nom + c.tel + c.cin + c.email + c.ville).toLowerCase().includes(ql);
      })
      .slice(0, 4)
      .forEach(function (c) {
        results.push({
          type: 'cl',
          c: c,
          label: '' + c.prenom + c.nom,
          sub: '' + c.tel + ' · ' + (c.cin || ''),
          action: function () {
            global.goToClient(c.id);
          }
        });
      });
    res
      .filter(function (r) {
        var v = vehs.find(function (x) {
          return idEq(x.id, r.vehId);
        });
        var c = cls.find(function (x) {
          return idEq(x.id, r.clientId);
        });
        return (
          '' +
          (c ? c.prenom + ' ' + c.nom : '') +
          (v ? v.marque + ' ' + v.modele : '') +
          (v ? v.immat : '') +
          (r.lieu || '') +
          r.statut
        )
          .toLowerCase()
          .includes(ql);
      })
      .slice(0, 4)
      .forEach(function (r) {
        var v = vehs.find(function (x) {
          return idEq(x.id, r.vehId);
        });
        var c = cls.find(function (x) {
          return idEq(x.id, r.clientId);
        });
        results.push({
          type: 'res',
          r: r,
          label: (c ? c.prenom + ' ' + c.nom : '—') + ' — ' + (v ? v.marque + ' ' + v.modele : '—'),
          sub: '' + (r.debut || '') + ' → ' + (r.fin || '') + ' · ' + r.statut,
          action: function () {
            global.goToRes(r.id);
          }
        });
      });
    var dd = document.getElementById('search-dropdown');
    if (!dd) return;
    if (!results.length) {
      dd.innerHTML =
        '<div class="search-empty">Aucun résultat pour « ' +
        window.AutoLocUtils.escapeHtml(q) +
        ' »</div>';
      dd.classList.add('open');
      return;
    }
    var groups = [
      {
        key: 'veh',
        title: 'Véhicules',
        color: 'rgba(59,130,246,0.16)',
        iconColor: '#93c5fd',
        badgeCls: 'badge-info',
        icon:
          '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'
      },
      {
        key: 'cl',
        title: 'Clients',
        color: 'rgba(45,212,191,0.15)',
        iconColor: '#99f6e4',
        badgeCls: 'badge-success',
        icon:
          '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>'
      },
      {
        key: 'res',
        title: 'Réservations',
        color: 'rgba(251,191,36,0.12)',
        iconColor: '#f59e0b',
        badgeCls: 'badge-warning',
        icon:
          '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
      }
    ];
    var html = '';
    groups.forEach(function (g) {
      var items = results.filter(function (r) {
        return r.type === g.key;
      });
      if (!items.length) return;
      html += '<div class="search-group-title">' + g.title + '</div>';
      items.forEach(function (item, i) {
        var id = 'sri-' + g.key + '-' + i;
        html +=
          '<div class="search-item" id="' +
          id +
          '" onclick="(' +
          item.action.toString() +
          ')();clearSearch()"><div class="search-item-icon" style="background:' +
          g.color +
          '"><svg fill="none" viewBox="0 0 24 24" stroke="' +
          g.iconColor +
          '" stroke-width="2">' +
          g.icon +
          '</svg></div><div class="search-item-info"><strong>' +
          highlight(item.label, q) +
          '</strong><span>' +
          highlight(item.sub, q) +
          '</span></div></div>';
      });
    });
    dd.innerHTML = html;
    dd.classList.add('open');
    searchActiveIdx = -1;
  };

  global.goToVeh = function (id) {
    var link = document.querySelector('nav a[data-page="vehicules"]');
    if (link) ctx.navigate(link);
    setTimeout(function () {
      var rows = document.querySelectorAll('#veh-tbody tr');
      rows.forEach(function (r) {
        r.style.background = '';
      });
      var vehs = load(ctx.KEYS.veh).filter(function (v) {
        return !v._deleted;
      });
      var sid = String(id);
      var idx = vehs.findIndex(function (v) {
        return idEq(v.id, sid);
      });
      if (idx >= 0 && rows[idx]) {
        rows[idx].style.background = 'rgba(251,191,36,0.16)';
        rows[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
          rows[idx].style.background = '';
        }, 2000);
      }
    }, 150);
  };

  global.goToClient = function (id) {
    var link = document.querySelector('nav a[data-page="clients"]');
    if (link) ctx.navigate(link);
    setTimeout(function () {
      var rows = document.querySelectorAll('#client-tbody tr');
      rows.forEach(function (r) {
        r.style.background = '';
      });
      var cls = load(ctx.KEYS.cl).filter(function (c) {
        return !c._deleted;
      });
      var sid = String(id);
      var idx = cls.findIndex(function (c) {
        return idEq(c.id, sid);
      });
      if (idx >= 0 && rows[idx]) {
        rows[idx].style.background = 'rgba(251,191,36,0.16)';
        rows[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
          rows[idx].style.background = '';
        }, 2000);
      }
    }, 150);
  };

  global.goToRes = function (id) {
    var link = document.querySelector('nav a[data-page="reservations"]');
    if (link) ctx.navigate(link);
    setTimeout(function () {
      var sid = String(id);
      function clearOutlines() {
        document.querySelectorAll('#res-grid .rental-card').forEach(function (c) {
          c.style.outline = '';
        });
      }
      function findAndHighlight() {
        clearOutlines();
        var target = null;
        document.querySelectorAll('#res-grid .rental-card').forEach(function (card) {
          var rid = card.getAttribute('data-res-id');
          if (rid != null && idEq(rid, sid)) target = card;
        });
        if (target) {
          target.style.outline = '2px solid var(--gold)';
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () {
            target.style.outline = '';
          }, 2500);
          return true;
        }
        return false;
      }
      if (findAndHighlight()) return;
      var allBtn = document.querySelector('#res-filters .filter-btn');
      if (allBtn && typeof global.filterRes === 'function') {
        global.filterRes(allBtn, 'all');
        setTimeout(function () {
          findAndHighlight();
        }, 50);
      }
    }, 150);
  };

  global.invooGlobalSearch = {
    attach: function (c) {
      ctx = c;
      if (global.__invooSearchClickBound) return;
      global.__invooSearchClickBound = true;
      document.addEventListener('click', function (e) {
        var wrap = document.getElementById('search-wrap');
        if (!wrap || !wrap.contains(e.target)) global.closeSearchDropdown();
      });
    }
  };
})(typeof window !== 'undefined' ? window : this);
