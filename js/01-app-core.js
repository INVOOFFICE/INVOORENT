const KEYS={veh:'autoloc_veh',cl:'autoloc_cl',res:'autoloc_res',log:'autoloc_log',maint:'autoloc_maint',settings:'autoloc_settings'};
const SYNC_KEYS=[KEYS.veh,KEYS.cl,KEYS.res,KEYS.maint];
if(typeof window!=='undefined')window.AUTOLOC_SYNC_KEYS=SYNC_KEYS.slice();
const PHOTOS_ENABLED=false;
const LAST_PERSIST_TS_KEY='autoloc_last_persist_ts';
function _touchPersistTimestamp(){
 try{localStorage.setItem(LAST_PERSIST_TS_KEY,String(Date.now()));}catch(_e){}
}
let _opfsSyncRecursion=0;
const OPFS={
 _root: null,
 _ready: false,
 _initPromise: null,
 _encKey: null,
 _encKeyPromise: null,
 _allCache: null,
 _allCacheLoaded: false,
 _allCachePromise: null,
 _flushTimer: null,
 _flushInFlight: null,
 _flushDelayMs: 180,
 _hasPendingWrites: false,
 DATA_FILE: 'autoloc_data.json',
 ENC_KEY_STORAGE: 'autoloc_masterKey_pbkdf2_v1',
 ENC_KEY_DB: 'autoloc_secure_keys_v1',
 ENC_KEY_STORE: 'keys',
 ENC_KEY_ID: 'opfs_aes_key',
 PHOTOS_DIR: 'autoloc_photos',
 _hexToBytes(hex){
  if(!hex||typeof hex!=='string'||hex.length%2!==0)return null;
  const out=new Uint8Array(hex.length/2);
  for(let i=0;i<hex.length;i+=2){
   const v=parseInt(hex.slice(i,i+2),16);
   if(Number.isNaN(v))return null;
   out[i/2]=v;
  }
  return out;
 },
 async _sha256Hex(text){
  const buf=new TextEncoder().encode(String(text??''));
  const hash=await crypto.subtle.digest('SHA-256',buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
 },
 async _openKeyDb(){
  if(typeof indexedDB==='undefined')return null;
  return await new Promise((resolve,reject)=>{
   const req=indexedDB.open(this.ENC_KEY_DB,1);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains(this.ENC_KEY_STORE)){
     db.createObjectStore(this.ENC_KEY_STORE);
    }
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||new Error('IndexedDB indisponible'));
  });
 },
 async _loadStoredCryptoKey(){
  try{
   const db=await this._openKeyDb();
   if(!db)return null;
   const key=await new Promise((resolve,reject)=>{
    const tx=db.transaction(this.ENC_KEY_STORE,'readonly');
    const store=tx.objectStore(this.ENC_KEY_STORE);
    const req=store.get(this.ENC_KEY_ID);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error('Lecture clé impossible'));
   });
   db.close();
   return key instanceof CryptoKey ? key : null;
  }catch(e){return null;}
 },
 async _storeCryptoKey(key){
  try{
   const db=await this._openKeyDb();
   if(!db)return false;
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(this.ENC_KEY_STORE,'readwrite');
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Ecriture clé impossible'));
    tx.objectStore(this.ENC_KEY_STORE).put(key,this.ENC_KEY_ID);
   });
   db.close();
   return true;
  }catch(e){return false;}
 },
 async _getEncryptionKey(){
  if(this._encKey)return this._encKey;
  if(this._encKeyPromise)return this._encKeyPromise;
  this._encKeyPromise=(async()=>{
   try{
    const storedKey=await this._loadStoredCryptoKey();
    if(storedKey){
     this._encKey=storedKey;
     return storedKey;
    }
    const raw=localStorage.getItem(this.ENC_KEY_STORAGE);
    if(!raw)return null;
    const rec=JSON.parse(raw);
    const dkHex=rec&&rec.dk;
    const keyBytes=this._hexToBytes(dkHex);
    if(!keyBytes||keyBytes.length!==32)return null;
    const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
    const keyStored=await this._storeCryptoKey(key);
    // Migration sécurité: une fois la CryptoKey stockée de façon non-exportable,
    // retirer dk en clair de localStorage et conserver uniquement un vérificateur.
    if(keyStored&&rec&&rec.dk){
     try{
      rec.dkv=rec.dkv||await this._sha256Hex(rec.dk);
      delete rec.dk;
      localStorage.setItem(this.ENC_KEY_STORAGE,JSON.stringify(rec));
     }catch(e){}
    }
    this._encKey=key;
    return key;
   }catch(e){
    console.warn('AutoLoc OPFS: clé de chiffrement indisponible');
    return null;
   }finally{
    this._encKeyPromise=null;
   }
  })();
  return this._encKeyPromise;
 },
 async _serializeData(dataObj){
  const plain=JSON.stringify(dataObj&&typeof dataObj==='object'?dataObj:{});
  const key=await this._getEncryptionKey();
  if(!key)return plain;
  try{
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const enc=new TextEncoder().encode(plain);
   const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc);
   const toB64=bytes=>btoa(String.fromCharCode(...bytes));
   return JSON.stringify({
    _enc: 'AES-GCM',
    _v: 1,
    iv: toB64(iv),
    data: toB64(new Uint8Array(cipher))
   });
  }catch(e){
   console.warn('AutoLoc OPFS: chiffrement impossible, écriture en clair');
   return plain;
  }
 },
 async _deserializeData(text){
  const parsed=JSON.parse(text);
  if(!parsed||parsed._enc!=='AES-GCM')return parsed;
  const key=await this._getEncryptionKey();
  if(!key)throw new Error('Clé de déchiffrement absente');
  const fromB64=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const iv=fromB64(parsed.iv||'');
  const cipher=fromB64(parsed.data||'');
  const plainBuf=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);
  const plainText=new TextDecoder().decode(plainBuf);
  return JSON.parse(plainText);
 },
 async init(){
 if(this._ready)return true;
 if(this._initPromise)return this._initPromise;
 this._initPromise=(async()=>{
 try{
 if(!navigator.storage||!navigator.storage.getDirectory)return false;
 this._root=await navigator.storage.getDirectory();
 this._ready=true;
 return true;
}catch(e){
 console.warn('AutoLoc OPFS: non disponible —',e.message);
 return false;
}
})();
 return this._initPromise;
},
 async _ensureAllCache(){
 if(this._allCacheLoaded)return this._allCache||{};
 if(this._allCachePromise)return this._allCachePromise;
 this._allCachePromise=(async()=>{
  const all=await this.readAll();
  this._allCache=all||{};
  this._allCacheLoaded=true;
  this._allCachePromise=null;
  return this._allCache;
 })();
 return this._allCachePromise;
},
 invalidateRuntimeCache(){
  this._allCache=null;
  this._allCacheLoaded=false;
  this._allCachePromise=null;
 },
 hasPendingWrites(){
  return !!(this._hasPendingWrites||this._flushTimer||this._flushInFlight);
 },
 async _flushWriteAll(){
 if(!await this.init())return false;
 if(!this._allCacheLoaded)return false;
 try{
  const fh=await this._root.getFileHandle(this.DATA_FILE,{create: true});
  const writable=await fh.createWritable();
  await writable.write(await this._serializeData(this._allCache||{}));
  await writable.close();
  this._hasPendingWrites=false;
  return true;
 }catch(e){
  console.warn('AutoLoc OPFS flushWriteAll:',e.message);
  return false;
 }
},
 _scheduleFlush(){
 if(this._flushTimer)clearTimeout(this._flushTimer);
 this._flushTimer=setTimeout(()=>{
  this._flushTimer=null;
  this._flushInFlight=this._flushWriteAll().finally(()=>{this._flushInFlight=null;});
 },this._flushDelayMs);
},
 async flushNow(){
 if(this._flushTimer){
  clearTimeout(this._flushTimer);
  this._flushTimer=null;
 }
 if(this._flushInFlight){
  return await this._flushInFlight;
 }
 this._flushInFlight=this._flushWriteAll().finally(()=>{this._flushInFlight=null;});
 return await this._flushInFlight;
},
 async readAll(forceFresh){
 if(!await this.init())return null;
 if(forceFresh)this.invalidateRuntimeCache();
 if(this._allCacheLoaded)return this._allCache||null;
 try{
 const fh=await this._root.getFileHandle(this.DATA_FILE);
 const file=await fh.getFile();
 const text=await file.text();
 const parsed=await this._deserializeData(text);
 this._allCache=parsed||{};
 this._allCacheLoaded=true;
 return parsed;
}catch(e){
 return null;
}
},
 async writeAll(dataObj){
 if(!await this.init())return false;
 try{
 if(this._flushTimer){
  clearTimeout(this._flushTimer);
  this._flushTimer=null;
 }
 if(this._flushInFlight)await this._flushInFlight;
 const fh=await this._root.getFileHandle(this.DATA_FILE,{create: true});
 const writable=await fh.createWritable();
 await writable.write(await this._serializeData(dataObj));
 await writable.close();
  this._allCache=(dataObj&&typeof dataObj==='object')?dataObj:{};
  this._allCacheLoaded=true;
  this._hasPendingWrites=false;
 return true;
}catch(e){
 console.warn('AutoLoc OPFS writeAll:',e.message);
 return false;
}
},
 async read(key){
 const all=await this.readAll();
 return all ?(all[key]?? null): null;
},
 async write(key,value){
 if(!await this.init())return false;
 try{
 const all=await this._ensureAllCache();
 all[key]=value;
 all._updatedAt=Date.now();
 this._hasPendingWrites=true;
 this._scheduleFlush();
 return true;
}catch(e){
 console.warn('AutoLoc OPFS write:',e.message);
 return false;
}
},
 async _getPhotosDir(){
 if(!await this.init())return null;
 try{
 return await this._root.getDirectoryHandle(this.PHOTOS_DIR,{create: true});
}catch(e){return null;}
},
 async readPhotos(type,id,tabKey){
 const dir=await this._getPhotosDir();
 if(!dir)return null;
 const fname=`${type}_${id}_${tabKey}.json`;
 try{
 const fh=await dir.getFileHandle(fname);
 const file=await fh.getFile();
 return JSON.parse(await file.text());
}catch(e){return null;}
},
 async writePhotos(type,id,tabKey,photos){
 const dir=await this._getPhotosDir();
 if(!dir)return false;
 const fname=`${type}_${id}_${tabKey}.json`;
 try{
 const fh=await dir.getFileHandle(fname,{create: true});
 const writable=await fh.createWritable();
 await writable.write(JSON.stringify(photos));
 await writable.close();
 return true;
}catch(e){return false;}
},
 async deletePhotos(type,id,tabKey){
 const dir=await this._getPhotosDir();
 if(!dir)return;
 try{
 await dir.removeEntry(`${type}_${id}_${tabKey}.json`);
}catch(e){}
},
 async migrateFromLocalStorage(){
 if(!await this.init())return false;
 const migKey='autoloc_opfs_migrated';
 if(localStorage.getItem(migKey))return false;
 const dataToMigrate={};
 let hasSomething=false;
 for(const key of Object.values(KEYS)){
 const raw=localStorage.getItem(key);
 if(raw){
 try{
 dataToMigrate[key]=JSON.parse(raw);
 hasSomething=true;
}catch(e){}
}
}
 const settingsRaw=localStorage.getItem(KEYS.settings);
 if(settingsRaw){
 try{dataToMigrate[KEYS.settings]=JSON.parse(settingsRaw);hasSomething=true;}catch(e){}
}
 if(!hasSomething){
 localStorage.setItem(migKey,'1');
 return false;
}
 dataToMigrate._migratedAt=Date.now();
 const ok=await this.writeAll(dataToMigrate);
 if(ok){
 localStorage.setItem(migKey,'1');
 console.info('AutoLoc OPFS: migration localStorage → OPFS réussie');
}
 const photosRaw=localStorage.getItem('autoloc_photos');
 if(photosRaw){
 try{
 const store=JSON.parse(photosRaw);
 for(const type of Object.keys(store)){
 for(const id of Object.keys(store[type])){
 for(const tabKey of Object.keys(store[type][id])){
 const photos=store[type][id][tabKey];
 if(photos&&photos.length){
 await this.writePhotos(type,id,tabKey,photos);
}
}
}
}
 localStorage.removeItem('autoloc_photos');
 console.info('AutoLoc OPFS: photos migrées vers OPFS');
}catch(e){}
}
 return ok;
},
 async exportAll(){
 const all=await this.readAll()||{};
 const photos={};
 const dir=await this._getPhotosDir();
 if(dir){
  try{
   for await(const[name,handle]of dir.entries()){
    if(!handle||handle.kind!=='file')continue;
    if(!name.endsWith('.json'))continue;
    const m=/^(.+?)_(.+?)_(.+?)\.json$/.exec(name);
    if(!m)continue;
    const type=m[1],id=m[2],tabKey=m[3];
    const file=await handle.getFile();
    const raw=await file.text();
    const arr=JSON.parse(raw);
    if(!Array.isArray(arr))continue;
    photos[type]=photos[type]||{};
    photos[type][id]=photos[type][id]||{};
    photos[type][id][tabKey]=arr;
   }
  }catch(e){}
 }
 return{...all,photos};
},
 async importAll(dataObj){
 const src=(dataObj&&typeof dataObj==='object')?dataObj:{};
 const dataOnly={...src};
 const photos=(src.photos&&typeof src.photos==='object')?src.photos:{};
 delete dataOnly.photos;
 const ok=await this.writeAll(dataOnly);
 if(!ok)return false;
 const dir=await this._getPhotosDir();
 if(dir){
  try{
   for await(const[name]of dir.entries()){
    await dir.removeEntry(name);
   }
  }catch(e){}
 }
 for(const type of Object.keys(photos)){
  for(const id of Object.keys(photos[type]||{})){
   for(const tabKey of Object.keys(photos[type][id]||{})){
    const arr=photos[type][id][tabKey];
    if(Array.isArray(arr)&&arr.length){
     await this.writePhotos(type,id,tabKey,arr);
    }
   }
  }
 }
 // Forcer un reload du cache runtime pour éviter tout état stale après restore/import.
 this.invalidateRuntimeCache();
 await this.readAll(true);
 return true;
}
};
if(typeof window!=='undefined')window.OPFS=OPFS;
function alConfirm({title,msg,icon='🗑',danger=true,okLabel,onOk,onCancel}){
 const overlay=document.getElementById('al-confirm-overlay');
 const iconWrap=document.getElementById('al-confirm-icon-wrap');
 const titleEl=document.getElementById('al-confirm-title');
 const msgEl=document.getElementById('al-confirm-msg');
 const okBtn=document.getElementById('al-confirm-ok');
 const cancelBtn=document.getElementById('al-confirm-cancel');
 iconWrap.textContent=icon;
 iconWrap.style.background=danger ? 'rgba(240,68,68,0.15)' : 'rgba(45,212,191,0.15)';
 titleEl.textContent=title;
 msgEl.textContent=msg||'';
 okBtn.textContent=okLabel||(danger ? 'Supprimer' : 'Confirmer');
 okBtn.style.background=danger
 ? 'linear-gradient(135deg,#F04444,#C0392B)'
 : 'linear-gradient(135deg,#2dd4bf,#0d9488)';
 okBtn.style.color='#fff';
 overlay._invooPrevFocus=document.activeElement;
 overlay.setAttribute('aria-hidden','false');
 overlay.style.display='flex';
 setTimeout(function(){okBtn.focus();},50);
 const cleanup=()=>{
 overlay.style.display='none';
 overlay.setAttribute('aria-hidden','true');
 const p=overlay._invooPrevFocus;
 if(p&&typeof p.focus==='function'){try{p.focus();}catch(e){}}
 overlay._invooPrevFocus=null;
 okBtn.onclick=null;
 cancelBtn.onclick=null;
 };
 okBtn.onclick=()=>{cleanup();if(onOk)onOk();};
 cancelBtn.onclick=()=>{cleanup();if(onCancel)onCancel();};
}
function alAlert(msg){
 const overlay=document.getElementById('al-alert-overlay');
 const ok=document.getElementById('al-alert-ok');
 document.getElementById('al-alert-msg').textContent=msg;
 overlay._invooPrevFocus=document.activeElement;
 overlay.setAttribute('aria-hidden','false');
 overlay.style.display='flex';
 setTimeout(function(){ok.focus();},50);
 ok.onclick=()=>{
 overlay.style.display='none';
 overlay.setAttribute('aria-hidden','true');
 const p=overlay._invooPrevFocus;
 if(p&&typeof p.focus==='function'){try{p.focus();}catch(e){}}
 overlay._invooPrevFocus=null;
 ok.onclick=null;
 };
}
const BF_STORAGE_KEY='autoloc_bf_v1';
const BF_MASTER_STORAGE_KEY='autoloc_bf_master_v1';
const BF_STATE_TTL_MS=24*60*60*1000;
const _bf={login:{fails:0,lockedUntil:0,updatedAt:0},master:{fails:0,lockedUntil:0,updatedAt:0},emailLic:{fails:0,lockedUntil:0,updatedAt:0}};
const BF_MAX=5,BF_LOCKOUT_MS=30000;
function sanitizeBfScope(src){
 if(!src||typeof src!=='object')return {fails:0,lockedUntil:0,updatedAt:0};
 const fails=Math.max(0,Math.floor(Number(src.fails)||0));
 const lockedUntil=Math.max(0,Math.floor(Number(src.lockedUntil)||0));
 const updatedAt=Math.max(0,Math.floor(Number(src.updatedAt)||lockedUntil||0));
 if(updatedAt&&Date.now()-updatedAt>BF_STATE_TTL_MS){
  return {fails:0,lockedUntil:0,updatedAt:0};
 }
 return {fails,lockedUntil,updatedAt};
}
function loadBfState(){
 try{
  const sessionRaw=sessionStorage.getItem(BF_STORAGE_KEY);
  const sessionParsed=sessionRaw?JSON.parse(sessionRaw):null;
  for(const scope of ['login','emailLic']){
   const clean=sanitizeBfScope(sessionParsed&&sessionParsed[scope]);
   _bf[scope].fails=clean.fails;
   _bf[scope].lockedUntil=clean.lockedUntil;
   _bf[scope].updatedAt=clean.updatedAt;
  }
  const masterRaw=localStorage.getItem(BF_MASTER_STORAGE_KEY);
  if(masterRaw){
   const masterParsed=JSON.parse(masterRaw);
   const clean=sanitizeBfScope(masterParsed);
   _bf.master.fails=clean.fails;
   _bf.master.lockedUntil=clean.lockedUntil;
   _bf.master.updatedAt=clean.updatedAt;
  }
 }catch(e){}
}
function persistBfState(){
 try{
  const sessionState={
   login:_bf.login,
   emailLic:_bf.emailLic
  };
  sessionStorage.setItem(BF_STORAGE_KEY,JSON.stringify(sessionState));
 }catch(e){}
 try{
  localStorage.setItem(BF_MASTER_STORAGE_KEY,JSON.stringify(_bf.master));
 }catch(e){}
}
loadBfState();
function bfCheck(s){
 if(Date.now()<_bf[s].lockedUntil)return `⏳ Trop de tentatives — réessayez dans ${Math.ceil((_bf[s].lockedUntil-Date.now())/1000)}s`;
 return null;
}
function bfFail(s){
 _bf[s].fails++;
 if(_bf[s].fails>=BF_MAX){
  _bf[s].lockedUntil=Date.now()+BF_LOCKOUT_MS;
  _bf[s].fails=0;
 }
 _bf[s].updatedAt=Date.now();
 persistBfState();
}
function bfReset(s){
 _bf[s].fails=0;
 _bf[s].lockedUntil=0;
 _bf[s].updatedAt=Date.now();
 persistBfState();
}
function renderOPFSStatus(){
 const ind=document.getElementById('opfs-indicator');
 const text=document.getElementById('opfs-status-text');
 const sub=document.getElementById('opfs-status-sub');
 if(!ind)return;
 if(OPFS._ready){
 ind.style.background='#0DB882';
 text.textContent='Stockage OPFS actif — données illimitées';
 text.style.color='var(--success)';
 sub.textContent='Stockage automatique dans ce navigateur,sans limite d\'espace. Pensez à exporter une sauvegarde pour transférer vos données sur un autre appareil.';
}else{
 ind.style.background='#F59E0B';
 text.textContent='Stockage de secours(localStorage — limité à 5 MB)';
 text.style.color='var(--warning)';
 sub.textContent='OPFS non disponible sur ce navigateur. Utilisez Chrome ou Edge pour un stockage illimité et plus fiable.';
}
}
async function buildBackupObject(){
 let photos={};
 if(OPFS._ready){
  try{
   const opfsDump=await OPFS.exportAll();
   photos=opfsDump.photos||{};
  }catch(e){photos={};}
 }else{
  try{
    photos=JSON.parse(localStorage.getItem('autoloc_photos')||'{}')||{};
  }catch(e){
    console.warn('AutoLoc: autoloc_photos corrompu,export partiel',e.message);
    photos={};
  }
 }
 return{
 version: '1.1',
 date: new Date().toISOString(),
 storage: OPFS._ready ? 'opfs' : 'localstorage',
 data:{
 veh: load(KEYS.veh),
 cl: load(KEYS.cl),
 res: load(KEYS.res),
 log: load(KEYS.log),
 maint: load(KEYS.maint),
 settings: getSettings(),
      photos,
}
};
}
const _memCache={};
const _memCacheVersion={};
let _isRestoring=false;
const shouldSkipRender=()=>_isRestoring;
const load=k=>{
 if(_memCache[k]!==undefined)return _memCache[k];
 try{_memCache[k]=JSON.parse(localStorage.getItem(k)||'[]');}
 catch(e){console.warn('AutoLoc: données corrompues pour',k);_memCache[k]=[];}
 return _memCache[k];
};
let _saveRenderTimer=null;
function _scheduleDirtyRender(){
 if(_saveRenderTimer)return;
 _saveRenderTimer=setTimeout(function(){
  _saveRenderTimer=null;
  const pg=sessionStorage.getItem('autoloc_current_page')||'dashboard';
  const link=document.querySelector('nav a[data-page="'+pg+'"]');
  if(link&&_dirty[pg]){
   _dirty[pg]=false;
   if(pg==='dashboard'){renderDashboard();if(typeof renderMaintAlerts==='function')renderMaintAlerts();}
   else if(pg==='vehicules'&&typeof renderVehicules==='function')renderVehicules();
   else if(pg==='clients'&&typeof renderClients==='function')renderClients();
   else if(pg==='reservations'&&typeof window.renderReservations==='function')window.renderReservations();
   else if(pg==='calendrier'&&typeof renderCalendar==='function')renderCalendar();
   else if(pg==='maintenance'&&typeof renderMaintenance==='function')renderMaintenance();
   else if(pg==='parametres'&&typeof renderParametres==='function'){
    renderParametres();
    setTimeout(function(){if(typeof renderStorageGauge==='function')renderStorageGauge();},50);
   }
   else if(pg==='guide'&&typeof renderGuide==='function')renderGuide();
  }
 },30);
}
// Storage contract:
// - OPFS is the canonical durable store.
// - localStorage is a compatibility mirror for quick reads/fallback.
const save=(k,d)=>{
 _memCache[k]=d;
 _memCacheVersion[k]=(_memCacheVersion[k]||0)+1;
 let lsOk=false;
 try{
 localStorage.setItem(k,JSON.stringify(d));
 lsOk=true;
 _touchPersistTimestamp();
}catch(e){
 if(e.name==='QuotaExceededError'||e.code===22){
 console.warn('AutoLoc: localStorage plein,OPFS utilisé en priorité pour',k);
}
}
 OPFS.write(k,d).then(function(ok){
  if(ok){
   _touchPersistTimestamp();
  }else if(lsOk){
   console.warn('AutoLoc: écriture OPFS non confirmée pour',k,'— données dans localStorage');
  }
 }).catch(e=>console.warn('AutoLoc OPFS save:',e.message));
 try{
  window.dispatchEvent(new CustomEvent('autoloc:saved',{detail:{key:k,data:d}}));
 }catch(e){}
};
(function(){
 if(typeof invooHistoryModals==='object'&&typeof invooHistoryModals.attach==='function'){
  invooHistoryModals.attach({load,KEYS});
 }
})();
const invalidateCache=k=>{
 if(k)delete _memCache[k];
 else Object.keys(_memCache).forEach(key=>delete _memCache[key]);
};
async function _repairOpfsFromLocalStorage(){
 if(!OPFS._ready)return false;
 const data={};
 let any=false;
 for(const key of Object.values(KEYS)){
  const raw=localStorage.getItem(key);
  if(raw==null||raw==='')continue;
  try{
   data[key]=JSON.parse(raw);
   any=true;
  }catch(_e){}
 }
 if(!any)return false;
 data._updatedAt=Date.now();
 data._repairedFromLSAt=Date.now();
 const ok=await OPFS.writeAll(data);
 if(ok)OPFS.invalidateRuntimeCache();
 if(ok)console.info('AutoLoc OPFS: fichier principal recréé depuis localStorage (récupération)');
 return ok;
}
async function _syncCacheFromOPFS(forceFresh){
 const versionSnapshot=Object.assign({},_memCacheVersion);
 let all=await OPFS.readAll(!!forceFresh);
 if(!all){
  if(OPFS._ready&&_opfsSyncRecursion<1){
   _opfsSyncRecursion++;
   const repaired=await _repairOpfsFromLocalStorage();
   _opfsSyncRecursion--;
   if(repaired)all=await OPFS.readAll(true);
  }
  if(!all)return false;
 }
 if(OPFS._ready&&!_isRestoring){
  const lsTs=parseInt(localStorage.getItem(LAST_PERSIST_TS_KEY)||'0',10);
  const opfsTs=Number(all._updatedAt||0);
  if(lsTs>opfsTs+750){
   const merged={...all};
   for(const key of Object.values(KEYS)){
    const raw=localStorage.getItem(key);
    if(raw==null)continue;
    try{merged[key]=JSON.parse(raw);}catch(_e){}
   }
   merged._updatedAt=Date.now();
   const wr=await OPFS.writeAll(merged);
   if(wr){
   OPFS.invalidateRuntimeCache();
   all=await OPFS.readAll(true);
   if(!all)return false;
   }
  }
 }
 for(const key of Object.values(KEYS)){
 if(all[key]!==undefined&&(_memCacheVersion[key]||0)===(versionSnapshot[key]||0)){
 _memCache[key]=all[key];
 try{localStorage.setItem(key,JSON.stringify(all[key]));}catch(e){}
}
}
 return true;
};
const uid=()=>{
 if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
 return Date.now().toString(36)+Math.random().toString(36).slice(2,9);
};
function initNativeDatePickers(){
 document.querySelectorAll('input[type="date"]').forEach(inp=>{
  if(inp.dataset.dateUi==='1')return;
  inp.dataset.dateUi='1';
  if(inp.closest('.input-date-wrap')){
   const wrap=inp.closest('.input-date-wrap');
   const sync=()=>wrap.classList.toggle('has-date',!!inp.value);
   inp.addEventListener('input',sync);
   inp.addEventListener('change',sync);
   sync();
   return;
  }
  const wrap=document.createElement('div');
  wrap.className='input-date-wrap';
  inp.parentNode.insertBefore(wrap,inp);
  wrap.appendChild(inp);
  const hint=document.createElement('span');
  hint.className='input-date-hint';
  hint.setAttribute('aria-hidden','true');
  hint.textContent='Choisir une date';
  wrap.appendChild(hint);
  const sync=()=>wrap.classList.toggle('has-date',!!inp.value);
  inp.addEventListener('input',sync);
  inp.addEventListener('change',sync);
  sync();
 });
}
let editingVehId=null,editingClientId=null,editingResId=null;
const SEED_KEY='autoloc_seeded';
function seedData(){
 if(localStorage.getItem(SEED_KEY))return;
 localStorage.setItem(SEED_KEY,'1');
 save(KEYS.veh,[]);
 save(KEYS.cl,[]);
 save(KEYS.res,[]);
}
function addLog(msg){
 const logs=load(KEYS.log);
 logs.unshift({msg,ts: new Date().toLocaleString('fr-FR')});
 save(KEYS.log,logs.slice(0,500));
}
const pageTitles={dashboard:'Tableau de bord',vehicules:'Véhicules',clients:'Clients',reservations:'Réservations',calendrier:'Calendrier de disponibilité',maintenance:'Suivi maintenance',parametres:'Paramètres',guide:'Guide des fonctionnalités'};
function toggleSidebar(){
 const sidebar=document.getElementById('sidebar');
 const overlay=document.getElementById('sidebar-overlay');
 sidebar.classList.toggle('open');
 overlay.classList.toggle('open');
}
function closeSidebarMobile(){
 if(window.innerWidth<=768){
 document.getElementById('sidebar').classList.remove('open');
 document.getElementById('sidebar-overlay').classList.remove('open');
}
}
var _dirty={
 dashboard:true,vehicules:true,clients:true,
 reservations:true,calendrier:true,maintenance:true,
 parametres:true,guide:true
};
function _markAllDirty(){
 Object.keys(_dirty).forEach(function(k){_dirty[k]=true;});
}
(function(){
 if(window._dirtyPatchDone)return;
 window._dirtyPatchDone=true;
 window.addEventListener('autoloc:saved',function(ev){
 var k=ev&&ev.detail ? ev.detail.key : null;
 if(!k)return;
 var map={
 'autoloc_veh':['dashboard','vehicules','reservations','calendrier','maintenance'],
 /* P-2 : clients/réservations listés ici ; dashboard séparé (noms + KPI Clients + impayés). */
 'autoloc_cl':['clients','reservations'],
 'autoloc_res':['dashboard','reservations','calendrier'],
 'autoloc_maint':['dashboard','maintenance'],
 'autoloc_log':[],
 'autoloc_settings':['parametres']
};
 var pages=map[k]||['dashboard','vehicules','clients','reservations','calendrier','maintenance'];
 pages.forEach(function(p){_dirty[p]=true;});
 if(k===KEYS.cl){_dirty.dashboard=true;}
 _scheduleDirtyRender();
 });
})();
function navigate(el){
 document.querySelectorAll('nav a').forEach(a=>a.classList.remove('active'));
 el.classList.add('active');
 const pg=el.dataset.page;
 const targetPage=document.getElementById('page-'+pg);
 if(!targetPage){console.warn('Page introuvable:',pg);return;}
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 targetPage.classList.add('active');
 document.getElementById('page-title').textContent=pageTitles[pg]||pg;
 try{sessionStorage.setItem('autoloc_current_page',pg);}catch(e){}
 if(!_dirty[pg]){closeSidebarMobile();return;}
 _dirty[pg]=false;
 if(pg==='dashboard'){renderDashboard();renderMaintAlerts();}
 else if(pg==='vehicules')renderVehicules();
 else if(pg==='clients')renderClients();
 else if(pg==='reservations')window.renderReservations();
 else if(pg==='calendrier')renderCalendar();
 else if(pg==='maintenance')renderMaintenance();
 else if(pg==='parametres'){
  if(typeof renderParametres==='function')renderParametres();
  setTimeout(function(){if(typeof renderStorageGauge==='function')renderStorageGauge();},50);
 }
 else if(pg==='guide')renderGuide();
 closeSidebarMobile();
}
function clearVehForm(){
 const vm=document.getElementById('veh-modal');if(vm)delete vm.dataset.editingVehId;
['veh-immat','veh-marque','veh-modele','veh-annee','veh-tarif','veh-couleur','veh-km'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['veh-cat','veh-carburant','veh-statut'].forEach(i=>{const el=document.getElementById(i);if(el)el.selectedIndex=0;});
['veh-assurance','veh-vignette','veh-visite','veh-assistance'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['veh-assurance','veh-vignette','veh-visite','veh-assistance'].forEach(i=>{const el=document.getElementById(i);if(el)el.dispatchEvent(new Event('input'));});
 const t=document.getElementById('veh-modal-title');if(t)t.textContent='Ajouter un véhicule';
}
function clearClientForm(){
 const cm=document.getElementById('client-modal');if(cm)delete cm.dataset.editingClientId;
['cl-prenom','cl-nom','cl-tel','cl-email','cl-cin','cl-permis','cl-ville','cl-nat','cl-adresse'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
 const t=document.getElementById('client-modal-title');if(t)t.textContent='Ajouter un client';
}
function clearResForm(){
 const rm=document.getElementById('res-modal');if(rm)delete rm.dataset.editingResId;
['res-debut','res-fin','res-lieu','res-notes'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['res-debut','res-fin'].forEach(i=>{const el=document.getElementById(i);if(el)el.dispatchEvent(new Event('input'));});
 const t=document.getElementById('res-total-preview');if(t)t.style.display='none';
 const h=document.getElementById('res-modal-title');if(h)h.textContent='Nouvelle réservation';
}
function clearForms(){clearVehForm();clearClientForm();clearResForm();}
function openModal(id){
 if(id==='res-modal'&&typeof populateResSelects==='function')populateResSelects();
 const el=document.getElementById(id);
 if(!el)return;
 el.classList.add('open');
 el.setAttribute('aria-hidden','false');
 el._invooPrevFocus=document.activeElement;
 const first=
 el.querySelector('.modal-body input,.modal-body select,.modal-body textarea')
 ||el.querySelector('.modal-footer .btn-primary')
 ||el.querySelector('button');
 if(first)setTimeout(function(){first.focus();},50);
}
function closeModal(id){
 const el=document.getElementById(id);
 if(!el)return;
 el.classList.remove('open');
 el.setAttribute('aria-hidden','true');
 const p=el._invooPrevFocus;
 if(p&&typeof p.focus==='function'){try{p.focus();}catch(e){}}
 el._invooPrevFocus=null;
 if(id==='veh-modal'){editingVehId=null;clearVehForm();}
 else if(id==='client-modal'){editingClientId=null;clearClientForm();}
 else if(id==='res-modal'){editingResId=null;clearResForm();}
 else if(id==='maint-modal'&&typeof window.resetMaintenanceEditState==='function'){window.resetMaintenanceEditState();}
}
(function(){
 function overlayTabTrap(root,e){
 const sel='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
 const focusable=Array.from(root.querySelectorAll(sel)).filter(function(n){
 return n.offsetWidth>0||n.offsetHeight>0||n===document.activeElement;
 });
 if(focusable.length<2)return;
 const first=focusable[0],last=focusable[focusable.length-1];
 if(e.shiftKey){
 if(document.activeElement===first){last.focus();e.preventDefault();}
 }else{
 if(document.activeElement===last){first.focus();e.preventDefault();}
 }
 }
 document.addEventListener('keydown',function(e){
 if(e.key!=='Tab'&&e.key!=='Escape')return;
 const ac=document.getElementById('al-confirm-overlay');
 const aa=document.getElementById('al-alert-overlay');
 if(ac&&ac.style.display==='flex'){
 if(e.key==='Escape'){e.preventDefault();const cb=document.getElementById('al-confirm-cancel');if(cb)cb.click();return;}
 if(e.key==='Tab')overlayTabTrap(ac,e);
 return;
 }
 if(aa&&aa.style.display==='flex'){
 if(e.key==='Escape'){e.preventDefault();const ob=document.getElementById('al-alert-ok');if(ob)ob.click();return;}
 if(e.key==='Tab')overlayTabTrap(aa,e);
 return;
 }
 const mo=document.querySelector('.modal-overlay.open');
 if(!mo)return;
 if(e.key==='Escape'){e.preventDefault();if(mo.id)closeModal(mo.id);return;}
 if(e.key==='Tab')overlayTabTrap(mo,e);
 });
})();
function openNewVehModal(){
 editingVehId=null;
 clearVehForm();
 openModal('veh-modal');
}
function openNewClientModal(){
 editingClientId=null;
 clearClientForm();
 openModal('client-modal');
}
function openNewResModal(){
 editingResId=null;
 clearResForm();
 openModal('res-modal');
}
let vehFilter='all';
function filterVeh(el,f){
 document.querySelectorAll('#veh-filters .filter-btn').forEach(b=>b.classList.remove('active'));
 el.classList.add('active');vehFilter=f;renderVehicules();
}
function renderVehicules(){
 let data=load(KEYS.veh).filter(v=>!v._deleted);
 if(vehFilter!=='all')data=data.filter(v=>v.statut===vehFilter);
 const tbody=document.getElementById('veh-tbody');
 if(!tbody)return;
 if(!data.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="14" width="36" height="22" rx="4" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><circle cx="15" cy="36" r="4" fill="#E8E8EC" stroke="#C8C9D3" stroke-width="1.5"/><circle cx="33" cy="36" r="4" fill="#E8E8EC" stroke="#C8C9D3" stroke-width="1.5"/><path d="M10 21h28" stroke="#C8C9D3" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="12" r="8" fill="#0C0E14"/><path d="M35 12h6M38 9v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucun véhicule</h4><p>Ajoutez votre premier véhicule</p></div></td></tr>`;return;}
 tbody.innerHTML=data.map(v=>{
 const today=new Date();today.setHours(0,0,0,0);
 const docWarn=[v.assurance,v.vignette,v.visite,v.assistance].some(d=>{
 if(!d)return false;
 const dt=new Date(d);dt.setHours(0,0,0,0);
 return!isNaN(dt)&&(dt-today)/ 86400000<=30;
});
 const docBadge=docWarn ? '<span title="Échéance à renouveler (assurance, vignette, visite, assistance)" style="background:rgba(251,191,36,0.16);color:#fde68a;padding:1px 6px;border-radius:8px;font-size:0.65rem;font-weight:700;margin-left:3px;border:1px solid rgba(251,191,36,0.35)">📄</span>' : '';
 const _vehPhotoCount=PHOTOS_ENABLED?countPhotos('veh',v.id):0;
 const photosBtn=PHOTOS_ENABLED ? `<button type="button" class="btn-icon" title="Photos" aria-label="Photos du véhicule ${window.AutoLocUtils.escapeHtml(v.marque)} ${window.AutoLocUtils.escapeHtml(v.modele)}, ${window.AutoLocUtils.escapeHtml(v.immat)}" data-type="veh" data-id="${window.AutoLocUtils.escapeHtml(v.id)}" data-title="${window.AutoLocUtils.escapeHtml(v.marque)} ${window.AutoLocUtils.escapeHtml(v.modele)} (${window.AutoLocUtils.escapeHtml(v.immat)})" onclick="openPhotosModalFromBtn(this)"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
 ${_vehPhotoCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#2dd4bf;color:#0f1923;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${_vehPhotoCount}</span>`:''}
</button>` : '';
 const catDisp=window.AutoLocUtils.escapeHtml(String(v.cat||v.categorie||'—'));
 const anneeDisp=v.annee!==undefined&&v.annee!==''&&!Number.isNaN(Number(v.annee))?String(v.annee):'—';
 const tarifNum=Number(v.tarif);
 const tarifDisp=Number.isFinite(tarifNum)?tarifNum.toLocaleString('fr-FR'):String(v.tarif||'—');
  return `<tr><td data-label="Immat."><strong>${window.AutoLocUtils.escapeHtml(v.immat)}</strong></td><td data-label="Véhicule">${window.AutoLocUtils.escapeHtml(v.marque)} ${window.AutoLocUtils.escapeHtml(v.modele)}</td><td data-label="Catégorie">${catDisp}</td><td data-label="Année">${window.AutoLocUtils.escapeHtml(anneeDisp)}</td><td data-label="Tarif/j"><strong>${window.AutoLocUtils.escapeHtml(tarifDisp)} MAD</strong></td><td data-label="Statut"><span class="badge ${v.statut==='disponible'?'badge-success':v.statut==='loué'?'badge-info':'badge-warning'}">${window.AutoLocUtils.escapeHtml(v.statut)}</span>${docBadge}</td><td><div class="row-actions">${photosBtn}<button type="button" class="btn-icon" title="Historique" aria-label="Historique du véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="showHistVeh('${window.AutoLocUtils.escapeHtml(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button><button type="button" class="btn-icon" title="Maintenance" aria-label="Planifier une maintenance pour ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="openMaintModal();document.getElementById('maint-veh').value='${window.AutoLocUtils.escapeHtml(v.id)}'"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></button><button type="button" class="btn-icon" title="Modifier" aria-label="Modifier le véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="editVeh('${window.AutoLocUtils.escapeHtml(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button type="button" class="btn-icon" title="Supprimer" aria-label="Supprimer le véhicule ${window.AutoLocUtils.escapeHtml(v.immat)}" onclick="deleteVeh('${window.AutoLocUtils.escapeHtml(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td></tr>`;
}).join('');
}
function saveVehicule(){
 const vehModal=document.getElementById('veh-modal');
 const fromDom=vehModal&&vehModal.dataset.editingVehId?String(vehModal.dataset.editingVehId):'';
 const effectiveEditId=fromDom||editingVehId||null;
 if(effectiveEditId)editingVehId=effectiveEditId;
 const now=new Date().toISOString();
 const catVal=document.getElementById('veh-cat').value;
 const v={
 id: effectiveEditId||uid(),
 immat: document.getElementById('veh-immat').value.trim().toUpperCase(),
 marque: document.getElementById('veh-marque').value.trim(),
 modele: document.getElementById('veh-modele').value.trim(),
 annee:+document.getElementById('veh-annee').value,
 cat: catVal,
 categorie: catVal,
 tarif:+document.getElementById('veh-tarif').value,
 couleur: document.getElementById('veh-couleur').value.trim(),
 carburant: document.getElementById('veh-carburant').value,
 km:+document.getElementById('veh-km').value,
 statut: document.getElementById('veh-statut').value,
 assurance: document.getElementById('veh-assurance')?.value||'',
 vignette: document.getElementById('veh-vignette')?.value||'',
 visite: document.getElementById('veh-visite')?.value||'',
 assistance: document.getElementById('veh-assistance')?.value||'',
 updatedAt: now,
 createdAt: effectiveEditId ?(load(KEYS.veh).find(x=>String(x.id)===String(effectiveEditId))?.createdAt||now): now,
};
 if(!v.immat||!v.marque||!v.modele){alAlert('Veuillez remplir les champs obligatoires.');return;}
 if(!Number.isFinite(v.annee)||v.annee<1950||v.annee>2100){alAlert('Année invalide (1950 - 2100).');return;}
 if(!Number.isFinite(v.tarif)||v.tarif<0){alAlert('Le tarif journalier doit être un nombre positif.');return;}
 if(!Number.isFinite(v.km)||v.km<0){alAlert('Le kilométrage doit être un nombre positif.');return;}
 const immatClean=v.immat.replace(/\s/g,'');
 const formatMaroc=/^\d{1,5}-[A-Z]{1,2}-\d{1,2}$/;
 const formatAncien=/^[A-Z]{1,3}-\d{1,5}$/;
 const formatDiplo=/^CD-\d{1,4}-\d{1,4}$/;
 const formatEtranger=/^[A-Z0-9\-]{3,12}$/;
 if(!formatMaroc.test(immatClean)&&!formatAncien.test(immatClean)&&!formatDiplo.test(immatClean)&&!formatEtranger.test(immatClean)){
 alAlert('Format d\'immatriculation invalide.\n\nFormats acceptés :\n• Marocain : 12345-A-1 ou 12345-AB-1\n• Ancien : CT-12345\n• Diplomatique : CD-123-1\n• Étranger : lettres et chiffres');
 return;
}
 let data=load(KEYS.veh);
 if(effectiveEditId){
 const prev=data.find(x=>String(x.id)===String(effectiveEditId));
 if(prev&&Array.isArray(prev.photos)) v.photos=prev.photos;
}
 if(!Array.isArray(v.photos)) v.photos=[];
 const doublon=data.find(x=>!x._deleted&&String(x.immat||'').replace(/\s/g,'').toUpperCase()===immatClean&&String(x.id)!==String(v.id));
 if(doublon){
 const msg=effectiveEditId
 ?'Immatriculation « '+v.immat+' » existe déjà sur une autre fiche ('+doublon.marque+' '+doublon.modele+'). Ouvrez la liste Véhicules : supprimez ou corrigez le doublon.'
 :'Immatriculation « '+v.immat+' » déjà utilisée par '+doublon.marque+' '+doublon.modele+'.';
 alAlert(msg);return;
}
 if(effectiveEditId){data=data.map(x=>String(x.id)===String(effectiveEditId)?v:x);addLog('Véhicule modifié — '+v.marque+' '+v.modele);}
 else{data.push(v);addLog('Véhicule ajouté — '+v.marque+' '+v.modele+' ('+v.immat+')');}
 save(KEYS.veh,data);
 closeModal('veh-modal');
 renderVehicules();
 renderDashboard();
 if(typeof renderMaintAlerts==='function')renderMaintAlerts();
 if(typeof renderCalendar==='function')renderCalendar();
 if(typeof window.renderReservations==='function')window.renderReservations();
}
function editVeh(id){
 const sid=String(id);
 const v=load(KEYS.veh).find(x=>String(x.id)===sid&&!x._deleted);
 if(!v)return;
 editingVehId=sid;
 const vm=document.getElementById('veh-modal');if(vm)vm.dataset.editingVehId=sid;
 document.getElementById('veh-modal-title').textContent='Modifier le véhicule';
['immat','marque','modele','annee','tarif','couleur','km'].forEach(k=>document.getElementById('veh-'+k).value=v[k]||'');
 document.getElementById('veh-cat').value=v.cat||v.categorie||'';
['carburant','statut'].forEach(k=>document.getElementById('veh-'+k).value=v[k]||'');
['assurance','vignette','visite','assistance'].forEach(k=>{const el=document.getElementById('veh-'+k);if(el){el.value=window.AutoLocCoreUtils.normalizeDateInputValue(v[k])||'';el.dispatchEvent(new Event('input'));}});
 openModal('veh-modal');
}
function deleteVeh(id){
 const sid=String(id);
 const v=load(KEYS.veh).find(x=>String(x.id)===sid);
 if(!v)return;
 const actives=load(KEYS.res).filter(r=>!r._deleted&&String(r.vehId)===sid&&r.statut==='en cours');
 if(actives.length){
 alAlert('Impossible de supprimer "'+v.marque+' '+v.modele+'" : '+actives.length+' location(s) en cours. Clôturez ou supprimez les réservations actives d\'abord.');
 return;
}
 const historiques=load(KEYS.res).filter(r=>!r._deleted&&String(r.vehId)===sid);
 const msg=historiques.length
 ? 'Ce véhicule a '+historiques.length+' réservation(s) dans l\'historique. Confirmer la suppression ?'
 : 'Supprimer ce véhicule ?';
 alConfirm({
 icon: '🚗',danger: true,title: 'Supprimer ce véhicule ?',msg,
 okLabel: 'Supprimer',
 onOk:()=>{
 save(KEYS.veh,load(KEYS.veh).map(x=>String(x.id)===sid ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 addLog('Véhicule supprimé — '+v.marque+' '+v.modele);
 renderVehicules();
 renderDashboard();
 if(typeof renderMaintAlerts==='function')renderMaintAlerts();
 if(typeof renderCalendar==='function')renderCalendar();
 if(typeof window.renderReservations==='function')window.renderReservations();
}
});
}
function renderClients(){
 const q=(document.getElementById('client-search')?.value||'').toLowerCase();
 let data=load(KEYS.cl).filter(c=>!c._deleted);
 if(q)data=data.filter(c=>`${c.prenom||''}${c.nom||''}${c.tel||''}${c.cin||''}${c.email||''}${c.permis||''}${c.ville||''}${c.nat||''}${c.adresse||''}`.toLowerCase().includes(q));
 const resData=load(KEYS.res).filter(r=>!r._deleted);
 const tbody=document.getElementById('client-tbody');
 if(!tbody)return;
 if(!data.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 48 48" fill="none"><circle cx="20" cy="18" r="8" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><path d="M6 40c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#D0D0D8" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="12" r="8" fill="#0C0E14"/><path d="M35 12h6M38 9v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucun client</h4><p>Ajoutez votre premier client</p></div></td></tr>`;return;}
 tbody.innerHTML=data.map(c=>{
 const _idEqCl=window.AutoLocCoreUtils&&typeof window.AutoLocCoreUtils.idEq==='function'?window.AutoLocCoreUtils.idEq:(a,b)=>String(a)===String(b);
 const locs=resData.filter(r=>_idEqCl(r.clientId,c.id)).length;
 const _clPhotoCount=PHOTOS_ENABLED?countPhotos('cl',c.id):0;
 const photosBtn=PHOTOS_ENABLED ? `<button type="button" class="btn-icon" title="Photos" aria-label="Photos de ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}" data-type="cl" data-id="${window.AutoLocUtils.escapeHtml(c.id)}" data-title="${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}" onclick="openPhotosModalFromBtn(this)" style="position:relative"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
 ${_clPhotoCount>0?`<span style="position:absolute;top:-4px;right:-4px;background:#2dd4bf;color:#0f1923;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${_clPhotoCount}</span>`:''}
</button>` : '';
  return `<tr><td data-label="Nom"><strong>${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}</strong></td><td data-label="Téléphone">${window.AutoLocUtils.escapeHtml(c.tel||'—')}</td><td data-label="CIN">${window.AutoLocUtils.escapeHtml(c.cin||'—')}</td><td data-label="Email">${window.AutoLocUtils.escapeHtml(c.email||'—')}</td><td data-label="Permis">${window.AutoLocUtils.escapeHtml(c.permis||'—')}</td><td data-label="Locations"><span class="badge badge-info">${locs} location${locs>1?'s':''}</span></td><td><div class="row-actions">${photosBtn}<button type="button" class="btn-icon" title="Historique" aria-label="Historique de ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}" onclick="showHistClient('${window.AutoLocUtils.escapeHtml(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button><button type="button" class="btn-icon" title="Modifier" aria-label="Modifier le client ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}" onclick="editClient('${window.AutoLocUtils.escapeHtml(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button type="button" class="btn-icon" title="Supprimer" aria-label="Supprimer le client ${window.AutoLocUtils.escapeHtml(c.prenom)} ${window.AutoLocUtils.escapeHtml(c.nom)}" onclick="deleteClient('${window.AutoLocUtils.escapeHtml(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div></td></tr>`;
}).join('');
}
function saveClient(){
 const clModal=document.getElementById('client-modal');
 const fromDom=clModal&&clModal.dataset.editingClientId?String(clModal.dataset.editingClientId):'';
 const effectiveEditId=fromDom||editingClientId||null;
 if(effectiveEditId)editingClientId=effectiveEditId;
 const now=new Date().toISOString();
 const c={
 id: effectiveEditId||uid(),
 prenom: document.getElementById('cl-prenom').value.trim(),
 nom: document.getElementById('cl-nom').value.trim(),
 tel: document.getElementById('cl-tel').value.trim(),
 email: document.getElementById('cl-email').value.trim(),
 cin: document.getElementById('cl-cin').value.trim(),
 permis: document.getElementById('cl-permis').value.trim(),
 ville: document.getElementById('cl-ville').value.trim(),
 nat: document.getElementById('cl-nat').value.trim(),
 adresse: document.getElementById('cl-adresse').value.trim(),
 updatedAt: now,
 createdAt: effectiveEditId ?(load(KEYS.cl).find(x=>String(x.id)===String(effectiveEditId))?.createdAt||now): now,
};
 if(!c.prenom||!c.nom||!c.tel){alAlert('Veuillez remplir les champs obligatoires (prénom, nom, téléphone).');return;}
 const telClean=c.tel.replace(/[\s\-().+]/g,'');
 if(!/^\d{8,15}$/.test(telClean)){alAlert('Numéro de téléphone invalide. Exemples valides : +212 6 12 34 56 78, 0612345678');return;}
 if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)){alAlert('Adresse email invalide.');return;}
 if(c.cin&&c.cin.length<4){alAlert('CIN / Passeport trop court.');return;}
 let data=load(KEYS.cl);
 if(effectiveEditId){
 const prev=data.find(x=>String(x.id)===String(effectiveEditId));
 if(prev&&Array.isArray(prev.photos)) c.photos=prev.photos;
}
 if(!Array.isArray(c.photos)) c.photos=[];
 if(effectiveEditId){data=data.map(x=>String(x.id)===String(effectiveEditId)?c:x);addLog(`Client modifié — ${c.prenom} ${c.nom}`);}
 else{data.push(c);addLog(`Client ajouté — ${c.prenom} ${c.nom}`);}
 save(KEYS.cl,data);
 closeModal('client-modal');
 renderClients();
 if(typeof renderDashboard==='function')renderDashboard();
 if(typeof renderCalendar==='function')renderCalendar();
 if(typeof window.renderReservations==='function')window.renderReservations();
}
function editClient(id){
 const sid=String(id);
 const c=load(KEYS.cl).find(x=>String(x.id)===sid&&!x._deleted);
 if(!c)return;
 editingClientId=sid;
 const cm=document.getElementById('client-modal');if(cm)cm.dataset.editingClientId=sid;
 document.getElementById('client-modal-title').textContent='Modifier le client';
['prenom','nom','tel','email','cin','permis','ville','nat','adresse'].forEach(k=>document.getElementById('cl-'+k).value=c[k]||'');
 openModal('client-modal');
}
function deleteClient(id){
 const sid=String(id);
 const c=load(KEYS.cl).find(x=>String(x.id)===sid);
 if(!c)return;
 const actives=load(KEYS.res).filter(r=>!r._deleted&&String(r.clientId)===sid&&r.statut==='en cours');
 if(actives.length){
 alAlert('Impossible de supprimer '+c.prenom+' '+c.nom+' : '+actives.length+' location(s) en cours. Clôturez ou supprimez les réservations actives d\'abord.');
 return;
}
 const historiques=load(KEYS.res).filter(r=>!r._deleted&&String(r.clientId)===sid);
 const msg=historiques.length
 ? c.prenom+' '+c.nom+' a '+historiques.length+' réservation(s) dans l\'historique. Confirmer la suppression ?'
 : 'Supprimer ce client ?';
 alConfirm({
 icon: '👤',danger: true,title: 'Supprimer ce client ?',msg,
 okLabel: 'Supprimer',
 onOk:()=>{
 save(KEYS.cl,load(KEYS.cl).map(x=>String(x.id)===sid ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 addLog('Client supprimé — '+c.prenom+' '+c.nom);
 renderClients();
 if(typeof renderDashboard==='function')renderDashboard();
 if(typeof renderCalendar==='function')renderCalendar();
 if(typeof window.renderReservations==='function')window.renderReservations();
}
});
}
function today(){
 return new Date().toISOString().slice(0,10);
}
function getSettings(){
 if(_memCache[KEYS.settings]!==undefined)return _memCache[KEYS.settings];
 try{return JSON.parse(localStorage.getItem(KEYS.settings)||'{}')}catch(e){return{};}
}
function guideScrollTo(id){
 const el=document.getElementById(id);
 if(el)el.scrollIntoView({behavior: 'smooth',block: 'start'});
}
function renderGuide(){
 const el=document.getElementById('guide-content');
 if(!el)return;
 el.innerHTML=typeof window.invooGuideHTML==='function'?window.invooGuideHTML():'';
}

(function(){
 const MASTER_KEY_STORAGE='autoloc_masterKey_v1';
 const MASTER_KEY_HASH_STORAGE='autoloc_masterKey_hash_v1';
 const MASTER_KEY_PBKDF2_STORAGE='autoloc_masterKey_pbkdf2_v1';
 const MASTER_KEY_PBKDF2_ITER=210000;
 const MASTER_KEY_DK_BITS=256;
 const MKU=window.AutoLocMasterKeyUtils||null;
 function bytesToB64(bytes){
  let bin='';
  bytes.forEach(b=>{bin+=String.fromCharCode(b);});
  return btoa(bin);
 }
 function b64ToBytes(b64){
  const bin=atob(b64);
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
 }
 async function pbkdf2Master(input,saltBytes,iterations){
  if(MKU&&typeof MKU.pbkdf2Master==='function'){
   return MKU.pbkdf2Master(input,saltBytes,iterations,MASTER_KEY_DK_BITS);
  }
  const key=await crypto.subtle.importKey(
   'raw',
   new TextEncoder().encode(input),
   {name:'PBKDF2'},
   false,
   ['deriveBits']
  );
  const bits=await crypto.subtle.deriveBits(
   {name:'PBKDF2',salt:saltBytes,iterations,hash:'SHA-256'},
   key,
   MASTER_KEY_DK_BITS
  );
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function buildMasterKeyRecord(masterKey){
  if(MKU&&typeof MKU.buildMasterKeyRecord==='function'){
   return MKU.buildMasterKeyRecord(masterKey,{iter:MASTER_KEY_PBKDF2_ITER,dkBits:MASTER_KEY_DK_BITS});
  }
  const salt=new Uint8Array(16);
  crypto.getRandomValues(salt);
  const dk=await pbkdf2Master(masterKey,salt,MASTER_KEY_PBKDF2_ITER);
 const dkv=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(dk));
 const dkvHex=Array.from(new Uint8Array(dkv)).map(b=>b.toString(16).padStart(2,'0')).join('');
 return{
  v:2,
   kdf:'PBKDF2-SHA256',
   iter:MASTER_KEY_PBKDF2_ITER,
   salt:bytesToB64(salt),
  dk,
  dkv:dkvHex
  };
 }
 function getMasterKeyRecord(){
  try{
   const raw=localStorage.getItem(MASTER_KEY_PBKDF2_STORAGE);
   if(!raw)return null;
   const rec=JSON.parse(raw);
  if(!rec||!rec.salt||!rec.iter||(!rec.dk&&!rec.dkv))return null;
   return rec;
  }catch(e){return null;}
 }
 async function verifyMasterKeyRecord(input,rec){
  if(MKU&&typeof MKU.verifyMasterKeyRecord==='function'){
   return MKU.verifyMasterKeyRecord(input,rec,{dkBits:MASTER_KEY_DK_BITS});
  }
  if(!rec)return false;
  try{
   const salt=b64ToBytes(rec.salt);
   const got=await pbkdf2Master(input,salt,rec.iter||MASTER_KEY_PBKDF2_ITER);
   if(rec.dkv){
    const dkv=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(got));
    const dkvHex=Array.from(new Uint8Array(dkv)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return dkvHex===rec.dkv;
   }
   return got===rec.dk;
  }catch(e){return false;}
 }
 async function ensureMasterKeyCredential(){
  const rec=getMasterKeyRecord();
  if(rec)return rec;
  let plain=null;
  try{plain=localStorage.getItem(MASTER_KEY_STORAGE);}catch(e){}
  // SECURITY: pas de fallback "clé maître en dur". L'app exige
  // une configuration de la clé maître par l'utilisateur.
  if(!plain)return null;
  const next=await buildMasterKeyRecord(plain);
  try{localStorage.setItem(MASTER_KEY_PBKDF2_STORAGE,JSON.stringify(next));}catch(e){}
  try{localStorage.removeItem(MASTER_KEY_STORAGE);}catch(e){}
  try{localStorage.removeItem(MASTER_KEY_HASH_STORAGE);}catch(e){}
  return next;
 }
 function getSetupMasterKey(){
  // Prépare silencieusement la crédential PBKDF2 (plus de stockage en clair).
  ensureMasterKeyCredential().catch(()=>{});
  return null;
 }
 const LOGIN_PWD_KEY='autoloc_loginPwd';
 const LOGIN_PWD_PBKDF2_ITER=210000;
const DEMO_DURATION=60 * 60;
 const DEMO_KEY='autoloc_demoToken';
 let demoTimer=null;
 async function legacySha256Hex(str){
  const msgBuffer=new TextEncoder().encode(str);
  const hashBuffer=await crypto.subtle.digest('SHA-256',msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function buildLoginPasswordRecord(pass){
  const salt=new Uint8Array(16);
  crypto.getRandomValues(salt);
  const dk=await pbkdf2Master(pass,salt,LOGIN_PWD_PBKDF2_ITER);
  return{
   v:1,
   kdf:'PBKDF2-SHA256',
   iter:LOGIN_PWD_PBKDF2_ITER,
   salt:bytesToB64(salt),
   dk
  };
 }
 async function verifyLoginPassword(pass,stored){
  if(!stored||typeof stored!=='string')return false;
  const trimmed=stored.trim();

  // Nouveau format: JSON PBKDF2 record.
  if(trimmed.startsWith('{')){
   try{
    const rec=JSON.parse(trimmed);
    if(rec&&rec.salt&&rec.dk){
     const salt=b64ToBytes(rec.salt);
     const got=await pbkdf2Master(pass,salt,rec.iter||LOGIN_PWD_PBKDF2_ITER);
     if(got.length!==rec.dk.length)return false;
     let _diff=0;for(let _i=0;_i<got.length;_i++)_diff|=got.charCodeAt(_i)^rec.dk.charCodeAt(_i);
     return _diff===0;
    }
   }catch(e){}
  }

  // Ancien format: SHA-256 hex (migration automatique au prochain login).
  try{
   const sha=await legacySha256Hex(pass);
   return sha===stored;
  }catch(e){
   return false;
  }
 }
 async function createDemoToken(){
 const ts=Date.now();
 // SECURITY (demo offline): pas de secret hardcodé.
 localStorage.setItem(DEMO_KEY,btoa(JSON.stringify({ts})));
 return ts;
}
 async function readDemoToken(){
 try{
 const raw=localStorage.getItem(DEMO_KEY);
 if(!raw)return null;
 const parsed=JSON.parse(atob(raw));
 const ts=parsed && parsed.ts;
 return (typeof ts==='number')? ts : null;
}catch{return null;}
}
 async function getDemoSecondsLeft(){
 const startTs=await readDemoToken();
 if(!startTs)return 0;
 return Math.max(0,DEMO_DURATION-Math.floor((Date.now()-startTs)/ 1000));
}
 function getStoredHash(){return localStorage.getItem(LOGIN_PWD_KEY)||null;}
 const OPFS_ACTIVATION_KEY='invoo_activation_v3';
 const LICENSE_WA_SENT_KEY='invoo_license_wa_sent';
 function syncLicenseKeyStepVisibility(){
 var step=document.getElementById('license-key-step');
 if(!step)return;
 var show=false;
 try{show=sessionStorage.getItem(LICENSE_WA_SENT_KEY)==='1';}catch(_e){}
 step.style.display=show?'block':'none';
 step.setAttribute('aria-hidden',show?'false':'true');
 step.classList.toggle('license-key-step--locked',!show);
 var hint=document.getElementById('license-key-gate-hint');
 if(hint)hint.style.display=show?'none':'';
 }
 function resetResetPanel1Ui(){
 const lf=document.getElementById('reset-license-flow');
 if(lf)lf.style.display='';
 var enter=document.getElementById('license-enter-wrap');
 var ek=document.getElementById('reset-email-license-key');
 var em=document.getElementById('reset-license-email');
 var wa=document.getElementById('reset-license-wa');
 var waErr=document.getElementById('license-wa-error');
 var lee=document.getElementById('license-enter-error');
 if(lee)lee.classList.remove('show');
 if(ek)ek.value='';
 if(em)em.value='';
 if(wa)wa.value='';
 if(waErr){waErr.style.display='none';}
 if(enter)enter.style.display='';
 syncLicenseKeyStepVisibility();
 }
 function focusLicenseKeyField(){
 try{
 var k=document.getElementById('reset-email-license-key');
 if(k)setTimeout(function(){k.focus();},80);
 }catch(e){}
 }
 function normalizeLicenseHexInput(s){
 if(!s)return '';
 var t=String(s).replace(/\s+/g,'').replace(/[^0-9a-fA-F]/g,'');
 return t.toLowerCase();
 }
 async function verifyOfflineLicense(){
 var emailInp=document.getElementById('reset-license-email');
 var inp=document.getElementById('reset-email-license-key');
 var errEl=document.getElementById('license-enter-error');
 var errMsg=document.getElementById('license-enter-error-msg');
 var email=(emailInp&&emailInp.value||'').trim().toLowerCase();
 var val=normalizeLicenseHexInput(inp?inp.value:'');
 if(!email){
 if(errMsg)errMsg.textContent='Saisissez l’e-mail associé à la licence.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 if(errMsg)errMsg.textContent='E-mail invalide.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 if(!val||val.length!==64){
 if(errMsg)errMsg.textContent='La clé doit comporter 64 caractères hexadécimaux.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 if(!globalThis.crypto||!globalThis.crypto.subtle){
 if(errMsg)errMsg.textContent='Contexte sécurisé requis (HTTPS ou localhost) pour vérifier la licence.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 if(typeof globalThis.invooComputeExpectedLicenseHex!=='function'||typeof globalThis.invooGetDeviceId!=='function'||typeof globalThis.invooLicenseKeysMatch!=='function'){
 if(errMsg)errMsg.textContent='Module licence indisponible. Rechargez la page.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 var locked=bfCheck('emailLic');
 if(locked){
 if(errMsg)errMsg.textContent=locked;
 if(errEl)errEl.classList.add('show');
 return;
 }
 try{
 var deviceId=await globalThis.invooGetDeviceId();
 var expected=await globalThis.invooComputeExpectedLicenseHex(email,deviceId);
 if(!globalThis.invooLicenseKeysMatch(val,expected)){
 bfFail('emailLic');
 var locked2=bfCheck('emailLic');
 if(errMsg)errMsg.textContent=locked2||'Clé incorrecte pour cet e-mail et cet appareil.';
 if(errEl)errEl.classList.add('show');
 if(inp){inp.value='';inp.focus();}
 return;
 }
 try{
 localStorage.setItem(OPFS_ACTIVATION_KEY,JSON.stringify({
 isActivated:true,
 email:email,
 deviceId:deviceId,
 licenseKey:val,
 activatedAt:Date.now()
 }));
 }catch(_e){}
 }catch(_e){
 bfFail('emailLic');
 if(errMsg)errMsg.textContent='Vérification impossible. Réessayez.';
 if(errEl)errEl.classList.add('show');
 return;
 }
 bfReset('emailLic');
 if(errEl)errEl.classList.remove('show');
 showPanel('reset-2');
 document.getElementById('reset-new-pwd').focus();
 }
 function showPanel(name){
['admin-panel','reset-panel-1','reset-panel-2'].forEach(id=>{
 const el=document.getElementById(id);
 if(el)el.style.display='none';
});
 const submitBtn=document.getElementById('btn-login-submit');
 const submitBr=submitBtn?.previousElementSibling;
 if(name==='reset-1'||name==='reset-2'){
 if(submitBtn)submitBtn.style.display='none';
 if(submitBr&&submitBr.tagName==='BR')submitBr.style.display='none';
}else{
 if(submitBtn)submitBtn.style.display='';
 if(submitBr&&submitBr.tagName==='BR')submitBr.style.display='';
}
 const map={admin: 'admin-panel','reset-1': 'reset-panel-1','reset-2': 'reset-panel-2'};
 const target=document.getElementById(map[name]);
 if(target)target.style.display='';
['login-error','reset-error-1','reset-error-2'].forEach(id=>{
 const el=document.getElementById(id);
 if(el)el.classList.remove('show');
});
 if(name==='reset-1')resetResetPanel1Ui();
}
 function showLogin(){
 if(checkSession()&&getStoredHash()){
 hideLogin();
 return;
}
 document.getElementById('login-screen').classList.remove('hidden');
 document.getElementById('sidebar').style.display='none';
 document.getElementById('main').style.display='none';
 if(!getStoredHash()){
 showPanel('reset-1');
  getSetupMasterKey();
 const back=document.getElementById('btn-cancel-reset-1');
 if(back)back.style.display='none';
}else{
 const back=document.getElementById('btn-cancel-reset-1');
 if(back)back.style.display='';
 showPanel('admin');
}
}
 /** Raccourcis PWA / lien direct : index.html#vehicules, #reservations, etc. */
 function consumeInvooHashRoute(){
 try{
 const raw=(location.hash||'').replace(/^#/,'').trim().toLowerCase();
 if(!raw)return null;
 const allowed=new Set(['dashboard','vehicules','clients','reservations','calendrier','maintenance','parametres','guide']);
 if(!allowed.has(raw))return null;
 if(history.replaceState){
 history.replaceState(null,'',location.pathname+location.search);
 }
 return raw;
 }catch(e){return null;}
 }
 function hideLogin(){
 document.getElementById('login-screen').classList.add('hidden');
 document.getElementById('sidebar').style.display='';
 document.getElementById('main').style.display='';
 window.dispatchEvent(new CustomEvent('invoo-login-hidden'));
 try{
 const fromHash=consumeInvooHashRoute();
 const lastPage=fromHash||sessionStorage.getItem('autoloc_current_page')||'dashboard';
 const navLink=document.querySelector(`nav a[data-page="${lastPage}"]`);
 if(navLink)navigate(navLink);
}catch(e){}
}
 function switchTab(mode){
 const adminBtn=document.getElementById('tab-admin');
 const demoBtn=document.getElementById('tab-demo');
 const demoPanel=document.getElementById('demo-panel');
 const loginBtn=document.getElementById('btn-login-submit');
 const loginScr=document.getElementById('login-screen');
 if(loginScr)loginScr.classList.toggle('login-screen--demo',mode==='demo');
 if(mode==='admin'){
 adminBtn.className='login-option login-option--admin access-btn active';
 demoBtn.className='login-option login-option--trial access-btn';
 demoPanel.classList.remove('show');
 loginBtn.className='btn-login';
 loginBtn.innerHTML='<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Accéder à l\'interface';
 showPanel('admin');
}else{
 demoBtn.className='login-option login-option--trial access-btn demo-active';
 adminBtn.className='login-option login-option--admin access-btn';
 demoPanel.classList.add('show');
 showPanel('admin');
 loginBtn.className='btn-login demo-mode';
 loginBtn.innerHTML='<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Démarrer la démo (1 h)';
 loginBtn.style.display='';
}
 document.getElementById('login-error').classList.remove('show');
}
 async function startDemo(){
 hideLogin();
 await createDemoToken();
 document.getElementById('demo-countdown-bar').classList.add('show');
 const left0=await getDemoSecondsLeft();
 updateDemoDisplay(left0);
 demoTimer=setInterval(async()=>{
 const left=await getDemoSecondsLeft();
 updateDemoDisplay(left);
 if(left<=0)endDemo(true);
},1000);
}
 function updateDemoDisplay(secondsLeft){
 const mins=Math.floor(secondsLeft / 60);
 const secs=secondsLeft % 60;
 document.getElementById('demo-time-left').textContent=mins+':'+(secs<10 ? '0' : '')+secs;
 const pct=(secondsLeft / DEMO_DURATION)* 100;
 document.getElementById('demo-progress').style.width=pct+'%';
 // En démo, on enlève le fond coloré (anciennement #F59E0B) pour rester transparent.
 document.getElementById('demo-countdown-bar').style.background='transparent';
}
 function endDemo(expired){
 clearInterval(demoTimer);
 localStorage.removeItem(DEMO_KEY);
 document.getElementById('demo-countdown-bar').classList.remove('show');
 if(expired)document.getElementById('demo-expired-overlay').classList.add('show');
 else backToLogin();
}
 function backToLogin(){
 clearInterval(demoTimer);
 clearSession();
 localStorage.removeItem(DEMO_KEY);
 document.getElementById('demo-countdown-bar').classList.remove('show');
 document.getElementById('demo-expired-overlay').classList.remove('show');
 showLogin();
 switchTab('admin');
}
 const SESSION_KEY='autoloc_session_token';
 const SESSION_DAYS=30;
 function generateToken(){
 const arr=new Uint8Array(24);
 crypto.getRandomValues(arr);
 return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}
 function saveSession(remember){
 if(!remember){
 sessionStorage.setItem(SESSION_KEY,'session_active');
 localStorage.removeItem(SESSION_KEY);
}else{
 const expiry=Date.now()+SESSION_DAYS * 86400000;
 const token=generateToken();
 localStorage.setItem(SESSION_KEY,JSON.stringify({token,expiry}));
 sessionStorage.setItem(SESSION_KEY,'session_active');
}
}
 function checkSession(){
 if(sessionStorage.getItem(SESSION_KEY))return true;
 try{
 const raw=localStorage.getItem(SESSION_KEY);
 if(!raw)return false;
 const{token,expiry}=JSON.parse(raw);
 if(token&&expiry&&Date.now()<expiry){
 sessionStorage.setItem(SESSION_KEY,'session_active');
 return true;
}
 localStorage.removeItem(SESSION_KEY);
}catch(e){}
 return false;
}
 function clearSession(){
 localStorage.removeItem(SESSION_KEY);
 sessionStorage.removeItem(SESSION_KEY);
 try{sessionStorage.removeItem('autoloc_current_page');}catch(e){}
}
 window.doLogout=function(){
 clearSession();
 clearInterval(demoTimer);
 localStorage.removeItem(DEMO_KEY);
 document.getElementById('demo-countdown-bar').classList.remove('show');
 showLogin();
 switchTab('admin');
 const inp=document.getElementById('login-password');
 if(inp){inp.value='';inp.focus();}
};
 async function tryLogin(){
 const isDemo=document.getElementById('tab-demo').classList.contains('demo-active');
 if(isDemo){startDemo();return;}
 const locked=bfCheck('login');
 if(locked){
 const errEl=document.getElementById('login-error');
   errEl.innerHTML=`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
   errEl.appendChild(document.createTextNode(locked));
 errEl.classList.add('show');
 return;
}
 const pass=document.getElementById('login-password').value;
 const storedHash=getStoredHash();
 if(!storedHash){
 const errEl=document.getElementById('login-error');
 errEl.innerHTML=`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Aucun mot de passe défini — utilisez "Mot de passe oublié ?".`;
 errEl.classList.add('show');
 return;
}
  const isValid=await verifyLoginPassword(pass,storedHash);
  if(isValid){
 bfReset('login');
 const remember=document.getElementById('remember-me')?.checked||false;

   // Migration (si SHA-256 legacy). Si storedHash n'est pas un record PBKDF2 JSON,
   // on re-classe le hash en PBKDF2 dès le prochain succès.
   if(typeof storedHash==='string' && !storedHash.trim().startsWith('{')){
    try{
     const rec=await buildLoginPasswordRecord(pass);
     localStorage.setItem(LOGIN_PWD_KEY,JSON.stringify(rec));
    }catch(e){}
   }
 saveSession(remember);
 hideLogin();
}else{
 bfFail('login');
 const locked2=bfCheck('login');
 const errEl=document.getElementById('login-error');
 errEl.innerHTML=`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
 errEl.appendChild(document.createTextNode(locked2||'Mot de passe incorrect. Veuillez réessayer.'));
 errEl.classList.add('show');
 document.getElementById('login-password').focus();
 document.getElementById('login-password').select();
}
}
 async function verifyMasterKey(){
 const mkInput=document.getElementById('reset-master-key');
 const errEl=document.getElementById('reset-error-1');
 if(!mkInput||!errEl)return;
 const val=mkInput.value.trim();
 if(!val){errEl.classList.add('show');return;}
 const locked=bfCheck('master');
 if(locked){
 errEl.querySelector ?(errEl.textContent=locked): null;
 errEl.classList.add('show');
 return;
}
 let rec=await ensureMasterKeyCredential();
 let expectedOk=false;

 // C-01: ne jamais auto-créer une clé maître dans le flux de vérification/reset.
 if(!rec){
  bfFail('master');
  errEl.textContent='Clé maître non configurée sur cet appareil.';
  errEl.classList.add('show');
  mkInput.value='';
  mkInput.focus();
  return;
 }
 expectedOk=await verifyMasterKeyRecord(val,rec);
 if(!expectedOk){
  bfFail('master');
  const locked2=bfCheck('master');
  errEl.classList.add('show');
  mkInput.value='';
  mkInput.focus();
  return;
 }
 bfReset('master');
 errEl.classList.remove('show');
 showPanel('reset-2');
 document.getElementById('reset-new-pwd').focus();
}
 async function saveNewPassword(){
 const pwd1=document.getElementById('reset-new-pwd').value;
 const pwd2=document.getElementById('reset-confirm-pwd').value;
 const errEl=document.getElementById('reset-error-2');
 const errMsg=document.getElementById('reset-error-2-msg');
 if(pwd1.length<8){
 errMsg.textContent='Minimum 8 caractères requis.';
 errEl.classList.add('show');return;
}
 if(pwd1!==pwd2){
 errMsg.textContent='Les mots de passe ne correspondent pas.';
 errEl.classList.add('show');return;
}
 const rec=await buildLoginPasswordRecord(pwd1);
 localStorage.setItem(LOGIN_PWD_KEY,JSON.stringify(rec));
 errEl.classList.remove('show');
 showPanel('admin');
 document.getElementById('btn-login-submit').style.display='';
 const back=document.getElementById('btn-cancel-reset-1');
 if(back)back.style.display='';
 const errLogin=document.getElementById('login-error');
 errLogin.style.background='#F0FDF4';
 errLogin.style.borderColor='#BBF7D0';
 errLogin.style.color='#059669';
 errLogin.innerHTML='<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Mot de passe enregistré — connectez-vous.';
 errLogin.classList.add('show');
 document.getElementById('login-password').value='';
 document.getElementById('login-password').focus();
 const rmk=document.getElementById('reset-master-key');
 if(rmk)rmk.value='';
 document.getElementById('reset-new-pwd').value='';
 document.getElementById('reset-confirm-pwd').value='';
}
 const INVOORENT_WA_SUPPORT='212630230803';
 function normalizeWaPhoneForMessage(raw){
 var t=String(raw||'').trim().replace(/\s+/g,'');
 if(!t)return'';
 if(t.charAt(0)==='+')return t;
 if(t.indexOf('00')===0)return'+'+t.slice(2);
 if(/^0[67]/.test(t))return'+212'+t.slice(1);
 if(/^212/.test(t))return'+'+t;
 if(/^[67]/.test(t))return'+212'+t;
 return t;
 }
 async function sendLicenseRequestWhatsApp(){
 var emailInp=document.getElementById('reset-license-email');
 var waInp=document.getElementById('reset-license-wa');
 var waErr=document.getElementById('license-wa-error');
 var waMsg=document.getElementById('license-wa-error-msg');
 var email=(emailInp&&emailInp.value||'').trim().toLowerCase();
 var phoneDisp=normalizeWaPhoneForMessage(waInp?waInp.value:'');
 if(waErr)waErr.style.display='none';
 if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 if(waMsg)waMsg.textContent='Saisissez un e-mail valide.';
 if(waErr)waErr.style.display='block';
 return;
 }
 if(!phoneDisp||phoneDisp.replace(/\D/g,'').length<8){
 if(waMsg)waMsg.textContent='Saisissez un numéro WhatsApp (06…, 07… ou +212…).';
 if(waErr)waErr.style.display='block';
 return;
 }
 if(typeof globalThis.invooGetDeviceId!=='function'){
 if(waMsg)waMsg.textContent='Module licence indisponible. Rechargez la page.';
 if(waErr)waErr.style.display='block';
 return;
 }
 try{
 var deviceId=await globalThis.invooGetDeviceId();
 var body='Licence INVOORENT Email: '+email+' Phone: '+phoneDisp+' Device ID: '+deviceId;
 var url='https://wa.me/'+INVOORENT_WA_SUPPORT+'?text='+encodeURIComponent(body);
 var w=window.open(url,'_blank');
 if(w){
 try{sessionStorage.setItem(LICENSE_WA_SENT_KEY,'1');}catch(_ls){}
 syncLicenseKeyStepVisibility();
 focusLicenseKeyField();
 try{w.opener=null;}catch(_o){}
 }else{
 if(waMsg)waMsg.textContent='Autorisez les pop-up pour ce site afin d’ouvrir WhatsApp. Ensuite, réessayez « Envoyer vers WhatsApp » — le champ clé apparaîtra après ouverture.';
 if(waErr)waErr.style.display='block';
 }
 }catch(e){
 if(waMsg)waMsg.textContent='Impossible de préparer le message. Réessayez.';
 if(waErr)waErr.style.display='block';
 }
 }
window.__autolocPreloadOPFS=async function(){
 await OPFS.init();
 try{
  if(navigator.storage&&typeof navigator.storage.persist==='function'){
   const granted=await navigator.storage.persist();
   if(granted)console.info('INVOORENT: stockage persistant accordé (moins de risque d’effacement par le navigateur)');
  }
 }catch(_e){}
 await OPFS.migrateFromLocalStorage();
 await _syncCacheFromOPFS();
 seedData();
};
window.__autolocCheckAuth=function(){
 if(checkSession()&&getStoredHash()){
 hideLogin();
 return;
 }
 showLogin();
};
window.addEventListener('DOMContentLoaded',function(){
 try{
  const guideHeroTitle=document.querySelector('#page-guide h1');
  if(guideHeroTitle)guideHeroTitle.textContent='INVOORENT';
  const footerYear=document.getElementById('login-footer-year');
  if(footerYear)footerYear.textContent=String(new Date().getFullYear());
 }catch(e){}
 if(!document.getElementById('tab-admin')||!document.getElementById('main')){
  console.warn('INVOORENT: interface non chargée (partials absents ou erreur avant injection). Si vous utilisez file://, servez le dossier via HTTP (voir message à l’écran).');
  return;
 }
 document.getElementById('tab-admin').addEventListener('click',function(){switchTab('admin');});
 document.getElementById('tab-demo').addEventListener('click',function(){startDemo();});
 document.getElementById('btn-login-submit').addEventListener('click',tryLogin);
 document.getElementById('login-password').addEventListener('keydown',function(e){if(e.key==='Enter')tryLogin();});
 const remCb=document.getElementById('remember-me');
 const remBox=document.getElementById('remember-box');
 const remChk=document.getElementById('remember-check');
 if(remCb){
 remCb.addEventListener('change',function(){
 if(this.checked){
 remBox.style.background='#6B58E8';
 remBox.style.borderColor='#6B58E8';
 remChk.style.display='block';
}else{
 remBox.style.background='#fff';
 remBox.style.borderColor='#CDD0E3';
 remChk.style.display='none';
}
});
}
 document.getElementById('toggle-pass').addEventListener('click',function(){
 const inp=document.getElementById('login-password');
 const isText=inp.type==='text';
 inp.type=isText ? 'password' : 'text';
 this.innerHTML=isText
 ? '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
 : '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
});
 document.getElementById('btn-open-reset').addEventListener('click',function(){
 showPanel('reset-1');
 setTimeout(function(){
 document.getElementById('reset-license-email')?.focus();
},80);
});
 syncLicenseKeyStepVisibility();
 document.getElementById('btn-verify-email-license')?.addEventListener('click',function(){verifyOfflineLicense();});
 document.getElementById('btn-send-license-whatsapp')?.addEventListener('click',function(){sendLicenseRequestWhatsApp();});
 document.getElementById('reset-email-license-key')?.addEventListener('keydown',function(e){if(e.key==='Enter')verifyOfflineLicense();});
 document.getElementById('reset-license-email')?.addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('reset-license-wa')?.focus();});
 document.getElementById('reset-license-wa')?.addEventListener('keydown',function(e){if(e.key==='Enter')sendLicenseRequestWhatsApp();});
 document.getElementById('btn-save-new-pwd').addEventListener('click',saveNewPassword);
 document.getElementById('reset-new-pwd').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('reset-confirm-pwd').focus();});
 document.getElementById('reset-confirm-pwd').addEventListener('keydown',function(e){if(e.key==='Enter')saveNewPassword();});
 document.getElementById('btn-cancel-reset-1').addEventListener('click',function(){showPanel('admin');});
 document.getElementById('btn-cancel-reset-2').addEventListener('click',function(){showPanel('admin');});
 document.getElementById('demo-end-btn').addEventListener('click',function(){endDemo(false);});
 document.getElementById('btn-back-login').addEventListener('click',backToLogin);
 document.getElementById('top-date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 (async function bootstrapAfterAuth(){
 try{
 await window.__autolocPreloadOPFS();
 window.__autolocCheckAuth();
 renderDashboard();
 renderAlerts();
 renderMaintAlerts();
 renderOPFSStatus();
 try{
 const opfsOk=OPFS._ready;
 const warn=document.getElementById('storage-topbar-warn');
 if(warn){
 warn.style.display=opfsOk ? 'none' :(getStorageUsagePercent()>80 ? 'block' : 'none');
}
 if(!opfsOk){
 _showBannerWarning(
 'opfs-unsupported-banner',
 '⚠️ Stockage limité',
 'Votre navigateur ne supporte pas OPFS. Vos données sont limitées à 5 MB et peuvent être perdues si vous videz le cache. Utilisez Chrome ou Edge pour un stockage illimité.',
 '#fde68a','rgba(251,191,36,0.12)','rgba(251,191,36,0.36)'
);
}
 const machineWarnKey='autoloc_machine_warned';
 if(opfsOk&&!localStorage.getItem(machineWarnKey)){
 localStorage.setItem(machineWarnKey,'1');
 _showBannerWarning(
 'machine-change-banner',
 '💾 Important — sauvegarde portable',
 'Vos données sont stockées dans ce navigateur uniquement. Si vous changez d\'ordinateur ou de navigateur, exportez une sauvegarde JSON depuis <strong>Paramètres → Sauvegarde&amp;Export</strong>.',
 '#1e3a5f','#EFF6FF','#BFDBFE',
 true 
);
}
}catch(e){}
 initNativeDatePickers();
 const resModalEl=document.getElementById('res-modal');
 if(resModalEl)resModalEl.addEventListener('change',function(e){
  const t=e.target;if(!t)return;
  const id=t.id;
  if((id==='res-debut'||id==='res-fin'||id==='res-veh')&&typeof updateResTotal==='function')updateResTotal();
 });
 const flushOnExit=()=>{
  if(!OPFS.hasPendingWrites())return;
  OPFS.flushNow().catch(()=>{});
 };
 window.addEventListener('beforeunload',flushOnExit);
 window.addEventListener('pagehide',flushOnExit);
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')flushOnExit();
 });
 }catch(err){
 console.error('INVOORENT bootstrap:',err);
 try{if(window.__autolocCheckAuth)window.__autolocCheckAuth();}catch(_e){}
 }
 })();
});
})();
function _showBannerWarning(id,titre,message,textColor,bgColor,borderColor,autoDismiss){
 if(document.getElementById(id))return;
 const main=document.getElementById('main');
 if(!main)return;
 const banner=document.createElement('div');
 banner.id=id;
 banner.style.cssText=`
 display:flex;align-items:center;gap:12px;
 background:${bgColor};border-bottom: 1.5px solid ${borderColor};
 padding: 10px 24px;position:sticky;top:60px;z-index:49;
 animation: fadeSlideUp 0.3s var(--ease-out);
 `;
 const msgEl=document.createElement('div');
 msgEl.style.cssText=`flex:1;font-size:0.82rem;color:${textColor};line-height:1.5`;
 msgEl.innerHTML=`${titre} — ${message}`;
 const closeBtn=document.createElement('button');
 closeBtn.type='button';
 closeBtn.style.cssText=`
 background:none;border:none;cursor:pointer;color:${textColor};opacity:0.6;
 font-size:1.1rem;padding:2px 6px;flex-shrink:0;line-height:1;
 `;
 closeBtn.title='Fermer';
 closeBtn.textContent='×';
 closeBtn.addEventListener('click',()=>banner.remove());
 banner.append(msgEl,closeBtn);
 const firstPage=main.querySelector('.page');
 if(firstPage)main.insertBefore(banner,firstPage);
 else main.prepend(banner);
 if(autoDismiss)setTimeout(()=>{if(banner.parentNode)banner.remove();},10000);
}
async function exportBackup(){
 const backup=await buildBackupObject();
 const blob=new Blob([JSON.stringify(backup,null,2)],{type: 'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=`INVOORENT_backup_${today()}.json`;
 a.click();
 addLog('Sauvegarde exportée');
 showBackupStatus('✓ Sauvegarde exportée','#059669');
}
function importBackup(event){
 const file=event.target.files[0];
 if(!file)return;
 const reader=new FileReader();
 reader.onload=e=>{
 try{
 const backup=JSON.parse(e.target.result);
 const struct=typeof invooValidateBackupStructure==='function'
  ? invooValidateBackupStructure(backup)
  : {ok:false,errors:['Validateur de sauvegarde non chargé']};
 if(!struct.ok){
  console.error('Import backup rejeté: structure invalide',struct.errors);
  throw new Error('Structure invalide: '+struct.errors.join(' | '));
 }
 const dateBackup=new Date(backup.date).toLocaleDateString('fr-FR');
const doRestore=async()=>{
 _isRestoring=true;
 try{
 const d=backup.data;
 const normalized={
  [KEYS.veh]: Array.isArray(d.veh)? d.veh : [],
  [KEYS.cl]: Array.isArray(d.cl)? d.cl : [],
  [KEYS.res]: Array.isArray(d.res)? d.res : [],
  [KEYS.log]: Array.isArray(d.log)? d.log : [],
  [KEYS.maint]: Array.isArray(d.maint)? d.maint : [],
  [KEYS.settings]: (d.settings&&typeof d.settings==='object') ? d.settings : {},
  _restoredAt: Date.now(),
  _updatedAt: Date.now(),
  photos: (d.photos&&typeof d.photos==='object') ? d.photos : {}
 };
 if(OPFS._ready){
  const ok=await OPFS.importAll(normalized);
  if(!ok)throw new Error('Restauration OPFS impossible');
  localStorage.removeItem('autoloc_photos');
 }else{
  for(const key of Object.values(KEYS)){
   localStorage.setItem(key,JSON.stringify(normalized[key]));
  }
  localStorage.setItem('autoloc_photos',JSON.stringify(normalized.photos));
 }
 try{localStorage.setItem(LAST_PERSIST_TS_KEY,String(normalized._updatedAt));}catch(_e){}
 invalidateCache();
 if(OPFS._ready){
  await _syncCacheFromOPFS(true);
 }
 _isRestoring=false;
 renderDashboard();
 renderAlerts();
 renderMaintAlerts();
 localStorage.setItem(SEED_KEY,'1');
 showBackupStatus('✓ Données restaurées — rechargement…','#059669');
 setTimeout(()=>location.reload(),1500);
 }catch(err){
  _isRestoring=false;
  throw err;
 }
};
 alConfirm({
 icon: '📥',danger: true,
 title: 'Restaurer la sauvegarde ?',
 msg: `Sauvegarde du ${dateBackup}.\n⚠ Toutes vos données actuelles seront remplacées définitivement.`,
 okLabel: 'Restaurer',
onOk:()=>{doRestore().catch(err=>showBackupStatus('✗ Restauration échouée : '+err.message,'var(--danger)'));}
});
}catch(err){
 showBackupStatus('✗ Fichier invalide : '+err.message,'var(--danger)');
}
};
 reader.readAsText(file);
 event.target.value='';
}
function showBackupStatus(msg,color){
 const el=document.getElementById('backup-status');
 if(!el)return;
 el.textContent=msg;
 el.style.color=color;
 el.style.display='block';
 setTimeout(()=>el.style.display='none',4000);
}
// Injection contexte modules (scripts defer avant ce fichier : payment / contract / rapport / réservations / export).
(function(){
 if(typeof invooAlertsUi==='object'&&typeof invooAlertsUi.attach==='function'){
  invooAlertsUi.attach({load,KEYS,shouldSkipRender,navigate});
 }
 if(typeof invooDashboardUi==='object'&&typeof invooDashboardUi.attach==='function'){
  invooDashboardUi.attach({
   load,KEYS,getSettings,shouldSkipRender,
   renderAlerts:window.renderAlerts,
   renderDocsAlerts:window.renderDocsAlerts
  });
 }
 if(typeof invooPaymentModals==='object'&&typeof invooPaymentModals.attach==='function'){
  invooPaymentModals.attach({
   load,save,KEYS,
   alAlert,alConfirm,addLog,
   renderReservations:window.renderReservations,
   renderDashboard,renderAlerts,
   initNativeDatePickers
  });
 }
 if(typeof invooContractPrint==='object'&&typeof invooContractPrint.attach==='function'){
  invooContractPrint.attach({
   load,KEYS,getSettings,
   conditionsDefaut:typeof window.INVOO_CONDITIONS_DEFAUT==='string'?window.INVOO_CONDITIONS_DEFAUT:'',
   openModal,alAlert
  });
 }
 if(typeof invooReservationsModal==='object'&&typeof invooReservationsModal.attach==='function'){
  invooReservationsModal.attach({
   load,save,KEYS,uid,
   getEditingId:()=>editingResId,
   setEditingId:(id)=>{editingResId=id;},
   alAlert,alConfirm,addLog,
   closeModal,openModal,
   renderDashboard,renderAlerts,getSettings
  });
 }
 if(typeof invooParametresUi==='object'&&typeof invooParametresUi.attach==='function'){
  invooParametresUi.attach({
   KEYS,save,getSettings,addLog,alAlert,alConfirm,renderDashboard
  });
 }
 if(typeof invooRapportModals==='object'&&typeof invooRapportModals.attach==='function'){
  invooRapportModals.attach({
   load,KEYS,getSettings,addLog
  });
 }
 if(typeof invooReservationsRender==='object'&&typeof invooReservationsRender.attach==='function'){
  invooReservationsRender.attach({
   load,KEYS
  });
 }
 if(typeof invooDataExport==='object'&&typeof invooDataExport.attach==='function'){
  invooDataExport.attach({
   load,KEYS,alAlert,addLog
  });
 }
 if(typeof invooCalendarView==='object'&&typeof invooCalendarView.attach==='function'){
  invooCalendarView.attach({
   load,KEYS
  });
 }
 if(typeof invooMaintenanceUi==='object'&&typeof invooMaintenanceUi.attach==='function'){
  invooMaintenanceUi.attach({
   load,save,KEYS,uid,
   alAlert,alConfirm,addLog,closeModal,
   renderDashboard,renderVehicules,shouldSkipRender
  });
 }
 if(typeof invooPhotosUi==='object'&&typeof invooPhotosUi.attach==='function'){
  invooPhotosUi.attach({
   photosEnabled:PHOTOS_ENABLED,
   alAlert,alConfirm,addLog,
   OPFS
  });
 }
 if(typeof invooGlobalSearch==='object'&&typeof invooGlobalSearch.attach==='function'){
  invooGlobalSearch.attach({
   load,KEYS,navigate
  });
 }
})();
