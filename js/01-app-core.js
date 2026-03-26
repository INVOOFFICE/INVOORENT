const KEYS={veh:'autoloc_veh',cl:'autoloc_cl',res:'autoloc_res',log:'autoloc_log',maint:'autoloc_maint',settings:'autoloc_settings'};
const SYNC_KEYS=[KEYS.veh,KEYS.cl,KEYS.res,KEYS.maint];
if(typeof window!=='undefined')window.AUTOLOC_SYNC_KEYS=SYNC_KEYS.slice();
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
 DATA_FILE: 'autoloc_data.json',
 ENC_KEY_STORAGE: 'autoloc_masterKey_pbkdf2_v1',
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
 async _getEncryptionKey(){
  if(this._encKey)return this._encKey;
  if(this._encKeyPromise)return this._encKeyPromise;
  this._encKeyPromise=(async()=>{
   try{
    const raw=localStorage.getItem(this.ENC_KEY_STORAGE);
    if(!raw)return null;
    const rec=JSON.parse(raw);
    const dkHex=rec&&rec.dk;
    const keyBytes=this._hexToBytes(dkHex);
    if(!keyBytes||keyBytes.length!==32)return null;
    const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
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
 async _flushWriteAll(){
 if(!await this.init())return false;
 if(!this._allCacheLoaded)return false;
 try{
  const fh=await this._root.getFileHandle(this.DATA_FILE,{create: true});
  const writable=await fh.createWritable();
  await writable.write(await this._serializeData(this._allCache||{}));
  await writable.close();
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
 async readAll(){
 if(!await this.init())return null;
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
 return true;
}
};
function esc(str){
 const fn=window.AutoLocUtils&&window.AutoLocUtils.escapeHtml;
 if(typeof fn==='function')return fn(str);
 return String(str ?? '');
}
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
 overlay.style.display='flex';
 const cleanup=()=>{overlay.style.display='none';okBtn.onclick=null;cancelBtn.onclick=null;};
 okBtn.onclick=()=>{cleanup();if(onOk)onOk();};
 cancelBtn.onclick=()=>{cleanup();if(onCancel)onCancel();};
}
function alAlert(msg){
 const overlay=document.getElementById('al-alert-overlay');
 document.getElementById('al-alert-msg').textContent=msg;
 overlay.style.display='flex';
 document.getElementById('al-alert-ok').onclick=()=>{overlay.style.display='none';};
}
const _bf={login:{fails:0,lockedUntil:0},master:{fails:0,lockedUntil:0}};
const BF_MAX=5,BF_LOCKOUT_MS=30000;
function bfCheck(s){
 if(Date.now()<_bf[s].lockedUntil)return `⏳ Trop de tentatives — réessayez dans ${Math.ceil((_bf[s].lockedUntil-Date.now())/1000)}s`;
 return null;
}
function bfFail(s){_bf[s].fails++;if(_bf[s].fails>=BF_MAX){_bf[s].lockedUntil=Date.now()+BF_LOCKOUT_MS;_bf[s].fails=0;}}
function bfReset(s){_bf[s].fails=0;_bf[s].lockedUntil=0;}
const FS={dirHandle: null,autoSave: false,saveTimer: null,FILE_NAME: 'AutoLocPro_donnees.json',scheduleSave(){},async restoreHandle(){},_showReconnectNotif(){},_hideReconnectNotif(){},_updateUI(){}};
function fsChooseFolder(){}
function fsReconnect(){}
function fsSaveNow(){}
function fsDisconnect(){}
function fsToggleAutoSave(){}
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
const load=k=>{
 if(_memCache[k]!==undefined)return _memCache[k];
 try{_memCache[k]=JSON.parse(localStorage.getItem(k)||'[]');}
 catch(e){console.warn('AutoLoc: données corrompues pour',k);_memCache[k]=[];}
 return _memCache[k];
};
const save=(k,d)=>{
 _memCache[k]=d;
 try{
 localStorage.setItem(k,JSON.stringify(d));
}catch(e){
 if(e.name==='QuotaExceededError'||e.code===22){
 console.warn('AutoLoc: localStorage plein,OPFS utilisé en priorité pour',k);
}
}
 OPFS.write(k,d).catch(e=>console.warn('AutoLoc OPFS save:',e.message));
};
const invalidateCache=k=>{
 if(k)delete _memCache[k];
 else Object.keys(_memCache).forEach(key=>delete _memCache[key]);
};
async function _syncCacheFromOPFS(){
 const all=await OPFS.readAll();
 if(!all)return false;
 for(const key of Object.values(KEYS)){
 if(all[key]!==undefined){
 _memCache[key]=all[key];
 try{localStorage.setItem(key,JSON.stringify(all[key]));}catch(e){}
}
}
 return true;
};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function normalizeDateInputValue(raw){
 const fn=window.AutoLocCoreUtils&&window.AutoLocCoreUtils.normalizeDateInputValue;
 if(typeof fn==='function')return fn(raw);
 if(raw==null)return '';
 const s=String(raw).trim();
 if(!s)return '';
 const dt=new Date(s);
 if(!isNaN(+dt))return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
 return '';
}
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
let editingId=null;
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
 var _origSave=typeof save!=='undefined' ? save : null;
 if(!_origSave||window._dirtyPatchDone)return;
 window._dirtyPatchDone=true;
 var _origRef=_origSave;
 window.save=function(k,d){
 _origRef(k,d);
 var map={
 'autoloc_veh':['dashboard','vehicules','reservations','calendrier','maintenance'],
 'autoloc_cl':['dashboard','clients','reservations'],
 'autoloc_res':['dashboard','reservations','calendrier'],
 'autoloc_maint':['dashboard','maintenance'],
 'autoloc_log':[],
 'autoloc_settings':['parametres']
};
 var pages=map[k]||['dashboard','vehicules','clients','reservations','calendrier','maintenance'];
 pages.forEach(function(p){_dirty[p]=true;});
};
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
 if(pg==='dashboard'){renderDashboard();renderAlerts();renderMaintAlerts();}
 else if(pg==='vehicules')renderVehicules();
 else if(pg==='clients')renderClients();
 else if(pg==='reservations')renderReservations();
 else if(pg==='calendrier')renderCalendar();
 else if(pg==='maintenance')renderMaintenance();
 else if(pg==='parametres'){renderParametres();setTimeout(renderStorageGauge,50);}
 else if(pg==='guide')renderGuide();
 closeSidebarMobile();
}
function openModal(id){
 if(id==='res-modal')populateResSelects();
 document.getElementById(id).classList.add('open');
}
function closeModal(id){
 document.getElementById(id).classList.remove('open');
 editingId=null;
 clearForms();
}
function clearForms(){
['veh-immat','veh-marque','veh-modele','veh-annee','veh-tarif','veh-couleur','veh-km'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['veh-cat','veh-carburant','veh-statut'].forEach(i=>{const el=document.getElementById(i);if(el)el.selectedIndex=0;});
['cl-prenom','cl-nom','cl-tel','cl-email','cl-cin','cl-permis','cl-ville','cl-nat','cl-adresse'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['res-debut','res-fin','res-lieu','res-notes'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['veh-assurance','veh-vignette','veh-visite'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
['res-debut','res-fin','veh-assurance','veh-vignette','veh-visite'].forEach(i=>{const el=document.getElementById(i);if(el)el.dispatchEvent(new Event('input'));});
 const t=document.getElementById('res-total-preview');if(t)t.style.display='none';
 document.getElementById('veh-modal-title').textContent='Ajouter un véhicule';
 document.getElementById('client-modal-title').textContent='Ajouter un client';
 document.getElementById('res-modal-title').textContent='Nouvelle réservation';
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
 if(!data.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="14" width="36" height="22" rx="4" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><circle cx="15" cy="36" r="4" fill="#E8E8EC" stroke="#C8C9D3" stroke-width="1.5"/><circle cx="33" cy="36" r="4" fill="#E8E8EC" stroke="#C8C9D3" stroke-width="1.5"/><path d="M10 21h28" stroke="#C8C9D3" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="12" r="8" fill="#0C0E14"/><path d="M35 12h6M38 9v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucun véhicule</h4><p>Ajoutez votre premier véhicule</p></div></td></tr>`;return;}
 tbody.innerHTML=data.map(v=>{
 const today=new Date();today.setHours(0,0,0,0);
 const docWarn=[v.assurance,v.vignette,v.visite].some(d=>{
 if(!d)return false;
 const dt=new Date(d);dt.setHours(0,0,0,0);
 return!isNaN(dt)&&(dt-today)/ 86400000<=30;
});
 const docBadge=docWarn ? '<span title="Document à renouveler(assurance/vignette/visite)" style="background:#FEF9C3;color:#854D0E;padding:1px 6px;border-radius:8px;font-size:0.65rem;font-weight:700;margin-left:3px">📄</span>' : '';
  return `<tr><td><strong>${esc(v.immat)}</strong></td><td>${esc(v.marque)}${esc(v.modele)}</td><td>${esc(v.cat)}</td><td>${esc(String(v.annee))}</td><td><strong>${esc(String(v.tarif))}MAD</strong></td><td><span class="badge ${v.statut==='disponible'?'badge-success':v.statut==='loué'?'badge-info':'badge-warning'}">${esc(v.statut)}</span>${docBadge}</td><td style="display:flex;gap:6px;"><button class="btn-icon" title="Photos" data-type="veh" data-id="${esc(v.id)}" data-title="${esc(v.marque)}${esc(v.modele)}(${esc(v.immat)})" onclick="openPhotosModalFromBtn(this)"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
 ${countPhotos('veh',v.id)>0?`<span style="position:absolute;top:-4px;right:-4px;background:#2dd4bf;color:#0f1923;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${countPhotos('veh',v.id)}</span>`:''}
</button><button class="btn-icon" title="Historique" onclick="showHistVeh('${esc(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button><button class="btn-icon" title="Maintenance" onclick="openMaintModal();document.getElementById('maint-veh').value='${esc(v.id)}'"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></button><button class="btn-icon" title="Modifier" onclick="editVeh('${esc(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" title="Supprimer" onclick="deleteVeh('${esc(v.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td></tr>`;
}).join('');
}
function saveVehicule(){
 const now=new Date().toISOString();
 const v={
 id: editingId||uid(),
 immat: document.getElementById('veh-immat').value.trim().toUpperCase(),
 marque: document.getElementById('veh-marque').value.trim(),
 modele: document.getElementById('veh-modele').value.trim(),
 annee:+document.getElementById('veh-annee').value,
 cat: document.getElementById('veh-cat').value,
 tarif:+document.getElementById('veh-tarif').value,
 couleur: document.getElementById('veh-couleur').value.trim(),
 carburant: document.getElementById('veh-carburant').value,
 km:+document.getElementById('veh-km').value,
 statut: document.getElementById('veh-statut').value,
 assurance: document.getElementById('veh-assurance')?.value||'',
 vignette: document.getElementById('veh-vignette')?.value||'',
 visite: document.getElementById('veh-visite')?.value||'',
 updatedAt: now,
 createdAt: editingId ?(load(KEYS.veh).find(x=>x.id===editingId)?.createdAt||now): now,
};
 if(!v.immat||!v.marque||!v.modele){alAlert('Veuillez remplir les champs obligatoires.');return;}
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
 const doublon=data.find(x=>x.immat.toUpperCase()===v.immat&&x.id!==v.id);
 if(doublon){alAlert('Immatriculation "'+v.immat+'" déjà utilisée par '+doublon.marque+' '+doublon.modele+'.');return;}
 if(editingId){data=data.map(x=>x.id===editingId ? v : x);addLog('Véhicule modifié — '+v.marque+' '+v.modele);}
 else{data.push(v);addLog('Véhicule ajouté — '+v.marque+' '+v.modele+'('+v.immat+')');}
 save(KEYS.veh,data);
 closeModal('veh-modal');
 renderVehicules();
}
function editVeh(id){
 const v=load(KEYS.veh).find(x=>x.id===id);
 if(!v)return;
 editingId=id;
 document.getElementById('veh-modal-title').textContent='Modifier le véhicule';
['immat','marque','modele','annee','tarif','couleur','km'].forEach(k=>document.getElementById('veh-'+k).value=v[k]||'');
['cat','carburant','statut'].forEach(k=>document.getElementById('veh-'+k).value=v[k]);
['assurance','vignette','visite'].forEach(k=>{const el=document.getElementById('veh-'+k);if(el){el.value=normalizeDateInputValue(v[k])||'';el.dispatchEvent(new Event('input'));}});
 openModal('veh-modal');
}
function deleteVeh(id){
 const v=load(KEYS.veh).find(x=>x.id===id);
 if(!v)return;
 const actives=load(KEYS.res).filter(r=>r.vehId===id&&r.statut==='en cours');
 if(actives.length){
 alAlert('Impossible de supprimer "'+v.marque+' '+v.modele+'" : '+actives.length+' location(s)en cours. Clôturez ou supprimez les réservations actives d\'abord.');
 return;
}
 const historiques=load(KEYS.res).filter(r=>r.vehId===id);
 const msg=historiques.length
 ? 'Ce véhicule a '+historiques.length+' réservation(s)dans l\'historique. Confirmer la suppression ?'
 : 'Supprimer ce véhicule ?';
 alConfirm({
 icon: '🚗',danger: true,title: 'Supprimer ce véhicule ?',msg,
 okLabel: 'Supprimer',
 onOk:()=>{
 save(KEYS.veh,load(KEYS.veh).map(x=>x.id===id ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 addLog('Véhicule supprimé — '+v.marque+' '+v.modele);
 renderVehicules();
 renderDashboard();
}
});
}
function renderClients(){
 const q=(document.getElementById('client-search')?.value||'').toLowerCase();
 let data=load(KEYS.cl).filter(c=>!c._deleted);
 if(q)data=data.filter(c=>`${c.prenom}${c.nom}${c.tel}${c.cin}`.toLowerCase().includes(q));
 const resData=load(KEYS.res);
 const tbody=document.getElementById('client-tbody');
 if(!data.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 48 48" fill="none"><circle cx="20" cy="18" r="8" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><path d="M6 40c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#D0D0D8" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="12" r="8" fill="#0C0E14"/><path d="M35 12h6M38 9v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucun client</h4><p>Ajoutez votre premier client</p></div></td></tr>`;return;}
 tbody.innerHTML=data.map(c=>{
 const locs=resData.filter(r=>r.clientId===c.id).length;
  return `<tr><td><strong>${esc(c.prenom)}${esc(c.nom)}</strong></td><td>${esc(c.tel)}</td><td>${esc(c.cin)}</td><td>${esc(c.email||'—')}</td><td>${esc(c.permis||'—')}</td><td><span class="badge badge-info">${locs}location${locs>1?'s':''}</span></td><td style="display:flex;gap:6px;"><button class="btn-icon" title="Photos" data-type="cl" data-id="${esc(c.id)}" data-title="${esc(c.prenom)}${esc(c.nom)}" onclick="openPhotosModalFromBtn(this)" style="position:relative"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
 ${countPhotos('cl',c.id)>0?`<span style="position:absolute;top:-4px;right:-4px;background:#2dd4bf;color:#0f1923;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${countPhotos('cl',c.id)}</span>`:''}
</button><button class="btn-icon" title="Historique" onclick="showHistClient('${esc(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button><button class="btn-icon" onclick="editClient('${esc(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" onclick="deleteClient('${esc(c.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td></tr>`;
}).join('');
}
function saveClient(){
 const now=new Date().toISOString();
 const c={
 id: editingId||uid(),
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
 createdAt: editingId ?(load(KEYS.cl).find(x=>x.id===editingId)?.createdAt||now): now,
};
 if(!c.prenom||!c.nom||!c.tel){alAlert('Veuillez remplir les champs obligatoires(prénom,nom,téléphone).');return;}
 const telClean=c.tel.replace(/[\s\-().+]/g,'');
 if(!/^\d{8,15}$/.test(telClean)){alAlert('Numéro de téléphone invalide. Exemples valides :+212 6 12 34 56 78,0612345678');return;}
 if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)){alAlert('Adresse email invalide.');return;}
 let data=load(KEYS.cl);
 if(editingId){data=data.map(x=>x.id===editingId ? c : x);addLog(`Client modifié — ${c.prenom}${c.nom}`);}
 else{data.push(c);addLog(`Client ajouté — ${c.prenom}${c.nom}`);}
 save(KEYS.cl,data);
 closeModal('client-modal');
 renderClients();
}
function editClient(id){
 const c=load(KEYS.cl).find(x=>x.id===id);
 if(!c)return;
 editingId=id;
 document.getElementById('client-modal-title').textContent='Modifier le client';
['prenom','nom','tel','email','cin','permis','ville','nat','adresse'].forEach(k=>document.getElementById('cl-'+k).value=c[k]||'');
 openModal('client-modal');
}
function deleteClient(id){
 const c=load(KEYS.cl).find(x=>x.id===id);
 if(!c)return;
 const actives=load(KEYS.res).filter(r=>r.clientId===id&&r.statut==='en cours');
 if(actives.length){
 alAlert('Impossible de supprimer '+c.prenom+' '+c.nom+' : '+actives.length+' location(s)en cours. Clôturez ou supprimez les réservations actives d\'abord.');
 return;
}
 const historiques=load(KEYS.res).filter(r=>r.clientId===id);
 const msg=historiques.length
 ? c.prenom+' '+c.nom+' a '+historiques.length+' réservation(s)dans l\'historique. Confirmer la suppression ?'
 : 'Supprimer ce client ?';
 alConfirm({
 icon: '👤',danger: true,title: 'Supprimer ce client ?',msg,
 okLabel: 'Supprimer',
 onOk:()=>{
 save(KEYS.cl,load(KEYS.cl).map(x=>x.id===id ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 addLog('Client supprimé — '+c.prenom+' '+c.nom);
 renderClients();
}
});
}
let resFilter='all';
function filterRes(el,f){
 document.querySelectorAll('#res-filters .filter-btn').forEach(b=>b.classList.remove('active'));
 el.classList.add('active');resFilter=f;renderReservations();
}
function populateResSelects(){
 const cs=load(KEYS.cl).filter(c=>!c._deleted),
       vs=load(KEYS.veh).filter(v=>(!v._deleted)&&(v.statut==='disponible'||editingId));
 const cSel=document.getElementById('res-client');
 const vSel=document.getElementById('res-veh');
 if(!cSel||!vSel)return;
 cSel.innerHTML='';
 vSel.innerHTML='';

 const optC0=document.createElement('option');
 optC0.value='';
 optC0.textContent='--Sélectionner client--';
 cSel.appendChild(optC0);

 cs.forEach(c=>{
  const opt=document.createElement('option');
  opt.value=c.id;
  opt.textContent=(c.prenom||'')+(c.nom||'');
  cSel.appendChild(opt);
 });

 const optV0=document.createElement('option');
 optV0.value='';
 optV0.textContent='--Sélectionner véhicule--';
 vSel.appendChild(optV0);

 vs.forEach(v=>{
  const opt=document.createElement('option');
  opt.value=v.id;
  opt.textContent=`${v.marque||''}${v.modele||''}— ${v.tarif||0}MAD/j(${v.statut||''})`;
  vSel.appendChild(opt);
 });
}
function updateResTotal(){
 const vId=document.getElementById('res-veh').value;
 const d1=document.getElementById('res-debut').value;
 const d2=document.getElementById('res-fin').value;
 const preview=document.getElementById('res-total-preview');
 if(!vId||!d1||!d2){preview.style.display='none';return;}
 const v=load(KEYS.veh).find(x=>x.id===vId);
 const days=Math.max(1,Math.round((new Date(d2)-new Date(d1))/(1000*60*60*24)));
 const total=days *(v?.tarif||0);
 preview.style.display='block';
 preview.innerHTML=`<strong>${days}jour${days>1?'s':''}</strong>× ${v?.tarif||0}MAD=<strong style="color:var(--accent)">${total}MAD</strong>`;
}
function renderReservations(){
 let data=load(KEYS.res).filter(r=>!r._deleted);
 if(resFilter!=='all')data=data.filter(r=>r.statut===resFilter);
 const clients=load(KEYS.cl),vehs=load(KEYS.veh);
 const grid=document.getElementById('res-grid');
 if(!grid)return;
 if(!data.length){
 grid.innerHTML=`<div class="empty-state"><svg viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="32" rx="4" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><path d="M16 6v8M32 6v8M6 22h36" stroke="#D0D0D8" stroke-width="1.5" stroke-linecap="round"/><path d="M14 30h8M14 36h14" stroke="#C8C9D3" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="38" r="8" fill="#2dd4bf"/><path d="M35 38h6M38 35v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucune réservation</h4><p>Créez votre première réservation</p></div>`;
 return;
}
 grid.innerHTML=`<div class="grid-2">${data.map(r=>{
 const c=clients.find(x=>x.id===r.clientId);
 const v=vehs.find(x=>x.id===r.vehId);
 const badgeCls=r.statut==='en cours'?'badge-info':r.statut==='terminée'?'badge-success':'badge-danger';
 const paid=(r.paiements||[]).reduce((s,p)=>s+p.montant,0);
 const total=r.total||0;
 const caution=r.caution||0;
 const payPct=total>0 ? Math.min(100,Math.round(paid/total*100)): 0;
 const payBadge=paid===0
 ? `<span class="pay-badge-none">Non payé</span>`
 : paid>=total
 ? `<span class="pay-badge-full">Soldé ✓</span>`
 : `<span class="pay-badge-partial">${payPct}% payé</span>`;
 return `<div class="rental-card"><div class="rental-card-header"><div><h4>${c ? esc(c.prenom)+' '+esc(c.nom): 'Client inconnu'}</h4><div style="margin-top:4px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;"><span class="badge ${badgeCls}">${esc(r.statut)}</span>
 ${payBadge}
 ${caution>0?`<span style="background:#F0EEE9;color:#5A5A5A;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:700;">Caution: ${caution}MAD</span>`:''}
</div></div><span class="total-badge">${total||'—'}MAD</span></div><div class="rental-info"><strong>Véhicule :</strong>${v ? esc(v.marque)+' '+esc(v.modele)+'('+esc(v.immat)+')' : '—'}<br><strong>Période :</strong>${esc(r.debut)}→ ${esc(r.fin)}<br><strong>Lieu :</strong>${esc(r.lieu||'—')}<br>
 ${r.notes ? `<strong>Notes :</strong>${esc(r.notes)}` : ''}
</div><div class="rental-actions">
 ${r.statut==='en cours'?`<button class="btn btn-sm btn-outline" onclick="closeRental('${esc(r.id)}')">Clôturer</button>`:''}
<button class="btn btn-sm btn-outline" onclick="openPayModal('${esc(r.id)}')" style="color:var(--success);border-color:var(--success);"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
 Paiement
</button><button class="btn btn-sm btn-primary" onclick="printContrat('${esc(r.id)}')"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
 Contrat
</button><button class="btn btn-sm btn-outline" onclick="editRes('${esc(r.id)}')">Modifier</button><button class="btn btn-sm btn-danger" onclick="deleteRes('${esc(r.id)}')">Supprimer</button><button class="btn btn-sm btn-whatsapp" onclick="sendWhatsApp('${esc(r.id)}')" title="Envoyer via WhatsApp" style="background:#25D366;color:#fff;border:none;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
 WhatsApp
</button></div></div>`;
}).join('')}</div>`;
}
function saveReservation(){
 const vId=document.getElementById('res-veh').value;
 const v=load(KEYS.veh).find(x=>x.id===vId);
 const d1=document.getElementById('res-debut').value;
 const d2=document.getElementById('res-fin').value;
 const days=(d1&&d2)? Math.max(1,Math.round((new Date(d2)-new Date(d1))/(1000*60*60*24))): 0;
 const existing=editingId ?(load(KEYS.res).find(x=>x.id===editingId)||{}):{};
 const r={
 id: editingId||uid(),
 clientId: document.getElementById('res-client').value,
 vehId: vId,
 debut: d1,
 fin: d2,
 lieu: document.getElementById('res-lieu').value.trim(),
 statut: document.getElementById('res-statut').value,
 notes: document.getElementById('res-notes').value.trim(),
 total: days *(v?.tarif||0),
 createdAt: existing.createdAt||new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 paiements: existing.paiements||[],
 caution: existing.caution||0,
 cautionStatut: existing.cautionStatut||'non',
};
 if(!r.clientId||!r.vehId||!r.debut||!r.fin){alAlert('Veuillez remplir tous les champs obligatoires.');return;}
 if(new Date(r.fin)<=new Date(r.debut)){alAlert('La date de fin doit être postérieure à la date de début.');return;}
 if(r.total<0||(v&&v.tarif<0)){alAlert('Le tarif journalier ne peut pas être négatif.');return;}
 const reservations=load(KEYS.res);
 const debut=new Date(r.debut);
 const fin=new Date(r.fin);
 const conflit=reservations.find(x=>{
 if(x.id===editingId)return false;
 if(x.vehId!==r.vehId)return false;
 if(x.statut==='annulée'||x.statut==='terminée')return false;
 const xDebut=new Date(x.debut);
 const xFin=new Date(x.fin);
 return debut<xFin&&fin>xDebut;
});
 if(conflit){
 const c=load(KEYS.cl).find(x=>x.id===conflit.clientId);
 const nomClient=c ? `${c.prenom}${c.nom}` : 'un autre client';
 alAlert(`⚠️ Conflit de réservation!\n\nCe véhicule est déjà réservé par ${nomClient}du ${conflit.debut}au ${conflit.fin}.\n\nChoisissez un autre véhicule ou des dates différentes.`);
 return;
}
 const _vNow=new Date().toISOString();
 let vehs=load(KEYS.veh);
 if(!editingId){
 if(r.statut==='en cours'){
 vehs=vehs.map(x=>x.id===vId ?{...x,statut:'loué',updatedAt: _vNow}: x);
 save(KEYS.veh,vehs);
}
}else{
 const oldRes=load(KEYS.res).find(x=>x.id===editingId);
 const oldStatut=oldRes?.statut;
 if(r.statut==='en cours'&&oldStatut!=='en cours'){
 vehs=vehs.map(x=>x.id===vId ?{...x,statut:'loué',updatedAt: _vNow}: x);
}else if((r.statut==='terminée'||r.statut==='annulée')&&oldStatut==='en cours'){
 vehs=vehs.map(x=>x.id===vId ?{...x,statut:'disponible',updatedAt: _vNow}: x);
}
 save(KEYS.veh,vehs);
}
 let data=load(KEYS.res);
 if(editingId){data=data.map(x=>x.id===editingId ? r : x);addLog(`Réservation modifiée`);}
 else{data.push(r);addLog(`Nouvelle réservation — ${load(KEYS.cl).find(c=>c.id===r.clientId)?.prenom||''}/ ${v?.marque||''}${v?.modele||''}`);}
 save(KEYS.res,data);
 closeModal('res-modal');
 renderReservations();
}
function editRes(id){
 const r=load(KEYS.res).find(x=>x.id===id);
 if(!r)return;
 editingId=id;
 document.getElementById('res-modal-title').textContent='Modifier la réservation';
 populateResSelects();
 setTimeout(()=>{
 document.getElementById('res-client').value=r.clientId;
 document.getElementById('res-veh').value=r.vehId;
 document.getElementById('res-debut').value=normalizeDateInputValue(r.debut)||'';
 document.getElementById('res-fin').value=normalizeDateInputValue(r.fin)||'';
 document.getElementById('res-lieu').value=r.lieu||'';
 document.getElementById('res-statut').value=r.statut;
 document.getElementById('res-notes').value=r.notes||'';
 document.getElementById('res-debut').dispatchEvent(new Event('input'));
 document.getElementById('res-fin').dispatchEvent(new Event('input'));
 updateResTotal();
},50);
 openModal('res-modal');
}
function closeRental(id){
 alConfirm({
 icon: '✅',danger: false,
 title: 'Clôturer cette location ?',
 msg: 'Le véhicule sera remis en statut "disponible".',
 okLabel: 'Clôturer',
 onOk:()=>{
 let data=load(KEYS.res);
 const r=data.find(x=>x.id===id);
 data=data.map(x=>x.id===id ?{...x,statut:'terminée',updatedAt: new Date().toISOString()}: x);
 save(KEYS.res,data);
 if(r){
 let vehs=load(KEYS.veh);
 vehs=vehs.map(v=>v.id===r.vehId ?{...v,statut:'disponible',updatedAt: new Date().toISOString()}: v);
 save(KEYS.veh,vehs);
 addLog('Location clôturée');
}
 renderReservations();
 renderAlerts();
}
});
}
function sendWhatsApp(id){
 const res=load(KEYS.res).find(r=>r.id===id);
 if(!res)return;
 const cl=load(KEYS.cl).find(c=>c.id===res.clientId);
 const veh=load(KEYS.veh).find(v=>v.id===res.vehId);
 const rawTel=(cl&&cl.tel)? cl.tel.replace(/[\s\-().]/g,''): '';
 let tel=rawTel;
 if(tel.startsWith('00'))tel='+'+tel.slice(2);
 if(tel.startsWith('0')&&!tel.startsWith('00'))tel='+212'+tel.slice(1);
 if(!tel.startsWith('+'))tel='+212'+tel;
 tel=tel.replace('+','');
 const agence=(function(){try{return JSON.parse(localStorage.getItem('autoloc_params')||'{}').nom||'notre agence';}catch(e){return 'notre agence';}})();
 const prenom=cl ? cl.prenom : 'Client';
 const vehStr=veh ? veh.marque+' '+veh.modele+'('+veh.immat+')' : '—';
 const debut=res.debut||'—';
 const fin=res.fin||'—';
 const lieu=res.lieu||'notre agence';
 const total=res.total ? res.total+' MAD' : '—';
 const paid=(res.paiements||[]).reduce((s,p)=>s+p.montant,0);
 const reste=res.total ? Math.max(0,res.total-paid): 0;
 const msg=
`Bonjour ${prenom}👋,
Voici le récapitulatif de votre location chez *${agence}* :
🚗 *Véhicule :* ${vehStr}
📅 *Période :* ${debut}→ ${fin}
📍 *Lieu de prise en charge :* ${lieu}
💰 *Total :* ${total}${reste>0 ? '\n✅ *Reste à payer :* '+reste+' MAD' : '\n✅ *Solde : Réglé*'}${res.notes ? '\n📝 *Notes :* '+res.notes : ''}
Merci de votre confiance!🙏
_${agence}_`;
 const url='https://wa.me/'+tel+'?text='+encodeURIComponent(msg);
 window.open(url,'_blank');
}
function deleteRes(id){
 alConfirm({
 icon: '🗑',danger: true,
 title: 'Supprimer cette réservation ?',
 msg: 'Cette action est irréversible. Le véhicule sera remis disponible si la location était en cours.',
 okLabel: 'Supprimer',
 onOk:()=>{
 const r=load(KEYS.res).find(x=>x.id===id);
 save(KEYS.res,load(KEYS.res).map(x=>x.id===id ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 if(r&&r.statut==='en cours'){
 let vehs=load(KEYS.veh);
 vehs=vehs.map(v=>v.id===r.vehId ?{...v,statut:'disponible',updatedAt: new Date().toISOString()}: v);
 save(KEYS.veh,vehs);
}
 addLog('Réservation supprimée');
 renderReservations();
 renderDashboard();
}
});
}
function computeAlerts(){
 const res=load(KEYS.res).filter(r=>r.statut==='en cours');
 const vehs=load(KEYS.veh);
 const clients=load(KEYS.cl);
 const today=new Date();
 today.setHours(0,0,0,0);
 const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
 const dayAfter=new Date(today);dayAfter.setDate(dayAfter.getDate()+2);
 const retards=[];
 const today24h=[];
 const soon48h=[];
 res.forEach(r=>{
 if(!r.fin)return;
 const fin=new Date(r.fin);fin.setHours(0,0,0,0);
 const v=vehs.find(x=>x.id===r.vehId);
 const c=clients.find(x=>x.id===r.clientId);
 const info={
 r,v,c,
 vName: v ? `${v.marque}${v.modele}(${v.immat})` : '—',
 cName: c ? `${c.prenom}${c.nom}` : '—',
 finStr: fin.toLocaleDateString('fr-FR'),
 diffDays: Math.round((today-fin)/(1000*60*60*24))
};
 if(fin<today)retards.push(info);
 else if(fin.getTime()===today.getTime())today24h.push(info);
 else if(fin.getTime()===tomorrow.getTime()||fin.getTime()===dayAfter.getTime())soon48h.push(info);
});
 return{retards,today24h,soon48h};
}
function renderAlerts(){
 const{retards,today24h,soon48h}=computeAlerts();
 const docsAlerts=typeof computeDocsAlerts==='function' ? computeDocsAlerts():[];
 const totalDocs=docsAlerts.filter(a=>a.level!=='soon').length;
 const total=retards.length+today24h.length+soon48h.length;
 const dot=document.getElementById('notif-dot');
 if(dot)dot.classList.toggle('visible',total>0||totalDocs>0);
 const banner=document.getElementById('alert-banner');
 if(total>0||totalDocs>0){
 banner.classList.add('visible');
 const title=document.getElementById('alert-banner-title');
 const chips=document.getElementById('alert-chips');
 const totalAll=total+totalDocs;
 title.textContent=`${totalAll}alerte${totalAll>1?'s':''}— action requise`;
 let chipsHtml='';
 if(retards.length)chipsHtml+=`<button class="alert-chip alert-chip-danger" onclick="scrollToAlerts()">🔴 ${retards.length}retard${retards.length>1?'s':''}</button>`;
 if(today24h.length)chipsHtml+=`<button class="alert-chip alert-chip-danger" onclick="scrollToAlerts()">🟠 ${today24h.length}retour${today24h.length>1?'s':''}aujourd'hui</button>`;
 if(soon48h.length)chipsHtml+=`<button class="alert-chip alert-chip-warning" onclick="scrollToAlerts()">🟡 ${soon48h.length}retour${soon48h.length>1?'s':''}dans 48h</button>`;
 if(totalDocs>0)chipsHtml+=`<button class="alert-chip alert-chip-warning" onclick="scrollToDocsAlerts()">📄 ${totalDocs}doc${totalDocs>1?'s':''}à renouveler</button>`;
 chips.innerHTML=chipsHtml;
}else{
 banner.classList.remove('visible');
}
 const wrap=document.getElementById('alerts-card-wrap');
 if(!wrap)return;
 if(total===0){wrap.innerHTML='';return;}
 const all=[
 ...retards.map(i=>({...i,type:'retard',label:`Retard de ${i.diffDays}jour${i.diffDays>1?'s':''}`,badgeCls:'alert-badge-retard',bg:'#FDEDEC',ic:'#C0392B'})),
 ...today24h.map(i=>({...i,type:'today',label:"Retour aujourd'hui",badgeCls:'alert-badge-retard',bg:'#FEF9E7',ic:'#D68910'})),
 ...soon48h.map(i=>({...i,type:'soon',label:`Retour le ${i.finStr}`,badgeCls:'alert-badge-soon',bg:'#FEF9E7',ic:'#D68910'})),
];
 wrap.innerHTML=`
<div class="alert-card" id="alerts-section"><div class="alert-card-header"><svg fill="none" viewBox="0 0 24 24" stroke="#C0392B" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4>Alertes — Retards&Retours imminents</h4><span class="badge badge-danger">${total}</span></div>
 ${all.map(item=>`
<div class="alert-row"><div class="alert-row-icon" style="background:${item.bg}"><svg fill="none" viewBox="0 0 24 24" stroke="${item.ic}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="alert-row-info"><strong>${esc(item.cName)}</strong><span>${esc(item.vName)}— Retour prévu : ${esc(item.finStr)}</span></div><span class="${item.badgeCls}">${esc(item.label)}</span><button class="btn btn-sm btn-outline" onclick="closeRental('${esc(item.r.id)}')">Clôturer</button></div>`).join('')}
</div>`;
}
function scrollToAlerts(){
 const dashLink=document.querySelector('nav a[data-page="dashboard"]');
 if(dashLink&&!dashLink.classList.contains('active'))navigate(dashLink);
 setTimeout(()=>{
 const el=document.getElementById('alerts-section');
 if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
},100);
}
function scrollToDocsAlerts(){
 const dashLink=document.querySelector('nav a[data-page="dashboard"]');
 if(dashLink&&!dashLink.classList.contains('active'))navigate(dashLink);
 setTimeout(()=>{
 const el=document.getElementById('docs-alerts-wrap');
 if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
},100);
}
function computeDocsAlerts(){
 const vehs=load(KEYS.veh);
 const today=new Date();today.setHours(0,0,0,0);
 const alerts=[];
 vehs.forEach(v=>{
 const name=(v.marque||'')+' '+(v.modele||'')+'('+(v.immat||'')+')';
 const checkDoc=(dateStr,label,icon)=>{
 if(!dateStr)return;
 const d=new Date(dateStr);d.setHours(0,0,0,0);
 if(isNaN(d))return;
 const diffDays=Math.round((d-today)/ 86400000);
 if(diffDays<=30){
 alerts.push({
 vehId: v.id,name,label,icon,dateStr,
 diffDays,
 level: diffDays<0 ? 'expired' : diffDays<=7 ? 'urgent' : 'soon'
});
}
};
 checkDoc(v.assurance,'Assurance','🛡️');
 checkDoc(v.vignette,'Vignette','📋');
 checkDoc(v.visite,'Visite technique','🔧');
});
 return alerts.sort((a,b)=>a.diffDays-b.diffDays);
}
function renderDocsAlerts(){
 const wrap=document.getElementById('docs-alerts-wrap');
 if(!wrap)return;
 const alerts=computeDocsAlerts();
 if(!alerts.length){wrap.innerHTML='';return;}
 const dot=document.getElementById('notif-dot');
 if(dot)dot.classList.add('visible');
 const expired=alerts.filter(a=>a.level==='expired');
 const urgent=alerts.filter(a=>a.level==='urgent');
 const soon=alerts.filter(a=>a.level==='soon');
 const fmt=dateStr=>{
 const d=new Date(dateStr);
 return isNaN(d)? dateStr : d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});
};
 const rowHtml=a=>{
 const bg=a.level==='expired' ? '#FEF2F2' : a.level==='urgent' ? '#FFF7ED' : '#FFFBEB';
 const color=a.level==='expired' ? '#991B1B' : a.level==='urgent' ? '#9A3412' : '#92400E';
 const badge=a.level==='expired'
 ? `<span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700">Expiré</span>`
 : a.level==='urgent'
 ? `<span style="background:#FED7AA;color:#9A3412;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700">Dans ${a.diffDays}j</span>`
 : `<span style="background:#FEF9C3;color:#854D0E;padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:700">Dans ${a.diffDays}j</span>`;
 return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(0,0,0,0.05);background:${bg}"><span style="font-size:1rem">${a.icon}</span><div style="flex:1;min-width:0"><strong style="font-size:0.83rem;color:${color};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.name)}</strong><span style="font-size:0.75rem;color:var(--text3)">${esc(a.label)}— expire le ${esc(fmt(a.dateStr))}</span></div>
 ${badge}
<button class="btn btn-sm btn-outline" style="flex-shrink:0;font-size:0.72rem;padding:4px 10px" onclick="editVeh('${esc(a.vehId)}')">Modifier</button></div>`;
};
 wrap.innerHTML=`
<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-xs);margin-top:14px"><div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface2)"><svg fill="none" viewBox="0 0 24 24" stroke="#D97706" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4 style="font-family:var(--font-display);font-size:0.875rem;font-weight:600;color:var(--text)">Documents véhicules à renouveler</h4><span class="badge badge-warning" style="margin-left:auto">${alerts.length}</span></div>
 ${alerts.map(rowHtml).join('')}
</div>`;
}
function renderDashboard(){
 const vehs=load(KEYS.veh).filter(v=>!v._deleted),cls=load(KEYS.cl).filter(c=>!c._deleted),res=load(KEYS.res).filter(r=>!r._deleted);
 const settings=getSettings();
 const agencyName=settings.nom||'INVOORENT';
 const h=new Date().getHours();
 const greeting=h<12 ? 'Bonjour 👋' : h<18 ? 'Bon après-midi 👋' : 'Bonsoir 👋';
 const dateStr=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const el_greeting=document.getElementById('dash-greeting');
 const el_title=document.getElementById('dash-agency-name');
 const el_date=document.getElementById('dash-hero-date');
 if(el_greeting)el_greeting.textContent=greeting;
 if(el_title)el_title.textContent=agencyName;
 if(el_date)el_date.textContent=dateStr.charAt(0).toUpperCase()+dateStr.slice(1);
 const dispo=vehs.filter(v=>v.statut==='disponible').length;
 const loues=vehs.filter(v=>v.statut==='loué').length;
 const enCours=res.filter(r=>r.statut==='en cours').length;
 const ca=res.filter(r=>r.statut==='terminée').reduce((s,r)=>s+(r.total||0),0);
 const stats=[
{label:'Véhicules',val:vehs.length,sub:(()=>{
 const today=new Date();today.setHours(0,0,0,0);
 const docsExp=vehs.filter(v=>[v.assurance,v.vignette,v.visite].some(d=>{if(!d)return false;const dt=new Date(d);dt.setHours(0,0,0,0);return!isNaN(dt)&&(dt-today)/86400000<=30;})).length;
 return dispo+' dispo · '+loues+' en location'+(docsExp>0?' · ⚠️ '+docsExp+' doc'+(docsExp>1?'s':''):'');
})(),color:'rgba(45,212,191,0.15)',iconColor:'#2dd4bf',
 icon:'<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'},
{label:'Clients',val:cls.length,sub:'clients enregistrés',color:'#ECFDF5',iconColor:'#059669',
 icon:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'},
{label:'Locations en cours',val:enCours,sub:`${res.length}au total`,color:'#FFFBEB',iconColor:'#D97706',
 icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'},
{label:'CA réalisé',val:ca.toLocaleString('fr-FR')+' MAD',sub:'locations terminées',color:'#F0FDF4',iconColor:'#16A34A',
 icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>'},
];
 function sparkline(val,color){
 const n=8;
 const pts=[];
 let v=Math.max(1,val);
 for(let i=0;i<n;i++){v=Math.max(0.5,v+(Math.random()-0.45)*Math.max(1,val*0.18));pts.push(v);}
 const mx=Math.max(...pts),mn=Math.min(...pts);
 const range=mx-mn||1;
 const coords=pts.map((p,i)=>`${Math.round(i*(56/(n-1)))},${Math.round(18-((p-mn)/range)*14)}`).join(' ');
 return `<svg class="stat-sparkline" width="56" height="18" viewBox="0 0 56 18" fill="none"><polyline points="${coords}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg>`;
}
 document.getElementById('stats-grid').innerHTML=stats.map((s,i)=>`
<div class="stat-card"><div class="stat-icon" style="background:${s.color}"><svg fill="none" viewBox="0 0 24 24" stroke="${s.iconColor}" stroke-width="2">${s.icon}</svg></div><h3>${s.label}</h3><div class="stat-number-row"><p>${s.val}</p></div><small>${s.sub}</small>
 ${sparkline(typeof s.val==='number'?s.val:parseInt(s.val)||5,s.iconColor)}
</div>`).join('');
 const logs=load(KEYS.log);
 const actEl=document.getElementById('activity-list');
 if(!logs.length){actEl.innerHTML='<p style="color:var(--text3);font-size:0.85rem">Aucune activité récente</p>';}
 else{
 actEl.innerHTML=logs.slice(0,8).map((l,i)=>`
<div class="activity-item"><div class="activity-dot" style="background:${['#2dd4bf','#34d399','#F59E0B','#F87171'][i%4]}"></div><div><p>${esc(l.msg)}</p><small>${esc(l.ts)}</small></div></div>`).join('');
}
 const total=vehs.length||1;
 const fleetEl=document.getElementById('fleet-status');
 const bars=[
{label:'Disponibles',count:dispo,color:'#10B981'},
{label:'Loués',count:loues,color:'#2dd4bf'},
{label:'Maintenance',count:vehs.filter(v=>v.statut==='maintenance').length,color:'#F59E0B'},
];
 fleetEl.innerHTML=bars.map(b=>`
<div class="fleet-bar-wrap" style="margin-bottom:14px"><div class="fleet-bar-label"><span>${b.label}</span><span><strong>${b.count}</strong>/ ${vehs.length}</span></div><div class="fleet-bar-track"><div class="fleet-bar-fill" style="width:${Math.round(b.count/total*100)}%;background:${b.color}"></div></div></div>`).join('');
 renderAlerts();
 renderDocsAlerts();
 const impayesWrap=document.getElementById('impayes-wrap');
 if(impayesWrap){
 const enCoursList=load(KEYS.res).filter(r=>r.statut==='en cours');
 const impayes=enCoursList.map(r=>{
 const paid2=(r.paiements||[]).reduce((s,p)=>s+p.montant,0);
 const reste2=Math.max(0,(r.total||0)-paid2);
 return{...r,paid2,reste2};
}).filter(r=>r.reste2>0);
 if(!impayes.length){impayesWrap.innerHTML='';return;}
 const clsD=load(KEYS.cl),vehsD=load(KEYS.veh);
 impayesWrap.innerHTML=`
<div class="impaye-alert"><div class="impaye-alert-header"><svg fill="none" viewBox="0 0 24 24" stroke="#C0392B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h4>${impayes.length}location${impayes.length>1?'s':''}avec solde impayé</h4></div>
 ${impayes.map(r=>{
 const c2=clsD.find(x=>x.id===r.clientId),v2=vehsD.find(x=>x.id===r.vehId);
 const pct=r.total>0?Math.round(r.paid2/r.total*100):0;
 return `<div class="impaye-row"><div class="impaye-row-left"><strong>${c2?esc(c2.prenom)+' '+esc(c2.nom):'—'}</strong><span>${v2?esc(v2.marque)+' '+esc(v2.modele):''}· ${pct}% payé</span></div><span class="impaye-amount">${r.reste2.toLocaleString('fr-FR')}MAD</span><button class="btn btn-sm btn-outline" onclick="openPayModal('${esc(r.id)}')" style="margin-left:8px;font-size:0.72rem">Payer</button></div>`;
}).join('')}
</div>`;
}
 requestAnimationFrame(function(){setTimeout(renderCharts,0);});
}
let payResId=null;
function openPayModal(resId){
 payResId=resId;
 renderPayModal();
 document.getElementById('pay-modal').classList.add('open');
}
function renderPayModal(){
 const r=load(KEYS.res).find(x=>x.id===payResId);
 if(!r)return;
 const c=load(KEYS.cl).find(x=>x.id===r.clientId);
 const v=load(KEYS.veh).find(x=>x.id===r.vehId);
 const paiements=r.paiements||[];
 const caution=r.caution||0;
 const cautionStatut=r.cautionStatut||'non';
 const total=r.total||0;
 const paid=paiements.reduce((s,p)=>s+p.montant,0);
 const reste=Math.max(0,total-paid);
 const pct=total>0 ? Math.min(100,Math.round(paid/total*100)): 0;
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '';
 const modeIcons={
 'Espèces':'<path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/>',
 'Virement':'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
 'Chèque':'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'
};
 const avancePaid=paiements.filter(p=>p.type==='avance').reduce((s,p)=>s+p.montant,0);
 const soldePaid=paiements.filter(p=>p.type==='solde').reduce((s,p)=>s+p.montant,0);
 document.getElementById('pay-modal-title').textContent=`Paiements — ${c?c.prenom+' '+c.nom:''}`;
 document.getElementById('pay-modal-body').innerHTML=`
<p style="font-size:0.8rem;color:var(--text2);margin-bottom:14px">${v?esc(v.marque)+' '+esc(v.modele)+'('+esc(v.immat)+')':''}· ${esc(r.debut)}→ ${esc(r.fin)}</p><div class="pay-summary"><div class="pay-box total"><strong>${total.toLocaleString('fr-FR')}MAD</strong><span>Total contrat</span></div><div class="pay-box paid"><strong>${paid.toLocaleString('fr-FR')}MAD</strong><span>Encaissé</span></div><div class="pay-box ${reste===0?'reste-zero':'reste'}"><strong>${reste.toLocaleString('fr-FR')}MAD</strong><span>${reste===0?'Soldé ✓':'Reste dû'}</span></div></div><div class="pay-progress-wrap"><div class="pay-progress-label"><span>Progression du paiement</span><span><strong>${pct}%</strong></span></div><div class="pay-progress-track"><div class="pay-progress-fill" style="width:${pct}%;background:${pct>=100?'var(--success)':'var(--accent2)'}"></div></div></div>
 ${(avancePaid>0||soldePaid>0)? `
<div class="pay-breakdown"><div class="pay-breakdown-item"><span>Avances versées</span><strong style="color:var(--accent2)">${avancePaid.toLocaleString('fr-FR')}MAD</strong></div><div class="pay-breakdown-item"><span>Soldes versés</span><strong style="color:var(--success)">${soldePaid.toLocaleString('fr-FR')}MAD</strong></div></div>` : ''}
<div class="pay-section-title">Caution</div><div class="caution-row"><label>Montant</label><input type="number" id="caution-input" value="${caution}" placeholder="0" style="width:90px;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.85rem;font-family:inherit;background:var(--bg);"><span style="font-size:0.83rem;color:var(--text2)">MAD</span><div class="caution-status"><button class="caution-btn ${cautionStatut==='encaissee'?'active-encaissee':''}" onclick="setCautionStatut('encaissee')">Encaissée</button><button class="caution-btn ${cautionStatut==='restituee'?'active-restituee':''}" onclick="setCautionStatut('restituee')">Restituée</button></div><button class="btn btn-sm btn-outline" onclick="saveCaution()">Enreg.</button></div>
 ${caution>0 ? `<p style="font-size:0.74rem;color:var(--text3);margin:-4px 0 10px;padding-left:4px">Statut caution :<strong style="color:${cautionStatut==='restituee'?'#2E86C1':cautionStatut==='encaissee'?'#1E8449':'#9A9A9A'}">${cautionStatut==='restituee'?'Restituée':cautionStatut==='encaissee'?'Encaissée':'En attente'}</strong></p>` : ''}
<div class="pay-section-title">Versements(${paiements.length})</div><div class="pay-list" id="pay-list">
 ${paiements.length===0
 ? '<p style="text-align:center;color:var(--text3);font-size:0.83rem;padding:12px">Aucun versement enregistré</p>'
 : paiements.map((p,i)=>{
 const typeClass=p.type==='avance'?'pay-type-avance':p.type==='solde'?'pay-type-solde':'pay-type-autre';
 const typeLabel=p.type==='avance'?'Avance':p.type==='solde'?'Solde':'Autre';
 const iconColor=p.type==='avance'?'#2E86C1':p.type==='solde'?'#1E8449':'#888780';
 const iconBg=p.type==='avance'?'#EBF5FB':p.type==='solde'?'#D5F5E3':'#F0EEE9';
 return `
<div class="pay-item"><div class="pay-item-icon" style="background:${iconBg}"><svg fill="none" viewBox="0 0 24 24" stroke="${iconColor}" stroke-width="2">${modeIcons[p.mode]||modeIcons['Espèces']}</svg></div><div class="pay-item-info"><strong>${p.montant.toLocaleString('fr-FR')}MAD<span class="pay-type-tag ${typeClass}">${typeLabel}</span></strong><small>${esc(p.mode)}· ${esc(fmt(p.date))}${p.note?' · '+esc(p.note):''}</small></div><button class="pay-item-del" onclick="deletePaiement(${i})" title="Supprimer"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></div>`;}).join('')}
</div><div class="pay-section-title">Ajouter un versement</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:end;"><div class="form-group"><label>Montant(MAD)</label><input type="number" id="pay-montant" placeholder="${reste>0?reste:''}" class="inline-input"></div><div class="form-group"><label>Type</label><select id="pay-type" class="inline-input"><option value="avance">Avance</option><option value="solde">Solde</option><option value="autre">Autre</option></select></div><div class="form-group"><label>Mode</label><select id="pay-mode" class="inline-input"><option>Espèces</option><option>Virement</option><option>Chèque</option></select></div><button class="btn btn-primary" onclick="addPaiement()" style="margin-bottom:0;align-self:flex-end;height:38px"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><path d="M12 5v14M5 12h14"/></svg></button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;"><div class="form-group"><label>Date du versement</label><input type="date" id="pay-date" value="${new Date().toISOString().slice(0,10)}" class="inline-input"></div><div class="form-group"><label>Note(optionnel)</label><input type="text" id="pay-note" placeholder="ex: solde final,reçu N°…" class="inline-input"></div></div>
 `;
 initNativeDatePickers();
}
function addPaiement(){
 const montant=parseFloat(document.getElementById('pay-montant').value);
 if(!montant||montant<=0){alAlert('Montant invalide');return;}
 const mode=document.getElementById('pay-mode').value;
 const type=document.getElementById('pay-type').value;
 const note=document.getElementById('pay-note').value.trim();
 const date=document.getElementById('pay-date').value||new Date().toISOString().slice(0,10);
 let data=load(KEYS.res);
 data=data.map(r=>{
 if(r.id!==payResId)return r;
 const paiements=[...(r.paiements||[]),{montant,mode,type,note,date}];
 return{...r,paiements,updatedAt: new Date().toISOString()};
});
 save(KEYS.res,data);
 addLog(`Paiement enregistré — ${montant}MAD(${type},${mode})`);
 renderPayModal();
 renderReservations();
}
function deletePaiement(idx){
 alConfirm({
 icon: '💸',danger: true,
 title: 'Supprimer ce versement ?',
 msg: 'Ce paiement sera définitivement retiré de la réservation.',
 okLabel: 'Supprimer',
 onOk:()=>{
 let data=load(KEYS.res);
 data=data.map(r=>{
 if(r.id!==payResId)return r;
 const paiements=(r.paiements||[]).filter((_,i)=>i!==idx);
 return{...r,paiements,updatedAt: new Date().toISOString()};
});
 save(KEYS.res,data);
 renderPayModal();
 renderReservations();
}
});
}
function saveCaution(){
 const montant=parseFloat(document.getElementById('caution-input').value)||0;
 let data=load(KEYS.res);
 data=data.map(r=>r.id===payResId ?{...r,caution:montant,updatedAt: new Date().toISOString()}: r);
 save(KEYS.res,data);
 addLog(`Caution mise à jour — ${montant}MAD`);
 renderPayModal();
 renderReservations();
}
function setCautionStatut(statut){
 let data=load(KEYS.res);
 const cur=data.find(r=>r.id===payResId);
 const newStatut=cur?.cautionStatut===statut ? 'non' : statut;
 data=data.map(r=>r.id===payResId ?{...r,cautionStatut:newStatut,updatedAt: new Date().toISOString()}: r);
 save(KEYS.res,data);
 renderPayModal();
 renderReservations();
}
function buildHistTimeline(reservations,vehs,clients){
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '—';
 if(!reservations.length)return `
<div class="hist-empty"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Aucune location enregistrée</p></div>`;
 const sorted=[...reservations].sort((a,b)=>new Date(b.createdAt||b.debut)-new Date(a.createdAt||a.debut));
 const colors={'en cours':'#2E86C1','terminée':'#1E8449','annulée':'#C0392B'};
 const bgs={'en cours':'#EBF5FB','terminée':'#D5F5E3','annulée':'#FDEDEC'};
 return `<div class="hist-timeline">${sorted.map(r=>{
 const v=vehs.find(x=>x.id===r.vehId);
 const c=clients.find(x=>x.id===r.clientId);
 const days=(r.debut&&r.fin)? Math.max(1,Math.round((new Date(r.fin)-new Date(r.debut))/(1000*60*60*24))): 0;
 const color=colors[r.statut]||'#9A9A9A';
 const bg=bgs[r.statut]||'#F2F3F4';
 return `
<div class="hist-item"><div class="hist-dot" style="background:${bg}"><svg fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><div class="hist-item-body"><div class="hist-item-header"><span class="hist-item-title">${v ? esc(v.marque)+' '+esc(v.modele) : '—'}${v?'('+esc(v.immat)+')':''}</span><span class="hist-item-date">${esc(fmt(r.debut))}→ ${esc(fmt(r.fin))}</span></div><div class="hist-item-detail">
 ${c ? `<strong>Client :</strong>${esc(c.prenom)} ${esc(c.nom)}<br>` : ''}
<strong>Durée :</strong>${days}jour${days>1?'s':''}&nbsp;·&nbsp;
<strong>Montant :</strong>${(r.total||0).toLocaleString('fr-FR')}MAD&nbsp;·&nbsp;
<strong>Lieu :</strong>${esc(r.lieu||'—')}<br><span class="badge ${r.statut==='en cours'?'badge-info':r.statut==='terminée'?'badge-success':'badge-danger'}" style="margin-top:5px">${esc(r.statut)}</span>
 ${r.notes?`<br><span style="color:var(--text3);font-size:0.73rem">💬 ${esc(r.notes)}</span>`:''}
</div></div></div>`;
}).join('')}</div>`;
}
function showHistClient(id){
 const c=load(KEYS.cl).find(x=>x.id===id);
 if(!c)return;
 const reservations=load(KEYS.res).filter(r=>r.clientId===id);
 const vehs=load(KEYS.veh);
 const totalCA=reservations.filter(r=>r.statut==='terminée').reduce((s,r)=>s+(r.total||0),0);
 const enCours=reservations.filter(r=>r.statut==='en cours').length;
 document.getElementById('hist-modal-title').textContent='Historique client';
 document.getElementById('hist-modal-body').innerHTML=`
<div class="hist-hero"><div class="hist-hero-icon" style="background:#D5F5E3"><svg fill="none" viewBox="0 0 24 24" stroke="#1E8449" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="hist-hero-info"><h4>${esc(c.prenom)}${esc(c.nom)}</h4><p>${esc(c.tel)}${c.email?'· '+esc(c.email):''}</p><p style="margin-top:2px">CIN : ${esc(c.cin||'—')}· Permis : ${esc(c.permis||'—')}· ${esc(c.ville||'')}</p></div></div><div class="hist-stats"><div class="hist-stat"><strong>${reservations.length}</strong><span>Total locations</span></div><div class="hist-stat"><strong>${enCours}</strong><span>En cours</span></div><div class="hist-stat"><strong>${totalCA.toLocaleString('fr-FR')}MAD</strong><span>CA généré</span></div></div>
 ${buildHistTimeline(reservations,vehs,load(KEYS.cl))}`;
 document.getElementById('hist-modal').classList.add('open');
}
function showHistVeh(id){
 const v=load(KEYS.veh).find(x=>x.id===id);
 if(!v)return;
 const reservations=load(KEYS.res).filter(r=>r.vehId===id);
 const clients=load(KEYS.cl);
 const totalCA=reservations.filter(r=>r.statut==='terminée').reduce((s,r)=>s+(r.total||0),0);
 const totalJours=reservations.filter(r=>r.debut&&r.fin).reduce((s,r)=>s+Math.max(1,Math.round((new Date(r.fin)-new Date(r.debut))/(1000*60*60*24))),0);
 document.getElementById('hist-modal-title').textContent='Historique véhicule';
 document.getElementById('hist-modal-body').innerHTML=`
<div class="hist-hero"><div class="hist-hero-icon" style="background:#EBF5FB"><svg fill="none" viewBox="0 0 24 24" stroke="#2E86C1" stroke-width="2"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div><div class="hist-hero-info"><h4>${esc(v.marque)}${esc(v.modele)}— ${esc(v.immat)}</h4><p>${esc(String(v.annee))}· ${esc(v.cat)}· ${esc(v.carburant)}· ${esc(v.couleur)}</p><p style="margin-top:2px">Kilométrage : ${(v.km||0).toLocaleString('fr-FR')}km · Tarif : ${esc(String(v.tarif||'—'))}MAD/j</p></div></div><div class="hist-stats"><div class="hist-stat"><strong>${reservations.length}</strong><span>Total locations</span></div><div class="hist-stat"><strong>${totalJours}</strong><span>Jours loués</span></div><div class="hist-stat"><strong>${totalCA.toLocaleString('fr-FR')}MAD</strong><span>CA généré</span></div></div>
 ${buildHistTimeline(reservations,load(KEYS.veh),clients)}`;
 document.getElementById('hist-modal').classList.add('open');
}
function printContrat(id){
 window._printContratId=id;
 const r=load(KEYS.res).find(x=>x.id===id);
 if(!r)return;
 const c=load(KEYS.cl).find(x=>x.id===r.clientId);
 const v=load(KEYS.veh).find(x=>x.id===r.vehId);
 const d1=new Date(r.debut),d2=new Date(r.fin);
 const days=Math.max(1,Math.round((d2-d1)/(1000*60*60*24)));
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '—';
 const s=getSettings();
 const agenceNom=s.nom||'INVOORENT';
 const agenceSlogan=s.slogan||'Gérez, louez, développez';
 const agenceVille=s.ville||'Tanger,Maroc';
 const agenceTel=s.tel||'+212 5XX XX XX XX';
 const agenceEmail=s.email ? ' — '+s.email : '';
 const agenceSite=s.site ? ' — '+s.site : '';
 const conditions=(s.conditions||CONDITIONS_DEFAUT).split('\n').filter(l=>l.trim());
 const contratNum='CTR-'+id.slice(-6).toUpperCase();
 document.getElementById('contrat-body').innerHTML=`
<div class="contrat-header"><div class="contrat-logo"><h2>${esc(agenceNom).replace(/(\S+)$/,'<span>$1</span>')}</h2><p>${esc(agenceSlogan)}</p><p style="margin-top:4px;font-size:0.72rem;color:#9A9A9A">${esc(agenceVille)}— Tél: ${esc(agenceTel)}${agenceEmail ? ' — '+esc(s.email): ''}${agenceSite ? ' — '+esc(s.site): ''}</p>
 ${s.patente ? `<p style="font-size:0.7rem;color:#9A9A9A;margin-top:2px">RC / Patente : ${esc(s.patente)}</p>` : ''}
</div><div class="contrat-meta"><span>N° Contrat</span><strong>${esc(contratNum)}</strong><span style="margin-top:6px;display:block">Date : ${new Date().toLocaleDateString('fr-FR')}</span><span class="badge ${r.statut==='en cours'?'badge-info':r.statut==='terminée'?'badge-success':'badge-danger'}" style="margin-top:6px">${esc(r.statut)}</span></div></div><div class="contrat-title">Contrat de Location de Véhicule</div><div class="contrat-section"><h4>Informations du locataire</h4><div class="contrat-grid"><div class="contrat-field"><span>Nom complet</span><strong>${c ? esc(c.prenom)+' '+esc(c.nom): '—'}</strong></div><div class="contrat-field"><span>CIN / Passeport</span><strong>${esc(c?.cin||'—')}</strong></div><div class="contrat-field"><span>Téléphone</span><strong>${esc(c?.tel||'—')}</strong></div><div class="contrat-field"><span>N° Permis de conduire</span><strong>${esc(c?.permis||'—')}</strong></div><div class="contrat-field"><span>Email</span><strong>${esc(c?.email||'—')}</strong></div><div class="contrat-field"><span>Adresse</span><strong>${esc(c?.adresse||'—')}</strong></div><div class="contrat-field"><span>Ville</span><strong>${esc(c?.ville||'—')}</strong></div><div class="contrat-field"><span>Nationalité</span><strong>${esc(c?.nat||'—')}</strong></div></div></div><div class="contrat-section"><h4>Véhicule loué</h4><div class="contrat-grid"><div class="contrat-field"><span>Marque / Modèle</span><strong>${v ? esc(v.marque)+' '+esc(v.modele): '—'}</strong></div><div class="contrat-field"><span>Immatriculation</span><strong>${esc(v?.immat||'—')}</strong></div><div class="contrat-field"><span>Année</span><strong>${esc(String(v?.annee||'—'))}</strong></div><div class="contrat-field"><span>Catégorie</span><strong>${esc(v?.cat||'—')}</strong></div><div class="contrat-field"><span>Couleur</span><strong>${esc(v?.couleur||'—')}</strong></div><div class="contrat-field"><span>Carburant</span><strong>${esc(v?.carburant||'—')}</strong></div><div class="contrat-field"><span>Kilométrage départ</span><strong>${v?.km ? v.km.toLocaleString('fr-FR')+' km' : '—'}</strong></div><div class="contrat-field"><span>Tarif journalier</span><strong>${esc(String(v?.tarif||'—'))}MAD / jour</strong></div></div></div><div class="contrat-section"><h4>Détails de la location</h4><div class="contrat-grid"><div class="contrat-field"><span>Date de départ</span><strong>${fmt(r.debut)}</strong></div><div class="contrat-field"><span>Date de retour prévue</span><strong>${fmt(r.fin)}</strong></div><div class="contrat-field"><span>Durée</span><strong>${days}jour${days>1?'s':''}</strong></div><div class="contrat-field"><span>Lieu de prise en charge</span><strong>${esc(r.lieu||'—')}</strong></div>
 ${r.notes ? `<div class="contrat-field" style="grid-column:1/-1"><span>Remarques</span><strong>${esc(r.notes)}</strong></div>` : ''}
</div></div><div class="contrat-total-box"><div><p>Montant total de la location</p><p style="font-size:0.75rem;opacity:0.6">${days}jour${days>1?'s':''}× ${v?.tarif||0}MAD</p></div><strong>${(r.total||0).toLocaleString('fr-FR')}MAD</strong></div>
 ${(r.paiements||[]).length>0||r.caution>0 ? `
<div class="contrat-section"><h4>Récapitulatif des paiements</h4><div class="contrat-fields">
 ${(r.paiements||[]).map(p=>{
 const typeLabel=p.type==='avance'?'Avance':p.type==='solde'?'Solde':'Autre';
 return `<div class="contrat-field"><span>${esc(typeLabel)}(${esc(p.mode)}· ${esc(p.date||'')})</span><strong>${p.montant.toLocaleString('fr-FR')}MAD</strong></div>`;
}).join('')}
 ${r.caution>0?`<div class="contrat-field"><span>Caution(${esc(r.cautionStatut==='encaissee'?'Encaissée':r.cautionStatut==='restituee'?'Restituée':'En attente')})</span><strong>${(r.caution||0).toLocaleString('fr-FR')}MAD</strong></div>`:''}
<div class="contrat-field" style="border-top:1px solid #eee;margin-top:4px;padding-top:8px"><span><strong>Reste dû</strong></span><strong style="color:${Math.max(0,(r.total||0)-(r.paiements||[]).reduce((s,p)=>s+p.montant,0))===0?'#1E8449':'#C0392B'}">${Math.max(0,(r.total||0)-(r.paiements||[]).reduce((s,p)=>s+p.montant,0)).toLocaleString('fr-FR')}MAD</strong></div></div></div>` : ''}
<div class="contrat-section"><h4>Conditions générales</h4><div class="contrat-conditions">
 ${conditions.map((cl,i)=>`${i+1}. ${esc(cl)}`).join('<br>')}
</div></div><div class="contrat-signatures"><div class="contrat-sig-box"><p>Signature du locataire</p><p style="margin-top:4px;font-size:0.7rem">${c ? esc(c.prenom)+' '+esc(c.nom): ''}</p></div><div class="contrat-sig-box"><p>Cachet et signature de l'agence</p><p style="margin-top:4px;font-size:0.7rem">${esc(agenceNom)}</p></div></div>
 `;
 openModal('contrat-modal');
}
function printContratDirect(){
 const contratEl=document.getElementById('contrat-body');
 if(!contratEl||!contratEl.innerHTML)return;
 function _generatePDF(){
 const{jsPDF}=window.jspdf;
 const r=window._printContratId ? load(KEYS.res).find(x=>x.id===window._printContratId): null;
 const doc=new jsPDF({unit: 'mm',format: 'a4',orientation: 'portrait'});
 const s=getSettings();
 const agenceNom=s.nom||'INVOORENT';
 const agenceSlogan=s.slogan||'Gérez, louez, développez';
 const agenceVille=s.ville||'Tanger,Maroc';
 const agenceTel=s.tel||'+212 5XX XX XX XX';
 const res=r||{};
 const clientId=res.clientId;
 const vehId=res.vehId;
 const c=clientId ? load(KEYS.cl).find(x=>x.id===clientId): null;
 const v=vehId ? load(KEYS.veh).find(x=>x.id===vehId): null;
 const d1=res.debut ? new Date(res.debut): new Date();
 const d2=res.fin ? new Date(res.fin): new Date();
 const days=Math.max(1,Math.round((d2-d1)/(1000*60*60*24)));
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '—';
 const contratNum=res.id ? 'CTR-'+res.id.slice(-6).toUpperCase(): 'CTR-000000';
 const fmtNum=n=>String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
 const conditions=(s.conditions||CONDITIONS_DEFAUT).split('\n').filter(l=>l.trim());
 const W=210,ml=15,mr=15,cw=W-ml-mr;
 let y=15;
 const txt=(t,x,yy,opts)=>{doc.text(String(t||''),x,yy,opts);};
 const line=(x1,y1,x2,y2,color)=>{doc.setDrawColor(color||'#0C0E14');doc.line(x1,y1,x2,y2);};
 const rect=(x,yy,w,h,fillColor,strokeColor)=>{
 if(fillColor)doc.setFillColor(fillColor);
 if(strokeColor)doc.setDrawColor(strokeColor);else doc.setDrawColor(255,255,255,0);
 doc.roundedRect(x,yy,w,h,2,2,fillColor ?(strokeColor ? 'FD' : 'F'): 'S');
};
 const setFont=(size,style,color)=>{
 doc.setFontSize(size);
 doc.setFont('helvetica',style||'normal');
 if(color)doc.setTextColor(color);else doc.setTextColor('#0C0E14');
};
 setFont(16,'bold','#0C0E14');
 txt(agenceNom,ml,y);
 setFont(8,'normal','#777777');
 txt(agenceSlogan,ml,y+5);
 txt(agenceVille+' — Tél: '+agenceTel+(s.email ? ' — '+s.email : ''),ml,y+10);
 if(s.patente){setFont(7,'normal','#AAAAAA');txt('RC / Patente : '+s.patente,ml,y+14);}
 setFont(7,'normal','#777777');
 txt('N° Contrat',W-mr,y,{align: 'right'});
 setFont(11,'bold','#1A1A1A');
 txt(contratNum,W-mr,y+5,{align: 'right'});
 setFont(7,'normal','#777777');
 txt('Date : '+new Date().toLocaleDateString('fr-FR'),W-mr,y+10,{align: 'right'});
 y+=18;
 line(ml,y,W-mr,y,'#0C0E14');
 y+=6;
 rect(ml,y-4,cw,10,'rgba(45,212,191,0.12)','rgba(45,212,191,0.25)');
 setFont(8,'bold','#312E81');
 txt('CONTRAT DE LOCATION DE VÉHICULE',W / 2,y+2,{align: 'center'});
 y+=12;
 const section=(title)=>{
 setFont(7,'bold','#0C0E14');
 txt(title,ml,y);
 doc.setDrawColor('#E4E0D8');
 line(ml,y+1.5,W-mr,y+1.5,'#E4E0D8');
 y+=6;
};
 const grid2=(pairs)=>{
 const colW=cw / 2-4;
 pairs.forEach((pair,i)=>{
 const col=i % 2;
 const row=Math.floor(i / 2);
 const x=ml+col *(colW+8);
 const yy=y+row * 9;
 setFont(6.5,'normal','#777777');
 txt(pair[0],x,yy);
 setFont(8,'bold','#1A1A1A');
 txt(String(pair[1]||'—'),x,yy+4);
});
 y+=Math.ceil(pairs.length / 2)* 9+2;
};
 section('INFORMATIONS DU LOCATAIRE');
 grid2([
['Nom complet',c ?(c.prenom+' '+c.nom): '—'],
['CIN / Passeport',c?.cin||'—'],
['Téléphone',c?.tel||'—'],
['N° Permis',c?.permis||'—'],
['Email',c?.email||'—'],
['Adresse',c?.adresse||'—'],
['Ville',c?.ville||'—'],
['Nationalité',c?.nat||'—'],
]);
 section('VÉHICULE LOUÉ');
 grid2([
['Marque / Modèle',v ?(v.marque+' '+v.modele): '—'],
['Immatriculation',v?.immat||'—'],
['Année',v?.annee||'—'],
['Catégorie',v?.cat||'—'],
['Couleur',v?.couleur||'—'],
['Carburant',v?.carburant||'—'],
['Kilométrage départ',v?.km ? fmtNum(v.km)+' km' : '—'],
['Tarif journalier',(v?.tarif||'—')+' MAD/j'],
]);
 section('DÉTAILS DE LA LOCATION');
 grid2([
['Date de départ',fmt(res.debut)],
['Date de retour',fmt(res.fin)],
['Durée',days+' jour'+(days>1 ? 's' : '')],
['Lieu de prise',res.lieu||'—'],
 ...(res.notes ?[['Remarques',res.notes]]:[]),
]);
 y+=2;
 rect(ml,y,cw,14,'#0C0E14');
 setFont(8,'normal','#CCCCCC');
 txt('Montant total de la location',ml+4,y+5);
 setFont(7,'normal','#999999');
 txt(days+' jour'+(days>1?'s':'')+' × '+(v?.tarif||0)+' MAD',ml+4,y+10);
 setFont(14,'bold','#FFFFFF');
 txt(fmtNum(res.total||0)+' MAD',W-mr-4,y+9,{align: 'right'});
 y+=20;
 if((res.paiements||[]).length>0||res.caution>0){
 section('RÉCAPITULATIF DES PAIEMENTS');
(res.paiements||[]).forEach(p=>{
 const typeLabel=p.type==='avance'?'Avance':p.type==='solde'?'Solde':'Autre';
 setFont(7,'normal','#555555');
 txt(typeLabel+'('+p.mode+' · '+(p.date||'')+')',ml,y);
 setFont(7,'bold','#1A1A1A');
 txt(fmtNum(p.montant)+' MAD',W-mr,y,{align: 'right'});
 y+=6;
});
 if(res.caution>0){
 const cautionLbl=res.cautionStatut==='encaissee'?'Encaissée':res.cautionStatut==='restituee'?'Restituée':'En attente';
 setFont(7,'normal','#555555');
 txt('Caution('+cautionLbl+')',ml,y);
 setFont(7,'bold','#1A1A1A');
 txt(fmtNum(res.caution||0)+' MAD',W-mr,y,{align: 'right'});
 y+=6;
}
 const restedu=Math.max(0,(res.total||0)-(res.paiements||[]).reduce((s,p)=>s+p.montant,0));
 doc.setDrawColor('#EEEEEE');line(ml,y,W-mr,y,'#EEEEEE');
 y+=4;
 setFont(7,'bold','#0C0E14');
 txt('Reste dû',ml,y);
 setFont(8,'bold',restedu===0 ? '#1E8449' : '#C0392B');
 txt(fmtNum(restedu)+' MAD',W-mr,y,{align: 'right'});
 y+=8;
}
 section('CONDITIONS GÉNÉRALES');
 doc.setDrawColor('#2dd4bf');
 doc.setFillColor('#FAFAFA');
 const condTextLines=[];
 conditions.forEach((cl,i)=>condTextLines.push((i+1)+'. '+cl));
 const condText=condTextLines.join('\n');
 const condSplit=doc.splitTextToSize(condText,cw-8);
 const condH=condSplit.length * 3.5+6;
 doc.roundedRect(ml,y-2,cw,condH,2,2,'F');
 doc.setDrawColor('#2dd4bf');
 doc.setLineWidth(0.8);
 doc.line(ml,y-2,ml,y-2+condH);
 doc.setLineWidth(0.2);
 setFont(6.5,'normal','#333333');
 doc.text(condSplit,ml+4,y+2.5,{lineHeightFactor: 1.5});
 y+=condH+6;
 const sigW=(cw-10)/ 2;
 doc.setDrawColor('#1A1A1A');doc.setLineWidth(0.4);
 line(ml,y,ml+sigW,y,'#1A1A1A');
 line(ml+sigW+10,y,ml+sigW+10+sigW,y,'#1A1A1A');
 doc.setLineWidth(0.2);
 setFont(7,'normal','#555555');
 txt('Signature du locataire',ml+sigW/2,y+4,{align: 'center'});
 txt(c ?(c.prenom+' '+c.nom): '',ml+sigW/2,y+8,{align: 'center'});
 txt('Cachet et signature de l\'agence',ml+sigW+10+sigW/2,y+4,{align: 'center'});
 txt(agenceNom,ml+sigW+10+sigW/2,y+8,{align: 'center'});
 doc.save('Contrat_'+contratNum+'_'+(c ? c.nom : 'client')+'.pdf');
}
 if(window.jspdf){
 _generatePDF();
}else{
 const script=document.createElement('script');
 script.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
 script.onload=_generatePDF;
 script.onerror=()=>{
 const w=window.open('','_blank');
 w.document.write('<html><body>'+document.getElementById('contrat-body').innerHTML+'<scr'+'ipt>window.print();<\/scr'+'ipt></body></html>');
 w.document.close();w.print();w.close();
};
 document.head.appendChild(script);
}
}
let maintFilter='all';
let editingMaintId=null;
function filterMaint(el,f){
 document.querySelectorAll('#maint-filters .filter-btn').forEach(b=>b.classList.remove('active'));
 el.classList.add('active');maintFilter=f;renderMaintenance();
}
function openMaintModal(id){
 const vehs=load(KEYS.veh);
 const sel=document.getElementById('maint-veh');
 if(!sel)return;
 sel.innerHTML='';
 const opt0=document.createElement('option');
 opt0.value='';
 opt0.textContent='--Sélectionner--';
 sel.appendChild(opt0);
 vehs.forEach(v=>{
  const opt=document.createElement('option');
  opt.value=v.id;
  opt.textContent=`${v.marque||''}${v.modele||''}(${v.immat||''})`;
  sel.appendChild(opt);
 });
 if(id){
 editingMaintId=id;
 const m=load(KEYS.maint).find(x=>x.id===id);
 if(m){
 sel.value=m.vehId;
 document.getElementById('maint-type').value=m.type;
 document.getElementById('maint-statut').value=m.statut;
 document.getElementById('maint-date').value=normalizeDateInputValue(m.date)||'';
 document.getElementById('maint-date').dispatchEvent(new Event('input'));
 document.getElementById('maint-cout').value=m.cout||'';
 document.getElementById('maint-km').value=m.km||'';
 document.getElementById('maint-km-seuil').value=m.kmSeuil||'';
 document.getElementById('maint-notes').value=m.notes||'';
 document.getElementById('maint-modal-title').textContent='Modifier maintenance';
}
}else{
 editingMaintId=null;
 document.getElementById('maint-modal-title').textContent='Planifier une maintenance';
['maint-date','maint-cout','maint-km','maint-km-seuil','maint-notes'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
 const _md=document.getElementById('maint-date');if(_md)_md.dispatchEvent(new Event('input'));
 document.getElementById('maint-veh').value='';
 document.getElementById('maint-type').selectedIndex=0;
 document.getElementById('maint-statut').selectedIndex=0;
}
 document.getElementById('maint-modal').classList.add('open');
}
function saveMaintenance(){
 const vehId=document.getElementById('maint-veh').value;
 const date=document.getElementById('maint-date').value;
 if(!vehId||!date){alAlert('Véhicule et date sont obligatoires.');return;}
 const now=new Date().toISOString();
 const m={
 id: editingMaintId||uid(),
 vehId,
 type: document.getElementById('maint-type').value,
 statut: document.getElementById('maint-statut').value,
 date,
 cout: parseFloat(document.getElementById('maint-cout').value)||0,
 km: parseInt(document.getElementById('maint-km').value)||0,
 kmSeuil: parseInt(document.getElementById('maint-km-seuil').value)||0,
 notes: document.getElementById('maint-notes').value.trim(),
 createdAt: editingMaintId ?(load(KEYS.maint).find(x=>x.id===editingMaintId)?.createdAt||now): now,
 updatedAt: now,
};
 let data=load(KEYS.maint);
 if(editingMaintId){data=data.map(x=>x.id===editingMaintId?m:x);}
 else{data.push(m);}
 save(KEYS.maint,data);
 if(m.km>0){
 let vehs=load(KEYS.veh);
 vehs=vehs.map(v=>v.id===vehId ?{...v,km: Math.max(v.km||0,m.km),updatedAt: new Date().toISOString()}: v);
 save(KEYS.veh,vehs);
}
 if(m.statut==='planifiée'){
 let vehs=load(KEYS.veh);
 vehs=vehs.map(v=>v.id===vehId&&v.statut==='disponible' ?{...v,statut:'maintenance',updatedAt: new Date().toISOString()}: v);
 save(KEYS.veh,vehs);
}
 addLog(`Maintenance ${m.statut}— ${m.type}`);
 closeModal('maint-modal');
 renderMaintenance();
 renderMaintAlerts();
}
function deleteMaintenance(id){
 alConfirm({
 icon: '🔧',danger: true,
 title: 'Supprimer cette intervention ?',
 msg: 'Cette action est irréversible.',
 okLabel: 'Supprimer',
 onOk:()=>{
 save(KEYS.maint,load(KEYS.maint).map(x=>x.id===id ?{...x,_deleted: true,updatedAt: new Date().toISOString()}: x));
 renderMaintenance();
 renderMaintAlerts();
}
});
}
function markMaintDone(id){
 let data=load(KEYS.maint);
 const m=data.find(x=>x.id===id);
 data=data.map(x=>x.id===id ?{...x,statut:'effectuée',updatedAt: new Date().toISOString()}: x);
 save(KEYS.maint,data);
 if(m){
 const autresMaint=data.filter(x=>x.vehId===m.vehId&&x.statut==='planifiée');
 if(!autresMaint.length){
 let vehs=load(KEYS.veh);
 vehs=vehs.map(v=>v.id===m.vehId&&v.statut==='maintenance' ?{...v,statut:'disponible',updatedAt: new Date().toISOString()}: v);
 save(KEYS.veh,vehs);
}
}
 addLog('Maintenance marquée effectuée');
 renderMaintenance();
 renderMaintAlerts();
 renderDashboard();
}
function renderMaintenance(){
 let data=load(KEYS.maint).filter(m=>!m._deleted);
 if(maintFilter!=='all')data=data.filter(m=>m.statut===maintFilter);
 data=[...data].sort((a,b)=>new Date(a.date)-new Date(b.date));
 const vehs=load(KEYS.veh);
 const tbody=document.getElementById('maint-tbody');
 if(!tbody)return;
 renderMaintAlerts();
 if(!data.length){
 tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg><p>Aucune intervention enregistrée</p></div></td></tr>`;
 return;
}
 const today=new Date();today.setHours(0,0,0,0);
 tbody.innerHTML=data.map(m=>{
 const v=vehs.find(x=>x.id===m.vehId);
 const dateD=new Date(m.date);dateD.setHours(0,0,0,0);
 const overdue=m.statut==='planifiée'&&dateD<today;
 const kmPct=(m.km&&m.kmSeuil)? Math.min(100,Math.round(m.km/m.kmSeuil*100)): 0;
 const kmAlert=m.kmSeuil&&m.km>=m.kmSeuil * 0.9;
 const badgeCls=m.statut==='effectuée' ? 'maint-badge-effectuee' : overdue ? 'maint-badge-alerte' : 'maint-badge-planifiee';
 const badgeLbl=m.statut==='effectuée' ? 'Effectuée' : overdue ? 'En retard' : 'Planifiée';
 return `<tr style="${overdue?'background:#FFFBF0;':''}"><td><strong>${v?esc(v.marque)+' '+esc(v.modele):'—'}</strong><br><span style="font-size:0.72rem;color:var(--text3)">${v?esc(v.immat):''}</span></td><td>${esc(m.type)}</td><td style="color:${overdue?'var(--danger)':'var(--text)'};font-weight:${overdue?'600':'400'}">${new Date(m.date).toLocaleDateString('fr-FR')}</td><td>${m.km ? m.km.toLocaleString('fr-FR')+' km' : '—'}</td><td>
 ${m.kmSeuil ? `<div style="font-size:0.8rem;color:${kmAlert?'#D68910':'var(--text2)'}">
 ${m.kmSeuil.toLocaleString('fr-FR')}km
 ${kmAlert ? '<span class="maint-badge-alerte" style="margin-left:4px">⚠ Seuil!</span>' : ''}
<div class="maint-km-bar-track" style="margin-top:4px"><div class="maint-km-bar-fill" style="width:${kmPct}%;background:${kmAlert?'#D68910':'#2E86C1'}"></div></div></div>` : '—'}
</td><td><span class="${badgeCls}">${esc(badgeLbl)}</span></td><td style="font-size:0.78rem;color:var(--text2);max-width:150px">${esc(m.notes||'—')}</td><td style="display:flex;gap:5px;">
 ${m.statut!=='effectuée'?`<button class="btn btn-sm btn-outline" onclick="markMaintDone('${esc(m.id)}')" style="color:var(--success);border-color:var(--success);font-size:0.72rem">✓ Fait</button>`:''}
<button class="btn-icon" title="Modifier" onclick="openMaintModal('${esc(m.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" title="Supprimer" onclick="deleteMaintenance('${esc(m.id)}')"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button></td></tr>`;
}).join('');
}
function renderMaintAlerts(){
 const vehs=load(KEYS.veh);
 const maints=load(KEYS.maint).filter(m=>m.statut==='planifiée');
 const today=new Date();today.setHours(0,0,0,0);
 const alerts=[];
 maints.forEach(m=>{
 const v=vehs.find(x=>x.id===m.vehId);
 const dateD=new Date(m.date);dateD.setHours(0,0,0,0);
 const overdue=dateD<today;
 const kmAlert=m.kmSeuil&&m.km&&m.km>=m.kmSeuil * 0.9;
 if(overdue||kmAlert)alerts.push({m,v,overdue,kmAlert});
});
 const dot=document.getElementById('maint-notif-dot');
 if(dot)dot.style.display=alerts.length ? 'inline-block' : 'none';
 const wrap=document.getElementById('maint-alerts-wrap');
 if(!wrap)return;
 if(!alerts.length){wrap.innerHTML='';return;}
 wrap.innerHTML=`<div class="maint-alert-km"><div class="maint-alert-km-header"><svg fill="none" viewBox="0 0 24 24" stroke="#D68910" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h4>${alerts.length}alerte${alerts.length>1?'s':''}maintenance</h4></div>
 ${alerts.map(({m,v,overdue,kmAlert})=>`
<div class="maint-km-row"><div><strong>${v?esc(v.marque)+' '+esc(v.modele):'—'}</strong><span style="color:var(--text3);font-size:0.72rem">${v?esc(v.immat):''}</span><br><span style="font-size:0.72rem;color:var(--text2)">${esc(m.type)}· ${new Date(m.date).toLocaleDateString('fr-FR')}</span></div><div class="maint-km-bar-wrap">
 ${kmAlert&&m.kmSeuil?`<div style="font-size:0.72rem;color:#D97706;margin-bottom:3px">${m.km.toLocaleString('fr-FR')}/ ${m.kmSeuil.toLocaleString('fr-FR')}km</div><div class="maint-km-bar-track"><div class="maint-km-bar-fill" style="width:${Math.min(100,Math.round(m.km/m.kmSeuil*100))}%"></div></div>` : ''}
</div><span class="${overdue?'maint-badge-alerte':'maint-badge-planifiee'}">${overdue?'En retard':kmAlert?'⚠ Km seuil':''}</span><button class="btn btn-sm btn-primary" onclick="markMaintDone('${esc(m.id)}')" style="margin-left:8px;font-size:0.72rem">✓ Fait</button></div>`).join('')}
</div>`;
}
let calYear=new Date().getFullYear();
let calMonth=new Date().getMonth();
const MOIS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS_FR=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
function calPrev(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function calNext(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();}
function calToday(){calYear=new Date().getFullYear();calMonth=new Date().getMonth();renderCalendar();}
function renderCalendar(){
 const thead=document.getElementById('cal-thead');
 const tbody2=document.getElementById('cal-tbody');
 if(!thead||!tbody2)return;
 const vehs=load(KEYS.veh).filter(v=>!v._deleted);
 const reservations=load(KEYS.res).filter(r=>!r._deleted&&r.statut!=='annulée');
 const clients=load(KEYS.cl).filter(c=>!c._deleted);
 const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
 const today=new Date();
 const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 document.getElementById('cal-month-label').textContent=`${MOIS_FR[calMonth]}${calYear}`;
 let headHtml='<tr><th class="col-veh">Véhicule</th>';
 for(let d=1;d<=daysInMonth;d++){
 const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const dow=new Date(calYear,calMonth,d).getDay();
 const isWeekend=dow===0||dow===6;
 const isToday=dateStr===todayStr;
 headHtml+=`<th class="${isToday?'today-col':''}" style="${isWeekend?'background:#FAF9F7;color:var(--text3)':''}">${d}<br><span style="font-size:0.62rem;font-weight:400">${JOURS_FR[(dow+6)%7]}</span></th>`;
}
 headHtml+='</tr>';
 thead.innerHTML=headHtml;
 if(!vehs.length){
 tbody2.innerHTML=`<tr><td colspan="${daysInMonth+1}" style="text-align:center;padding:40px;color:var(--text3)">Aucun véhicule enregistré</td></tr>`;
 return;
}
 let bodyHtml='';
 vehs.forEach(v=>{
 const dayMap={};
 reservations.filter(r=>r.vehId===v.id).forEach(r=>{
 if(!r.debut||!r.fin)return;
 const client=clients.find(c=>c.id===r.clientId);
 const clientName=client ? `${client.prenom}${client.nom}` : 'Client';
 const d1=new Date(r.debut),d2=new Date(r.fin);
 const d1Str=r.debut,d2Str=r.fin;
 const cur=new Date(d1);
 while(cur<=d2){
 const ds=cur.toISOString().slice(0,10);
 dayMap[ds]={type:'booked',clientName,debut:d1Str,fin:d2Str,resId:r.id};
 cur.setDate(cur.getDate()+1);
}
});
 bodyHtml+=`<tr><td class="col-veh"><span class="veh-name">${esc(v.marque)}${esc(v.modele)}</span><span class="veh-sub">${esc(v.immat)}</span></td>`;
 for(let d=1;d<=daysInMonth;d++){
 const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const isToday=ds===todayStr;
 const info=dayMap[ds];
 const dow=new Date(calYear,calMonth,d).getDay();
 const isWeekend=dow===0||dow===6;
 if(info&&info.type==='booked'){
 const prevDs=new Date(new Date(ds).getTime()-86400000).toISOString().slice(0,10);
 const nextDs=new Date(new Date(ds).getTime()+86400000).toISOString().slice(0,10);
 const prevSame=dayMap[prevDs]?.resId===info.resId;
 const nextSame=dayMap[nextDs]?.resId===info.resId;
 let posClass='middle';
 if(!prevSame&&!nextSame)posClass='solo';
 else if(!prevSame)posClass='start';
 else if(!nextSame)posClass='end';
 const label=(posClass==='start'||posClass==='solo')? esc(info.clientName.split(' ')[0]): '';
 bodyHtml+=`<td style="${isToday?'outline:2px solid var(--accent2);outline-offset:-2px;':''}${isWeekend?'background:#FAF9F7;':''}"><div class="cal-tooltip"><div class="cal-cell booked ${posClass}" title="">${label}</div><div class="tooltip-box">${esc(info.clientName)}<br>${esc(info.debut)}→ ${esc(info.fin)}</div></div></td>`;
}else if(v.statut==='maintenance'&&!info){
 bodyHtml+=`<td style="${isWeekend?'background:#FAF9F7;':''}"><div class="cal-cell maintenance" title="Maintenance">M</div></td>`;
}else{
 bodyHtml+=`<td style="${isToday?'background:#EBF5FB;':''}${isWeekend?'background:#FAF9F7;':''}"><div class="cal-cell free"></div></td>`;
}
}
 bodyHtml+='</tr>';
});
 tbody2.innerHTML=bodyHtml;
}
function csvEscape(v){
 if(v===null||v===undefined)return '';
 const s=String(v).replace(/"/g,'""');
 return s.includes(',')||s.includes('\n')||s.includes('"')? `"${s}"` : s;
}
function downloadCSV(filename,rows){
 const bom='\uFEFF';
 const csv=bom+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
 const blob=new Blob([csv],{type: 'text/csv;charset=utf-8;'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=filename;
 a.click();
}
function exportCSV(type){
 const vehs=load(KEYS.veh).filter(v=>!v._deleted);
 const cls=load(KEYS.cl).filter(c=>!c._deleted);
 const res=load(KEYS.res).filter(r=>!r._deleted);
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '';
 if(type==='veh'){
 const rows=[['immat','marque','modele','annee','categorie','carburant','couleur','km','tarif','statut']];
 vehs.forEach(v=>rows.push([v.immat,v.marque,v.modele,v.annee,v.categorie||v.cat,v.carburant,v.couleur,v.km,v.tarif,v.statut]));
 downloadCSV(`vehicules_${today()}.csv`,rows);
}else if(type==='cl'){
 const rows=[['prenom','nom','tel','email','cin','permis','ville','nat','adresse']];
 cls.forEach(c=>{
 rows.push([c.prenom,c.nom,c.tel,c.email||'',c.cin||'',c.permis||'',c.ville||'',c.nat||'',c.adresse||'']);
});
 downloadCSV(`clients_${today()}.csv`,rows);
}else if(type==='res'){
 const rows=[['N° Contrat','Client','Véhicule','Immat','Départ','Retour','Jours','Total(MAD)','Payé(MAD)','Reste(MAD)','Caution(MAD)','Statut caution','Statut','Lieu','Notes']];
 res.forEach(r=>{
 const c=cls.find(x=>x.id===r.clientId);
 const v=vehs.find(x=>x.id===r.vehId);
 const days=(r.debut&&r.fin)? Math.max(1,Math.round((new Date(r.fin)-new Date(r.debut))/(1000*60*60*24))): 0;
 const paid=(r.paiements||[]).reduce((s,p)=>s+p.montant,0);
 const reste=Math.max(0,(r.total||0)-paid);
 rows.push([
 'CTR-'+(r.id||'').slice(-6).toUpperCase(),
 c ? c.prenom+' '+c.nom : '',
 v ? v.marque+' '+v.modele : '',
 v ? v.immat : '',
 fmt(r.debut),fmt(r.fin),days,
 r.total||0,paid,reste,
 r.caution||0,
 r.cautionStatut==='encaissee'?'Encaissée':r.cautionStatut==='restituee'?'Restituée':'En attente',
 r.statut,r.lieu||'',r.notes||''
]);
});
 downloadCSV(`reservations_${today()}.csv`,rows);
}else if(type==='maint'){
 const maints=load(KEYS.maint);
 const rows=[['Véhicule','Immat','Type','Date prévue','Km','Km seuil','Coût(MAD)','Statut','Notes']];
 maints.forEach(m=>{
 const v=vehs.find(x=>x.id===m.vehId);
 rows.push([v?v.marque+' '+v.modele:'',v?v.immat:'',m.type,fmt(m.date),m.km||'',m.kmSeuil||'',m.cout||0,m.statut,m.notes||'']);
});
 downloadCSV(`maintenance_${today()}.csv`,rows);
}
}
function today(){
 return new Date().toISOString().slice(0,10);
}
function exportExcel(){
 if(typeof XLSX==='undefined'){alAlert('Chargement en cours,réessayez dans 2 secondes…');return;}
 const vehs=load(KEYS.veh);
 const cls=load(KEYS.cl);
 const res=load(KEYS.res);
 const maints=load(KEYS.maint);
 const fmt=d=>d ? new Date(d).toLocaleDateString('fr-FR'): '';
 const wb=XLSX.utils.book_new();
 const vehRows=[['Immatriculation','Marque','Modèle','Année','Catégorie','Carburant','Couleur','Km','Tarif/Jour(MAD)','Statut']];
 vehs.forEach(v=>vehRows.push([v.immat,v.marque,v.modele,v.annee,v.cat,v.carburant,v.couleur,v.km,v.tarif,v.statut]));
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(vehRows),'Véhicules');
 const clRows=[['Prénom','Nom','Téléphone','Email','CIN/Passeport','Permis','Ville','Nationalité','Nb locations']];
 cls.forEach(c=>{
 const nb=res.filter(r=>r.clientId===c.id).length;
 clRows.push([c.prenom,c.nom,c.tel,c.email||'',c.cin||'',c.permis||'',c.ville||'',c.nat||'',nb]);
});
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(clRows),'Clients');
 const resRows=[['N° Contrat','Client','Véhicule','Immat','Départ','Retour','Jours','Total(MAD)','Payé(MAD)','Reste(MAD)','Caution(MAD)','Statut caution','Statut','Lieu','Notes']];
 res.forEach(r=>{
 const c=cls.find(x=>x.id===r.clientId);
 const v=vehs.find(x=>x.id===r.vehId);
 const days=(r.debut&&r.fin)? Math.max(1,Math.round((new Date(r.fin)-new Date(r.debut))/(1000*60*60*24))): 0;
 const paid=(r.paiements||[]).reduce((s,p)=>s+p.montant,0);
 const reste=Math.max(0,(r.total||0)-paid);
 resRows.push([
 'CTR-'+(r.id||'').slice(-6).toUpperCase(),
 c ? c.prenom+' '+c.nom : '',
 v ? v.marque+' '+v.modele : '',
 v ? v.immat : '',
 fmt(r.debut),fmt(r.fin),days,
 r.total||0,paid,reste,
 r.caution||0,
 r.cautionStatut==='encaissee'?'Encaissée':r.cautionStatut==='restituee'?'Restituée':'En attente',
 r.statut,r.lieu||'',r.notes||''
]);
});
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(resRows),'Réservations');
 const maintRows=[['Véhicule','Immat','Type','Date prévue','Km','Km seuil','Coût(MAD)','Statut','Notes']];
 maints.forEach(m=>{
 const v=vehs.find(x=>x.id===m.vehId);
 maintRows.push([v?v.marque+' '+v.modele:'',v?v.immat:'',m.type,fmt(m.date),m.km||'',m.kmSeuil||'',m.cout||0,m.statut,m.notes||'']);
});
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(maintRows),'Maintenance');
 XLSX.writeFile(wb,`AutoLocPro_${today()}.xlsx`);
 addLog('Export Excel complet généré');
}
const PHOTO_TABS={
 cl:[{key:'cin',label:'CIN / Passeport'},
{key:'permis',label:'Permis de conduire'},
{key:'autre',label:'Autres docs'}],
 veh:[{key:'avant',label:'État avant location'},
{key:'apres',label:'État après location'},
{key:'docs',label:'Documents véhicule'}]
};
let photosCtx={type: null,id: null};
function openPhotosModalFromBtn(btn){
  if(!btn)return;
  const type=btn.getAttribute('data-type')||'';
  const id=btn.getAttribute('data-id')||'';
  const title=btn.getAttribute('data-title')||'';
  return openPhotosModal(type,id,title);
}
function openPhotosModal(type,id,title){
 photosCtx={type,id};
 document.getElementById('photos-modal-title').textContent=`Photos — ${title}`;
 const warnEl=document.getElementById('photos-storage-warn');
 if(warnEl){
 if(OPFS._ready){
 warnEl.style.background='#ECFDF5';
 warnEl.style.borderColor='#A7F3D0';
 warnEl.style.color='#065F46';
 warnEl.innerHTML=`✓ Photos stockées dans OPFS — espace illimité`;
 warnEl.style.display='block';
}else{
 const usagePct=getStorageUsagePercent();
 if(usagePct>80){
 warnEl.innerHTML=`⚠️ Stockage navigateur à ${usagePct}% — utilisez Chrome ou Edge pour activer OPFS(illimité)`;
 warnEl.style.display='block';
}else{
 warnEl.style.display='none';
}
}
}
 renderPhotosTabs(0);
 document.getElementById('photos-modal').classList.add('open');
}
async function renderPhotosTabs(activeIdx){
 const tabs=PHOTO_TABS[photosCtx.type];
 const tabsEl=document.getElementById('photos-tabs');
 const panelsEl=document.getElementById('photos-panels');
 const counts=await Promise.all(tabs.map(t=>getPhotos(photosCtx.type,photosCtx.id,t.key).then(a=>a.length)));
 tabsEl.innerHTML=tabs.map((t,i)=>{
 const badge=counts[i]? `<span class="photo-count-badge">${counts[i]}</span>` : '';
 return `<button class="photo-tab ${i===activeIdx?'active':''}" onclick="renderPhotosTabs(${i})">${t.label}${badge}</button>`;
}).join('');
 const tab=tabs[activeIdx];
 const photos=await getPhotos(photosCtx.type,photosCtx.id,tab.key);
 panelsEl.innerHTML=`
<div class="photo-panel active"><div class="photo-drop-zone" onclick="document.getElementById('photo-file-input').click()" id="drop-zone"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>Cliquez pour ajouter une photo</p><small>JPG,PNG,WEBP — max 10 Mo par image</small></div><input type="file" id="photo-file-input" accept="image/*" multiple style="display:none" onchange="handlePhotoUpload(event,'${tab.key}')">
 ${photos.length ? `
<div class="photo-preview-grid">
 ${photos.map((p,i)=>`
<div class="photo-thumb"><img src="${p.data}" alt="${esc(p.name||tab.label)}" onclick="openLightbox('${photosCtx.type}','${photosCtx.id}','${tab.key}',${i})"><button class="photo-thumb-del" onclick="deletePhoto('${tab.key}',${i})">×</button><div class="photo-thumb-label">${esc(p.name||tab.label)}</div></div>`).join('')}
</div>` : '<p style="text-align:center;color:var(--text3);font-size:0.83rem;margin-top:16px">Aucune photo ajoutée</p>'}
</div>`;
 const dz=document.getElementById('drop-zone');
 if(dz){
 dz.addEventListener('dragover',e=>{e.preventDefault();dz.style.borderColor='var(--accent2)';});
 dz.addEventListener('dragleave',()=>{dz.style.borderColor='';});
 dz.addEventListener('drop',e=>{e.preventDefault();dz.style.borderColor='';handlePhotoFiles(e.dataTransfer.files,tab.key);});
}
 photosCtx.activeTab=activeIdx;
}
function handlePhotoUpload(event,tabKey){
 handlePhotoFiles(event.target.files,tabKey);
 event.target.value='';
}
function compressImage(dataUrl,maxPx,quality){
 return new Promise(resolve=>{
 const img=new Image();
 img.onload=()=>{
 let w=img.width,h=img.height;
 if(w>maxPx||h>maxPx){
 if(w>=h){h=Math.round(h * maxPx / w);w=maxPx;}
 else{w=Math.round(w * maxPx / h);h=maxPx;}
}
 const canvas=document.createElement('canvas');
 canvas.width=w;canvas.height=h;
 canvas.getContext('2d').drawImage(img,0,0,w,h);
 resolve(canvas.toDataURL('image/jpeg',quality||0.75));
};
 img.src=dataUrl;
});
}
function getStorageUsagePercent(){
 let total=0;
 for(let k in localStorage){
 if(localStorage.hasOwnProperty(k))total+=(localStorage[k].length+k.length)* 2;
}
 return Math.round(total /(5 * 1024 * 1024)* 100);
}
function handlePhotoFiles(files,tabKey){
 const arr=Array.from(files);
 if(!arr.length)return;
 if(!OPFS._ready){
 const usagePct=getStorageUsagePercent();
 if(usagePct>85){
 alAlert(`⚠️ Stockage navigateur utilisé à ${usagePct}%.\n\nUtilisez Chrome ou Edge pour activer OPFS et stocker les photos sans limite.`);
 return;
}
}
 let done=0;
 arr.forEach(async file=>{
 if(file.size>10 * 1024 * 1024){alAlert(`${file.name}dépasse 10 Mo — image trop volumineuse.`);done++;return;}
 try{
 const reader=new FileReader();
 reader.onload=async e=>{
 try{
 const compressed=await compressImage(e.target.result,900,0.75);
 const originalKb=Math.round(e.target.result.length * 0.75 / 1024);
 const compressedKb=Math.round(compressed.length * 0.75 / 1024);
 const photos=await getPhotos(photosCtx.type,photosCtx.id,tabKey);
 photos.push({
 data: compressed,
 name: file.name,
 date: new Date().toISOString().slice(0,10),
 sizeKb: compressedKb,
 originalKb
});
 await savePhotos(photosCtx.type,photosCtx.id,tabKey,photos);
}catch(err){
 console.error('Compression échouée:',err);
 const photos=await getPhotos(photosCtx.type,photosCtx.id,tabKey);
 photos.push({data: e.target.result,name: file.name,date: new Date().toISOString().slice(0,10)});
 await savePhotos(photosCtx.type,photosCtx.id,tabKey,photos);
}
 done++;
 if(done===arr.length)renderPhotosTabs(photosCtx.activeTab||0);
};
 reader.readAsDataURL(file);
}catch(err){done++;}
});
 addLog(`Photo ajoutée — ${arr.length}fichier${arr.length>1 ? 's' : ''}`);
}
function deletePhoto(tabKey,idx){
 alConfirm({
 icon: '🖼',danger: true,
 title: 'Supprimer cette photo ?',
 msg: 'La photo sera définitivement supprimée.',
 okLabel: 'Supprimer',
 onOk: async()=>{
 const photos=await getPhotos(photosCtx.type,photosCtx.id,tabKey);
 photos.splice(idx,1);
 await savePhotos(photosCtx.type,photosCtx.id,tabKey,photos);
 renderPhotosTabs(photosCtx.activeTab||0);
}
});
}
const _photoCache={};
async function getPhotos(type,id,tabKey){
 const cacheKey=`${type}_${id}_${tabKey}`;
 if(_photoCache[cacheKey]!==undefined)return _photoCache[cacheKey];
 const opfsPhotos=await OPFS.readPhotos(type,id,tabKey);
 if(opfsPhotos!==null){
 _photoCache[cacheKey]=opfsPhotos;
 return opfsPhotos;
}
 try{
 const store=JSON.parse(localStorage.getItem('autoloc_photos')||'{}');
 const arr=(store[type]?.[id]?.[tabKey])||[];
 if(arr.length){
 _photoCache[cacheKey]=arr;
 OPFS.writePhotos(type,id,tabKey,arr).catch(()=>{});
}
 return arr;
}catch(e){return[];}
}
async function savePhotos(type,id,tabKey,photos){
 const cacheKey=`${type}_${id}_${tabKey}`;
 _photoCache[cacheKey]=photos;
 const opfsOk=await OPFS.writePhotos(type,id,tabKey,photos);
 if(opfsOk){
 const warn=document.getElementById('storage-topbar-warn');
 if(warn)warn.style.display='none';
 return;
}
 try{
 let store;try{store=JSON.parse(localStorage.getItem('autoloc_photos')||'{}');}catch(e){store={};}
 if(!store[type])store[type]={};
 if(!store[type][id])store[type][id]={};
 store[type][id][tabKey]=photos;
 localStorage.setItem('autoloc_photos',JSON.stringify(store));
 const usagePct=getStorageUsagePercent();
 const warn=document.getElementById('storage-topbar-warn');
 if(warn)warn.style.display=usagePct>80 ? 'block' : 'none';
}catch(e){
 if(e.name==='QuotaExceededError'||e.code===22){
 alAlert('⚠️ Espace de stockage plein!\n\nOPFS non disponible sur ce navigateur. Utilisez Chrome ou Edge pour un stockage illimité.');
}
}
}
async function countPhotosAsync(type,id){
 let count=0;
 const prefix=`${type}_${id}_`;
 for(const k of Object.keys(_photoCache)){
 if(k.startsWith(prefix))count+=(_photoCache[k]||[]).length;
}
 if(count>0)return count;
 try{
 const store=JSON.parse(localStorage.getItem('autoloc_photos')||'{}');
 const entity=store[type]?.[id];
 if(!entity)return 0;
 return Object.values(entity).reduce((s,arr)=>s+arr.length,0);
}catch(e){return 0;}
}
function countPhotos(type,id){
 let count=0;
 const prefix=`${type}_${id}_`;
 for(const k of Object.keys(_photoCache)){
 if(k.startsWith(prefix))count+=(_photoCache[k]||[]).length;
}
 if(count>0)return count;
 try{
 const store=JSON.parse(localStorage.getItem('autoloc_photos')||'{}');
 const entity=store[type]?.[id];
 if(!entity)return 0;
 return Object.values(entity).reduce((s,arr)=>s+arr.length,0);
}catch(e){return 0;}
}
async function openLightbox(type,id,tabKey,idx){
 const photos=await getPhotos(type,id,tabKey);
 if(!photos[idx])return;
 document.getElementById('lightbox-img').src=photos[idx].data;
 document.getElementById('photo-lightbox').classList.add('open');
}
function closeLightbox(){
 document.getElementById('photo-lightbox').classList.remove('open');
 document.getElementById('lightbox-img').src='';
}
let searchActiveIdx=-1;
var _srchT=null;
function onGlobalSearch(e){
 const q=e.target.value.trim();
 document.getElementById('search-clear').style.display=q ? 'block' : 'none';
 if(!q){closeSearchDropdown();return;}
 if(q.length<2){closeSearchDropdown();return;}
 clearTimeout(_srchT);
 _srchT=setTimeout(function(){renderSearchResults(q);},180);
}
function onSearchKey(e){
 const dd=document.getElementById('search-dropdown');
 const items=dd.querySelectorAll('.search-item');
 if(e.key==='ArrowDown'){
 e.preventDefault();
 searchActiveIdx=Math.min(searchActiveIdx+1,items.length-1);
 items.forEach((el,i)=>el.classList.toggle('active',i===searchActiveIdx));
}else if(e.key==='ArrowUp'){
 e.preventDefault();
 searchActiveIdx=Math.max(searchActiveIdx-1,0);
 items.forEach((el,i)=>el.classList.toggle('active',i===searchActiveIdx));
}else if(e.key==='Enter'){
 if(searchActiveIdx>=0&&items[searchActiveIdx])items[searchActiveIdx].click();
}else if(e.key==='Escape'){
 clearSearch();
}
}
function clearSearch(){
 document.getElementById('global-search').value='';
 document.getElementById('search-clear').style.display='none';
 closeSearchDropdown();
}
function closeSearchDropdown(){
 const dd=document.getElementById('search-dropdown');
 dd.classList.remove('open');
 dd.innerHTML='';
 searchActiveIdx=-1;
}
function highlight(text,q){
 const safe=esc(String(text));
 if(!q)return safe;
 const safeQ=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp(`(${safeQ})`,'gi');
 return safe.replace(re,'<span class="search-highlight">$1</span>');
}
function renderSearchResults(q){
 const ql=q.toLowerCase();
 const vehs=load(KEYS.veh);
 const cls=load(KEYS.cl);
 const res=load(KEYS.res);
 const results=[];
 vehs.filter(v=>`${v.immat}${v.marque}${v.modele}${v.cat}${v.couleur}`.toLowerCase().includes(ql))
 .slice(0,4).forEach(v=>results.push({type:'veh',v,label:`${v.marque}${v.modele}`,sub:`${v.immat}· ${v.cat}· ${v.statut}`,action:()=>goToVeh(v.id)}));
 cls.filter(c=>`${c.prenom}${c.nom}${c.tel}${c.cin}${c.email}${c.ville}`.toLowerCase().includes(ql))
 .slice(0,4).forEach(c=>results.push({type:'cl',c,label:`${c.prenom}${c.nom}`,sub:`${c.tel}· ${c.cin||''}`,action:()=>goToClient(c.id)}));
 res.filter(r=>{
 const v=vehs.find(x=>x.id===r.vehId);
 const c=cls.find(x=>x.id===r.clientId);
 return `${c?c.prenom+' '+c.nom:''}${v?v.marque+' '+v.modele:''}${v?v.immat:''}${r.lieu||''}${r.statut}`.toLowerCase().includes(ql);
}).slice(0,4).forEach(r=>{
 const v=vehs.find(x=>x.id===r.vehId);
 const c=cls.find(x=>x.id===r.clientId);
 results.push({type:'res',r,label:`${c?c.prenom+' '+c.nom:'—'}— ${v?v.marque+' '+v.modele:'—'}`,sub:`${r.debut||''}→ ${r.fin||''}· ${r.statut}`,action:()=>goToRes(r.id)});
});
 const dd=document.getElementById('search-dropdown');
 if(!results.length){
 dd.innerHTML=`<div class="search-empty">Aucun résultat pour « ${esc(q)}»</div>`;
 dd.classList.add('open');
 return;
}
 const groups=[
{key:'veh',title:'Véhicules',color:'#EBF5FB',iconColor:'#2E86C1',badgeCls:'badge-info',
 icon:'<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'},
{key:'cl',title:'Clients',color:'#D5F5E3',iconColor:'#1E8449',badgeCls:'badge-success',
 icon:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
{key:'res',title:'Réservations',color:'#FEF9E7',iconColor:'#D68910',badgeCls:'badge-warning',
 icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'},
];
 let html='';
 groups.forEach(g=>{
 const items=results.filter(r=>r.type===g.key);
 if(!items.length)return;
 html+=`<div class="search-group-title">${g.title}</div>`;
 items.forEach((item,i)=>{
 const id=`sri-${g.key}-${i}`;
 html+=`<div class="search-item" id="${id}" onclick="(${item.action.toString()})();clearSearch()"><div class="search-item-icon" style="background:${g.color}"><svg fill="none" viewBox="0 0 24 24" stroke="${g.iconColor}" stroke-width="2">${g.icon}</svg></div><div class="search-item-info"><strong>${highlight(item.label,q)}</strong><span>${highlight(item.sub,q)}</span></div></div>`;
});
});
 dd.innerHTML=html;
 dd.classList.add('open');
 searchActiveIdx=-1;
}
function goToVeh(id){
 const link=document.querySelector('nav a[data-page="vehicules"]');
 if(link)navigate(link);
 setTimeout(()=>{
 const rows=document.querySelectorAll('#veh-tbody tr');
 rows.forEach(r=>r.style.background='');
 const vehs=load(KEYS.veh);
 const idx=vehs.findIndex(v=>v.id===id);
 if(idx>=0&&rows[idx]){
 rows[idx].style.background='#FEF9E7';
 rows[idx].scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>rows[idx].style.background='',2000);
}
},150);
}
function goToClient(id){
 const link=document.querySelector('nav a[data-page="clients"]');
 if(link)navigate(link);
 setTimeout(()=>{
 const rows=document.querySelectorAll('#client-tbody tr');
 rows.forEach(r=>r.style.background='');
 const cls=load(KEYS.cl);
 const idx=cls.findIndex(c=>c.id===id);
 if(idx>=0&&rows[idx]){
 rows[idx].style.background='#FEF9E7';
 rows[idx].scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>rows[idx].style.background='',2000);
}
},150);
}
function goToRes(id){
 const link=document.querySelector('nav a[data-page="reservations"]');
 if(link)navigate(link);
 setTimeout(()=>{
 const cards=document.querySelectorAll('#res-grid .rental-card');
 cards.forEach(c=>c.style.outline='');
 const res=load(KEYS.res);
 const idx=res.findIndex(r=>r.id===id);
 if(idx>=0&&cards[idx]){
 cards[idx].style.outline='2px solid var(--gold)';
 cards[idx].scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>cards[idx].style.outline='',2500);
}
},150);
}
document.addEventListener('click',e=>{
 if(!document.getElementById('search-wrap')?.contains(e.target))closeSearchDropdown();
});
const MOIS_RAPPORT=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function openRapportModal(){
 const moisSel=document.getElementById('rapport-mois');
 const annSel=document.getElementById('rapport-annee');
 const now=new Date();
 moisSel.innerHTML=MOIS_RAPPORT.map((m,i)=>`<option value="${i}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('');
 const years=new Set();
 load(KEYS.res).forEach(r=>{if(r.debut)years.add(new Date(r.debut).getFullYear());});
 years.add(now.getFullYear());
 annSel.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`).join('');
 document.getElementById('rapport-body').innerHTML='';
 document.getElementById('rapport-modal').classList.add('open');
 genererRapport();
}
function genererRapport(){
 const mois=parseInt(document.getElementById('rapport-mois').value);
 const an=parseInt(document.getElementById('rapport-annee').value);
 const res=load(KEYS.res);
 const vehs=load(KEYS.veh);
 const cls=load(KEYS.cl);
 const maints=load(KEYS.maint);
 const resMois=res.filter(r=>{
 if(!r.debut)return false;
 const d=new Date(r.debut);
 return d.getFullYear()===an&&d.getMonth()===mois;
});
 const terminees=resMois.filter(r=>r.statut==='terminée');
 const enCours=resMois.filter(r=>r.statut==='en cours');
 const annulees=resMois.filter(r=>r.statut==='annulée');
 const ca=terminees.reduce((s,r)=>s+(r.total||0),0);
 const caEncaisse=terminees.reduce((s,r)=>s+(r.paiements||[]).reduce((ss,p)=>ss+p.montant,0),0);
 const caImpaye=ca-caEncaisse;
 const nbJours=resMois.reduce((s,r)=>{
 if(!r.debut||!r.fin)return s;
 return s+Math.max(1,Math.round((new Date(r.fin)-new Date(r.debut))/(1000*60*60*24)));
},0);
 const clientsUniques=new Set(resMois.map(r=>r.clientId)).size;
 const daysInMonth=new Date(an,mois+1,0).getDate();
 const tauxOcc=vehs.length ? Math.min(100,Math.round(nbJours /(vehs.length * daysInMonth)* 100)): 0;
 const vehStats=vehs.map(v=>{
 const rV=resMois.filter(r=>r.vehId===v.id&&r.statut==='terminée');
 return{v,ca: rV.reduce((s,r)=>s+(r.total||0),0),nb: rV.length};
}).filter(x=>x.ca>0).sort((a,b)=>b.ca-a.ca);
 const maxCaVeh=vehStats[0]?.ca||1;
 const maintMois=maints.filter(m=>{
 if(!m.date)return false;
 const d=new Date(m.date);
 return d.getFullYear()===an&&d.getMonth()===mois;
});
 const coutMaint=maintMois.reduce((s,m)=>s+(m.cout||0),0);
 const clientStats=cls.map(c=>{
 const rC=resMois.filter(r=>r.clientId===c.id&&r.statut==='terminée');
 return{c,ca: rC.reduce((s,r)=>s+(r.total||0),0),nb: rC.length};
}).filter(x=>x.nb>0).sort((a,b)=>b.ca-a.ca).slice(0,5);
 const fmt=n=>n.toLocaleString('fr-FR');
 document.getElementById('rapport-body').innerHTML=`
<div style="text-align:center;margin-bottom:18px;"><p style="font-size:1rem;font-weight:700;color:var(--accent)">${esc(getSettings().nom||'INVOORENT')}— Rapport ${MOIS_RAPPORT[mois]}${an}</p><p style="font-size:0.75rem;color:var(--text3)">Généré le ${new Date().toLocaleDateString('fr-FR')}</p></div><div class="rapport-kpis"><div class="rapport-kpi"><strong>${fmt(ca)}MAD</strong><span>CA réalisé</span></div><div class="rapport-kpi"><strong>${resMois.length}</strong><span>Locations</span></div><div class="rapport-kpi"><strong>${tauxOcc}%</strong><span>Taux occupation</span></div><div class="rapport-kpi"><strong>${clientsUniques}</strong><span>Clients actifs</span></div></div><div class="rapport-section"><h4>Synthèse financière</h4><div class="rapport-row"><span>CA total(locations terminées)</span><strong>${fmt(ca)}MAD</strong></div><div class="rapport-row"><span>Montant encaissé</span><strong style="color:var(--success)">${fmt(caEncaisse)}MAD</strong></div><div class="rapport-row"><span>Reste à encaisser</span><strong style="color:${caImpaye>0?'var(--danger)':'var(--success)'}">${fmt(caImpaye)}MAD</strong></div><div class="rapport-row"><span>Coût maintenance</span><strong style="color:var(--warning)">${fmt(coutMaint)}MAD</strong></div><div class="rapport-row" style="border-top:2px solid var(--border);margin-top:4px;padding-top:8px"><span><strong>Marge nette estimée</strong></span><strong style="color:var(--accent);font-size:1rem">${fmt(caEncaisse-coutMaint)}MAD</strong></div></div><div class="rapport-section"><h4>Activité locations</h4><div class="rapport-row"><span>Locations en cours</span><strong>${enCours.length}</strong></div><div class="rapport-row"><span>Locations terminées</span><strong>${terminees.length}</strong></div><div class="rapport-row"><span>Locations annulées</span><strong>${annulees.length}</strong></div><div class="rapport-row"><span>Total jours loués</span><strong>${nbJours}jours</strong></div><div class="rapport-row"><span>Taux d'occupation flotte</span><strong>${tauxOcc}%(${vehs.length}véh. × ${daysInMonth}j)</strong></div><div class="rapport-row"><span>Interventions maintenance</span><strong>${maintMois.length}</strong></div></div>
 ${vehStats.length ? `
<div class="rapport-section"><h4>Rentabilité véhicules</h4>
 ${vehStats.map((x,i)=>`
<div class="rapport-top-veh"><div class="rapport-rank" style="background:${i===0?'#FEF9E7':i===1?'#F0EEE9':'#EBF5FB'};color:${i===0?'#854F0B':i===1?'#5A5A5A':'#185FA5'}">${i+1}</div><div style="min-width:140px;font-size:0.82rem"><strong>${esc(x.v?.marque)}${esc(x.v?.modele)}</strong><br><span style="color:var(--text3);font-size:0.7rem">${esc(x.v?.immat)}· ${x.nb}loc.</span></div><div class="rapport-bar-wrap"><div class="rapport-bar-track"><div class="rapport-bar-fill" style="width:${Math.round(x.ca/maxCaVeh*100)}%;background:${i===0?'#C9A84C':'#2E86C1'}"></div></div></div><strong style="font-size:0.85rem;white-space:nowrap">${fmt(x.ca)}MAD</strong></div>`).join('')}
</div>` : ''}
 ${clientStats.length ? `
<div class="rapport-section"><h4>Top clients</h4>
 ${clientStats.map((x,i)=>`
<div class="rapport-row"><span>${i+1}. ${esc(x.c?.prenom)}${esc(x.c?.nom)}<span style="color:var(--text3);font-size:0.72rem">(${x.nb}location${x.nb>1?'s':''})</span></span><strong>${fmt(x.ca)}MAD</strong></div>`).join('')}
</div>` : ''}
 ${resMois.length===0 ? `<div class="empty-state" style="padding:32px"><p>Aucune location ce mois-ci</p></div>` : ''}
 `;
 addLog(`Rapport ${MOIS_RAPPORT[mois]}${an}généré`);
}
let chartCA=null,chartOcc=null,chartVeh=null;
function renderCharts(){
 const res=load(KEYS.res);
 const vehs=load(KEYS.veh);
 const MOIS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
 const now=new Date();
 const caByMonth=Array(12).fill(0);
 const labels12=[];
 for(let i=11;i>=0;i--){
 const d=new Date(now.getFullYear(),now.getMonth()-i,1);
 labels12.push(MOIS[d.getMonth()]+(i===0 ? '' : d.getFullYear()!==now.getFullYear()? ' '+d.getFullYear().toString().slice(2): ''));
 res.filter(r=>r.statut==='terminée'&&r.debut).forEach(r=>{
 const rd=new Date(r.debut);
 if(rd.getFullYear()===d.getFullYear()&&rd.getMonth()===d.getMonth()){
 caByMonth[11-i]+=r.total||0;
}
});
}
 const ctxCA=document.getElementById('chart-ca');
 if(ctxCA){
 if(chartCA)chartCA.destroy();
 chartCA=new Chart(ctxCA,{
 type: 'bar',
 data:{
 labels: labels12,
 datasets:[{
 label: 'CA(MAD)',
 data: caByMonth,
 backgroundColor: '#2E86C1',
 borderRadius: 5,
 borderSkipped: false,
}]
},
 options:{
 responsive: true,maintainAspectRatio: false,
 plugins:{legend:{display: false}},
 scales:{
 x:{grid:{display: false},ticks:{font:{size: 11}}},
 y:{grid:{color: 'rgba(0,0,0,0.05)'},ticks:{font:{size: 11},callback: v=>v>=1000 ?(v/1000).toFixed(0)+'k' : v}}
}
}
});
}
 const occByMonth=Array(12).fill(0);
 const totalVehs=vehs.length||1;
 for(let i=11;i>=0;i--){
 const d=new Date(now.getFullYear(),now.getMonth()-i,1);
 const daysInMonth=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
 let joursLoues=0;
 res.filter(r=>r.statut!=='annulée'&&r.debut&&r.fin).forEach(r=>{
 const debut=new Date(r.debut),fin=new Date(r.fin);
 const mStart=new Date(d.getFullYear(),d.getMonth(),1);
 const mEnd=new Date(d.getFullYear(),d.getMonth()+1,0);
 const start=debut>mStart ? debut : mStart;
 const end=fin<mEnd ? fin : mEnd;
 const days=Math.max(0,Math.round((end-start)/(1000*60*60*24))+1);
 joursLoues+=days;
});
 occByMonth[11-i]=Math.min(100,Math.round(joursLoues /(totalVehs * daysInMonth)* 100));
}
 const ctxOcc=document.getElementById('chart-occupation');
 if(ctxOcc){
 if(chartOcc)chartOcc.destroy();
 chartOcc=new Chart(ctxOcc,{
 type: 'line',
 data:{
 labels: labels12,
 datasets:[{
 label: 'Taux occupation %',
 data: occByMonth,
 borderColor: '#1E8449',
 backgroundColor: 'rgba(30,132,73,0.08)',
 pointBackgroundColor: '#1E8449',
 pointRadius: 4,
 tension: 0.3,
 fill: true,
}]
},
 options:{
 responsive: true,maintainAspectRatio: false,
 plugins:{legend:{display: false}},
 scales:{
 x:{grid:{display: false},ticks:{font:{size: 11}}},
 y:{min: 0,max: 100,grid:{color: 'rgba(0,0,0,0.05)'},ticks:{font:{size: 11},callback: v=>v+'%'}}
}
}
});
}
 const vehCA=vehs.map(v=>{
 const ca=res.filter(r=>r.vehId===v.id&&r.statut==='terminée').reduce((s,r)=>s+(r.total||0),0);
 return{label: v.marque+' '+v.modele+'\n'+v.immat,ca};
}).sort((a,b)=>b.ca-a.ca);
 const wrapVeh=document.getElementById('chart-veh-wrap');
 const ctxVeh=document.getElementById('chart-veh');
 if(ctxVeh&&wrapVeh){
 const h=Math.max(120,vehCA.length * 42+40);
 wrapVeh.style.height=h+'px';
 if(chartVeh)chartVeh.destroy();
 chartVeh=new Chart(ctxVeh,{
 type: 'bar',
 data:{
 labels: vehCA.map(v=>v.label),
 datasets:[{
 label: 'CA(MAD)',
 data: vehCA.map(v=>v.ca),
 backgroundColor: vehCA.map((_,i)=>i===0 ? '#C9A84C' : '#2E86C1'),
 borderRadius: 5,
 borderSkipped: false,
}]
},
 options:{
 indexAxis: 'y',
 responsive: true,maintainAspectRatio: false,
 plugins:{legend:{display: false}},
 scales:{
 x:{grid:{color: 'rgba(0,0,0,0.05)'},ticks:{font:{size: 11},callback: v=>v>=1000 ?(v/1000).toFixed(0)+'k MAD' : v+' MAD'}},
 y:{grid:{display: false},ticks:{font:{size: 11}}}
}
}
});
}
}
const CONDITIONS_DEFAUT=`Le véhicule doit être restitué dans l'état dans lequel il a été remis au locataire.
Tout dommage causé au véhicule sera à la charge du locataire selon le contrat d'assurance en vigueur.
Le carburant est à la charge du locataire — le véhicule doit être restitué avec le même niveau.
En cas de panne ou d'accident,le locataire doit en informer immédiatement l'agence.
Le dépassement de la date de retour sans accord préalable entraîne une facturation supplémentaire.
L'utilisation du véhicule hors du territoire convenu est interdite sans autorisation écrite de l'agence.
La caution sera restituée intégralement après vérification du bon état du véhicule.`;
function getSettings(){
 return(()=>{try{return JSON.parse(localStorage.getItem(KEYS.settings)||'{}')}catch(e){return{}}})();
}
function renderStorageGauge(){
 const wrap=document.getElementById('storage-gauge-wrap');
 if(!wrap)return;
 if(OPFS._ready){
 wrap.innerHTML=`
<div style="display:flex;align-items:center;gap:14px;background:#ECFDF5;border:1.5px solid #A7F3D0;border-radius:10px;padding:16px 18px"><div style="width:36px;height:36px;border-radius:10px;background:#D1FAE5;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg fill="none" viewBox="0 0 24 24" stroke="#059669" stroke-width="2" style="width:18px;height:18px"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><p style="font-size:0.88rem;font-weight:700;color:#065F46;margin-bottom:2px">Stockage illimité actif</p><p style="font-size:0.78rem;color:#047857">OPFS — Origin Private File System. Vos données et photos n'ont aucune limite d'espace.</p></div></div>`;
 return;
}
 let total=0;
 const breakdown={};
 for(let k in localStorage){
 if(!localStorage.hasOwnProperty(k))continue;
 const bytes=(localStorage[k].length+k.length)* 2;
 total+=bytes;
 if(k.startsWith('autoloc_photos'))breakdown['Photos']=(breakdown['Photos']||0)+bytes;
 else if(k.startsWith('autoloc_veh'))breakdown['Véhicules']=(breakdown['Véhicules']||0)+bytes;
 else if(k.startsWith('autoloc_res'))breakdown['Réservations']=(breakdown['Réservations']||0)+bytes;
 else if(k.startsWith('autoloc_cl'))breakdown['Clients']=(breakdown['Clients']||0)+bytes;
 else if(k.startsWith('autoloc_maint'))breakdown['Maintenance']=(breakdown['Maintenance']||0)+bytes;
 else if(k.startsWith('autoloc_log'))breakdown['Journal']=(breakdown['Journal']||0)+bytes;
 else breakdown['Autre']=(breakdown['Autre']||0)+bytes;
}
 const maxBytes=5 * 1024 * 1024;
 const pct=Math.min(100,Math.round(total / maxBytes * 100));
 const totalKb=Math.round(total / 1024);
 const color=pct>80 ? '#EF4444' : pct>60 ? '#F59E0B' : '#10B981';
 const fmtKb=b=>b<1024 ? Math.round(b/1024)+'KB' :(b/1024/1024).toFixed(2)+'MB';
 const rows=Object.entries(breakdown)
 .sort((a,b)=>b[1]-a[1])
 .map(([k,v])=>{
 const p=Math.round(v/total*100)||0;
 return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0"><span style="font-size:0.78rem;color:var(--text2);width:110px;flex-shrink:0">${k}</span><div style="flex:1;height:5px;background:var(--surface3);border-radius:3px;overflow:hidden"><div style="height:100%;width:${p}%;background:${color};border-radius:3px;transition:width 0.4s"></div></div><span style="font-size:0.73rem;color:var(--text3);width:60px;text-align:right;flex-shrink:0">${fmtKb(v)}</span></div>`;
}).join('');
 wrap.innerHTML=`
<div style="background:#FEF9C3;border:1.5px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:0.8rem;color:#92400E">
 ⚠ OPFS non disponible — utilisez<strong>Chrome</strong>ou<strong>Edge</strong>pour un stockage illimité.
</div><div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:0.82rem;font-weight:600;color:var(--text)">${totalKb}KB utilisés sur ~5 120 KB</span><span style="font-size:0.78rem;font-weight:700;color:${color}">${pct}%</span></div><div style="height:8px;background:var(--surface3);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.6s var(--ease-out)"></div></div>
 ${pct>80 ? `<p style="font-size:0.75rem;color:#DC2626;margin-top:6px">⚠️ Stockage presque plein — passez à Chrome ou Edge pour activer OPFS</p>` : ''}
</div>
 ${rows.length ? `<div style="border-top:1px solid var(--border);padding-top:8px">${rows}</div>` : ''}`;
}
function renderParametres(){
 const s=getSettings();
 document.getElementById('p-nom').value=s.nom||'INVOORENT';
 document.getElementById('p-slogan').value=s.slogan||'Gérez, louez, développez';
 document.getElementById('p-tel').value=s.tel||'';
 document.getElementById('p-email').value=s.email||'';
 document.getElementById('p-adresse').value=s.adresse||'';
 document.getElementById('p-ville').value=s.ville||'Tanger,Maroc';
 document.getElementById('p-site').value=s.site||'';
 document.getElementById('p-patente').value=s.patente||'';
 document.getElementById('p-iban').value=s.iban||'';
 document.getElementById('p-conditions').value=s.conditions||CONDITIONS_DEFAUT;
}
function saveParametres(){
 const s={
 nom: document.getElementById('p-nom').value.trim(),
 slogan: document.getElementById('p-slogan').value.trim(),
 tel: document.getElementById('p-tel').value.trim(),
 email: document.getElementById('p-email').value.trim(),
 adresse: document.getElementById('p-adresse').value.trim(),
 ville: document.getElementById('p-ville').value.trim(),
 site: document.getElementById('p-site').value.trim(),
 patente: document.getElementById('p-patente').value.trim(),
 iban: document.getElementById('p-iban').value.trim(),
 conditions: document.getElementById('p-conditions').value,
};
 localStorage.setItem(KEYS.settings,JSON.stringify(s));
 OPFS.write(KEYS.settings,s).catch(()=>{});
 const brandH1=document.querySelector('.sidebar-brand h1');
 if(brandH1&&s.nom){
 const parts=s.nom.split(' ').filter(Boolean);
 brandH1.textContent='';
 if(parts.length>1){
  brandH1.appendChild(document.createTextNode(parts.slice(0,-1).join(' ')+' '));
  const span=document.createElement('span');
  span.textContent=parts[parts.length-1];
  brandH1.appendChild(span);
 }else{
  const span=document.createElement('span');
  span.textContent=s.nom;
  brandH1.appendChild(span);
 }
}
 const toast=document.getElementById('save-toast');
 toast.classList.add('show');
 setTimeout(()=>toast.classList.remove('show'),2500);
 addLog('Paramètres mis à jour');
}
function resetConditions(){
 alConfirm({
 icon: '📄',danger: false,
 title: 'Remettre les conditions par défaut ?',
 msg: 'Le texte actuel sera remplacé par les conditions générales d\'origine.',
 okLabel: 'Remettre par défaut',
 onOk:()=>{document.getElementById('p-conditions').value=CONDITIONS_DEFAUT;}
});
}
function guideScrollTo(id){
 const el=document.getElementById(id);
 if(el)el.scrollIntoView({behavior: 'smooth',block: 'start'});
}
function renderGuide(){
 const el=document.getElementById('guide-content');
 if(!el)return;
 el.innerHTML=guideHTML();
}
function guideHTML(){
 const t=(cls,txt)=>`<span class="gtag gtag-${cls}">${txt}</span>`;
 const tip=(type,icon,html)=>`<div class="guide-tip guide-tip-${type}"><span style="font-size:.95rem;flex-shrink:0">${icon}</span><p>${html}</p></div>`;
 const card=(title,items)=>{
 const body=Array.isArray(items)?`<ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p>${items}</p>`;
 return `<div class="guide-card"><div class="guide-card-title">${title}</div>${body}</div>`;
 };
 const cards=(...items)=>`<div class="guide-cards">${items.map(([t,l])=>card(t,l)).join('')}</div>`;
 const step=(n,title,desc)=>`<div class="guide-step"><div class="guide-step-num">${n}</div><div><strong>${title}</strong><span>${desc}</span></div></div>`;
 const steps=(...items)=>`<div class="guide-steps">${items.map(([n,t,d])=>step(n,t,d)).join('')}</div>`;
 const trow=(a,b)=>`<tr><td><strong>${a}</strong></td><td>${b}</td></tr>`;
 const tbl=rows=>`<div class="guide-table-wrap"><table><thead><tr><th>Champ / Indicateur</th><th>Description</th></tr></thead><tbody>${rows.map(([a,b])=>trow(a,b)).join('')}</tbody></table></div>`;
 const sec=(id,iconBg,iconStroke,iconPath,num,title,subtitle,body)=>`
<div class="guide-section" id="${id}"><div class="guide-section-header"><div class="guide-section-icon" style="background:${iconBg}"><svg fill="none" viewBox="0 0 24 24" stroke="${iconStroke}" stroke-width="2">${iconPath}</svg></div><div class="guide-section-title"><h3>${num}. ${title}</h3><p>${subtitle}</p></div></div>
 ${body}
</div><hr class="guide-divider">`;
 const parts=[];
 /* ── 1. TABLEAU DE BORD ─────────────────────────────── */
 parts.push(sec('g-dashboard','#EBF5FB','#2E86C1',
 '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 1,'Tableau de bord','Vue d\'ensemble de votre agence en temps réel',
 cards(
 ['4 indicateurs clés (KPIs)',['Véhicules total et disponibles','Nombre de clients enregistrés','Locations en cours et total général','Chiffre d\'affaires réalisé (locations terminées)']],
 ['3 graphiques dynamiques',['CA mensuel — barres sur les 12 derniers mois','Taux d\'occupation — courbe % sur 12 mois','Rentabilité par véhicule — comparaison de la flotte']],
 ['Alertes automatiques',[t('red','Rouge')+' Retards : retour dépassé',t('red','Rouge')+' Retours aujourd\'hui à traiter',t('orange','Orange')+' Retours dans les 48h à anticiper',t('red','Rouge')+' Impayés : réservations avec reste dû']],
 ['Activité récente & flotte',['8 dernières actions enregistrées dans le journal','Barres visuelles : disponibles / loués / maintenance','Accès rapide aux alertes de maintenance']]
 )+tip('info','💡','Le <strong>bandeau rouge</strong> en haut apparaît dès qu\'un retard est détecté. Cliquez sur le ✕ pour masquer temporairement.')+
 tip('info','🔄','Le tableau de bord se met à jour <strong>automatiquement</strong> chaque fois que vous revenez dessus ou effectuez une action.')
 ));
 /* ── 2. VÉHICULES ───────────────────────────────────── */
 parts.push(sec('g-vehicules','#EBF5FB','#2E86C1',
 '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
 2,'Véhicules','Gestion complète de votre flotte automobile',
 cards(
 ['Informations enregistrées',['Immatriculation (format libre, majuscules auto, unique par véhicule)','Marque, modèle, année de mise en circulation','Catégorie : Citadine, Berline, SUV, 4x4, Utilitaire, Luxe','Tarif journalier en MAD (sert au calcul automatique des réservations)','Couleur, carburant (Essence / Diesel / Hybride / Électrique)','Kilométrage actuel (mis à jour manuellement)']],
 ['Statuts du véhicule',[t('green','Disponible')+' — libre pour une nouvelle réservation',t('blue','Loué')+' — actuellement en location (changement automatique)',t('orange','Maintenance')+' — indisponible pour révision ou réparation','Le statut Loué est géré automatiquement par les réservations']],
 ['Actions disponibles',['📷 <strong>Photos</strong> — ajouter l\'état du véhicule avant/après location','📋 <strong>Historique</strong> — voir toutes les locations passées avec stats','🔧 <strong>Maintenance</strong> — planifier ou noter une intervention','✏️ <strong>Modifier</strong> — mettre à jour les informations','🗑️ <strong>Supprimer</strong> — impossible si une location est en cours']]
 )+
 steps(
 ['1','Ajouter un véhicule','Cliquez sur "+ Ajouter" en haut à droite. Remplissez au minimum l\'immatriculation, la marque et le modèle, puis enregistrez.'],
 ['2','Filtrer la flotte','Utilisez les boutons : '+t('gray','Tous')+' '+t('green','Disponibles')+' '+t('blue','Loués')+' '+t('orange','Maintenance')+' pour filtrer rapidement.'],
 ['3','Recherche rapide','Tapez une immatriculation ou une marque dans la barre de recherche en haut pour trouver un véhicule instantanément.'],
 ['4','Mettre à jour le kilométrage','Modifiez le véhicule après chaque retour pour garder un kilométrage précis dans vos contrats.']
 )+
 tip('warn','⚠️','<strong>Immatriculation unique :</strong> le système bloque l\'enregistrement si deux véhicules ont la même plaque.')+
 tip('info','📥','<strong>Import en masse :</strong> vous pouvez importer plusieurs véhicules à la fois via un fichier CSV (voir section Import).')
 ));
 /* ── 3. CLIENTS ─────────────────────────────────────── */
 parts.push(sec('g-clients','#D5F5E3','#1E8449',
 '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
 3,'Clients','Gestion du portefeuille clients de votre agence',
 cards(
 ['Fiche client complète',['Prénom et nom (obligatoires)','Téléphone : 8 à 15 chiffres, vérifié automatiquement','Email : format validé si renseigné','CIN ou numéro de passeport','Numéro de permis de conduire','Ville, nationalité, adresse complète','Nombre de locations affiché automatiquement']],
 ['Historique client',['Timeline complète de toutes ses locations','Chiffre d\'affaires total généré par ce client','Nombre de locations en cours','Détail par location : véhicule, dates, montant, statut, notes']]
 )+
 steps(
 ['1','Ajouter un client','Bouton "+ Ajouter". Minimum requis : prénom, nom, téléphone. Les autres champs enrichissent le contrat.'],
 ['2','Rechercher un client','Filtrage en temps réel par nom, prénom, téléphone ou numéro CIN depuis la barre de recherche.'],
 ['3','Consulter l\'historique','Cliquez sur "Historique" sur la fiche client pour voir toutes ses locations et son CA total.'],
 ['4','Supprimer un client','Protégé : impossible si une location est en cours. Une confirmation est demandée si un historique existe.']
 )+
 tip('info','🔍','<strong>Recherche rapide :</strong> la barre de recherche filtre en temps réel sur nom, prénom, téléphone et CIN.')+
 tip('info','📥','<strong>Import en masse :</strong> importez votre liste de clients existants via un fichier CSV (voir section Import).')
 ));
 /* ── 4. RÉSERVATIONS ────────────────────────────────── */
 parts.push(sec('g-reservations','#FEF9E7','#D68910',
 '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 4,'Réservations','Créer et gérer les locations de vos véhicules',
 cards(
 ['Informations d\'une réservation',['Client (sélection depuis votre liste)','Véhicule disponible (seuls les véhicules libres apparaissent)','Date de départ et date de retour prévue','Lieu de prise en charge','Montant total calculé automatiquement : jours × tarif','Notes internes (non imprimées sur le contrat)']],
 ['Statuts d\'une réservation',[t('blue','En cours')+' — location active, véhicule marqué Loué',t('green','Terminée')+' — clôturée, véhicule remis Disponible',t('red','Annulée')+' — annulée, véhicule remis Disponible']],
 ['Actions disponibles',['💳 <strong>Paiements</strong> — gérer les versements et la caution','📄 <strong>Contrat</strong> — générer et imprimer le contrat PDF','✏️ <strong>Modifier</strong> — changer les dates, lieu ou notes','✅ <strong>Clôturer</strong> — terminer la location','❌ <strong>Annuler</strong> — annuler sans supprimer l\'historique']]
 )+
 steps(
 ['1','Créer une réservation','Cliquez sur "+ Nouvelle réservation". Sélectionnez client, véhicule et dates. Le total est calculé automatiquement.'],
 ['2','Gérer les paiements','Bouton "Paiements" sur la carte. Ajoutez des versements (avance, solde), choisissez le mode et la date.'],
 ['3','Imprimer le contrat','Bouton "Contrat" → aperçu complet avec coordonnées agence, client, véhicule et conditions. Impression directe.'],
 ['4','Clôturer la location','Bouton "Clôturer" quand le véhicule est rendu. Le statut passe à Terminée, le véhicule redevient Disponible.']
 )+
 tip('info','💡','<strong>Modification sécurisée :</strong> changer les dates ou le véhicule conserve les paiements déjà enregistrés et la caution.')+
 tip('warn','⚠️','<strong>Conflits de dates :</strong> le système vous avertit si un véhicule est déjà réservé sur la période choisie.')
 ));
 /* ── 5. PAIEMENTS & CAUTION ─────────────────────────── */
 parts.push(sec('g-paiements','#F5EEF8','#8E44AD',
 '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
 5,'Paiements & Caution','Suivi des encaissements et de la caution par réservation',
 cards(
 ['Types de versement',['<strong>Avance</strong> — acompte versé au départ','<strong>Solde</strong> — paiement du reste à la restitution','<strong>Autre</strong> — complément ou paiement partiel','Chaque versement : montant, mode, date, note optionnelle']],
 ['Modes de paiement acceptés',['Espèces (cash)','Virement bancaire','Chèque']],
 ['Gestion de la caution',['Montant de caution configurable par réservation',t('orange','En attente')+' — caution reçue, non encore traitée',t('green','Encaissée')+' — caution conservée (dommages)',t('blue','Restituée')+' — caution rendue au client']],
 ['Tableau récapitulatif',['Montant total de la location','Total déjà encaissé (somme des versements)','<strong>Reste dû</strong> affiché en rouge si > 0','Indicateur impayé visible sur la carte réservation']]
 )+
 tip('info','💡','Le <strong>reste dû</strong> est calculé automatiquement : total − somme des versements. Il apparaît en rouge sur la carte si non soldé.')+
 tip('info','📊','Les impayés sont <strong>remontés automatiquement</strong> dans le tableau de bord sous forme d\'alertes.')
 ));
 /* ── 6. MAINTENANCE ─────────────────────────────────── */
 parts.push(sec('g-maintenance','#FDEDEC','#C0392B',
 '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
 6,'Maintenance','Suivi des entretiens et réparations de votre flotte',
 cards(
 ['Informations d\'une intervention',['Véhicule concerné','Date de l\'intervention','Type : Vidange, Pneus, Freins, Carrosserie, Révision, Autre','Description libre du travail effectué','Coût en MAD','Kilométrage au moment de l\'intervention','Prochain entretien prévu (date ou kilométrage)']],
 ['Alertes de maintenance',['🔴 <strong>En retard</strong> — date dépassée ou kilométrage atteint','🟠 <strong>Bientôt</strong> — échéance dans moins de 15 jours ou 500 km','🟢 <strong>OK</strong> — aucune intervention urgente prévue','Ces alertes remontent automatiquement dans le tableau de bord']]
 )+
 steps(
 ['1','Enregistrer une intervention','Bouton "+ Maintenance" ou depuis la fiche véhicule. Renseignez le type, la date, le coût et la description.'],
 ['2','Planifier le prochain entretien','Ajoutez la date ou le kilométrage du prochain entretien pour recevoir une alerte automatique.'],
 ['3','Suivre les coûts','Le rapport mensuel inclut le total des coûts de maintenance pour calculer la marge nette réelle.'],
 ['4','Filtrer par véhicule','Utilisez les filtres pour voir l\'historique de maintenance d\'un véhicule spécifique.']
 )+
 tip('info','💡','Les coûts de maintenance sont déduits du CA dans le <strong>rapport mensuel</strong> pour afficher la marge nette réelle.')+
 tip('warn','⚠️','Un véhicule en statut <strong>Maintenance</strong> n\'apparaît pas dans la liste de sélection lors d\'une nouvelle réservation.')
 ));
 /* ── 7. CALENDRIER ──────────────────────────────────── */
 parts.push(sec('g-calendrier','#E8F8F5','#1A9974',
 '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
 7,'Calendrier','Vision graphique des disponibilités et réservations',
 cards(
 ['Vue mensuelle',['Navigation mois par mois avec flèches gauche/droite','Chaque jour affiche les réservations actives','Code couleur : '+t('blue','En cours')+' '+t('green','Terminée')+' '+t('red','Annulée'),'Cliquer sur une réservation ouvre sa fiche complète']],
 ['Légende & navigation',['Bouton "Aujourd\'hui" pour revenir au mois courant','Le mois et l\'année sont affichés clairement','Jours passés légèrement grisés pour la lisibilité','Week-ends visuellement distincts des jours ouvrés']]
 )+
 tip('info','💡','Le calendrier est idéal pour vérifier <strong>d\'un coup d\'œil</strong> les disponibilités avant de créer une nouvelle réservation.')+
 tip('info','📱','Sur mobile, le calendrier s\'adapte automatiquement à la taille de l\'écran pour rester lisible.')
 ));
 /* ── 8. CONTRAT PDF ─────────────────────────────────── */
 parts.push(sec('g-contrat','#EBF5FB','#2874A6',
 '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
 8,'Contrat de location','Génération et impression du contrat officiel',
 cards(
 ['Contenu du contrat généré',['En-tête agence : nom, slogan, ville, téléphone, email, site, RC/Patente','Numéro de contrat unique (CTR-XXXXXX)','Bloc locataire : CIN, permis, téléphone, adresse, nationalité','Bloc véhicule : immatriculation, marque, modèle, année, kilométrage','Détails location : dates, durée, lieu de prise en charge','Récapitulatif paiements : versements, caution, reste dû','Conditions générales personnalisables','Zone signatures : locataire et agence']],
 ['Personnalisation dans Paramètres',['Nom et slogan de votre agence','Coordonnées : téléphone, email, site web','Ville et adresse','RC / Numéro de patente','Conditions générales : texte libre multi-lignes']]
 )+
 steps(
 ['1','Générer le contrat','Depuis une réservation, cliquez sur "Contrat". Un aperçu s\'affiche immédiatement.'],
 ['2','Imprimer ou sauvegarder en PDF','Bouton "Imprimer / PDF". Le navigateur ouvre sa fenêtre d\'impression. Choisissez "Enregistrer en PDF".'],
 ['3','Personnaliser vos informations','Allez dans Paramètres → section "Informations agence". Renseignez nom, coordonnées, conditions. Enregistrez.'],
 ['4','Mettre à jour les conditions','Section "Conditions générales" dans Paramètres. Chaque ligne devient une clause numérotée dans le contrat.']
 )+
 tip('info','💡','Le contrat utilise toujours les <strong>informations les plus récentes</strong> de vos paramètres agence.')+
 tip('warn','⚠️','Sur <strong>mobile</strong>, l\'impression dépend du navigateur. Chrome et Edge donnent les meilleurs résultats. Safari peut varier.')
 ));
 /* ── 9. RAPPORTS ────────────────────────────────────── */
 parts.push(sec('g-rapports','#F4ECF7','#7D3C98',
 '<path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
 9,'Rapports & Graphiques','Analyse financière et performance de votre agence',
 cards(
 ['Rapport mensuel',['Sélectionnez le mois et l\'année avec les flèches de navigation','CA réalisé (locations terminées uniquement)','CA encaissé vs reste à encaisser','Coût total de maintenance du mois','Marge nette estimée = CA encaissé − coûts maintenance','Taux d\'occupation de la flotte en pourcentage','Classement des véhicules par rentabilité (avec barre visuelle)','Top 5 clients du mois par CA généré']],
 ['3 graphiques dynamiques',['📊 <strong>CA mensuel</strong> — 12 mois glissants en barres bleues','📈 <strong>Taux d\'occupation</strong> — courbe verte en pourcentage','🚗 <strong>Rentabilité par véhicule</strong> — barres horizontales comparatives']],
 ['Export du rapport',['Bouton "Exporter" → fichier Excel (.xlsx) téléchargeable','Contient toutes les lignes de location du mois','Ouvrable dans Excel, LibreOffice ou Google Sheets']]
 )+
 tip('info','💡','Le <strong>taux d\'occupation</strong> est calculé sur le nombre de jours loués ÷ (nombre de véhicules × jours du mois).')+
 tip('info','📊','Les graphiques se mettent à jour <strong>automatiquement</strong> à chaque modification de vos données.')
 ));
 /* ── 10. RECHERCHE ──────────────────────────────────── */
 parts.push(sec('g-recherche','#FDFEFE','#717D7E',
 '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
 10,'Recherche globale','Retrouvez n\'importe quelle donnée en quelques frappes',
 cards(
 ['Portée de la recherche',['🚗 <strong>Véhicules</strong> — immatriculation, marque, modèle','👤 <strong>Clients</strong> — nom, prénom, téléphone, CIN','📋 <strong>Réservations</strong> — nom du client, immatriculation, statut','Résultats groupés par catégorie avec icône et badge']],
 ['Navigation dans les résultats',['Cliquer sur un résultat ouvre directement la section concernée','Le clic sur un véhicule va dans Véhicules et le met en évidence','Le clic sur un client va dans Clients','Le clic sur une réservation va dans Réservations']]
 )+
 steps(
 ['1','Accès','La barre de recherche est toujours visible dans la barre du haut (topbar).'],
 ['2','Saisir','Commencez à taper (minimum 2 caractères). Les résultats apparaissent instantanément.'],
 ['3','Clavier','Flèches ↑↓ pour naviguer, Entrée pour sélectionner, Échap pour fermer.'],
 ['4','Effacer','Cliquez sur le × à droite du champ pour vider la recherche.']
 )+
 tip('info','⚡','La recherche est optimisée avec un <strong>délai intelligent</strong> : elle attend que vous ayez fini de taper avant de filtrer.')
 ));
 /* ── 11. PHOTOS VÉHICULES ───────────────────────────── */
 parts.push(sec('g-photos','#FEF9E7','#D4A017',
 '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
 11,'Photos véhicules','Documenter l\'état de votre flotte avec des photos',
 cards(
 ['Organisation des photos',['6 onglets : Avant, Arrière, Côté gauche, Côté droit, Intérieur, Documents','Plusieurs photos par onglet possibles','Stockage local permanent (OPFS) — pas de cloud nécessaire','Les photos survivent aux redémarrages et rechargements']],
 ['Gestion des fichiers',['Formats acceptés : JPG, PNG, WEBP, HEIC','Cliquez sur une photo pour l\'agrandir (aperçu plein écran)','Bouton de suppression photo par photo','Taille recommandée : moins de 5 Mo par photo pour de meilleures performances']]
 )+
 steps(
 ['1','Accéder aux photos','Depuis la liste véhicules, cliquez sur "Photos" sur la fiche du véhicule.'],
 ['2','Ajouter une photo','Sélectionnez l\'onglet souhaité (Avant, Arrière…), puis cliquez sur la zone "+" ou glissez-déposez l\'image.'],
 ['3','Documenter avant/après','Bonne pratique : photographier le véhicule avant chaque départ et à chaque retour.'],
 ['4','Supprimer une photo','Survolez la photo et cliquez sur l\'icône poubelle rouge qui apparaît.']
 )+
 tip('info','💾','Les photos sont stockées sur votre appareil via <strong>OPFS</strong> (Origin Private File System) — espace illimité sur Chrome et Edge.')+
 tip('warn','⚠️','Sur <strong>iPhone/Safari</strong>, le stockage OPFS est limité. Les photos restent accessibles mais l\'espace est plus réduit. Préférez Chrome sur mobile.')
 ));
 /* ── 12. IMPORT CSV ─────────────────────────────────── */
 parts.push(sec('g-import','#E8F8F5','#1A9974',
 '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
 12,'Import en masse (CSV)','Importer des données depuis Excel ou un fichier CSV',
 cards(
 ['Données importables',['🚗 <strong>Véhicules</strong> — colonnes : immat*, marque*, modele*, annee, categorie, tarif, couleur, carburant, km, statut, notes','👤 <strong>Clients</strong> — colonnes : prenom*, nom*, tel*, email, cin, permis, ville, nationalite, adresse','📋 <strong>Réservations</strong> — colonnes : client_cin ou client_tel*, veh_immat*, debut*, fin*, total, lieu, statut, notes','* = colonne obligatoire']],
 ['Format accepté',['Fichier .csv avec séparateur virgule (,) ou point-virgule (;) — détection automatique','Première ligne = en-têtes de colonnes (noms en minuscules)','Encodage UTF-8 recommandé pour les accents','Export depuis Excel : "Enregistrer sous" → CSV UTF-8']]
 )+
 steps(
 ['1','Ouvrir l\'import','Paramètres → section "Import de données" → choisissez le type (Véhicules, Clients ou Réservations).'],
 ['2','Préparer votre fichier','Dans Excel : une ligne par enregistrement, première ligne = noms de colonnes en minuscules. Enregistrez en CSV.'],
 ['3','Choisir le fichier','Cliquez sur "Choisir un fichier CSV" et sélectionnez votre fichier. Un aperçu des 8 premières lignes s\'affiche.'],
 ['4','Vérifier et confirmer','Si des erreurs apparaissent (champs manquants), corrigez le CSV et rechargez. Cliquez "Importer" pour valider.']
 )+
 tip('info','💡','L\'import est <strong>additif</strong> : il ajoute les nouvelles données sans écraser les existantes. Idéal pour une migration depuis un ancien logiciel.')+
 tip('warn','⚠️','Vérifiez que les immatriculations (véhicules) et les CIN/tél (clients) sont <strong>uniques</strong> dans votre fichier avant d\'importer.')
 ));
 /* ── 13. PARAMÈTRES ─────────────────────────────────── */
 parts.push(sec('g-parametres','#F2F3F8','#454760',
 '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
 13,'Paramètres','Configurer et personnaliser INVOORENT',
 cards(
 ['Informations agence',['Nom de votre agence (apparaît dans les contrats et rapports)','Slogan affiché sur le contrat','Téléphone, email, site web','Adresse et ville','RC / Numéro de patente (affiché sur le contrat)','IBAN bancaire (pour les virements clients)']],
 ['Conditions générales',['Texte libre multi-lignes','Chaque ligne devient une clause numérotée dans le contrat','Conditions par défaut fournies, modifiables librement']],
 ['Stockage & données',['Jauge d\'utilisation du stockage local','Bouton de sauvegarde manuelle (export JSON)','Restauration depuis une sauvegarde précédente','Section import CSV (véhicules, clients, réservations)']],
 ['Synchronisation Supabase (optionnel)',['Configuration URL et clé API Supabase','Sync bidirectionnelle automatique toutes les 5 minutes','Push immédiat à chaque modification','Fonctionne en complément du stockage local (pas de remplacement)']]
 )+
 steps(
 ['1','Configurer votre agence','Renseignez nom, téléphone, ville et RC. Ces infos apparaissent sur tous vos contrats.'],
 ['2','Personnaliser les conditions','Modifiez les conditions générales selon les règles de votre agence. Enregistrez.'],
 ['3','Sauvegarder vos données','Cliquez "Exporter la sauvegarde" régulièrement. Un rappel automatique apparaît après 7 jours sans backup.'],
 ['4','Activer la sync Supabase','Si vous souhaitez accéder à vos données sur plusieurs appareils, créez un compte Supabase gratuit et entrez l\'URL + clé API.']
 )+
 tip('info','💡','Toutes vos données restent <strong>sur votre appareil</strong>. Supabase est une option de synchronisation, pas une obligation.')+
 tip('info','🔒','La sauvegarde JSON contient <strong>toutes vos données</strong> : véhicules, clients, réservations, paiements, maintenance. Conservez-la dans un endroit sûr.')
 ));
 /* ── 14. SAUVEGARDE & RESTAURATION ─────────────────── */
 parts.push(sec('g-export','#EBF5FB','#2E86C1',
 '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
 14,'Sauvegarde & Restauration','Protéger et récupérer toutes vos données',
 cards(
 ['Sauvegarde manuelle',['Paramètres → bouton "Exporter la sauvegarde"','Télécharge un fichier JSON horodaté sur votre ordinateur','Contient 100% de vos données : véhicules, clients, réservations, paiements, maintenance, paramètres agence','Fichier nommé : AutoLocPro_backup_AAAA-MM-JJ.json']],
 ['Rappel automatique',['Un bandeau orange apparaît si aucune sauvegarde depuis 7 jours','Bouton "Sauvegarder maintenant" dans le bandeau','Bouton "Plus tard" reporte l\'alerte de 24 heures','Le rappel disparaît automatiquement après une sauvegarde réussie']],
 ['Restauration',['Paramètres → bouton "Restaurer une sauvegarde"','Sélectionnez votre fichier JSON de sauvegarde','Une confirmation est demandée : les données actuelles seront remplacées','L\'application recharge automatiquement après restauration']]
 )+
 steps(
 ['1','Exporter régulièrement','Faites une sauvegarde au minimum chaque semaine, idéalement après chaque grosse journée de travail.'],
 ['2','Stocker en lieu sûr','Copiez le fichier JSON sur une clé USB, Google Drive, WhatsApp ou envoyez-le par email à vous-même.'],
 ['3','Restaurer si besoin','En cas de problème (changement d\'appareil, réinitialisation), ouvrez Paramètres → Restaurer et choisissez votre dernier fichier.'],
 ['4','Vérifier la restauration','Après restauration, vérifiez que vos véhicules, clients et réservations sont bien présents dans chaque section.']
 )+
 tip('warn','⚠️','La restauration <strong>remplace toutes les données actuelles</strong> par celles de la sauvegarde. Assurez-vous de choisir le bon fichier.')+
 tip('info','☁️','Si Supabase est configuré, vos données sont aussi synchronisées en temps réel. La sauvegarde JSON reste recommandée en complément.')
 ));
 /* ── 15. SÉCURITÉ & ACCÈS ───────────────────────────── */
 parts.push(sec('g-securite','#FDEDEC','#922B21',
 '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
 15,'Sécurité & Accès','Protéger l\'accès à votre interface',
 cards(
 ['Système d\'authentification',['Mot de passe protégé par hachage SHA-256 (non récupérable)','Protection brute-force : blocage temporaire après 5 tentatives échouées','Option "Se souvenir de moi" : session valide 30 jours','Déconnexion manuelle disponible en bas de la sidebar']],
 ['Récupération du mot de passe',['En cas d\'oubli, utilisez le lien "Mot de passe oublié ?" sur l\'écran de connexion','Entrez la clé maître fournie avec votre licence INVOORENT','Définissez un nouveau mot de passe (minimum 4 caractères)','La clé maître ne doit jamais être partagée']],
 ['Mode démonstration',['Accès 10 minutes sans mot de passe pour tester l\'interface','Données de démo isolées, aucun impact sur vos vraies données','Timer visible en bas de l\'écran avec progression','Fin automatique à l\'expiration, retour à l\'écran de connexion']]
 )+
 steps(
 ['1','Définir votre mot de passe','À la première ouverture : "Mot de passe oublié ?" → entrez la clé maître → créez votre mot de passe.'],
 ['2','Se connecter','Entrez votre mot de passe sur l\'écran d\'accueil. Cochez "Se souvenir de moi" pour éviter de ressaisir.'],
 ['3','Changer de mot de passe','Utilisez à nouveau "Mot de passe oublié ?" + clé maître pour en définir un nouveau.'],
 ['4','Se déconnecter','Cliquez sur "Déconnexion" en bas de la barre latérale gauche.']
 )+
 tip('warn','⚠️','Conservez votre <strong>clé maître</strong> dans un endroit sûr (email, coffre-fort numérique). C\'est le seul moyen de récupérer l\'accès en cas d\'oubli.')+
 tip('info','🔒','Le mot de passe est stocké sous forme de <strong>hash SHA-256</strong> sur votre appareil. Personne ne peut le lire, même avec un accès au fichier.')
 ));
 /* ── 16. INSTALLER L'APP (PWA) ──────────────────────── */
 parts.push(sec('g-pwa','#EBF5FB','#1A5276',
 '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
 16,'Installer INVOORENT','Utiliser l\'app comme une application native',
 cards(
 ['Avantages de l\'installation PWA',['Icône sur le bureau ou l\'écran d\'accueil du téléphone','Lancement en plein écran sans barre de navigation du navigateur','Fonctionne 100% hors ligne une fois installée','Pas de téléchargement sur un store — installation directe depuis le navigateur']],
 ['Compatibilité',['✅ <strong>Chrome (PC/Android)</strong> — installation complète avec icône et mode hors ligne','✅ <strong>Edge (PC)</strong> — identique à Chrome','✅ <strong>Safari (iPhone/iPad)</strong> — installation via bouton Partager','⚠️ <strong>Firefox</strong> — pas de support PWA natif, utilisation dans le navigateur uniquement']]
 )+
 steps(
 ['1','Sur Chrome / Edge (PC)','Une icône d\'installation apparaît dans la barre d\'adresse (⊕). Cliquez dessus → "Installer".'],
 ['2','Sur Android (Chrome)','Menu ⋮ en haut à droite → "Ajouter à l\'écran d\'accueil". L\'app apparaît comme une appli native.'],
 ['3','Sur iPhone / iPad (Safari)','Touchez le bouton Partager (⬆️) en bas → faites défiler → "Sur l\'écran d\'accueil" → "Ajouter".'],
 ['4','Accès hors ligne','Une fois installée, l\'app fonctionne même sans connexion internet. Toutes vos données restent accessibles.']
 )+
 tip('info','💡','L\'app propose automatiquement l\'installation avec une bannière en bas de l\'écran lors de la première utilisation.')+
 tip('info','🔄','Les mises à jour sont automatiques : quand vous accédez à l\'app avec une connexion, le nouveau fichier est mis en cache silencieusement.')
 ));
 /* ── 17. SYNCHRONISATION SUPABASE ───────────────────── */
 parts.push(sec('g-supabase','#E8F8F5','#0E6655',
 '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
 17,'Synchronisation Supabase','Accéder à vos données sur plusieurs appareils (optionnel)',
 cards(
 ['Principe de fonctionnement',['Vos données restent toujours en local (OPFS + localStorage) — la sync est un complément','À chaque modification (ajout, suppression, paiement), les données sont poussées vers Supabase instantanément','Pull automatique toutes les 5 minutes pour récupérer les changements d\'un autre appareil','Stratégie offline-first : l\'app fonctionne normalement même sans connexion']],
 ['Configuration requise (une seule fois)',['Créer un compte gratuit sur supabase.com','Créer un nouveau projet (gratuit jusqu\'à 500 MB)','Copier l\'URL du projet et la clé anon/public','Coller dans Paramètres → Synchronisation Supabase → Enregistrer']],
 ['Tables Supabase à créer',['Exécuter le script SQL fourni dans l\'éditeur SQL Supabase (1 fois)','4 tables : autoloc_vehicules, autoloc_clients, autoloc_reservations, autoloc_maintenances','Schéma simple : id (text), data (jsonb), deleted_at, updated_at']]
 )+
 steps(
 ['1','Créer le projet Supabase','Allez sur supabase.com → New Project. Notez l\'URL (https://xxx.supabase.co) et la clé API (anon/public).'],
 ['2','Créer les tables','Dans Supabase → SQL Editor, collez et exécutez le script SQL de création des 4 tables.'],
 ['3','Configurer dans l\'app','INVOORENT → Paramètres → Synchronisation → collez l\'URL et la clé → "Enregistrer et synchroniser".'],
 ['4','Vérifier la sync','Le badge en haut affiche "Synchronisé à HH:MM". Cliquez dessus pour forcer une sync manuelle.']
 )+
 tip('info','🆓','Supabase est <strong>gratuit</strong> pour un usage individuel (jusqu\'à 500 MB de données, largement suffisant pour une petite agence).')+
 tip('warn','⚠️','La synchronisation nécessite une <strong>connexion internet</strong>. En mode hors ligne, toutes les modifications sont sauvegardées localement et synchronisées automatiquement dès le retour du réseau.')
 ));
 /* ── CONTACT / SUPPORT ──────────────────────────────── */
 parts.push(`<div class="guide-section" id="g-support">
 <div class="guide-section-header">
 <div class="guide-section-icon" style="background:#D5F5E3">
 <svg fill="none" viewBox="0 0 24 24" stroke="#1E8449" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
 </div>
 <div class="guide-section-title"><h3>Support & Assistance</h3><p>Besoin d'aide ? Nous sommes là.</p></div>
 </div>
 ${tip('info','✅','<strong>INVOORENT</strong> est fourni avec une licence à vie. En cas de question ou de problème, contactez-nous via WhatsApp pour une assistance rapide.')}
 <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
 <a href="https://wa.me/" target="_blank" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none">
 <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
 Contacter le support
 </a>
 </div>
 </div>`);
 return parts.join('');
}
(function(){
 const LEGACY_MASTER_KEY='INVOO3388';
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
  return{
   v:1,
   kdf:'PBKDF2-SHA256',
   iter:MASTER_KEY_PBKDF2_ITER,
   salt:bytesToB64(salt),
   dk
  };
 }
 function getMasterKeyRecord(){
  try{
   const raw=localStorage.getItem(MASTER_KEY_PBKDF2_STORAGE);
   if(!raw)return null;
   const rec=JSON.parse(raw);
   if(!rec||!rec.salt||!rec.dk||!rec.iter)return null;
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
   return got===rec.dk;
  }catch(e){return false;}
 }
 async function ensureMasterKeyCredential(){
  const rec=getMasterKeyRecord();
  if(rec)return rec;
  let plain=null;
  try{plain=localStorage.getItem(MASTER_KEY_STORAGE);}catch(e){}
  if(!plain){
   plain=LEGACY_MASTER_KEY;
  }
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
 const DEMO_DURATION=10 * 60;
 const DEMO_KEY='autoloc_demoToken';
 const DEMO_SECRET='aL9#kP3!mQ7$rN2@';
 let demoTimer=null;
 async function hashPassword(str){
 const msgBuffer=new TextEncoder().encode(str);
 const hashBuffer=await crypto.subtle.digest('SHA-256',msgBuffer);
 return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
 async function hmacSign(data){
 const key=await crypto.subtle.importKey(
 'raw',new TextEncoder().encode(DEMO_SECRET),
{name: 'HMAC',hash: 'SHA-256'},false,['sign']
);
 const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data));
 return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
 async function hmacVerify(data,expected){return(await hmacSign(data))===expected;}
 async function createDemoToken(){
 const ts=Date.now();
 const sig=await hmacSign(String(ts));
 localStorage.setItem(DEMO_KEY,btoa(JSON.stringify({ts,sig})));
 return ts;
}
 async function readDemoToken(){
 try{
 const raw=localStorage.getItem(DEMO_KEY);
 if(!raw)return null;
 const{ts,sig}=JSON.parse(atob(raw));
 return(await hmacVerify(String(ts),sig))? ts : null;
}catch{return null;}
}
 async function getDemoSecondsLeft(){
 const startTs=await readDemoToken();
 if(!startTs)return 0;
 return Math.max(0,DEMO_DURATION-Math.floor((Date.now()-startTs)/ 1000));
}
 function getStoredHash(){return localStorage.getItem(LOGIN_PWD_KEY)||null;}
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
 const t=document.querySelector('#reset-panel-1 .reset-step-title');
 if(t)t.textContent='🚀 Bienvenue — Créez votre mot de passe';
 const s=document.querySelector('#reset-panel-1 .reset-step-sub');
  // On génère/stocker la clé maître pour permettre la création du mot de passe,
  // mais on NE l'affiche pas dans l'UI (évite toute fuite dans l'espace de connexion).
  getSetupMasterKey();
  if(s)s.textContent='Aucun mot de passe défini. Clé maître générée et stockée dans ce navigateur.';
 const back=document.getElementById('btn-cancel-reset-1');
 if(back)back.style.display='none';
}else{
 const back=document.getElementById('btn-cancel-reset-1');
 if(back)back.style.display='';
 showPanel('admin');
}
}
 function hideLogin(){
 document.getElementById('login-screen').classList.add('hidden');
 document.getElementById('sidebar').style.display='';
 document.getElementById('main').style.display='';
 try{
 const lastPage=sessionStorage.getItem('autoloc_current_page')||'dashboard';
 const navLink=document.querySelector(`nav a[data-page="${lastPage}"]`);
 if(navLink)navigate(navLink);
}catch(e){}
}
 function switchTab(mode){
 const adminBtn=document.getElementById('tab-admin');
 const demoBtn=document.getElementById('tab-demo');
 const demoPanel=document.getElementById('demo-panel');
 const loginBtn=document.getElementById('btn-login-submit');
 if(mode==='admin'){
 adminBtn.className='access-btn active';
 demoBtn.className='access-btn';
 demoPanel.classList.remove('show');
 loginBtn.className='btn-login';
 loginBtn.innerHTML='<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Accéder à l\'interface';
 showPanel('admin');
}else{
 demoBtn.className='access-btn demo-active';
 adminBtn.className='access-btn';
 demoPanel.classList.add('show');
 showPanel('admin');
 loginBtn.className='btn-login demo-mode';
 loginBtn.innerHTML='<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Démarrer la démo(10 min)';
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
 errEl.innerHTML=`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${locked}`;
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
 const inputHash=await hashPassword(pass);
 if(inputHash===storedHash){
 bfReset('login');
 const remember=document.getElementById('remember-me')?.checked||false;
 saveSession(remember);
 hideLogin();
}else{
 bfFail('login');
 const locked2=bfCheck('login');
 const errEl=document.getElementById('login-error');
 errEl.innerHTML=`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${locked2||'Mot de passe incorrect. Veuillez réessayer.'}`;
 errEl.classList.add('show');
 document.getElementById('login-password').focus();
 document.getElementById('login-password').select();
}
}
 async function verifyMasterKey(){
 const val=document.getElementById('reset-master-key').value.trim();
 const errEl=document.getElementById('reset-error-1');
 if(!val){errEl.classList.add('show');return;}
 const locked=bfCheck('master');
 if(locked){
 errEl.querySelector ?(errEl.textContent=locked): null;
 errEl.classList.add('show');
 return;
}
 const rec=await ensureMasterKeyCredential();
 const expectedOk=await verifyMasterKeyRecord(val,rec);
 if(!expectedOk){
  bfFail('master');
  const locked2=bfCheck('master');
  errEl.classList.add('show');
  document.getElementById('reset-master-key').value='';
  document.getElementById('reset-master-key').focus();
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
 if(pwd1.length<4){
 errMsg.textContent='Minimum 4 caractères requis.';
 errEl.classList.add('show');return;
}
 if(pwd1!==pwd2){
 errMsg.textContent='Les mots de passe ne correspondent pas.';
 errEl.classList.add('show');return;
}
 const hash=await hashPassword(pwd1);
 localStorage.setItem(LOGIN_PWD_KEY,hash);
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
 document.getElementById('reset-master-key').value='';
 document.getElementById('reset-new-pwd').value='';
 document.getElementById('reset-confirm-pwd').value='';
}
 window.addEventListener('DOMContentLoaded',function(){
 showLogin();
 document.getElementById('tab-admin').addEventListener('click',function(){switchTab('admin');});
 document.getElementById('tab-demo').addEventListener('click',function(){switchTab('demo');});
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
 document.getElementById('reset-master-key').value='';
 setTimeout(()=>document.getElementById('reset-master-key').focus(),80);
});
 document.getElementById('btn-verify-master').addEventListener('click',verifyMasterKey);
 document.getElementById('reset-master-key').addEventListener('keydown',function(e){if(e.key==='Enter')verifyMasterKey();});
 document.getElementById('btn-save-new-pwd').addEventListener('click',saveNewPassword);
 document.getElementById('reset-new-pwd').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('reset-confirm-pwd').focus();});
 document.getElementById('reset-confirm-pwd').addEventListener('keydown',function(e){if(e.key==='Enter')saveNewPassword();});
 document.getElementById('btn-cancel-reset-1').addEventListener('click',function(){showPanel('admin');});
 document.getElementById('btn-cancel-reset-2').addEventListener('click',function(){showPanel('admin');});
 document.getElementById('demo-end-btn').addEventListener('click',function(){endDemo(false);});
 document.getElementById('btn-back-login').addEventListener('click',backToLogin);
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
 banner.innerHTML=`
<div style="flex:1;font-size:0.82rem;color:${textColor};line-height:1.5">${titre}— ${message}</div><button onclick="document.getElementById('${id}').remove()" style="
 background:none;border:none;cursor:pointer;color:${textColor};opacity:0.6;
 font-size:1.1rem;padding:2px 6px;flex-shrink:0;line-height:1;
 " title="Fermer">×</button>
 `;
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
 a.download=`AutoLocPro_backup_${today()}.json`;
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
 if(!backup.data)throw new Error('Format invalide');
 const structureErrors=[];
 if(!Array.isArray(backup.data.veh))structureErrors.push('data.veh doit être un Array');
 if(!Array.isArray(backup.data.cl))structureErrors.push('data.cl doit être un Array');
 if(!Array.isArray(backup.data.res))structureErrors.push('data.res doit être un Array');
 if(structureErrors.length){
  console.error('Import backup rejeté: structure invalide',structureErrors);
  throw new Error('Structure invalide: '+structureErrors.join(' | '));
 }
 const dateBackup=new Date(backup.date).toLocaleDateString('fr-FR');
const doRestore=async()=>{
 const d=backup.data;
 const normalized={
  [KEYS.veh]: Array.isArray(d.veh)? d.veh : [],
  [KEYS.cl]: Array.isArray(d.cl)? d.cl : [],
  [KEYS.res]: Array.isArray(d.res)? d.res : [],
  [KEYS.log]: Array.isArray(d.log)? d.log : [],
  [KEYS.maint]: Array.isArray(d.maint)? d.maint : [],
  [KEYS.settings]: (d.settings&&typeof d.settings==='object') ? d.settings : {},
  _restoredAt: Date.now(),
  photos: (d.photos&&typeof d.photos==='object') ? d.photos : {}
 };
 if(OPFS._ready){
  const ok=await OPFS.importAll(normalized);
  if(!ok)throw new Error('Restauration OPFS impossible');
  await _syncCacheFromOPFS();
  localStorage.removeItem('autoloc_photos');
 }else{
  if(d.veh)localStorage.setItem(KEYS.veh,JSON.stringify(normalized[KEYS.veh]));
  if(d.cl)localStorage.setItem(KEYS.cl,JSON.stringify(normalized[KEYS.cl]));
  if(d.res)localStorage.setItem(KEYS.res,JSON.stringify(normalized[KEYS.res]));
  if(d.log)localStorage.setItem(KEYS.log,JSON.stringify(normalized[KEYS.log]));
  if(d.maint)localStorage.setItem(KEYS.maint,JSON.stringify(normalized[KEYS.maint]));
  localStorage.setItem(KEYS.settings,JSON.stringify(normalized[KEYS.settings]));
  localStorage.setItem('autoloc_photos',JSON.stringify(normalized.photos));
 }
 invalidateCache();
 localStorage.setItem(SEED_KEY,'1');
 showBackupStatus('✓ Données restaurées — rechargement…','#059669');
 setTimeout(()=>location.reload(),1500);
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
document.getElementById('top-date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
(async function initApp(){
 await OPFS.init();
 await OPFS.migrateFromLocalStorage();
 await _syncCacheFromOPFS();
 seedData();
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
 'Votre navigateur ne supporte pas OPFS. Vos données sont limitées à 5 MB et peuvent être perdues si vous videz le cache. Utilisez<strong>Chrome</strong>ou<strong>Edge</strong>pour un stockage illimité.',
 '#92400E','#FEF9C3','#FDE68A'
);
}
 const machineWarnKey='autoloc_machine_warned';
 if(opfsOk&&!localStorage.getItem(machineWarnKey)){
 localStorage.setItem(machineWarnKey,'1');
 _showBannerWarning(
 'machine-change-banner',
 '💾 Important — sauvegarde portable',
 'Vos données sont stockées dans ce navigateur uniquement. Si vous changez d\'ordinateur ou de navigateur,exportez une sauvegarde JSON depuis<strong>Paramètres → Sauvegarde&Export</strong>.',
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
  if(id==='res-debut'||id==='res-fin'||id==='res-veh')updateResTotal();
 });
 // Flush best-effort when app is backgrounded/closed.
 // beforeunload alone is not reliable for async writes on all browsers.
 const flushOnExit=()=>{OPFS.flushNow().catch(()=>{});};
 window.addEventListener('beforeunload',flushOnExit);
 window.addEventListener('pagehide',flushOnExit);
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')flushOnExit();
 });
})();
