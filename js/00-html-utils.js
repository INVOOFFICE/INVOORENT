(function(){
 'use strict';
 function escapeHtml(value){
  return String(value ?? '')
   .replace(/&/g,'&amp;')
   .replace(/</g,'&lt;')
   .replace(/>/g,'&gt;')
   .replace(/"/g,'&quot;')
   .replace(/'/g,'&#39;');
 }
 window.AutoLocUtils=window.AutoLocUtils||{};
 window.AutoLocUtils.escapeHtml=escapeHtml;
 // Backward compatibility alias for existing code paths.
 window.esc=escapeHtml;
})();
