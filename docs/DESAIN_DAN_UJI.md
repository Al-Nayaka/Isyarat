# Desain ACC dan audit implementasi awal

Referensi: gambar konsep yang dipilih pengguna pada percakapan (poster asli tidak disertakan sebagai aset aplikasi). Implementasi bukan screenshot SVG penuh; semua navigasi, tombol dan teks adalah HTML/CSS/JS asli.

## Kesetiaan visual terhadap desain yang disetujui

| Komponen | Implementasi |
|---|---|
| Tema | Dasar charcoal-teal `#08272B`, kuning `#FFC83D`, krem `#FFF4DF`, hijau `#28C987` |
| Beranda HP | Logo, headline “Ubah isyarat tangan jadi teks dan suara”, ilustrasi perempuan berbaju kuning, tombol Mulai kamera / Daftar isyarat / Panduan |
| Kamera HP | Judul Kamera isyarat, instruksi jarak senyaman mungkin, frame dengan sudut kuning, status kuning/hijau, kartu hasil krem di bawah, navigasi bawah |
| Laptop | Header menu mendatar, frame kamera di kiri, hasil teks dan aksi di kanan, tanpa artboard HP di dalam desktop |
| Status | Kuning untuk menunggu, hijau untuk diterima, merah untuk kesalahan teknis; selalu ditemani ikon dan teks |
| Jarak fisik | Tidak mewajibkan 1 meter. Instruksi menekankan kedua tangan terlihat penuh, disesuaikan perangkat. |
| Demo visual | Ilustrasi statis netral gender tanpa wajah asli adalah ilustrasi posisi kedua tangan, tidak digunakan untuk inferensi dan tidak disajikan sebagai feed kamera. |

## 16 kondisi yang tersedia

| Kondisi | URL pengujian | Implementasi |
|---|---|---|
| S1 Beranda | `?preview=S1` | Tombol mulai, daftar, panduan |
| S2a Izin kamera ditolak | `?preview=S2a` | Informasi pemulihan |
| S2b Kamera tidak ditemukan | `?preview=S2b` | Informasi pemulihan |
| S2c Kamera sibuk | `?preview=S2c` | Informasi pemulihan |
| S3 Tangan belum terlihat | `?preview=S3` | Status menunggu |
| S4 Keyakinan rendah | `?preview=S4` | Label tidak ditambahkan |
| S5 Kata diterima | `?preview=S5` | Kata dan kalimat tampil |
| S6 Sedang diucapkan | `?preview=S6` | Tombol Hentikan |
| S7a Riwayat ada isi | `?preview=S7a` | Daftar dan kontrol |
| S7b Riwayat kosong | `?preview=S7b` | Empty state |
| S8 Memuat engine | `?preview=S8` | Status memuat, tanpa angka progres palsu |
| S9 Engine gagal | `?preview=S9` | Pesan pemulihan |
| S10 Suara gagal | `?preview=S10` | Teks tetap tersedia |
| S11 Daftar isyarat | `?preview=S11` | Kosakata teks tanpa gerakan tak terverifikasi |
| S12 Konfirmasi hapus | `?preview=S12` | Modal hapus riwayat |
| S13 Petunjuk | `?preview=S13` | Panduan empat langkah |

`?preview=` hanya untuk pemeriksaan kondisi UI, bukan simulasi proses pengguna sesungguhnya.

## Dasar aturan UI (target, bukan sertifikasi)

- WCAG 2.2 [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): target teks normal 4,5:1. Rasio nominal: `#F7F8F6` di `#08272B` = 14,76:1; teks kartu `#132B2F` di `#FFF4DF` = 13,62:1; teks gelap `#142528` di kuning `#FFC83D` = 10,25:1. Kontras warna teks di atas diuji secara matematis; *seluruh komponen dan keadaan fokus belum diaudit*.
- WCAG [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): komponen grafis bermakna memerlukan kontras 3:1 bila kriteria berlaku. **Periksa setiap tombol dan ikon pada implementasi**.
- WCAG [1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): status memadukan warna, ikon dan teks.
- WCAG [2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): tombol `:focus-visible` dengan outline yang terlihat.
- WCAG [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): minimum AA 24×24 CSS px dengan pengecualian tertentu; tim menetapkan target sendiri 48×48 CSS px pada kontrol utama sesuai arah Material/Apple.
- Nielsen Norman Group [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): status jelas, pemulihan error, konfirmasi penghapusan, konsistensi.
- Panduan untuk pengguna tuli (UK Home Office): teks sederhana, alternatif untuk notifikasi audio, interaksi tidak hanya suara.

## Pemeriksaan yang benar-benar dijalankan

- `npm run test:syntax`: seluruh modul JavaScript lolos pemeriksaan parser Node.
- `node docs/check-ui.mjs`: 16 kondisi HTML tersedia, simulasi Halo+Tolong, simpan riwayat, konfirmasi hapus, dan hapus riwayat lulus pada pengujian logika tanpa browser.
- Browser otomatis di lingkungan pembuatan memblokir URL lokal, sehingga **pemeriksaan visual 320–1440 px belum berhasil dilakukan secara otomatis**. Harus dilanjutkan di Chrome/Edge pengguna. Tidak ada klaim “lulus WCAG” atau “semua viewport berhasil” dari tes yang belum dijalankan.

## Checklist uji manual sebelum presentasi

- [ ] Chrome 390×844: isi kartu hasil terlihat dan tombol dapat ditekan.
- [ ] Chrome 320×680: tidak ada teks penting terpotong, navigasi dapat dipakai.
- [ ] Tablet 768px: layout bertumpuk dengan navigasi tidak menutupi konten.
- [ ] Laptop 1280×720: kamera kiri + hasil kanan, tanpa frame HP.
- [ ] Keyboard Tab: outline fokus terlihat, dialog hapus bisa ditutup dengan Esc.
- [ ] Kamera fisik: izin, penolakan, pengambilan gambar, penutupan track.
- [ ] TTS: tersedia atau menampilkan fallback teks.
- [ ] Riwayat: simpan dan hapus setelah reload.
- [ ] PWA & mode pesawat: baru diuji setelah B menambah service worker dan aset lokal.
- [ ] Isyarat nyata dan akurasi: baru diuji setelah C melatih model dan B mengintegrasikannya.
