// Service Worker — Achi ERP
// Served at /sw.js via Frappe www/ routing
// no-cache: 1
const CACHE = "achi-erp-v2";

self.addEventListener("install", e => {
    e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
    const { request } = e;
    const url = new URL(request.url);

    // Only handle GET from same origin
    if (request.method !== "GET" || url.origin !== self.location.origin) return;

    // Skip auth, API, and socket calls entirely
    if (["/api/", "/socket.io", "/assets/frappe/"].some(p => url.pathname.startsWith(p))) return;

    // All our assets and app shell → network-first, fall back to cache
    if (
        url.pathname.startsWith("/assets/erp_next_custom/") ||
        url.pathname.startsWith("/app")
    ) {
        e.respondWith(
            fetch(request)
                .then(res => {
                    if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(request))
        );
    }
});
