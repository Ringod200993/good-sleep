const BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `good-sleep-${BASE.pathname}-`;
const CACHE = CACHE_PREFIX + 'v5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'pwa.js', 'youtube.js', 'audio-library.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'].map(path => new URL(path, BASE).href);
const INDEX = new URL('index.html', BASE).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Never store an authentication redirect as the offline application.
    for (const path of SHELL) {
      const response = await fetch(new Request(path, {cache: 'reload'}));
      if (!response.ok || response.redirected) throw new Error('App shell unavailable');
      await cache.put(path, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Cache only our explicit app assets; do not intercept login or API routes.
  url.search = '';
  if (!SHELL.includes(url.href)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok && !response.redirected && response.headers.get('Content-Type')?.includes('text/html')) {
          const cache = await caches.open(CACHE);
          await cache.put(INDEX, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(INDEX)) || Response.error();
      }
    })());
  } else {
    event.respondWith((async () => (await caches.match(event.request, {ignoreSearch: true})) || fetch(event.request))());
  }
});
