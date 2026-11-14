# Bagian B — Engine, Perekam Dataset, dan Offline (PWA)

Dokumen ini menjelaskan modul yang sudah diimplementasikan untuk Anggota B dan apa yang masih menjadi tanggung jawab Anggota C.

## 1. File yang dibuat/diubah

| File | Fungsi |
|---|---|
| `public/js/engine/config.js` | Semua parameter engine (fitur, threshold, smoothing, path aset) |
| `public/js/engine/errors.js` | `EngineError` dengan kode error yang bisa dibedakan frontend |
| `public/js/engine/normalize.js` | Normalisasi landmark menjadi vektor 63/126 nilai |
| `public/js/engine/smoother.js` | Voting jendela, latch, cooldown, release |
| `public/js/engine/hand-detector.js` | MediaPipe Hand Landmarker lokal (GPU → CPU fallback) |
| `public/js/engine/index.js` | `initEngine()` dan `processFrame(video)` sesuai kontrak |
| `public/recorder.html` + `public/js/recorder/recorder.js` | Perekam dataset → JSONL |
| `public/manifest.json`, `public/sw.js`, `public/icons/` | PWA dan cache offline |
| `public/vendor/mediapipe/` | MediaPipe `vision_bundle.mjs` + WASM (lokal, tanpa CDN) |
| `public/models/hand_landmarker.task` | Model deteksi tangan (lokal) |
| `server.mjs` | MIME `.mjs`, `.wasm`, `.task`, `.ndjson` |
| `docs/test-engine.mjs` | Uji logika normalisasi + smoothing tanpa browser |

## 2. Kontrak yang dipakai

Frontend A tidak berubah kontraknya:

```js
await initEngine();
const {status, label, confidence, accepted} = await processFrame(videoElement);
// status: 'no_hand' | 'low_confidence' | 'ok'
```

- `accepted: true` hanya sekali per isyarat stabil.
- Confidence selalu 0–1.
- Label harus sama dengan `id` pada `vocab.json`.
- Error inisialisasi membawa `error.code`, misalnya:
  - `MEDIAPIPE_LOAD_FAILED`
  - `MODEL_LOAD_FAILED` (model MediaPipe)
  - `KNN_MODEL_LOAD_FAILED` (model KNN belum dilatih)
  - `CLASSIFIER_MISSING`
  - `CLASSIFIER_CONTRACT`
  - `PREDICTION_INVALID`

## 3. Spesifikasi fitur (harus dipakai C saat training)

| Aturan | Nilai |
|---|---|
| Sumber | 21 landmark MediaPipe per tangan |
| Mode default | `dual` → 126 nilai (2 tangan × 21 × x,y,z) |
| Mode alternatif | `single` → 63 nilai (tangan dominan) |
| Titik acuan | Wrist (landmark 0) menjadi origin |
| Skala | Jarak terbesar wrist → landmark lain = 1 |
| Urutan dua tangan | Kiri ke kanan berdasarkan posisi layar |
| Tangan tidak terlihat | Slot diisi nol (padding) |
| Mirror | **Tidak** membalik koordinat; mirror hanya visual CSS |
| Presisi simpanan recorder | 6 desimal |

Mengubah `featureMode` atau `useZ` di `config.js` **wajib** diikuti training ulang model. Model yang dilatih dengan dimensi berbeda akan ditolak saat dimuat.

## 4. Klasifikasi dan stabilisasi

```text
confidenceThreshold = 0.70
stableHoldMs        = 2600 ms
smoothingWindow     = 16 sampel
smoothingMinVotes   = 6 sampel
smoothingMinRatio   = 0.75
releaseMs           = 1400 ms
cooldownMs          = 1800 ms
```

Aturan:

1. Frame dengan confidence < 0,70 tidak pernah menambah kata.
2. Isyarat harus ditahan konsisten minimal **2,6 detik**: minimal 6 sampel di
   jendela tahan, dan label pemenang mencakup ≥ 75% sampel.
3. Setelah diterima, label dikunci (latch) dan tetap ditampilkan sampai:
   - tangan hilang, atau
   - label lain muncul terus-menerus selama 1,4 detik.
4. Cooldown 1,8 detik mencegah dua kata terlalu cepat.
5. Label yang tidak ada di `vocab.json` tidak akan menambah kata.

Karena UI mengambil frame tiap ±240 ms, 2,6 detik berarti sekitar 11 sampel.
Waktu diperiksa dengan `Date.now()` (dapat diganti lewat opsi `now` pada
pengujian), bukan hanya jumlah frame, sehingga perilaku tetap sama bila laju
kamera berubah.

## 5. Status bagian C

`public/js/ml/classifier.js`, `ml/scripts/train-knn.mjs`,
`ml/scripts/extract-images.py`, `ml/scripts/extract-videos.py`,
`public/data/vocab.json`, dan `public/models/knn-model.json` sudah tersedia.
Model dilatih dari dua dataset publik: **BISINDO Word Dataset** (Kaggle,
CC BY 4.0, 5 kata) dan **WL-BISINDO** (Kaggle, CC BY-NC 4.0; 22 kata dipakai).
Total kosakata 27 label; rincian dan peringatan evaluasi: `docs/ML_C.md`.

Alur:

```bash
# Opsi A: ekstraksi landmark dari dataset gambar
python ml/scripts/extract-images.py --images "C:/path/dataset_kata" --out ml/data/raw/bisindo-word.jsonl
npm run ml:train

# Opsi B: rekam lewat /recorder.html, simpan JSONL ke ml/data/raw/
npm run ml:validate
npm run ml:train
```

Engine memuat model secara otomatis saat inisialisasi. Bila model hilang,
`initEngine()` gagal dengan `KNN_MODEL_LOAD_FAILED`; tidak ada prediksi tiruan
di mode produksi.

## 6. Cara memakai recorder dataset

1. `npm start`
2. Buka `http://localhost:5500/recorder.html`
3. Isi label (contoh `halo`), kode partisipan (`P01`), kondisi, target sampel.
4. Aktifkan kamera → tahan isyarat → **Mulai rekam**.
5. Unduh JSONL, simpan ke `ml/data/raw/`.
6. Ulangi untuk partisipan dan kondisi berbeda.

Contoh satu baris JSONL:

```json
{"label":"halo","landmarks":[0,0,0,"..."],"feature_mode":"dual","feature_size":126,"tangan_terlihat":2,"orang_id":"P01","kondisi":{"cahaya":"terang","jarak":"sedang","latar":"polos"},"sumber":"recorder-b","versi_normalisasi":"1.0","dicatat_pada":"2026-11-13T10:00:00.000Z"}
```

## 7. Offline / PWA

- Semua aset inti (HTML, CSS, JS, MediaPipe, model, ikon) ada di `public/`.
- Service Worker didaftarkan hanya pada secure context (`localhost` atau HTTPS).
- Strategi:
  - navigasi → network-first, fallback cache
  - aset statis → cache-first, lalu simpan ke cache
- Ubah `CACHE_VERSION` di `public/sw.js` setiap kali daftar aset berubah.
- Uji offline: buka aplikasi sekali → DevTools → Application → Service Workers (pastikan aktif) → Network → Offline → reload.

Catatan: halaman sekarang meng-cache `classifier.js`, `vocab.json`, dan `knn-model.json` sebagai aset opsional. Setelah C menambahkan berkas tersebut, naikkan `CACHE_VERSION` agar ikut ter-cache.

## 8. Pengujian

```bash
npm start
npm run test:syntax
npm run test:engine
npm run test:ui
```

`test:engine` menguji normalisasi dan smoothing murni (Node). Yang **belum** bisa diotomatiskan di sini:

- Kamera fisik dan izin browser
- Kualitas deteksi MediaPipe pada perangkat nyata
- Akurasi model KNN (menunggu C)
- Uji PWA mode pesawat

## 9. Batasan yang perlu disebut jujur

1. MediaPipe hanya mendeteksi tangan, bukan lengan/tubuh/ekspresi wajah.
2. Mode `dual` memberi padding nol saat hanya satu tangan terlihat. Model harus dilatih dengan perilaku yang sama.
3. Urutan tangan memakai posisi horizontal layar, bukan handedness, karena label MediaPipe dapat terbalik pada kamera depan.
4. Rotasi tangan tidak dinormalisasi; isyarat yang sangat bergantung pada rotasi dapat menurunkan akurasi.
5. Aset MediaPipe yang dipakai: `@mediapipe/tasks-vision` 1.2.3, Apache-2.0.
