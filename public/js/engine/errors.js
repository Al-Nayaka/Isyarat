/* Error engine dengan kode stabil agar frontend bisa membedakan penyebab. */
export class EngineError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = 'EngineError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export const ENGINE_ERROR_CODES = Object.freeze({
  MEDIAPIPE_LOAD_FAILED: 'MEDIAPIPE_LOAD_FAILED',
  MEDIAPIPE_INVALID: 'MEDIAPIPE_INVALID',
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  KNN_MODEL_LOAD_FAILED: 'KNN_MODEL_LOAD_FAILED',
  CLASSIFIER_MISSING: 'CLASSIFIER_MISSING',
  CLASSIFIER_CONTRACT: 'CLASSIFIER_CONTRACT',
  ENGINE_INIT_FAILED: 'ENGINE_INIT_FAILED',
  ENGINE_NOT_READY: 'ENGINE_NOT_READY',
  PREDICTION_FAILED: 'PREDICTION_FAILED',
  PREDICTION_INVALID: 'PREDICTION_INVALID',
  FEATURE_INVALID: 'FEATURE_INVALID'
});
