/**
 * Graphiques Chart.js du tableau de bord (données injectées par 01-app-core).
 * Nécessite Chart (global) chargé avant ce fichier.
 */
(function (global) {
  'use strict';

  var chartCA = null;
  var chartOcc = null;
  var chartVeh = null;

  function render(ctx) {
    if (!ctx || typeof ctx.load !== 'function' || !ctx.KEYS) return;
    if (typeof Chart === 'undefined') return;

    var load = ctx.load;
    var KEYS = ctx.KEYS;
    var idEq =
      global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
        ? function (a, b) {
            return global.AutoLocCoreUtils.idEq(a, b);
          }
        : function (a, b) {
            return String(a) === String(b);
          };
    var res = load(KEYS.res).filter(function (r) {
      return !r._deleted;
    });
    var vehs = load(KEYS.veh).filter(function (v) {
      return !v._deleted;
    });
    var MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    var now = new Date();
    var caByMonth = Array(12).fill(0);
    var labels12 = [];
    var i;
    for (i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels12.push(
        MOIS[d.getMonth()] +
          (i === 0 ? '' : d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear().toString().slice(2) : '')
      );
      res
        .filter(function (r) {
          return r.statut === 'terminée' && r.debut;
        })
        .forEach(function (r) {
          var rd = new Date(r.debut);
          if (rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()) {
            caByMonth[11 - i] += r.total || 0;
          }
        });
    }
    var ctxCA = document.getElementById('chart-ca');
    if (ctxCA) {
      if (chartCA) chartCA.destroy();
      chartCA = new Chart(ctxCA, {
        type: 'bar',
        data: {
          labels: labels12,
          datasets: [
            {
              label: 'CA(MAD)',
              data: caByMonth,
              backgroundColor: '#2dd4bf',
              borderRadius: 5,
              borderSkipped: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 11 },
                callback: function (v) {
                  return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v;
                }
              }
            }
          }
        }
      });
    }
    var occByMonth = Array(12).fill(0);
    var totalVehs = vehs.length || 1;
    for (i = 11; i >= 0; i--) {
      d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      var joursLoues = 0;
      res
        .filter(function (r) {
          return r.statut !== 'annulée' && r.debut && r.fin;
        })
        .forEach(function (r) {
          var debut = new Date(r.debut);
          var fin = new Date(r.fin);
          var mStart = new Date(d.getFullYear(), d.getMonth(), 1);
          var mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          var start = debut > mStart ? debut : mStart;
          var end = fin < mEnd ? fin : mEnd;
          var days = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24))) + 1;
          joursLoues += days;
        });
      occByMonth[11 - i] = Math.min(100, Math.round((joursLoues / (totalVehs * daysInMonth)) * 100));
    }
    var ctxOcc = document.getElementById('chart-occupation');
    if (ctxOcc) {
      if (chartOcc) chartOcc.destroy();
      chartOcc = new Chart(ctxOcc, {
        type: 'line',
        data: {
          labels: labels12,
          datasets: [
            {
              label: 'Taux occupation %',
              data: occByMonth,
              borderColor: '#5eead4',
              backgroundColor: 'rgba(45,212,191,0.16)',
              pointBackgroundColor: '#5eead4',
              pointRadius: 4,
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
              min: 0,
              max: 100,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 11 },
                callback: function (v) {
                  return v + '%';
                }
              }
            }
          }
        }
      });
    }
    var vehCA = vehs
      .map(function (v) {
        var caV = res
          .filter(function (r) {
            return idEq(r.vehId, v.id) && r.statut === 'terminée';
          })
          .reduce(function (s, r) {
            return s + (r.total || 0);
          }, 0);
        return { label: v.marque + ' ' + v.modele + '\n' + v.immat, ca: caV };
      })
      .sort(function (a, b) {
        return b.ca - a.ca;
      });
    var wrapVeh = document.getElementById('chart-veh-wrap');
    var ctxVehEl = document.getElementById('chart-veh');
    if (ctxVehEl && wrapVeh) {
      var h = Math.max(120, vehCA.length * 42 + 40);
      wrapVeh.style.height = h + 'px';
      if (chartVeh) chartVeh.destroy();
      chartVeh = new Chart(ctxVehEl, {
        type: 'bar',
        data: {
          labels: vehCA.map(function (x) {
            return x.label;
          }),
          datasets: [
            {
              label: 'CA(MAD)',
              data: vehCA.map(function (x) {
                return x.ca;
              }),
              backgroundColor: vehCA.map(function (_, idx) {
                return idx === 0 ? '#f59e0b' : '#2dd4bf';
              }),
              borderRadius: 5,
              borderSkipped: false
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 11 },
                callback: function (v) {
                  return v >= 1000 ? (v / 1000).toFixed(0) + 'k MAD' : v + ' MAD';
                }
              }
            },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  }

  global.invooDashboardCharts = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
