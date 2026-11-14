/* KNN Classifier Isyarat (Anggota C).
 *
 * Format model (public/models/knn-model.json):
 * {
 *   "format": "isyarat-knn-v1",
 *   "version": 1,
 *   "createdAt": "ISO-8601",
 *   "featureMode": "dual",
 *   "featureSize": 126,
 *   "normalizationVersion": "1.0",
 *   "metric": "euclidean",
 *   "k": 5,
 *   "labels": ["halo", "tolong"],
 *   "classCounts": {"halo": 90, "tolong": 90},
 *   "participants": ["P01", "P02"],
 *   "samples": [{"label": "halo", "features": [ ... ]}]
 * }
 *
 * Kontrak ke engine B: predict(features) -> {label, confidence 0..1}
 * Confidence = pangsa bobot jarak dari k tetangga terdekat (bukan akurasi model).
 */

const DEFAULT_K = 5;
const EPSILON = 1e-6;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateModel(model) {
  assert(model && typeof model === 'object', 'Model KNN harus berupa objek JSON.');
  assert(Array.isArray(model.samples) && model.samples.length > 0, 'Model KNN tidak memiliki sampel training.');
  assert(Number.isInteger(model.featureSize) && model.featureSize > 0, 'featureSize model tidak valid.');

  const size = model.featureSize;
  for (let index = 0; index < model.samples.length; index++) {
    const sample = model.samples[index];
    assert(sample && typeof sample.label === 'string' && sample.label.length > 0, `Sampel #${index} tidak memiliki label.`);
    assert(Array.isArray(sample.features) && sample.features.length === size, `Sampel #${index} memiliki dimensi fitur yang salah.`);
  }
}

/**
 * Membuat classifier dari objek model (dipakai juga oleh script training/evaluasi).
 * @param {object} model
 * @param {{k?:number}} [options]
 */
export function createClassifierFromModel(model, options = {}) {
  validateModel(model);

  const size = model.featureSize;
  const labels = Array.isArray(model.labels) && model.labels.length
    ? [...model.labels]
    : [...new Set(model.samples.map(sample => sample.label))].sort();

  const samples = model.samples.map(sample => ({
    label: sample.label,
    features: Float64Array.from(sample.features, Number)
  }));

  const requestedK = Number.isInteger(options.k) ? options.k : Number.isInteger(model.k) ? model.k : DEFAULT_K;
  const k = Math.max(1, Math.min(requestedK, samples.length));

  function predictTopK(features, count) {
    assert(features && features.length === size, `Fitur harus memiliki ${size} nilai, diterima ${features?.length ?? 0}.`);

    const nearest = [];
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      let sum = 0;
      const values = sample.features;
      for (let i = 0; i < size; i++) {
        const delta = features[i] - values[i];
        sum += delta * delta;
      }
      const distance = Math.sqrt(sum);
      if (nearest.length < count) {
        nearest.push({label: sample.label, distance});
        nearest.sort((a, b) => a.distance - b.distance);
      } else if (distance < nearest[nearest.length - 1].distance) {
        nearest[nearest.length - 1] = {label: sample.label, distance};
        nearest.sort((a, b) => a.distance - b.distance);
      }
    }
    return nearest;
  }

  function predict(features) {
    const neighbors = predictTopK(features, k);
    assert(neighbors.length > 0, 'Tidak ada tetangga yang dapat dihitung.');

    const scores = new Map();
    let totalWeight = 0;
    for (const neighbor of neighbors) {
      // Bobot jarak terbalik; jarak 0 tetap menghasilkan bobot besar yang terbatas.
      const weight = 1 / (neighbor.distance * neighbor.distance + EPSILON);
      scores.set(neighbor.label, (scores.get(neighbor.label) || 0) + weight);
      totalWeight += weight;
    }

    let bestLabel = null;
    let bestScore = -1;
    for (const [label, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }

    const confidence = totalWeight > 0 ? Math.min(1, Math.max(0, bestScore / totalWeight)) : 0;
    return {
      label: bestLabel,
      confidence: Number(confidence.toFixed(4)),
      nearest: neighbors.map(neighbor => ({
        label: neighbor.label,
        distance: Number(neighbor.distance.toFixed(4))
      }))
    };
  }

  return {
    featureSize: size,
    k,
    labels,
    modelFormat: model.format || null,
    predict,
    predictTopK
  };
}

/**
 * Dipanggil engine B melalui kontrak:
 *   const classifier = await loadClassifier({modelUrl, vocabUrl});
 *   classifier.predict(features)
 */
export async function loadClassifier({modelUrl = '/models/knn-model.json', vocabUrl = null} = {}) {
  let response;
  try {
    response = await fetch(modelUrl, {cache: 'no-store'});
  } catch (error) {
    throw new Error(`Model KNN tidak dapat diunduh dari ${modelUrl}.`, {cause: error});
  }
  if (!response.ok) {
    throw new Error(`Model KNN tidak ditemukan di ${modelUrl} (HTTP ${response.status}).`);
  }

  let model;
  try {
    model = await response.json();
  } catch (error) {
    throw new Error(`Model KNN di ${modelUrl} bukan JSON yang valid.`, {cause: error});
  }

  const classifier = createClassifierFromModel(model);

  if (vocabUrl && Array.isArray(model.labels)) {
    try {
      const vocabResponse = await fetch(vocabUrl, {cache: 'no-store'});
      if (vocabResponse.ok) {
        const vocab = await vocabResponse.json();
        const vocabIds = new Set(Array.isArray(vocab) ? vocab.map(item => item?.id) : []);
        const missing = model.labels.filter(label => !vocabIds.has(label));
        if (missing.length) {
          console.warn('Isyarat ML: label model tidak ada di vocab.json:', missing.join(', '));
        }
      }
    } catch {
      // Validasi vocab bersifat peringatan; engine tetap memuat model.
    }
  }

  return classifier;
}
