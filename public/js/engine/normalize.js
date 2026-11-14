/* Normalisasi landmark tangan (Anggota B).
 *
 * Kontrak fitur (WAJIB sama dengan recorder dan training C):
 * - Satu tangan: 21 landmark x 3 (x, y, z) = 63 nilai.
 * - Dua tangan : 126 nilai, slot 1 = tangan paling kiri di layar.
 * - Titik acuan : wrist (landmark 0) menjadi (0, 0, 0).
 * - Skala       : jarak Euclidean terbesar wrist -> landmark lain = 1.
 * - Tangan yang tidak terlihat diisi nol (padding) agar dimensi tetap.
 * - Koordinat TIDAK dibalik. Video hanya dicerminkan secara visual oleh CSS;
 *   MediaPipe memproses piksel asli sehingga x landmark tetap koordinat kamera.
 */
import {ENGINE_CONFIG, featureSizeFor} from './config.js';

export const LANDMARKS_PER_HAND = 21;

function wristRelativeVector(landmarks, useZ) {
  if (!Array.isArray(landmarks) || landmarks.length < LANDMARKS_PER_HAND) return null;
  const wrist = landmarks[0];
  if (!wrist || !Number.isFinite(wrist.x) || !Number.isFinite(wrist.y)) return null;

  let maxDistance = 0;
  for (let i = 1; i < LANDMARKS_PER_HAND; i++) {
    const point = landmarks[i];
    const dx = point.x - wrist.x;
    const dy = point.y - wrist.y;
    const dz = useZ ? (point.z || 0) - (wrist.z || 0) : 0;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > maxDistance) maxDistance = distance;
  }

  // Landmark degenerat (semua titik menumpuk) tidak layak dijadikan sampel.
  if (!Number.isFinite(maxDistance) || maxDistance < 1e-4) return null;

  const vector = [];
  for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
    const point = landmarks[i];
    vector.push((point.x - wrist.x) / maxDistance);
    vector.push((point.y - wrist.y) / maxDistance);
    if (useZ) vector.push(((point.z || 0) - (wrist.z || 0)) / maxDistance);
  }
  return vector;
}

function handCenterX(hand) {
  const points = hand.landmarks;
  let total = 0;
  for (const point of points) total += point.x;
  return total / points.length;
}

function boundingArea(hand) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of hand.landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

/**
 * @param {Array<{landmarks:Array<{x:number,y:number,z?:number}>, handedness?:string}>} hands
 * @param {object} [options]
 * @returns {{features:number[], mode:string, featureSize:number, handsPresent:number}|null}
 */
export function normalizeHands(hands, options = {}) {
  const mode = options.featureMode || ENGINE_CONFIG.featureMode;
  const useZ = options.useZ ?? ENGINE_CONFIG.useZ;
  if (!Array.isArray(hands) || hands.length === 0) return null;

  const usable = hands
    .filter(hand => Array.isArray(hand?.landmarks) && hand.landmarks.length >= LANDMARKS_PER_HAND)
    .map(hand => ({...hand, area: boundingArea(hand), centerX: handCenterX(hand)}));
  if (usable.length === 0) return null;

  const perHandSize = LANDMARKS_PER_HAND * (useZ ? 3 : 2);

  if (mode === 'single') {
    // Ambil tangan terbesar (paling dekat kamera) supaya stabil.
    const dominant = usable.reduce((best, hand) => (hand.area > best.area ? hand : best), usable[0]);
    const vector = wristRelativeVector(dominant.landmarks, useZ);
    if (!vector) return null;
    return {
      features: vector,
      mode: 'single',
      featureSize: perHandSize,
      handsPresent: 1
    };
  }

  // Mode dual: urutkan berdasarkan posisi horizontal layar, bukan label handedness,
  // karena label MediaPipe dapat terbalik pada kamera depan.
  const ordered = [...usable].sort((a, b) => a.centerX - b.centerX).slice(0, 2);
  const slots = [];
  let handsPresent = 0;
  for (const hand of ordered) {
    const vector = wristRelativeVector(hand.landmarks, useZ);
    if (!vector) continue;
    slots.push(vector);
    handsPresent++;
  }
  if (handsPresent === 0) return null;
  while (slots.length < 2) slots.push(new Array(perHandSize).fill(0));

  return {
    features: slots[0].concat(slots[1]),
    mode: 'dual',
    featureSize: perHandSize * 2,
    handsPresent
  };
}

export function expectedFeatureSize(mode = ENGINE_CONFIG.featureMode) {
  return featureSizeFor(mode);
}
