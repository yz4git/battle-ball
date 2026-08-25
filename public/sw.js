const CACHE_PREFIX = "battle-ball-";
const CACHE_VERSION = "v5-rally-counter";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const acceptsHtml = event.request.headers.get("accept")?.includes("text/html") ?? false;
  if (event.request.mode === "navigate" || acceptsHtml) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put("/", response.clone()));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })),
  );
});
