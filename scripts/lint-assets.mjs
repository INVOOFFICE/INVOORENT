/**
 * Vérifie que chaque <script src="..."> de index.html est présent dans ASSETS (sw.js).
 * Usage : npm run lint  (depuis la racine du dépôt)
 * Note : extension .mjs ⇒ module ESM ; ne pas utiliser node --input-type=module avec un chemin fichier (erreur Node récent).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const indexPath = join(root, 'index.html');
const swPath = join(root, 'sw.js');

let indexHtml;
let swJs;
try {
 indexHtml = readFileSync(indexPath, 'utf8');
 swJs = readFileSync(swPath, 'utf8');
} catch (e) {
 console.error('lint-assets : impossible de lire index.html ou sw.js depuis', root);
 process.exit(1);
}

const scriptSrcRe = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;
const scriptPaths = [];
let m;
while ((m = scriptSrcRe.exec(indexHtml)) !== null) {
 scriptPaths.push(m[1]);
}

if (scriptPaths.length === 0) {
 console.error('lint-assets : aucune balise <script src="..."> trouvée dans index.html');
 process.exit(1);
}

const assetsBlock = swJs.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!assetsBlock) {
 console.error('lint-assets : tableau ASSETS introuvable dans sw.js');
 process.exit(1);
}

const assetStrings = [];
const strRe = /["']([^"']+)["']/g;
let a;
while ((a = strRe.exec(assetsBlock[1])) !== null) {
 assetStrings.push(a[1]);
}

const assetSet = new Set(assetStrings);
const missing = scriptPaths.filter((p) => !assetSet.has(p));

if (missing.length > 0) {
 console.error(
  'lint-assets : script(s) référencé(s) dans index.html mais absent(s) de sw.js ASSETS :\n',
  missing.map((p) => `  - ${p}`).join('\n')
 );
 process.exit(1);
}

console.log(`lint-assets OK — ${scriptPaths.length} fichier(s) <script src> présent(s) dans ASSETS.`);
