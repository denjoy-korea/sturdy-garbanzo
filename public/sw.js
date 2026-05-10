const CACHE_NAME = "ppoko-omok-v1";
const STATIC_CACHE_RE = /\.(?:js|css|woff2?|svg|png|jpg|jpeg|ico)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Bypass: Supabase realtime/REST and websockets
  if (
    url.hostname.endsWith("supabase.co") ||
    url.hostname.endsWith("supabase.in") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  ) {
    return;
  }

  // Cache-first for static assets
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      STATIC_CACHE_RE.test(url.pathname))
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              if (res && res.status === 200 && res.type === "basic") {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
              }
              return res;
            })
            .catch(() => cached),
      ),
    );
    return;
  }

  // Network-first for HTML navigations, fall back to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
  }
});
