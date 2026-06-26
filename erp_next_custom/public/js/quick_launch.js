(function () {
    "use strict";

    // ── SVG icons ─────────────────────────────────────────────────────────────
    const ICON = {
        // 3-column kanban grid
        board: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3"  y="3" width="5" height="18" rx="1"/>
                  <rect x="10" y="3" width="5" height="11" rx="1"/>
                  <rect x="17" y="3" width="4" height="15" rx="1"/>
                </svg>`,
        // speech-bubble comment
        comment: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>`,
        // "+" that the trigger shows, becomes "×" when open
        plus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                 <line x1="12" y1="5" x2="12" y2="19"/>
                 <line x1="5" y1="12" x2="19" y2="12"/>
               </svg>`,
    };

    // ── Static shortcuts (always visible) ─────────────────────────────────────
    const SHORTCUTS = [
        {
            label: "Project Board",
            icon:  ICON.board,
            action(closeMenu) {
                closeMenu();
                frappe.set_route("project-board");
            },
        },
    ];

    // ── CSS ───────────────────────────────────────────────────────────────────
    const CSS = `
        #ql-fab {
            position: fixed;
            bottom: 28px;
            right: 28px;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            /* items stack upward: trigger last visually = first in DOM */
        }

        /* ── Trigger button ── */
        #ql-trigger {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #1a1a1a;
            color: #fff;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.32);
            display: flex;
            align-items: center;
            justify-content: center;
            transition:
                transform  0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                background 0.2s ease,
                box-shadow 0.2s ease;
            order: 99; /* always visually at the bottom */
        }
        #ql-trigger:hover {
            background: #333;
            box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        }
        #ql-trigger svg {
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: none;
        }
        #ql-trigger.open svg { transform: rotate(45deg); }

        /* ── Menu items ── */
        .ql-item {
            display: flex;
            align-items: center;
            gap: 9px;
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 22px;
            padding: 7px 16px 7px 11px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #1a1a1a;
            white-space: nowrap;
            box-shadow: 0 2px 10px rgba(0,0,0,0.10);
            text-decoration: none;
            user-select: none;
            /* start hidden, animate in */
            opacity: 0;
            transform: translateY(8px) scale(0.95);
            pointer-events: none;
            transition:
                opacity   0.22s ease,
                transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
                background 0.15s ease,
                box-shadow 0.15s ease;
        }
        .ql-item.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }
        .ql-item:hover {
            background: #f4f4f4;
            box-shadow: 0 4px 14px rgba(0,0,0,0.16);
        }
        .ql-item--active {
            background: #eef4ff;
            border-color: #c3d9f8;
            color: #1a6ed8;
        }
        .ql-item--active:hover { background: #deeafc; }

        .ql-icon {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            color: inherit;
        }
    `;

    // ── Build & inject ────────────────────────────────────────────────────────
    function inject() {
        if (document.getElementById("ql-fab")) return;

        const style = document.createElement("style");
        style.id = "ql-style";
        style.textContent = CSS;
        document.head.appendChild(style);

        const fab = document.createElement("div");
        fab.id = "ql-fab";

        const trigger = document.createElement("button");
        trigger.id    = "ql-trigger";
        trigger.title = "Quick Launch";
        trigger.innerHTML = ICON.plus;

        // ── Build item elements ──
        const items = [];

        // Static shortcuts
        SHORTCUTS.forEach(({ label, icon, action }) => {
            const el = _makeItem(label, icon, () => action(closeMenu));
            items.push({ el });
            fab.appendChild(el);
        });

        // Comment / Annotations item — only if user is System Manager
        if (frappe.user && frappe.user.has_role && frappe.user.has_role("System Manager")) {
            const el = _makeItem("Annotations", ICON.comment, () => {
                if (typeof window.__annToggle === "function") {
                    closeMenu();
                    window.__annToggle();
                }
            });
            // Mark active when annotation sidebar is open
            const _syncActive = () => {
                if (typeof window.__annIsOpen === "function") {
                    el.classList.toggle("ql-item--active", window.__annIsOpen());
                }
            };
            $(document).on("page-change.ql-ann", _syncActive);
            el.__syncActive = _syncActive;
            items.push({ el, syncActive: _syncActive });
            fab.appendChild(el);
        }

        fab.appendChild(trigger);

        // ── Open / close ──
        let isOpen = false;

        function openMenu() {
            isOpen = true;
            trigger.classList.add("open");
            items.forEach(({ el, syncActive }, i) => {
                if (syncActive) syncActive();
                // stagger each item: first item gets shortest delay
                setTimeout(() => el.classList.add("visible"), i * 40);
            });
        }

        function closeMenu() {
            isOpen = false;
            trigger.classList.remove("open");
            items.forEach(({ el }) => el.classList.remove("visible"));
        }

        trigger.addEventListener("click", () => isOpen ? closeMenu() : openMenu());

        document.addEventListener("click", (e) => {
            if (isOpen && !fab.contains(e.target)) closeMenu();
        });

        document.body.appendChild(fab);
    }

    function _makeItem(label, iconSvg, onClick) {
        const el = document.createElement("button");
        el.className = "ql-item";
        el.innerHTML = `<span class="ql-icon">${iconSvg}</span>${label}`;
        el.addEventListener("click", onClick);
        return el;
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    $(document).on("page-change.ql-boot", function () {
        if (!frappe.session?.user || frappe.session.user === "Guest") return;
        $(document).off("page-change.ql-boot");
        inject();
    });

    // Re-inject if navigated away (Frappe SPA)
    $(document).on("page-change", () => {
        if (frappe.session?.user && frappe.session.user !== "Guest") {
            if (!document.getElementById("ql-fab")) inject();
        }
    });
})();

// ── Team Radar Widget ─────────────────────────────────────────────────────────
(function () {
    "use strict";

    const RADAR_CSS = `
        #tr-wrap {
            position: fixed;
            bottom: 28px; left: 28px;
            z-index: 9997;
            display: flex; flex-direction: column;
            align-items: flex-start; gap: 8px;
        }

        /* ── Trigger button ── */
        #tr-trigger {
            width: 48px; height: 48px; border-radius: 50%;
            background: #0f172a;
            border: 2px solid rgba(37,99,235,0.55);
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: #60a5fa;
            transition: border-color .15s, transform .15s;
            animation: tr-pulse-ring 2.4s ease-in-out infinite;
        }
        #tr-trigger:hover { border-color: #2563eb; transform: scale(1.07); }
        #tr-trigger svg { width: 22px; height: 22px; pointer-events: none; }
        @keyframes tr-pulse-ring {
            0%,100% { box-shadow: 0 0 0 0   rgba(37,99,235,.5), 0 4px 16px rgba(0,0,0,.4); }
            50%     { box-shadow: 0 0 0 9px rgba(37,99,235,0),  0 4px 16px rgba(0,0,0,.4); }
        }

        /* ── Panel ── */
        #tr-panel {
            width: 236px;
            background: #07101f;
            border: 1.5px solid rgba(37,99,235,.3);
            border-radius: 18px;
            box-shadow: 0 24px 60px rgba(0,0,0,.75), inset 0 0 32px rgba(37,99,235,.04);
            overflow: hidden;
            transform-origin: bottom left;
            transform: scale(.88) translateY(5px);
            opacity: 0; pointer-events: none;
            transition: transform .12s cubic-bezier(.2,0,.2,1), opacity .1s ease;
        }
        #tr-panel.tr-open  { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
        #tr-panel.tr-fullscreen {
            position: fixed !important; inset: 0 !important;
            width: 100vw !important; height: 100vh !important;
            border-radius: 0 !important; z-index: 99999;
            transition: none;
        }

        /* ── Header ── */
        .tr-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 9px 12px 7px;
            border-bottom: 1px solid rgba(37,99,235,.18);
            background: #07101f; position: relative; z-index: 10;
        }
        .tr-head-label {
            font-size: 9.5px; font-weight: 800; letter-spacing: .11em;
            text-transform: uppercase; color: #60a5fa;
        }
        .tr-head-btns { display:flex; align-items:center; gap:5px; }
        .tr-icon-btn {
            width: 22px; height: 22px; border-radius: 50%; border: none;
            background: rgba(255,255,255,.06); color: rgba(255,255,255,.4);
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: background .1s, color .1s;
        }
        .tr-icon-btn:hover { background: rgba(255,255,255,.13); color: #fff; }
        .tr-icon-btn.tr-close:hover { background: rgba(220,38,38,.2); color: #f87171; }
        .tr-icon-btn svg { width: 11px; height: 11px; pointer-events: none; }

        /* ── CSS Radar (small view) ── */
        #tr-radar {
            position: relative;
            width: 196px; height: 196px;
            margin: 12px auto;
            border-radius: 50%;
            background: radial-gradient(circle at 50% 50%, #0d2040 0%, #050c18 70%, #030810 100%);
            border: 2px solid rgba(37,99,235,.35);
            overflow: hidden;
            /* dome bump */
            box-shadow:
                inset 0 -10px 28px rgba(0,0,0,.7),
                inset 0   3px 12px rgba(255,255,255,.045),
                0 10px 36px rgba(0,0,0,.6);
        }
        /* Specular lens highlight */
        #tr-radar::before {
            content: "";
            position: absolute; inset: 0; z-index: 20; border-radius: 50%;
            background: radial-gradient(ellipse at 36% 26%,
                rgba(255,255,255,.10) 0%,
                rgba(255,255,255,.02) 38%,
                transparent 62%);
            pointer-events: none;
        }
        /* Edge vignette */
        #tr-radar::after {
            content: "";
            position: absolute; inset: 0; z-index: 19; border-radius: 50%;
            background: radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%);
            pointer-events: none;
        }
        .tr-ring {
            position: absolute; border-radius: 50%;
            border: 1px solid rgba(37,99,235,.22);
            top: 50%; left: 50%; transform: translate(-50%,-50%);
        }
        .tr-ring-1 { width: 58px;  height: 58px; }
        .tr-ring-2 { width: 112px; height: 112px; }
        .tr-ring-3 { width: 168px; height: 168px; border-color: rgba(37,99,235,.12); }
        /* crosshairs */
        .tr-cross {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 100%; height: 1px;
            background: rgba(37,99,235,.15);
        }
        .tr-cross-v { width: 1px; height: 100%; }
        /* sweep */
        .tr-sweep {
            position: absolute; inset: 0; border-radius: 50%;
            background: conic-gradient(
                from 0deg,
                rgba(37,99,235,0)    0%,
                rgba(96,165,250,.5)  18%,
                rgba(37,99,235,0)    24%
            );
            animation: tr-rotate 2.6s linear infinite;
            z-index: 1;
        }
        @keyframes tr-rotate { to { transform: rotate(360deg); } }
        /* origin dot */
        .tr-origin {
            position: absolute; width: 6px; height: 6px; border-radius: 50%;
            background: #93c5fd;
            box-shadow: 0 0 8px 3px rgba(147,197,253,.55);
            top: 50%; left: 50%; transform: translate(-50%,-50%);
            z-index: 5;
        }
        /* pan/zoom canvas inside radar */
        #tr-radar-canvas {
            position: absolute; inset: 0;
            transform-origin: center;
            z-index: 5;
        }
        #tr-radar { cursor: grab; }
        #tr-radar.tr-dragging { cursor: grabbing; }
        /* blips */
        .tr-blip {
            position: absolute;
            transform: translate(-50%,-50%);
            display: flex; flex-direction: column; align-items: center;
            z-index: 10; pointer-events: auto;
        }
        .tr-blip-dot {
            width: 17px; height: 17px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 7.5px; font-weight: 900; color: #fff;
            box-shadow: 0 0 0 1.5px rgba(255,255,255,.22), 0 2px 8px rgba(0,0,0,.55);
            position: relative; flex-shrink: 0;
        }
        .tr-blip-dot::after {
            content: "";
            position: absolute; inset: -2px; border-radius: 50%;
            border: 1.5px solid currentColor;
            opacity: 0; animation: tr-ping 2.2s ease-out infinite;
        }
        @keyframes tr-ping { 0%{inset:-1px;opacity:.75} 100%{inset:-9px;opacity:0} }
        .tr-blip-name {
            margin-top: 3px;
            font-size: 8px; font-weight: 700; color: #cbd5e1;
            white-space: nowrap; pointer-events: auto; cursor: default;
            text-shadow: 0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,.9);
            max-width: 64px; overflow: hidden; text-overflow: ellipsis;
            line-height: 1; position: relative;
        }
        .tr-blip-name .tr-city-tip {
            position: absolute; bottom: calc(100% + 5px); left: 50%;
            transform: translateX(-50%);
            background: #0f1e38; border: 1px solid rgba(96,165,250,.35);
            border-radius: 6px; padding: 3px 8px;
            font-size: 9.5px; font-weight: 600; color: #bfdbfe;
            white-space: nowrap; pointer-events: none;
            opacity: 0; transition: none;
        }
        .tr-blip-name:hover .tr-city-tip { opacity: 1; }
        .tr-blip.tr-dimmed { opacity: .18; }
        /* search bar */
        .tr-search-wrap { padding: 5px 10px 0; background: #07101f; }
        #tr-search {
            width: 100%; box-sizing: border-box;
            background: rgba(255,255,255,.06); border: 1px solid rgba(37,99,235,.28);
            border-radius: 6px; padding: 5px 9px;
            font-size: 11px; color: #e2e8f0; outline: none;
        }
        #tr-search::placeholder { color: rgba(255,255,255,.3); }
        #tr-search:focus { border-color: rgba(96,165,250,.55); background: rgba(255,255,255,.09); }

        /* ── Map view (fullscreen only) ── */
        #tr-map-wrap {
            display: none;
            width: 100%; height: calc(100vh - 44px - 38px);
        }
        #tr-panel.tr-fullscreen #tr-radar   { display: none; }
        #tr-panel.tr-fullscreen #tr-map-wrap { display: block; }
        #tr-map { width: 100%; height: 100%; }
        #tr-map .leaflet-control-zoom a {
            background: #0f172a !important; color: #60a5fa !important;
            border-color: rgba(37,99,235,.3) !important;
        }
        #tr-map .leaflet-control-zoom a:hover { background: #1e293b !important; }
        #tr-map .leaflet-control-attribution { display: none; }
        .leaflet-popup-content-wrapper {
            background: #1e293b !important;
            border: 1px solid rgba(255,255,255,.12) !important;
            border-radius: 9px !important;
            box-shadow: 0 6px 24px rgba(0,0,0,.55) !important;
            color: #e2e8f0 !important; font-size: 12px !important; font-weight: 600 !important;
        }
        .leaflet-popup-tip { background: #1e293b !important; }
        .leaflet-popup-close-button { color: rgba(255,255,255,.4) !important; }
        .tr-lmarker {
            width: 30px; height: 30px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; font-weight: 800; color: #fff;
            box-shadow: 0 0 0 2.5px rgba(255,255,255,.2), 0 4px 14px rgba(0,0,0,.55);
            cursor: pointer; position: relative;
        }
        .tr-lmarker::after {
            content: ""; position: absolute; inset: -4px;
            border-radius: 50%; border: 2px solid currentColor;
            opacity: 0; animation: tr-ping 2.4s ease-out infinite;
        }

        /* ── Footer ── */
        .tr-foot {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 12px 9px;
            border-top: 1px solid rgba(37,99,235,.14);
            background: #07101f; position: relative; z-index: 10;
        }
        .tr-status-dot {
            width: 6px; height: 6px; border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 6px 2px rgba(34,197,94,.6);
            animation: tr-blink 1.8s ease-in-out infinite;
            display: inline-block; margin-right: 5px;
        }
        @keyframes tr-blink { 0%,100%{opacity:1} 50%{opacity:.28} }
        .tr-status-text { font-size: 10px; color: rgba(255,255,255,.38); }
        .tr-count-badge {
            font-size: 10px; font-weight: 700; color: #60a5fa;
            background: rgba(37,99,235,.18); border-radius: 99px; padding: 1px 7px;
        }
    `;

    // ── Location Permission Popup ─────────────────────────────────────────
    function _showLocationPopup() {
        if (document.getElementById("gl-loc-popup")) return;

        const style = document.createElement("style");
        style.id = "gl-loc-popup-style";
        style.textContent = `
            #gl-loc-popup { position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center; }
            .gl-loc-card { background:#fff;border-radius:20px;width:320px;overflow:hidden;box-shadow:0 12px 50px rgba(0,0,0,.28); }
            .gl-loc-header { position:relative;background:linear-gradient(135deg,#1e3f85,#2563eb);height:120px;overflow:hidden;display:flex;align-items:center;justify-content:center; }
            .gl-loc-ring { position:absolute;border-radius:50%;border:1.5px solid rgba(255,255,255,.18); }
            .gl-loc-ring-1 { width:60px;height:60px; }
            .gl-loc-ring-2 { width:100px;height:100px; }
            .gl-loc-ring-3 { width:150px;height:150px; }
            .gl-loc-sweep { position:absolute;width:75px;height:75px;border-radius:50%;background:conic-gradient(rgba(96,165,250,.35),transparent 60%);animation:gl-sweep 2.8s linear infinite;transform-origin:center; }
            @keyframes gl-sweep { to { transform:rotate(360deg); } }
            .gl-loc-dot { position:absolute;width:8px;height:8px;border-radius:50%;background:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.3); }
            .gl-loc-blip { position:absolute;width:7px;height:7px;border-radius:50%;animation:gl-blip-ping 2s ease-out infinite; }
            .gl-loc-blip-a { background:#34d399;top:38%;left:62%;animation-delay:.4s; }
            .gl-loc-blip-b { background:#a78bfa;top:58%;left:35%;animation-delay:1.1s; }
            .gl-loc-blip-c { background:#fb923c;top:32%;left:40%;animation-delay:1.8s; }
            @keyframes gl-blip-ping { 0%{box-shadow:0 0 0 0 currentColor;opacity:1} 70%{box-shadow:0 0 0 8px currentColor;opacity:0} 100%{opacity:0} }
            .gl-loc-body { padding:20px 22px 14px; }
            .gl-loc-app { font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;margin-bottom:4px; }
            .gl-loc-title { font-size:18px;font-weight:800;color:#111827;margin:0 0 8px; }
            .gl-loc-desc { font-size:12px;color:#4b5563;line-height:1.5;margin-bottom:14px; }
            .gl-loc-list { list-style:none;padding:0;margin:0 0 4px;display:flex;flex-direction:column;gap:6px; }
            .gl-loc-list li { display:flex;align-items:center;gap:8px;font-size:12px;color:#374151; }
            .gl-loc-icon { width:18px;height:18px;border-radius:50%;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
            .gl-loc-icon svg { width:10px;height:10px; }
            .gl-loc-footer { display:flex;gap:8px;padding:14px 22px 18px;border-top:1px solid #f1f5f9; }
            .gl-loc-btn-ghost { flex:1;height:38px;border:1.5px solid #e5e7eb;border-radius:99px;background:#fff;color:#374151;font-size:12.5px;font-weight:500;cursor:pointer;transition:background .12s; }
            .gl-loc-btn-ghost:hover { background:#f9fafb; }
            .gl-loc-btn-primary { flex:2;height:38px;border:none;border-radius:99px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .12s; }
            .gl-loc-btn-primary:hover { opacity:.9; }
            .gl-loc-btn-primary svg { width:13px;height:13px; }
            .gl-loc-fade-in { animation:gl-fade-in .22s cubic-bezier(.2,0,.2,1); }
            @keyframes gl-fade-in { from{opacity:0;transform:scale(.94) translateY(8px)} to{opacity:1;transform:none} }
        `;
        document.head.appendChild(style);

        const el = document.createElement("div");
        el.id = "gl-loc-popup";
        el.innerHTML = `
            <div class="gl-loc-card gl-loc-fade-in">
                <div class="gl-loc-header">
                    <div class="gl-loc-ring gl-loc-ring-3"></div>
                    <div class="gl-loc-ring gl-loc-ring-2"></div>
                    <div class="gl-loc-ring gl-loc-ring-1"></div>
                    <div class="gl-loc-sweep"></div>
                    <div class="gl-loc-dot"></div>
                    <div class="gl-loc-blip gl-loc-blip-a"></div>
                    <div class="gl-loc-blip gl-loc-blip-b"></div>
                    <div class="gl-loc-blip gl-loc-blip-c"></div>
                </div>
                <div class="gl-loc-body">
                    <p class="gl-loc-app">ERP Next</p>
                    <h2 class="gl-loc-title">Allow Location Access</h2>
                    <p class="gl-loc-desc">Your team uses live location to coordinate field employees, track coverage, and stay in sync on the radar map.</p>
                    <ul class="gl-loc-list">
                        <li><span class="gl-loc-icon"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Used only while the app is open</li>
                        <li><span class="gl-loc-icon"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Visible only to workspace admins</li>
                        <li><span class="gl-loc-icon"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Never shared outside your organisation</li>
                    </ul>
                </div>
                <div class="gl-loc-footer">
                    <button class="gl-loc-btn-ghost" id="gl-loc-dismiss">Not Now</button>
                    <button class="gl-loc-btn-primary" id="gl-loc-allow">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.49-2.01-4.5-4.5-4.5zm0 6.1a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/></svg>
                        Allow Location
                    </button>
                </div>
            </div>`;

        document.body.appendChild(el);

        el.querySelector("#gl-loc-dismiss").addEventListener("click", () => {
            sessionStorage.setItem("gl_loc_dismissed", "1");
            el.remove();
        });

        el.querySelector("#gl-loc-allow").addEventListener("click", () => {
            localStorage.setItem("loc_permission_granted", "1");
            el.remove();
            _startLocationTracking();
            _injectLocationBanner();
        });
    }

    // Show once per browser session (disappears on tab close / new login)
    function _maybeShowLocationPopup() {
        if (localStorage.getItem("loc_permission_granted") === "1") return; // already granted
        if (sessionStorage.getItem("gl_loc_dismissed")) return;            // dismissed this session
        setTimeout(_showLocationPopup, 1200); // slight delay so page settles
    }

    // ── User color palette (consistent per user, different colors even for same initials) ──
    const _BLIP_COLORS = ["#2563eb","#0891b2","#7c3aed","#059669","#d97706","#dc2626","#db2777","#0d9488","#ea580c","#4f46e5","#0284c7","#16a34a"];
    function _blipColor(str) {
        let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
        return _BLIP_COLORS[h % _BLIP_COLORS.length];
    }

    function _initials(name) {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/);
        return parts.length === 1 ? parts[0][0].toUpperCase()
            : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // ── Leaflet loader ────────────────────────────────────────────────────
    let _leafletReady = null;
    function _loadLeaflet() {
        if (_leafletReady) return _leafletReady;
        _leafletReady = new Promise(resolve => {
            if (window.L) { resolve(window.L); return; }
            const css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(css);
            const js = document.createElement("script");
            js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            js.onload = () => resolve(window.L);
            document.head.appendChild(js);
        });
        return _leafletReady;
    }

    const RADAR_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <path d="M12 12 L20 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <circle cx="12" cy="12" r="5"  stroke="currentColor" stroke-width="1.2" opacity="0.45"/>
        <circle cx="12" cy="12" r="9"  stroke="currentColor" stroke-width="1.2" opacity="0.28"/>
        <line x1="12" y1="3"  x2="12" y2="21" stroke="currentColor" stroke-width="0.8" opacity="0.2"/>
        <line x1="3"  y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="0.8" opacity="0.2"/>
    </svg>`;

    const CLOSE_ICON = `<svg viewBox="0 0 12 12" fill="none">
        <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="11" y1="1" x2="1"  y2="11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;

    // ── Bounding-box normalise lat/lng → radar % ────────────────────────
    function _toRadarPos(lat, lng, locs) {
        if (locs.length === 1) return { top: "50%", left: "50%" };
        const lats = locs.map(l => l.lat), lngs = locs.map(l => l.lng);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const p = 0.12;
        const top  = (1 - (lat - minLat) / (maxLat - minLat || 1)) * (1 - 2*p) + p;
        const left = (lng - minLng) / (maxLng - minLng || 1) * (1 - 2*p) + p;
        return { top: `${(top*100).toFixed(1)}%`, left: `${(left*100).toFixed(1)}%` };
    }

    // Leaflet map instance and marker layer
    let _trMap = null, _trMarkers = [];

    // ── Location tracking (start after permission) ────────────────────────
    let _lastCity = "";
    function _startLocationTracking() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(pos => {
            const { latitude: lat, longitude: lng, accuracy } = pos.coords;
            // Reverse geocode for city name (once per significant move)
            const _push = (city) => frappe.call({
                method: "erp_next_custom.erp_next_custom.api.update_location",
                args: { lat, lng, accuracy, city },
                error() {},
            });
            if (!_lastCity) {
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers: { "Accept-Language": "en" } })
                    .then(r => r.json())
                    .then(d => {
                        const a = d.address || {};
                        _lastCity = a.city || a.town || a.village || a.suburb || a.county || "";
                        _push(_lastCity);
                    })
                    .catch(() => _push(""));
            } else {
                _push(_lastCity);
            }
        }, () => {}, { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 });
    }

    // ── Green top banner (visible to all when location tracking active) ──
    function _injectLocationBanner() {
        if (document.getElementById("gl-loc-banner")) return;
        const bar = document.createElement("div");
        bar.id = "gl-loc-banner";
        bar.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="12" height="12" style="flex-shrink:0"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5c0-2.49-2.01-4.5-4.5-4.5zm0 6.1a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/></svg>Administrators can see your current location while you are online`;
        bar.style.cssText = "position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99998;display:inline-flex;align-items:center;gap:5px;padding:0;background:none;color:#16a34a;font-size:11px;font-weight:600;letter-spacing:.01em;pointer-events:none;white-space:nowrap;text-shadow:0 0 8px rgba(255,255,255,.6),0 1px 2px rgba(0,0,0,.15);";
        document.body.appendChild(bar);
    }

    const EXPAND_ICON = `<svg viewBox="0 0 12 12" fill="none"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const SHRINK_ICON  = `<svg viewBox="0 0 12 12" fill="none"><path d="M4 1v3H1M11 4H8V1M8 11V8h3M1 8h3v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    function injectRadar() {
        if (document.getElementById("tr-wrap")) return;

        const style = document.createElement("style");
        style.id = "tr-style";
        style.textContent = RADAR_CSS;
        document.head.appendChild(style);

        const wrap = document.createElement("div");
        wrap.id = "tr-wrap";
        wrap.innerHTML = `
            <div id="tr-panel">
                <div class="tr-head">
                    <span class="tr-head-label">Team Radar</span>
                    <div class="tr-head-btns">
                        <button class="tr-icon-btn" id="tr-expand" title="Fullscreen map">${EXPAND_ICON}</button>
                        <button class="tr-icon-btn tr-close" id="tr-close">${CLOSE_ICON}</button>
                    </div>
                </div>
                <div class="tr-search-wrap">
                    <input id="tr-search" type="text" placeholder="Search by name…" autocomplete="off" spellcheck="false" />
                </div>
                <div id="tr-radar">
                    <div class="tr-ring tr-ring-3"></div>
                    <div class="tr-ring tr-ring-2"></div>
                    <div class="tr-ring tr-ring-1"></div>
                    <div class="tr-cross"></div>
                    <div class="tr-cross tr-cross-v"></div>
                    <div class="tr-sweep"></div>
                    <div class="tr-origin"></div>
                    <div id="tr-radar-canvas"></div>
                </div>
                <div id="tr-map-wrap"><div id="tr-map"></div></div>
                <div class="tr-foot">
                    <span class="tr-status-text"><span class="tr-status-dot"></span>Live</span>
                    <span class="tr-count-badge" id="tr-count">0 online</span>
                </div>
            </div>
            <button id="tr-trigger" title="Team Radar">${RADAR_ICON}</button>
        `;
        document.body.appendChild(wrap);

        const panel     = document.getElementById("tr-panel");
        const trigger   = document.getElementById("tr-trigger");
        const closeBtn  = document.getElementById("tr-close");
        const expandBtn = document.getElementById("tr-expand");
        const radarEl   = document.getElementById("tr-radar");
        const canvasEl  = document.getElementById("tr-radar-canvas");
        const searchEl  = document.getElementById("tr-search");
        const countEl   = document.getElementById("tr-count");
        let open = false, fullscreen = false, _lastLocs = [];
        let _panX = 0, _panY = 0, _zoom = 1;

        function _applyTransform() {
            canvasEl.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
        }

        // ── Pan / zoom on radar dome ───────────────────────────────
        (function _initPanZoom() {
            let dragging = false, startX, startY, startPanX, startPanY;
            radarEl.addEventListener("mousedown", e => {
                if (e.button !== 0) return;
                dragging = true; startX = e.clientX; startY = e.clientY;
                startPanX = _panX; startPanY = _panY;
                radarEl.classList.add("tr-dragging");
                e.preventDefault();
            });
            document.addEventListener("mousemove", e => {
                if (!dragging) return;
                _panX = startPanX + (e.clientX - startX);
                _panY = startPanY + (e.clientY - startY);
                _applyTransform();
            });
            document.addEventListener("mouseup", () => {
                dragging = false; radarEl.classList.remove("tr-dragging");
            });
            radarEl.addEventListener("wheel", e => {
                e.preventDefault();
                const rect   = radarEl.getBoundingClientRect();
                const cx     = e.clientX - rect.left - rect.width  / 2;
                const cy     = e.clientY - rect.top  - rect.height / 2;
                const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
                const newZoom = Math.max(0.4, Math.min(6, _zoom * factor));
                _panX = cx - (cx - _panX) * newZoom / _zoom;
                _panY = cy - (cy - _panY) * newZoom / _zoom;
                _zoom = newZoom;
                _applyTransform();
            }, { passive: false });
            // double-click resets view
            radarEl.addEventListener("dblclick", () => {
                _panX = 0; _panY = 0; _zoom = 1; _applyTransform();
            });
        })();

        // ── Search filter ──────────────────────────────────────────
        searchEl.addEventListener("input", () => {
            const q = searchEl.value.trim().toLowerCase();
            canvasEl.querySelectorAll(".tr-blip").forEach(el => {
                const name = (el.dataset.name || "").toLowerCase();
                el.classList.toggle("tr-dimmed", q.length > 0 && !name.includes(q));
            });
        });
        // prevent panel close on search click
        searchEl.addEventListener("click", e => e.stopPropagation());

        // ── CSS radar blips (small view) ──────────────────────────
        function _renderRadarBlips(locs) {
            canvasEl.querySelectorAll(".tr-blip").forEach(el => el.remove());
            const q = searchEl.value.trim().toLowerCase();
            locs.forEach((b, i) => {
                const ini   = _initials(b.full_name || b.user);
                const color = _blipColor(b.user || b.full_name || ini);
                const pos   = _toRadarPos(b.lat, b.lng, locs);
                const name  = b.full_name || b.user;
                const label = b.city ? `${name} · ${b.city}` : name;
                const d     = document.createElement("div");
                d.className = "tr-blip" + (q && !label.toLowerCase().includes(q) ? " tr-dimmed" : "");
                d.dataset.name = label;
                d.style.cssText = `top:${pos.top};left:${pos.left}`;
                const cityTip = b.city ? `<span class="tr-city-tip">${b.city}</span>` : "";
                d.innerHTML = `<div class="tr-blip-dot" style="background:${color};color:${color};animation-delay:${(i*.55)%2}s">${ini}</div><div class="tr-blip-name">${name}${cityTip}</div>`;
                canvasEl.appendChild(d);
            });
        }

        // ── Leaflet map (fullscreen view) ─────────────────────────
        function _initMap() {
            if (_trMap) { setTimeout(() => _trMap.invalidateSize(), 60); return; }
            _loadLeaflet().then(() => {
                const L = window.L;
                _trMap = L.map("tr-map", { zoomControl: true, attributionControl: false, zoom: 12, center: [33.8938, 35.5018] });
                L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd" }).addTo(_trMap);
                _updateMapMarkers(_lastLocs);
            });
        }

        function _updateMapMarkers(locs) {
            if (!_trMap || !window.L) return;
            const L = window.L;
            _trMarkers.forEach(m => m.remove()); _trMarkers = [];
            locs.forEach((b, i) => {
                const ini   = _initials(b.full_name || b.user);
                const color = _blipColor(b.user || b.full_name || ini);
                const label = b.city ? `${b.full_name || b.user}<br><small style="opacity:.7">${b.city}</small>` : (b.full_name || b.user);
                const icon  = L.divIcon({ className: "", html: `<div class="tr-lmarker" style="background:${color};animation-delay:${(i*.6)%2}s">${ini}</div>`, iconSize:[30,30], iconAnchor:[15,15], popupAnchor:[0,-18] });
                _trMarkers.push(L.marker([b.lat, b.lng], { icon }).bindPopup(label).addTo(_trMap));
            });
            if (locs.length === 1) _trMap.setView([locs[0].lat, locs[0].lng], 13);
            else if (locs.length > 1) _trMap.fitBounds(L.latLngBounds(locs.map(b=>[b.lat,b.lng])), { padding:[32,32], maxZoom:14 });
        }

        // ── Toggle fullscreen ─────────────────────────────────────
        function toggleFullscreen() {
            fullscreen = !fullscreen;
            panel.classList.toggle("tr-fullscreen", fullscreen);
            expandBtn.innerHTML = fullscreen ? SHRINK_ICON : EXPAND_ICON;
            if (fullscreen) _initMap();
            else if (_trMap) _trMap.invalidateSize();
        }

        // ── Toggle panel open/close ───────────────────────────────
        function togglePanel() {
            open = !open;
            panel.classList.toggle("tr-open", open);
            if (open) _refreshRadar();
        }

        trigger.addEventListener("click",  e => { e.stopPropagation(); togglePanel(); });
        closeBtn.addEventListener("click", e => { e.stopPropagation(); if (fullscreen) toggleFullscreen(); open = true; togglePanel(); });
        expandBtn.addEventListener("click",e => { e.stopPropagation(); toggleFullscreen(); });
        document.addEventListener("click", e => { if (open && !fullscreen && !wrap.contains(e.target)) { open = true; togglePanel(); } });
        document.addEventListener("keydown", e => { if (e.key === "Escape" && (fullscreen || open)) { if (fullscreen) toggleFullscreen(); else { open = true; togglePanel(); } } });

        // ── Poll live locations every 30s ─────────────────────────
        function _refreshRadar() {
            frappe.call({
                method: "erp_next_custom.erp_next_custom.api.get_locations",
                callback(r) {
                    _lastLocs = r.message || [];
                    countEl.textContent = `${_lastLocs.length} online`;
                    _renderRadarBlips(_lastLocs);
                    if (fullscreen) _updateMapMarkers(_lastLocs);
                },
                error() {},
            });
        }
        setInterval(() => { if (open) _refreshRadar(); }, 30000);

        // ── Location tracking ─────────────────────────────────────
        if (localStorage.getItem("loc_permission_granted") === "1") {
            _startLocationTracking();
            _injectLocationBanner();
        } else {
            _maybeShowLocationPopup();
        }
    }

    $(document).on("page-change.tr-boot", function () {
        if (!frappe.session?.user || frappe.session.user === "Guest") return;
        $(document).off("page-change.tr-boot");
        injectRadar();
    });

    $(document).on("page-change", () => {
        if (frappe.session?.user && frappe.session.user !== "Guest") {
            if (!document.getElementById("tr-wrap")) injectRadar();
            if (localStorage.getItem("loc_permission_granted") === "1") {
                if (!document.getElementById("gl-loc-banner")) _injectLocationBanner();
            }
        }
    });
})();
