// MineOS Service Worker — v14
// Network-first para /_next/static/; solo cachea respuestas OK (evita 500/404 cacheados tras deploy).

const STATIC_CACHE = 'mineos-static-v14';

function isLocalDevHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

const PRECACHE = ['/'];

const BYPASS_HOSTS = ['supabase.co', 'supabase.io', 'googleapis.com', 'gstatic.com'];

function isAppDocumentRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (url.search.includes('_rsc')) return true;
  if (request.headers.get('Accept')?.includes('text/html')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isLocalDevHost(url.hostname)) return;

  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;
  if (url.origin !== location.origin) return;

  if (isAppDocumentRequest(event.request, url)) {
    // Pasar directamente las navegaciones y RSC a la red de forma limpia
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('Document fetch failed:', err);
        return caches.match(event.request).then((cached) => cached || Response.error());
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.open(STATIC_CACHE).then((cache) =>
            cache.match(event.request).then((cached) => cached || Response.error()),
          ),
        ),
    );
  }
});
