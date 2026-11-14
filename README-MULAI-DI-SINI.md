# ISYARAT — Frontend A, versi ACC (13 November 2026)

**Yang direvisi:** ilustrasi di area kamera kini menyerupai desain visual yang telah kamu setujui: siluet **netral gender, tanpa wajah, statis**, telapak proporsional, lengan menyatu ke bahu, warna abu-teal, dan bingkai sudut kuning. Tulisan panjang yang sebelumnya mengganggu di dalam kamera telah dihapus. Placeholder hanya tampil sebelum kamera aktif; setelah diizinkan, video asli menggantikannya.

## Menjalankan di Windows (VS Code)

1. Hentikan server Isyarat versi sebelumnya dengan **Ctrl+C**.
2. Ekstrak ZIP ini ke folder baru (jangan dicampur dengan file versi lama).
3. **File `package.json` ada langsung di folder utama setelah ZIP diekstrak.**
4. Buka folder itu melalui **VS Code → File → Open Folder**.
5. Buka **Terminal → New Terminal**, lalu jalankan `npm start`.
6. Buka alamat yang dicetak terminal, biasanya `http://localhost:5500`.
7. Jika masih muncul avatar lama, tekan `Ctrl+Shift+R` di Chrome untuk me-refresh aset.

## Kamera HP

- URL `http://192.168.x.x:5500` dari HP pada Wi-Fi sama adalah untuk **melihat layout**, bukan mengakses kamera, karena HTTP biasa dengan alamat IP LAN tidak memenuhi persyaratan secure context browser.
- Untuk menguji kamera HP asli, gunakan HTTPS yang tepercaya, atau sambungkan USB debugging dan atur Chrome port forwarding di `chrome://inspect/#devices` dari port HP `5500` ke `localhost:5500` laptop. Buka `http://localhost:5500` pada HP setelah forwarding berhasil.
- Keterangan lengkap: `PANDUAN-KAMERA-HP.md`. Kamera fisik dan offline penuh belum bisa dinyatakan lulus tanpa uji di perangkatmu.

## Mode aplikasi

- `http://localhost:5500` = frontend normal. Kamera + **engine MediaPipe B** + **classifier KNN C** sudah terpasang lokal. Model `public/models/knn-model.json` sudah dilatih dari dua dataset BISINDO dengan **27 kata** (5 kata lama + 22 kata WL-BISINDO, termasuk Maaf, Terima Kasih, Siapa, Kapan, warna, waktu, dan teman).
- `http://localhost:5500/?mock=1` = alat pengujian **simulasi UI** dengan label contoh. **Bukan deteksi AI**, jangan digunakan sebagai bukti akurasi.
- `http://localhost:5500/recorder.html` = perekam dataset B (landmark ternormalisasi → JSONL untuk training C).
- PWA offline aktif pada localhost/HTTPS setelah kunjungan pertama.

## Dataset dan akurasi

Model memakai dua dataset Kaggle: **BISINDO Word Dataset**
(`mulkanfajri/indonesian-sign-language-bisindo-word-dataset`, CC BY 4.0, 5 kata)
dan **WL-BISINDO** (`glennleonali/wl-bisindo`, CC BY-NC 4.0, 5 penutur; 22
kata dipakai setelah 10 kata anomali dihapus). Gambar/video tidak disalin ke
repo; hanya landmark tangan yang diekstrak. Atribusi lengkap:
`ml/data/raw/ATTRIBUTION.md`.

Hasil uji: **68,99% (327/474)** dengan split **partisipan** (`WL_S2` dan
`WL_S5` sebagai data uji), sehingga memenuhi syarat PRD. Angka ini hanya
mengukur 22 kelas WL-BISINDO; lima kelas dataset lama tidak punya sampel uji.
Model tetap statis (satu frame per video), jadi gerakan temporal belum
dikenali. Rincian: `docs/laporan-akurasi.md` dan `docs/ML_C.md`.

Saat memakai kamera, tahan isyarat sekitar **2,6 detik** sampai label terkunci
agar hasil tidak berubah-ubah. Halaman **Isyarat** menampilkan **sketsa kartun**
per kata sebagai panduan kasar (bukan foto atau panduan BISINDO resmi).

> WL-BISINDO berlisensi **CC BY-NC 4.0**: non-komersial, atribusi wajib.

## Melatih model

```bash
# Opsi A: dataset gambar + video (ekstraksi landmark)
python ml/scripts/extract-images.py --images "C:/path/dataset_kata" --out ml/data/raw/bisindo-word.jsonl
python ml/scripts/extract-videos.py --videos "C:/path/wl-bisindo" --out ml/data/raw/wl-bisindo.jsonl --frames-per-video 1 --workers 4
node ml/scripts/train-knn.mjs --data ml/data/raw --augment-mirror

# Opsi B: rekam minimal 3 partisipan lewat /recorder.html, simpan JSONL ke ml/data/raw/
npm run ml:validate
npm run ml:train
```

## Pengujian cepat

```bash
npm start
npm run test:syntax
npm run test:engine
npm run test:ml
npm run test:ui
```

## Pemisahan pekerjaan tim

- A: UI, kamera browser, kalimat, suara, riwayat, panduan, dokumentasi.
- B: MediaPipe, normalisasi landmark, smoothing, integrasi engine, perekam dataset, Service Worker dan PWA offline. **Sudah diimplementasikan** — lihat `docs/ENGINE_B.md`.
- C: classifier KNN, ekstraksi landmark dataset gambar, script training/evaluasi, vocab, laporan akurasi. **Selesai** — model nyata sudah ada; lihat `docs/ML_C.md` dan `docs/laporan-akurasi.md`.

Baca `CHECKLIST-SETELAH-INSTALL.md` dan `docs/KONTRAK_BC.md` untuk langkah berikutnya.

## Deploy dan paket ZIP

- Panduan hosting: `DEPLOY.md` (Netlify/Vercel/Cloudflare Pages; publikasikan folder `public/`).
- Pemeriksaan kesiapan: `npm run deploy:check`.
- Paket per anggota + gabungan: `npm run package:release` → folder `release/`.
  Rincian isi dan urutan merge: `PANDUAN-PAKET.md`.
