/* Engine pengenalan Isyarat (Anggota B).
 *
 * Kontrak dengan frontend A (lihat public/js/ui/engine-bridge.js):
 *   await initEngine();
 *   const result = await processFrame(videoElement);
 *   result = {status:'no_hand'|'low_confidence'|'ok', label, confidence, accepted}
 *
 * Kontrak dengan classifier C (public/js/ml/classifier.js) menerima salah satu bentuk:
 *   1. export async function loadClassifier({modelUrl, vocabUrl}) -> { predict(features) }
 *   2. export async function createClassifier({modelUrl}) -> { predict(features) }
 *   3. export async function loadModel(modelUrl) + export function predict(features)
 *   4. export function predict(features)  // modul memuat modelnya sendiri
 *   5. export default { predict(features) }
 *
 * predict() harus mengembalikan {label: string, confidence: number 0..1}.
 * Engine tidak memakai classifier tiruan. Bila classifier/model belum ada,
 * initEngine() melempar EngineError dengan kode yang jelas.
 */
import {ENGINE_CONFIG} from './config.js';
import {EngineError, ENGINE_ERROR_CODES} from './errors.js';
import {initHandDetector, detectHands, getActiveDelegate} from './hand-detector.js';
import {normalizeHands, expectedFeatureSize} from './normalize.js';
import {PredictionSmoother} from './smoother.js';

const NO_HAND = Object.freeze({status: 'no_hand', label: null, confidence: 0, accepted: false});

let ready = false;
let initializing = null;
let classifier = null;
let vocabIds = null;
let smoother = null;
let lastVideoTime = -1;
let lastTimestamp = 0;
let lastResult = {...NO_HAND};
let processing = false;

function normalizePrediction(prediction) {
  const label = prediction?.label == null ? null : String(prediction.label);
  const confidence = Number(prediction?.confidence);
  if (!label || !Number.isFinite(confidence)) {
    throw new EngineError(
      ENGINE_ERROR_CODES.PREDICTION_INVALID,
      'Classifier mengembalikan hasil tanpa label/confidence yang valid.'
    );
  }
  return {label, confidence: Math.min(1, Math.max(0, confidence))};
}

async function resolveClassifier(module) {
  const modelUrl = ENGINE_CONFIG.knnModelUrl;

  if (typeof module.loadClassifier === 'function') {
    const instance = await module.loadClassifier({modelUrl, vocabUrl: ENGINE_CONFIG.vocabUrl});
    if (instance && typeof instance.predict === 'function') return instance;
  }

  if (typeof module.createClassifier === 'function') {
    const instance = await module.createClassifier({modelUrl, vocabUrl: ENGINE_CONFIG.vocabUrl});
    if (instance && typeof instance.predict === 'function') return instance;
  }

  if (typeof module.loadModel === 'function') {
    if (typeof module.predict === 'function') {
      await module.loadModel(modelUrl);
      return {predict: features => module.predict(features)};
    }
    const loaded = await module.loadModel(modelUrl);
    if (loaded && typeof loaded.predict === 'function') return loaded;
  }

  if (typeof module.predict === 'function') return {predict: features => module.predict(features)};
  if (module.default && typeof module.default.predict === 'function') {
    return {predict: features => module.default.predict(features)};
  }

  throw new EngineError(
    ENGINE_ERROR_CODES.CLASSIFIER_CONTRACT,
    'Modul classifier tidak mengekspor loadClassifier/createClassifier/loadModel+predict sesuai kontrak.'
  );
}

async function loadClassifier() {
  let module;
  try {
    // URL relatif terhadap modul engine: bekerja di browser maupun Node (untuk uji).
    module = await import(new URL(ENGINE_CONFIG.classifierUrl, import.meta.url).href);
  } catch (error) {
    throw new EngineError(
      ENGINE_ERROR_CODES.CLASSIFIER_MISSING,
      'Classifier C belum tersedia: buat public/js/ml/classifier.js sesuai kontrak.',
      error
    );
  }

  try {
    const instance = await resolveClassifier(module);
    // Validasi dimensi fitur satu kali bila classifier menyediakan informasinya.
    const expected = expectedFeatureSize();
    if (Number.isFinite(instance.featureSize) && instance.featureSize !== expected) {
      throw new EngineError(
        ENGINE_ERROR_CODES.FEATURE_INVALID,
        `Ukuran fitur classifier (${instance.featureSize}) tidak sama dengan engine (${expected}).`
      );
    }
    return instance;
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw new EngineError(
      ENGINE_ERROR_CODES.KNN_MODEL_LOAD_FAILED,
      'Model KNN gagal dimuat dari /models/knn-model.json. Jalankan npm run ml:train.',
      error
    );
  }
}

async function loadVocabIds() {
  try {
    const response = await fetch(ENGINE_CONFIG.vocabUrl, {cache: 'no-store'});
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    const ids = new Set(data.map(item => item?.id).filter(id => typeof id === 'string' && id));
    return ids.size ? ids : null;
  } catch {
    // Vocab bersifat validasi tambahan; engine tetap bisa berjalan tanpa itu.
    return null;
  }
}

export async function initEngine() {
  if (ready) return;
  if (initializing) return initializing;

  initializing = (async () => {
    smoother = new PredictionSmoother(ENGINE_CONFIG);
    // Classifier dimuat lebih dahulu agar kekurangan berkas C cepat terdeteksi
    // sebelum mengunduh/memuat aset MediaPipe yang besar.
    classifier = await loadClassifier();
    await initHandDetector();
    vocabIds = await loadVocabIds();
    ready = true;
  })().catch(error => {
    initializing = null;
    ready = false;
    if (error instanceof EngineError) throw error;
    throw new EngineError(
      ENGINE_ERROR_CODES.ENGINE_INIT_FAILED,
      'Engine gagal diinisialisasi.',
      error
    );
  });

  return initializing;
}

/**
 * @param {HTMLVideoElement} video
 * @returns {Promise<{status:'no_hand'|'low_confidence'|'ok', label:string|null, confidence:number, accepted:boolean}>}
 */
export async function processFrame(video) {
  if (!ready) {
    throw new EngineError(ENGINE_ERROR_CODES.ENGINE_NOT_READY, 'Panggil initEngine() sebelum processFrame().');
  }
  if (!video || video.readyState < 2) return {...NO_HAND};
  if (processing) return {...lastResult, accepted: false};

  processing = true;
  try {
    // Jangan proses ulang frame yang sama; hemat CPU dan cegah duplikasi.
    if (video.currentTime === lastVideoTime && lastResult) {
      return {...lastResult, accepted: false};
    }
    lastVideoTime = video.currentTime;

    let timestamp = performance.now();
    if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
    lastTimestamp = timestamp;

    const detection = await detectHands(video, timestamp);
    const rawHands = Array.isArray(detection?.landmarks) ? detection.landmarks : [];
    const hands = rawHands
      .map((landmarks, index) => ({
        landmarks,
        handedness: detection.handedness?.[index]?.[0]?.categoryName || null,
        score: detection.handedness?.[index]?.[0]?.score ?? 1
      }))
      .filter(hand => Array.isArray(hand.landmarks) && hand.landmarks.length > 0);

    if (hands.length === 0) {
      smoother.push(null);
      lastResult = {...NO_HAND};
      return lastResult;
    }

    const normalized = normalizeHands(hands, ENGINE_CONFIG);
    if (!normalized) {
      smoother.push(null);
      lastResult = {...NO_HAND};
      return lastResult;
    }

    let prediction;
    try {
      prediction = await classifier.predict(normalized.features);
    } catch (error) {
      if (error instanceof EngineError) throw error;
      throw new EngineError(
        ENGINE_ERROR_CODES.PREDICTION_FAILED,
        'Classifier gagal memprediksi fitur tangan.',
        error
      );
    }

    const {label, confidence} = normalizePrediction(prediction);

    // Label asing (tidak ada di vocab) tidak boleh menambah kata.
    if (vocabIds && !vocabIds.has(label)) {
      smoother.push(null);
      lastResult = {status: 'low_confidence', label, confidence, accepted: false};
      return lastResult;
    }

    const decision = smoother.push({label, confidence});
    // Tampilkan hasil jendela stabil, bukan prediksi frame tunggal, supaya
    // label dan skor tidak berubah-ubah saat tangan sedikit bergerak.
    const displayLabel = decision.label ?? label;
    const displayConfidence = decision.confidence;
    const status = decision.stable && displayConfidence >= ENGINE_CONFIG.confidenceThreshold
      ? 'ok'
      : 'low_confidence';
    const accepted = decision.accepted && decision.stable && status === 'ok';

    lastResult = {
      status,
      label: displayLabel,
      confidence: displayConfidence,
      accepted
    };
    return lastResult;
  } finally {
    processing = false;
  }
}

export function resetEngineState() {
  smoother?.reset();
  lastVideoTime = -1;
  lastTimestamp = 0;
  lastResult = {...NO_HAND};
}

export function getEngineInfo() {
  return {
    ready,
    delegate: getActiveDelegate(),
    featureMode: ENGINE_CONFIG.featureMode,
    featureSize: expectedFeatureSize(),
    confidenceThreshold: ENGINE_CONFIG.confidenceThreshold,
    vocabLabels: vocabIds ? vocabIds.size : null
  };
}
