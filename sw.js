/*
 * TEMP·CONV service worker — same-origin only, versioned cache,
 * no opaque or cross-origin responses are ever stored.
 * Update path: bump CACHE -> old caches purged on activate,
 * or client sends SKIP_WAITING which reloads once.
 */
'use strict';

const CACHE = 'tempconv-v3.0.0';
const ASSETS = [
  './index.html',
  './Stylesheets/app.css',
  './Scripts/convert.js',
  './Scripts/app.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/fonts/jetbrains-mono-var-latin.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('tempconv-') && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached !== undefined) return cached;
    if (req.mode === 'navigate') {
      const idx = await caches.match('./index.html');
      if (idx !== undefined) return idx;
    }
    try {
      return await fetch(req);
    } catch (err) {
      // offline and not precached: fail the request cleanly per content type
      if (req.destination === 'font' || req.destination === 'image') {
        return new Response('', { status: 504, statusText: 'offline' });
      }
      return new Response('offline', { status: 504, statusText: 'offline' });
    }
  })());
});
