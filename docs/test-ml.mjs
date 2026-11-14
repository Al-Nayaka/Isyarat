/* Uji classifier KNN dan pipeline training tanpa browser.
 * Fixture sintetis ini hanya untuk pengujian otomatis, BUKAN data demo/akurasi.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createClassifierFromModel} from '../public/js/ml/classifier.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEATURE_SIZE = 126;
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

function makeFeatures(seed, offset) {
  const vector = [];
  for (let i = 0; i < FEATURE_SIZE; i++) {
    vector.push(Number((offset + Math.sin(seed + i * 0.37) * 0.05).toFixed(6)));
  }
  return vector;
}

test('classifier memprediksi cluster yang benar', () => {
  const model = {
    format: 'isyarat-knn-v1',
    featureSize: FEATURE_SIZE,
    k: 5,
    labels: ['halo', 'tolong'],
    samples: [
      ...Array.from({length: 6}, (_, i) => ({label: 'halo', features: makeFeatures(i, 0.1)})),
      ...Array.from({length: 6}, (_, i) => ({label: 'tolong', features: makeFeatures(i + 100, 1.1)}))
    ]
  };
  const classifier = createClassifierFromModel(model);
  const halo = classifier.predict(makeFeatures(1, 0.1).map(value => value + 0.01));
  const tolong = classifier.predict(makeFeatures(101, 1.1).map(value => value - 0.01));
  assert.equal(halo.label, 'halo');
  assert.equal(tolong.label, 'tolong');
  assert.ok(halo.confidence > 0.8 && halo.confidence <= 1);
  assert.ok(tolong.confidence > 0.8 && tolong.confidence <= 1);
});

test('dimensi fitur salah ditolak', () => {
  const model = {
    featureSize: 4,
    k: 1,
    samples: [{label: 'a', features: [0, 0, 0, 0]}]
  };
  const classifier = createClassifierFromModel(model);
  assert.throws(() => classifier.predict([0, 0]), /harus memiliki 4 nilai/);
});

test('model tanpa sampel ditolak', () => {
  assert.throws(() => createClassifierFromModel({featureSize: 4, samples: []}), /tidak memiliki sampel/);
});

test('training end-to-end: split per partisipan, model, dan laporan', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'isyarat-ml-'));
  try {
    const dataDir = path.join(temp, 'raw');
    fs.mkdirSync(dataDir, {recursive: true});

    const participants = ['P01', 'P02', 'P03'];
    const labels = ['halo', 'tolong'];
    for (let p = 0; p < participants.length; p++) {
      const lines = [];
      for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
        for (let sample = 0; sample < 10; sample++) {
          lines.push(JSON.stringify({
            label: labels[labelIndex],
            landmarks: makeFeatures(sample + p * 10, labelIndex === 0 ? 0.1 : 1.1),
            feature_mode: 'dual',
            feature_size: FEATURE_SIZE,
            orang_id: participants[p],
            kondisi: {cahaya: 'terang', jarak: 'sedang', latar: 'polos'},
            versi_normalisasi: '1.0'
          }));
        }
      }
      fs.writeFileSync(path.join(dataDir, `${participants[p]}.jsonl`), `${lines.join('\n')}\n`, 'utf8');
    }

    const modelPath = path.join(temp, 'model.json');
    const reportPath = path.join(temp, 'report.json');
    const docsPath = path.join(temp, 'report.md');

    const output = execFileSync(process.execPath, [
      path.join(ROOT, 'ml/scripts/train-knn.mjs'),
      '--data', dataDir,
      '--out', modelPath,
      '--report', reportPath,
      '--docs', docsPath,
      '--k', '3',
      '--test-every', '2'
    ], {cwd: ROOT, encoding: 'utf8'});

    assert.match(output, /Akurasi uji/);
    assert.ok(fs.existsSync(modelPath));
    assert.ok(fs.existsSync(reportPath));
    assert.ok(fs.existsSync(docsPath));

    const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    assert.equal(model.format, 'isyarat-knn-v1');
    assert.equal(model.featureSize, FEATURE_SIZE);
    assert.deepEqual(model.labels, ['halo', 'tolong']);
    assert.ok(model.participants.includes('P01'));
    assert.ok(!model.participants.includes('P02'), 'partisipan uji tidak boleh masuk model');
    assert.equal(report.split.mode, 'participant');
    assert.equal(report.split.compliant, true);
    assert.deepEqual(report.split.testParticipants, ['P02']);
    assert.equal(report.metrics.accuracy, 1);

    const classifier = createClassifierFromModel(model);
    const prediction = classifier.predict(makeFeatures(2, 0.1));
    assert.equal(prediction.label, 'halo');
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
});

const realModelPath = path.join(ROOT, 'public/models/knn-model.json');
if (fs.existsSync(realModelPath)) {
  test('model nyata konsisten dengan vocab', () => {
    const vocabPath = path.join(ROOT, 'public/data/vocab.json');
    const model = JSON.parse(fs.readFileSync(realModelPath, 'utf8'));
    const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    const vocabIds = new Set(vocab.map(item => item.id));
    assert.equal(model.format, 'isyarat-knn-v1');
    assert.equal(model.featureSize, FEATURE_SIZE);
    assert.ok(model.samples.length > 0);
    for (const label of model.labels) {
      assert.ok(vocabIds.has(label), `label model ${label} tidak ada di vocab.json`);
    }
    for (const id of vocabIds) {
      assert.ok(model.labels.includes(id), `vocab ${id} tidak ada di model`);
    }
    const classifier = createClassifierFromModel(model);
    assert.deepEqual(classifier.labels.slice().sort(), model.labels.slice().sort());
  });

  test('setiap label punya sketsa panduan', () => {
    const guidesDir = path.join(ROOT, 'public/assets/guides');
    const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/vocab.json'), 'utf8'));
    for (const item of vocab) {
      const file = path.join(guidesDir, `${item.id}.svg`);
      assert.ok(fs.existsSync(file), `sketsa panduan ${item.id} tidak ada`);
    }
  });
} else {
  console.log('  --  model nyata belum ada, tes konsistensi dilewati');
}

console.log(`\nLULUS: ${passed} pengujian classifier + pipeline training.`);
console.log('CATATAN: fixture sintetis hanya untuk pengujian; akurasi nyata harus dari dataset partisipan.');
