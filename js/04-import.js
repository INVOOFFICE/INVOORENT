(function(){
 function normImportHeader(k){
  return String(k||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
 }
 /** En-têtes CSV (libellés + anciens slugs) → clés canoniques internes. */
 const VEH_HEADER_MAP={
  immatriculation: 'immat',immat: 'immat',
  marque: 'marque',
  modele: 'modele',
  annee: 'annee',
  categorie: 'cat',cat: 'cat',
  carburant: 'carburant',
  couleur: 'couleur',
  kilometrage: 'km',km: 'km',
  'tarif / jour (mad)': 'tarif','tarif/jour(mad)': 'tarif',tarif: 'tarif',
  statut: 'statut',
  'assurance expire le': 'assurance',assurance: 'assurance',
  'vignette expire le': 'vignette',vignette: 'vignette',
  'visite technique le': 'visite',visite: 'visite',
  'assistance (echeance le)': 'assistance',assistance: 'assistance',
  notes: 'notes'
 };
 function mapVehImportRow(raw){
  const out={};
  Object.keys(raw).forEach(function(k){
   const nk=normImportHeader(k);
   const canon=VEH_HEADER_MAP[nk];
   if(!canon)return;
   const v=raw[k];
   if(v!==undefined&&v!==null&&String(v).trim()!==''){
    if(out[canon]===undefined||String(out[canon]).trim()==='')out[canon]=v;
   }
  });
  return out;
 }
 const IMPORT_CONFIG={
 veh:{
 title: 'Import en masse — Véhicules',
 instructions: 'Importez plusieurs véhicules via un fichier CSV (virgule ou point-virgule). La première ligne doit reprendre exactement les en-têtes du modèle : Immatriculation, Marque, Modèle, etc. Obligatoires : Immatriculation, Marque, Modèle. Dates documents au format AAAA-MM-JJ (ex. 2026-06-15). Statut : disponible, loué ou maintenance.',
 columns:[
{key: 'immat',csvHeader: 'Immatriculation',label: 'Immatriculation *',required: true},
{key: 'marque',csvHeader: 'Marque',label: 'Marque *',required: true},
{key: 'modele',csvHeader: 'Modèle',label: 'Modèle *',required: true},
{key: 'annee',csvHeader: 'Année',label: 'Année',required: false},
{key: 'cat',csvHeader: 'Catégorie',label: 'Catégorie',required: false},
{key: 'carburant',csvHeader: 'Carburant',label: 'Carburant',required: false},
{key: 'couleur',csvHeader: 'Couleur',label: 'Couleur',required: false},
{key: 'km',csvHeader: 'Kilométrage',label: 'Kilométrage',required: false},
{key: 'tarif',csvHeader: 'Tarif / Jour (MAD)',label: 'Tarif / Jour (MAD)',required: false},
{key: 'statut',csvHeader: 'Statut',label: 'Statut',required: false},
{key: 'assurance',csvHeader: 'Assurance expire le',label: 'Assurance expire le',required: false},
{key: 'vignette',csvHeader: 'Vignette expire le',label: 'Vignette expire le',required: false},
{key: 'visite',csvHeader: 'Visite technique le',label: 'Visite technique le',required: false},
{key: 'assistance',csvHeader: 'Assistance (échéance le)',label: 'Assistance (échéance le)',required: false},
],
 storageKey: 'autoloc_veh',
 buildRecord: function(row){
 const catVal=(row.cat||row.categorie||'Citadine').toString().trim();
 return{
 id: 'v_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
 immat:(row.immat||'').trim(),
 marque:(row.marque||'').trim(),
 modele:(row.modele||'').trim(),
 annee: row.annee!==undefined&&row.annee!==''? parseInt(row.annee,10): '',
 cat: catVal,
 categorie: catVal,
 tarif: row.tarif!==undefined&&row.tarif!==''? parseFloat(String(row.tarif).replace(',','.')): 0,
 couleur:(row.couleur||'').trim(),
 carburant:(row.carburant||'Essence').trim(),
 km: row.km!==undefined&&row.km!==''? parseInt(row.km,10): 0,
 statut:(row.statut||'disponible').trim(),
 assurance:(row.assurance||'').trim(),
 vignette:(row.vignette||'').trim(),
 visite:(row.visite||'').trim(),
 assistance:(row.assistance||'').trim(),
 photos:[],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
};
},
 validate: function(row,i){
 const errs=[];
 if(!row.immat||!String(row.immat).trim())errs.push('Ligne '+i+' : Immatriculation manquante');
 if(!row.marque||!String(row.marque).trim())errs.push('Ligne '+i+' : Marque manquante');
 if(!row.modele||!String(row.modele).trim())errs.push('Ligne '+i+' : Modèle manquant');
 return errs;
},
 renderFn: 'renderVehicules',
},
 cl:{
 title: 'Import en masse — Clients',
 instructions: 'Importez plusieurs clients à la fois via un fichier CSV. La première ligne doit contenir les en-têtes. Les colonnes obligatoires sont : prenom,nom,tel. Le séparateur peut être une virgule(,)ou un point-virgule(;).',
 columns:[
{key: 'prenom',label: 'prenom *',required: true},
{key: 'nom',label: 'nom *',required: true},
{key: 'tel',label: 'tel *',required: true},
{key: 'email',label: 'email',required: false},
{key: 'cin',label: 'cin',required: false},
{key: 'permis',label: 'permis',required: false},
{key: 'ville',label: 'ville',required: false},
{key: 'nat',label: 'nat',required: false},
{key: 'adresse',label: 'adresse',required: false},
],
 storageKey: 'autoloc_cl',
 buildRecord: function(row){
 return{
 id: 'c_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
 prenom:(row.prenom||'').trim(),
 nom:(row.nom||'').trim(),
 tel:(row.tel||'').trim(),
 email:(row.email||'').trim(),
 cin:(row.cin||'').trim(),
 permis:(row.permis||'').trim(),
 ville:(row.ville||'').trim(),
 nat:(row.nat||'').trim(),
 adresse:(row.adresse||'').trim(),
 photos:[],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
};
},
 validate: function(row,i){
 const errs=[];
 if(!row.prenom||!row.prenom.trim())errs.push('Ligne '+i+' : prénom manquant');
 if(!row.nom||!row.nom.trim())errs.push('Ligne '+i+' : nom manquant');
 if(!row.tel||!row.tel.trim())errs.push('Ligne '+i+' : téléphone manquant');
 return errs;
},
 renderFn: 'renderClients',
}
};
 let _importType=null;
 let _importParsed=null;
 window.openImportModal=function(type){
 _importType=type;
 _importParsed=null;
 const cfg=IMPORT_CONFIG[type];
 if(!cfg)return;
 document.getElementById('import-modal-title').textContent=cfg.title;
 document.getElementById('import-instructions').textContent=cfg.instructions;
 const colWrap=document.getElementById('import-columns');
 colWrap.innerHTML='';
 cfg.columns.forEach(function(c){
 const span=document.createElement('span');
 span.style.cssText='font-size:0.74rem;font-weight:700;padding:3px 9px;border-radius:20px;'+
(c.required
 ? 'background:rgba(45,212,191,0.12);color:#99f6e4;'
 : 'background:var(--surface2);color:var(--text3);border:1px solid var(--border);');
 span.textContent=c.label;
 colWrap.appendChild(span);
});
 clearImportFile();
 document.getElementById('import-errors').style.display='none';
 document.getElementById('import-success-msg').style.display='none';
 openModal('import-modal');
};
 window.downloadImportTemplate=function(){
 const cfg=IMPORT_CONFIG[_importType];
 if(!cfg)return;
 const headers=cfg.columns.map(function(c){return c.csvHeader||c.key;}).join(';');
 const example=cfg.columns.map(function(c){
 const samples={
 immat:'12345-A-6',marque:'Renault',modele:'Clio',
 annee:'2022',cat:'Citadine',carburant:'Essence',couleur:'Blanc',km:'45000',
 tarif:'300',statut:'disponible',
 assurance:'2026-12-31',vignette:'2026-06-30',visite:'2026-03-15',assistance:'2026-12-01',
 prenom:'Mohamed',nom:'Benali',tel:'+212600000000',
 email:'m.benali@mail.com',cin:'AB123456',permis:'12345678',
 ville:'Tanger',nat:'Marocaine',adresse:'Rue Hassan II'
};
 return samples[c.key]||'';
}).join(';');
 const csv=headers+'\n'+example;
 const blob=new Blob(['\uFEFF'+csv],{type: 'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download='modele_import_'+_importType+'.csv';
 a.click();
 URL.revokeObjectURL(url);
};
 window.importDragOver=function(e){
 e.preventDefault();
 document.getElementById('import-dropzone').style.borderColor='var(--accent2)';
 document.getElementById('import-dropzone').style.background='rgba(45,212,191,0.06)';
};
 window.importDragLeave=function(){
 document.getElementById('import-dropzone').style.borderColor='var(--border2)';
 document.getElementById('import-dropzone').style.background='var(--surface)';
};
 window.importDrop=function(e){
 e.preventDefault();
 importDragLeave();
 const file=e.dataTransfer.files[0];
 if(file)processImportFile(file);
};
 window.importFileSelected=function(e){
 const file=e.target.files[0];
 if(file)processImportFile(file);
 e.target.value='';
};
 window.clearImportFile=function(){
 _importParsed=null;
 document.getElementById('import-preview').style.display='none';
 document.getElementById('import-errors').style.display='none';
 document.getElementById('import-success-msg').style.display='none';
 document.getElementById('import-preview-table').innerHTML='';
 const btn=document.getElementById('import-confirm-btn');
 btn.disabled=true;btn.style.opacity='0.4';btn.style.cursor='not-allowed';
};
 function processImportFile(file){
 const reader=new FileReader();
 reader.onload=function(e){
 const text=e.target.result;
 parseAndPreview(text);
};
 reader.readAsText(file,'UTF-8');
}
 function parseCSV(text){
 const sep=(text.indexOf(';')>text.indexOf(',')&&text.indexOf(';')!==-1)
 ? ';' : ',';
 const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')
 .filter(function(l){return l.trim()!=='';});
 if(lines.length<2)return[];
 const headers=lines[0].split(sep).map(function(h){return h.trim().replace(/^"|"$/g,'').toLowerCase();});
 const rows=[];
 for(let i=1;i<lines.length;i++){
 const cells=splitCSVLine(lines[i],sep);
 const obj={};
 headers.forEach(function(h,idx){
 obj[h]=(cells[idx]||'').replace(/^"|"$/g,'').trim();
});
 rows.push(obj);
}
 return rows;
}
 function splitCSVLine(line,sep){
 const result=[];let cur='';let inQ=false;
 for(let i=0;i<line.length;i++){
 const c=line[i];
 if(c==='"'){inQ=!inQ;}
 else if(c===sep&&!inQ){result.push(cur);cur='';}
 else{cur+=c;}
}
 result.push(cur);
 return result;
}
 function parseAndPreview(text){
 const cfg=IMPORT_CONFIG[_importType];
 let rows=parseCSV(text);
 if(_importType==='veh'){rows=rows.map(mapVehImportRow);}
 if(!rows.length){
 showImportError(['Fichier vide ou format non reconnu.']);return;
}
 const allErrors=[];
 rows.forEach(function(row,idx){
 const errs=cfg.validate(row,idx+2);
 errs.forEach(function(e){allErrors.push(e);});
});
 _importParsed=rows;
 document.getElementById('import-preview-count').textContent=rows.length;
 const cols=cfg.columns.map(function(c){return c.key;});
 const labels=cfg.columns.map(function(c){
  return c.csvHeader||(c.label||'').replace(/\s*\*$/,'').trim()||c.key;
 });
 let th='<thead style="position:sticky;top:0;background:var(--surface2)"><tr>';
 labels.forEach(function(l){th+='<th style="padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text3);font-size:0.70rem;letter-spacing:.02em;">'+window.AutoLocUtils.escapeHtml(l)+'</th>';});
 th+='</tr></thead><tbody>';
 const previewRows=rows.slice(0,8);
 previewRows.forEach(function(row){
 th+='<tr>';
 cols.forEach(function(k){
      const cell=row[k];
      th+='<td style="padding:6px 10px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text2);">'+
        (cell ? window.AutoLocUtils.escapeHtml(cell) : '<span style="color:var(--text4)">—</span>')+
      '</td>';
});
 th+='</tr>';
});
 if(rows.length>8){
 th+='<tr><td colspan="'+cols.length+'" style="padding:8px 10px;color:var(--text3);font-style:italic;font-size:0.75rem;">… et '+(rows.length-8)+' autres lignes</td></tr>';
}
 th+='</tbody>';
 document.getElementById('import-preview-table').innerHTML=th;
 document.getElementById('import-preview').style.display='block';
 if(allErrors.length>0){
 showImportError(allErrors);
}else{
 document.getElementById('import-errors').style.display='none';
}
 const btn=document.getElementById('import-confirm-btn');
 btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer';
}
 function showImportError(errors){
 const wrap=document.getElementById('import-errors');
 const ul=document.getElementById('import-errors-list');
 ul.innerHTML=errors.slice(0,10).map(function(e){
    return '<li>'+window.AutoLocUtils.escapeHtml(e)+'</li>';
}).join('');
  if(errors.length>10)ul.innerHTML+='<li>… et '+(errors.length-10)+' autres erreurs</li>';
 wrap.style.display='block';
}
 window.confirmImport=function(){
 if(!_importParsed||!_importParsed.length)return;
 const cfg=IMPORT_CONFIG[_importType];
 let existing=[];
 try{existing=JSON.parse(localStorage.getItem(cfg.storageKey)||'[]');}catch(e){}
 if(!Array.isArray(existing))existing=[];
 const valid=[];
 const errs=[];
 _importParsed.forEach(function(row,idx){
 const rowErrs=cfg.validate(row,idx+2);
 if(rowErrs.length===0){
 valid.push(cfg.buildRecord(row));
}else{
 errs.push(rowErrs[0]);
}
});
 if(!valid.length){
 showImportError(['Aucune ligne valide à importer.']);return;
}
 const merged=existing.concat(valid);
 try{localStorage.setItem(cfg.storageKey,JSON.stringify(merged));}catch(e){}
 if(typeof save==='function'){try{save(cfg.storageKey,merged);}catch(e){}}
 if(window.AutoLocSync&&typeof window.AutoLocSync.push==='function'){
 valid.forEach(function(item){window.AutoLocSync.push(cfg.storageKey,item).catch(function(){});});
}
 const msg='✓ '+valid.length+' enregistrement(s)importé(s)avec succès.'+
(errs.length ? ' '+errs.length+' ligne(s)ignorée(s)(données incomplètes).' : '');
 document.getElementById('import-success-text').textContent=msg;
 document.getElementById('import-success-msg').style.display='block';
 document.getElementById('import-errors').style.display='none';
 const btn=document.getElementById('import-confirm-btn');
 btn.disabled=true;btn.style.opacity='0.4';btn.style.cursor='not-allowed';
 if(typeof window[cfg.renderFn]==='function'){
 try{window[cfg.renderFn]();}catch(e){}
}
 const toast=document.getElementById('save-toast');
 if(toast){
 toast.textContent='✓ '+valid.length+' élément(s)importé(s)';
 toast.classList.add('show');
 setTimeout(function(){toast.classList.remove('show');toast.textContent='✓ Paramètres enregistrés';},2800);
}
 _importParsed=null;
};
})();
