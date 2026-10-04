// Copy the ONNX Runtime Web files the speech model needs into public/ort/, so the
// finder loads them from this site (strict CSP, offline) instead of jsdelivr.
//   node scripts/copy-ort.mjs      (also run by "npm run prepare-offline")
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'node_modules', 'onnxruntime-web', 'dist');
const dst = join(here, '..', 'public', 'ort');
if (!existsSync(src)) {
  console.error('onnxruntime-web is not installed; run npm install first');
  process.exit(1);
}
mkdirSync(dst, { recursive: true });
const wanted = readdirSync(src).filter((f) => f.startsWith('ort-wasm-simd-threaded.asyncify.') && (f.endsWith('.wasm') || f.endsWith('.mjs')));
if (!wanted.length) {
  console.error('ort-wasm-simd-threaded.asyncify.* not found in', src);
  process.exit(1);
}
for (const f of wanted) {
  copyFileSync(join(src, f), join(dst, f));
  console.log('copied', f);
}
