/* Service Worker Isyarat (Anggota B).
 * Tujuan: aplikasi inti + MediaPipe + model dapat dibuka tanpa internet.
 * Naikkan CACHE_VERSION setiap kali daftar aset berubah.
 */
const CACHE_VERSION = 'isyarat-v6'; // v6: dataset 27 kata (10 kata anomali dibuang, 14 Nov 2026)
const APP_SHELL = '/index.html';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/ui/app.js',
  '/js/ui/camera.js',
  '/js/ui/engine-bridge.js',
  '/js/ui/speech.js',
  '/js/ui/storage.js',
  '/js/engine/index.js',
  '/js/engine/config.js',
  '/js/engine/errors.js',
  '/js/engine/hand-detector.js',
  '/js/engine/normalize.js',
  '/js/engine/smoother.js',
  '/assets/logo.svg',
  '/assets/ilustrasi-beranda.png',
  '/assets/avatar-kamera-netral.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/vendor/mediapipe/vision_bundle.mjs',
  '/vendor/mediapipe/wasm/vision_wasm_internal.js',
  '/vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  '/models/hand_landmarker.task'
];

/* Berkas opsional dari C. Kegagalan salah satu tidak membatalkan instalasi. */
const OPTIONAL_PRECACHE = [
  '/data/vocab.json',
  '/data/kosakata.contoh.json',
  '/js/ml/classifier.js',
  '/models/knn-model.json',
  '/recorder.html',
  '/js/recorder/recorder.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled([
      ...PRECACHE.map(url => cache.add(new Request(url, {cache: 'reload'}))),
      ...OPTIONAL_PRECACHE.map(url => cache.add(new Request(url, {cache: 'reload'})))
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(APP_SHELL, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(APP_SHELL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
