const CACHE_NAME = "pct-tool-v2.1.1-mobile-1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("pct-tool-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scopePathname = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePathname)) return;

  const networkFetch = caches.open(CACHE_NAME).then((cache) =>
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === "basic" &&
          !response.redirected
        ) {
          return cache.put(request, response.clone()).then(() => response);
        }
        return response;
      })
      .catch(() => null)
  );

  event.waitUntil(networkFetch);

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async (cached) => {
      if (cached) return cached;
      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;
      if (request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })
  );
});
