/* Konfigurasi engine Isyarat (Anggota B).
 * Semua nilai yang memengaruhi kontrak fitur HARUS disepakati dengan C.
 * Ubah featureMode hanya jika model KNN dilatih dengan mode yang sama.
 */
export const ENGINE_CONFIG = Object.freeze({
  /* Aset lokal (tanpa CDN) */
  vendorBase: '/vendor/mediapipe',
  modelUrl: '/models/hand_landmarker.task',
  classifierUrl: '../ml/classifier.js',
  knnModelUrl: '/models/knn-model.json',
  vocabUrl: '/data/vocab.json',

  /* MediaPipe Hand Landmarker */
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  delegate: 'CPU', // CPU lebih kompatibel; GPU bisa dipaksa via ?delegate=gpu

  /* Format fitur bersama B-C.
   * 'dual'   -> 126 nilai (2 x 21 landmark x 3), urut kiri-ke-kanan layar.
   * 'single' -> 63 nilai (1 tangan dominan).
   */
  featureMode: 'dual',
  useZ: true,

  /* Klasifikasi dan stabilisasi (PRD 3.2.5 - 3.2.6).
   * Prediksi baru dianggap "stabil" setelah isyarat ditahan konsisten selama
   * stableHoldMs, bukan hanya beberapa frame. Tujuannya agar hasil tidak
   * berubah-ubah saat tangan sedikit bergerak.
   */
  confidenceThreshold: 0.7,
  stableHoldMs: 2600,        // durasi tahan minimal sebelum kata diterima
  smoothingWindow: 16,       // batas jumlah sampel yang disimpan
  smoothingMinVotes: 6,      // minimal sampel sepakat di dalam jendela tahan
  smoothingMinRatio: 0.75,   // porsi label teratas di dalam jendela tahan
  releaseMs: 1400,           // label berbeda selama ini -> kunci dilepas
  cooldownMs: 1800,

  /* Batas waktu antar frame; jika kamera macet, buffer stabilisasi direset. */
  maxFrameGapMs: 900
});

export function featureSizeFor(mode = ENGINE_CONFIG.featureMode) {
  const perHand = 21 * (ENGINE_CONFIG.useZ ? 3 : 2);
  return mode === 'dual' ? perHand * 2 : perHand;
}
