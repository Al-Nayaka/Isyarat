# Paket Anggota B — Engine / PWA

Paket ini berisi berkas milik **Anggota B** ditambah berkas bersama. Ini adalah
**potongan proyek**, bukan aplikasi utuh sampai digabung dengan paket A dan C.

## Cakupan

- `public/js/engine/` (`config.js`, `errors.js`, `hand-detector.js`, `normalize.js`, `smoother.js`, `index.js`)
- `public/js/recorder/recorder.js` + `public/recorder.html`
- `public/manifest.json`, `public/sw.js`, `public/icons/`
- `public/vendor/mediapipe/` dan `public/vendor/mediapipe-legacy/`
- `public/models/hand_landmarker.task`
- `server.mjs`
- `docs/ENGINE_B.md`, `docs/test-engine.mjs`

## Cara push ke GitHub

```bash
git init
git checkout -b feat/engine
git add .
git commit -m "B: MediaPipe lokal, normalisasi, stabilisasi, PWA offline"
git remote add origin <URL-REPO-TIM>
git push -u origin feat/engine
```

Buat Pull Request ke branch `main` tim. Urutan merge: **A → B → C**.

## Setelah semua paket digabung

```bash
npm start
npm run test:engine
```

## Catatan

- Kontrak hasil: `{status, label, confidence, accepted}` — lihat `docs/INTEGRASI_BC.md`.
- Stabilisasi menerima kata setelah isyarat ditahan ±2,6 detik.
- Naikkan `CACHE_VERSION` di `public/sw.js` setiap aset berubah.
- Deploy produksi ada di paket FULL (`DEPLOY.md`).
