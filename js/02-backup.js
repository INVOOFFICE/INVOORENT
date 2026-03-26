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
 function showBanner(days){
 const banner=document.getElementById('backup-reminder-banner');
 const txt=document.getElementById('backup-reminder-days-text');
 if(!banner)return;
 if(txt){
 if(days>=999){
 txt.textContent='Vous n\'avez jamais exporté de sauvegarde — faites-le maintenant pour protéger vos données.';
}else{
 txt.textContent=`Vous n'avez pas sauvegardé depuis ${days}jour${days>1 ? 's' : ''}— exportez maintenant pour éviter toute perte.`;
}
}
 banner.classList.add('visible');
}
 function hideBanner(){
 const banner=document.getElementById('backup-reminder-banner');
 if(banner){
 banner.style.transition='opacity 0.2s,transform 0.2s';
 banner.style.opacity='0';
 banner.style.transform='translateY(-8px)';
 setTimeout(()=>{
 banner.classList.remove('visible');
 banner.style.opacity='';
 banner.style.transform='';
},220);
}
}
 function checkBackupReminder(){
 const loginScreen=document.getElementById('login-screen');
 if(loginScreen&&!loginScreen.classList.contains('hidden'))return;
 if(isSnoozed())return;
 const days=daysSinceBackup();
 if(days>=WARN_AFTER_DAYS){
 showBanner(days);
}
}
 window.backupReminderDoExport=function(){
 localStorage.setItem(KEY_LAST_BACKUP,Date.now().toString());
 localStorage.removeItem(KEY_SNOOZED);
 hideBanner();
 if(typeof exportBackup==='function'){
 exportBackup();
}
};
 window.backupReminderSnooze=function(){
 localStorage.setItem(KEY_SNOOZED,Date.now().toString());
 hideBanner();
};
 document.addEventListener('DOMContentLoaded',function(){
 const origExport=window.exportBackup;
 if(typeof origExport==='function'){
 window.exportBackup=function(){
 localStorage.setItem(KEY_LAST_BACKUP,Date.now().toString());
 localStorage.removeItem(KEY_SNOOZED);
 hideBanner();
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
 let deferredPrompt=null;
  function isInstalled(){
    try{
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
    }catch(e){
      return false;
    }
  }
 if('serviceWorker' in navigator){
 window.addEventListener('load',function(){
 let refreshing=false;
 function requestSkipWaiting(reg){
  if(reg&&reg.waiting){
   reg.waiting.postMessage({type:'SKIP_WAITING'});
  }
 }
 navigator.serviceWorker.addEventListener('controllerchange',function(){
  if(refreshing)return;
  refreshing=true;
  window.location.reload();
 });
 navigator.serviceWorker.register('/sw.js')
 .then(reg=>{
  console.info('AutoLoc SW enregistré:',reg.scope);
  requestSkipWaiting(reg);
  reg.addEventListener('updatefound',function(){
   const newWorker=reg.installing;
   if(!newWorker)return;
   newWorker.addEventListener('statechange',function(){
    if(newWorker.state==='installed'&&navigator.serviceWorker.controller){
     requestSkipWaiting(reg);
    }
   });
  });
 })
 .catch(err=>console.warn('AutoLoc SW échec:',err.message));
});
}
 window.addEventListener('beforeinstallprompt',function(e){
 e.preventDefault();
 deferredPrompt=e;
 const dismissed=localStorage.getItem(PWA_DISMISSED_KEY);
 if(dismissed){
 const dismissedDate=new Date(parseInt(dismissed));
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
 function showInstallBanner(){
 const banner=document.getElementById('pwa-install-banner');
    if(!banner)return;
    if(isInstalled()){
      hideInstallBanner();
      return;
    }
    banner.style.display='block';
}
 function hideInstallBanner(){
 const banner=document.getElementById('pwa-install-banner');
 if(banner){
 banner.style.transition='opacity 0.2s,transform 0.2s';
 banner.style.opacity='0';
 banner.style.transform='translateY(100%)';
 setTimeout(()=>{banner.style.display='none';banner.style.opacity='';banner.style.transform='';},220);
}
}
  // Garantir qu'on ne montre jamais le bouton si l'app est déjà installée.
  window.addEventListener('load',function(){
    if(isInstalled())hideInstallBanner();
  });
 window.pwaTriggerInstall=async function(){
 if(!deferredPrompt)return;
 deferredPrompt.prompt();
 const{outcome}=await deferredPrompt.userChoice;
 console.info('PWA install choice:',outcome);
 deferredPrompt=null;
 hideInstallBanner();
};
 window.pwaDismiss=function(){
 localStorage.setItem(PWA_DISMISSED_KEY,Date.now().toString());
 hideInstallBanner();
};
 const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
 const isInStandaloneMode=window.matchMedia('(display-mode: standalone)').matches
||window.navigator.standalone===true;
 if(isIOS&&!isInStandaloneMode){
 const iosDismissed=localStorage.getItem('autoloc_pwa_ios_dismissed');
 if(!iosDismissed){
 setTimeout(function(){
 const banner=document.getElementById('pwa-install-banner');
 const installBtn=document.getElementById('pwa-install-btn');
 if(banner&&installBtn){
 installBtn.textContent='Comment installer ?';
 installBtn.onclick=function(){
 alAlert('Pour installer INVOORENT sur iOS :\n\n1. Appuyez sur le bouton Partager ⬆️ en bas de Safari\n2. Faites défiler et appuyez sur "Sur l\'écran d\'accueil"\n3. Appuyez sur "Ajouter"\n\nL\'app apparaîtra sur votre écran d\'accueil.');
};
 banner.style.display='block';
}
 localStorage.setItem('autoloc_pwa_ios_dismissed','1');
},3000);
}
}
})();
