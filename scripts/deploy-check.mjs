#!/usr/bin/env node
/* Pemeriksaan kesiapan deploy (tanpa browser).
 * Memastikan berkas statis, konsistensi vocab-model-sketsa, dan konfigurasi hosting.
 * Bukan pengganti uji kamera/MediaPipe di browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const required = [
  'index.html',
  'manifest.json',
  'sw.js',
  'css/style.css',
  'js/ui/app.js',
  'js/ui/camera.js',
  'js/ui/engine-bridge.js',
  'js/engine/index.js',
  'js/engine/config.js',
  'js/engine/hand-detector.js',
  'js/engine/normalize.js',
  'js/engine/smoother.js',
  'js/ml/classifier.js',
  'data/vocab.json',
  'models/knn-model.json',
  'models/hand_landmarker.task',
  'vendor/mediapipe/vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'assets/logo.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const failures = [];
const warnings = [];

for (const relative of required) {
  const file = path.join(PUBLIC, relative);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    failures.push(`berkas wajib hilang/kosong: public/${relative}`);
  }
}

const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
let vocab = [];
let model = null;
try {
  vocab = readJson('public/data/vocab.json');
  model = readJson('public/models/knn-model.json');
} catch (error) {
  failures.push(`gagal membaca vocab/model: ${error.message}`);
}

if (model) {
  if (model.format !== 'isyarat-knn-v1') failures.push(`format model tidak dikenal: ${model.format}`);
  if (model.featureSize !== 126) failures.push(`featureSize model ${model.featureSize}, seharusnya 126`);
  const modelLabels = [...model.labels].sort();
  const vocabIds = vocab.map(item => item.id).sort();
  if (JSON.stringify(modelLabels) !== JSON.stringify(vocabIds)) {
    failures.push('daftar label model tidak sama dengan vocab.json');
  }
  for (const item of vocab) {
    if (!item.teks_tampil) failures.push(`vocab ${item.id} tanpa teks_tampil`);
    if (!model.labels.includes(item.id)) failures.push(`vocab ${item.id} tidak ada di model`);
  }
}

const guidesDir = path.join(PUBLIC, 'assets/guides');
if (!fs.existsSync(guidesDir)) {
  failures.push('folder public/assets/guides tidak ada');
} else {
  const files = fs.readdirSync(guidesDir).filter(name => name.endsWith('.svg'));
  const ids = new Set(files.map(name => name.slice(0, -4)));
  for (const item of vocab) {
    if (!ids.has(item.id)) failures.push(`sketsa hilang: public/assets/guides/${item.id}.svg`);
  }
  const stale = files.filter(name => !vocab.some(item => `${item.id}.svg` === name));
  if (stale.length) {
    warnings.push(`${stale.length} sketsa tidak dipakai vocab (tidak ikut dipaketkan): ${stale.join(', ')}`);
  }
}

const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
const version = sw.match(/CACHE_VERSION\s*=\s*'([^']+)'/)?.[1];
if (!version) failures.push('CACHE_VERSION tidak ditemukan di public/sw.js');

const manifest = readJson('public/manifest.json');
if (manifest.start_url !== '/') warnings.push(`manifest start_url = ${manifest.start_url} (deploy harus di root domain)`);

const netlify = fs.existsSync(path.join(ROOT, 'netlify.toml')) ? fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8') : '';
if (!/publish\s*=\s*"public"/.test(netlify)) failures.push('netlify.toml tidak mengarahkan publish ke "public"');

const vercel = fs.existsSync(path.join(ROOT, 'vercel.json')) ? readJson('vercel.json') : null;
if (!vercel || vercel.outputDirectory !== 'public') failures.push('vercel.json tidak mengatur outputDirectory "public"');

const server = fs.existsSync(path.join(ROOT, 'server.mjs')) ? fs.readFileSync(path.join(ROOT, 'server.mjs'), 'utf8') : '';
for (const mime of ['application/wasm', 'application/octet-stream']) {
  if (!server.includes(mime)) failures.push(`server.mjs tidak memetakan MIME ${mime}`);
}

const sizeOf = target => {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(target).reduce((total, name) => total + sizeOf(path.join(target, name)), 0);
};
const publicSize = sizeOf(PUBLIC);

console.log(`Berkas wajib       : ${required.length - failures.filter(item => item.startsWith('berkas wajib')).length}/${required.length}`);
console.log(`Kata di vocab      : ${vocab.length}`);
console.log(`Label model        : ${model ? model.labels.length : 0}`);
console.log(`Sketsa             : ${fs.existsSync(guidesDir) ? fs.readdirSync(guidesDir).filter(name => name.endsWith('.svg')).length : 0}`);
console.log(`CACHE_VERSION      : ${version || '-'}`);
console.log(`Ukuran public/     : ${(publicSize / 1024 / 1024).toFixed(2)} MB`);

if (warnings.length) {
  console.log('\nPeringatan:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (failures.length) {
  console.log('\nGAGAL:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}

console.log('\nSIAP DEPLOY: struktur statis dan konfigurasi hosting valid.');
console.log('Deploy hanya folder public/ ke root domain (Netlify/Vercel/Cloudflare Pages).');
console.log('Uji kamera dan PWA offline tetap harus dilakukan manual di browser.');
