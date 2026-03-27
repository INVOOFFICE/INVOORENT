/**
 * Demande de clé INVOO-XXXXXX via EmailJS (frontend uniquement).
 * Renseignez serviceId et publicKey dans EmailJS (Account → API Keys).
 * Le template EmailJS doit exposer les variables : license_key, request_time, page_url
 * (ajoutez-les dans le corps du mail du modèle template_5gbbagb).
 * La clé publique reste visible côté client ; limitez l’abus via le tableau de bord EmailJS.
 */
(function(){
 var EMAILJS_SERVICE_ID='service_2t7i96t';
 var EMAILJS_PUBLIC_KEY='uehozD_TMXaKuWBKn';
 var EMAILJS_TEMPLATE_ID='template_5gbbagb';
 var COOLDOWN_MS=90000;
 var STORAGE_KEY='invoo_license_req_ts';
 var _emailjsInited=false;
 function ensureEmailJsInit(){
  if(_emailjsInited)return;
  emailjs.init({publicKey:EMAILJS_PUBLIC_KEY});
  _emailjsInited=true;
 }
 function generateLicenseKey(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var arr=new Uint8Array(6);
  crypto.getRandomValues(arr);
  var s='';
  for(var i=0;i<6;i++)s+=chars[arr[i]%chars.length];
  return 'INVOO-'+s;
 }
 function hideMsgs(){
  var ok=document.getElementById('license-request-success');
  var er=document.getElementById('license-request-error');
  if(ok)ok.style.display='none';
  if(er){er.style.display='none';er.textContent='';}
 }
 function showErr(msg){
  hideMsgs();
  var er=document.getElementById('license-request-error');
  if(er){er.textContent=msg;er.style.display='block';}
 }
 function showOk(){
  hideMsgs();
  var ok=document.getElementById('license-request-success');
  if(ok)ok.style.display='block';
 }
 function canSend(){
  try{
   var t=parseInt(sessionStorage.getItem(STORAGE_KEY)||'0',10);
   if(!t)return true;
   return Date.now()-t>=COOLDOWN_MS;
  }catch(e){return true;}
 }
 function markSent(){
  try{sessionStorage.setItem(STORAGE_KEY,String(Date.now()));}catch(e){}
 }
 window.addEventListener('DOMContentLoaded',function(){
  var btn=document.getElementById('btn-get-license-key');
  if(!btn)return;
  btn.addEventListener('click',async function(){
   hideMsgs();
   if(!canSend()){
    showErr('Veuillez patienter quelques instants avant une nouvelle demande.');
    return;
   }
   if(!EMAILJS_SERVICE_ID||EMAILJS_SERVICE_ID==='YOUR_SERVICE_ID'||!EMAILJS_PUBLIC_KEY||EMAILJS_PUBLIC_KEY==='YOUR_PUBLIC_KEY'){
    showErr('Configuration EmailJS manquante : éditez js/08-emailjs-license.js (serviceId et publicKey).');
    return;
   }
   if(typeof emailjs==='undefined'){
    showErr('Service d’envoi indisponible. Vérifiez votre connexion et rechargez la page.');
    return;
   }
   var licenseKey=generateLicenseKey();
   var msgBody='Une nouvelle clé a été générée : '+licenseKey;
   btn.disabled=true;
   btn.classList.add('is-loading');
   try{
    ensureEmailJsInit();
    await emailjs.send(EMAILJS_SERVICE_ID,EMAILJS_TEMPLATE_ID,{
     license_key:licenseKey,
     key:licenseKey,
     LicenseKey:licenseKey,
     cle:licenseKey,
     message:msgBody,
     Message:msgBody,
     sujet:'Nouvelle clé INVOORENTE — '+licenseKey,
     subject:'Nouvelle clé INVOORENTE — '+licenseKey,
     titre:'Nouvelle clé INVOORENTE',
     request_time:new Date().toISOString(),
     page_url:typeof location!=='undefined'?location.href:''
    });
    try{sessionStorage.setItem('invoo_pending_license_key',licenseKey);}catch(e){}
    licenseKey=null;
    markSent();
    showOk();
    var enter=document.getElementById('license-enter-wrap');
    if(enter){
     enter.style.display='block';
     var inp=document.getElementById('reset-email-license-key');
     var err=document.getElementById('license-enter-error');
     if(err)err.classList.remove('show');
     if(inp){inp.value='';setTimeout(function(){inp.focus();},120);}
    }
   }catch(err){
    var msg='Envoi impossible. Réessayez plus tard.';
    if(err&&err.text)msg=String(err.text);
    else if(err&&err.message)msg=String(err.message);
    showErr(msg);
   }finally{
    btn.disabled=false;
    btn.classList.remove('is-loading');
   }
  });
 });
})();
