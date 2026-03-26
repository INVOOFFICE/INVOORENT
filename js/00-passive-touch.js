(function(){
 var sup=false;
 try{window.addEventListener('test',null,Object.defineProperty({},'passive',{get:function(){sup=true;}}));}catch(e){}
 if(!sup)return;
 var orig=EventTarget.prototype.addEventListener;
 EventTarget.prototype.addEventListener=function(type,fn,opts){
 if((type==='touchstart'||type==='touchmove'||type==='wheel'||type==='mousewheel')&&(opts===undefined||opts===false)){
 opts={passive:true};
}
 return orig.call(this,type,fn,opts);
};
})();
