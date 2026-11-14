# Atribusi Dataset

## Indonesian Sign Language (BISINDO) Word Dataset

- Sumber: Kaggle — `mulkanfajri/indonesian-sign-language-bisindo-word-dataset`
- Pembuat: Mulkan Fajri
- Lisensi: **Attribution 4.0 International (CC BY 4.0)**
- URL: https://www.kaggle.com/datasets/mulkanfajri/indonesian-sign-language-bisindo-word-dataset
- Kelas: Damai, Mendengar, Ragu, Semoga Beruntung, Tersenyum
- Jumlah: ±100 gambar per kelas (total 500 gambar JPG)

### Modifikasi yang dilakukan

Gambar asli **tidak** disalin ke repository ini. Hanya landmark tangan yang
diekstrak menggunakan MediaPipe Hand Landmarker, lalu dinormalisasi dengan
aturan yang sama seperti `public/js/engine/normalize.js`. Hasilnya berupa
`ml/data/raw/bisindo-word.jsonl` (label + vektor fitur), bukan gambar.

### Batasan

- Dataset tidak menyertakan identitas partisipan. Semua sampel memakai
  `orang_id` yang sama, sehingga evaluasi memakai split sampel dan **tidak
  memenuhi syarat PRD** untuk uji generalisasi per partisipan.
- Jumlah partisipan pada gambar terlihat terbatas (satu orang). Akurasi uji
  tidak boleh diklaim sebagai kemampuan generalisasi ke pengguna baru.
- Dataset ini hanya mencakup lima kata; bukan terjemahan BISINDO lengkap.
  (Kosakata model diperluas oleh WL-BISINDO, lihat bagian berikutnya.)

### Kewajiban atribusi

Jika dataset ini dipakai dalam demo/laporan, cantumkan atribusi di atas dan
tautan lisensi CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

## Word-Level BISINDO (WL-BISINDO)

- Sumber: Kaggle — `glennleonali/wl-bisindo`
- Penulis: Grace Oktaviani Kindy, Glenn Leonali, Henry Lucky (BINUS University)
- Paper: *Word-Level BISINDO: A Novel Video Indonesian Sign Language Dataset
  and Baseline Methods*, Procedia Computer Science 269 (2025) 249–258.
  DOI: https://doi.org/10.1016/j.procs.2025.08.277
- Repositori: https://github.com/AceKinnn/WL-BISINDO
- Lisensi: **CC BY-NC 4.0** — atribusi wajib, **hanya untuk penggunaan
  non-komersial**
- Isi: 1.600 video RGB, 32 isyarat kata, 10 sampel per kata per penutur,
  5 penutur asal Banten
- Kelas: Air, Belajar, Cari, Hari, Ingat, Lagi, Maaf, Makan, Motor, Saya,
  Terima kasih, Tuli, Apa, Siapa, Kapan, Di mana, Mengapa, Bagaimana, Merah,
  Kuning, Hijau, Hitam, Dengar, Berangkat, Datang, Teman, Keluarga, Rumah,
  Pagi, Siang, Sore, Malam
- Kelas yang dipakai model: **22 kata**. Sepuluh kata (`air`, `belajar`,
  `ingat`, `motor`, `apa`, `di_mana`, `bagaimana`, `merah`, `datang`,
  `keluarga`) dihapus dari JSONL karena dianggap anomali.

### Modifikasi yang dilakukan

Video asli **tidak** disalin ke repository ini. `ml/scripts/extract-videos.py`
mengambil frame representatif (default satu frame di tengah video), menjalankan
MediaPipe Hand Landmarker, lalu menormalkan landmark dengan aturan yang sama
seperti `public/js/engine/normalize.js`. Hasilnya berupa
`ml/data/raw/wl-bisindo.jsonl` (label + vektor fitur + `orang_id` penutur),
bukan video/gambar. Sebanyak 464 sampel dari 10 kata anomali kemudian dibuang
dari JSONL tersebut, sehingga tersisa 1.005 sampel untuk 22 kata.

### Batasan penting

- Lisensi **CC BY-NC 4.0** melarang penggunaan komersial. Proyek demo akademik
  ini memenuhi syarat non-komersial, tetapi distribusi ulang dataset tetap
  harus mengikuti lisensi tersebut.
- Model KNN saat ini statis. Satu frame representatif **bukan** pengenalan
  gerakan temporal; isyarat yang maknanya ditentukan oleh gerakan tidak dapat
  dikenali dengan benar.
- Split evaluasi memakai `orang_id` dari nama berkas (`[signer]_[label]_[sample]`),
  sehingga evaluasi bisa signer-independent. Namun frame dari video yang sama
  tetap berkorelasi; lihat laporan untuk angka apa adanya.

### Kewajiban atribusi

Cantumkan atribusi di atas, tautan lisensi
https://creativecommons.org/licenses/by-nc/4.0/, dan sitasi paper jika dataset
ini dipakai dalam demo/laporan.
