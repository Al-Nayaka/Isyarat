/* Stabilisasi prediksi (Anggota B).
 *
 * Tujuan (PRD 3.2.6):
 * - Satu isyarat stabil hanya menambah satu kata.
 * - Kata yang sama tidak boleh diterima berulang selama tangan ditahan.
 * - Kata baru diterima setelah isyarat ditahan konsisten selama stableHoldMs
 *   (beberapa detik), bukan hanya beberapa frame. Ini membuat hasil tidak
 *   berubah-ubah saat tangan sedikit bergerak.
 * - Label yang sudah terkunci tetap ditampilkan sampai tangan dilepas atau
 *   label lain muncul terus-menerus selama releaseMs.
 */
import {ENGINE_CONFIG} from './config.js';

const NEUTRAL = Object.freeze({accepted: false, stable: false, label: null, confidence: 0, progress: 0});

export class PredictionSmoother {
  constructor(options = {}) {
    this.windowSize = options.smoothingWindow ?? ENGINE_CONFIG.smoothingWindow;
    this.minVotes = options.smoothingMinVotes ?? ENGINE_CONFIG.smoothingMinVotes;
    this.minRatio = options.smoothingMinRatio ?? ENGINE_CONFIG.smoothingMinRatio;
    this.holdMs = options.stableHoldMs ?? ENGINE_CONFIG.stableHoldMs;
    this.releaseMs = options.releaseMs ?? ENGINE_CONFIG.releaseMs;
    this.cooldownMs = options.cooldownMs ?? ENGINE_CONFIG.cooldownMs;
    this.threshold = options.confidenceThreshold ?? ENGINE_CONFIG.confidenceThreshold;
    this.maxFrameGapMs = options.maxFrameGapMs ?? ENGINE_CONFIG.maxFrameGapMs;
    // Waktu dapat diganti pada pengujian; perilaku produksi tetap Date.now().
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.reset();
  }

  reset() {
    this.buffer = [];
    this.latchedLabel = null;
    this.otherSince = 0;
    this.lastAcceptedAt = 0;
    this.lastSampleAt = 0;
  }

  #vote(samples) {
    const stats = new Map();
    for (const item of samples) {
      const entry = stats.get(item.label) || {label: item.label, count: 0, sum: 0};
      entry.count++;
      entry.sum += item.confidence;
      stats.set(item.label, entry);
    }
    let best = null;
    for (const entry of stats.values()) {
      const avg = entry.sum / entry.count;
      if (!best || entry.count > best.count || (entry.count === best.count && avg > best.avgConfidence)) {
        best = {label: entry.label, count: entry.count, avgConfidence: avg};
      }
    }
    if (!best) return null;
    best.ratio = best.count / samples.length;
    return best;
  }

  #forget() {
    this.buffer = [];
    this.latchedLabel = null;
    this.otherSince = 0;
  }

  /**
   * @param {{label:string, confidence:number}|null} sample null = tidak ada tangan
   * @returns {{accepted:boolean, stable:boolean, label:string|null, confidence:number, progress:number}}
   */
  push(sample) {
    const now = this.now();

    if (!sample) {
      // Tangan hilang: isyarat berikutnya dihitung dari awal.
      this.#forget();
      this.lastSampleAt = now;
      return {...NEUTRAL};
    }

    if (this.lastSampleAt && now - this.lastSampleAt > this.maxFrameGapMs) {
      // Jeda panjang (frame macet/tab tidak aktif) bukan bagian isyarat yang sama.
      this.#forget();
    }
    this.lastSampleAt = now;

    if (this.latchedLabel && sample.label !== this.latchedLabel) {
      if (!this.otherSince) this.otherSince = now;
      if (now - this.otherSince >= this.releaseMs) {
        this.latchedLabel = null;
        this.otherSince = 0;
        this.buffer = [];
      }
    } else {
      this.otherSince = 0;
    }

    this.buffer.push({label: sample.label, confidence: sample.confidence, at: now});
    while (this.buffer.length > this.windowSize) this.buffer.shift();

    const holdStart = now - this.holdMs;
    const recent = this.buffer.filter(item => item.at >= holdStart);
    const best = this.#vote(recent);
    if (!best) return {...NEUTRAL};

    // Label yang sudah terkunci ditampilkan terus agar UI tidak berkedip,
    // walau sesekali ada prediksi lain. Kunci dilepas lewat releaseMs di atas.
    if (this.latchedLabel) {
      const locked = recent.filter(item => item.label === this.latchedLabel);
      const lockedConfidence = locked.length
        ? locked.reduce((total, item) => total + item.confidence, 0) / locked.length
        : best.avgConfidence;
      return {
        accepted: false,
        stable: true,
        label: this.latchedLabel,
        confidence: lockedConfidence,
        progress: 1
      };
    }

    const span = this.buffer.length ? now - this.buffer[0].at : 0;
    const progress = Math.max(0, Math.min(1, span / this.holdMs));
    const held = span >= this.holdMs
      && recent.length >= this.minVotes
      && best.ratio >= this.minRatio
      && best.avgConfidence >= this.threshold
      && sample.confidence >= this.threshold;

    if (!held) {
      return {
        accepted: false,
        stable: false,
        label: best.label,
        confidence: best.avgConfidence,
        progress
      };
    }

    // Kunci baru: cukup satu kali terima untuk satu isyarat yang ditahan.
    if (now - this.lastAcceptedAt < this.cooldownMs) {
      return {
        accepted: false,
        stable: true,
        label: best.label,
        confidence: best.avgConfidence,
        progress
      };
    }

    this.latchedLabel = best.label;
    this.lastAcceptedAt = now;
    return {
      accepted: true,
      stable: true,
      label: best.label,
      confidence: best.avgConfidence,
      progress: 1
    };
  }
}
