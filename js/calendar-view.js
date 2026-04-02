/**
 * Grille calendrier (véhicules × jours du mois).
 *
 * Branchement dans js/01-app-core.js — fin de fichier, même IIFE que les autres attach :
 *   invooCalendarView.attach({ load, KEYS });
 *
 * Les boutons de page-calendrier.html appellent calPrev / calNext / calToday (globaux).
 */
(function (global) {
  'use strict';

  var ctx = null;
  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var MOIS_FR = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre'
  ];
  var JOURS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  function toLocalDateStr(dateLike) {
    var d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
    if (isNaN(d)) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  global.calPrev = function () {
    calMonth--;
    if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    global.renderCalendar();
  };

  global.calNext = function () {
    calMonth++;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    }
    global.renderCalendar();
  };

  global.calToday = function () {
    calYear = new Date().getFullYear();
    calMonth = new Date().getMonth();
    global.renderCalendar();
  };

  global.renderCalendar = function () {
    if (!ctx) return;
    var load = ctx.load;
    var KEYS = ctx.KEYS;
    var thead = document.getElementById('cal-thead');
    var tbody2 = document.getElementById('cal-tbody');
    if (!thead || !tbody2) return;
    var vehs = load(KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var reservations = load(KEYS.res).filter(function (r) {
      return !r._deleted && r.statut !== 'annulée';
    });
    var clients = load(KEYS.cl).filter(function (c) {
      return !c._deleted;
    });
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var today = new Date();
    var todayStr = toLocalDateStr(today);
    var ml = document.getElementById('cal-month-label');
    if (ml) ml.textContent = MOIS_FR[calMonth] + ' ' + calYear;
    var headHtml = '<tr><th class="col-veh">Véhicule</th>';
    var d;
    for (d = 1; d <= daysInMonth; d++) {
      var dateStr =
        calYear +
        '-' +
        String(calMonth + 1).padStart(2, '0') +
        '-' +
        String(d).padStart(2, '0');
      var dow = new Date(calYear, calMonth, d).getDay();
      var isWeekend = dow === 0 || dow === 6;
      var isToday = dateStr === todayStr;
      headHtml +=
        '<th class="' +
        (isToday ? 'today-col' : '') +
        '" style="' +
        (isWeekend ? 'background:rgba(45,212,191,0.10);color:#b6efe7' : '') +
        '">' +
        d +
        '<br><span style="font-size:0.62rem;font-weight:400">' +
        JOURS_FR[(dow + 6) % 7] +
        '</span></th>';
    }
    headHtml += '</tr>';
    thead.innerHTML = headHtml;
    if (!vehs.length) {
      tbody2.innerHTML =
        '<tr><td colspan="' +
        (daysInMonth + 1) +
        '" style="text-align:center;padding:40px;color:var(--text3)">Aucun véhicule enregistré</td></tr>';
      return;
    }
    var bodyHtml = '';
    vehs.forEach(function (v) {
      var dayMap = {};
      reservations
        .filter(function (r) {
          return r.vehId === v.id;
        })
        .forEach(function (r) {
          if (!r.debut || !r.fin) return;
          var client = clients.find(function (c) {
            return c.id === r.clientId;
          });
          var clientName = client ? client.prenom + ' ' + client.nom : 'Client';
          var d1 = new Date(r.debut);
          var d2 = new Date(r.fin);
          var d1Str = r.debut;
          var d2Str = r.fin;
          var cur = new Date(d1);
          while (cur <= d2) {
            var ds = toLocalDateStr(cur);
            dayMap[ds] = {
              type: 'booked',
              clientName: clientName,
              debut: d1Str,
              fin: d2Str,
              resId: r.id
            };
            cur.setDate(cur.getDate() + 1);
          }
        });
      bodyHtml +=
        '<tr><td class="col-veh"><span class="veh-name">' +
        window.AutoLocUtils.escapeHtml(v.marque) +
        ' ' +
        window.AutoLocUtils.escapeHtml(v.modele) +
        '</span><span class="veh-sub">' +
        window.AutoLocUtils.escapeHtml(v.immat) +
        '</span></td>';
      for (d = 1; d <= daysInMonth; d++) {
        var ds =
          calYear +
          '-' +
          String(calMonth + 1).padStart(2, '0') +
          '-' +
          String(d).padStart(2, '0');
        var isTodayCell = ds === todayStr;
        var info = dayMap[ds];
        var dow2 = new Date(calYear, calMonth, d).getDay();
        var isWeekend2 = dow2 === 0 || dow2 === 6;
        if (info && info.type === 'booked') {
          var prevDs = toLocalDateStr(new Date(new Date(ds).getTime() - 86400000));
          var nextDs = toLocalDateStr(new Date(new Date(ds).getTime() + 86400000));
          var prevSame = dayMap[prevDs] && dayMap[prevDs].resId === info.resId;
          var nextSame = dayMap[nextDs] && dayMap[nextDs].resId === info.resId;
          var posClass = 'middle';
          if (!prevSame && !nextSame) posClass = 'solo';
          else if (!prevSame) posClass = 'start';
          else if (!nextSame) posClass = 'end';
          var label =
            posClass === 'start' || posClass === 'solo'
              ? window.AutoLocUtils.escapeHtml(info.clientName.split(' ')[0])
              : '';
          bodyHtml +=
            '<td style="' +
            (isTodayCell ? 'outline:2px solid var(--accent2);outline-offset:-2px;' : '') +
            (isWeekend2 ? 'background:rgba(45,212,191,0.08);' : '') +
            '"><div class="cal-tooltip"><div class="cal-cell booked ' +
            posClass +
            '" title=""></div><div class="tooltip-box">' +
            window.AutoLocUtils.escapeHtml(info.clientName) +
            '<br>' +
            window.AutoLocUtils.escapeHtml(info.debut) +
            ' → ' +
            window.AutoLocUtils.escapeHtml(info.fin) +
            '</div></div></td>';
        } else if (v.statut === 'maintenance' && !info) {
          bodyHtml +=
            '<td style="' +
            (isWeekend2 ? 'background:rgba(45,212,191,0.08);' : '') +
            '"><div class="cal-cell maintenance" title="Maintenance">M</div></td>';
        } else {
          bodyHtml +=
            '<td style="' +
            (isTodayCell ? 'outline:2px solid var(--accent2);outline-offset:-2px;' : '') +
            (isWeekend2 ? 'background:rgba(45,212,191,0.08);' : '') +
            '"><div class="cal-cell free"></div></td>';
        }
      }
      bodyHtml += '</tr>';
    });
    tbody2.innerHTML = bodyHtml;
  };

  global.invooCalendarView = {
    attach: function (c) {
      ctx = c;
    }
  };
})(typeof window !== 'undefined' ? window : this);
