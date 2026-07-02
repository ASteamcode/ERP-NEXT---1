// offline_cache.js — client-side read cache for Frappe calls
// Keeps safe read calls usable when the connection is slow/offline.
(function () {
    "use strict";

    const CACHE_PREFIX = "achi_call_cache:";
    const INDEX_KEY = "achi_call_cache:index";
    const MAX_ENTRIES = 300;
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    const SAFE_METHODS = new Set([
        "frappe.client.get",
        "frappe.client.get_list",
        "frappe.client.get_value",
        "frappe.desk.reportview.get",
        "erp_next_custom.erp_next_custom.page.project_board.project_board.get_prospects",
        "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.get_client_companies",
        "erp_next_custom.erp_next_custom.page.project_board.project_board.resolve_maps_url",
    ]);

    function stableStringify(value) {
        if (value === null || typeof value !== "object") return JSON.stringify(value);
        if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
        return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
    }

    function cacheKey(opts) {
        return CACHE_PREFIX + opts.method + ":" + stableStringify(opts.args || {});
    }

    function getIndex() {
        try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]"); } catch { return []; }
    }

    function setIndex(index) {
        try { localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(-MAX_ENTRIES))); } catch { /* localStorage full/unavailable */ }
    }

    function rememberKey(key) {
        const index = getIndex().filter(k => k !== key);
        index.push(key);
        while (index.length > MAX_ENTRIES) {
            const old = index.shift();
            try { localStorage.removeItem(old); } catch { /* noop */ }
        }
        setIndex(index);
    }

    function readCache(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (!payload || Date.now() - payload.ts > MAX_AGE_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return payload.response;
        } catch {
            return null;
        }
    }

    function writeCache(key, response) {
        if (!response || response.exc) return;
        try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), response }));
            rememberKey(key);
        } catch {
            pruneHalf();
            try {
                localStorage.setItem(key, JSON.stringify({ ts: Date.now(), response }));
                rememberKey(key);
            } catch { /* still full; skip cache */ }
        }
    }

    function pruneHalf() {
        const index = getIndex();
        const removeCount = Math.ceil(index.length / 2);
        index.slice(0, removeCount).forEach(key => {
            try { localStorage.removeItem(key); } catch { /* noop */ }
        });
        setIndex(index.slice(removeCount));
    }

    function canCache(opts) {
        if (!opts || typeof opts !== "object") return false;
        if (!opts.method || opts.no_offline_cache) return false;
        return SAFE_METHODS.has(opts.method);
    }

    function replyFromCache(opts, cached) {
        const response = Object.assign({}, cached, { _offline_cache: true });
        setTimeout(() => {
            if (typeof opts.callback === "function") opts.callback(response);
            if (typeof opts.always === "function") opts.always(response);
        }, 0);
        return Promise.resolve(response);
    }

    function patchFrappeCall() {
        if (!window.frappe || typeof frappe.call !== "function" || frappe.call._achiOfflinePatched) return false;

        const original = frappe.call.bind(frappe);

        frappe.call = function patchedFrappeCall(...callArgs) {
            const opts = callArgs[0];
            if (!canCache(opts)) return original(...callArgs);

            const key = cacheKey(opts);
            const cached = readCache(key);

            if (navigator.onLine === false && cached) {
                return replyFromCache(opts, cached);
            }

            const userCallback = opts.callback;
            const userError = opts.error;

            const wrapped = Object.assign({}, opts, {
                callback(response) {
                    writeCache(key, response);
                    if (typeof userCallback === "function") userCallback(response);
                },
                error(err) {
                    const fallback = readCache(key);
                    if (fallback) {
                        replyFromCache(opts, fallback);
                        return;
                    }
                    if (typeof userError === "function") userError(err);
                },
            });

            return original(wrapped);
        };

        frappe.call._achiOfflinePatched = true;
        return true;
    }

    if (!patchFrappeCall()) {
        const timer = setInterval(() => {
            if (patchFrappeCall()) clearInterval(timer);
        }, 100);
        setTimeout(() => clearInterval(timer), 10000);
    }
})();
