/**
 * Injection synchrone des fragments HTML au chargement (premier nœud du <body>).
 *
 * Ordre final dans le DOM : auth-shell → app (frame + pages + </main>) → modals-stack → ce script.
 *
 * partials/app-frame.html : sidebar, overlay, <main>, topbar, bannières.
 * partials/pages/*.html : #page-dashboard … #page-parametres (dans l’ordre).
 * Fermeture </main> ajoutée après les pages.
 *
 * partials/auth-shell.html, partials/modals-stack.html : inchangés.
 *
 * Offline / PWA : XHR synchrone ; precache tous les chemins dans sw.js ASSETS.
 */
(function () {
 'use strict';
 var anchor = document.currentScript;
 if (!anchor || !anchor.parentNode) return;

 var APP_PAGE_PARTIALS = [
  'partials/pages/page-dashboard.html',
  'partials/pages/page-vehicules.html',
  'partials/pages/page-clients.html',
  'partials/pages/page-reservations.html',
  'partials/pages/page-calendrier.html',
  'partials/pages/page-maintenance.html',
  'partials/pages/page-guide.html',
  'partials/pages/page-parametres.html',
 ];

 function loadSync(relPath) {
  var url = new URL(relPath, window.location.href).href;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.send(null);
  if (xhr.status !== 200 && xhr.status !== 0) {
   throw new Error(relPath + ' → HTTP ' + xhr.status);
  }
  return xhr.responseText;
 }

 function inject(html, label) {
  var text = (html || '').trim();
  if (text.length < 40) {
   throw new Error(label + ' : contenu trop court');
  }
  var tpl = document.createElement('template');
  tpl.innerHTML = text;
  anchor.parentNode.insertBefore(tpl.content, anchor);
 }

 function buildAppHtml() {
  var frame = loadSync('partials/app-frame.html').trim();
  var blocks = APP_PAGE_PARTIALS.map(function (p) {
   return loadSync(p).trim();
  });
  return frame + '\n' + blocks.join('\n') + '\n</main>\n';
 }

 function showBootFallback(msgHtml) {
  var fb = document.getElementById('invoo-boot-fallback');
  if (!fb) return;
  fb.style.display = 'block';
  fb.innerHTML =
   '<h1 style="margin:0 0 16px;font-size:1.35rem;color:#5eead4;font-weight:700">INVOORENT</h1>' +
   msgHtml;
 }

 try {
  inject(loadSync('partials/modals-stack.html'), 'modals-stack');
  inject(buildAppHtml(), 'app-shell');
  inject(loadSync('partials/auth-shell.html'), 'auth-shell');
  var fbOk = document.getElementById('invoo-boot-fallback');
  if (fbOk) fbOk.remove();
 } catch (e) {
  console.error('[INVOORENT partials]', e.message || e);
  var isFile = typeof location !== 'undefined' && location.protocol === 'file:';
  var body =
   (isFile
    ? '<p style="margin:0 0 14px">Vous ouvrez la page en <strong>file://</strong>. Les navigateurs (Chrome, Edge…) bloquent en général le chargement des fragments HTML du dossier <code>partials/</code>, ce qui laisse l’écran vide.</p><p style="margin:0 0 14px"><strong>À faire :</strong> lancer un petit serveur HTTP dans le dossier du projet, puis ouvrir l’URL <code>http://localhost…</code> affichée.</p><p style="margin:0 0 8px;font-size:0.88rem;color:#94a3b8">Exemples (PowerShell ou terminal), depuis le dossier qui contient <code>index.html</code> :</p><pre style="margin:0 0 18px;background:#1e293b;padding:14px 16px;border-radius:10px;overflow:auto;font-size:0.82rem;color:#cbd5e1">npx -y serve .\n<span style="color:#64748b"># ou</span>\npython -m http.server 8080</pre><p style="margin:0;font-size:0.85rem;color:#94a3b8">Détail technique : ' +
      (e && e.message ? String(e.message).replace(/</g, '&lt;') : 'erreur inconnue') +
      '</p>'
    : '<p style="margin:0 0 12px">Les fichiers du dossier <code>partials/</code> n’ont pas pu être chargés (chemin incorrect, fichier manquant ou réseau).</p><p style="margin:0;font-size:0.85rem;color:#94a3b8">' +
      (e && e.message ? String(e.message).replace(/</g, '&lt;') : '') +
      '</p>');
  showBootFallback(body);
 }
})();
