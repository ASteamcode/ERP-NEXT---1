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
            bottom: 28px;
            left: 28px;
            z-index: 9997;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }

        /* ── Collapsed trigger ── */
        #tr-trigger {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #0f172a;
            border: 2px solid rgba(37,99,235,0.55);
            box-shadow: 0 0 0 0 rgba(37,99,235,0.4), 0 4px 16px rgba(0,0,0,0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #60a5fa;
            transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
            animation: tr-pulse-ring 2.4s ease-in-out infinite;
        }
        #tr-trigger:hover {
            border-color: #2563eb;
            transform: scale(1.06);
        }
        #tr-trigger svg { width: 22px; height: 22px; pointer-events: none; }

        @keyframes tr-pulse-ring {
            0%, 100% { box-shadow: 0 0 0 0   rgba(37,99,235,0.5), 0 4px 16px rgba(0,0,0,0.4); }
            50%       { box-shadow: 0 0 0 8px rgba(37,99,235,0),   0 4px 16px rgba(0,0,0,0.4); }
        }

        /* ── Panel ── */
        #tr-panel {
            width: 220px;
            background: #0b1120;
            border: 1.5px solid rgba(37,99,235,0.35);
            border-radius: 16px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.55), inset 0 0 40px rgba(37,99,235,0.04);
            overflow: hidden;
            transform-origin: bottom left;
            transform: scale(0.85) translateY(6px);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease;
        }
        #tr-panel.tr-open {
            transform: scale(1) translateY(0);
            opacity: 1;
            pointer-events: all;
        }

        /* ── Panel header ── */
        .tr-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 13px 8px;
            border-bottom: 1px solid rgba(37,99,235,0.2);
        }
        .tr-head-label {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .10em;
            text-transform: uppercase;
            color: #60a5fa;
        }
        .tr-close-btn {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: none;
            background: rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.12s, color 0.12s;
        }
        .tr-close-btn:hover { background: rgba(220,38,38,0.2); color: #f87171; }
        .tr-close-btn svg { width: 11px; height: 11px; pointer-events: none; }

        /* ── Radar display ── */
        .tr-radar {
            position: relative;
            width: 178px;
            height: 178px;
            margin: 14px auto;
            border-radius: 50%;
            background: radial-gradient(circle, #0d1f3c 0%, #060d1a 100%);
            border: 1.5px solid rgba(37,99,235,0.3);
            overflow: hidden;
            box-shadow: inset 0 0 24px rgba(37,99,235,0.12), 0 0 16px rgba(37,99,235,0.1);
        }

        /* Concentric rings */
        .tr-ring {
            position: absolute;
            border-radius: 50%;
            border: 1px solid rgba(37,99,235,0.2);
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
        }
        .tr-ring-1 { width: 60px;  height: 60px; }
        .tr-ring-2 { width: 116px; height: 116px; }
        .tr-ring-3 { width: 170px; height: 170px; border-color: rgba(37,99,235,0.1); }

        /* Crosshairs */
        .tr-radar::before,
        .tr-radar::after {
            content: "";
            position: absolute;
            background: rgba(37,99,235,0.18);
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
        }
        .tr-radar::before { width: 1px; height: 100%; }
        .tr-radar::after  { height: 1px; width: 100%; }

        /* Sweep */
        .tr-sweep {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: conic-gradient(
                from 0deg,
                rgba(37,99,235,0)    0%,
                rgba(37,99,235,0.55) 20%,
                rgba(37,99,235,0)    25%
            );
            animation: tr-rotate 3s linear infinite;
        }
        @keyframes tr-rotate {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }

        /* Centre dot */
        .tr-origin {
            position: absolute;
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #fff;
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            box-shadow: 0 0 6px 2px rgba(255,255,255,0.5);
            z-index: 2;
        }

        /* Blips */
        .tr-blip {
            position: absolute;
            width: 28px; height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 700;
            color: #fff;
            cursor: pointer;
            transform: translate(-50%,-50%);
            z-index: 3;
            transition: transform 0.15s;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 0 10px rgba(0,0,0,0.4);
        }
        .tr-blip::after {
            content: "";
            position: absolute;
            inset: -3px;
            border-radius: 50%;
            border: 2px solid currentColor;
            opacity: 0;
            animation: tr-blip-ping 2.5s ease-out infinite;
        }
        .tr-blip:hover { transform: translate(-50%,-50%) scale(1.18); z-index: 10; }

        @keyframes tr-blip-ping {
            0%   { inset: -1px; opacity: 0.7; }
            100% { inset: -10px; opacity: 0; }
        }

        /* Blip tooltip */
        .tr-blip-tip {
            position: absolute;
            bottom: calc(100% + 5px);
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 6px;
            padding: 3px 7px;
            font-size: 10px;
            font-weight: 600;
            color: #e2e8f0;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.12s;
        }
        .tr-blip:hover .tr-blip-tip { opacity: 1; }

        /* ── Footer status bar ── */
        .tr-foot {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 13px 10px;
            border-top: 1px solid rgba(37,99,235,0.15);
        }
        .tr-status-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 5px 1px rgba(34,197,94,0.6);
            animation: tr-blink 1.8s ease-in-out infinite;
            display: inline-block;
            margin-right: 5px;
        }
        @keyframes tr-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
        }
        .tr-status-text {
            font-size: 10px;
            color: rgba(255,255,255,0.4);
        }
        .tr-count-badge {
            font-size: 10px;
            font-weight: 700;
            color: #60a5fa;
            background: rgba(37,99,235,0.18);
            border-radius: 99px;
            padding: 1px 7px;
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

    // ── User color palette (consistent per initials) ──────────────────────
    const _BLIP_COLORS = ["#2563eb","#0891b2","#7c3aed","#059669","#d97706","#dc2626","#db2777"];
    function _blipColor(ini) {
        let h = 0; for (let i = 0; i < ini.length; i++) h = (h * 31 + ini.charCodeAt(i)) & 0xffff;
        return _BLIP_COLORS[h % _BLIP_COLORS.length];
    }

    function _initials(name) {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/);
        return parts.length === 1 ? parts[0][0].toUpperCase()
            : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Map from lat/lng bounding box to radar % positions
    // We use a simple Mercator-ish normalisation over whatever bounding box we have
    function _latLngToRadar(lat, lng, allLocs) {
        if (allLocs.length === 1) return { top: "50%", left: "50%" };
        const lats = allLocs.map(l => l.lat), lngs = allLocs.map(l => l.lng);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const pad = 0.1;
        const rLat = maxLat - minLat || 1, rLng = maxLng - minLng || 1;
        const top  = (1 - (lat - minLat) / rLat) * (1 - 2 * pad) + pad;
        const left = (lng - minLng) / rLng * (1 - 2 * pad) + pad;
        return { top: `${(top * 100).toFixed(1)}%`, left: `${(left * 100).toFixed(1)}%` };
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

    function _buildBlipsHTML(locs) {
        return locs.map((b, i) => {
            const ini   = _initials(b.full_name || b.user);
            const color = _blipColor(ini);
            const delay = `${(i * 0.5) % 2}s`;
            const pos   = _latLngToRadar(b.lat, b.lng, locs);
            return `<div class="tr-blip" style="top:${pos.top};left:${pos.left};background:${color};animation-delay:${delay};color:#fff;">${ini}<span class="tr-blip-tip">${b.full_name || b.user}</span></div>`;
        }).join("");
    }

    // ── Location tracking (start after permission) ────────────────────────
    function _startLocationTracking() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(pos => {
            const { latitude: lat, longitude: lng, accuracy } = pos.coords;
            frappe.call({
                method: "erp_next_custom.erp_next_custom.api.update_location",
                args: { lat, lng, accuracy },
                error() {},
            });
        }, () => {}, { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 });
    }

    // ── Green top banner (visible to all when location tracking active) ──
    function _injectLocationBanner() {
        if (document.getElementById("gl-loc-banner")) return;
        const bar = document.createElement("div");
        bar.id = "gl-loc-banner";
        bar.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5c0-2.49-2.01-4.5-4.5-4.5zm0 6.1a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/></svg>Administrators can see your current location while you are online`;
        bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99998;display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 16px;background:#16a34a;color:#fff;font-size:11.5px;font-weight:500;letter-spacing:.01em;pointer-events:none;";
        document.body.appendChild(bar);
        // Push page content down
        const style = document.createElement("style");
        style.id = "gl-loc-banner-style";
        style.textContent = `body { padding-top: 28px !important; } #gl-loc-banner { height: 28px; }`;
        document.head.appendChild(style);
    }

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
                    <button class="tr-close-btn" id="tr-close">${CLOSE_ICON}</button>
                </div>
                <div class="tr-radar" id="tr-radar-body">
                    <div class="tr-ring tr-ring-1"></div>
                    <div class="tr-ring tr-ring-2"></div>
                    <div class="tr-ring tr-ring-3"></div>
                    <div class="tr-sweep"></div>
                    <div class="tr-origin"></div>
                </div>
                <div class="tr-foot">
                    <span class="tr-status-text">
                        <span class="tr-status-dot"></span>Live
                    </span>
                    <span class="tr-count-badge" id="tr-count">0 online</span>
                </div>
            </div>
            <button id="tr-trigger" title="Team Radar">${RADAR_ICON}</button>
        `;

        document.body.appendChild(wrap);

        const panel    = document.getElementById("tr-panel");
        const trigger  = document.getElementById("tr-trigger");
        const closeBtn = document.getElementById("tr-close");
        const radarBody = document.getElementById("tr-radar-body");
        const countEl  = document.getElementById("tr-count");

        let open = false;
        function togglePanel() { open = !open; panel.classList.toggle("tr-open", open); if (open) _refreshRadar(); }
        trigger.addEventListener("click", (e) => { e.stopPropagation(); togglePanel(); });
        closeBtn.addEventListener("click", (e) => { e.stopPropagation(); open = true; togglePanel(); });
        document.addEventListener("click", (e) => { if (open && !wrap.contains(e.target)) { open = true; togglePanel(); } });

        // ── Poll live locations every 30s ─────────────────────────
        function _refreshRadar() {
            frappe.call({
                method: "erp_next_custom.erp_next_custom.api.get_locations",
                callback(r) {
                    const locs = r.message || [];
                    // Remove old blips
                    radarBody.querySelectorAll(".tr-blip").forEach(el => el.remove());
                    if (locs.length) {
                        radarBody.insertAdjacentHTML("beforeend", _buildBlipsHTML(locs));
                    }
                    countEl.textContent = `${locs.length} online`;
                },
                error() {},
            });
        }
        _refreshRadar();
        setInterval(_refreshRadar, 30000);

        // ── Start location tracking if permission granted ──────────
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
