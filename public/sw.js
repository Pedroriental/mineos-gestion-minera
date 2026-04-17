// MineOS Service Worker — v3
// Strategy:
//   • Supabase API calls → always network (never cache auth/data)
//   • Next.js static assets (_next/) → cache-first
//   • App pages → network-first with offline fallback

const STATIC_CACHE  = 'mineos-static-v3';
const DYNAMIC_CACHE = 'mineos-pages-v3';
const ALL_CACHES    = [STATIC_CACHE, DYNAMIC_CACHE];

// URLs to pre-cache at install
const PRECACHE = ['/', '/dashboard'];

// Hostnames to NEVER cache (Supabase + any external APIs)
const BYPASS_HOSTS = ['supabase.co', 'supabase.io', 'googleapis.com', 'gstatic.com'];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE))
      .catch(() => {}) // fail silently if offline at install
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Never cache Supabase / external API calls
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;

  // 2. Only handle same-origin
  if (url.origin !== location.origin) return;

  // 3. Next.js build assets → Cache-first (they're content-hashed, safe)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // 4. App pages → Network-first, fall back to cache, then offline page
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('/') // last resort: dashboard shell
        )
      )
  );
});
