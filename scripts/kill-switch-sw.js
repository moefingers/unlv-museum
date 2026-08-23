// Kill-switch service worker (recovery tool — NOT served by anything).
//
// If this project's dev server leaves a stale `museum-toast-sw.js` registered
// on a shared origin (e.g. another repo's app on http://localhost:3000), copy
// this file into THAT app's public/ under the same script URL as the stale
// registration. The browser's next SW update check swaps the stale worker for
// this one, which clears caches, unregisters itself, and reloads its windows.
// Remove the copy once affected browsers have loaded that site once.
//
// Never place this in unlv-museum's own public/museum-toast-sw.js — that path
// is the REAL toast service worker this app registers.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
