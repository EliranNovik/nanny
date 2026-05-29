// ─── Cache names — bump STATIC_CACHE when fetch logic changes ────────────────
const STATIC_CACHE   = 'tebnu-static-v4';
const MEDIA_CACHE    = 'tebnu-media-v3';    // Supabase storage images & videos

// ─── Supabase project URL prefix (cross-origin images / videos) ───────────────
function isSupabaseMedia(url) {
  return (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/')
  );
}

/** Vite emits content-hashed filenames — safe to cache forever. */
function isHashedBuildAsset(url) {
  return (
    url.pathname.startsWith('/assets/') &&
    /-[a-zA-Z0-9_-]{6,}\.(js|css|mjs|map)$/.test(url.pathname)
  );
}

function isLocalStaticAsset(url) {
  const p = url.pathname;
  return (
    p.startsWith('/assets/') ||
    p.endsWith('.png') ||
    p.endsWith('.jpg') ||
    p.endsWith('.jpeg') ||
    p.endsWith('.webp') ||
    p.endsWith('.svg') ||
    p.endsWith('.ico') ||
    p.endsWith('.woff2') ||
    p.endsWith('.woff') ||
    p === '/manifest.json'
  );
}

// ─── Install — do not precache index.html or JS (stale deploy risk on mobile) ─
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(['/manifest.json']).catch(() => {}))
  );
  self.skipWaiting();
});

// ─── Activate — purge old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const KEEP = new Set([STATIC_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)))
    )
  );
  return self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isSupabaseMedia(url)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, 7 * 24 * 3600));
    return;
  }

  if (url.origin !== location.origin) return;

  // Hashed Vite bundles — immutable, cache-first.
  if (isHashedBuildAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // JS/CSS without content hashes — always network-first so deploys apply immediately.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.mjs')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // SPA shell + HTML — network-first; fall back to cache only when offline.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Images, fonts, manifest — cache-first for speed.
  if (isLocalStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

async function staleWhileRevalidate(request, cacheName, maxAgeSeconds) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  if (cached) {
    const date = cached.headers.get('date');
    if (date) {
      const ageSec = (Date.now() - new Date(date).getTime()) / 1000;
      if (ageSec < maxAgeSeconds) {
        return cached;
      }
    } else {
      return cached;
    }
  }

  return fetchPromise.then((r) => r || cached);
}

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network unavailable and no cache for ' + request.url);
  }
}
