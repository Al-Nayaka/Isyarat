# Laporan Akurasi Model KNN

Dibuat: 2026-11-14T07:42:27.800Z

> Skor `confidence` per prediksi bukan akurasi model. Angka akurasi di bawah dihitung dari data uji yang dipisahkan.

## Ringkasan

- File dataset: 2
- Total sampel valid: 1504
- Label: berangkat, cari, damai, dengar, hari, hijau, hitam, kapan, kuning, lagi, maaf, makan, malam, mendengar, mengapa, pagi, ragu, rumah, saya, semoga_beruntung, siang, siapa, sore, teman, terima_kasih, tersenyum, tuli
- Partisipan: KAGGLE_WORD, WL_S1, WL_S2, WL_S3, WL_S4, WL_S5
- Mode split: **participant**
- Partisipan uji: WL_S2, WL_S5
- Sampel training / uji: 1030 dasar + 1030 augmentasi = 2060 / 474
- Augmentasi: mirror-x
- Sumber data: kaggle:mulkanfajri/indonesian-sign-language-bisindo-word-dataset, kaggle:glennleonali/wl-bisindo
- Lisensi data: CC BY 4.0, CC BY-NC 4.0
- Fitur: dual (126 nilai), k=5

## Metrik

| Metrik | Nilai |
|---|---|
| Akurasi | 68.99% |
| Macro F1 | 0.6913 |
| Benar / Total | 327 / 474 |

## Per kelas

| Label | Support | Benar | Precision | Recall | F1 |
|---|---|---|---|---|---|
| berangkat | 25 | 19 | 0.5758 | 0.76 | 0.6552 |
| cari | 20 | 11 | 0.6111 | 0.55 | 0.5789 |
| damai | 0 | 0 | 0 | 0 | 0 |
| dengar | 25 | 21 | 0.8077 | 0.84 | 0.8235 |
| hari | 15 | 8 | 0.5714 | 0.5333 | 0.5517 |
| hijau | 21 | 0 | 0 | 0 | 0 |
| hitam | 20 | 16 | 0.7273 | 0.8 | 0.7619 |
| kapan | 25 | 25 | 0.8333 | 1 | 0.9091 |
| kuning | 25 | 20 | 0.7692 | 0.8 | 0.7843 |
| lagi | 20 | 14 | 0.7368 | 0.7 | 0.7179 |
| maaf | 20 | 15 | 0.4839 | 0.75 | 0.5882 |
| makan | 19 | 13 | 0.9286 | 0.6842 | 0.7879 |
| malam | 20 | 10 | 0.4545 | 0.5 | 0.4762 |
| mendengar | 0 | 0 | 0 | 0 | 0 |
| mengapa | 25 | 14 | 0.4118 | 0.56 | 0.4746 |
| pagi | 25 | 13 | 0.9286 | 0.52 | 0.6667 |
| ragu | 0 | 0 | 0 | 0 | 0 |
| rumah | 25 | 21 | 1 | 0.84 | 0.913 |
| saya | 20 | 18 | 0.9 | 0.9 | 0.9 |
| semoga_beruntung | 0 | 0 | 0 | 0 | 0 |
| siang | 19 | 15 | 0.8333 | 0.7895 | 0.8108 |
| siapa | 21 | 19 | 0.9048 | 0.9048 | 0.9048 |
| sore | 24 | 19 | 0.7037 | 0.7917 | 0.7451 |
| teman | 25 | 16 | 1 | 0.64 | 0.7805 |
| terima_kasih | 20 | 8 | 0.8889 | 0.4 | 0.5517 |
| tersenyum | 0 | 0 | 0 | 0 | 0 |
| tuli | 15 | 12 | 0.8571 | 0.8 | 0.8276 |

## Peringatan

- Label "damai" tidak memiliki sampel uji.
- Label "mendengar" tidak memiliki sampel uji.
- Label "ragu" tidak memiliki sampel uji.
- Label "semoga_beruntung" tidak memiliki sampel uji.
- Label "tersenyum" tidak memiliki sampel uji.

## Batasan

- Hasil ini hanya berlaku untuk kosakata, kondisi pencahayaan, jarak, dan partisipan yang ada di dataset.
- Model KNN tidak memahami gerakan temporal; isyarat harus berupa bentuk statis atau pose tunggal.
- Bila split memakai sampel (bukan partisipan), angka akurasi cenderung terlalu optimistis dan tidak boleh diklaim sebagai generalisasi.
- Bila sampel berasal dari frame video berurutan, data uji dapat sangat mirip dengan data training sehingga akurasi ikut terlalu optimistis.
- Uji dengan partisipan baru di luar dataset tetap diperlukan sebelum demo.

