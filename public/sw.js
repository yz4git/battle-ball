const CACHE_PREFIX = "battle-ball-";
const CACHE_VERSION = "v7-startup-safe";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Intentionally no fetch handler. Reliability on iPhone Safari is more important
// than offline runtime caching for this build; HTML/JS/CSS always come from the network.
void CACHE_VERSION;
