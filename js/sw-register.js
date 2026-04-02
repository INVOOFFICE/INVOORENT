(function () {
  'use strict';

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    return;
  }

  var regRef = null;
  var refreshing = false;
  var toastShown = false;

  function swUrls() {
    var cur = document.currentScript;
    if (cur && cur.src) {
      return {
        swUrl: new URL('../sw.js', cur.src).href,
        scopeUrl: new URL('../', cur.src).href
      };
    }
    var base = new URL('./', window.location.href).href;
    return { swUrl: new URL('sw.js', base).href, scopeUrl: base };
  }

  function requestUpdateCheck() {
    if (!regRef || !navigator.onLine) return;
    regRef.update().catch(function () {});
  }

  function triggerActivateAndReload() {
    refreshing = true;
    if (regRef && regRef.waiting) {
      regRef.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  function showUpdateToast() {
    if (toastShown || !document.body) return;
    toastShown = true;
    var wrap = document.createElement('div');
    wrap.id = 'invoo-sw-update-toast';
    wrap.setAttribute('role', 'status');
    wrap.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'left:16px',
      'right:16px',
      'z-index:100000',
      'max-width:420px',
      'margin:0 auto',
      'padding:14px 16px',
      'background:#18192B',
      'border:1px solid rgba(45,212,191,0.35)',
      'border-radius:12px',
      'box-shadow:0 12px 40px rgba(0,0,0,0.45)',
      "font-family:'DM Sans',sans-serif",
      'font-size:0.82rem',
      'color:rgba(255,255,255,0.88)',
      'line-height:1.45'
    ].join(';');
    wrap.innerHTML =
      '<div style="margin-bottom:10px;font-weight:600;color:#fff;">Mise à jour disponible</div>' +
      '<div style="margin-bottom:12px;opacity:0.75;">Une nouvelle version est prête. Rechargez pour l’appliquer. La connexion sert surtout à détecter et télécharger ces mises à jour.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button type="button" data-invoo-later style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(255,255,255,0.55);cursor:pointer;font-size:0.8rem;">Plus tard</button>' +
      '<button type="button" data-invoo-apply style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#2dd4bf,#0d9488);color:#fff;font-weight:600;cursor:pointer;font-size:0.8rem;">Mettre à jour</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-invoo-later]').addEventListener('click', function () {
      wrap.remove();
      toastShown = false;
    });
    wrap.querySelector('[data-invoo-apply]').addEventListener('click', function () {
      wrap.remove();
      toastShown = false;
      triggerActivateAndReload();
    });
  }

  function watchWaiting(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateToast();
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) {
      window.location.reload();
    }
  });

  window.addEventListener('load', function () {
    var u = swUrls();
    navigator.serviceWorker
      .register(u.swUrl, { scope: u.scopeUrl })
      .then(function (reg) {
        regRef = reg;
        watchWaiting(reg);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
        requestUpdateCheck();
      })
      .catch(function (err) {
        console.warn('INVOORENT SW:', err && err.message ? err.message : err);
      });

    window.addEventListener('focus', requestUpdateCheck);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') requestUpdateCheck();
    });
    window.addEventListener('online', requestUpdateCheck);
    setInterval(requestUpdateCheck, 6 * 60 * 60 * 1000);
  });
})();
