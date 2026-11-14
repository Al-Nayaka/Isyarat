# Kamera HP Isyarat — langkah yang benar untuk Android + laptop Windows

## Kenapa kamera gagal di HP saat membuka `http://192.168.1.7:5500`?

Browser (Chrome/Edge/Firefox) membatasi `getUserMedia()` pada halaman **HTTPS tepercaya** atau **localhost di perangkat yang sedang membuka halaman**. IP `192.168.x.x` dengan HTTP tidak memenuhi persyaratan ini, meskipun HP dan laptop memakai Wi-Fi sama. Ini **bukan bug yang bisa diselesaikan dengan izin kamera saja**.

- Laptop: `http://localhost:5500` → kamera laptop dapat meminta izin.
- HP lewat Wi-Fi: `http://192.168.x.x:5500` → tampilannya bisa dibuka, tetapi kamera biasanya diblokir.
- HP lewat USB port forwarding: `http://localhost:5500` **di Chrome HP** → kamera HP boleh meminta izin.

## Metode yang direkomendasikan: kabel USB + Chrome Port forwarding

Metode ini **tidak mengunggah rekaman kamera** ke internet. Pengujian berlangsung pada laptop dan HP yang terhubung lewat kabel USB.

1. Di laptop Windows, ekstrak ZIP. Buka folder yang ada `package.json` melalui VS Code, lalu jalankan `npm start` dan biarkan terminal tetap aktif. Catat port, biasanya `5500`.
2. Gunakan **kabel USB yang mendukung transfer data**, bukan hanya kabel cas. Sambungkan HP Android ke laptop.
3. Di HP, buka **Pengaturan → Tentang ponsel → Nomor bentukan / Build number**. Ketuk sekitar 7 kali jika Opsi Pengembang belum aktif. Nama menu bisa berbeda pada OPPO/Android.
4. Buka **Pengaturan → Opsi pengembang → Debugging USB**, aktifkan hanya untuk pengujian dengan laptop pribadi.
5. Di **Chrome laptop**, buka `chrome://inspect/#devices`. Centang **Discover USB devices**. Di HP, terima pop-up **Izinkan debugging USB** jika laptopnya kamu percayai.
6. Di halaman `chrome://inspect/#devices` pada Chrome laptop, klik **Port forwarding**. Centang **Enable port forwarding**, lalu tambahkan pemetaan:
   - **Port perangkat:** `5500`
   - **IP address and port tujuan:** `localhost:5500`
   - Klik **Done**. Gunakan angka port yang muncul pada terminal jika bukan 5500.
7. Buka **Chrome HP**, ketik `http://localhost:5500` (bukan alamat IP Wi-Fi laptop).
8. Masuk ke **Kamera → Aktifkan kamera**. Ketika diminta izin, pilih **Izinkan**. Pilih **Ganti kamera** untuk mencoba depan/belakang jika perangkat mendukung.
9. Selesai menguji? Matikan USB debugging dan cabut kabel.

Jika perangkat tidak terdeteksi oleh Chrome laptop, cek kabel data, driver USB Android, opsi USB debugging, dan konfirmasi izin di HP.

**Alternatif untuk yang memakai Android SDK Platform Tools:** setelah mengaktifkan USB debugging, jalankan `adb devices`, terima izin HP, lalu `adb reverse tcp:5500 tcp:5500` di terminal komputer. Buka `http://localhost:5500` di Chrome HP. Perintah ADB membutuhkan program `adb` yang sudah terinstal.

## Jika ingin tanpa kabel

Gunakan **HTTPS dengan sertifikat yang benar-benar dipercaya oleh Chrome HP** dan alamat IP/hostname yang sesuai sertifikat. Ini butuh setup sertifikat HTTPS di laptop *dan* kepercayaan sertifikat pada HP, sehingga bukan cukup mengganti `http` menjadi `https`. Alternatif lain bisa berupa hosting HTTPS publik, tetapi jika memakai hosting/tunnel, tinjau implikasi privasi dan jangan menyatakan sepenuhnya offline.

## Jika kamera tetap gagal setelah localhost

| Masalah | Tindakan |
| --- | --- |
| Muncul permintaan izin | Pilih **Izinkan**. |
| Izin sudah ditolak | Chrome HP → Pengaturan situs → Kamera → ubah izin situs localhost. |
| Kamera hitam/berhenti | Tutup aplikasi kamera/WA/meeting lain yang menggunakan kamera, kemudian coba lagi. |
| Kamera depan tidak tersedia | Tekan **Ganti kamera**; jika tetap gagal, perangkat mungkin hanya punya satu kamera yang dapat diakses. |
| Halaman tidak terbuka | Periksa apakah npm start masih berjalan dan port forwarding aktif dengan angka port yang sama. |
| Hasil tidak mengenali tangan | Ini bukan bug kamera; engine B & model C belum terintegrasi ke frontend. Gunakan `?mock=1` untuk menguji tampilan saja. |

**Referensi resmi:**
- MDN, getUserMedia dan secure context: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Google Chrome, akses local server melalui USB port forwarding: https://developer.chrome.com/docs/devtools/remote-debugging/local-server
- Android Developers, USB debugging dan adb: https://developer.android.com/tools/adb
