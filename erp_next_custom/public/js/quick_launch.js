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
