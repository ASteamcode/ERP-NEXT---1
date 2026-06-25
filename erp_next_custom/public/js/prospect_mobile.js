// prospect_mobile.js — Mobile list view for Prospects (THE MESH mobile unit)
"use strict";

window.PM = (() => {

    // ── Field layout for bottom sheet ─────────────────────────────────────────
    const SHEET_TABS = [
        { label: "Profile", fields: [
            { key: "owner_name",  label: "Owner",          ff: null          },
            { key: "role",        label: "Role",            ff: "custom_position"       },
            { key: "status",      label: "Status",          ff: "custom_prospect_status", type: "status" },
            { key: "mobile",      label: "Mobile",          ff: "custom_mobile",  type: "phone" },
            { key: "email",       label: "Email",           ff: "custom_email",   type: "email" },
        ]},
        { label: "Site", fields: [
            { key: "city",    label: "Location",  ff: "custom_site_location" },
            { key: "maps",    label: "Maps URL",  ff: "custom_maps_url",  type: "url"  },
        ]},
        { label: "Scope", fields: [
            { key: "pstatus", label: "Proj. Status",  ff: "custom_project_status"  },
            { key: "pstart",  label: "Start Date",    ff: "custom_project_start",  type: "date" },
            { key: "floors",  label: "Floors",        ff: "custom_floors",         type: "num"  },
            { key: "area",    label: "Area (sqm)",    ff: "custom_area",           type: "num"  },
            { key: "scaffold",label: "Scaffold",      ff: "custom_scaffold_type"   },
            { key: "ptype",   label: "Proj. Type",    ff: "custom_project_type"    },
        ]},
        { label: "Team", fields: [
            { key: "architect",  label: "Architect",       ff: "custom_architect"      },
            { key: "proj_owner", label: "Proj. Owner",     ff: "custom_project_owner"  },
            { key: "site_eng",   label: "Site Engineer",   ff: "custom_site_engineer"  },
            { key: "workers",    label: "Workers",         ff: "custom_workers_count", type: "num" },
            { key: "safety",     label: "Safety Officer",  ff: "custom_safety_officer" },
            { key: "contract",   label: "Contract",        ff: "custom_contract_value" },
        ]},
        { label: "Social", fields: [
            { key: "instagram", label: "Instagram", ff: "custom_instagram", type: "url" },
            { key: "linkedin",  label: "LinkedIn",  ff: "custom_linkedin",  type: "url" },
            { key: "facebook",  label: "Facebook",  ff: "custom_facebook",  type: "url" },
            { key: "telegram",  label: "Telegram",  ff: "custom_telegram",  type: "url" },
            { key: "website",   label: "Website",   ff: "website",          type: "url" },
        ]},
    ];

    const STATUS_MAP = {
        "Lead":           "pm-badge-blue",
        "In Discussion":  "pm-badge-amber",
        "Contacted":      "pm-badge-gray",
        "Converted":      "pm-badge-green",
        "Lost":           "pm-badge-red",
    };

    // ── SVG icons ─────────────────────────────────────────────────────────────
    const SVG = {
        call:  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.42 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        wa:    `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`,
        email: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>`,
        maps:  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        search:`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        plus:  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
        close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        extlnk:   `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
        instagram:`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
        linkedin: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
        facebook: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
        telegram: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>`,
        website:  `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    };

    // ── State ─────────────────────────────────────────────────────────────────
    let _host    = null;
    let _rows    = [];
    let _opts    = {};
    let _filter  = "";
    let _status  = "";
    let _sheetRow = null;
    let _sheetTab = 0;

    // Active swipe state
    let _swipeEl    = null;
    let _swipeInner = null;
    let _swipeBg    = null;
    let _swipeStartX = 0;
    let _swipeStartY = 0;
    let _swipeOpen   = false;

    // ── Public mount ──────────────────────────────────────────────────────────
    function mount(host, rows, opts) {
        _host = host;
        _rows = rows;
        _opts = opts;
        _filter = "";
        _status = "";
        _sheetRow = null;
        _render();
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function _render() {
        const filtered = _rows.filter(r => {
            if (_status && r.status !== _status) return false;
            if (!_filter) return true;
            const q = _filter.toLowerCase();
            return [r.first, r.last, r.company, r.email, r.mobile, r.city]
                .some(v => v && v.toLowerCase().includes(q));
        });

        const statuses = [...new Set(_rows.map(r => r.status).filter(Boolean))];

        _host.innerHTML = `
            <div class="pm-shell">
                <div class="pm-topbar">
                    <div class="pm-search-wrap">
                        <span class="pm-search-icon">${SVG.search}</span>
                        <input class="pm-search-inp" type="search" placeholder="Search prospects…" value="${_escHtml(_filter)}">
                    </div>
                    <button class="pm-add-btn" title="Add prospect">${SVG.plus}</button>
                </div>
                <div class="pm-filters">
                    <button class="pm-filter-pill${!_status ? " active" : ""}" data-status="">All <span class="pm-filter-count">${_rows.length}</span></button>
                    ${statuses.map(s => {
                        const cnt = _rows.filter(r => r.status === s).length;
                        return `<button class="pm-filter-pill${_status === s ? " active" : ""}" data-status="${_escHtml(s)}">${_escHtml(s)} <span class="pm-filter-count">${cnt}</span></button>`;
                    }).join("")}
                </div>
                <div class="pm-ptr-wrap">
                    <div class="pm-ptr-indicator">↓ Pull to refresh</div>
                </div>
                <div class="pm-list">
                    ${filtered.length ? filtered.map(_renderRow).join("") : `<div class="pm-empty">No prospects found</div>`}
                </div>
            </div>
            <div class="pm-backdrop"></div>
            <div class="pm-sheet">
                <div class="pm-sheet-handle"></div>
                <div class="pm-sheet-head-wrap"></div>
                <div class="pm-sheet-tabs-wrap"></div>
                <div class="pm-sheet-body"></div>
            </div>`;

        _wire();
    }

    const SOCIAL_DEFS = [
        { key: "instagram", label: "Instagram", icon: "instagram", color: "#e1306c",
          href: v => /^https?:/.test(v) ? v : `https://instagram.com/${v.replace(/^@/,"")}` },
        { key: "facebook",  label: "Facebook",  icon: "facebook",  color: "#1877f2",
          href: v => /^https?:/.test(v) ? v : `https://facebook.com/${v}` },
        { key: "linkedin",  label: "LinkedIn",  icon: "linkedin",  color: "#0a66c2",
          href: v => /^https?:/.test(v) ? v : `https://linkedin.com/in/${v}` },
        { key: "telegram",  label: "Telegram",  icon: "telegram",  color: "#26a5e4",
          href: v => /^https?:/.test(v) ? v : `https://t.me/${v.replace(/^@/,"")}` },
        { key: "website",   label: "Website",   icon: "website",   color: "#374151",
          href: v => /^https?:/.test(v) ? v : `https://${v}` },
    ];

    function _renderRow(row) {
        const name  = [row.title, row.first, row.last].filter(Boolean).join(" ") || row.company || "—";
        const badge = row.status ? `<span class="pm-badge ${STATUS_MAP[row.status] || "pm-badge-gray"}">${_escHtml(row.status)}</span>` : "";
        const initials = (row.owner_initials || (row.company || "??").substring(0, 2)).toUpperCase();
        const hasCall  = !!row.mobile;
        const hasMaps  = !!row.maps;

        return `<div class="pm-row" data-name="${_escHtml(row.name)}">
            <div class="pm-swipe-bg">
                <button class="pm-swipe-del" data-name="${_escHtml(row.name)}">${SVG.trash}<span>Delete</span></button>
            </div>
            <div class="pm-row-inner">
                <div class="pm-row-left">
                    <div class="pm-avatar">${_escHtml(initials)}</div>
                    <div class="pm-row-info">
                        <div class="pm-row-name">${_escHtml(name)}</div>
                        <div class="pm-row-sub">${_escHtml(row.company || "")}${row.company && row.status ? " · " : ""}${badge}</div>
                    </div>
                </div>
                <div class="pm-row-actions">
                    <button class="pm-act-btn pm-act-call" data-mobile="${_escHtml(row.mobile || "")}" title="Call" ${!hasCall ? "disabled" : ""}>${SVG.call}</button>
                    <button class="pm-act-btn pm-act-wa"   data-mobile="${_escHtml(row.mobile || "")}" title="WhatsApp" ${!hasCall ? "disabled" : ""}>${SVG.wa}</button>
                    <button class="pm-act-btn pm-act-email" data-email="${_escHtml(row.email || "")}" data-name="${_escHtml(row.name)}" title="Email">${SVG.email}</button>
                    <button class="pm-act-btn pm-act-maps"  data-maps="${_escHtml(row.maps || "")}" data-company="${_escHtml(row.company || "")}" title="Maps" ${!hasMaps && !row.company ? "disabled" : ""}>${SVG.maps}</button>
                </div>
            </div>
        </div>`;
    }

    // ── Wire events ───────────────────────────────────────────────────────────
    function _wire() {
        const shell    = _host.querySelector(".pm-shell");
        const list     = _host.querySelector(".pm-list");
        const backdrop = _host.querySelector(".pm-backdrop");
        const sheet    = _host.querySelector(".pm-sheet");

        // Search
        _host.querySelector(".pm-search-inp").addEventListener("input", function () {
            _filter = this.value.trim();
            _renderList();
        });

        // Filter pills
        _host.querySelector(".pm-filters").addEventListener("click", e => {
            const pill = e.target.closest(".pm-filter-pill");
            if (!pill) return;
            _status = pill.dataset.status;
            _host.querySelectorAll(".pm-filter-pill").forEach(p => p.classList.toggle("active", p.dataset.status === _status));
            _renderList();
        });

        // Row tap → open sheet
        list.addEventListener("click", e => {
            if (e.target.closest(".pm-act-btn")) return;
            if (e.target.closest(".pm-swipe-del")) return;
            const row = e.target.closest(".pm-row");
            if (!row) return;
            const data = _rows.find(r => r.name === row.dataset.name);
            if (data) _openSheet(data);
        });

        // Action buttons
        list.addEventListener("click", e => {
            const btn = e.target.closest(".pm-act-btn");
            if (!btn) return;
            e.stopPropagation();
            if (btn.classList.contains("pm-act-call")) {
                window.location.href = "tel:" + btn.dataset.mobile;
            } else if (btn.classList.contains("pm-act-wa")) {
                const num = btn.dataset.mobile.replace(/\D/g, "");
                window.open("https://wa.me/" + num, "_blank");
            } else if (btn.classList.contains("pm-act-email")) {
                if (window.PG && btn.dataset.email) {
                    const row = _rows.find(r => r.name === btn.dataset.name);
                    // Reuse PG compose if available
                    window.open("mailto:" + btn.dataset.email, "_blank");
                } else {
                    window.open("mailto:" + btn.dataset.email, "_blank");
                }
            } else if (btn.classList.contains("pm-act-maps")) {
                const url = btn.dataset.maps || ("https://maps.google.com/?q=" + encodeURIComponent(btn.dataset.company));
                window.open(url, "_blank");
            }
        });

        // Swipe delete
        list.addEventListener("click", e => {
            const btn = e.target.closest(".pm-swipe-del");
            if (!btn) return;
            frappe.confirm(`Delete this prospect? Cannot be undone.`, () => {
                frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: "Prospect", name: btn.dataset.name },
                    callback() {
                        _rows = _rows.filter(r => r.name !== btn.dataset.name);
                        _renderList();
                        frappe.show_alert({ message: "Sales CRM deleted", indicator: "orange" }, 3);
                    },
                });
            });
        });

        // Backdrop → close sheet
        backdrop.addEventListener("click", _closeSheet);

        // Sheet drag to close
        _wireSheetDrag(sheet);

        // Swipe on rows
        _wireSwipe(list);

        // Pull to refresh
        _wirePullToRefresh(list);

        // Add button → add new
        _host.querySelector(".pm-add-btn").addEventListener("click", _openAddDialog);
    }

    // ── Re-render list only (no full re-render) ───────────────────────────────
    function _renderList() {
        const list = _host.querySelector(".pm-list");
        const filtered = _rows.filter(r => {
            if (_status && r.status !== _status) return false;
            if (!_filter) return true;
            const q = _filter.toLowerCase();
            return [r.first, r.last, r.company, r.email, r.mobile, r.city]
                .some(v => v && v.toLowerCase().includes(q));
        });
        list.innerHTML = filtered.length
            ? filtered.map(_renderRow).join("")
            : `<div class="pm-empty">No prospects found</div>`;

        // Update pill counts
        _host.querySelectorAll(".pm-filter-pill").forEach(p => {
            const s = p.dataset.status;
            const cnt = s ? _rows.filter(r => r.status === s).length : _rows.length;
            const countEl = p.querySelector(".pm-filter-count");
            if (countEl) countEl.textContent = cnt;
        });
    }

    // ── Bottom sheet ──────────────────────────────────────────────────────────
    function _openSheet(row) {
        _sheetRow = row;
        _sheetTab = 0;
        const backdrop = _host.querySelector(".pm-backdrop");
        const sheet    = _host.querySelector(".pm-sheet");

        _renderSheetContent(row, _sheetTab);

        requestAnimationFrame(() => {
            backdrop.classList.add("vis");
            sheet.classList.add("vis");
        });

        document.body.style.overflow = "hidden";
    }

    function _closeSheet() {
        const backdrop = _host.querySelector(".pm-backdrop");
        const sheet    = _host.querySelector(".pm-sheet");
        backdrop.classList.remove("vis");
        sheet.classList.remove("vis");
        document.body.style.overflow = "";
        _sheetRow = null;
    }

    function _renderSheetContent(row, tabIdx) {
        const sheet = _host.querySelector(".pm-sheet");
        const fullName = [row.title, row.first, row.last].filter(Boolean).join(" ") || "—";
        const badge = row.status ? `<span class="pm-badge ${STATUS_MAP[row.status] || "pm-badge-gray"}">${_escHtml(row.status)}</span>` : "";

        sheet.querySelector(".pm-sheet-head-wrap").innerHTML = `
            <div class="pm-sheet-head">
                <div class="pm-sheet-head-row">
                    <div>
                        <div class="pm-sheet-name">${_escHtml(fullName)}</div>
                        <div class="pm-sheet-company">${_escHtml(row.company || "")} ${badge}</div>
                    </div>
                    <button class="pm-sheet-close">${SVG.close}</button>
                </div>
                <div class="pm-sheet-head-actions">
                    <button class="pm-sheet-act pm-act-call" data-mobile="${_escHtml(row.mobile || "")}" ${!row.mobile ? "disabled" : ""}>${SVG.call} Call</button>
                    <button class="pm-sheet-act pm-act-wa"   data-mobile="${_escHtml(row.mobile || "")}" ${!row.mobile ? "disabled" : ""}>${SVG.wa} WhatsApp</button>
                    <button class="pm-sheet-act pm-act-email" data-email="${_escHtml(row.email || "")}">${SVG.email} Email</button>
                    <button class="pm-sheet-act pm-act-maps"  data-maps="${_escHtml(row.maps || "")}" data-company="${_escHtml(row.company || "")}" ${!row.maps && !row.company ? "disabled" : ""}>${SVG.maps} Maps</button>
                    ${SOCIAL_DEFS.filter(s => !!row[s.key]).map(s =>
                        `<a class="pm-sheet-act pm-sheet-social" href="${_escHtml(s.href(row[s.key]))}" target="_blank" title="${s.label}" style="color:${s.color};border-color:${s.color}22">${SVG[s.icon]} ${s.label}</a>`
                    ).join("")}
                </div>
            </div>`;

        sheet.querySelector(".pm-sheet-tabs-wrap").innerHTML = `
            <div class="pm-sheet-tabs">
                ${SHEET_TABS.map((t, i) =>
                    `<button class="pm-sheet-tab${i === tabIdx ? " active" : ""}" data-tab="${i}">${t.label}</button>`
                ).join("")}
            </div>`;

        const tab = SHEET_TABS[tabIdx];
        sheet.querySelector(".pm-sheet-body").innerHTML = tab.fields.map(f => {
            const val  = row[f.key];
            const disp = val ? String(val) : "";
            const editable = !!f.ff;
            let valueHtml;
            if (!disp) {
                valueHtml = `<span class="pm-field-empty">—</span>`;
            } else if (f.type === "url") {
                valueHtml = `<a class="pm-field-link" href="${/^https?:\/\//.test(disp) ? disp : "https://" + disp}" target="_blank">${_escHtml(disp)} ${SVG.extlnk}</a>`;
            } else if (f.type === "email") {
                valueHtml = `<a class="pm-field-link" href="mailto:${_escHtml(disp)}">${_escHtml(disp)}</a>`;
            } else if (f.type === "phone") {
                valueHtml = `<a class="pm-field-link" href="tel:${_escHtml(disp)}">${_escHtml(disp)}</a>`;
            } else {
                valueHtml = `<span>${_escHtml(disp)}</span>`;
            }
            return `<div class="pm-field-row" data-key="${f.key}" data-ff="${f.ff || ""}" data-type="${f.type || "text"}">
                <span class="pm-field-label">${f.label}</span>
                <span class="pm-field-val${editable ? " editable" : ""}" data-raw="${_escHtml(disp)}">${valueHtml}</span>
            </div>`;
        }).join("");

        // Wire sheet events
        sheet.querySelector(".pm-sheet-close")?.addEventListener("click", _closeSheet);

        sheet.querySelector(".pm-sheet-tabs").addEventListener("click", e => {
            const tab = e.target.closest(".pm-sheet-tab");
            if (!tab) return;
            _sheetTab = parseInt(tab.dataset.tab);
            _renderSheetContent(_sheetRow, _sheetTab);
        });

        sheet.querySelector(".pm-sheet-head-actions").addEventListener("click", e => {
            const btn = e.target.closest(".pm-sheet-act");
            if (!btn) return;
            if (btn.classList.contains("pm-act-call"))  window.location.href = "tel:" + btn.dataset.mobile;
            else if (btn.classList.contains("pm-act-wa"))    window.open("https://wa.me/" + btn.dataset.mobile.replace(/\D/g, ""), "_blank");
            else if (btn.classList.contains("pm-act-email")) window.open("mailto:" + btn.dataset.email, "_blank");
            else if (btn.classList.contains("pm-act-maps")) {
                const url = btn.dataset.maps || ("https://maps.google.com/?q=" + encodeURIComponent(btn.dataset.company));
                window.open(url, "_blank");
            }
        });

        // Inline edit on field tap
        if (_opts.onEdit) {
            sheet.querySelector(".pm-sheet-body").addEventListener("click", e => {
                const valEl = e.target.closest(".pm-field-val.editable");
                if (!valEl || valEl.querySelector(".pm-field-input")) return;
                const row_ = valEl.closest(".pm-field-row");
                const ff   = row_.dataset.ff;
                const type = row_.dataset.type;
                const key  = row_.dataset.key;
                const cur  = valEl.dataset.raw;

                valEl.innerHTML = `<input class="pm-field-input" type="${type === "num" ? "number" : type === "date" ? "date" : "text"}" value="${_escHtml(cur)}">`;
                const inp = valEl.querySelector(".pm-field-input");
                inp.focus(); inp.select();

                const _commit = () => {
                    const newVal = inp.value.trim();
                    valEl.dataset.raw = newVal;
                    // Update local data
                    if (_sheetRow) _sheetRow[key] = newVal;
                    const rowObj = _rows.find(r => r.name === _sheetRow?.name);
                    if (rowObj) rowObj[key] = newVal;
                    // Re-render field value
                    _renderSheetContent(_sheetRow, _sheetTab);
                    if (newVal !== cur && ff && _sheetRow) _opts.onEdit(_sheetRow.name, ff, newVal);
                    // Refresh the list row card
                    _refreshRowCard(_sheetRow);
                };
                inp.addEventListener("blur", _commit);
                inp.addEventListener("keydown", e => {
                    if (e.key === "Enter")  { e.preventDefault(); _commit(); }
                    if (e.key === "Escape") { _renderSheetContent(_sheetRow, _sheetTab); }
                });
            });
        }
    }

    // Refresh a single row card without full re-render
    function _refreshRowCard(row) {
        const el = _host.querySelector(`.pm-row[data-name="${CSS.escape(row.name)}"]`);
        if (!el) return;
        const tmp = document.createElement("div");
        tmp.innerHTML = _renderRow(row);
        const newRow = tmp.firstElementChild;
        el.replaceWith(newRow);
    }

    // ── Sheet drag-to-close ───────────────────────────────────────────────────
    function _wireSheetDrag(sheet) {
        let startY = 0, dragging = false;
        const handle = sheet.querySelector(".pm-sheet-handle");
        handle.addEventListener("touchstart", e => { startY = e.touches[0].clientY; dragging = true; sheet.style.transition = "none"; }, { passive: true });
        document.addEventListener("touchmove", e => {
            if (!dragging) return;
            const dy = e.touches[0].clientY - startY;
            if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
        }, { passive: true });
        document.addEventListener("touchend", e => {
            if (!dragging) return;
            dragging = false;
            sheet.style.transition = "";
            const dy = e.changedTouches[0].clientY - startY;
            if (dy > 120) _closeSheet();
            else sheet.style.transform = "";
        });
    }

    // ── Row swipe-to-reveal delete ────────────────────────────────────────────
    function _wireSwipe(list) {
        list.addEventListener("touchstart", e => {
            const inner = e.target.closest(".pm-row-inner");
            if (!inner) return;
            const row = inner.closest(".pm-row");
            _swipeEl    = row;
            _swipeInner = inner;
            _swipeBg    = row.querySelector(".pm-swipe-bg");
            _swipeStartX = e.touches[0].clientX;
            _swipeStartY = e.touches[0].clientY;
            _swipeOpen   = false;
            inner.style.transition = "none";
        }, { passive: true });

        list.addEventListener("touchmove", e => {
            if (!_swipeInner) return;
            const dx = e.touches[0].clientX - _swipeStartX;
            const dy = Math.abs(e.touches[0].clientY - _swipeStartY);
            if (dy > 10 && Math.abs(dx) < dy) { _swipeInner = null; return; } // vertical scroll
            const shift = Math.max(-90, Math.min(0, dx));
            _swipeInner.style.transform = `translateX(${shift}px)`;
            if (_swipeBg) _swipeBg.style.width = Math.abs(shift) + "px";
        }, { passive: true });

        list.addEventListener("touchend", e => {
            if (!_swipeInner) return;
            const dx = e.changedTouches[0].clientX - _swipeStartX;
            _swipeInner.style.transition = "";
            if (dx < -60) {
                _swipeInner.style.transform = "translateX(-80px)";
                if (_swipeBg) _swipeBg.style.width = "80px";
                _swipeOpen = true;
            } else {
                _swipeInner.style.transform = "";
                if (_swipeBg) _swipeBg.style.width = "0";
                _swipeOpen = false;
            }
            _swipeInner = null;
        });

        // Tap anywhere else closes open swipe
        list.addEventListener("touchstart", e => {
            if (!_swipeEl || e.target.closest(".pm-swipe-del")) return;
            const row = e.target.closest(".pm-row");
            if (row !== _swipeEl) {
                const inner = _swipeEl.querySelector(".pm-row-inner");
                const bg    = _swipeEl.querySelector(".pm-swipe-bg");
                if (inner) { inner.style.transition = ""; inner.style.transform = ""; }
                if (bg) bg.style.width = "0";
                _swipeEl = null;
            }
        }, { passive: true });
    }

    // ── Pull to refresh ───────────────────────────────────────────────────────
    function _wirePullToRefresh(list) {
        const indicator = _host.querySelector(".pm-ptr-indicator");
        let startY = 0, pulling = false;

        list.addEventListener("touchstart", e => {
            if (list.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
        }, { passive: true });

        list.addEventListener("touchmove", e => {
            if (!pulling) return;
            const dy = e.touches[0].clientY - startY;
            if (dy > 10) indicator.style.display = "block";
            if (dy > 60) indicator.textContent = "↑ Release to refresh";
            else indicator.textContent = "↓ Pull to refresh";
        }, { passive: true });

        list.addEventListener("touchend", e => {
            if (!pulling) return;
            pulling = false;
            const dy = e.changedTouches[0].clientY - startY;
            if (dy > 60 && _opts.onReload) {
                indicator.textContent = "Refreshing…";
                _opts.onReload();
            } else {
                indicator.style.display = "none";
            }
        });
    }

    // ── Add new prospect (FAB) ────────────────────────────────────────────────
    function _openAddDialog() {
        const d = new frappe.ui.Dialog({
            title: "Add Sales CRM",
            fields: [
                { label: "First Name", fieldname: "custom_first_name", fieldtype: "Data" },
                { label: "Last Name",  fieldname: "custom_last_name",  fieldtype: "Data" },
                { label: "Company",    fieldname: "company_name",       fieldtype: "Data", reqd: 1 },
                { label: "Mobile",     fieldname: "custom_mobile",      fieldtype: "Data" },
                { label: "Email",      fieldname: "custom_email",       fieldtype: "Data" },
                { label: "Status",     fieldname: "custom_prospect_status", fieldtype: "Select",
                  options: "Lead\nIn Discussion\nContacted\nConverted\nLost", default: "Lead" },
            ],
            primary_action_label: "Create",
            primary_action(vals) {
                d.hide();
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: Object.assign({ doctype: "Prospect" }, vals) },
                    callback(r) {
                        frappe.show_alert({ message: "Sales CRM created", indicator: "green" }, 3);
                        if (_opts.onReload) _opts.onReload();
                    },
                });
            },
        });
        d.show();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _escHtml(s) {
        return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    // ── CSS injection ─────────────────────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById("pm-styles")) return;
        const s = Object.assign(document.createElement("style"), { id: "pm-styles" });
        s.textContent = `
/* ── Shell ── */
.pm-shell{display:flex;flex-direction:column;height:100%;background:#f8fafc;overflow:hidden;}

/* ── Topbar ── */
.pm-topbar{padding:10px 14px 8px;background:#fff;border-bottom:1.5px solid #e8e8f0;display:flex;align-items:center;gap:8px;}
.pm-search-wrap{position:relative;display:flex;align-items:center;flex:1;}
.pm-search-icon{position:absolute;left:11px;color:#94a3b8;pointer-events:none;display:flex;}
.pm-search-inp{width:100%;height:38px;border:1.5px solid #e8e8f0;border-radius:99px;padding:0 14px 0 34px;font-size:13px;background:#f8fafc;outline:none;-webkit-appearance:none;color:#111827;}
.pm-search-inp:focus{border-color:#bfdbfe;background:#fff;}
.pm-add-btn{flex:none;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(37,99,235,.35);-webkit-tap-highlight-color:transparent;transition:transform .12s;}
.pm-add-btn:active{transform:scale(.9);}

/* ── Filters ── */
.pm-filters{display:flex;gap:6px;padding:10px 14px;background:#fff;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-bottom:1.5px solid #e8e8f0;}
.pm-filters::-webkit-scrollbar{display:none;}
.pm-filter-pill{flex:none;height:28px;padding:0 11px;border:1.5px solid #e8e8f0;border-radius:99px;font-size:11.5px;font-weight:600;color:#64748b;background:#fff;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;-webkit-tap-highlight-color:transparent;}
.pm-filter-pill.active{background:#eff6ff;border-color:#bfdbfe;color:#2563eb;}
.pm-filter-count{font-size:10px;font-weight:700;background:rgba(0,0,0,.07);border-radius:99px;padding:1px 5px;}
.pm-filter-pill.active .pm-filter-count{background:rgba(37,99,235,.15);color:#1e40af;}

/* ── Pull-to-refresh ── */
.pm-ptr-wrap{overflow:hidden;background:#fff;}
.pm-ptr-indicator{display:none;padding:10px;text-align:center;font-size:12px;color:#64748b;background:#fff;}

/* ── List ── */
.pm-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.pm-empty{padding:48px 24px;text-align:center;color:#9ca3af;font-size:13px;}

/* ── Row ── */
.pm-row{background:#fff;border-bottom:1px solid #f1f5f9;position:relative;overflow:hidden;}
.pm-row-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;gap:10px;background:#fff;position:relative;z-index:1;}
.pm-row-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.pm-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1e3a8a,#2d52a8);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;letter-spacing:.02em;}
.pm-row-info{flex:1;min-width:0;}
.pm-row-name{font-size:14px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;}
.pm-row-sub{font-size:12px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;}

/* ── Action buttons (row) ── */
.pm-row-actions{display:flex;gap:5px;flex:none;}
.pm-act-btn{width:34px;height:34px;border-radius:50%;border:1px solid #e8e8f0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .12s,transform .1s;}
.pm-act-btn:active{background:#f1f5f9;transform:scale(.93);}
.pm-act-btn:disabled{opacity:.32;pointer-events:none;}
.pm-act-call {color:#16a34a;}
.pm-act-wa   {color:#16a34a;}
.pm-act-email{color:#2563eb;}
.pm-act-maps {color:#d97706;}

/* ── Swipe-to-delete ── */
.pm-swipe-bg{position:absolute;right:0;top:0;bottom:0;width:0;background:#ef4444;display:flex;align-items:center;justify-content:flex-end;overflow:hidden;transition:width .18s;}
.pm-swipe-del{width:80px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:600;gap:4px;flex:none;border:none;background:none;cursor:pointer;padding:0;}

/* ── Badges ── */
.pm-badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:650;white-space:nowrap;}
.pm-badge-blue  {background:#eff6ff;color:#2563eb;}
.pm-badge-amber {background:#fffbeb;color:#d97706;}
.pm-badge-gray  {background:#f3f4f6;color:#6b7280;}
.pm-badge-green {background:#f0fdf4;color:#16a34a;}
.pm-badge-red   {background:#fff1f2;color:#e11d48;}

/* ── Backdrop ── */
.pm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:300;opacity:0;pointer-events:none;transition:opacity .25s;}
.pm-backdrop.vis{opacity:1;pointer-events:all;}

/* ── Bottom sheet ── */
.pm-sheet{position:fixed;left:0;right:0;bottom:0;z-index:301;background:#fff;border-radius:18px 18px 0 0;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,0,.2,1);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 -4px 32px rgba(0,0,0,.12);}
.pm-sheet.vis{transform:translateY(0);}
.pm-sheet-handle{width:38px;height:4px;border-radius:99px;background:#e2e8f0;margin:10px auto 0;flex:none;cursor:grab;}
.pm-sheet-head{padding:12px 18px 10px;flex:none;}
.pm-sheet-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.pm-sheet-name{font-size:19px;font-weight:700;color:#111827;line-height:1.25;}
.pm-sheet-company{font-size:13px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:6px;}
.pm-sheet-close{width:30px;height:30px;border-radius:50%;border:1px solid #e8e8f0;background:#fff;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;margin-top:2px;-webkit-tap-highlight-color:transparent;transition:background .12s,color .12s;}
.pm-sheet-close:hover,.pm-sheet-close:active{background:#fee2e2;color:#dc2626;}
.pm-sheet-head-actions{display:flex;gap:8px;margin-top:12px;overflow-x:auto;scrollbar-width:none;}
.pm-sheet-head-actions::-webkit-scrollbar{display:none;}
.pm-sheet-act{flex:none;height:32px;padding:0 13px;border:1.5px solid #e8e8f0;border-radius:99px;background:#fff;font-size:12px;font-weight:500;color:#374151;display:inline-flex;align-items:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.pm-sheet-act:active{background:#f8fafc;}
.pm-sheet-act.pm-act-call,.pm-sheet-act.pm-act-wa{color:#16a34a;border-color:#bbf7d0;}
.pm-sheet-act.pm-act-email{color:#2563eb;border-color:#bfdbfe;}
.pm-sheet-act.pm-act-maps{color:#d97706;border-color:#fde68a;}
.pm-sheet-act:disabled{opacity:.32;pointer-events:none;}

/* ── Sheet tabs ── */
.pm-sheet-tabs{display:flex;gap:0;padding:0 18px;border-bottom:1.5px solid #e8e8f0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex:none;}
.pm-sheet-tabs::-webkit-scrollbar{display:none;}
.pm-sheet-tab{flex:none;padding:8px 12px;font-size:12px;font-weight:600;color:#64748b;border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;transition:color .12s,border-color .12s;-webkit-tap-highlight-color:transparent;}
.pm-sheet-tab.active{color:#2563eb;border-bottom-color:#2563eb;}

/* ── Sheet body / fields ── */
.pm-sheet-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 18px 48px;}
.pm-field-row{display:flex;align-items:flex-start;justify-content:space-between;padding:11px 0;border-bottom:1px solid #f1f5f9;gap:16px;}
.pm-field-row:last-child{border-bottom:none;}
.pm-field-label{font-size:11px;font-weight:650;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;flex:none;width:100px;padding-top:2px;}
.pm-field-val{font-size:13px;color:#374151;flex:1;text-align:right;word-break:break-word;line-height:1.4;}
.pm-field-empty{color:#cbd5e1;}
.pm-field-val.editable{cursor:pointer;padding:2px 6px;border-radius:6px;margin:-2px -6px;}
.pm-field-val.editable:active{background:#f1f5f9;}
.pm-field-input{width:100%;border:1.5px solid #2563eb;border-radius:6px;padding:4px 8px;font-size:13px;text-align:right;outline:none;font-family:inherit;-webkit-appearance:none;}
.pm-field-link{color:#2563eb;text-decoration:none;display:inline-flex;align-items:center;gap:3px;}
`;
        document.head.appendChild(s);
    }

    _injectStyles();
    return { mount };
})();
