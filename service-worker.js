[30/12/2025 12:28:32] Ronaldo Araujo: {
  "name": "Rooms Control",
  "short_name": "Rooms",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e1b4b",
  "icons": [
    {
      "src": "assets/icon-192x192-dico3jks.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icon-512x512-btj5-vql.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
[30/12/2025 12:30:46] Ronaldo Araujo: const CACHE_NAME = "rooms-control-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/index-b6ivohre.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
