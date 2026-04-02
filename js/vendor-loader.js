/**
 * Chargement paresseux des vendors lourds (hors ligne : fichiers déjà precachés par le SW).
 */
(function (global) {
  'use strict';

  function asset(rel) {
    return new URL(rel, document.baseURI).href;
  }

  function loadScriptOnce(url, isReady) {
    if (isReady && isReady()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('Échec chargement script'));
      };
      document.head.appendChild(s);
    });
  }

  var chartP = null;
  global.invooEnsureChart = function () {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    if (!chartP) {
      chartP = loadScriptOnce(asset('assets/vendor/chart.umd.js'), function () {
        return typeof Chart !== 'undefined';
      });
    }
    return chartP;
  };

  var xlsxP = null;
  global.invooEnsureXlsx = function () {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    if (!xlsxP) {
      xlsxP = loadScriptOnce(asset('assets/vendor/xlsx.full.min.js'), function () {
        return typeof XLSX !== 'undefined';
      });
    }
    return xlsxP;
  };

  var jspdfP = null;
  global.invooEnsureJsPdf = function () {
    if (global.jspdf) return Promise.resolve();
    if (!jspdfP) {
      jspdfP = loadScriptOnce(asset('assets/vendor/jspdf.umd.min.js'), function () {
        return !!global.jspdf;
      });
    }
    return jspdfP;
  };
})(typeof window !== 'undefined' ? window : globalThis);
