# Kontrak Integrasi Tim A–B–C

- **A**: `public/js/ui/`, `public/index.html`, `public/css/style.css`.
- **B**: sediakan `public/js/engine/index.js` dengan `initEngine()` dan `processFrame(video)`; hasil `{status:'no_hand'|'low_confidence'|'ok', label:string|null, confidence:number, accepted:boolean}`. Status `ok` dan `accepted:true` menambahkan kata. Pastikan deteksi, normalisasi, smoothing di engine. Tambahkan PWA offline dan aset model lokal.
- **C**: `public/data/vocab.json` dengan `id`, `teks_tampil`, `audio_file`, `catatan_isyarat`. `label` dari engine harus cocok dengan `id` kosakata. Sediakan model dan metrik evaluasi yang benar-benar diukur.
- Fitur kamera memerlukan secure context: localhost/HTTPS. Alamat IP HTTP di Wi-Fi hanya cocok untuk melihat UI di HP; kamera HP memerlukan HTTPS/localhost HP via USB port forwarding.
- `?mock=1` hanya simulasi UI. Jangan gunakan hasilnya sebagai metrik AI.
- Ilustrasi statis netral gender panduan posisi tangan bukan contoh gerakan bahasa isyarat yang telah diverifikasi.
