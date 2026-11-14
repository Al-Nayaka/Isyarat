# Bagian C — Machine Learning, Dataset, dan Evaluasi

## 1. Status

| Komponen | Status |
|---|---|
| `public/js/ml/classifier.js` (KNN + loader) | Selesai |
| `ml/scripts/train-knn.mjs` (training/evaluasi) | Selesai |
| `ml/scripts/extract-images.py` (gambar → landmark) | Selesai |
| `ml/scripts/extract-videos.py` (video → landmark) | Selesai |
| `public/models/knn-model.json` | **Ada** — dilatih dari dua dataset BISINDO |
| `public/data/vocab.json` | **27 kata** (5 kata lama + 22 kata WL-BISINDO) |
| `ml/reports/akurasi.json` + `docs/laporan-akurasi.md` | Terisi metrik nyata |

## 2. Kosakata dan perubahan lingkup

PRD menyebut contoh kata `halo`, `tolong`, `terima kasih`, `maaf`. Tidak ada
dataset publik untuk semua kata itu dengan format yang cocok. Agar model benar
benar terlatih (bukan dummy), kosakata disesuaikan dengan dataset yang tersedia.

| Sumber | Jumlah | `id` model |
|---|---|---|
| BISINDO Word Dataset (CC BY 4.0) | 5 | `damai`, `mendengar`, `ragu`, `semoga_beruntung`, `tersenyum` |
| WL-BISINDO (CC BY-NC 4.0) | 22 | `cari`, `hari`, `lagi`, `maaf`, `makan`, `saya`, `terima_kasih`, `tuli`, `siapa`, `kapan`, `mengapa`, `kuning`, `hijau`, `hitam`, `dengar`, `berangkat`, `teman`, `rumah`, `pagi`, `siang`, `sore`, `malam` |

Total **27 label**. Ini **perubahan lingkup** dari contoh PRD dan harus dicatat
di laporan akhir. Untuk kembali ke kata PRD, rekam dataset sendiri lewat
`recorder.html`, ganti `vocab.json`, lalu latih ulang — tanpa mengubah kode
engine/classifier.

Sepuluh kata WL-BISINDO dihapus dari dataset dan kosakata karena dianggap
anomali berdasarkan keputusan pemilik proyek: `air`, `belajar`, `ingat`,
`motor`, `apa`, `di_mana`, `bagaimana`, `merah`, `datang`, `keluarga`.
Sampelnya sudah dibuang dari `ml/data/raw/wl-bisindo.jsonl`, bukan hanya
disembunyikan dari UI.

Catatan: `mendengar` (dataset lama) dan `dengar` (WL-BISINDO) sengaja
dipertahankan sebagai dua label karena berasal dari sumber dan penutur berbeda.
Keduanya bisa saling tertukar oleh model; lihat confusion matrix di
`ml/reports/akurasi.json`.

## 3. Dataset

### 3.1 BISINDO Word Dataset (5 kata)

- Sumber: Kaggle `mulkanfajri/indonesian-sign-language-bisindo-word-dataset`
- Pembuat: Mulkan Fajri
- Lisensi: **CC BY 4.0** (atribusi wajib)
- Isi: ±100 gambar JPG per kelas, total 500 gambar, 5 kelas
- Atribusi lengkap: `ml/data/raw/ATTRIBUTION.md`

`ml/scripts/extract-images.py` menjalankan MediaPipe Hand Landmarker pada
setiap gambar, lalu menormalkan landmark dengan aturan yang identik dengan
`public/js/engine/normalize.js`. Hasil: **499 sampel valid** dengan
`orang_id = KAGGLE_WORD` (satu identitas, tidak bisa split partisipan).

### 3.2 WL-BISINDO (22 kata dipakai)

- Sumber: Kaggle `glennleonali/wl-bisindo`
- Penulis: Grace Oktaviani Kindy, Glenn Leonali, Henry Lucky (BINUS University)
- Paper: DOI `10.1016/j.procs.2025.08.277`
- Lisensi: **CC BY-NC 4.0** — atribusi wajib, **non-komersial**
- Isi sumber: 1.600 video RGB, 32 isyarat kata, 5 penutur (varian Banten)
- Dipakai model: 22 kata setelah 10 kata anomali dibuang (lihat bagian 2)

`ml/scripts/extract-videos.py` mengambil **satu frame representatif** (posisi
50% video) dari setiap video, menjalankan MediaPipe, lalu menormalkan landmark.
Nama berkas `signer<id>_label<id>_sample<id>.mp4` dipetakan menjadi
`orang_id = WL_S1..WL_S5`, sehingga evaluasi bisa signer-independent.

Hasil ekstraksi awal: **1.469 sampel valid** dari 1.600 video. Setelah 10 kata
anomali dihapus, tersisa **1.005 sampel** untuk 22 kata. Distribusi per penutur
pada data yang dipakai: WL_S1 80, WL_S2 288, WL_S3 266, WL_S4 185, WL_S5 186
sampel. Dataset aslinya memang tidak seimbang.

> Ini pendekatan **statis**. Model KNN tidak memahami gerakan temporal, jadi
> frame representatif bukan pengenalan isyarat bergerak. Isyarat yang maknanya
> ditentukan oleh arah/gerakan tangan tidak dapat dikenali dengan benar.

### 3.3 Sketsa panduan di halaman "Daftar isyarat"

`ml/scripts/make-guides.mjs` memilih sampel **medoid** (paling dekat ke
centroid) untuk setiap label, lalu menggambar **sketsa kartun** tangan
(telapak bulat, jari seperti kapsul, garis luar tebal, warna kulit datar, dan
latar stiker krem) sebagai SVG di `public/assets/guides/<id>.svg`. Sketsa ini:

- dibuat dari landmark yang sama dengan model, jadi konsisten dengan data;
- bergaya ilustrasi/kartun, bukan foto dan bukan panduan BISINDO resmi;
- menata kedua tangan kiri/kanan secara kasar karena fitur ternormalisasi
  menyimpan setiap tangan relatif terhadap wrist-nya sendiri, bukan posisi
  antar-tangan.

Jalankan ulang setelah dataset berubah:

```bash
npm run ml:guides
```

## 4. Alur kerja

```text
BISINDO Word Dataset (gambar)                WL-BISINDO (video)
   ↓ extract-images.py                          ↓ extract-videos.py
bisindo-word.jsonl (499)                     wl-bisindo.jsonl (1.005)
   └──────────────────────┬─────────────────────┘
                          ↓ train-knn.mjs --augment-mirror
split per partisipan → augmentasi cermin → model KNN → evaluasi
                          ↓
public/models/knn-model.json
ml/reports/akurasi.json
docs/laporan-akurasi.md
```

Alternatif untuk data partisipan sendiri:

```text
recorder.html → JSONL → ml/data/raw/ → npm run ml:train
```

## 5. Hasil evaluasi (nyata, bukan placeholder)

| Metrik | Nilai |
|---|---|
| Akurasi uji | **68,99%** (327/474) |
| Macro F1 | 0,6913 |
| Sampel training | 1.030 asli + 1.030 cermin = 2.060 |
| Sampel uji | 474 |
| Split | **partisipan** (`compliant: true`) |
| Partisipan uji | `WL_S2`, `WL_S5` |
| k | 5 |
| Fitur | `dual`, 126 nilai |
| Ukuran model | ±1,6 MB |

Akurasi hanya dihitung dari 22 kelas WL-BISINDO karena lima kelas dataset lama
tidak punya sampel pada penutur uji. Kelas terbaik: `kapan` 25/25, `siapa`
19/21, `saya` 18/20. Kelas terburuk: `hijau` 0/21 (banyak diprediksi `maaf`),
`terima_kasih` 8/20, `malam` 10/20.

### Peringatan penting

- Lima kelas dari dataset lama (`damai`, `mendengar`, `ragu`,
  `semoga_beruntung`, `tersenyum`) **tidak memiliki sampel uji** pada split ini,
  sehingga akurasinya tidak terukur. Jangan mengklaim angka 68,99% berlaku
  untuk kelima kelas itu.
- Split per penutur sudah memenuhi syarat PRD (`compliant: true`), tetapi frame
  dari video yang sama tetap berkorelasi. Angka ini adalah estimasi per-frame
  untuk penutur yang tidak terlihat saat training, bukan jaminan di dunia nyata.
- Dataset tidak seimbang: WL_S1 hanya menyumbang 80 sampel pada data yang
  dipakai. Ekstraksi awal juga melewati 131 frame tanpa tangan, lalu 464 sampel
  dari 10 kata anomali dibuang.
- Augmentasi cermin (`x → -x`) hanya diterapkan pada data training, bukan data
  uji. Untuk isyarat dua tangan, slot kiri/kanan juga ditukar agar geometri
  cermin tetap benar.
- Lisensi WL-BISINDO **CC BY-NC 4.0** melarang penggunaan komersial.

## 6. Skema model `knn-model.json`

```json
{
  "format": "isyarat-knn-v1",
  "version": 1,
  "createdAt": "2026-11-14T00:00:00.000Z",
  "featureMode": "dual",
  "featureSize": 126,
  "normalizationVersion": "1.0",
  "metric": "euclidean",
  "k": 5,
  "labels": ["berangkat", "cari", "...", "tersenyum", "tuli"],
  "classCounts": {"berangkat": 48, "damai": 200, "...": 0},
  "participants": ["KAGGLE_WORD", "WL_S1", "WL_S3", "WL_S4"],
  "sources": [
    "kaggle:mulkanfajri/indonesian-sign-language-bisindo-word-dataset",
    "kaggle:glennleonali/wl-bisindo"
  ],
  "licenses": ["CC BY 4.0", "CC BY-NC 4.0"],
  "augmentation": "mirror-x",
  "samples": [
    {"label": "cari", "features": [126 angka]}
  ]
}
```

Classifier memvalidasi `featureSize`, label, dan dimensi setiap sampel. Engine
menolak label model yang tidak ada di `vocab.json`.

## 7. Cara kerja KNN dan confidence

- Jarak Euclidean pada 126 fitur.
- Ambil `k = 5` tetangga terdekat.
- Voting berbobot `1 / (jarak² + ε)`.
- `confidence` = pangsa bobot label pemenang (0–1), **bukan akurasi model**.

Ambang penerimaan engine: `confidenceThreshold = 0.7`, ditambah stabilisasi
**2,6 detik tahan** (minimal 6 sampel, 75% suara sama) dan cooldown 1,8 detik.

## 8. Perintah

```bash
# Ekstraksi ulang dari dataset gambar (butuh Python + mediapipe)
python ml/scripts/extract-images.py \
  --images "C:/path/dataset_kata" \
  --out ml/data/raw/bisindo-word.jsonl

# Ekstraksi ulang dari dataset video (paralel 4 proses)
python ml/scripts/extract-videos.py \
  --videos "C:/path/wl-bisindo" \
  --out ml/data/raw/wl-bisindo.jsonl \
  --frames-per-video 1 --workers 4

# Latih dengan augmentasi cermin
node ml/scripts/train-knn.mjs --data ml/data/raw --augment-mirror

# Buat ulang sketsa panduan untuk halaman Daftar isyarat
npm run ml:guides

npm run ml:validate
npm run ml:train
npm run test:ml
```

## 9. Batasan

- KNN hanya mengenali pola statis; gerakan temporal tidak tercakup.
- Model dilatih dari frame representatif video, bukan urutan gerakan. Isyarat
  yang identik pada satu frame tetapi berbeda gerakan akan sulit dibedakan.
- Dataset hanya mencakup 27 kata; bukan terjemahan BISINDO lengkap.
- Sebagian besar sampel berisi dua tangan; untuk hasil terbaik, lakukan gestur
  dengan dua tangan seperti pada dataset.
- Rotasi tangan tidak dinormalisasi.
- Lisensi WL-BISINDO **CC BY-NC 4.0**: proyek non-komersial boleh memakai dengan
  atribusi; penggunaan komersial tidak diizinkan.
- Model kecil (±1,6 MB) mudah dibuka; tidak ada enkripsi (sesuai prototipe offline).
- Setelah melatih ulang model, naikkan `CACHE_VERSION` di `public/sw.js` agar
  Service Worker tidak menyajikan model lama (saat ini `isyarat-v6`).
- Uji kamera langsung dengan pengguna baru tetap wajib sebelum demo; lingkungan
  pengembangan ini tidak dapat menjalankan kamera/MediaPipe browser.
