// Service Worker — Achi ERP
// Served at /sw.js via Frappe www/ routing
// no-cache: 1
const CACHE = "achi-erp-v1";

const PRECACHE = [
    "/assets/erp_next_custom/js/grid_core.js",
    "/assets/erp_next_custom/js/frappe_drawing.js",
    "/assets/erp_next_custom/js/ui_annotations.js",
    "/assets/erp_next_custom/js/overview_offline.js",
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECACHE).catch(() => {})) // don't fail install on asset errors
            .then(() => self.skipWaiting())
    );
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

    // Our static assets → cache-first
    if (url.pathname.startsWith("/assets/erp_next_custom/")) {
        e.respondWith(
            caches.match(request).then(hit => hit || fetch(request).then(res => {
                if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
                return res;
            }))
        );
        return;
    }

    // App shell (/app/*) → network-first, fall back to cache
    if (url.pathname.startsWith("/app")) {
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
