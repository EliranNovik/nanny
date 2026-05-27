// ─── Cache names ──────────────────────────────────────────────────────────────
const STATIC_CACHE   = 'tebnu-static-v3';
const MEDIA_CACHE    = 'tebnu-media-v3';    // Supabase storage images & videos

// ─── Supabase project URL prefix (cross-origin images / videos) ───────────────
// Matches any URL whose hostname ends in .supabase.co and path is under /storage/
function isSupabaseMedia(url) {
  return (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/')
  );
}

// ─── Local static assets bundled by Vite ──────────────────────────────────────
function isLocalStaticAsset(url) {
  const p = url.pathname;
  return (
    p.startsWith('/assets/') ||
    p.endsWith('.js') ||
    p.endsWith('.css') ||
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

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(['/', '/index.html', '/manifest.json'])
        .catch(() => {}))
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

// ─── Message — allow main thread to force immediate activation ────────────────
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

  // 1. Supabase storage — stale-while-revalidate (max 7 days)
  //    This prevents the "black flash" when the browser discards decoded images.
  if (isSupabaseMedia(url)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, 7 * 24 * 3600));
    return;
  }

  // 2. Local Vite build assets — cache-first (content-addressed hashes never change)
  if (url.origin === location.origin && isLocalStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. SPA navigations — always network so the React router shell stays fresh
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // 4. Everything else (Supabase API, auth, Realtime) — network only
});

// ─── Strategy: stale-while-revalidate ─────────────────────────────────────────
// Returns the cached copy immediately (no black flash), then refreshes in the
// background so the next visit gets the latest version.
async function staleWhileRevalidate(request, cacheName, maxAgeSeconds) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off a background fetch regardless
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      // Honour a short max-age so avatars / edited posts refresh periodically
      const headers = new Headers(response.headers);
      const entry   = response.clone();
      // Store a timestamp so we can evict very old entries if we want
      cache.put(request, entry);
    }
    return response;
  }).catch(() => null);

  // If we have a cached copy serve it immediately; the fetch updates the cache
  if (cached) {
    // Check age — re-use if younger than maxAgeSeconds
    const date = cached.headers.get('date');
    if (date) {
      const ageSec = (Date.now() - new Date(date).getTime()) / 1000;
      if (ageSec < maxAgeSeconds) {
        return cached;
      }
    } else {
      // No date header — trust the cached copy anyway
      return cached;
    }
  }

  // No cache (first load) — wait for network
  return fetchPromise.then((r) => r || cached);
}

// ─── Strategy: cache-first ───────────────────────────────────────────────────
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
