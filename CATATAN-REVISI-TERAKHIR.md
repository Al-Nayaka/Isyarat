# Revisi placeholder kamera (13 November 2026)

## Apa yang berubah

1. `public/assets/avatar-kamera-netral.svg`: siluet statis tanpa gender/wajah, tangan dan lengan proporsional sebagai panduan framing.
2. `public/js/ui/app.js`: referensi avatar serta teks watermark dan alt yang akurat.
3. `public/css/style.css`: hilangkan gerakan animasi floating.

Ilustrasi **bukan** isyarat BISINDO/SIBI dan **bukan** deteksi kamera; saat kamera dinyalakan video sungguhan ditampilkan. Fungsi pengenalan asli tetap membutuhkan engine B + model C.

## Menjalankan

Ekstrak ZIP → buka folder hasil ekstrak di VS Code; pastikan ada `package.json` → Terminal → `npm start` → `http://localhost:5500`. Untuk simulasi buka `http://localhost:5500/?mock=1`.

Jika versi lama masih terbuka, hentikan server lama dengan Ctrl+C dan jalankan versi baru. Tekan Ctrl+Shift+R di browser untuk muat ulang tanpa cache.

Untuk HP (Wi-Fi sama), pakai alamat IP laptop yang tercetak di terminal. Kamera HP pada HTTP alamat IP lokal umumnya memerlukan HTTPS atau localhost yang aman.
