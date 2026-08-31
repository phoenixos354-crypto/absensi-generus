const CACHE_NAME = 'absensi-generus-v2';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: selalu coba online dulu (data absensi harus real-time),
// baru jatuh ke cache/offline page kalau benar-benar tidak ada koneksi.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Jangan ikut campur tangani request internal Next.js (RSC payload saat
  // pindah halaman via router.push, prefetch, chunk JS/CSS, dll). Kalau
  // request ini ikut di-cache lalu koneksi sempat lemot, yang dibalikin ke
  // Next.js router bisa nggak sesuai format yang diharapkan -> router
  // "menyerah" dan hard-reload browser (kelihatan seperti refresh sendiri
  // pas klik tombol Absen/Rekap/Target/Kelola/Admin). Biarkan request ini
  // langsung ke network tanpa campur tangan service worker.
  const url = new URL(request.url);
  const isNextInternal = url.pathname.startsWith('/_next/')
    || url.searchParams.has('_rsc')
    || request.headers.get('RSC') === '1'
    || request.headers.get('Next-Router-Prefetch') === '1';
  if (isNextInternal) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});
