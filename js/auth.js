/**
 * Points d’entrée globaux (APP-GUIDE) — implémentés dans 01-app-core.js après chargement du module.
 */
(function(){
 function preloadOPFS(){
 return typeof window.__autolocPreloadOPFS==='function'
  ? window.__autolocPreloadOPFS()
  : Promise.resolve();
 }
 function checkAuth(){
 if(typeof window.__autolocCheckAuth==='function')window.__autolocCheckAuth();
 }
 globalThis.preloadOPFS=preloadOPFS;
 globalThis.checkAuth=checkAuth;
})();
