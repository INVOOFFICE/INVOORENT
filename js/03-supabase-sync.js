(function(){
 'use strict';
 const CFG_KEY='autoloc_supa_config';
 const SYNC_INTERVAL=5 * 60 * 1000;
 const TABLE_MAP={
 'autoloc_veh': 'autoloc_vehicules',
 'autoloc_cl': 'autoloc_clients',
 'autoloc_res': 'autoloc_reservations',
 'autoloc_maint': 'autoloc_maintenances'
};
const SHARED_SYNC_KEYS=(Array.isArray(window.AUTOLOC_SYNC_KEYS)&&window.AUTOLOC_SYNC_KEYS.length)
?window.AUTOLOC_SYNC_KEYS
:Object.keys(TABLE_MAP);
 let _timer=null;
 let _pulling=false;
 function getCfg(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}');}catch(e){return{};}}
 function setCfg(o){localStorage.setItem(CFG_KEY,JSON.stringify(o));}
 function isReady(){const c=getCfg();return!!(c.url&&c.key);}
 function isAutoEnabled(){return getCfg().autoSync!==false;}
 function setStatus(msg,color){
 const el=document.getElementById('supa-sync-status');
 if(el){el.textContent=msg;el.style.color=color||'var(--text3)';}
 const tb=document.getElementById('supa-topbar-badge');
 if(tb){tb.textContent='⟳ '+msg;tb.style.color=color||'#8E90A6';}
}
 function renderToggle(on){
 const btn=document.getElementById('supa-toggle-btn');
 const knob=document.getElementById('supa-toggle-knob');
 const lbl=document.getElementById('supa-toggle-label');
 if(btn)btn.style.background=on ? '#059669' : 'var(--surface3)';
 if(knob)knob.style.transform=on ? 'translateX(18px)' : 'translateX(0)';
 if(lbl){lbl.textContent=on ? 'Sync auto activée' : 'Désactivé';lbl.style.color=on ? '#059669' : 'var(--text3)';}
}
 function hdrs(extra){
 const c=getCfg();
 return Object.assign({'Content-Type':'application/json','apikey':c.key,'Authorization':'Bearer '+c.key},extra||{});
}
 async function supaUpsert(table,row){
 const c=getCfg();
 const r=await fetch(c.url+'/rest/v1/'+table,{
 method: 'POST',
 headers: hdrs({'Prefer': 'resolution=merge-duplicates,return=minimal'}),
 body: JSON.stringify(row)
});
 if(!r.ok){
 let msg='Supabase upsert '+table+' '+r.status;
 try{const d=await r.json();if(d.message)msg+=' — '+d.message;}catch(e){}
 throw new Error(msg);
}
}
 async function supaDelete(table,id){
 const c=getCfg();
 const r=await fetch(c.url+'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id),{
 method: 'PATCH',
 headers: hdrs({'Prefer': 'return=minimal'}),
 body: JSON.stringify({deleted_at: new Date().toISOString(),updated_at: new Date().toISOString()})
});
 if(!r.ok){
 let msg='Supabase delete '+table+' '+r.status;
 try{const d=await r.json();if(d.message)msg+=' — '+d.message;}catch(e){}
 throw new Error(msg);
}
}
 async function supaPull(table){
 const c=getCfg();
 const r=await fetch(c.url+'/rest/v1/'+table+'?select=id,data,deleted_at,updated_at&order=updated_at.asc',{
 headers: hdrs()
});
 if(!r.ok)throw new Error('Supabase pull '+table+' '+r.status);
 return await r.json();
}
 async function syncKey(localKey,table){
 const remoteRows=await supaPull(table);
 const remoteMap={};
 remoteRows.forEach(r=>{remoteMap[r.id]=r;});
 let localArr=[];
 try{
 localArr=(typeof _memCache!=='undefined'&&_memCache[localKey]!==undefined)
 ? _memCache[localKey]
 : JSON.parse(localStorage.getItem(localKey)||'[]');
 if(!Array.isArray(localArr))localArr=[];
}catch(e){localArr=[];}
 const localMap={};
 localArr.forEach(x=>{if(x&&x.id)localMap[x.id]=x;});
 const allIds=new Set([...Object.keys(localMap),...Object.keys(remoteMap)]);
 const upsertQueue=[];
 const merged=[];
 allIds.forEach(id=>{
 const loc=localMap[id];
 const rem=remoteMap[id];
 if(!rem){
 merged.push(loc);
 upsertQueue.push({
 id,
 data: loc,
 deleted_at: loc._deleted ? new Date().toISOString(): null,
 updated_at: loc.updatedAt||loc.createdAt||new Date().toISOString()
});
 return;
}
 if(!loc){
 const item=Object.assign({},rem.data,{id});
 if(rem.deleted_at)item._deleted=true;
 merged.push(item);
 return;
}
 const ld=new Date(loc.updatedAt||loc.createdAt||0);
 const rd=new Date(rem.updated_at||0);
 if(rd>=ld){
 const item=Object.assign({},rem.data,{id});
 if(rem.deleted_at)item._deleted=true;
 merged.push(item);
}else{
 merged.push(loc);
 upsertQueue.push({
 id,
 data: loc,
 deleted_at: loc._deleted ? new Date().toISOString(): null,
 updated_at: loc.updatedAt||loc.createdAt||new Date().toISOString()
});
}
});
 if(typeof _memCache!=='undefined')_memCache[localKey]=merged;
 try{localStorage.setItem(localKey,JSON.stringify(merged));}catch(e){}
 if(typeof OPFS!=='undefined'&&OPFS._ready)OPFS.write(localKey,merged).catch(()=>{});
 for(const row of upsertQueue){
 await supaUpsert(table,row);
}
}
 async function pullAll(silent){
 if(_pulling||!isReady())return;
 _pulling=true;
 if(!silent)setStatus('Synchronisation en cours…','#059669');
 try{
 for(const localKey of SHARED_SYNC_KEYS){
 const table=TABLE_MAP[localKey];
 if(!table)continue;
 await syncKey(localKey,table);
}
 const hm=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
 setStatus('Synchronisé à '+hm,'#059669');
['renderDashboard','renderVehicules','renderClients','renderReservations','renderMaintenance'].forEach(fn=>{
 if(typeof window[fn]==='function')try{window[fn]();}catch(e){}
});
}catch(e){
 setStatus('Erreur : '+e.message,'#EF4444');
 console.warn('[AutoLoc Supabase v3]',e.message);
}finally{_pulling=false;}
}
 async function pushRecord(localKey,item){
 if(!isReady())return;
 const table=TABLE_MAP[localKey];
 if(!table||!item||!item.id)return;
 try{
 await supaUpsert(table,{
 id: item.id,
 data: item,
 deleted_at: item._deleted ? new Date().toISOString(): null,
 updated_at: item.updatedAt||item.createdAt||new Date().toISOString()
});
}catch(e){
 console.warn('[AutoLoc Supabase v3]pushRecord:',e.message);
 setStatus('Erreur sync: '+e.message,'#EF4444');
}
}
 const _originalSave=window._autolocSavePatched ? null :(typeof save!=='undefined' ? save : null);
 if(_originalSave&&!window._autolocSavePatched){
 window._autolocSavePatched=true;
 window._originalSave=_originalSave;
 window._autolocSaveHook=function(localKey,arr){
 if(!isReady())return;
 if(!SHARED_SYNC_KEYS.includes(localKey))return;
 if(!Array.isArray(arr))return;
 arr.forEach(item=>{
 if(item&&item.id)pushRecord(localKey,item).catch(()=>{});
});
};
}
 function startAuto(){
 if(_timer)clearInterval(_timer);
 if(!isAutoEnabled())return;
 _timer=setInterval(()=>pullAll(true),SYNC_INTERVAL);
 window.addEventListener('online',()=>{if(isReady()&&isAutoEnabled())pullAll(false);});
}
 function stopAuto(){if(_timer){clearInterval(_timer);_timer=null;}}
 function injectTopBadge(){
 const tb=document.querySelector('.topbar-right,.topbar,header');
 if(!tb||document.getElementById('supa-topbar-badge'))return;
 const b=document.createElement('span');
 b.id='supa-topbar-badge';
 b.title='Cliquer pour synchroniser';
 b.style.cssText='font-size:11px;opacity:0.55;cursor:pointer;padding:2px 8px;border-radius:5px;margin-left:8px';
 b.onclick=()=>pullAll(false);
 tb.appendChild(b);
}
 window.AutoLocSync={
 syncNow:()=>pullAll(false),
 push: pushRecord,
 toggleAuto: function(){
 const cfg=getCfg();
 const on=!(cfg.autoSync!==false);
 setCfg(Object.assign({},cfg,{autoSync:on}));
 renderToggle(on);
 if(on){if(isReady()){pullAll(false);startAuto();}}
 else{stopAuto();setStatus('Sync auto désactivée','#8E90A6');}
},
 saveConfig: async function(){
 const url=(document.getElementById('supa-url-input')?.value||'').trim().replace(/\/$/,'');
 const key=(document.getElementById('supa-key-input')?.value||'').trim();
 if(!url||!key){setStatus('URL et clé API requis.','#EF4444');return;}
 if(!url.includes('supabase.co')){setStatus('URL invalide — doit contenir supabase.co','#EF4444');return;}
 setStatus('Connexion en cours…','#059669');
 setCfg({url,key,autoSync:true});
 try{
 await pullAll(false);
 startAuto();
 renderToggle(true);
 setStatus('Connecté à Supabase','#059669');
}catch(e){
 setStatus('Erreur : '+e.message,'#EF4444');
}
},
 disconnect: function(){
 setCfg({});
 stopAuto();
 renderToggle(false);
 setStatus('Déconnecté','#8E90A6');
}
};
 window.addEventListener('load',function(){
 injectTopBadge();
 const cfg=getCfg();
 setTimeout(function(){
 if(cfg.url){const el=document.getElementById('supa-url-input');if(el)el.value=cfg.url;}
 if(cfg.key){const el=document.getElementById('supa-key-input');if(el)el.value=cfg.key;}
 renderToggle(isReady()&&isAutoEnabled());
},800);
 if(isReady()&&isAutoEnabled()){
 setStatus('Chargement…','#059669');
 setTimeout(()=>pullAll(false).then(()=>startAuto()),1500);
}else{
 setStatus(isReady()?'Sync auto désactivée':'Non configuré','#8E90A6');
}
});
})();
