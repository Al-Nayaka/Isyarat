#!/usr/bin/env node
/* Training + evaluasi KNN Isyarat (Anggota C).
 *
 * Input : file .jsonl/.json hasil public/recorder.html (boleh banyak file/folder)
 * Output: public/models/knn-model.json, ml/reports/akurasi.json, docs/laporan-akurasi.md
 *
 * Contoh:
 *   node ml/scripts/train-knn.mjs
 *   node ml/scripts/train-knn.mjs --data ml/data/raw --k 5 --test-every 3
 *   node ml/scripts/train-knn.mjs --dry-run
 *   node ml/scripts/train-knn.mjs --test-participants P03,P04
 *
 * Prinsip (PRD 3.2 Machine Learning):
 * - Data uji dipisahkan berdasarkan identitas partisipan, bukan acak per sampel.
 * - Model hanya berisi sampel training.
 * - Akurasi dilaporkan apa adanya, termasuk peringatan bila split tidak memenuhi syarat.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClassifierFromModel} from '../../public/js/ml/classifier.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const DEFAULTS = {
  data: 'ml/data/raw',
  out: 'public/models/knn-model.json',
  report: 'ml/reports/akurasi.json',
  docs: 'docs/laporan-akurasi.md',
  k: 5,
  testEvery: 3,
  testParticipants: null,
  augmentMirror: false,
  dryRun: false
};

function printHelp() {
  console.log(`Training KNN Isyarat

Pemakaian:
  node ml/scripts/train-knn.mjs [opsi]

Opsi:
  --data <folder>              Folder/file dataset (.jsonl/.json). Default: ml/data/raw
  --out <file>                 Model output. Default: public/models/knn-model.json
  --report <file>              Laporan JSON. Default: ml/reports/akurasi.json
  --docs <file>                Laporan Markdown. Default: docs/laporan-akurasi.md
  --k <angka>                  Jumlah tetangga KNN. Default: 5
  --test-every <angka>         Setiap partisipan ke-N dijadikan data uji. Default: 3
  --test-participants <list>   Contoh: P03,P04 (mengalahkan --test-every)
  --augment-mirror             Tambah salinan cermin (x -> -x) pada data training
  --dry-run                    Validasi dataset saja, tidak menulis model
  --help                       Tampilkan bantuan
`);
}

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') {
      printHelp();
      process.exit(0);
    }
    if (flag === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (flag === '--augment-mirror') {
      args.augmentMirror = true;
      continue;
    }
    if (!flag.startsWith('--')) throw new Error(`Argumen tidak dikenal: ${flag}`);
    const value = argv[++i];
    if (value == null) throw new Error(`Nilai untuk ${flag} kosong.`);
    if (flag === '--data') args.data = value;
    else if (flag === '--out') args.out = value;
    else if (flag === '--report') args.report = value;
    else if (flag === '--docs') args.docs = value;
    else if (flag === '--k') args.k = Number(value);
    else if (flag === '--test-every') args.testEvery = Number(value);
    else if (flag === '--test-participants') args.testParticipants = value.split(',').map(item => item.trim()).filter(Boolean);
    else throw new Error(`Opsi tidak dikenal: ${flag}`);
  }
  if (!Number.isInteger(args.k) || args.k < 1) throw new Error('--k harus bilangan bulat >= 1.');
  if (!Number.isInteger(args.testEvery) || args.testEvery < 2) throw new Error('--test-every harus bilangan bulat >= 2.');
  return args;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return /\.(jsonl|json)$/i.test(target) ? [target] : [];
  }
  const files = [];
  for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (/\.(jsonl|json)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

function readRecords(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  if (/\.jsonl$/i.test(file)) {
    const records = [];
    text.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try {
        records.push({raw: JSON.parse(line), line: index + 1});
      } catch (error) {
        records.push({raw: null, line: index + 1, error: `JSON tidak valid: ${error.message}`});
      }
    });
    return records;
  }
  const parsed = JSON.parse(text);
  const array = Array.isArray(parsed) ? parsed : Array.isArray(parsed.samples) ? parsed.samples : null;
  if (!array) throw new Error('JSON harus berupa array sampel atau {samples:[...]}.');
  return array.map((raw, index) => ({raw, line: index + 1}));
}

function normalizeRecord(record) {
  const features = record.landmarks ?? record.features;
  const label = String(record.label ?? '').trim();
  const orang = String(record.orang_id ?? record.participant ?? 'TANPA_ID').trim() || 'TANPA_ID';

  if (!label) throw new Error('label kosong');
  if (!/^[A-Za-z0-9_]+$/.test(label)) throw new Error(`label "${label}" mengandung karakter tidak valid`);
  if (!Array.isArray(features) || features.length === 0) throw new Error('landmarks/features kosong');
  if (features.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('landmarks/features harus berisi angka finite');
  }

  return {
    label,
    features: features.map(Number),
    orang_id: orang,
    feature_mode: record.feature_mode ?? record.featureMode ?? null,
    normalizationVersion: record.versi_normalisasi ?? null,
    sumber: record.sumber ?? null,
    lisensi: record.lisensi ?? null,
    kondisi: record.kondisi ?? null
  };
}

function loadDataset(target) {
  const files = collectFiles(target);
  if (!files.length) {
    throw new Error(`Tidak ada file .jsonl/.json di ${path.relative(ROOT, target) || target}. Rekam dulu lewat /recorder.html.`);
  }

  const samples = [];
  const warnings = [];
  let featureSize = null;

  for (const file of files) {
    let records;
    try {
      records = readRecords(file);
    } catch (error) {
      warnings.push(`${path.relative(ROOT, file)} gagal dibaca: ${error.message}`);
      continue;
    }
    for (const {raw, line, error} of records) {
      if (error) {
        warnings.push(`${path.relative(ROOT, file)}:${line} dilewati (${error})`);
        continue;
      }
      try {
        const sample = normalizeRecord(raw);
        if (featureSize == null) featureSize = sample.features.length;
        if (sample.features.length !== featureSize) {
          throw new Error(`dimensi ${sample.features.length}, seharusnya ${featureSize}`);
        }
        samples.push(sample);
      } catch (error) {
        warnings.push(`${path.relative(ROOT, file)}:${line} dilewati (${error.message})`);
      }
    }
  }

  if (warnings.length) {
    console.warn(`Peringatan dataset (${warnings.length}):`);
    for (const warning of warnings.slice(0, 10)) console.warn(`  - ${warning}`);
    if (warnings.length > 10) console.warn(`  - ... dan ${warnings.length - 10} peringatan lain.`);
  }
  if (!samples.length) throw new Error('Tidak ada sampel valid setelah validasi.');

  return {files, samples, featureSize, warnings};
}

function chooseTestParticipants(participants, args) {
  const requested = args.testParticipants;
  if (requested && requested.length) {
    const missing = requested.filter(id => !participants.includes(id));
    if (missing.length) throw new Error(`Partisipan uji tidak ada di dataset: ${missing.join(', ')}`);
    const test = [...new Set(requested)];
    if (test.length >= participants.length) throw new Error('Semua partisipan dijadikan data uji; sisakan minimal satu untuk training.');
    return test;
  }

  if (participants.length < 2) return [];
  const test = participants.filter((_, index) => index % args.testEvery === args.testEvery - 1);
  if (test.length) return test;
  return [participants[participants.length - 1]];
}

function mirrorFeatures(features, featureSize, mode) {
  const handCount = mode === 'dual' ? 2 : 1;
  const stride = featureSize / (handCount * 21);
  if (!Number.isInteger(stride) || stride < 1) {
    throw new Error(`Tidak dapat mencerminkan fitur berukuran ${featureSize} (mode ${mode}).`);
  }
  const flipX = vector => {
    const mirrored = [...vector];
    for (let index = 0; index < mirrored.length; index += stride) mirrored[index] = -mirrored[index];
    return mirrored;
  };

  if (mode !== 'dual' || featureSize % 2 !== 0) return flipX(features);

  // Mode dual: slot 0 = tangan kiri layar, slot 1 = tangan kanan.
  // Mencerminkan seluruh adegan membalik x DAN menukar posisi kedua slot.
  const slotSize = featureSize / 2;
  const left = features.slice(0, slotSize);
  const right = features.slice(slotSize);
  const leftPresent = left.some(value => value !== 0);
  const rightPresent = right.some(value => value !== 0);
  const mirroredLeft = flipX(left);
  const mirroredRight = flipX(right);

  if (leftPresent && rightPresent) return mirroredRight.concat(mirroredLeft);
  // Satu tangan selalu menempati slot 0 pada normalisasi, jadi cukup balik x.
  return mirroredLeft.concat(mirroredRight);
}

function sampleSplit(samples) {
  const test = [];
  const train = [];
  const byLabel = new Map();
  for (const sample of samples) {
    if (!byLabel.has(sample.label)) byLabel.set(sample.label, []);
    byLabel.get(sample.label).push(sample);
  }
  for (const list of byLabel.values()) {
    list.sort((a, b) => (a.orang_id + a.features.join(',')).localeCompare(b.orang_id + b.features.join(',')));
    list.forEach((sample, index) => {
      if (index % 5 === 4) test.push(sample);
      else train.push(sample);
    });
  }
  return {train, test};
}

function evaluate(model, testSamples) {
  const classifier = createClassifierFromModel(model);
  const labels = model.labels;
  const matrix = Object.fromEntries(labels.map(label => [label, Object.fromEntries(labels.map(other => [other, 0]))]));
  let correct = 0;
  const unknownPredictions = new Map();

  for (const sample of testSamples) {
    const prediction = classifier.predict(sample.features);
    if (!labels.includes(prediction.label)) {
      unknownPredictions.set(prediction.label, (unknownPredictions.get(prediction.label) || 0) + 1);
      continue;
    }
    if (!matrix[sample.label]) matrix[sample.label] = Object.fromEntries(labels.map(other => [other, 0]));
    matrix[sample.label][prediction.label] += 1;
    if (prediction.label === sample.label) correct++;
  }

  const perClass = {};
  for (const label of labels) {
    const row = matrix[label] || {};
    const tp = row[label] || 0;
    const support = Object.values(row).reduce((sum, value) => sum + value, 0);
    const predicted = labels.reduce((sum, actual) => sum + ((matrix[actual]?.[label]) || 0), 0);
    const precision = predicted > 0 ? tp / predicted : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perClass[label] = {
      support,
      correct: tp,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4))
    };
  }

  const scored = labels.filter(label => perClass[label].support > 0);
  const macroF1 = scored.length ? scored.reduce((sum, label) => sum + perClass[label].f1, 0) / scored.length : 0;
  const accuracy = testSamples.length ? correct / testSamples.length : 0;

  return {
    accuracy: Number(accuracy.toFixed(4)),
    macroF1: Number(macroF1.toFixed(4)),
    total: testSamples.length,
    correct,
    perClass,
    confusion: matrix,
    unknownPredictions: Object.fromEntries(unknownPredictions)
  };
}

function buildModel(trainSamples, featureSize, args, datasetMeta) {
  const labels = [...new Set(trainSamples.map(sample => sample.label))].sort();
  const classCounts = Object.fromEntries(labels.map(label => [label, 0]));
  for (const sample of trainSamples) classCounts[sample.label]++;

  const mode = trainSamples.find(sample => sample.feature_mode)?.feature_mode || null;
  const modes = new Set(trainSamples.map(sample => sample.feature_mode).filter(Boolean));
  if (modes.size > 1) {
    console.warn(`Peringatan: dataset mencampur feature_mode ${[...modes].join(', ')}. Model memakai ${mode}.`);
  }

  return {
    format: 'isyarat-knn-v1',
    version: 1,
    createdAt: new Date().toISOString(),
    featureMode: mode,
    featureSize,
    normalizationVersion: trainSamples.find(sample => sample.normalizationVersion)?.normalizationVersion || null,
    metric: 'euclidean',
    k: args.k,
    labels,
    classCounts,
    participants: [...new Set(trainSamples.map(sample => sample.orang_id))].sort(),
    sources: [...new Set(trainSamples.map(sample => sample.sumber).filter(Boolean))],
    licenses: [...new Set(trainSamples.map(sample => sample.lisensi).filter(Boolean))],
    augmentation: args.augmentMirror ? 'mirror-x' : null,
    sourceFiles: datasetMeta.files.map(file => path.relative(ROOT, file)),
    samples: trainSamples.map(sample => ({
      label: sample.label,
      features: sample.features.map(value => Number(value.toFixed(6)))
    }))
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function markdownReport(report) {
  const lines = [];
  lines.push('# Laporan Akurasi Model KNN');
  lines.push('');
  lines.push(`Dibuat: ${report.generatedAt}`);
  lines.push('');
  lines.push('> Skor `confidence` per prediksi bukan akurasi model. Angka akurasi di bawah dihitung dari data uji yang dipisahkan.');
  lines.push('');
  lines.push('## Ringkasan');
  lines.push('');
  lines.push(`- File dataset: ${report.dataset.files.length}`);
  lines.push(`- Total sampel valid: ${report.dataset.samples}`);
  lines.push(`- Label: ${report.dataset.labels.join(', ') || '-'}`);
  lines.push(`- Partisipan: ${report.dataset.participants.join(', ') || '-'}`);
  lines.push(`- Mode split: **${report.split.mode}**${report.split.compliant ? '' : ' (TIDAK memenuhi syarat PRD)'}`);
  lines.push(`- Partisipan uji: ${report.split.testParticipants.join(', ') || '-'}`);
  lines.push(`- Sampel training / uji: ${report.split.trainBaseCount} dasar + ${report.split.trainAugmentedCount} augmentasi = ${report.split.trainCount} / ${report.split.testCount}`);
  lines.push(`- Augmentasi: ${report.augmentation || 'tidak ada'}`);
  if (report.dataset.sources?.length) {
    lines.push(`- Sumber data: ${report.dataset.sources.join(', ')}`);
    lines.push(`- Lisensi data: ${report.dataset.licenses.join(', ') || '-'}`);
  }
  lines.push(`- Fitur: ${report.config.featureMode || '-'} (${report.config.featureSize} nilai), k=${report.config.k}`);
  lines.push('');
  lines.push('## Metrik');
  lines.push('');
  lines.push('| Metrik | Nilai |');
  lines.push('|---|---|');
  lines.push(`| Akurasi | ${(report.metrics.accuracy * 100).toFixed(2)}% |`);
  lines.push(`| Macro F1 | ${report.metrics.macroF1.toFixed(4)} |`);
  lines.push(`| Benar / Total | ${report.metrics.correct} / ${report.metrics.total} |`);
  lines.push('');
  lines.push('## Per kelas');
  lines.push('');
  lines.push('| Label | Support | Benar | Precision | Recall | F1 |');
  lines.push('|---|---|---|---|---|---|');
  for (const [label, metric] of Object.entries(report.metrics.perClass)) {
    lines.push(`| ${label} | ${metric.support} | ${metric.correct} | ${metric.precision} | ${metric.recall} | ${metric.f1} |`);
  }
  lines.push('');
  if (report.warnings.length) {
    lines.push('## Peringatan');
    lines.push('');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }
  lines.push('## Batasan');
  lines.push('');
  lines.push('- Hasil ini hanya berlaku untuk kosakata, kondisi pencahayaan, jarak, dan partisipan yang ada di dataset.');
  lines.push('- Model KNN tidak memahami gerakan temporal; isyarat harus berupa bentuk statis atau pose tunggal.');
  lines.push('- Bila split memakai sampel (bukan partisipan), angka akurasi cenderung terlalu optimistis dan tidak boleh diklaim sebagai generalisasi.');
  lines.push('- Bila sampel berasal dari frame video berurutan, data uji dapat sangat mirip dengan data training sehingga akurasi ikut terlalu optimistis.');
  lines.push('- Uji dengan partisipan baru di luar dataset tetap diperlukan sebelum demo.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argumen tidak valid: ${error.message}`);
    printHelp();
    process.exit(1);
  }

  const dataPath = resolvePath(args.data);
  const outPath = resolvePath(args.out);
  const reportPath = resolvePath(args.report);
  const docsPath = resolvePath(args.docs);

  let dataset;
  try {
    dataset = loadDataset(dataPath);
  } catch (error) {
    console.error(`Gagal memuat dataset: ${error.message}`);
    process.exit(1);
  }

  const {samples, featureSize} = dataset;
  const labels = [...new Set(samples.map(sample => sample.label))].sort();
  const participants = [...new Set(samples.map(sample => sample.orang_id))].sort();

  console.log(`Dataset: ${samples.length} sampel, ${labels.length} label, ${participants.length} partisipan, ${featureSize} fitur.`);

  if (labels.length < 2) {
    console.error('Minimal dua label diperlukan untuk melatih classifier.');
    process.exit(1);
  }
  if (args.dryRun) {
    console.log('Dry-run: dataset valid. Tidak ada model yang ditulis.');
    return;
  }

  const testParticipants = chooseTestParticipants(participants, args);
  let trainSamples;
  let testSamples;
  let splitMode;
  let compliant;

  if (testParticipants.length) {
    const testSet = new Set(testParticipants);
    trainSamples = samples.filter(sample => !testSet.has(sample.orang_id));
    testSamples = samples.filter(sample => testSet.has(sample.orang_id));
    splitMode = 'participant';
    compliant = true;
  } else {
    const split = sampleSplit(samples);
    trainSamples = split.train;
    testSamples = split.test;
    splitMode = 'sample';
    compliant = false;
    console.warn('PERINGATAN: hanya satu partisipan. Split memakai sampel dan TIDAK memenuhi syarat PRD (uji per partisipan).');
  }

  if (!trainSamples.length || !testSamples.length) {
    console.error(`Split gagal: training ${trainSamples.length}, uji ${testSamples.length}. Tambah data/partisipan.`);
    process.exit(1);
  }

  const trainBaseCount = trainSamples.length;
  let trainAugmentedCount = 0;
  if (args.augmentMirror) {
    const mirrored = trainSamples.map(sample => ({
      ...sample,
      features: mirrorFeatures(sample.features, featureSize, sample.feature_mode || 'dual')
    }));
    trainSamples = trainSamples.concat(mirrored);
    trainAugmentedCount = mirrored.length;
  }

  const warnings = [...dataset.warnings];
  if (!compliant) {
    warnings.push('Split data memakai sampel, bukan partisipan; akurasi tidak mencerminkan generalisasi ke orang baru.');
  }
  const testLabels = new Set(testSamples.map(sample => sample.label));
  for (const label of labels) {
    if (!testLabels.has(label)) warnings.push(`Label "${label}" tidak memiliki sampel uji.`);
  }
  const trainLabels = new Set(trainSamples.map(sample => sample.label));
  for (const label of testLabels) {
    if (!trainLabels.has(label)) warnings.push(`Label "${label}" hanya muncul di data uji sehingga tidak dapat diprediksi.`);
  }

  const model = buildModel(trainSamples, featureSize, args, dataset);
  if (model.samples.length < model.k) {
    warnings.push(`Jumlah sampel training (${model.samples.length}) lebih kecil dari k (${model.k}); confidence bisa terlalu tinggi.`);
  }
  for (const [label, count] of Object.entries(model.classCounts)) {
    if (count < model.k) warnings.push(`Kelas "${label}" hanya memiliki ${count} sampel training (< k=${model.k}).`);
  }
  const metrics = evaluate(model, testSamples);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: {
      files: dataset.files.map(file => path.relative(ROOT, file)),
      samples: samples.length,
      labels,
      participants,
      sources: [...new Set(samples.map(sample => sample.sumber).filter(Boolean))],
      licenses: [...new Set(samples.map(sample => sample.lisensi).filter(Boolean))]
    },
    split: {
      mode: splitMode,
      compliant,
      testParticipants,
      trainBaseCount,
      trainAugmentedCount,
      trainCount: trainSamples.length,
      testCount: testSamples.length,
      trainParticipants: model.participants,
      testParticipantCount: new Set(testSamples.map(sample => sample.orang_id)).size
    },
    augmentation: model.augmentation,
    config: {k: model.k, featureMode: model.featureMode, featureSize},
    metrics,
    warnings
  };

  writeJson(outPath, model);
  writeJson(reportPath, report);
  fs.mkdirSync(path.dirname(docsPath), {recursive: true});
  fs.writeFileSync(docsPath, `${markdownReport(report)}\n`, 'utf8');

  console.log('');
  console.log(`Model ditulis   : ${path.relative(ROOT, outPath)}`);
  console.log(`Laporan JSON    : ${path.relative(ROOT, reportPath)}`);
  console.log(`Laporan Markdown: ${path.relative(ROOT, docsPath)}`);
  console.log(`Akurasi uji     : ${(metrics.accuracy * 100).toFixed(2)}% (${metrics.correct}/${metrics.total})`);
  console.log(`Macro F1        : ${metrics.macroF1.toFixed(4)}`);
  console.log(`Split           : ${splitMode}${compliant ? ' (sesuai PRD)' : ' (PERINGATAN: tidak sesuai PRD)'}`);
  console.log(`Augmentasi      : ${model.augmentation || 'tidak ada'}`);
  if (warnings.length) console.log(`Peringatan      : ${warnings.length} (lihat laporan)`);
  console.log('\nCatatan: confidence per prediksi bukan akurasi model.');
}

main();
