// Service Worker — Achi ERP offline-first layer
// Served at /sw.js via Frappe www routing
// no-cache: 1

const VERSION = "achi-erp-offline-v6";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const API = `${VERSION}-api`;
const IMAGE = `${VERSION}-image`;
const ALL_CACHES = [APP_SHELL, RUNTIME, API, IMAGE];

const PRECACHE_URLS = [
    "/desk",
    "/app",
    "/assets/erp_next_custom/manifest.json",
    "/assets/erp_next_custom/images/logo.jpg",
    "/assets/erp_next_custom/js/custom_sidebar_hover.js",
    "/assets/erp_next_custom/js/offline_cache_v2.js",
    "/assets/erp_next_custom/js/grid_core.js",
    "/assets/erp_next_custom/js/prospect_grid.js",
    "/assets/erp_next_custom/js/prospect_mobile.js",
    "/assets/erp_next_custom/js/frappe_drawing.js",
    "/assets/erp_next_custom/js/ui_annotations.js",
    "/assets/erp_next_custom/js/overview_offline.js",
    "/assets/erp_next_custom/js/quick_launch.js",
    "/assets/erp_next_custom/js/contacts_list.js",
    "/assets/erp_next_custom/js/crm_log_list.js",
    "/assets/erp_next_custom/js/leads_list.js",
    "/assets/erp_next_custom/js/prospect_list.js",
    "/assets/erp_next_custom/js/site_survey_list.js",
    "/assets/erp_next_custom/js/mto_list.js",
    "/assets/erp_next_custom/js/quotation_list.js",
    "/assets/erp_next_custom/js/item_list.js",
    "/assets/erp_next_custom/js/item_form.js",
    "/assets/erp_next_custom/js/stock_entry.js",
    "/assets/erp_next_custom/js/stock_entry_form.js",
    "/assets/erp_next_custom/js/desk_home.js",
];

const STATIC_PREFIXES = [
    "/assets/",
    "/files/",
    "/private/files/",
];

const NAV_PREFIXES = [
    "/app",
    "/desk",
    "/frontend",
];

const NEVER_CACHE_PREFIXES = [
    "/socket.io",
    "/api/method/frappe.realtime",
    "/api/method/frappe.utils.change_log",
];

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL);
        await Promise.allSettled(PRECACHE_URLS.map(url => cache.add(new Request(url, { credentials: "same-origin" }))));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith("achi-erp") && !ALL_CACHES.includes(key))
            .map(key => caches.delete(key))
        );
        await self.clients.claim();
    })());
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (shouldNeverCache(url)) return;

    if (request.mode === "navigate" || NAV_PREFIXES.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
        event.respondWith(networkFirst(request, APP_SHELL, navigationFallback));
        return;
    }

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/method/")) {
        event.respondWith(networkFirst(request, API, apiFallback));
        return;
    }

    if (isStaticAsset(url)) {
        const cacheName = isImage(url) ? IMAGE : RUNTIME;
        event.respondWith(staleWhileRevalidate(request, cacheName));
        return;
    }

    event.respondWith(networkFirst(request, RUNTIME));
});

function shouldNeverCache(url) {
    return NEVER_CACHE_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
}

function isStaticAsset(url) {
    if (STATIC_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return true;
    return /\.(?:js|css|mjs|json|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(url.pathname);
}

function isImage(url) {
    return /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname) || url.pathname.startsWith("/files/") || url.pathname.startsWith("/private/files/");
}

async function networkFirst(request, cacheName, fallback) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        await safePut(cache, request, response);
        return response;
    } catch (err) {
        const cached = await cache.match(request) || await caches.match(request);
        if (cached) return cached;
        return fallback ? fallback(request) : offlineResponse(request);
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
        .then(async response => {
            await safePut(cache, request, response);
            return response;
        })
        .catch(() => null);

    return cached || await fetchPromise || offlineResponse(request);
}

async function safePut(cache, request, response) {
    if (!response || !response.ok) return;
    if (response.type === "opaque") return;
    const cc = response.headers.get("cache-control") || "";
    if (/no-store/i.test(cc)) return;
    try { await cache.put(request, response.clone()); } catch { /* Cache API can reject some dynamic Frappe responses. */ }
}

async function navigationFallback() {
    return await caches.match("/desk")
        || await caches.match("/app")
        || new Response("Offline. Open the app once while online to cache the desk shell.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
}

function apiFallback(request) {
    return new Response(JSON.stringify({
        exc: "offline",
        message: "Offline and no cached response is available for this request.",
        request: request.url,
    }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

function offlineResponse(request) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
        return navigationFallback();
    }
    return new Response("", { status: 503, statusText: "Offline" });
}
