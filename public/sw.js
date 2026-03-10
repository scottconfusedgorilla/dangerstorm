// DangerStorm Service Worker — minimal, enables PWA install
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
