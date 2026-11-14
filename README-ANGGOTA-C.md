# Paket Anggota C — Machine Learning / Dataset

Paket ini berisi berkas milik **Anggota C** ditambah berkas bersama. Ini adalah
**potongan proyek**, bukan aplikasi utuh sampai digabung dengan paket A dan B.

## Cakupan

- `public/data/vocab.json` — 27 kata final
- `public/models/knn-model.json` — model KNN hasil training
- `public/js/ml/classifier.js`
- `public/assets/guides/*.svg` — sketsa kartun untuk 27 kata aktif
- `ml/data/raw/` — landmark dataset + atribusi
- `ml/scripts/` — ekstraksi, training, pembuat sketsa
- `ml/reports/akurasi.json`
- `docs/ML_C.md`, `docs/laporan-akurasi.md`, `docs/test-ml.mjs`

## Cara push ke GitHub

```bash
git init
git checkout -b feat/ml
git add .
git commit -m "C: dataset 27 kata, model KNN, evaluasi, sketsa panduan"
git remote add origin <URL-REPO-TIM>
git push -u origin feat/ml
```

Buat Pull Request ke branch `main` tim. Urutan merge: **A → B → C**.

## Setelah semua paket digabung

```bash
npm run ml:validate
npm run test:ml
```

## Hasil evaluasi

- Split partisipan (`WL_S2`, `WL_S5`), `compliant: true`
- Akurasi **68,99% (327/474)** untuk 22 kelas WL-BISINDO
- Lima kelas dataset lama tidak punya sampel uji
- Macro F1 0,6913

## Catatan lisensi

- WL-BISINDO: **CC BY-NC 4.0** — non-komersial, atribusi wajib.
- BISINDO Word Dataset: CC BY 4.0.
- Rincian: `ml/data/raw/ATTRIBUTION.md`.
- Model KNN statis: bukan pengenalan gerakan temporal.

Deploy produksi ada di paket FULL (`DEPLOY.md`).
