// Macht die App offline nutzbar: Erst das Netz fragen (damit Updates sofort ankommen),
// bei fehlender Verbindung die zuletzt geladene Fassung zeigen.
const LAGER = "zone-v3";
const DATEIEN = [
  "./", "index.html", "styles.css", "app.js", "speicher.js", "config.js", "manifest.webmanifest",
  "data/filme.json", "data/denker.json", "data/impulse.json", "data/vertiefung.json",
  "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(LAGER).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith("zone-") && n !== LAGER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nur eigene Dateien; der Letterboxd-Abgleich läuft immer direkt übers Netz.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(LAGER).then((c) => c.put(e.request, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((t) => t || Response.error()))
  );
});
