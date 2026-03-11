// DangerStorm Service Worker — app shell cache + network-first
const CACHE = "ds-v1";
const APP_SHELL = [
    "/",
    "/dashboard",
    "/account",
    "/style.css",
    "/auth.js",
    "/api.js",
    "/app.js",
    "/dashboard.js",
    "/account.js",
    "/icon.svg",
    "/icon-192.png",
    "/manifest.json",
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);

    // Skip non-GET and API/auth requests
    if (e.request.method !== "GET") return;
    if (url.pathname.startsWith("/api/")) return;
    if (url.hostname !== location.hostname) return;

    // Network-first for HTML pages, cache-first for assets
    if (e.request.headers.get("accept")?.includes("text/html")) {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then((cached) =>
                cached || fetch(e.request).then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, clone));
                    return res;
                })
            )
        );
    }
});
