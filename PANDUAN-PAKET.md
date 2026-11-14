# Panduan Paket ZIP dan Merge

Folder `release/` berisi empat arsip:

| ZIP | Isi | Untuk |
|---|---|---|
| `ISYARAT-ANGGOTA-A.zip` | Frontend/UI + berkas bersama | Branch `feat/ui` |
| `ISYARAT-ANGGOTA-B.zip` | Engine MediaPipe, recorder, PWA + berkas bersama | Branch `feat/engine` |
| `ISYARAT-ANGGOTA-C.zip` | Dataset, model KNN, sketsa, evaluasi + berkas bersama | Branch `feat/ml` |
| `ISYARAT-FULL-DEPLOY.zip` | Gabungan A + B + C + seluruh dokumentasi | Deploy produksi |

Buat ulang kapan saja:

```bash
powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
# atau
npm run package:release
```

## Cara kerja paket anggota

Setiap ZIP anggota berisi:

- berkas milik anggota tersebut pada path final proyek;
- berkas bersama yang **identik** di ketiga paket (README, `package.json`,
  `DEPLOY.md`, `netlify.toml`, `vercel.json`, kontrak, skrip paket).

Karena berkas bersama identik, merge tidak menimbulkan konflik. Paket anggota
**belum bisa dijalankan sendiri** sampai ketiganya digabung.

## Urutan merge yang disarankan

1. Anggota A → `feat/ui` → Pull Request → merge ke `main`
2. Anggota B → `feat/engine` → Pull Request → merge ke `main`
3. Anggota C → `feat/ml` → Pull Request → merge ke `main`

Setelah merge, struktur akhirnya sama dengan `ISYARAT-FULL-DEPLOY.zip`.

## Perintah per anggota

```bash
# contoh untuk anggota A
git init
git checkout -b feat/ui
git add .
git commit -m "A: frontend dan UI Isyarat"
git remote add origin <URL-REPO-TIM>
git push -u origin feat/ui
```

Ganti nama branch dan pesan commit sesuai anggota.

## Setelah semua digabung

```bash
npm start
npm run deploy:check
npm run test:syntax
npm run test:engine
npm run test:ml
npm run test:ui
```

## Deploy

Pakai `ISYARAT-FULL-DEPLOY.zip` atau repository hasil merge:

- Netlify / Vercel / Cloudflare Pages
- Publish/output directory: **`public`**
- Detail: `DEPLOY.md`
- Langkah lengkap dari nol sampai publish: `LANGKAH-MERGE-DAN-DEPLOY.md`

## Berkas yang tidak ikut paket

- Folder `release/` itu sendiri
- `__pycache__/`, `*.pyc`, `node_modules/`
- 10 sketsa SVG dari kata yang sudah dihapus dari kosakata
  (`air`, `belajar`, `ingat`, `motor`, `apa`, `di_mana`, `bagaimana`, `merah`,
  `datang`, `keluarga`). Berkas itu boleh tetap ada di folder kerja, tetapi
  tidak dipakai aplikasi dan tidak ikut ZIP.

## Batas kejujuran

- Model hanya mengenali **27 kata**.
- Akurasi **68,99%** hanya untuk 22 kelas WL-BISINDO; lima kelas dataset lama
  tidak punya sampel uji.
- Uji kamera fisik, izin browser, dan PWA offline tetap harus dilakukan manual.
