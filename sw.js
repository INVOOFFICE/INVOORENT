const CACHE_NAME='INVOORENT-v22';
const ASSETS=[
 '/index.html',
 '/manifest.json',
 '/assets/vendor/chart.umd.js',
 '/assets/vendor/xlsx.full.min.js',
 '/assets/autoloc-icon-192.png',
 '/assets/autoloc-icon-512.png',
 '/css/styles.css',
 '/js/00-passive-touch.js',
 '/js/00-html-utils.js',
 '/js/01-app-core.js',
 '/js/06-core-utils.js',
 '/js/07-master-key-utils.js',
 '/js/02-backup.js',
 '/js/03-supabase-sync.js',
 '/js/04-import.js',
 '/js/05-save-patch.js'
];
self.addEventListener('install',e=>{
 e.waitUntil(
 caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))
);
 self.skipWaiting();
});
self.addEventListener('message',e=>{
 if(e.data&&e.data.type==='SKIP_WAITING'){
  self.skipWaiting();
 }
});
self.addEventListener('activate',e=>{
 e.waitUntil(
 caches.keys().then(keys=>
 Promise.all(
 keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
)
)
);
 self.clients.claim();
});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 if(!e.request.url.startsWith(self.location.origin))return;
 e.respondWith(
 fetch(e.request)
 .then(response=>{
 const clone=response.clone();
 caches.open(CACHE_NAME).then(cache=>cache.put(e.request,clone));
 return response;
})
 .catch(()=>{
 return caches.match(e.request).then(cached=>{
 if(cached)return cached;
 if(e.request.mode==='navigate'){
 return caches.match('/index.html');
}
});
})
);
});