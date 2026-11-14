# Dataset mentah Isyarat (Anggota C)

Simpan hasil unduhan dari `http://localhost:5500/recorder.html` di folder ini,
atau hasil ekstraksi dataset gambar dari `ml/scripts/extract-images.py`.

## Dataset publik yang sudah dipakai

`bisindo-word.jsonl` (499 sampel) diekstrak dari **Indonesian Sign Language
(BISINDO) Word Dataset** (Kaggle, Mulkan Fajri, CC BY 4.0). Lima kelas:
`damai`, `mendengar`, `ragu`, `semoga_beruntung`, `tersenyum`.
Semua sampel memakai satu `orang_id` (`KAGGLE_WORD`), sehingga lima kelas ini
tidak bisa dievaluasi secara signer-independent.

`wl-bisindo.jsonl` diekstrak dari **Word-Level BISINDO (WL-BISINDO)**
(Kaggle, Kindy dkk., CC BY-NC 4.0). Sumbernya 32 kelas kata, 5 penutur; 10
kelas anomali dibuang sehingga 22 kelas dipakai. Satu frame
representatif diambil dari setiap video, lalu landmark-nya dinormalisasi.
`orang_id` = penutur (`WL_S1`..`WL_S5`), sehingga split evaluasi dapat
signer-independent. Atribusi lengkap ada di `ATTRIBUTION.md`.

> Lisensi WL-BISINDO **CC BY-NC 4.0**: hanya untuk penggunaan non-komersial,
> atribusi wajib. Model KNN statis tidak memahami gerakan temporal; frame
> representatif bukan pengenalan isyarat bergerak.

## Format satu sampel (JSONL)

```json
{
  "label": "damai",
  "landmarks": [126 angka],
  "feature_mode": "dual",
  "feature_size": 126,
  "tangan_terlihat": 2,
  "orang_id": "P01",
  "kondisi": {"cahaya": "terang", "jarak": "sedang", "latar": "polos"},
  "sumber": "recorder-b",
  "versi_normalisasi": "1.0",
  "dicatat_pada": "2026-11-13T10:00:00.000Z"
}
```

`landmarks` berisi fitur hasil normalisasi B (wrist-origin, skala maksimum 1),
bukan koordinat mentah MediaPipe.

## Aturan pengumpulan

1. Minimal **3 partisipan** berbeda (`P01`, `P02`, `P03`).
2. Setiap label minimal 30 sampel per partisipan.
3. Variasikan kondisi: cahaya terang/redup, jarak dekat/sedang/jauh, latar polos/ramai.
4. Jangan mencampur `feature_mode` (`dual`/`single`) dalam satu model.
5. Label harus sama dengan `id` di `public/data/vocab.json`.

## Melatih model

```bash
npm run ml:validate          # cek dataset tanpa menulis model
npm run ml:train             # latih + evaluasi
```

Atau atur split partisipan secara eksplisit:

```bash
node ml/scripts/train-knn.mjs --test-participants P03
```

Output:

- `public/models/knn-model.json`
- `ml/reports/akurasi.json`
- `docs/laporan-akurasi.md`

Data uji **tidak** dimasukkan ke model. Akurasi dihitung dari partisipan yang
tidak ikut training.
