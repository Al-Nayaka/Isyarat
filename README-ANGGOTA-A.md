# Paket Anggota A — Frontend / UI

Paket ini berisi berkas milik **Anggota A** ditambah berkas bersama. Ini adalah
**potongan proyek**, bukan aplikasi utuh sampai digabung dengan paket B dan C.

## Cakupan

- `public/index.html`
- `public/css/style.css`
- `public/js/ui/` (`app.js`, `camera.js`, `engine-bridge.js`, `speech.js`, `storage.js`)
- `public/assets/logo.svg`, `ilustrasi-beranda.png`, `avatar-kamera-netral.svg`
- `public/icons/`
- `public/data/kosakata.contoh.json` (data contoh untuk `?mock=1`)
- `public/debug-kamera.html`
- `CHECKLIST_ANGGOTA_A.md`, `PANDUAN-KAMERA-HP.md`, `CATATAN-REVISI-DESAIN-ACC.md`
- `docs/DESAIN_DAN_UJI.md`, `docs/check-ui.mjs`, `docs/browser-*.py`

## Cara push ke GitHub

```bash
git init
git checkout -b feat/ui
git add .
git commit -m "A: frontend, UI responsif, kamera, riwayat, PWA shell"
git remote add origin <URL-REPO-TIM>
git push -u origin feat/ui
```

Buat Pull Request ke branch `main` tim. Merge **A lebih dulu**, lalu B, lalu C.

## Setelah semua paket digabung

```bash
npm start
# buka http://localhost:5500
npm run test:syntax
npm run test:ui
```

## Catatan

- Kontrak ke engine: `docs/INTEGRASI_BC.md` dan `docs/KONTRAK_BC.md`.
- `?mock=1` hanya simulasi UI, **bukan AI**.
- Kamera butuh HTTPS atau `localhost`.
- Deploy produksi ada di paket FULL (`DEPLOY.md`).
