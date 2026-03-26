(function(){
 function patchSave(){
 if(typeof save==='undefined')return;
 if(window._autolocSavePatched2)return;
 window._autolocSavePatched2=true;
 const _orig=save;
 window.save=function(k,d){
 _orig(k,d);
 if(window.AutoLocSync&&typeof window.AutoLocSync.push==='function'){
 const syncKeys=(Array.isArray(window.AUTOLOC_SYNC_KEYS)&&window.AUTOLOC_SYNC_KEYS.length)
 ?window.AUTOLOC_SYNC_KEYS
 :['autoloc_veh','autoloc_cl','autoloc_res','autoloc_maint'];
 if(syncKeys.includes(k)&&Array.isArray(d)){
 d.forEach(item=>{
 if(item&&item.id){
 window.AutoLocSync.push(k,item).catch(()=>{});
}
});
}
}
};
}
 if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',patchSave);
}else{
 patchSave();
}
})();
