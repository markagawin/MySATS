const CACHE_NAME = 'mysats-cache-v1';
// self.registration.scope resolves to wherever this worker is actually hosted
// (e.g. https://markagawin.github.io/MySATS/), unlike a hardcoded '/' which only
// matches a site served from the domain root.
const APP_SHELL_URL = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(APP_SHELL_URL, { cache: 'reload' })))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // GitHub Pages sends Cache-Control: max-age=600, so a plain fetch of the page could return
  // an HTML copy up to 10 minutes old that still points at the previous build's bundle. Page
  // loads always revalidate with the server instead. Bundles have a content hash in their
  // filename, so they can't go stale and use the normal cache.
  const request =
    event.request.mode === 'navigate'
      ? new Request(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : event.request;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || caches.match(APP_SHELL_URL))
      )
  );
});
