#!/usr/bin/env node
/**
 * Génère la clé hex (64 caractères) pour un e-mail et un ID appareil.
 * L’utilisateur transmet son ID appareil (fourni par l’app ou la console) ; doit matcher invooGetDeviceId().
 * Doit rester identique à js/license-activation.js et à PRODUCT_SECRETS.INVOORENT (TECHNIQUE.txt).
 */
import crypto from 'crypto';

const LICENSE_SECRET = 'INVRENT9338';

const email = (process.argv[2] || '').trim().toLowerCase();
const deviceId = (process.argv[3] || '').trim().toLowerCase();

if (!email || !deviceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/gen-invoorent-license.mjs <email> <deviceId_hex>');
  process.exit(1);
}

const payload = `${email}|${deviceId}|${LICENSE_SECRET}`;
const hex = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
console.log(hex);
