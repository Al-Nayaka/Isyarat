# Panduan Deploy — Isyarat

Aplikasi ini adalah **situs statis** (HTML/CSS/JS + MediaPipe/WASM + model lokal).
Tidak ada backend, database, atau API cloud. Semua inferensi berjalan di browser.

## Yang perlu di-deploy

Hanya isi folder **`public/`**. Folder `ml/`, `docs/`, dan berkas pengujian tidak
perlu diunggah ke hosting.

| Item | Wajib | Catatan |
|---|---|---|
| `public/` | Ya | Root situs |
| `server.mjs` | Tidak | Hanya untuk uji lokal (`npm start`) |
| `ml/`, `docs/` | Tidak | Dataset, training, laporan |

## Opsi 1 — Netlify (disarankan)

1. Push repository ke GitHub.
2. Di Netlify: **Add new site → Import an existing project**.
3. Pilih repository. Build command: **kosong**. Publish directory: **`public`**.
4. Deploy. Konfigurasi header sudah ada di `netlify.toml`.

Alternatif cepat: seret folder `public/` ke <https://app.netlify.com/drop>.

## Opsi 2 — Vercel

1. Import repository di <https://vercel.com/new>.
2. Framework preset: **Other**. Output directory: **`public`**.
3. Deploy. Konfigurasi header ada di `vercel.json`.

## Opsi 3 — Cloudflare Pages

- Build command: kosong
- Build output directory: `public`

## Opsi 4 — Hosting statis lain / server sendiri

Salin isi `public/` ke document root. Wajib memastikan MIME berikut:

```text
.mjs   → text/javascript
.wasm  → application/wasm
.task  → application/octet-stream
.json  → application/json
```

Server lokal `server.mjs` sudah mengatur MIME tersebut:

```bash
npm start
# http://localhost:5500
```

## Catatan penting

- **Kamera butuh secure context**: HTTPS atau `localhost`. Membuka IP LAN lewat
  HTTP hanya untuk melihat tampilan, bukan mengakses kamera.
- Aplikasi memakai path absolut (`/js/...`, `/models/...`). Deploy harus di
  **root domain** atau subdomain, bukan subfolder seperti
  `https://user.github.io/repo/`. Untuk GitHub Pages gunakan custom domain,
  atau gunakan Netlify/Vercel/Cloudflare Pages.
- Service Worker menyimpan aset untuk offline. Setelah mengubah model/aset,
  naikkan `CACHE_VERSION` di `public/sw.js`.
- Lisensi dataset: WL-BISINDO **CC BY-NC 4.0 (non-komersial, atribusi wajib)**,
  BISINDO Word Dataset CC BY 4.0. Lihat `ml/data/raw/ATTRIBUTION.md`.
- Model hanya mengenali **27 kata** dari dataset yang tersedia; bukan
  penerjemah BISINDO lengkap.

## Pemeriksaan sebelum deploy

```bash
npm run deploy:check
npm run test:syntax
npm run test:engine
npm run test:ml
npm run test:ui
```

`deploy:check` memverifikasi berkas wajib, konsistensi vocab–model–sketsa, dan
keberadaan konfigurasi hosting. Ini bukan pengganti uji kamera manual.

## Setelah deploy

1. Buka situs via HTTPS.
2. Izinkan kamera.
3. Tahan isyarat ±2,6 detik sampai kata masuk ke kalimat.
4. Uji mode pesawat setelah kunjungan pertama (PWA offline).
