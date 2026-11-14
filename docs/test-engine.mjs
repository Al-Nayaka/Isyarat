/* Uji logika engine tanpa browser: normalisasi landmark + stabilisasi prediksi.
 * Tidak menggantikan uji MediaPipe/kamera nyata.
 */
import assert from 'node:assert/strict';
import {ENGINE_CONFIG, featureSizeFor} from '../public/js/engine/config.js';
import {normalizeHands} from '../public/js/engine/normalize.js';
import {PredictionSmoother} from '../public/js/engine/smoother.js';

function makeHand(offsetX = 0) {
  const landmarks = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({
      x: 0.5 + offsetX + (i % 5) * 0.02,
      y: 0.5 - Math.floor(i / 5) * 0.06,
      z: (i % 3) * 0.001
    });
  }
  return {landmarks, handedness: 'Right'};
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

test('ukuran fitur sesuai konfigurasi', () => {
  assert.equal(featureSizeFor('dual'), 126);
  assert.equal(featureSizeFor('single'), 63);
  assert.equal(ENGINE_CONFIG.confidenceThreshold, 0.7);
});

test('single: 63 nilai, wrist di origin, skala maksimum 1', () => {
  const result = normalizeHands([makeHand()], {featureMode: 'single', useZ: true});
  assert.ok(result);
  assert.equal(result.features.length, 63);
  assert.equal(result.mode, 'single');
  assert.ok(Math.abs(result.features[0]) < 1e-9);
  assert.ok(Math.abs(result.features[1]) < 1e-9);

  let max = 0;
  for (let i = 0; i < 21; i++) {
    const x = result.features[i * 3];
    const y = result.features[i * 3 + 1];
    const z = result.features[i * 3 + 2];
    max = Math.max(max, Math.hypot(x, y, z));
  }
  assert.ok(Math.abs(max - 1) < 1e-9);
});

test('dual: 126 nilai, tangan kiri layar pada slot pertama', () => {
  const left = makeHand(0.0);
  const right = makeHand(0.25);
  const result = normalizeHands([right, left], {featureMode: 'dual', useZ: true});
  assert.ok(result);
  assert.equal(result.features.length, 126);
  assert.equal(result.mode, 'dual');
  assert.equal(result.handsPresent, 2);
  // Slot pertama berasal dari tangan ber-centerX lebih kecil (kiri).
  assert.ok(result.features[0] <= result.features[63] + 1e-9);
});

test('dual: satu tangan di-pad nol agar dimensi tetap 126', () => {
  const result = normalizeHands([makeHand()], {featureMode: 'dual', useZ: true});
  assert.ok(result);
  assert.equal(result.features.length, 126);
  assert.equal(result.handsPresent, 1);
  assert.ok(result.features.slice(63).every(value => value === 0));
});

test('landmark degenerat ditolak', () => {
  const hand = {landmarks: Array.from({length: 21}, () => ({x: 0.5, y: 0.5, z: 0}))};
  assert.equal(normalizeHands([hand], {featureMode: 'single'}), null);
  assert.equal(normalizeHands([], {featureMode: 'dual'}), null);
});

/* Waktu palsu supaya durasi tahan dapat diuji tanpa menunggu detik nyata. */
function makeClockSmoother(options = {}) {
  let clock = 1_000_000;
  const step = 240; // sama dengan irama inferensi UI (~4 sampel/detik)
  const smoother = new PredictionSmoother({
    ...ENGINE_CONFIG,
    cooldownMs: 0,
    ...options,
    now: () => clock
  });
  return {
    smoother,
    push(label, confidence = 0.93, advance = step) {
      clock += advance;
      return smoother.push(label == null ? null : {label, confidence});
    },
    advance(ms) {
      clock += ms;
    }
  };
}

const HOLD_PUSHES = 14; // 13 x 240 ms = 3,12 detik > stableHoldMs

test('butuh tahan beberapa detik sebelum kata diterima', () => {
  const clock = makeClockSmoother();
  let accepted = 0;
  for (let i = 0; i < 10; i++) {
    const result = clock.push('halo');
    if (result.accepted) accepted++;
  }
  // 10 sampel hanya menutup ~2,16 detik, belum melewati stableHoldMs.
  assert.equal(accepted, 0);
  for (let i = 0; i < 4; i++) {
    if (clock.push('halo').accepted) accepted++;
  }
  assert.equal(accepted, 1);
});

test('satu isyarat stabil hanya menghasilkan satu kata', () => {
  const clock = makeClockSmoother();
  let accepted = 0;
  for (let i = 0; i < 20; i++) {
    if (clock.push('halo').accepted) accepted++;
  }
  assert.equal(accepted, 1);
});

test('label tampilan tetap saat tangan masih ditahan', () => {
  const clock = makeClockSmoother();
  for (let i = 0; i < HOLD_PUSHES; i++) clock.push('halo');
  // Prediksi sesekali berbeda belum boleh mengubah label yang terkunci.
  let stableLabel = null;
  for (let i = 0; i < 4; i++) {
    const result = clock.push('tolong');
    if (result.stable) stableLabel = result.label;
  }
  assert.equal(stableLabel, 'halo');
});

test('confidence rendah tidak pernah diterima', () => {
  const clock = makeClockSmoother();
  let accepted = 0;
  for (let i = 0; i < 20; i++) {
    if (clock.push('halo', 0.54).accepted) accepted++;
  }
  assert.equal(accepted, 0);
});

test('label baru diterima setelah tangan dilepas', () => {
  const clock = makeClockSmoother();
  for (let i = 0; i < HOLD_PUSHES; i++) clock.push('halo');
  clock.push(null);
  let accepted = 0;
  for (let i = 0; i < HOLD_PUSHES; i++) {
    if (clock.push('tolong').accepted) accepted++;
  }
  assert.equal(accepted, 1);
});

test('label baru diterima setelah label lain bertahan cukup lama', () => {
  const clock = makeClockSmoother({releaseMs: 600, stableHoldMs: 700, smoothingMinVotes: 2});
  for (let i = 0; i < 5; i++) clock.push('halo');
  let accepted = 0;
  for (let i = 0; i < 8; i++) {
    if (clock.push('tolong').accepted) accepted++;
  }
  assert.equal(accepted, 1);
});

test('cooldown mencegah dua kata terlalu cepat', () => {
  const clock = makeClockSmoother({stableHoldMs: 500, smoothingMinVotes: 2, cooldownMs: 1800});
  let accepted = 0;
  for (let i = 0; i < 4; i++) {
    if (clock.push('halo', 0.95).accepted) accepted++;
  }
  clock.push(null);
  // Ganti isyarat dalam < cooldown: belum boleh diterima.
  for (let i = 0; i < 4; i++) {
    if (clock.push('maaf', 0.95).accepted) accepted++;
  }
  assert.equal(accepted, 1);
  clock.advance(2000);
  for (let i = 0; i < 4; i++) {
    if (clock.push('maaf', 0.95).accepted) accepted++;
  }
  assert.equal(accepted, 2);
});

test('mayoritas label harus menang dalam jendela', () => {
  const clock = makeClockSmoother();
  const sequence = ['halo', 'halo', 'tolong', 'halo', 'tolong', 'tolong', 'halo', 'tolong'];
  const acceptedLabels = [];
  for (let round = 0; round < 3; round++) {
    for (const label of sequence) {
      const result = clock.push(label, 0.9);
      if (result.accepted) acceptedLabels.push(result.label);
    }
  }
  // Prediksi yang bergantian tidak boleh menghasilkan dua kata sekaligus.
  assert.ok(acceptedLabels.length <= 1);
});

console.log(`\nLULUS: ${passed} pengujian logika engine (normalisasi + smoothing).`);
console.log('CATATAN: MediaPipe, kamera, dan classifier C tetap harus diuji di browser.');
