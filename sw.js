const CACHE = 'banger-studio-v8';
const SHELL = ['/legacy', '/manifest.webmanifest', '/icon.svg', '/assets/cmvng-logo.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === '/health') return;

  if (url.pathname === '/app' || url.pathname === '/legacy') {
    event.respondWith(
      fetch('/legacy', { cache: 'no-store' })
        .then(response => {
          if (!response.ok) return response;
          return caches.open(CACHE).then(cache =>
            cache.put('/legacy', response.clone()).then(() => response)
          );
        })
        .catch(() => caches.match('/legacy'))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});


