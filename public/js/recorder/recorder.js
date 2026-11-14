/* Perekam dataset (Anggota B).
 * Menyimpan vektor landmark ternormalisasi (bukan video) ke JSONL lokal.
 */
import {
  activateCamera,
  attachCamera,
  deactivateCamera,
  getCameraStream,
  getCameraFacing,
  switchCamera,
  cameraSecureContext,
  mapCameraError
} from '/js/ui/camera.js';
import {ENGINE_CONFIG, featureSizeFor} from '/js/engine/config.js';
import {initHandDetector, detectHands, getActiveDelegate} from '/js/engine/hand-detector.js';
import {normalizeHands} from '/js/engine/normalize.js';

const $ = selector => document.querySelector(selector);
const video = $('#recorder-video');
const canvas = $('#landmark-canvas');
const ctx = canvas.getContext('2d');
const placeholder = $('#preview-placeholder');
const statusEl = $('#recorder-status');
const toastEl = $('#recorder-toast');
const badge = $('#detector-badge');

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

const state = {
  samples: [],
  recording: false,
  sessionId: null,
  sessionCount: 0,
  rafId: 0,
  busy: false,
  lastDetectAt: 0,
  lastSampleAt: 0,
  lastTimestamp: 0,
  latestHands: []
};

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3000);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function numberInput(selector, fallback) {
  const value = Number($(selector).value);
  return Number.isFinite(value) ? value : fallback;
}

function readMeta() {
  const label = $('#input-label').value.trim().toLowerCase().replace(/\s+/g, '_');
  return {
    label,
    orang_id: $('#input-orang').value.trim() || 'P01',
    kondisi: {
      cahaya: $('#input-cahaya').value,
      jarak: $('#input-jarak').value,
      latar: $('#input-latar').value
    }
  };
}

function syncMirror() {
  const mirrored = getCameraFacing() === 'user';
  video.classList.toggle('mirror', mirrored);
  canvas.classList.toggle('mirror', mirrored);
}

function containedRect() {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const vw = video.videoWidth || cw;
  const vh = video.videoHeight || ch;
  const scale = Math.min(cw / vw, ch / vh);
  const width = vw * scale;
  const height = vh * scale;
  return {x: (cw - width) / 2, y: (ch - height) / 2, width, height};
}

function drawOverlay(hands) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (!cw || !ch) return;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!hands.length) return;

  const rect = containedRect();
  if (!rect.width || !rect.height) return;
  const point = landmark => ({
    x: rect.x + landmark.x * rect.width,
    y: rect.y + landmark.y * rect.height
  });

  for (const hand of hands) {
    const landmarks = hand.landmarks;
    ctx.strokeStyle = 'rgba(255,200,61,.9)';
    ctx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
      if (!landmarks[a] || !landmarks[b]) continue;
      const p1 = point(landmarks[a]);
      const p2 = point(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#28c987';
    for (const landmark of landmarks) {
      const p = point(landmark);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

async function startCameraFlow() {
  if (!cameraSecureContext()) {
    setStatus('Kamera membutuhkan localhost atau HTTPS tepercaya.', true);
    return;
  }
  const button = $('#btn-camera');
  button.disabled = true;
  setStatus('Meminta izin kamera…');
  try {
    await activateCamera();
    attachCamera(video);
    placeholder.hidden = true;
    syncMirror();
    setStatus('Memuat MediaPipe…');
    await initHandDetector();
    badge.textContent = `MediaPipe: siap (${getActiveDelegate() || 'CPU'})`;
    setStatus('Kamera aktif. Peragakan isyarat di dalam bingkai.');
    startLoop();
  } catch (error) {
    const mapped = mapCameraError(error);
    const messages = {
      denied: 'Izin kamera ditolak. Ubah izin kamera di browser lalu coba lagi.',
      missing: 'Kamera tidak ditemukan pada perangkat ini.',
      busy: 'Kamera sedang dipakai aplikasi lain.',
      insecure: 'Alamat HTTP Wi-Fi tidak bisa mengakses kamera HP.',
      unsupported: 'Browser ini tidak mendukung kamera.',
      unknown: `Kamera gagal dibuka: ${error?.message || error}`
    };
    setStatus(messages[mapped] || messages.unknown, true);
    deactivateCamera();
  } finally {
    button.disabled = false;
  }
}

function pushSample(hands) {
  const meta = readMeta();
  if (!/^[a-z0-9_]+$/.test(meta.label)) {
    toast('Label hanya boleh huruf kecil, angka, dan garis bawah.');
    return false;
  }
  const normalized = normalizeHands(hands, ENGINE_CONFIG);
  if (!normalized) {
    toast('Tangan belum terlihat jelas. Coba lagi.');
    return false;
  }

  const sample = {
    label: meta.label,
    landmarks: normalized.features.map(value => Number(value.toFixed(6))),
    feature_mode: normalized.mode,
    feature_size: normalized.featureSize,
    tangan_terlihat: normalized.handsPresent,
    orang_id: meta.orang_id,
    kondisi: meta.kondisi,
    sumber: 'recorder-b',
    versi_normalisasi: '1.0',
    dicatat_pada: new Date().toISOString()
  };
  state.samples.push(sample);
  if (state.recording) state.sessionCount++;
  state.lastSampleAt = performance.now();
  updateStats();
  renderSampleList();
  if (state.recording) {
    const target = Math.max(1, numberInput('#input-target', 30));
    if (state.sessionCount >= target) {
      stopRecording(`Selesai: ${state.sessionCount} sampel “${meta.label}” (${meta.orang_id}).`);
    } else {
      setStatus(`Merekam “${meta.label}” — ${state.sessionCount}/${target} sampel.`);
    }
  }
  return true;
}

function startLoop() {
  if (state.rafId) return;
  const tick = () => {
    state.rafId = requestAnimationFrame(tick);
    if (state.busy || !getCameraStream() || video.readyState < 2) return;
    const now = performance.now();
    if (now - state.lastDetectAt < 120) return;
    state.lastDetectAt = now;

    let timestamp = now;
    if (timestamp <= state.lastTimestamp) timestamp = state.lastTimestamp + 1;
    state.lastTimestamp = timestamp;

    state.busy = true;
    detectHands(video, timestamp)
      .then(result => {
        const rawHands = Array.isArray(result?.landmarks) ? result.landmarks : [];
        state.latestHands = rawHands.map(landmarks => ({landmarks}));
        drawOverlay(state.latestHands);
        $('#stat-hands').textContent = `Tangan: ${rawHands.length}`;
        if (!rawHands.length && state.recording) {
          setStatus('Tangan belum terlihat. Arahkan kedua tangan ke kamera.');
        }
        if (state.recording && rawHands.length) {
          const interval = Math.max(150, numberInput('#input-interval', 300));
          if (now - state.lastSampleAt >= interval) pushSample(state.latestHands);
        }
      })
      .catch(error => {
        setStatus(`Deteksi gagal: ${error?.message || error}`, true);
        stopRecording();
      })
      .finally(() => {
        state.busy = false;
      });
  };
  state.rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  drawOverlay([]);
}

function startRecording() {
  if (!getCameraStream()) {
    toast('Aktifkan kamera terlebih dahulu.');
    return;
  }
  const meta = readMeta();
  if (!/^[a-z0-9_]+$/.test(meta.label)) {
    toast('Label tidak valid.');
    return;
  }
  state.recording = true;
  state.sessionId = Date.now();
  state.sessionCount = 0;
  state.lastSampleAt = 0;
  $('#btn-record').textContent = 'Stop rekam';
  setStatus(`Merekam “${meta.label}” — 0/${Math.max(1, numberInput('#input-target', 30))} sampel.`);
}

function stopRecording(message) {
  if (!state.recording) return;
  state.recording = false;
  $('#btn-record').textContent = 'Mulai rekam';
  updateProgress();
  if (message) setStatus(message);
  else setStatus('Perekaman dihentikan. Sampel yang sudah masuk tetap tersimpan.');
}

function updateProgress() {
  const target = Math.max(1, numberInput('#input-target', 30));
  const percent = state.recording ? Math.min(100, (state.sessionCount / target) * 100) : 0;
  $('#progress-bar').style.width = `${percent}%`;
  $('#stat-count').textContent = `Sampel: ${state.samples.length}`;
  $('#stat-feature').textContent = `Fitur: ${featureSizeFor()}`;
}

function renderSampleList() {
  const list = $('#sample-list');
  if (!state.samples.length) {
    list.innerHTML = '<div><span>Belum ada sampel.</span><span>—</span></div>';
    return;
  }
  const counts = new Map();
  for (const sample of state.samples) {
    const key = `${sample.orang_id} · ${sample.label}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  list.innerHTML = [...counts.entries()]
    .map(([key, count]) => `<div><strong>${key.replace(/[<>&]/g, '')}</strong><span>${count} sampel</span></div>`)
    .join('');
}

function downloadSamples() {
  if (!state.samples.length) {
    toast('Belum ada sampel untuk diunduh.');
    return;
  }
  const lines = state.samples.map(sample => JSON.stringify(sample)).join('\n');
  const blob = new Blob([lines + '\n'], {type: 'application/x-ndjson'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  anchor.href = url;
  anchor.download = `dataset-isyarat-${stamp}.jsonl`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`${state.samples.length} sampel diunduh.`);
}

async function loadLabels() {
  const options = $('#label-options');
  for (const path of ['/data/vocab.json', '/data/kosakata.contoh.json']) {
    try {
      const response = await fetch(path, {cache: 'no-store'});
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;
      options.innerHTML = data
        .filter(item => typeof item?.id === 'string')
        .map(item => `<option value="${item.id.replace(/"/g, '&quot;')}">${item.teks_tampil || item.id}</option>`)
        .join('');
      return;
    } catch {
      // coba berkas berikutnya
    }
  }
}

$('#btn-camera').addEventListener('click', () => {
  if (getCameraStream()) {
    stopRecording();
    stopLoop();
    deactivateCamera();
    placeholder.hidden = false;
    setStatus('Kamera dimatikan.');
    return;
  }
  startCameraFlow();
});

$('#btn-switch').addEventListener('click', async () => {
  if (!getCameraStream()) {
    toast('Aktifkan kamera terlebih dahulu.');
    return;
  }
  try {
    await switchCamera();
    attachCamera(video);
    syncMirror();
    toast('Kamera diganti.');
  } catch {
    toast('Tidak dapat mengganti kamera pada perangkat ini.');
  }
});

$('#btn-record').addEventListener('click', () => {
  if (state.recording) stopRecording();
  else startRecording();
});

$('#btn-sample').addEventListener('click', () => {
  if (!getCameraStream()) {
    toast('Aktifkan kamera terlebih dahulu.');
    return;
  }
  if (!state.latestHands.length) {
    toast('Tangan belum terdeteksi. Coba posisikan tangan di bingkai.');
    return;
  }
  if (pushSample(state.latestHands)) toast('1 sampel ditambahkan.');
});

$('#btn-download').addEventListener('click', downloadSamples);

$('#btn-clear').addEventListener('click', () => {
  if (!state.samples.length) return;
  if (!window.confirm(`Hapus ${state.samples.length} sampel dari memori? Unduh dahulu bila belum disimpan.`)) return;
  state.samples = [];
  state.sessionCount = 0;
  updateProgress();
  renderSampleList();
  toast('Sampel dihapus dari memori.');
});

$('#input-target').addEventListener('input', updateProgress);
window.addEventListener('pagehide', () => {
  stopRecording();
  stopLoop();
  deactivateCamera();
});

updateProgress();
renderSampleList();
loadLabels();
if (!cameraSecureContext()) {
  setStatus('Halaman ini bukan secure context. Kamera hanya aktif di localhost atau HTTPS.', true);
}
