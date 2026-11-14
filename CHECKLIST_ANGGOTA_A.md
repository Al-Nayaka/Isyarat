# Checklist Anggota A — Isyarat (13 November 2026)

Catatan: **tersedia kode** tidak sama dengan **lulus pengujian pada perangkat pengguna**. Centang sendiri setelah berhasil diuji dan simpan bukti screenshot/rekaman.

## Sudah dibuat dalam proyek (perlu verifikasi laptop/HP)
- [x] Struktur HTML/CSS/JS adaptif layar HP/laptop, warna dan tata letak sesuai desain ACC
- [x] Beranda, Kamera, Riwayat, Daftar Isyarat, Panduan, kondisi error/loading
- [x] Placeholder kamera ilustrasi statis tanpa foto wajah orang; video nyata menggantikan placeholder saat kamera aktif
- [x] Handler kamera, status, izin, penanganan gagal
- [x] Kontrol kalimat, tombol Ucapkan/Hentikan, simpan dan hapus riwayat di browser
- [x] Tombol simulasi UI yang diberi label jelas (`?mock=1`), **bukan AI asli**
- [x] Dokumentasi kontrak untuk B/C

## Harus kamu uji sebelum mengirim PR
- [ ] Jalankan `npm start` dan `npm run test:syntax` (bisa tanpa AI)
- [ ] Laptop: halaman awal, kamera **sungguhan**, izin ditolak, kamera dimatikan
- [ ] Laptop: `?mock=1` → Halo → Tolong → Hapus kata → Ucapkan → Simpan → Riwayat → Hapus riwayat
- [ ] HP: tampil pada lebar 320/360/390 px tanpa teks bertumpuk atau tombol terpotong
- [ ] HP: buka URL **IP Wi-Fi** untuk mengecek tampilan; kamera HP perlu HTTPS/localhost HP
- [ ] Keyboard Tab: fokus tombol terlihat; konfirmasi hapus bisa dibatalkan
- [ ] Pembacaan suara bahasa Indonesia pada perangkat yang tersedia; catat jika tidak tersedia
- [ ] Gambar dan teks di setiap layar mengikuti desain yang disetujui, termasuk layar error dan daftar isyarat
- [ ] Dokumentasikan bug yang ditemukan dan perbaikan dalam `docs/laporan-uji.md`
- [ ] Commit dan push branch `feat/ui`, lalu buat Pull Request ke repo tim setelah koordinasi dengan B

## Menunggu kolaborasi tim (belum selesai)
- [ ] **B:** `initEngine()` / `processFrame(video)` terintegrasi dengan MediaPipe, normalisasi, smoothing dan Service Worker/PWA offline
- [ ] **C:** `vocab.json` final, dataset, model ML, evaluasi asli; gambar isyarat kalau ada harus divalidasi
- [ ] **A+B+C:** alur kamera → isyarat → teks → suara → riwayat dengan **model asli**, uji offline (mode pesawat) dan uji HP aman HTTPS/localhost
- [ ] **A:** Finalisasi dokumentasi UI, bukti pengujian, bahan video demo/pitch dengan hasil yang benar-benar teruji
- [ ] **Tim:** README final, rekam video sesuai aturan, submit dan simpan bukti sebelum tenggat panitia

**Prioritas hari ini:** 1) buka proyek dan uji laptop, 2) uji tampilan HP via Wi-Fi, 3) serahkan branch A ke B, 4) segera integrasi dan dokumentasi.
