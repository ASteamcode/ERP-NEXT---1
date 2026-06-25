// Custom Desk Home — replaces the default desktop grid with a branded landing page.
// Gradient design matches the Prospect / grid_core visual language (Salesforce blues + teal).
(function () {
    "use strict";

    // ── Greeting pool ─────────────────────────────────────────────────────────
    const GREETINGS = [
        "Back at it",
        "Ready to crush it",
        "Let's get moving",
        "Time to build",
        "Welcome back",
        "Good to see you",
        "Let's make it happen",
        "On a roll",
    ];

    function randomGreeting() {
        return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    }

    function firstName(fullName) {
        if (!fullName) return "";
        return fullName.split(" ")[0];
    }

    // ── SVG icons ─────────────────────────────────────────────────────────────
    const ICON = {
        overview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>`,
        crm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>`,
        contact: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>`,
        phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.42 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>`,
        email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <polyline points="2,4 12,13 22,4"/>
        </svg>`,
        company: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>`,
        arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
        </svg>`,
    };

    // ── CSS ───────────────────────────────────────────────────────────────────
    const CSS = `
        .dh-shell {
            min-height: 100vh;
            background: linear-gradient(140deg, #0d2756 0%, #1e3f85 30%, #3a6fd8 65%, #0e7490 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 56px 20px 48px;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* ── Hero greeting ── */
        .dh-hero {
            text-align: center;
            margin-bottom: 48px;
        }
        .dh-greeting {
            font-size: clamp(28px, 5vw, 42px);
            font-weight: 800;
            color: #fff;
            letter-spacing: -.02em;
            line-height: 1.15;
        }
        .dh-greeting span {
            color: #93c5fd;
        }
        .dh-sub {
            font-size: 15px;
            color: rgba(255,255,255,.55);
            margin-top: 8px;
            font-weight: 400;
        }

        /* ── Card wrapper ── */
        .dh-card {
            background: rgba(255,255,255,.08);
            border: 1px solid rgba(255,255,255,.15);
            border-radius: 18px;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 24px 28px;
            width: 100%;
            max-width: 560px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,.18);
        }
        .dh-card-title {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .10em;
            text-transform: uppercase;
            color: rgba(255,255,255,.45);
            margin-bottom: 16px;
        }

        /* ── Shortcuts ── */
        .dh-shortcuts {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .dh-shortcut {
            display: flex;
            align-items: center;
            gap: 14px;
            background: rgba(255,255,255,.10);
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 14px;
            padding: 18px 20px;
            cursor: pointer;
            text-decoration: none;
            transition: background .15s, transform .12s, box-shadow .15s;
            -webkit-tap-highlight-color: transparent;
        }
        .dh-shortcut:hover {
            background: rgba(255,255,255,.18);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,.2);
            text-decoration: none;
        }
        .dh-shortcut:active { transform: scale(.97); }
        .dh-sc-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: none;
        }
        .dh-sc-icon svg { width: 22px; height: 22px; }
        .dh-sc-icon-overview { background: linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; }
        .dh-sc-icon-crm      { background: linear-gradient(135deg,#0891b2,#0e7490); color:#fff; }
        .dh-sc-label {
            font-size: 14px;
            font-weight: 700;
            color: #fff;
            line-height: 1.2;
        }
        .dh-sc-desc {
            font-size: 11px;
            color: rgba(255,255,255,.5);
            margin-top: 2px;
        }
        .dh-sc-arrow {
            margin-left: auto;
            color: rgba(255,255,255,.3);
        }
        .dh-sc-arrow svg { width: 16px; height: 16px; }

        /* ── Recent contacts ── */
        .dh-contact-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,.08);
            cursor: pointer;
            transition: background .12s;
            border-radius: 8px;
        }
        .dh-contact-row:last-child { border-bottom: none; }
        .dh-contact-row:hover { background: rgba(255,255,255,.06); padding-left: 6px; }
        .dh-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1e3a8a, #2d52a8);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: none;
            letter-spacing: .02em;
        }
        .dh-contact-info { flex: 1; min-width: 0; }
        .dh-contact-name {
            font-size: 13.5px;
            font-weight: 600;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .dh-contact-meta {
            font-size: 11.5px;
            color: rgba(255,255,255,.45);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1px;
        }
        .dh-contact-actions {
            display: flex;
            gap: 6px;
            flex: none;
        }
        .dh-act-btn {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 1px solid rgba(255,255,255,.18);
            background: rgba(255,255,255,.08);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: rgba(255,255,255,.7);
            transition: background .12s, color .12s;
            -webkit-tap-highlight-color: transparent;
        }
        .dh-act-btn:hover { background: rgba(255,255,255,.18); color: #fff; }
        .dh-act-btn svg { width: 14px; height: 14px; }
        .dh-empty {
            text-align: center;
            color: rgba(255,255,255,.35);
            font-size: 13px;
            padding: 12px 0;
        }
        .dh-loading {
            text-align: center;
            color: rgba(255,255,255,.35);
            font-size: 13px;
            padding: 12px 0;
        }
    `;

    function injectCSS() {
        if (document.getElementById("dh-styles")) return;
        const s = document.createElement("style");
        s.id = "dh-styles";
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    // ── Avatar initials ────────────────────────────────────────────────────
    function initials(name) {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // ── Render recent contacts ─────────────────────────────────────────────
    function renderContacts(container) {
        container.innerHTML = `<div class="dh-loading">Loading…</div>`;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Contact",
                fields: ["name", "first_name", "last_name", "company_name", "mobile_no", "email_id"],
                order_by: "modified desc",
                limit: 5,
            },
            callback(r) {
                const list = r.message || [];
                if (!list.length) {
                    container.innerHTML = `<div class="dh-empty">No contacts yet</div>`;
                    return;
                }
                container.innerHTML = list.map(c => {
                    const full = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name;
                    const meta = c.company_name || c.email_id || c.mobile_no || "";
                    const av = initials(full);
                    const phoneBtn = c.mobile_no
                        ? `<a class="dh-act-btn" href="tel:${c.mobile_no}" title="${c.mobile_no}" onclick="event.stopPropagation()">
                               ${ICON.phone}</a>`
                        : "";
                    const emailBtn = c.email_id
                        ? `<a class="dh-act-btn" href="mailto:${c.email_id}" title="${c.email_id}" onclick="event.stopPropagation()">
                               ${ICON.email}</a>`
                        : "";
                    return `
                        <div class="dh-contact-row" data-name="${c.name}">
                            <div class="dh-avatar">${av}</div>
                            <div class="dh-contact-info">
                                <div class="dh-contact-name">${full}</div>
                                ${meta ? `<div class="dh-contact-meta">${meta}</div>` : ""}
                            </div>
                            <div class="dh-contact-actions">
                                ${phoneBtn}${emailBtn}
                            </div>
                        </div>`;
                }).join("");

                // Row click → open contact form
                container.querySelectorAll(".dh-contact-row").forEach(row => {
                    row.addEventListener("click", () => {
                        frappe.set_route("Form", "Contact", row.dataset.name);
                    });
                });
            },
        });
    }

    // ── Main render ───────────────────────────────────────────────────────
    function renderHome(wrapper) {
        injectCSS();

        const fullName = frappe.boot && frappe.boot.user
            ? (frappe.boot.user.full_name || frappe.session.user)
            : frappe.session.user;

        const greeting = randomGreeting();
        const name = firstName(fullName);

        const html = `
        <div class="dh-shell" id="dh-shell">
            <div class="dh-hero">
                <div class="dh-greeting">${greeting},<br><span>${name}</span></div>
                <div class="dh-sub">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>

            <!-- Shortcuts -->
            <div class="dh-card">
                <div class="dh-card-title">Quick Access</div>
                <div class="dh-shortcuts">
                    <a class="dh-shortcut" href="/desk/overview">
                        <div class="dh-sc-icon dh-sc-icon-overview">${ICON.overview}</div>
                        <div>
                            <div class="dh-sc-label">Overview</div>
                            <div class="dh-sc-desc">Stats &amp; reports</div>
                        </div>
                        <div class="dh-sc-arrow">${ICON.arrow}</div>
                    </a>
                    <a class="dh-shortcut" href="/desk/crm">
                        <div class="dh-sc-icon dh-sc-icon-crm">${ICON.crm}</div>
                        <div>
                            <div class="dh-sc-label">CRM</div>
                            <div class="dh-sc-desc">Leads &amp; prospects</div>
                        </div>
                        <div class="dh-sc-arrow">${ICON.arrow}</div>
                    </a>
                </div>
            </div>

            <!-- Recent Contacts -->
            <div class="dh-card">
                <div class="dh-card-title">Recent Contacts</div>
                <div id="dh-contacts"></div>
            </div>
        </div>`;

        // Replace wrapper contents
        $(wrapper).empty();
        $(wrapper).html(html);

        renderContacts(document.getElementById("dh-contacts"));
    }

    // ── Hook into the desk page ───────────────────────────────────────────
    frappe.pages["desktop"].on_page_load = function (wrapper) {
        frappe.pages["desktop"]._dh_rendered = false;
        renderHome(wrapper);
        frappe.pages["desktop"]._dh_rendered = true;
    };

    frappe.pages["desktop"].on_page_show = function (wrapper) {
        // No-op: DOM is preserved by Frappe; no re-render needed on back/forward.
    };

})();
