const CACHE = 'banger-studio-v11';
const CACHE_PREFIX = 'banger-studio-';
const SHELL = ['/manifest.webmanifest', '/icon.svg', '/assets/cmvng-logo.png'];

async function cacheSmallShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async url => {
    try {
      const response = await fetch(url, {cache:'no-store'});
      if (response.ok) await cache.put(url, response);
    } catch (_) {}
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(cacheSmallShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirstStudio() {
  try {
    const response = await fetch('/legacy', {cache:'no-store'});
    if (!response.ok) throw new Error(`Studio returned ${response.status}`);
    const cache = await caches.open(CACHE);
    await cache.put('/legacy', response.clone());
    return response;
  } catch (_) {
    const cached = await caches.match('/legacy');
    return cached || new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><title>CMVNG Studio offline</title><style>body{font:16px system-ui;padding:32px;max-width:560px;margin:auto;color:#0c1b33}button{padding:12px 16px}</style><h1>Studio is offline</h1><p>Reconnect, then reload to continue with the latest Builder.</p><button onclick="location.reload()">try again</button>',
      {status:503,headers:{'content-type':'text/html; charset=utf-8'}}
    );
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === '/health') return;

  if (url.pathname === '/app' || url.pathname === '/legacy') {
    event.respondWith(networkFirstStudio());
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
  }
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
