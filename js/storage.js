/**
 * Façade APP-GUIDE (local-first) : l’implémentation OPFS vit dans 01-app-core.js (objet OPFS).
 * Expose window.APP.opfs.ready une fois 01-app-core chargé.
 */
(function(){
 window.APP=window.APP||{};
 if(!window.APP.opfs&&window.OPFS){
 window.APP.opfs={
 get ready(){return!!window.OPFS._ready;}
 };
 }
 window.APP.storage=window.APP.storage||{
  get opfsReady(){return!!(window.OPFS&&window.OPFS._ready);},
  get lastPersistTs(){
   try{return parseInt(localStorage.getItem('autoloc_last_persist_ts')||'0',10);}catch(e){return 0;}
  },
  async requestPersist(){
   if(!navigator.storage||typeof navigator.storage.persist!=='function')return false;
   try{return await navigator.storage.persist();}catch(e){return false;}
  }
 };
})();
