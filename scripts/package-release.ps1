# Membuat paket ZIP per anggota.
# Jalankan dari root proyek:
#   powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
# Hasil di folder release/ (tidak ikut di-commit; lihat .gitignore).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root 'release'
$staging = Join-Path $release '_staging'

if (Test-Path $release) { Remove-Item $release -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

$shared = @(
  '.gitignore',
  'package.json',
  'README-MULAI-DI-SINI.md',
  'DEPLOY.md',
  'PANDUAN-PAKET.md',
  'LANGKAH-MERGE-DAN-DEPLOY.md',
  'netlify.toml',
  'vercel.json',
  'MULAI-DI-SINI.txt',
  'JALANKAN-ISYARAT-WINDOWS.bat',
  'public/_headers',
  'docs/INTEGRASI_BC.md',
  'docs/KONTRAK_BC.md',
  'scripts/deploy-check.mjs',
  'scripts/package-release.ps1',
  'README-ANGGOTA-A.md',
  'README-ANGGOTA-B.md',
  'README-ANGGOTA-C.md'
)

$memberA = @(
  'public/index.html',
  'public/css',
  'public/js/ui',
  'public/assets/logo.svg',
  'public/assets/ilustrasi-beranda.png',
  'public/assets/avatar-kamera-netral.svg',
  'public/icons',
  'public/data/kosakata.contoh.json',
  'public/debug-kamera.html',
  'CHECKLIST_ANGGOTA_A.md',
  'PANDUAN-KAMERA-HP.md',
  'CATATAN-REVISI-DESAIN-ACC.md',
  'docs/DESAIN_DAN_UJI.md',
  'docs/check-ui.mjs',
  'docs/browser-camera-mock-test.py',
  'docs/browser-layout-test.py',
  'docs/browser-smoke-test.py',
  'README-ANGGOTA-A.md'
)

$memberB = @(
  'public/js/engine',
  'public/js/recorder',
  'public/recorder.html',
  'public/manifest.json',
  'public/sw.js',
  'public/icons',
  'public/vendor/mediapipe',
  'public/vendor/mediapipe-legacy',
  'public/models/hand_landmarker.task',
  'server.mjs',
  'docs/ENGINE_B.md',
  'docs/test-engine.mjs',
  'README-ANGGOTA-B.md'
)

$memberC = @(
  'public/data/vocab.json',
  'public/models/knn-model.json',
  'public/js/ml/classifier.js',
  'ml',
  'docs/ML_C.md',
  'docs/laporan-akurasi.md',
  'docs/test-ml.mjs',
  'README-ANGGOTA-C.md'
)

# Hanya sketsa untuk kata yang masih ada di vocab (bukan 10 kata anomali).
$vocabPath = Join-Path $root 'public/data/vocab.json'
if (-not (Test-Path $vocabPath)) { throw 'public/data/vocab.json tidak ditemukan.' }
$vocab = Get-Content $vocabPath -Raw | ConvertFrom-Json
foreach ($item in $vocab) {
  $memberC += "public/assets/guides/$($item.id).svg"
}

$extrasFull = @(
  'CHECKLIST-SETELAH-INSTALL.md',
  'CATATAN-REVISI-TERAKHIR.md',
  'PRATINJAU_SILUET_KAMERA.png'
)

$packages = [ordered]@{
  'ISYARAT-ANGGOTA-A' = @($memberA + $shared)
  'ISYARAT-ANGGOTA-B' = @($memberB + $shared)
  'ISYARAT-ANGGOTA-C' = @($memberC + $shared)
  'ISYARAT-FULL-DEPLOY' = @($memberA + $memberB + $memberC + $shared + $extrasFull)
}

$copied = @{}

function Copy-Relative {
  param([string]$Package, [string]$Relative)

  $key = "$Package|$Relative"
  if ($copied.ContainsKey($key)) { return }
  $copied[$key] = $true

  $source = Join-Path $root $Relative
  if (-not (Test-Path $source)) {
    Write-Warning "Lewati (tidak ada): $Relative"
    return
  }

  $item = Get-Item $source
  if ($item.PSIsContainer) {
    Get-ChildItem $source -Recurse -File |
      Where-Object { $_.FullName -notmatch '__pycache__' -and $_.Name -notmatch '\.pyc$' } |
      ForEach-Object {
        $relativeFile = $_.FullName.Substring($root.Length + 1)
        $destination = Join-Path (Join-Path $staging $Package) $relativeFile
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item $_.FullName $destination -Force
      }
  } else {
    $destination = Join-Path (Join-Path $staging $Package) $Relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item $source $destination -Force
  }
}

foreach ($packageName in $packages.Keys) {
  foreach ($relative in $packages[$packageName]) {
    Copy-Relative -Package $packageName -Relative $relative
  }
}

$results = @()
foreach ($packageName in $packages.Keys) {
  $source = Join-Path $staging $packageName
  $zip = Join-Path $release "$packageName.zip"
  Compress-Archive -Path $source -DestinationPath $zip -CompressionLevel Optimal -Force
  $size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
  $files = (Get-ChildItem $source -Recurse -File).Count
  $results += [pscustomobject]@{ Paket = $packageName; Berkas = $files; MB = $size }
}

Remove-Item $staging -Recurse -Force

Copy-Item (Join-Path $root 'PANDUAN-PAKET.md') (Join-Path $release 'PANDUAN-PAKET.md') -Force
Get-ChildItem $release -Filter '*.zip' | Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLower())  $([System.IO.Path]::GetFileName($_.Path))" } |
  Set-Content (Join-Path $release 'SHA256SUMS.txt') -Encoding ascii

$results | Format-Table -AutoSize
Write-Host "`nZIP ditulis ke: $release"
Write-Host 'Catatan: paket anggota adalah potongan proyek; gabungkan A + B + C, atau pakai ISYARAT-FULL-DEPLOY.'
