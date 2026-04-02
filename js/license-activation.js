/**
 * Licence 100 % locale (APP-GUIDE §5) : la « clé de licence » est le hash SHA-256
 * de la chaîne e-mail_normalisé | deviceId | SECRET, en hex 64 caractères.
 * invooComputeExpectedLicenseHex(email, deviceId) reproduit cette combinaison.
 * L’outil admin (hors app) doit utiliser le même SECRET pour générer la clé client.
 */
(function(){
 const STORAGE_SEED_KEY='invoo_device_seed_v1';

 /** Aligné sur TECHNIQUE.txt / admin tool : PRODUCT_SECRETS.INVOORENT → INVRENT9338 */
 const LICENSE_SECRET='INVRENT9338';

 function normalizeEmail(s){
  return String(s||'').trim().toLowerCase();
 }

 async function sha256HexFromString(str){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
 }

 function ensureSeed(){
  try{
   var x=localStorage.getItem(STORAGE_SEED_KEY);
   if(x&&x.length>=32)return x;
   var a=new Uint8Array(32);
   crypto.getRandomValues(a);
   x=Array.from(a).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
   localStorage.setItem(STORAGE_SEED_KEY,x);
   return x;
  }catch(_e){
   return 'fallback-seed-'+String(navigator.userAgent||'').slice(0,80);
  }
 }

 function fingerprintParts(){
  try{
   return[
    navigator.userAgent||'',
    String(screen&&screen.width||0),
    String(screen&&screen.height||0),
    String(screen&&screen.colorDepth||0),
    String(navigator.language||''),
    String(navigator.hardwareConcurrency||0),
    Intl.DateTimeFormat().resolvedOptions().timeZone||''
   ].join('|');
  }catch(_e){
   return 'fp';
  }
 }

 var _deviceIdPromise=null;
 globalThis.invooGetDeviceId=function invooGetDeviceId(){
  if(_deviceIdPromise)return _deviceIdPromise;
  _deviceIdPromise=(async function(){
   var seed=ensureSeed();
   var raw=seed+'|'+fingerprintParts();
   return sha256HexFromString(raw);
  })();
  return _deviceIdPromise;
 };

 globalThis.invooComputeExpectedLicenseHex=function invooComputeExpectedLicenseHex(email,deviceId){
  var e=normalizeEmail(email);
  var d=String(deviceId||'').trim().toLowerCase();
  var payload=e+'|'+d+'|'+LICENSE_SECRET;
  return sha256HexFromString(payload);
 };

 /** Comparaison insensible à la casse ; pas de timing-safe sur navigateur pour hex court — suffisant ici. */
 globalThis.invooLicenseKeysMatch=function invooLicenseKeysMatch(a,b){
  var x=String(a||'').replace(/\s+/g,'').toLowerCase();
  var y=String(b||'').replace(/\s+/g,'').toLowerCase();
  if(x.length!==y.length)return false;
  var diff=0;
  for(var i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);
  return diff===0;
 };
})();
