# MediaPipe Tasks Vision — legacy 0.10.35

Salinan lokal `@mediapipe/tasks-vision@0.10.35` untuk fallback diagnostik.

- Sumber: https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.35
- Lisensi: Apache-2.0
- Dipakai hanya jika versi 1.2.3 tidak menghasilkan deteksi di browser tertentu.
- Muat lewat `debug-kamera.html?bundle=legacy`.

File:

- `vision_bundle.mjs`
- `wasm/vision_wasm_internal.js` + `.wasm` (SIMD)
- `wasm/vision_wasm_nosimd_internal.js` + `.wasm` (non-SIMD)
