const CACHE_NAME = "pct-tool-v2.2.0-mobile-2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.status === 200 &&
      response.type === "basic" &&
      !response.redirected
  );
}

function buildNoCacheRequest(request) {
  // Browsers throw TypeError for new Request(req, init) when req.mode === "navigate".
  if (request.mode === "navigate") {
    return new Request(request.url, {
      cache: "no-cache",
      credentials: "same-origin"
    });
  }
  return new Request(request, { cache: "no-cache" });
}

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function handleNavigationFetch(request, url, scopePathname) {
  try {
    const response = await fetch(buildNoCacheRequest(request));
    if (isCacheableResponse(response)) {
      const cloneForRequest = response.clone();
      const cloneForIndex = response.clone();
      const scopeUrl = new URL("./", self.location.href).href;
      const isAppShell =
        url.pathname === scopePathname ||
        url.pathname === scopePathname + "index.html";
      const cloneForRoot =
        isAppShell && request.url !== scopeUrl ? response.clone() : null;
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, cloneForRequest);
        await cache.put("./index.html", cloneForIndex);
        if (cloneForRoot) {
          await cache.put("./", cloneForRoot);
        }
      } catch {
        // Keep serving the fresh network response even if caching fails.
      }
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("./index.html"));
    if (cached) return cached;
    return offlineResponse();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map(async (url) => {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (!isCacheableResponse(response)) {
              throw new Error(`Precache failed for ${url}`);
            }
            return cache.put(url, response);
          })
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter(
        (key) => key.startsWith("pct-tool-") && key !== CACHE_NAME
      );
      const hadOldCache = oldKeys.length > 0;
      await Promise.all(oldKeys.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (hadOldCache) {
        const windowClients = await self.clients.matchAll({ type: "window" });
        for (const client of windowClients) {
          client.navigate(client.url).catch(() => {});
        }
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scopePathname = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePathname)) return;

  const isHtmlNavigation =
    request.mode === "navigate" ||
    url.pathname === scopePathname ||
    url.pathname === scopePathname + "index.html";

  if (isHtmlNavigation) {
    event.respondWith(handleNavigationFetch(request, url, scopePathname));
    return;
  }

  const networkFetch = caches.open(CACHE_NAME).then((cache) =>
    fetch(new Request(request, { cache: "no-cache" }))
      .then((response) => {
        if (isCacheableResponse(response)) {
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
      return offlineResponse();
    })
  );
});
