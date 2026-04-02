(function () {
  'use strict';

  /**
   * Validation structurelle d’une sauvegarde exportée (sans logique métier).
   * Garder la même règle que scripts/verify-backup-schema.mjs (npm test).
   */
  globalThis.invooValidateBackupStructure = function (backup) {
    var structureErrors = [];
    if (!backup || typeof backup !== 'object') {
      return { ok: false, errors: ['Fichier JSON invalide'] };
    }
    if (!backup.data) {
      return { ok: false, errors: ['Propriété data manquante'] };
    }
    var d = backup.data;
    if (!Array.isArray(d.veh)) structureErrors.push('data.veh doit être un Array');
    if (!Array.isArray(d.cl)) structureErrors.push('data.cl doit être un Array');
    if (!Array.isArray(d.res)) structureErrors.push('data.res doit être un Array');
    return { ok: structureErrors.length === 0, errors: structureErrors };
  };
})();
