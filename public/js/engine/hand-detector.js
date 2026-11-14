/* Detektor tangan MediaPipe lokal (Anggota B). Tidak memakai CDN. */
import {ENGINE_CONFIG} from './config.js';
import {EngineError, ENGINE_ERROR_CODES} from './errors.js';

let landmarker = null;
let loadingPromise = null;
let activeDelegate = null;

function optionsFor(delegate) {
  return {
    baseOptions: {
      modelAssetPath: ENGINE_CONFIG.modelUrl,
      delegate
    },
    runningMode: 'VIDEO',
    numHands: ENGINE_CONFIG.numHands,
    minHandDetectionConfidence: ENGINE_CONFIG.minHandDetectionConfidence,
    minHandPresenceConfidence: ENGINE_CONFIG.minHandPresenceConfidence,
    minTrackingConfidence: ENGINE_CONFIG.minTrackingConfidence
  };
}

function preferredDelegates() {
  // Diagnostik: ?delegate=cpu atau ?delegate=gpu memaksa satu delegate.
  let requested = null;
  try {
    if (typeof location !== 'undefined') {
      requested = new URLSearchParams(location.search).get('delegate');
    }
  } catch { /* abaikan, pakai default */ }
  if (requested === 'cpu') return ['CPU'];
  if (requested === 'gpu') return ['GPU'];
  return [ENGINE_CONFIG.delegate, 'CPU'].filter((value, index, list) => list.indexOf(value) === index);
}

async function createLandmarker() {
  let vision;
  try {
    vision = await import(`${ENGINE_CONFIG.vendorBase}/vision_bundle.mjs`);
  } catch (error) {
    throw new EngineError(
      ENGINE_ERROR_CODES.MEDIAPIPE_LOAD_FAILED,
      'Berkas MediaPipe lokal tidak dapat dimuat dari /vendor/mediapipe/.',
      error
    );
  }

  const {FilesetResolver, HandLandmarker} = vision;
  if (typeof FilesetResolver?.forVisionTasks !== 'function' || typeof HandLandmarker?.createFromOptions !== 'function') {
    throw new EngineError(
      ENGINE_ERROR_CODES.MEDIAPIPE_INVALID,
      'API MediaPipe tidak sesuai. Periksa vision_bundle.mjs di /vendor/mediapipe/.'
    );
  }

  let fileset;
  try {
    fileset = await FilesetResolver.forVisionTasks(`${ENGINE_CONFIG.vendorBase}/wasm`);
  } catch (error) {
    throw new EngineError(
      ENGINE_ERROR_CODES.MEDIAPIPE_LOAD_FAILED,
      'WASM MediaPipe gagal dimuat. Pastikan /vendor/mediapipe/wasm/ lengkap.',
      error
    );
  }

  const delegates = preferredDelegates();
  let lastError = null;
  for (const delegate of delegates) {
    try {
      landmarker = await HandLandmarker.createFromOptions(fileset, optionsFor(delegate));
      activeDelegate = delegate;
      console.info(`Isyarat: MediaPipe hand detector aktif dengan delegate ${delegate}.`);
      return landmarker;
    } catch (error) {
      lastError = error;
    }
  }

  throw new EngineError(
    ENGINE_ERROR_CODES.MODEL_LOAD_FAILED,
    'Model hand_landmarker.task gagal dimuat. Periksa /models/hand_landmarker.task.',
    lastError
  );
}

export function getActiveDelegate() {
  return activeDelegate;
}

export function isHandDetectorReady() {
  return !!landmarker;
}

export async function initHandDetector() {
  if (landmarker) return landmarker;
  if (!loadingPromise) {
    loadingPromise = createLandmarker().catch(error => {
      loadingPromise = null;
      throw error;
    });
  }
  return loadingPromise;
}

/** @returns {{landmarks:Array, handedness:Array, worldLandmarks:Array}} */
export async function detectHands(video, timestampMs) {
  const detector = await initHandDetector();
  return detector.detectForVideo(video, timestampMs);
}

export function closeHandDetector() {
  if (landmarker && typeof landmarker.close === 'function') {
    try { landmarker.close(); } catch { /* diabaikan saat pembersihan */ }
  }
  landmarker = null;
  loadingPromise = null;
  activeDelegate = null;
}
