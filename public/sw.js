// MineOS Service Worker — v5
// Solo assets estáticos en caché; páginas y RSC siempre por red (evita dashboard viejo al F5).

const STATIC_CACHE = 'mineos-static-v5';

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

  // En desarrollo local no interceptar (evita "Failed to fetch" con next dev / HMR)
  if (isLocalDevHost(url.hostname)) return;

  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;
  if (url.origin !== location.origin) return;

  // Páginas / RSC: siempre red (no servir HTML/RSC cacheado en recarga normal)
  if (isAppDocumentRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        Response.error(),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          });
        }),
      ),
    );
  }
});
