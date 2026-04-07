// Prefer injecting this from a build step when available.
const CACHE_NAME='INVOORENT-v119';
/* ASSETS : garder aligné avec index.html (chaque <script src=…> + href manifest/css/icônes). */
const ASSETS=[
 'index.html',
 'paiement.html',
 'offline.html',
 'sw.js',
 'manifest.json',
 'partials/auth-shell.html',
 'partials/app-frame.html',
 'partials/pages/page-dashboard.html',
 'partials/pages/page-vehicules.html',
 'partials/pages/page-clients.html',
 'partials/pages/page-reservations.html',
 'partials/pages/page-calendrier.html',
 'partials/pages/page-maintenance.html',
 'partials/pages/page-guide.html',
 'partials/pages/page-parametres.html',
 'partials/modals-stack.html',
 'assets/vendor/chart.umd.js',
 'assets/vendor/xlsx.full.min.js',
 'assets/vendor/jspdf.umd.min.js',
 'assets/vendor/supabase.umd.js',
 'assets/autoloc-icon-192.png',
 'assets/autoloc-icon-512.png',
 'css/styles.css',
 'css/paiement-licence.css',
 'js/partials-loader.js',
 'js/00-passive-touch.js',
 'js/00-html-utils.js',
 'js/vendor-loader.js',
 'js/history-modals.js',
 'js/payment-modals.js',
 'js/contract-print.js',
 'js/etat-lieux-vehicule.js',
 'js/rapport-modals.js',
 'js/reservations-render.js',
 'js/data-export.js',
 'js/backup-validate.js',
 'js/dashboard-charts.js',
 'js/calendar-view.js',
 'js/maintenance-ui.js',
 'js/photos-ui.js',
 'js/global-search.js',
 'js/guide-html.js',
 'js/parametres-ui.js',
 'js/reservations-modal.js',
 'js/06-core-utils.js',
 'js/07-master-key-utils.js',
 'js/license-activation.js',
 'js/storage.js',
 'js/auth.js',
 'js/alerts-ui.js',
 'js/dashboard-ui.js',
 'js/01-app-core.js',
 'js/app.js',
 'js/02-backup.js',
 'js/03-supabase-sync.js',
 'js/04-import.js',
 'js/05-save-patch.js',
 'js/sw-register.js'
];
self.addEventListener('install',e=>{
 e.waitUntil(
 caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
);
});
self.addEventListener('message',e=>{
 if(e.data&&e.data.type==='SKIP_WAITING'){
  self.skipWaiting();
 }
});
self.addEventListener('activate',e=>{
 e.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
   .then(()=>self.clients.claim())
 );
});

async function matchInCache(pathFromScope){
 const base=self.registration.scope;
 const abs=new URL(pathFromScope,base).href;
 return (await caches.match(abs))||(await caches.match(pathFromScope));
}

/** Navigation hors ligne / URL inconnue : index.html (app shell) d’abord ; offline.html seulement en dernier recours. */
async function navigateOfflineFallback(){
 const indexPage=await matchInCache('index.html');
 if(indexPage)return indexPage;
 const offlinePage=await matchInCache('offline.html');
 if(offlinePage)return offlinePage;
 return new Response('Offline',{status:503,statusText:'Offline'});
}

async function cacheFirst(request){
 const cached=await caches.match(request);
 if(cached)return cached;
 try{
  const response=await fetch(request);
  const clone=response.clone();
  caches.open(CACHE_NAME).then(cache=>cache.put(request,clone));
  return response;
 }catch(_err){
  if(request.mode==='navigate'){
   return navigateOfflineFallback();
  }
  return new Response('Offline',{status:503,statusText:'Offline'});
 }
}

/* Même origine, GET : cache d’abord (évite l’attente réseau hors ligne si la ressource est précachée).
   Appels tiers (ex. Supabase) : autre origine → pas interceptés ici. */
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin)return;
 e.respondWith(cacheFirst(e.request));
});