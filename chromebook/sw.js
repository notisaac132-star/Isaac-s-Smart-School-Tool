// Service worker for the Chromebook (web) version.
// Network first: whenever the Chromebook is online it gets the newest version of the app straight away
// (that's the auto-update). The latest copy is kept in a cache so the app still opens offline.
const VERSION = "__VERSION__";
const CACHE = `smart-school-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "ui.js",
  "home.js",
  "donate.js",
  "snow.js",
  "config.js",
  "pwa.js",
  "pwa.css",
  "vendor/supabase.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting(); // a new version takes over as soon as it's downloaded
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("smart-school-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only handle the app's own files; accounts and data (Supabase) always go straight to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match("index.html")))
  );
});
