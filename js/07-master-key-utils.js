(function(root){
 'use strict';
 function getCryptoApi(){
  if(root&&root.crypto&&root.crypto.subtle)return root.crypto;
  if(typeof require==='function'){
   try{return require('node:crypto').webcrypto;}catch(e){}
  }
  return null;
 }
 function getTextEncoder(){
  if(typeof TextEncoder!=='undefined')return TextEncoder;
  if(typeof require==='function'){
   try{return require('node:util').TextEncoder;}catch(e){}
  }
  throw new Error('TextEncoder indisponible');
 }
 function bytesToB64(bytes){
  if(typeof btoa==='function'){
   let bin='';
   bytes.forEach(b=>{bin+=String.fromCharCode(b);});
   return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
 }
 function b64ToBytes(b64){
  if(typeof atob==='function'){
   const bin=atob(b64);
   const out=new Uint8Array(bin.length);
   for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
   return out;
  }
  return new Uint8Array(Buffer.from(b64,'base64'));
 }
 async function pbkdf2Master(input,saltBytes,iterations,dkBits){
  const cryptoApi=getCryptoApi();
  if(!cryptoApi||!cryptoApi.subtle)throw new Error('WebCrypto indisponible');
  const Encoder=getTextEncoder();
  const key=await cryptoApi.subtle.importKey(
   'raw',
   new Encoder().encode(input),
   {name:'PBKDF2'},
   false,
   ['deriveBits']
  );
  const bits=await cryptoApi.subtle.deriveBits(
   {name:'PBKDF2',salt:saltBytes,iterations,hash:'SHA-256'},
   key,
   dkBits||256
  );
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function buildMasterKeyRecord(masterKey,opts){
  const options=opts||{};
  const iter=options.iter||210000;
  const dkBits=options.dkBits||256;
  const cryptoApi=getCryptoApi();
  if(!cryptoApi)throw new Error('WebCrypto indisponible');
  const salt=new Uint8Array(16);
  cryptoApi.getRandomValues(salt);
  const dk=await pbkdf2Master(masterKey,salt,iter,dkBits);
  return {v:1,kdf:'PBKDF2-SHA256',iter,salt:bytesToB64(salt),dk};
 }
 async function verifyMasterKeyRecord(input,rec,opts){
  if(!rec||!rec.salt||!rec.dk)return false;
  const options=opts||{};
  const dkBits=options.dkBits||256;
  try{
   const salt=b64ToBytes(rec.salt);
   const got=await pbkdf2Master(input,salt,rec.iter||210000,dkBits);
   return got===rec.dk;
  }catch(e){
   return false;
  }
 }
 const api={bytesToB64,b64ToBytes,pbkdf2Master,buildMasterKeyRecord,verifyMasterKeyRecord};
 if(root){
  root.AutoLocMasterKeyUtils=root.AutoLocMasterKeyUtils||{};
  Object.assign(root.AutoLocMasterKeyUtils,api);
 }
 if(typeof module!=='undefined'&&module.exports){
  module.exports=api;
 }
})(typeof window!=='undefined'?window:globalThis);
