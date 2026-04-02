(function(root){
 'use strict';
 function normalizeDateInputValue(raw){
  if(raw==null)return '';
  const s=String(raw).trim();
  if(!s)return '';
  const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(fr){
   const d=+fr[1],mo=+fr[2],y=+fr[3];
   const dt=new Date(y,mo-1,d);
   if(!isNaN(+dt)&&dt.getFullYear()===y&&dt.getMonth()===(mo-1)&&dt.getDate()===d){
    return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
   }
  }
  const dt=new Date(s);
  if(!isNaN(+dt))return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  return '';
 }
 const api={normalizeDateInputValue};
 if(root){
  root.AutoLocCoreUtils=root.AutoLocCoreUtils||{};
  root.AutoLocCoreUtils.normalizeDateInputValue=normalizeDateInputValue;
 }
 if(typeof module!=='undefined'&&module.exports){
  module.exports=api;
 }
})(typeof window!=='undefined'?window:globalThis);
