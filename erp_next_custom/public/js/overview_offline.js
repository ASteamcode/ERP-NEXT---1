// overview_offline.js
// • Registers the PWA service worker
// • Caches Overview workspace shortcuts in localStorage
// • Shows cached links + offline banner when disconnected
// • Double-click any shortcut label to rename it inline
// • Queues renames → syncs to the Workspace doc on reconnect
"use strict";

(function () {
    const WORKSPACE   = "Overview";
    const CACHE_KEY   = "achi_ovr_v1";
    const OUTBOX_KEY  = "achi_ovr_outbox_v1";

    // ── Register service worker ────────────────────────────────────────────────
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    // ── Inject PWA manifest link (needed for browser install prompt) ───────────
    if (!document.querySelector('link[rel="manifest"]')) {
        const $m = document.createElement("link");
        $m.rel  = "manifest";
        $m.href = "/assets/erp_next_custom/manifest.json";
        document.head.appendChild($m);
    }

    // ── PWA install prompt ─────────────────────────────────────────────────────
    let _installEvt = null;
    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        _installEvt = e;
        _maybeShowInstallBadge();
    });

    function _maybeShowInstallBadge() {
        if (!_installEvt || $("#achi-install-btn").length) return;
        const $b = $(`<button id="achi-install-btn" title="Install app">⬇ Install</button>`).appendTo("body");
        $b.on("click", () => {
            _installEvt.prompt();
            _installEvt.userChoice.then(() => { _installEvt = null; $b.remove(); });
        });
    }

    // ── Online / offline indicator ─────────────────────────────────────────────
    function _setOnlineBar(online) {
        let $bar = $("#achi-net-bar");
        if (!$bar.length) {
            $bar = $(`<div id="achi-net-bar"></div>`).appendTo("body");
        }
        $bar.text(online ? "✓ Back online — syncing changes…" : "⚠ Offline — showing cached overview")
            .attr("class", online ? "achi-bar--online" : "achi-bar--offline")
            .addClass("achi-bar--show");
        clearTimeout($bar.data("_t"));
        if (online) $bar.data("_t", setTimeout(() => $bar.removeClass("achi-bar--show"), 3500));
    }

    window.addEventListener("online",  () => { _setOnlineBar(true);  _flushOutbox(); });
    window.addEventListener("offline", () => { _setOnlineBar(false); });

    // ── Outbox helpers ─────────────────────────────────────────────────────────
    function _getOutbox() {
        try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { return []; }
    }
    function _setOutbox(list) { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }

    function _queueRename(originalLabel, newLabel, linkTo) {
        const outbox = _getOutbox().filter(e => e.originalLabel !== originalLabel);
        outbox.push({ originalLabel, newLabel, linkTo, ts: Date.now() });
        _setOutbox(outbox);
        _updateOutboxBadge();
    }

    function _updateOutboxBadge() {
        const n = _getOutbox().length;
        let $badge = $("#achi-sync-badge");
        if (!n) { $badge.remove(); return; }
        if (!$badge.length) $badge = $(`<div id="achi-sync-badge"></div>`).appendTo("body");
        $badge.text(`${n} unsaved change${n > 1 ? "s" : ""}`);
    }

    function _flushOutbox() {
        const outbox = _getOutbox();
        if (!outbox.length) { _updateOutboxBadge(); return; }

        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Workspace", name: WORKSPACE },
            callback({ message: doc }) {
                if (!doc) return;
                let changed = false;

                outbox.forEach(({ originalLabel, newLabel, linkTo }) => {
                    const sc = (doc.shortcuts || []).find(
                        s => s.label === originalLabel || s.link_to === linkTo
                    );
                    if (sc) { sc.label = newLabel; changed = true; }
                });

                if (!changed) { _setOutbox([]); _updateOutboxBadge(); return; }

                frappe.call({
                    method: "frappe.client.save",
                    args: { doc },
                    callback() {
                        _setOutbox([]);
                        _updateOutboxBadge();
                        frappe.show_alert({ message: __("Overview links synced"), indicator: "green" }, 3);
                    },
                });
            },
        });
    }

    // ── Cache helpers ──────────────────────────────────────────────────────────
    function _saveCache(links) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), links }));
    }
    function _loadCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
    }

    // ── Read shortcuts from current DOM ───────────────────────────────────────
    function _readLinks() {
        const links = [];
        $(".link-widget-container, .shortcut-widget-box").each(function () {
            const $el    = $(this);
            const label  = $el.find(".link-label, .widget-label, .link-title").first().text().trim();
            const href   = $el.find("a").first().attr("href") || "";
            const linkTo = $el.attr("data-link-to") || href.replace(/^\/app\//, "");
            if (label) links.push({ label, href, linkTo });
        });
        return links;
    }

    // ── Inject inline-edit UI onto each shortcut tile ─────────────────────────
    function _patchTiles() {
        $(".link-widget-container, .shortcut-widget-box").each(function () {
            const $tile = $(this);
            if ($tile.data("_ov_patched")) return;
            $tile.data("_ov_patched", true);

            const $labelEl = $tile.find(".link-label, .widget-label, .link-title").first();
            const href     = $tile.find("a").first().attr("href") || "";
            const linkTo   = $tile.attr("data-link-to") || href.replace(/^\/app\//, "");

            // Pencil icon
            const $pencil = $(`<span class="ovr-edit-icon" title="${__("Rename")}">✎</span>`)
                .appendTo($tile);

            const _startEdit = () => {
                const current = $labelEl.text().trim();
                const $inp = $(`<input class="ovr-edit-inp" value="${frappe.utils.escape_html(current)}">`);
                $labelEl.hide().after($inp);
                $pencil.hide();
                $inp.focus().select();

                const _commit = () => {
                    const next = $inp.val().trim();
                    $inp.remove();
                    $labelEl.show();
                    $pencil.show();
                    if (!next || next === current) return;
                    $labelEl.text(next);
                    _queueRename(current, next, linkTo);
                    if (navigator.onLine) _flushOutbox();
                    frappe.show_alert({ message: __("Label updated"), indicator: "blue" }, 2);
                };

                $inp.on("keydown", e => {
                    if (e.key === "Enter")  _commit();
                    if (e.key === "Escape") { $inp.remove(); $labelEl.show(); $pencil.show(); }
                }).on("blur", _commit);
            };

            $pencil.on("click", e => { e.preventDefault(); e.stopPropagation(); _startEdit(); });
            $labelEl.on("dblclick", e => { e.preventDefault(); e.stopPropagation(); _startEdit(); });
        });
    }

    // ── Render cached overview when offline ───────────────────────────────────
    function _renderOfflineView(cache) {
        const $target = $(".layout-main-section, .workspace-container").first();
        if (!$target.length || !cache?.links?.length) return;

        const age = Math.round((Date.now() - cache.ts) / 60000);
        const $shell = $(`
            <div class="ovr-offline-shell">
                <div class="ovr-offline-banner">
                    ⚠ Offline — cached ${age < 2 ? "just now" : age + " min ago"}
                </div>
                <div class="ovr-offline-grid"></div>
            </div>
        `);

        const $grid = $shell.find(".ovr-offline-grid");
        cache.links.forEach(({ label, href }) => {
            $(`<a class="ovr-offline-tile" href="${frappe.utils.escape_html(href)}">
                <span class="ovr-tile-label">${frappe.utils.escape_html(label)}</span>
               </a>`).appendTo($grid);
        });

        $target.html($shell);
    }

    // ── Main hook: fires on every page-change ─────────────────────────────────
    function _onPageChange() {
        const route = frappe.get_route();
        if (!route) return;
        const isOverview = (route[0] || "").toLowerCase() === "workspaces" &&
                           (route[1] || "").toLowerCase() === "overview" ||
                           (frappe.get_route_str() || "").toLowerCase().includes("overview");
        if (!isOverview) return;

        if (!navigator.onLine) {
            const cache = _loadCache();
            if (cache) _renderOfflineView(cache);
            _setOnlineBar(false);
            return;
        }

        // Online: patch tiles after Frappe finishes rendering
        setTimeout(() => {
            const links = _readLinks();
            if (links.length) _saveCache(links);
            _patchTiles();
            _updateOutboxBadge();
            if (_getOutbox().length) _flushOutbox();
        }, 800);
    }

    $(document).on("page-change", _onPageChange);
    // Also fire once on initial load
    $(document).one("page-change", () => setTimeout(_onPageChange, 200));

    // ── Styles ─────────────────────────────────────────────────────────────────
    const s = document.createElement("style");
    s.textContent = `
/* Net status bar */
#achi-net-bar {
    position: fixed; bottom: 72px; left: 50%; transform: translateX(-50%);
    padding: 6px 18px; border-radius: 20px; font-size: 12px; font-weight: 500;
    z-index: 2000; opacity: 0; transition: opacity .3s; pointer-events: none;
    white-space: nowrap;
}
#achi-net-bar.achi-bar--show   { opacity: 1; }
#achi-net-bar.achi-bar--online  { background: #27ae60; color: #fff; }
#achi-net-bar.achi-bar--offline { background: #e67e22; color: #fff; }

/* Unsaved changes badge */
#achi-sync-badge {
    position: fixed; bottom: 72px; right: 80px;
    background: #e67e22; color: #fff;
    font-size: 11px; font-weight: 600;
    padding: 4px 10px; border-radius: 12px;
    z-index: 1200; pointer-events: none;
}

/* Install button */
#achi-install-btn {
    position: fixed; bottom: 24px; right: 76px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #dee2e6);
    border-radius: 20px; padding: 6px 14px;
    font-size: 12px; cursor: pointer; z-index: 1040;
    box-shadow: 0 2px 8px rgba(0,0,0,.1);
    transition: box-shadow .15s;
}
#achi-install-btn:hover { box-shadow: 0 4px 14px rgba(0,0,0,.18); }

/* Shortcut tile edit affordance */
.link-widget-container, .shortcut-widget-box { position: relative; }
.ovr-edit-icon {
    display: none; position: absolute; top: 4px; right: 4px;
    font-size: 13px; color: var(--text-muted, #8d96a0);
    cursor: pointer; padding: 2px 4px; border-radius: 4px;
    transition: background .1s, color .1s; line-height: 1;
    background: var(--card-bg, #fff);
}
.link-widget-container:hover .ovr-edit-icon,
.shortcut-widget-box:hover   .ovr-edit-icon { display: block; }
.ovr-edit-icon:hover { background: #eef4ff; color: #378ADD; }

.ovr-edit-inp {
    width: 100%; font-size: inherit; font-weight: inherit;
    border: 1px solid #378ADD; border-radius: 4px;
    padding: 1px 4px; background: var(--card-bg, #fff);
    color: var(--text-color, #1f272e); outline: none;
}

/* Offline cached view */
.ovr-offline-banner {
    background: #fff3cd; border: 1px solid #ffc107;
    border-radius: 8px; padding: 8px 16px;
    margin-bottom: 16px; font-size: 13px; color: #856404;
}
.ovr-offline-grid {
    display: flex; flex-wrap: wrap; gap: 12px;
}
.ovr-offline-tile {
    display: flex; align-items: center; justify-content: center;
    min-width: 120px; height: 60px; padding: 8px 16px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px; text-decoration: none;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
    transition: box-shadow .12s;
}
.ovr-offline-tile:hover { box-shadow: 0 3px 10px rgba(0,0,0,.14); }
.ovr-tile-label { font-size: 13px; font-weight: 500; color: var(--text-color, #1f272e); }
    `;
    document.head.appendChild(s);
})();
