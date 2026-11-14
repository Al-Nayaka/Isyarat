#!/usr/bin/env node
/* Membuat sketsa panduan tangan (SVG) untuk setiap label dari dataset JSONL.
 *
 * Gambar ini adalah sketsa kartun dari landmark MediaPipe, bukan foto gerakan
 * dan bukan panduan BISINDO resmi. Dipakai di halaman "Daftar isyarat" agar
 * pengguna punya bayangan bentuk tangan.
 *
 * Pemakaian:
 *   node ml/scripts/make-guides.mjs
 *   node ml/scripts/make-guides.mjs --data ml/data/raw --out public/assets/guides
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const PALM = [0, 5, 9, 13, 17];
/* Rantai tulang per jari + lebar garis tiap ruas (pangkal -> ujung). */
const FINGERS = [
  {chain: [0, 1, 2, 3, 4], widths: [12, 11, 10, 8]},   // jempol
  {chain: [0, 5, 6, 7, 8], widths: [14, 13, 11, 9]},   // telunjuk
  {chain: [0, 9, 10, 11, 12], widths: [14, 13, 12, 9]}, // tengah
  {chain: [0, 13, 14, 15, 16], widths: [13, 12, 11, 9]}, // manis
  {chain: [0, 17, 18, 19, 20], widths: [11, 10, 9, 8]}  // kelingking
];

const STYLE = {
  panel: '#fff4dd',
  outline: '#203a3d',
  shadow: '#0b2326',
  skin: ['#f8c99d', '#f2b285'],
  highlight: '#ffe7ca',
  accent: '#ffb84d'
};

function parseArgs(argv) {
  const args = {data: 'ml/data/raw', out: 'public/assets/guides'};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[++index];
    if (flag === '--data') args.data = value;
    else if (flag === '--out') args.out = value;
    else throw new Error(`Opsi tidak dikenal: ${flag}`);
  }
  return args;
}

function collectJsonl(dir) {
  const records = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isFile() || !/\.jsonl$/i.test(entry.name) || entry.name.startsWith('_')) continue;
    const file = path.join(dir, entry.name);
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record?.label && Array.isArray(record.landmarks) && record.landmarks.length >= 63) {
          records.push(record);
        }
      } catch {
        // baris rusak dilewati; training juga akan melaporkannya
      }
    }
  }
  return records;
}

function squaredDistance(a, b) {
  let total = 0;
  for (let index = 0; index < a.length; index++) {
    const delta = a[index] - b[index];
    total += delta * delta;
  }
  return total;
}

function centroid(samples) {
  const size = samples[0].length;
  const mean = new Array(size).fill(0);
  for (const sample of samples) {
    for (let index = 0; index < size; index++) mean[index] += sample[index];
  }
  for (let index = 0; index < size; index++) mean[index] /= samples.length;
  return mean;
}

function medoid(samples) {
  const mean = centroid(samples);
  let best = samples[0];
  let bestDistance = Infinity;
  for (const sample of samples) {
    const distance = squaredDistance(sample, mean);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sample;
    }
  }
  return best;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function renderBackdrop() {
  const parts = [];
  // Stiker krem dengan bayangan lembut supaya terasa seperti ilustrasi kartun.
  parts.push(`<rect x="10" y="10" width="204" height="124" rx="26" fill="${STYLE.shadow}" opacity="0.28"/>`);
  parts.push(`<rect x="4" y="4" width="204" height="124" rx="26" fill="${STYLE.panel}" stroke="${STYLE.outline}" stroke-width="6"/>`);
  // Hiasan kecil: titik dan kilau, bukan bagian dari isyarat.
  parts.push(`<circle cx="28" cy="26" r="4" fill="${STYLE.accent}" opacity="0.75"/>`);
  parts.push(`<circle cx="194" cy="32" r="3" fill="${STYLE.accent}" opacity="0.55"/>`);
  parts.push(`<circle cx="186" cy="110" r="4.5" fill="${STYLE.accent}" opacity="0.5"/>`);
  parts.push(`<path d="M36 108 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" fill="${STYLE.accent}" opacity="0.55"/>`);
  return parts;
}

function renderHand(points, skin) {
  const parts = [];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const wristX = points[0][0];

  // Bayangan di bawah tangan.
  parts.push(`<ellipse cx="${round(wristX)}" cy="${round(maxY + 10)}" rx="${round((maxX - minX) / 2 + 10)}" ry="8" fill="${STYLE.shadow}" opacity="0.12"/>`);

  // Telapak sebagai bidang kartun dengan garis luar tebal.
  const palm = PALM.map(index => points[index].join(',')).join(' ');
  parts.push(`<polygon points="${palm}" fill="${skin}" stroke="${STYLE.outline}" stroke-width="5" stroke-linejoin="round"/>`);
  parts.push(`<circle cx="${round(points[0][0])}" cy="${round(points[0][1])}" r="12" fill="${skin}" stroke="${STYLE.outline}" stroke-width="4"/>`);

  // Garis luar semua ruas jari, lalu isi warna kulit di atasnya.
  for (const {chain, widths} of FINGERS) {
    for (let index = 0; index < chain.length - 1; index++) {
      const [x1, y1] = points[chain[index]];
      const [x2, y2] = points[chain[index + 1]];
      const width = widths[index] + 5;
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${STYLE.outline}" stroke-width="${width}" stroke-linecap="round"/>`);
    }
  }
  for (const {chain, widths} of FINGERS) {
    for (let index = 0; index < chain.length - 1; index++) {
      const [x1, y1] = points[chain[index]];
      const [x2, y2] = points[chain[index + 1]];
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${skin}" stroke-width="${widths[index]}" stroke-linecap="round"/>`);
    }
  }

  // Ujung jari membulat.
  for (const {chain, widths} of FINGERS) {
    const [x, y] = points[chain[chain.length - 1]];
    parts.push(`<circle cx="${x}" cy="${y}" r="${widths[widths.length - 1] / 2 + 1}" fill="${skin}" stroke="${STYLE.outline}" stroke-width="3"/>`);
  }

  // Kilau kecil agar terlihat seperti gambar tangan, bukan kerangka.
  parts.push(`<ellipse cx="${round(points[9][0] - 3)}" cy="${round(points[9][1] + 2)}" rx="7" ry="5" fill="${STYLE.highlight}" opacity="0.55"/>`);
  parts.push(`<circle cx="${round(points[5][0])}" cy="${round(points[5][1] - 2)}" r="3" fill="${STYLE.highlight}" opacity="0.7"/>`);
  return parts;
}

function renderGuide(features, title) {
  const handSize = 63; // 21 landmark x (x, y, z)
  const hands = [];
  for (let slot = 0; slot < 2; slot++) {
    const part = features.slice(slot * handSize, (slot + 1) * handSize);
    if (part.length < handSize) continue;
    if (part.every(value => value === 0)) continue;
    hands.push(part);
  }
  if (!hands.length) return null;

  // Posisi antar-tangan tidak tersimpan pada fitur ternormalisasi (setiap
  // tangan berpusat di wrist-nya sendiri), jadi kedua tangan ditata kiri/kanan.
  const offsets = hands.length === 2 ? [-0.78, 0.78] : [0];
  const rawPoints = hands.map((part, handIndex) => {
    const points = [];
    for (let landmark = 0; landmark < 21; landmark++) {
      points.push([
        part[landmark * 3] + offsets[handIndex],
        part[landmark * 3 + 1]
      ]);
    }
    return points;
  });

  const all = rawPoints.flat();
  const xs = all.map(point => point[0]);
  const ys = all.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.5);
  const height = Math.max(maxY - minY, 0.5);
  const padding = 26; // ruang untuk garis luar jari dan bayangan
  const viewWidth = 220;
  const viewHeight = 140;
  const scale = Math.min((viewWidth - padding * 2) / width, (viewHeight - padding * 2) / height);
  const offsetX = (viewWidth - width * scale) / 2 - minX * scale;
  const offsetY = (viewHeight - height * scale) / 2 - minY * scale;

  const project = ([x, y]) => [round(x * scale + offsetX), round(y * scale + offsetY)];
  const handPoints = rawPoints.map(points => points.map(project));

  const parts = renderBackdrop();
  handPoints.forEach((points, index) => {
    parts.push(...renderHand(points, STYLE.skin[index % STYLE.skin.length]));
  });

  const safeTitle = String(title).replace(/[<>&]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Sketsa kartun isyarat ${safeTitle}"><title>Sketsa kartun isyarat ${safeTitle}</title>${parts.join('')}</svg>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = path.resolve(ROOT, args.data);
  const outDir = path.resolve(ROOT, args.out);
  if (!fs.existsSync(dataDir)) throw new Error(`Folder data tidak ditemukan: ${dataDir}`);

  const records = collectJsonl(dataDir);
  if (!records.length) throw new Error('Tidak ada sampel JSONL yang valid.');

  const byLabel = new Map();
  for (const record of records) {
    const size = record.features?.length ?? record.landmarks.length;
    if (size !== 126) continue; // sketsa ini khusus mode dual
    const features = (record.features ?? record.landmarks).map(Number);
    if (!byLabel.has(record.label)) byLabel.set(record.label, []);
    byLabel.get(record.label).push(features);
  }

  fs.mkdirSync(outDir, {recursive: true});
  let written = 0;
  for (const label of [...byLabel.keys()].sort()) {
    const samples = byLabel.get(label);
    const features = medoid(samples);
    const svg = renderGuide(features, label);
    if (!svg) {
      console.warn(`  lewati ${label}: tidak ada tangan pada sampel medoid.`);
      continue;
    }
    fs.writeFileSync(path.join(outDir, `${label}.svg`), `${svg}\n`, 'utf8');
    written++;
    console.log(`  ${label.padEnd(18)} ${samples.length} sampel → ${label}.svg`);
  }

  console.log('');
  console.log(`Sketsa ditulis : ${written} berkas`);
  console.log(`Folder output  : ${path.relative(ROOT, outDir)}`);
  console.log('Catatan: sketsa kartun dari landmark, bukan foto atau panduan BISINDO resmi.');
}

try {
  main();
} catch (error) {
  console.error(`Gagal membuat sketsa: ${error.message}`);
  process.exit(1);
}
