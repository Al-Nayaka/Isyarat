# Kontrak integrasi Anggota A – B – C

Dokumen ini harus disepakati bersama agar tiga prompt AI tidak membuat arsitektur berbeda.

## Kontrak B → A

B menyediakan modul JavaScript ES module bernama `public/js/engine/index.js` dengan ekspor:

```js
export async function initEngine() {
  // Muat MediaPipe WASM dan model lokal. Berikan error jika tidak siap.
}

export async function processFrame(videoElement) {
  // videoElement adalah HTMLVideoElement dari A.
  // Return nilai berikut, baik secara sync maupun async:
  return {
    status: 'ok', // 'no_hand' | 'low_confidence' | 'ok'
    label: 'halo', // cocok dengan `id` di vocab.json atau null
    confidence: 0.93, // number 0..1
    accepted: true // sudah melewati stabilisasi/smoothing, layak ditambah
  };
}
```

Jika tidak ada tangan: `{status:'no_hand', label:null, confidence:0, accepted:false}`.

Jika prediksi belum yakin: `{status:'low_confidence', label:'halo', confidence:0.54, accepted:false}`. Label belum ditambah ke kalimat.

Jika hasil diterima: `{status:'ok', label:'halo', confidence:0.93, accepted:true}`. Mesin B wajib mencegah keluaran diterima berkali-kali untuk isyarat sama saat tangan masih ditahan. A juga menerapkan pembatasan duplikat minimal sebagai lapisan pengaman.

> Jangan mengganti nama properti menjadi `word`, `probability`, `prediction`, atau `isAccepted` tanpa menyelaraskan seluruh anggota.

## Kontrak C → B dan A

C menyediakan `public/data/vocab.json` berupa array:

```json
[
  {
    "id": "halo",
    "teks_tampil": "Halo",
    "audio_file": null,
    "catatan_isyarat": "Keterangan diverifikasi C sesuai sistem isyarat yang dipilih"
  }
]
```

`id` wajib cocok dengan `label` dari engine B, termasuk huruf dan tanda garis bawah. C menyiapkan dataset, classifier KNN/model final, pembagian data train/test serta laporan akurasi terpisah dari skor confidence per prediksi.

### Perhatian teknis

- A hanya mengirim **video HTML** ke B, bukan koordinat tangan. B dan C yang menentukan 63/126 landmark, normalisasi, dimensi input, urutan fitur, serta kompatibilitas model.
- A menampilkan `confidence` sebagai skor prediksi, **bukan akurasi model**.
- Area `<video>` memakai `object-fit: contain`, tidak dipotong. Tampilannya dimirror (`scaleX(-1)`) hanya secara visual. B memproses stream `videoElement` dan harus mendokumentasikan apakah model membutuhkan pembalikan koordinat.
- Tidak ada CDN atau unggah frame kamera dalam modul A. B harus memaketkan berkas MediaPipe/WASM/model **secara lokal** dan menerapkan Service Worker/PWA sesuai pembagian kerja.
- File `?mock=1` hanyalah simulasi frontend, bukan mode produk akhir. Video demo harus memperlihatkan inferensi asli, jika modul sudah tersedia.
- Untuk menguji kamera fisik di HP yang mengakses server laptop melalui jaringan, browser umumnya membutuhkan **HTTPS**; `localhost` berfungsi sebagai secure context pada perangkat itu sendiri. Koordinasikan pengujian HP dengan B.
