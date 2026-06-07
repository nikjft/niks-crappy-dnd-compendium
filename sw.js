const CACHE_NAME = 'dnd-compendium-cache-v31';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './db.js',
  './parser.js',
  './storage.js',
  './sync.js',
  './conflict.js',
  './ui-sync.js',
  './manifest.json',
  './icon.png',
  './source-data/System_Reference_Document_5.5e.xml'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Don't intercept Dropbox API calls — must be fresh
  if (e.request.url.includes('dropbox.com') || e.request.url.includes('dropboxapi.com')) {
    return;
  }

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Ignore network errors when offline
        });
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Background Sync — Chromium desktop/Android only
// Fires when network is restored after a sync was registered while offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'dropbox-sync') {
    // Notify the active client to run a sync cycle
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' });
        });
      })
    );
  }
});
