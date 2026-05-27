// Maxx Engage Service Worker
// Strategy: cache-first for static assets, network-first + offline fallback for navigation.

const CACHE_VERSION   = "v1";
const STATIC_CACHE    = `maxx-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE   = `maxx-dynamic-${CACHE_VERSION}`;
const OFFLINE_URL     = "/offline";

// ── Install: pre-cache the offline page ──────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: claim clients + prune old caches ────────────────────────────────

self.addEventListener("activate", (event) => {
  const KNOWN = new Set([STATIC_CACHE, DYNAMIC_CACHE]);
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !KNOWN.has(k)).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip: non-GET, extension requests, and cross-origin requests (API, Supabase, CDNs)
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Next.js build artefacts (_next/static/) — cache-first, very long-lived
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Static files in /public (images, fonts, icons, manifest)
  if (url.pathname.match(/\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|mp4|webm)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation (HTML pages) — network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Everything else on this origin — network-first, cache fallback
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Asset unavailable offline.", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response("Offline.", { status: 503 });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try the specific page from cache first, then fall back to offline page
    const cached = await caches.match(request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ??
      new Response(
        "<h1>You are offline</h1><p>Please check your connection.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    );
  }
}
