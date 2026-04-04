(function(){
 'use strict';
 const KEY_LAST_BACKUP='autoloc_last_backup_ts';
 const KEY_SNOOZED='autoloc_backup_snoozed';
 const WARN_AFTER_DAYS=7;
 const SNOOZE_HOURS=24;
 function daysSinceBackup(){
 const ts=parseInt(localStorage.getItem(KEY_LAST_BACKUP)||'0',10);
 if(!ts)return 999;
 return Math.floor((Date.now()-ts)/(1000 * 60 * 60 * 24));
}
 function isSnoozed(){
 const ts=parseInt(localStorage.getItem(KEY_SNOOZED)||'0',10);
 if(!ts)return false;
 return(Date.now()-ts)<(SNOOZE_HOURS * 60 * 60 * 1000);
}
 function showBackupReminderModal(days){
 const txt=document.getElementById('backup-reminder-days-text');
 if(txt){
 if(days>=999){
 txt.textContent='Vous n\'avez jamais exporté de sauvegarde — faites-le maintenant pour protéger vos données.';
}else{
 txt.textContent=`Vous n'avez pas sauvegardé depuis ${days} jour${days>1 ? 's' : ''} — exportez maintenant pour éviter toute perte.`;
}
}
 if(typeof openModal==='function'){
  openModal('backup-reminder-modal');
 }
}
 function hideBackupReminderModal(){
 if(typeof closeModal==='function'){
  closeModal('backup-reminder-modal');
 }
}
 function checkBackupReminder(){
 const loginScreen=document.getElementById('login-screen');
 if(loginScreen&&!loginScreen.classList.contains('hidden'))return;
 if(isSnoozed())return;
 const days=daysSinceBackup();
 if(days>=WARN_AFTER_DAYS){
 showBackupReminderModal(days);
}
}
 window.backupReminderDoExport=function(){
 localStorage.setItem(KEY_LAST_BACKUP,Date.now().toString());
 localStorage.removeItem(KEY_SNOOZED);
 hideBackupReminderModal();
 if(typeof exportBackup==='function'){
 exportBackup();
}
};
 window.backupReminderSnooze=function(){
 localStorage.setItem(KEY_SNOOZED,Date.now().toString());
 hideBackupReminderModal();
};
 document.addEventListener('DOMContentLoaded',function(){
 const origExport=window.exportBackup;
 if(typeof origExport==='function'){
 window.exportBackup=function(){
 localStorage.setItem(KEY_LAST_BACKUP,Date.now().toString());
 localStorage.removeItem(KEY_SNOOZED);
 hideBackupReminderModal();
 return origExport.apply(this,arguments);
};
}
 setTimeout(checkBackupReminder,2500);
});
 document.addEventListener('click',function(e){
 const btn=e.target.closest('[data-page]');
 if(btn)setTimeout(checkBackupReminder,400);
});
})();
(function(){
 'use strict';
 const PWA_DISMISSED_KEY='autoloc_pwa_dismissed';
 const PWA_IOS_HINT_KEY='autoloc_pwa_ios_dismissed';
 let deferredPrompt=null;
 const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
 function isInstalled(){
  try{
   return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  }catch(e){
   return false;
  }
 }
 function isLoginBlockingPwa(){
  const el=document.getElementById('login-screen');
  return !!(el && !el.classList.contains('hidden'));
 }
 function showIosInstallBannerOnce(){
  if(!isIOS || isInstalled())return;
  if(localStorage.getItem(PWA_IOS_HINT_KEY))return;
  if(isLoginBlockingPwa())return;
  const banner=document.getElementById('pwa-install-banner');
  const installBtn=document.getElementById('pwa-install-btn');
  if(!banner || !installBtn)return;
  installBtn.textContent='Comment installer ?';
  installBtn.onclick=function(){
   alAlert('Pour installer INVOORENT sur iOS :\n\n1. Appuyez sur le bouton Partager ⬆️ en bas de Safari\n2. Faites défiler et appuyez sur "Sur l\'écran d\'accueil"\n3. Appuyez sur "Ajouter"\n\nL\'app apparaîtra sur votre écran d\'accueil.');
  };
  const inner=banner.querySelector('.pwa-install-inner');
  if(inner){
   inner.style.opacity='';
   inner.style.transform='';
  }
  banner.classList.add('pwa-install-banner--visible');
  localStorage.setItem(PWA_IOS_HINT_KEY,'1');
 }
 function showInstallBanner(){
  const banner=document.getElementById('pwa-install-banner');
  if(!banner)return;
  if(isInstalled()){
   hideInstallBanner();
   return;
  }
  if(isLoginBlockingPwa())return;
  if(!deferredPrompt)return;
  const inner=banner.querySelector('.pwa-install-inner');
  if(inner){
   inner.style.opacity='';
   inner.style.transform='';
  }
  const installBtn=document.getElementById('pwa-install-btn');
  if(installBtn){
   installBtn.textContent='Installer';
   installBtn.onclick=function(){ window.pwaTriggerInstall(); };
  }
  banner.classList.add('pwa-install-banner--visible');
 }
 function hideInstallBanner(){
  const banner=document.getElementById('pwa-install-banner');
  if(!banner)return;
  const inner=banner.querySelector('.pwa-install-inner');
  if(inner){
   inner.style.transition='opacity 0.2s ease,transform 0.2s ease';
   inner.style.opacity='0';
   inner.style.transform='translateY(10px)';
   setTimeout(function(){
    banner.classList.remove('pwa-install-banner--visible');
    inner.style.transition='';
    inner.style.opacity='';
    inner.style.transform='';
   },200);
  }else{
   banner.classList.remove('pwa-install-banner--visible');
  }
 }
 function tryPwaBannerAfterLogin(){
  if(isInstalled() || isLoginBlockingPwa())return;
  if(deferredPrompt){
   showInstallBanner();
  }else if(isIOS){
   showIosInstallBannerOnce();
  }
 }
 window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  deferredPrompt=e;
  const dismissed=localStorage.getItem(PWA_DISMISSED_KEY);
  if(dismissed){
   const dismissedDate=new Date(parseInt(dismissed,10));
   const daysSince=(Date.now()-dismissedDate)/(1000 * 60 * 60 * 24);
   if(daysSince<7)return;
  }
  if(isInstalled())return;
  setTimeout(showInstallBanner,3000);
 });
 window.addEventListener('appinstalled',function(){
  hideInstallBanner();
  deferredPrompt=null;
  console.info('INVOORENT installée avec succès');
 });
 window.addEventListener('load',function(){
  if(isInstalled())hideInstallBanner();
 });
 window.addEventListener('invoo-login-hidden',function(){
  setTimeout(tryPwaBannerAfterLogin,450);
 });
 window.pwaTriggerInstall=async function(){
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  const choice=await deferredPrompt.userChoice;
  console.info('PWA install choice:',choice.outcome);
  deferredPrompt=null;
  hideInstallBanner();
 };
 window.pwaDismiss=function(){
  localStorage.setItem(PWA_DISMISSED_KEY,Date.now().toString());
  hideInstallBanner();
 };
 const isInStandaloneMode=window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone===true;
 if(isIOS && !isInStandaloneMode && !localStorage.getItem(PWA_IOS_HINT_KEY)){
  setTimeout(showIosInstallBannerOnce,3000);
 }
})();
