# Langkah Merge dan Deploy (dari nol sampai publish)

Panduan ini memakai **satu laptop** untuk menyiapkan repository, tiga branch
anggota, merge, lalu deploy. Semua perintah memakai **PowerShell di Windows**.
Ganti `<URL-REPO>` dengan URL repository GitHub tim.

> Ringkas: buat repo kosong → buat 3 branch dari 3 ZIP → push → merge PR
> berurutan A → B → C → jalankan tes → deploy `public/` → uji di HTTPS.

---

## 0. Persiapan

Pastikan sudah terpasang:

- Git (`git --version`)
- Node.js 20+ (`node --version`)
- Akun GitHub
- Folder proyek ini beserta `release/` berisi 4 ZIP

Cek berkas ZIP:

```powershell
Get-ChildItem release\*.zip
```

Yang dipakai: `ISYARAT-ANGGOTA-A.zip`, `B`, `C`, dan `ISYARAT-FULL-DEPLOY.zip`.

---

## 1. Buat repository kosong di GitHub

1. Buka <https://github.com/new>.
2. Nama repo, misalnya `isyarat`.
3. **Jangan** centang "Add a README file", `.gitignore`, atau license.
4. Create repository.
5. Salin URL repo, misalnya `https://github.com/USER/isyarat.git`.

Repository kosong membuat proses merge branch lebih bersih.

---

## 2. Siapkan repo lokal

```powershell
New-Item -ItemType Directory -Force C:\kerja\isyarat-tim | Out-Null
Set-Location C:\kerja\isyarat-tim
git init
git branch -M main

"# Isyarat" | Set-Content README.md
git add README.md
git commit -m "chore: initial commit"
```

Commit awal ini menjadi **induk bersama** ketiga branch.

---

## 3. Buat branch Anggota A

```powershell
git checkout -b feat/ui

$tmp = Join-Path $env:TEMP "isyarat-a"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "C:\path\ke\proyek\release\ISYARAT-ANGGOTA-A.zip" -DestinationPath $tmp
Get-ChildItem -Force (Join-Path $tmp "ISYARAT-ANGGOTA-A") | Copy-Item -Destination . -Recurse -Force

git add .
git commit -m "feat(ui): frontend, kamera, riwayat, dan PWA shell"
```

Ganti `C:\path\ke\proyek` dengan lokasi folder proyek saat ini.

---

## 4. Buat branch Anggota B

```powershell
git checkout main
git checkout -b feat/engine

$tmp = Join-Path $env:TEMP "isyarat-b"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "C:\path\ke\proyek\release\ISYARAT-ANGGOTA-B.zip" -DestinationPath $tmp
Get-ChildItem -Force (Join-Path $tmp "ISYARAT-ANGGOTA-B") | Copy-Item -Destination . -Recurse -Force

git add .
git commit -m "feat(engine): MediaPipe lokal, normalisasi, stabilisasi, dan offline"
```

---

## 5. Buat branch Anggota C

```powershell
git checkout main
git checkout -b feat/ml

$tmp = Join-Path $env:TEMP "isyarat-c"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "C:\path\ke\proyek\release\ISYARAT-ANGGOTA-C.zip" -DestinationPath $tmp
Get-ChildItem -Force (Join-Path $tmp "ISYARAT-ANGGOTA-C") | Copy-Item -Destination . -Recurse -Force

git add .
git commit -m "feat(ml): dataset 27 kata, model KNN, evaluasi, dan sketsa"
```

---

## 6. Cek branch sebelum push

```powershell
git checkout main
git branch
git log --oneline --all --decorate --graph
```

Harus ada 4 branch: `main`, `feat/ui`, `feat/engine`, `feat/ml`.
Masing-masing branch anggota hanya menambah berkas miliknya + berkas bersama.

---

## 7. Push ke GitHub

```powershell
git remote add origin <URL-REPO>
git push -u origin main
git push -u origin feat/ui
git push -u origin feat/engine
git push -u origin feat/ml
```

Buka repo di GitHub → tab **Branches** → pastikan keempat branch muncul.

---

## 8. Merge lewat Pull Request

Urutan **wajib**: A → B → C.

### 8.1 Merge A

1. GitHub → **Pull requests** → **New pull request**.
2. Base: `main`, compare: `feat/ui`.
3. Create pull request → **Merge pull request** → Confirm merge.

### 8.2 Merge B

1. New pull request: base `main`, compare `feat/engine`.
2. Jika GitHub menampilkan "This branch is out-of-date", klik **Update branch**.
3. Merge pull request.

### 8.3 Merge C

1. New pull request: base `main`, compare `feat/ml`.
2. Update branch bila diminta.
3. Merge pull request.

Berkas bersama di ketiga paket isinya identik, jadi seharusnya **tidak ada
konflik**. Jika ada konflik, gunakan versi dari branch yang sedang di-merge
kecuali untuk `README.md` (boleh digabung manual).

### Alternatif tanpa PR (merge lokal)

```powershell
Set-Location C:\kerja\isyarat-tim
git checkout main
git merge --no-ff feat/ui -m "merge: anggota A"
git merge --no-ff feat/engine -m "merge: anggota B"
git merge --no-ff feat/ml -m "merge: anggota C"
git push origin main
```

---

## 9. Tarik hasil merge ke lokal

```powershell
Set-Location C:\kerja\isyarat-tim
git checkout main
git pull origin main
```

Cek struktur akhir:

```powershell
Test-Path public\index.html
Test-Path public\js\engine\index.js
Test-Path public\models\knn-model.json
Test-Path public\assets\guides\kapan.svg
```

Semua harus `True`.

---

## 10. Verifikasi sebelum deploy

```powershell
npm run deploy:check
npm run test:syntax
npm run test:engine
npm run test:ml
npm run test:ui
npm start
```

Buka `http://localhost:5500`, lalu uji:

- beranda tampil;
- menu **Isyarat** menampilkan 27 kata + sketsa kartun;
- kamera meminta izin;
- tahan isyarat ±2,6 detik sampai kata masuk kalimat;
- tombol Ucapkan, Simpan, Riwayat, Hapus berfungsi.

Hentikan server dengan `Ctrl+C`.

---

## 11. Deploy ke Netlify (disarankan)

1. Buka <https://app.netlify.com> → **Add new site** → **Import an existing project**.
2. Pilih **GitHub** → pilih repo `isyarat`.
3. Build command: **kosong**.
4. Publish directory: **`public`**.
5. Deploy site.
6. Buka URL `https://...netlify.app`.

`netlify.toml` sudah mengatur publish directory dan header WASM/task.

### Alternatif drag-and-drop

1. Ekstrak `ISYARAT-FULL-DEPLOY.zip`.
2. Buka <https://app.netlify.com/drop>.
3. Seret folder `public/` ke halaman tersebut.
4. Tunggu sampai URL muncul.

### Alternatif Vercel

1. <https://vercel.com/new> → import repo.
2. Framework: **Other**.
3. Output directory: **`public`**.
4. Deploy.

> Deploy harus di **root domain/subdomain**. Jangan di subfolder GitHub Pages
> seperti `https://user.github.io/repo/`, karena aplikasi memakai path absolut
> `/js/...` dan `/models/...`.

---

## 12. Uji setelah publish

Di URL HTTPS:

- [ ] Halaman terbuka tanpa error di Console.
- [ ] Ikon/manifest terbaca (bisa "Add to Home Screen").
- [ ] Izin kamera muncul dan video tampil.
- [ ] Isyarat ditahan ±2,6 detik → kata diterima satu kali.
- [ ] Suara bahasa Indonesia berbunyi (jika perangkat mendukung).
- [ ] Riwayat tersimpan setelah reload.
- [ ] Mode pesawat setelah kunjungan pertama → aplikasi masih terbuka (PWA).
- [ ] Gambar sketsa di menu Isyarat muncul.
- [ ] Tidak ada kata `air`, `belajar`, `ingat`, `motor`, `apa`, `di_mana`,
      `bagaimana`, `merah`, `datang`, `keluarga` di daftar.

---

## 13. Jika ada masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Halaman 404 di hosting | Publish directory salah | Set `public` |
| CSS/JS 404 | Deploy di subfolder | Pakai root domain/subdomain |
| WASM gagal dimuat | MIME salah | Pastikan `application/wasm` |
| Kamera tidak muncul | Bukan HTTPS/localhost | Pakai HTTPS |
| Model lama masih tampil | Service Worker cache | Naikkan `CACHE_VERSION` di `public/sw.js`, deploy ulang, hard refresh |
| Merge konflik di berkas bersama | ZIP diedit manual | Ambil versi terbaru; berkas bersama seharusnya identik |
| `npm run test:ml` gagal | Vocab/model/sketsa tidak sinkron | Jalankan `npm run ml:train` lalu `npm run ml:guides` |

---

## 14. Checklist sukses

- [ ] Repository GitHub berisi branch `main`, `feat/ui`, `feat/engine`, `feat/ml`.
- [ ] Tiga Pull Request berhasil di-merge berurutan.
- [ ] `main` berisi `public/`, `ml/`, `docs/`, dan `scripts/`.
- [ ] `npm run deploy:check` lulus.
- [ ] Semua tes lulus.
- [ ] Situs HTTPS bisa dibuka.
- [ ] Kamera, isyarat, teks, suara, riwayat, dan daftar isyarat diuji.
- [ ] PWA offline diuji setelah kunjungan pertama.
- [ ] Bukti screenshot/rekaman disimpan untuk laporan.
