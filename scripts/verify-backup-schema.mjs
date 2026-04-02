/**
 * Tests Node du schéma de sauvegarde JSON.
 * Règles alignées sur js/backup-validate.js — modifier les deux si la structure change.
 */
import assert from 'node:assert';

function validateBackupStructure(backup) {
  const structureErrors = [];
  if (!backup || typeof backup !== 'object') {
    return { ok: false, errors: ['Fichier JSON invalide'] };
  }
  if (!backup.data) {
    return { ok: false, errors: ['Propriété data manquante'] };
  }
  const d = backup.data;
  if (!Array.isArray(d.veh)) structureErrors.push('data.veh doit être un Array');
  if (!Array.isArray(d.cl)) structureErrors.push('data.cl doit être un Array');
  if (!Array.isArray(d.res)) structureErrors.push('data.res doit être un Array');
  return { ok: structureErrors.length === 0, errors: structureErrors };
}

assert.equal(validateBackupStructure(null).ok, false);
assert.equal(validateBackupStructure({}).ok, false);
assert.equal(validateBackupStructure({ data: {} }).ok, false);

const valid = {
  data: {
    veh: [],
    cl: [],
    res: [],
    log: [],
    maint: [],
    settings: {},
    photos: {}
  }
};
assert.equal(validateBackupStructure(valid).ok, true);

const badVeh = {
  data: { veh: {}, cl: [], res: [] }
};
assert.equal(validateBackupStructure(badVeh).ok, false);

console.log('verify-backup-schema.mjs: OK');
