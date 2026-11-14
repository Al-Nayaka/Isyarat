# Checklist Anggota A — setelah kode Isyarat dijalankan

## A. Jalankan dan uji sendiri
- [ ] Ekstrak ZIP ini; buka folder yang langsung memiliki `package.json`.
- [ ] Jalankan `npm start` di VS Code dan buka alamat localhost yang dicetak terminal.
- [ ] Uji halaman **Beranda → Kamera → Daftar isyarat → Panduan → Riwayat** di laptop.
- [ ] Uji kamera laptop nyata: **Aktifkan kamera** → izin → video tampil → **Matikan kamera**.
- [ ] Uji simulasi lewat `/?mock=1`: **Halo → Tolong → Kalimatmu → Ucapkan → Simpan → Riwayat → Hapus** (hasil tiruan, jangan diklaim hasil model).
- [ ] Uji teks/suara dan tangani perangkat yang tidak punya suara `id-ID`.
- [ ] Uji lebar 320, 360, 390, 768, dan 1280 px memakai Chrome DevTools.

## B. Uji HP Android
- [ ] HP dan laptop terhubung Wi-Fi sama: buka URL IP laptop untuk **cek tampilan**.
- [ ] Untuk **kamera HP sungguhan**, lakukan USB port forwarding sesuai `PANDUAN-KAMERA-HP.md`.
- [ ] Di HP buka `http://localhost:<port>` lewat Chrome dan tes izin kamera, video, dan tombol Ganti kamera.
- [ ] Catat hasil asli di HP: tampil/tidak, kamera depan/belakang, pesan gagal, dan resolusi.
- [ ] Jangan menyatakan kamera HP sudah lulus tanpa tes nyata.

## C. Integrasi tim dan submission
- [ ] Serahkan file milik A lewat GitHub branch `feat/ui` dan Pull Request ke B; jangan menimpa engine B atau model C.
- [ ] Pastikan kontrak engine B cocok: `initEngine()`, `processFrame(video)` → `{status,label,confidence,accepted}`.
- [ ] Minta C menyediakan daftar final `vocab.json` dan hanya kosakata yang tervalidasi.
- [ ] Bersama B/C uji **pengenalan isyarat asli**: tanpa tangan, confidence rendah, diterima, teks, suara, riwayat.
- [ ] Bersama B uji mode pesawat/PWA; badge Online/Offline **bukan bukti** aplikasi bekerja offline.
- [ ] Isi laporan uji nyata dan README sesuai fitur yang terbukti berfungsi.
- [ ] Rekam video demo versi gabungan asli dan cek aturan guidebook submission.

**Status jujur:** tampilan/frontend telah dibuat dan diuji dengan simulasi. Kamera fisik HP, ML asli, PWA offline, TTS offline, dan uji pengguna belum otomatis selesai.
