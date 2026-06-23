/**
 * grid_core.js — universal spreadsheet-grid engine
 * Loaded globally via app_include_js. Exposes window.GL.
 *
 * ── Design tokens ──────────────────────────────────────────────────────────
 * All visual constants live here. Change one var → change the whole app:
 *   --erpnx-accent        button/focus/link colour
 *   --erpnx-grid-radius   outer grid border-radius
 *   --erpnx-cell-radius   per-cell / input border-radius
 *   --erpnx-border-w      grid line weight
 *   --erpnx-font          grid cell font-size
 *   --erpnx-cell-h        minimum cell height
 *
 * ── What every list-view gets for free ─────────────────────────────────────
 *   Row hover + edit-mode highlight  │  Column resize + persistence
 *   Click-to-edit text/email/tel/url │  Date picker edit
 *   Link-field autocomplete dropdown │  Select (dropdown) change-save
 *   Delete row (with confirm)        │  Add row button
 *   Fast save with in-flight guard   │  Outside-click clears edit state
 *   Avatar cell + typeahead          │  Maps URL cell + toggle
 *   Textarea / area cell             │  Attach badge + dialog (w/ upload)
 *   Drawing button (frappe_drawing)  │  Measure/MTO button + dialog
 *   Link-name lazy fetch + repaint   │  Attach-count cache
 *   Upsert helpers (Emp/User/Co)     │  Suppress native list auto-refresh
 */
(function () {
    "use strict";

    // ── Style version — bump when BASE_CSS changes ────────────────────────────
    const STYLE_VERSION = "gl-v16";

    // ── SVG icon library ──────────────────────────────────────────────────────
    const SVG = {
        paperclip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
        trash:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
        external:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
        del:       `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        map:       `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        pen:       `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        ruler:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`,
        upload:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        file:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    };

    // ── CSS injection ──────────────────────────────────────────────────────────
    function injectBaseStyles() {
        const existing = document.getElementById("gl-base-styles");
        if (existing?.dataset.v === STYLE_VERSION) return;
        existing?.remove();
        const s = document.createElement("style");
        s.id = "gl-base-styles";
        s.dataset.v = STYLE_VERSION;
        s.textContent = BASE_CSS;
        document.head.appendChild(s);
    }

    function injectDoctypeHide(doctype) {
        const id = `gl-hide-${doctype.replace(/\s+/g, "-").toLowerCase()}`;
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
            [data-doctype="${doctype}"] .result-list,
            [data-doctype="${doctype}"] .list-row-head,
            [data-doctype="${doctype}"] .list-row-container,
            [data-doctype="${doctype}"] .list-row,
            [data-doctype="${doctype}"] .list-headers,
            [data-doctype="${doctype}"] .frappe-list .list-row-head,
            [data-doctype="${doctype}"] .no-result { display: none !important; }
            [data-doctype="${doctype}"] .result,
            [data-doctype="${doctype}"] .frappe-list .result {
                overflow: visible !important; height: auto !important; max-height: none !important;
            }
        `;
        document.head.appendChild(s);
    }

    // ── Listview helpers ───────────────────────────────────────────────────────
    function suppressRefresh(listview) {
        if (listview.auto_refresh) {
            try { clearInterval(listview.auto_refresh); } catch { /* */ }
            listview.auto_refresh = null;
        }
        if (typeof listview.setup_auto_refresh === "function") listview.setup_auto_refresh = () => {};
        try { frappe.realtime.off("list_update"); } catch { /* */ }
        if (listview.on_doctype_update) listview.on_doctype_update = () => {};
    }

    function hideNative(listview) {
        const $r = listview.$result;
        if ($r) $r.find(".result-list,.list-row-head,.list-row-container,.list-row,.no-result").hide();
        listview.$page.find(".list-row-head,.list-headers").hide();
    }

    function bootstrap(listview, opts = {}) {
        injectBaseStyles();
        injectDoctypeHide(opts.doctype || "");

        const $result = listview.$result || listview.$page.find(".list-result");
        if (!$result.length) return null;

        let host = $result.find(".gl-host")[0];
        if (!host) {
            host = document.createElement("div");
            host.className = `gl-host${opts.hostClass ? " " + opts.hostClass : ""}`;
            $result.empty();
            $result.append(host);
        }

        listview.$page.find(".list-filters-area").hide();
        return host;
    }

    // ── Grid template ──────────────────────────────────────────────────────────
    function gridTpl(cols, colWidths) {
        const tracks = cols.map(c => {
            if (colWidths[c.field]) return `${colWidths[c.field]}px`;
            if (c.fr != null)       return `${c.fr}fr`;
            return `${c.width || 120}px`;
        });
        return ["42px", ...tracks].join(" ");
    }

    // ── Rownum cell HTML ───────────────────────────────────────────────────────
    function rnCell(doc, ri) {
        return (
            `<div class="gl-cell gl-rn" data-name="${doc.name}" data-row="${ri}">` +
            `<span class="gl-rn-num">${ri + 1}</span>` +
            `</div>`
        );
    }

    function rnHeader() {
        return `<div class="gl-cell gl-hdr gl-rn">#</div>`;
    }

    // ── Cell renderers ─────────────────────────────────────────────────────────

    function renderText(col, name, raw, inputType) {
        const v = frappe.utils.escape_html(raw || "");
        return (
            `<span class="gl-d" data-name="${name}" data-field="${col.field}" ` +
            `data-type="${inputType || "text"}" tabindex="0" title="${v}">` +
            (raw ? v : `<span class="gl-ph">—</span>`) +
            `</span>`
        );
    }

    function renderLink(col, name, raw) {
        const v = frappe.utils.escape_html(raw || "");
        return (
            `<span class="gl-d gl-d-link" data-name="${name}" data-field="${col.field}" ` +
            `data-type="link" data-link-doctype="${col.link_doctype || ""}" ` +
            `tabindex="0" title="${v}">` +
            (raw ? `<span class="gl-link-val">${v}</span>` : `<span class="gl-ph">—</span>`) +
            `</span>`
        );
    }

    function renderUrl(col, name, raw) {
        const v = frappe.utils.escape_html(raw || "");
        if (raw) return `<span class="gl-d gl-d-url" data-name="${name}" data-field="${col.field}" tabindex="0" title="${v}">${v}</span>`;
        return `<span class="gl-d" data-name="${name}" data-field="${col.field}" data-type="url" tabindex="0"><span class="gl-ph">—</span></span>`;
    }

    function renderSelect(col, name, raw) {
        const opts = (col.options || []).map(o =>
            `<option value="${frappe.utils.escape_html(o)}"${o === raw ? " selected" : ""}>${o ? __(o) : "&nbsp;"}</option>`
        ).join("");
        return `<select class="gl-sel" data-name="${name}" data-field="${col.field}">${opts}</select>`;
    }

    function renderDate(col, name, raw) {
        const fmt = raw ? frappe.datetime.str_to_user(raw) : "";
        return (
            `<span class="gl-d" data-name="${name}" data-field="${col.field}" ` +
            `data-type="date" tabindex="0">` +
            (fmt ? frappe.utils.escape_html(fmt) : `<span class="gl-ph">—</span>`) +
            `</span>`
        );
    }

    function renderStatus(raw, statusMeta) {
        const m = (statusMeta || {})[raw] || { color: "#6C757D", bg: "rgba(108,117,125,0.10)" };
        return (
            `<span class="gl-status-pill" style="color:${m.color};background:${m.bg}">` +
            `${frappe.utils.escape_html(raw || "—")}</span>`
        );
    }

    /** Compact datetime: "d/m/yy HH:MM" — read-only, no inline edit */
    function renderDatetime(name, raw) {
        let label = "—";
        if (raw) {
            try {
                const [datePart, timePart = "00:00:00"] = String(raw).split(" ");
                const [y, m, d] = datePart.split("-");
                const [hh, mm]  = timePart.split(":");
                label = `${parseInt(d)}/${parseInt(m)}/${y.slice(2)} ${hh}:${mm}`;
            } catch { label = raw; }
        }
        return `<span class="gl-datetime" title="${frappe.utils.escape_html(raw || "")}">${label}</span>`;
    }

    /**
     * Avatar: coloured circle + hidden autocomplete input.
     * col must have: link_doctype, link_namefield, variant? ("grey")
     * linkNames: makeNameCache() instance — resolved lazily.
     */
    function renderAvatar(col, name, raw, linkNames) {
        const display = raw
            ? (linkNames?.get(col.link_doctype, raw) || raw)
            : "";
        const initial  = display ? display.charAt(0).toUpperCase() : "?";
        const hue      = display
            ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
            : 210;
        const isGrey   = col.variant === "grey";
        const style    = isGrey ? "" : `style="--gl-av-h:${hue}"`;
        const cls      = isGrey ? "gl-avatar gl-avatar--grey" : "gl-avatar";
        const linkType = col.link_doctype || "User";
        const ph       = isGrey ? "employee…" : "user…";

        return (
            `<div class="gl-avatar-wrap">` +
            `<div class="${cls}" ${style} title="${frappe.utils.escape_html(display)}">${initial}</div>` +
            `<input type="text" class="gl-avatar-input" autocomplete="off"` +
            ` data-name="${name}" data-field="${col.field}" data-link="${linkType}"` +
            ` value="${frappe.utils.escape_html(display)}" placeholder="${ph}">` +
            `</div>`
        );
    }

    /** Maps URL cell: display text + edit-pen + map-open button */
    function renderMaps(col, name, raw) {
        const escaped = frappe.utils.escape_html(raw || "");
        const mapBtn  = raw
            ? `<a href="${escaped}" target="_blank" class="gl-icon-btn gl-map-open" title="${__("Open map")}">${SVG.map}</a>`
            : `<span class="gl-icon-btn gl-map-open gl-icon-btn--dim" title="${__("No URL")}">${SVG.map}</span>`;
        return (
            `<div class="gl-map-cell">` +
            `<span class="gl-map-display" title="${escaped}">${raw ? `<span class="gl-link-val">URL set</span>` : `<span class="gl-ph">No URL</span>`}</span>` +
            `<input type="text" class="gl-map-input" data-name="${name}" data-field="${col.field}"` +
            ` value="${escaped}" placeholder="Paste Google Maps URL…" style="display:none">` +
            `<button class="gl-icon-btn gl-map-pen" data-name="${name}" title="${__("Edit URL")}">${SVG.pen}</button>` +
            mapBtn +
            `</div>`
        );
    }

    /** Textarea (always-visible, autogrows) */
    function renderArea(col, name, raw) {
        return (
            `<textarea class="gl-area" data-name="${name}" data-field="${col.field}" ` +
            `rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`
        );
    }

    /** Attachment icon button with badge count */
    function renderAttachBtn(name, count) {
        const n     = count || 0;
        const badge = n ? `<span class="gl-badge">${n}</span>` : "";
        return `<button class="gl-icon-btn gl-attach-btn" data-name="${name}" title="${n} attachment(s)">${SVG.paperclip}${badge}</button>`;
    }

    /** Drawing button — delegates visuals to frappe_drawing.render_btn */
    function renderDrawingBtn(name, hasDrawing) {
        return typeof frappe_drawing !== "undefined"
            ? frappe_drawing.render_btn(name, hasDrawing)
            : `<button class="gl-icon-btn fd-draw-btn" data-name="${name}">${SVG.pen}</button>`;
    }

    /** Measurement / MTO button with badge */
    function renderMeasureBtn(name, hasMeasurements, count) {
        const n     = (hasMeasurements && count) ? count : (hasMeasurements ? "✓" : 0);
        const badge = n ? `<span class="gl-badge">${n}</span>` : "";
        return `<button class="gl-icon-btn gl-measure-btn" data-name="${name}" title="${__("Measurements")}">${SVG.ruler}${badge}</button>`;
    }

    /** Number input */
    function renderNumber(col, name, raw) {
        const v = (raw != null && raw !== "") ? raw : "";
        return (
            `<input type="number" class="gl-number" ` +
            `data-name="${name}" data-field="${col.field}" ` +
            `value="${v}" placeholder="—" step="any">`
        );
    }

    // ── State utilities ────────────────────────────────────────────────────────

    function editState($grid) {
        let current = null;
        return {
            set(name) {
                if (current === name) return;
                if (current) $grid.find(`.gl-cell[data-name="${current}"]`).removeClass("gl-editing gl-editing-first");
                current = name;
                if (name) {
                    const $c = $grid.find(`.gl-cell[data-name="${name}"]`);
                    $c.addClass("gl-editing");
                    $c.first().addClass("gl-editing-first");
                }
            },
            clear() { this.set(null); },
            get()   { return current; },
        };
    }

    /**
     * makeLinkNameCache — lazy fetch of displayable names for Link fields.
     * Usage:
     *   const lnc = GL.makeLinkNameCache();
     *   lnc.onResolve = () => rerender();
     *   // in render: const display = lnc.resolve("User", id, "full_name") || id;
     */
    function makeLinkNameCache() {
        const cache   = new Map();
        const pending = new Set();
        return {
            onResolve: null,
            get(doctype, id) {
                return cache.get(`${doctype}::${id}`) || null;
            },
            set(doctype, id, name) {
                cache.set(`${doctype}::${id}`, name);
            },
            /** Returns known name synchronously, or fetches + calls onResolve on land. */
            resolve(doctype, id, namefield) {
                if (!id) return "";
                const key = `${doctype}::${id}`;
                if (cache.has(key)) return cache.get(key);
                if (!pending.has(key)) {
                    pending.add(key);
                    frappe.db.get_value(doctype, id, namefield, r => {
                        pending.delete(key);
                        cache.set(key, r?.[namefield] || id);
                        this.onResolve?.();
                    });
                }
                return id; // show raw id until resolved
            },
        };
    }

    /**
     * makeColWidths — localStorage-backed column width map.
     * Usage:
     *   const cw = GL.makeColWidths("my_key");
     *   GL.bindColResize($grid, cols, cw.widths, getTpl, cw.save);
     *   const getTpl = () => GL.gridTpl(cols, cw.widths);
     */
    function makeColWidths(storageKey) {
        let widths = {};
        try {
            widths = Object.fromEntries(
                Object.entries(JSON.parse(localStorage.getItem(storageKey) || "{}"))
                    .filter(([, v]) => typeof v === "number")
            );
        } catch { /* noop */ }
        return {
            widths,
            save() {
                try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* noop */ }
            },
        };
    }

    /**
     * makeCountCache — generic integer cache keyed by doc name.
     * Used for attachment counts and measurement counts.
     */
    function makeCountCache() {
        const cache = new Map();
        return {
            get(name)        { return cache.get(name) ?? 0; },
            update(name, n)  { cache.set(name, n); },
            /** If raw is an Array, count it and cache; otherwise return cached value. */
            fromRaw(name, raw) {
                if (Array.isArray(raw)) { cache.set(name, raw.length); return raw.length; }
                return cache.get(name) ?? 0;
            },
        };
    }

    // ── Save / delete ──────────────────────────────────────────────────────────
    // Debounced batch saver: field changes for the same (doctype, name) that
    // arrive within 80 ms are coalesced into a single set_value request.
    const _GL_SAVE_BATCH = {};

    function fastSave(doctype, name, field, value) {
        const docKey = `${doctype}::${name}`;
        if (!_GL_SAVE_BATCH[docKey]) {
            _GL_SAVE_BATCH[docKey] = { fields: {}, cbs: [], timer: null };
        }
        const batch = _GL_SAVE_BATCH[docKey];
        batch.fields[field] = value;

        const p = new Promise((res, rej) => batch.cbs.push({ res, rej }));
        clearTimeout(batch.timer);
        batch.timer = setTimeout(() => {
            const { fields, cbs } = batch;
            delete _GL_SAVE_BATCH[docKey];
            frappe.db.set_value(doctype, name, fields)
                .then(r => cbs.forEach(c => c.res(r)))
                .catch(e => cbs.forEach(c => c.rej(e)));
        }, 80);

        return p;
    }

    /**
     * saveLinkedField — update a Link field after an upsert resolve.
     * Updates listview.data in place, triggers rerender, shows toast.
     */
    function saveLinkedField(doctype, docname, fieldname, value, listview, rerenderFn) {
        frappe.db.set_value(doctype, docname, fieldname, value).then(() => {
            frappe.show_alert({ message: __("Linked"), indicator: "green" }, 0.8);
            const row = (listview.data || []).find(d => d.name === docname);
            if (row) row[fieldname] = value;
            rerenderFn?.();
        });
    }

    function deleteRow(listview, doctype, docname, rerenderFn) {
        frappe.confirm(__("Delete this record? This cannot be undone."), () => {
            frappe.call({
                method: "frappe.client.delete",
                args: { doctype, name: docname },
                callback: ({ exc }) => {
                    if (exc) return;
                    frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.2);
                    listview.data = (listview.data || []).filter(d => d.name !== docname);
                    rerenderFn();
                },
            });
        });
    }

    // ── Upsert helpers ─────────────────────────────────────────────────────────
    // These find-or-create a Company / User / Employee, then call cb(id).

    function upsertCompany(companyValue, cb) {
        frappe.db.get_value("Company", { company_name: companyValue }, "name", r => {
            if (r?.name) { cb(r.name); return; }
            frappe.show_alert({ message: __("Creating company '{0}'…", [companyValue]), indicator: "orange" }, 1.0);
            const abbr = companyValue.substring(0, 4).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "NEW";
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: {
                    doctype: "Company", company_name: companyValue, abbr,
                    default_currency: frappe.defaults.get_default("currency") || "USD",
                }},
                callback: ({ exc, message: doc }) => {
                    if (!exc && doc) { frappe.show_alert({ message: __("Company '{0}' created", [companyValue]), indicator: "green" }, 1.2); cb(doc.name); }
                },
            });
        });
    }

    function upsertUser(userValue, cb) {
        // Try id match, then email/name match, then create.
        frappe.db.get_value("User", { name: userValue }, "name", byId => {
            if (byId?.name) { cb(byId.name); return; }
            const filter = userValue.includes("@") ? { name: userValue } : { full_name: userValue };
            frappe.db.get_value("User", filter, "name", r => {
                if (r?.name) { cb(r.name); return; }
                frappe.show_alert({ message: __("Creating user '{0}'…", [userValue]), indicator: "orange" }, 1.0);
                const is_email  = userValue.includes("@");
                const email     = is_email ? userValue : `${userValue.toLowerCase().replace(/\s+/g, "")}@example.com`;
                const full_name = is_email ? userValue.split("@")[0] : userValue;
                frappe.call({
                    method: "frappe.client.insert",
                    args: { doc: { doctype: "User", email, first_name: full_name, send_welcome_email: 0 } },
                    callback: ({ exc, message: doc }) => {
                        if (!exc && doc) { frappe.show_alert({ message: __("User '{0}' created", [userValue]), indicator: "green" }, 1.2); cb(doc.name); }
                    },
                });
            });
        });
    }

    function upsertEmployee(employeeValue, companyHint, cb) {
        frappe.db.get_value("Employee", { name: employeeValue }, "name", byId => {
            if (byId?.name) { cb(byId.name); return; }
            frappe.db.get_value("Employee", { employee_name: employeeValue }, "name", r => {
                if (r?.name) { cb(r.name); return; }
                frappe.show_alert({ message: __("Creating employee '{0}'…", [employeeValue]), indicator: "orange" }, 1.0);
                const doInsert = (company) => {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: "Employee", first_name: employeeValue, company: company || frappe.defaults.get_default("company") || "" } },
                        callback: ({ exc, message: doc }) => {
                            if (!exc && doc) { frappe.show_alert({ message: __("Employee '{0}' created", [employeeValue]), indicator: "green" }, 1.2); cb(doc.name); }
                        },
                    });
                };
                if (companyHint) {
                    frappe.db.get_value("Company", { company_name: companyHint }, "name", c => doInsert(c?.name || ""));
                } else {
                    doInsert("");
                }
            });
        });
    }

    // ── Event binders ──────────────────────────────────────────────────────────

    function bindHover($grid) {
        $grid.on("mouseenter.gl", ".gl-cell[data-name]", function () {
            $grid.find(`.gl-cell[data-name="${$(this).attr("data-name")}"]`).addClass("gl-row-hover");
        }).on("mouseleave.gl", ".gl-cell[data-name]", function () {
            $grid.find(`.gl-cell[data-name="${$(this).attr("data-name")}"]`).removeClass("gl-row-hover");
        });
    }

    function bindDelete($grid, doctype, listview, rerenderFn) {
        $grid.on("click.gl-del", ".gl-rn-del", function (e) {
            e.stopPropagation();
            deleteRow(listview, doctype, $(this).attr("data-name"), rerenderFn);
        });
    }

    /** persistFn is optional; called after mouseup to save widths to localStorage. */
    function bindColResize($grid, cols, colWidths, getTpl, persistFn) {
        $grid.on("mousedown.gl-rz", ".gl-rh", function (e) {
            e.preventDefault();
            const ci      = parseInt($(this).attr("data-col"), 10);
            const col     = cols[ci];
            const startX  = e.clientX;
            const computed = getComputedStyle($grid[0]).gridTemplateColumns.split(" ");
            const startW  = parseFloat(computed[ci + 1]) || (col.fr ? col.fr * 100 : col.width) || 120;
            const onMove  = ev => {
                colWidths[col.field] = Math.max(40, startW + (ev.clientX - startX));
                $grid[0].style.gridTemplateColumns = getTpl();
            };
            $(document)
                .on("mousemove.gl-rz", onMove)
                .on("mouseup.gl-rz", () => {
                    $(document).off("mousemove.gl-rz mouseup.gl-rz");
                    persistFn?.();
                });
        });
    }

    function bindHScroll(host, $grid) {
        // The grid's actual scroll container is the inner .gl-host--scroll child
        const scrollEl = host.querySelector('.gl-host--scroll') || host;

        // Walk up the DOM to find .list-paging-area regardless of Frappe nesting depth
        let $paging = $();
        let $cur = $(host);
        for (let i = 0; i < 8 && !$paging.length; i++) {
            $cur = $cur.parent();
            $paging = $cur.children('.list-paging-area');
            if (!$paging.length) $paging = $cur.find('> .list-paging-area');
        }
        if (!$paging.length) return;

        // Remove old scrollbar from a previous render
        $paging.prev('.gl-hscroll-wrap').remove();

        const $wrap  = $('<div class="gl-hscroll-wrap"></div>');
        const $track = $('<div class="gl-hscroll-track"></div>');
        const $thumb = $('<div class="gl-hscroll-thumb"></div>');
        $track.append($thumb);
        $wrap.append($track);
        $wrap.insertBefore($paging);

        function refresh() {
            const totalW = scrollEl.scrollWidth;
            const visW   = scrollEl.clientWidth;
            if (totalW <= visW + 2) { $wrap.hide(); return; }
            $wrap.show();
            const trackW  = $track[0].clientWidth;
            const thumbW  = Math.max(40, Math.round(trackW * visW / totalW));
            const maxLeft = trackW - thumbW;
            const left    = Math.round((scrollEl.scrollLeft / (totalW - visW)) * maxLeft);
            $thumb.css({ width: thumbW + 'px', left: left + 'px' });
        }

        $(scrollEl).on('scroll.gl-hs', refresh);

        $track.on('mousedown.gl-hs', function (e) {
            const trackEl = $track[0];
            const trackW  = trackEl.clientWidth;
            const thumbW  = $thumb[0].offsetWidth;
            const maxLeft = trackW - thumbW;
            const totalW  = scrollEl.scrollWidth;
            const visW    = scrollEl.clientWidth;

            const clickX    = e.clientX - trackEl.getBoundingClientRect().left;
            const initLeft  = Math.min(Math.max(0, clickX - thumbW / 2), maxLeft);
            scrollEl.scrollLeft = (initLeft / maxLeft) * (totalW - visW);
            refresh();

            const startX    = e.clientX;
            const startLeft = initLeft;
            $thumb.addClass('gl-hs-drag');

            $(document)
                .on('mousemove.gl-hs', function (mv) {
                    const dx  = mv.clientX - startX;
                    const newL = Math.min(Math.max(0, startLeft + dx), maxLeft);
                    scrollEl.scrollLeft = (newL / maxLeft) * (totalW - visW);
                    refresh();
                })
                .on('mouseup.gl-hs', function () {
                    $thumb.removeClass('gl-hs-drag');
                    $(document).off('mousemove.gl-hs mouseup.gl-hs');
                });
            e.preventDefault();
        });

        $(window).on('resize.gl-hs', refresh);
        host._glRefreshHScroll = refresh;
        // Defer first paint so browser has computed layout dimensions
        requestAnimationFrame(refresh);
    }

    function bindOutsideClick($grid, esm, ns) {
        $(document).off(`mousedown.gl-oc-${ns}`).on(`mousedown.gl-oc-${ns}`, function (e) {
            if (!$(e.target).closest($grid).length && !$(e.target).closest(".gl-dd").length) esm.clear();
        });
    }

    // Text / email / tel / url inline edit
    function bindTextEdit($grid, rows, saveFn, esm) {
        $grid.on("click.gl-te", ".gl-d:not(.gl-d-link):not(.gl-d-url)", function (e) {
            e.stopPropagation();
            if ($(this).find("input").length) return;
            const $s  = $(this);
            const name = $s.attr("data-name"), field = $s.attr("data-field");
            const type = $s.attr("data-type") || "text";
            if (type === "date") return;
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            esm?.set(name);
            const $i = $(`<input class="gl-inp" type="${type}" value="${frappe.utils.escape_html(cur)}">`);
            $s.html($i); $i.focus().select();
            $i.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); $i.blur(); }
                if (ev.key === "Escape") $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`);
            });
            $i.on("blur", function () {
                const v = $(this).val().trim();
                if (v === cur) { $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); return; }
                Promise.resolve(saveFn(name, field, v))
                    .then(() => { if (doc) doc[field] = v; $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); })
                    .catch(() => { $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`); });
            });
        });
    }

    function bindUrlEdit($grid, rows, saveFn, esm) {
        $grid.on("click.gl-ue", ".gl-d-url", function (e) {
            if ($(this).find("input").length) return;
            if (e.ctrlKey || e.metaKey) return;
            const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            if (cur && !$(this).find("input").length) {
                window.open(/^https?:\/\//i.test(cur) ? cur : `https://${cur}`, "_blank", "noopener");
                return;
            }
            esm?.set(name);
            const $i = $(`<input class="gl-inp" type="url" value="${frappe.utils.escape_html(cur)}">`);
            $s.html($i); $i.focus().select();
            $i.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); $i.blur(); }
                if (ev.key === "Escape") $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`);
            });
            $i.on("blur", function () {
                const v = $(this).val().trim();
                if (v === cur) { $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); return; }
                Promise.resolve(saveFn(name, field, v))
                    .then(() => { if (doc) doc[field] = v; $s.html(v ? `<span class="gl-d-url">${frappe.utils.escape_html(v)}</span>` : `<span class="gl-ph">—</span>`); })
                    .catch(() => $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`));
            });
        });
    }

    function bindDateEdit($grid, rows, saveFn, esm) {
        $grid.on("click.gl-de", ".gl-d[data-type='date']", function (e) {
            e.stopPropagation();
            if ($(this).find("input").length) return;
            const $s  = $(this);
            const name = $s.attr("data-name"), field = $s.attr("data-field");
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            esm?.set(name);
            const $i = $(`<input class="gl-inp" type="date" value="${cur}">`);
            $s.html($i); $i.focus();
            const fmt = v => v ? frappe.utils.escape_html(frappe.datetime.str_to_user(v)) : `<span class="gl-ph">—</span>`;
            const commit = () => {
                const v = $i.val();
                if (v === cur) { $s.html(fmt(v)); return; }
                Promise.resolve(saveFn(name, field, v || null))
                    .then(() => { if (doc) doc[field] = v; $s.html(fmt(v)); })
                    .catch(() => $s.html(fmt(cur)));
            };
            $i.on("change", commit).on("blur", commit);
        });
    }

    function bindLinkEdit($grid, rows, saveFn, esm) {
        $grid.on("click.gl-le", ".gl-d-link", function (e) {
            if ($(this).find("input").length) return;
            const $s  = $(this);
            const name = $s.attr("data-name"), field = $s.attr("data-field");
            const linkDt = $s.attr("data-link-doctype") || "";
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            esm?.set(name);

            const $w  = $(`<div class="gl-lw"></div>`);
            const $i  = $(`<input class="gl-inp" type="text" autocomplete="off" value="${frappe.utils.escape_html(cur)}" placeholder="${__("Search…")}">`);
            const $dd = $(`<div class="gl-dd"></div>`);
            $w.append($i).append($dd); $s.html($w); $i.focus().select();

            const showVal = v => v
                ? `<span class="gl-link-val">${frappe.utils.escape_html(v)}</span>`
                : `<span class="gl-ph">—</span>`;

            const commit = v => {
                $dd.hide();
                if (v === cur) { $s.html(showVal(v)); return; }
                Promise.resolve(saveFn(name, field, v || null))
                    .then(() => { if (doc) doc[field] = v; $s.html(showVal(v)); })
                    .catch(() => $s.html(showVal(cur)));
            };

            let _t;
            $i.on("input", function () {
                clearTimeout(_t);
                const q = $(this).val().trim();
                if (!q || !linkDt) { $dd.empty().hide(); return; }
                _t = setTimeout(() => {
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: { doctype: linkDt, filters: [["name", "like", `%${q}%`]], fields: ["name"], limit_page_length: 8 },
                        callback({ message }) {
                            $dd.empty();
                            if (!message?.length) { $dd.hide(); return; }
                            message.forEach(r => {
                                $dd.append(
                                    $(`<div class="gl-dd-item">${frappe.utils.escape_html(r.name)}</div>`)
                                        .on("mousedown", ev => { ev.preventDefault(); $i.val(r.name); $dd.hide(); commit(r.name); })
                                );
                            });
                            $dd.show();
                        },
                    });
                }, 220);
            });
            $i.on("keydown", ev => {
                if (ev.key === "Escape") { $dd.hide(); $s.html(showVal(cur)); }
                if (ev.key === "Enter")  { commit($i.val().trim()); }
            });
            $i.on("blur", function () {
                setTimeout(() => { if ($dd.is(":visible")) return; commit($i.val().trim()); }, 160);
            });
        });
    }

    function bindSelectChange($grid, rows, saveFn) {
        $grid.on("change.gl-sc", ".gl-sel", function () {
            const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
            const doc = rows.find(r => r.name === name);
            const v = $s.val();
            Promise.resolve(saveFn(name, field, v)).then(() => { if (doc) doc[field] = v; });
        });
    }

    function bindAddRow($host, addFn) {
        $host.off("click.gl-add").on("click.gl-add", ".gl-add-btn", addFn);
    }

    /**
     * bindRowSelect — global row selection with bulk delete.
     *
     * @param $grid      jQuery grid element
     * @param $toolbar   jQuery toolbar element (button appended here)
     * @param rows       array of row data objects (each has .name)
     * @param deleteFn   (name) => Promise — deletes from server AND removes from rows/listview.data
     * @param rerenderFn () => void — called once after all deletions
     * @returns          { getSelected(), clear() }
     */
    function bindRowSelect($grid, $toolbar, rows, deleteFn, rerenderFn) {
        const sel = new Set(); // doc names

        // Remove stale button from previous render cycle
        $toolbar.find(".gl-del-sel-btn").remove();
        $toolbar.off("click.gl-sel-del");

        const $btn = $(`<button class="btn btn-danger btn-sm gl-del-sel-btn"></button>`)
            .hide()
            .appendTo($toolbar);

        const syncBtn = () => {
            const n = sel.size;
            if (n > 0) $btn.text(__("Delete ({0}) Rows", [n])).show();
            else        $btn.hide();
        };

        let _drag = null;

        const _applyDragRange = (startRi, endRi) => {
            if (!_drag) return;
            const minRi = Math.min(startRi, endRi);
            const maxRi = Math.max(startRi, endRi);
            sel.clear();
            _drag.preState.forEach(n => sel.add(n));
            rows.forEach((row, ri) => {
                if (ri >= minRi && ri <= maxRi) {
                    if (_drag.mode === "select") sel.add(row.name);
                    else sel.delete(row.name);
                }
            });
            rows.forEach((row, ri) => {
                const on = sel.has(row.name);
                $grid.find(`.gl-rn[data-row="${ri}"]`).toggleClass("gl-rn--sel", on);
                $grid.find(`.gl-cell[data-row="${ri}"]:not(.gl-rn)`).toggleClass("gl-row--sel", on);
            });
            syncBtn();
        };

        $grid.off("click.gl-sel mousedown.gl-sel").on("mousedown.gl-sel", ".gl-rn[data-row]", function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            const ri   = parseInt($(this).attr("data-row"), 10);
            const name = $(this).attr("data-name");
            _drag = { startRi: ri, mode: sel.has(name) ? "deselect" : "select", preState: new Set(sel) };
            _applyDragRange(ri, ri);
            const onMove = (ev) => {
                const el = document.elementFromPoint(ev.clientX, ev.clientY);
                if (!el) return;
                const $rn = $(el).closest(".gl-rn[data-row]");
                if (!$rn.length || !$.contains($grid[0], $rn[0])) return;
                _applyDragRange(_drag.startRi, parseInt($rn.attr("data-row"), 10));
            };
            $grid.css("user-select", "none");
            $(document).on("mousemove.gl-sel-drag", onMove);
            $(document).one("mouseup.gl-sel-drag", () => {
                $(document).off("mousemove.gl-sel-drag");
                $grid.css("user-select", "");
                _drag = null;
            });
        });

        $toolbar.on("click.gl-sel-del", ".gl-del-sel-btn", function () {
            const targets = [...sel];
            if (!targets.length) return;
            frappe.confirm(
                __("Delete {0} selected row(s)? This cannot be undone.", [targets.length]),
                () => {
                    $btn.prop("disabled", true);
                    const queue = [...targets];
                    let deleted = 0, errors = 0;
                    const next = () => {
                        if (!queue.length) {
                            sel.clear();
                            rerenderFn();
                            frappe.show_alert({
                                message: __("{0} deleted · {1} errors", [deleted, errors]),
                                indicator: errors ? "orange" : "red",
                            }, 3);
                            return;
                        }
                        Promise.resolve(deleteFn(queue.shift()))
                            .then(() => { deleted++; next(); })
                            .catch(() => { errors++; next(); });
                    };
                    next();
                }
            );
        });

        return {
            /** Returns array of selected row doc objects. */
            getSelected() {
                return [...sel].map(n => rows.find(r => r.name === n)).filter(Boolean);
            },
            clear() { sel.clear(); syncBtn(); },
        };
    }

    /** Textarea autogrow on input. Call after render. */
    function bindAreaAutogrow($grid) {
        const grow = function () { this.style.height = "auto"; this.style.height = `${this.scrollHeight}px`; };
        $grid.on("input.gl-ag", ".gl-area", grow);
        $grid.find(".gl-area").each(grow);
    }

    /** Save textarea value on blur (skip if unchanged). */
    function bindAreaSave($grid, rows, saveFn) {
        // Seed last-saved values so the first blur doesn't false-trigger.
        $grid.find(".gl-area").each(function () {
            $(this).data("lsv", ($(this).val() || "").trim());
        });
        $grid.on("blur.gl-as", ".gl-area", function () {
            const $el = $(this);
            const val = ($el.val() || "").trim();
            if (val === $el.data("lsv")) return;
            const name  = $el.attr("data-name");
            const field = $el.attr("data-field");
            if (!name || !field) return;
            $el.data("lsv", val);
            Promise.resolve(saveFn(name, field, val)).then(() => {
                const doc = rows.find(r => r.name === name);
                if (doc) doc[field] = val;
            });
        });
    }

    /** Show/hide the map URL input when the pen button is clicked. */
    function bindMapsToggle($grid) {
        $grid.on("click.gl-mt", ".gl-map-pen", function (e) {
            e.stopPropagation();
            const $cell    = $(this).closest(".gl-map-cell");
            const $input   = $cell.find(".gl-map-input");
            const $display = $cell.find(".gl-map-display");
            if ($input.is(":visible")) {
                $input.hide(); $display.show(); $input.trigger("blur");
            } else {
                $display.hide(); $input.show().focus().select();
            }
        });
    }

    /** Save map URL on blur (skip if unchanged). */
    function bindMapsEdit($grid, rows, saveFn) {
        $grid.find(".gl-map-input").each(function () {
            $(this).data("lsv", ($(this).val() || "").trim());
        });
        $grid.on("blur.gl-me", ".gl-map-input", function () {
            const $el = $(this);
            const val = ($el.val() || "").trim();
            if (val === $el.data("lsv")) return;
            const name  = $el.attr("data-name");
            const field = $el.attr("data-field");
            if (!name || !field) return;
            $el.data("lsv", val);
            Promise.resolve(saveFn(name, field, val)).then(() => {
                const doc = rows.find(r => r.name === name);
                if (doc) doc[field] = val;
                // Sync the display and open-map link
                const $cell    = $el.closest(".gl-map-cell");
                const $display = $cell.find(".gl-map-display");
                $display.html(val
                    ? `<span class="gl-link-val">URL set</span>`
                    : `<span class="gl-ph">No URL</span>`);
                $cell.find(".gl-map-open").replaceWith(val
                    ? `<a href="${frappe.utils.escape_html(val)}" target="_blank" class="gl-icon-btn gl-map-open">${SVG.map}</a>`
                    : `<span class="gl-icon-btn gl-map-open gl-icon-btn--dim">${SVG.map}</span>`
                );
                $el.hide(); $display.show();
            });
        });
    }

    /** Number input save on blur/change. */
    function bindNumberChange($grid, rows, saveFn) {
        $grid.find(".gl-number").each(function () {
            $(this).data("lsv", $(this).val());
        });
        $grid.on("blur.gl-nc change.gl-nc", ".gl-number", function () {
            const $el = $(this);
            const val = $el.val();
            if (val === $el.data("lsv")) return;
            const name = $el.attr("data-name"), field = $el.attr("data-field");
            if (!name || !field) return;
            $el.data("lsv", val);
            const parsed = val !== "" ? parseFloat(val) : null;
            Promise.resolve(saveFn(name, field, parsed)).then(() => {
                const doc = rows.find(r => r.name === name);
                if (doc) doc[field] = parsed;
            });
        });
    }

    /**
     * bindAvatarAutocomplete — typeahead for avatar inputs ([data-link]).
     * linkConfig: { "User": { doctype, fields, searchfield, primary, sub, id }, ... }
     * saveFn(name, field, id) — called with the resolved record ID (not display name).
     * linkNames: makeLinkNameCache() — updated so future renders show the right name.
     */
    function bindAvatarAutocomplete($grid, linkConfig, saveFn, linkNames) {
        let $menu = null, activeInput = null, debounceTimer = null;

        const closeMenu = () => {
            if ($menu) { $menu.remove(); $menu = null; }
            activeInput = null;
        };

        const positionMenu = $input => {
            const rect = $input[0].getBoundingClientRect();
            $menu.css({
                top:   `${rect.bottom + window.scrollY}px`,
                left:  `${rect.left  + window.scrollX}px`,
                width: `${Math.max(rect.width, 220)}px`,
            });
        };

        const renderMenu = ($input, results) => {
            if (!results.length) { closeMenu(); return; }
            if (!$menu) $menu = $(`<div class="gl-dd gl-ac-menu"></div>`).appendTo(document.body);
            $menu.html(results.map(r =>
                `<div class="gl-dd-item gl-ac-item" data-id="${frappe.utils.escape_html(r.id)}" data-val="${frappe.utils.escape_html(r.primary)}">` +
                `<span class="gl-ac-primary">${frappe.utils.escape_html(r.primary)}</span>` +
                (r.sub ? `<span class="gl-ac-sub">${frappe.utils.escape_html(r.sub)}</span>` : "") +
                `</div>`
            ).join(""));
            $menu.css("display", "block");
            positionMenu($input);
        };

        const search = ($input, typed) => {
            const cfg = linkConfig[$input.attr("data-link")];
            if (!cfg) return;
            const filters = typed.trim() ? { [cfg.searchfield]: ["like", `%${typed.trim()}%`] } : {};
            frappe.call({
                method: "frappe.client.get_list",
                args: { doctype: cfg.doctype, fields: cfg.fields, filters, limit_page_length: 8, order_by: `${cfg.searchfield} asc` },
                callback: ({ message }) => {
                    if (activeInput !== $input[0]) return;
                    const results = (message || []).map(row => {
                        const primary = row[cfg.primary] || row.name;
                        const id      = row[cfg.id]      || row.name;
                        linkNames?.set(cfg.doctype, id, primary);
                        return { primary, sub: row[cfg.sub] || "", id };
                    });
                    renderMenu($input, results);
                },
            });
        };

        $grid.on("input.gl-ac focus.gl-ac", ".gl-avatar-input[data-link]", function () {
            activeInput = this;
            const $input = $(this);
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => search($input, $input.val() || ""), 180);
        });

        // Track original value so blur-save can detect changes
        $grid.on("focus.gl-ac-orig", ".gl-avatar-input[data-link]", function () {
            $(this).data("gl-orig", $(this).val());
        });

        $(document).off("mousedown.gl-ac").on("mousedown.gl-ac", ".gl-ac-item", function (e) {
            e.preventDefault();
            if (!activeInput) return;
            const $input  = $(activeInput);
            const id      = $(this).attr("data-id");
            const display = $(this).attr("data-val");
            const cfg     = linkConfig[$input.attr("data-link")];
            if (cfg) linkNames?.set(cfg.doctype, id, display);
            $input.val(display); // show display name in input while saving
            $input.data("gl-orig", display); // prevent blur-save double-fire
            closeMenu();
            // Save using the record ID (not display name — saveFn handles upsert)
            const docname = $input.attr("data-name");
            const field   = $input.attr("data-field");
            if (docname && field) saveFn(docname, field, id);
        });

        $grid.on("blur.gl-ac", ".gl-avatar-input[data-link]", function () {
            const $input = $(this);
            setTimeout(() => {
                closeMenu();
                // Save if user typed something directly (without selecting from dropdown)
                const val  = ($input.val() || "").trim();
                const orig = ($input.data("gl-orig") || "").trim();
                if (!val || val === orig) return;
                const docname = $input.attr("data-name");
                const field   = $input.attr("data-field");
                if (docname && field) saveFn(docname, field, val);
            }, 150);
        });
        $(document).off("click.gl-acout").on("click.gl-acout", e => {
            if ($menu && !$(e.target).closest(".gl-ac-menu, .gl-avatar-input").length) closeMenu();
        });
    }

    /** Open drawing dialog (frappe_drawing must be loaded). */
    function bindDrawings($grid, { doctype, drawingField = "drawing", hasDrawingField = "has_drawing" }, listview, rerenderFn) {
        $grid.on("click.gl-dr", ".fd-draw-btn", function (e) {
            e.stopPropagation();
            const docname = $(this).attr("data-name");
            if (typeof frappe_drawing === "undefined") return;
            frappe_drawing.open({
                doctype, docname,
                drawing_field: drawingField,
                has_drawing_field: hasDrawingField,
                on_saved(hasShapes) {
                    const row = (listview.data || []).find(d => d.name === docname);
                    if (row) row.has_drawing = hasShapes ? 1 : 0;
                    rerenderFn?.();
                },
            });
        });
    }

    /**
     * bindAttachments — opens the unified attach dialog.
     * opts: { doctype, attachDoctype, attachTableField, attachCounts, uploadable? }
     */
    function bindAttachments($grid, opts, listview, rerenderFn) {
        $grid.on("click.gl-at", ".gl-attach-btn", function () {
            openAttachDialog({ ...opts, docname: $(this).attr("data-name"), listview, rerenderFn });
        });
    }

    /**
     * bindMeasurements — opens the measurement items dialog.
     * opts: { doctype, measureDoctype, measureTableField, measureCounts, units? }
     */
    function bindMeasurements($grid, opts, listview, rerenderFn) {
        $grid.on("click.gl-ms", ".gl-measure-btn", function (e) {
            e.stopPropagation();
            openMeasureDialog({ ...opts, docname: $(this).attr("data-name"), listview, rerenderFn });
        });
    }

    // ── Unified attachment dialog ──────────────────────────────────────────────
    /**
     * opts:
     *   doctype, attachDoctype, attachTableField  — schema config
     *   docname, listview, rerenderFn             — context
     *   attachCounts                              — makeCountCache() instance (optional)
     *   uploadable                                — true to show file-upload button
     */
    function openAttachDialog(opts) {
        const {
            doctype, attachDoctype, attachTableField,
            docname, listview, rerenderFn,
            attachCounts, uploadable = false,
        } = opts;

        let items = [];

        const dialog = new frappe.ui.Dialog({
            title: __("Files — {0}", [docname]),
            size: "large",
            fields: [{ fieldname: "html", fieldtype: "HTML" }],
            primary_action_label: __("Save"),
            primary_action() {
                // Collect current row values back into items
                const $wrap = dialog.fields_dict.html.$wrapper;
                $wrap.find(".gl-dlg-row").each(function () {
                    const idx = parseInt($(this).attr("data-idx"), 10);
                    if (!isNaN(idx) && items[idx] !== undefined) {
                        items[idx] = {
                            label: $(this).find(".gl-dlg-label").val().trim(),
                            url:   $(this).find(".gl-dlg-url").val().trim(),
                        };
                    }
                });
                const collected = items.filter(r => r.url && !r._uploading);
                frappe.call({
                    method: "frappe.client.get",
                    args: { doctype, name: docname },
                    callback: ({ exc, message: doc }) => {
                        if (exc || !doc) return;
                        doc[attachTableField] = collected.map(r => ({ doctype: attachDoctype, label: r.label, url: r.url }));
                        frappe.call({
                            method: "frappe.client.save",
                            args: { doc },
                            callback: ({ exc: e }) => {
                                if (e) return;
                                frappe.show_alert({ message: __("Files saved"), indicator: "green" }, 1.0);
                                attachCounts?.update(docname, collected.length);
                                const localDoc = (listview.data || []).find(d => d.name === docname);
                                if (localDoc) localDoc[attachTableField] = collected;
                                rerenderFn?.();
                                dialog.hide();
                            },
                        });
                    },
                });
            },
        });

        dialog.show();

        frappe.call({
            method: "frappe.client.get",
            args: { doctype, name: docname },
            callback: ({ exc, message }) => {
                const $wrap = dialog.fields_dict.html.$wrapper;
                if (exc || !message) { $wrap.html(`<p style="color:var(--text-danger,#c0392b)">${__("Could not load files.")}</p>`); return; }
                items = Array.isArray(message[attachTableField])
                    ? message[attachTableField].map(r => ({ label: r.label || "", url: r.url || "" }))
                    : [];
                attachCounts?.update(docname, items.length);
                _renderAttachDialogBody($wrap, items, docname, uploadable, dialog);
            },
        });
    }

    function _renderAttachDialogBody($wrap, items, docname, uploadable, dialog) {
        const savedRows   = items.filter(r => r.url && !r._uploading);
        const previewHtml = savedRows.length
            ? `<div class="gl-att-preview">
                <div class="gl-att-preview-lbl">${__("Preview")}</div>
                <div class="gl-att-list">${savedRows.map(_attachPreviewItem).join("")}</div>
               </div><hr class="gl-att-divider">`
            : "";

        const uploadSection = uploadable
            ? `<div class="gl-dlg-upload-area">
                <button class="gl-dlg-upload-btn">${SVG.upload} ${__("Upload files")}</button>
                <span class="gl-dlg-upload-or">${__("or paste a URL below")}</span>
                <input type="file" class="gl-dlg-file-input" multiple style="display:none">
               </div>`
            : "";

        $wrap.html(`
            <div class="gl-attach-dlg">
                ${previewHtml}
                ${uploadSection}
                <div class="gl-dlg-head">
                    <div class="gl-dlg-col-label">${__("Label")}</div>
                    <div class="gl-dlg-col-url">${__("URL / Path")}</div>
                    <div class="gl-dlg-col-act"></div>
                </div>
                <div class="gl-dlg-rows">
                    ${items.map((r, i) =>
                        `<div class="gl-dlg-row" data-idx="${i}">
                            <input type="text" class="form-control gl-dlg-label" placeholder="${__("e.g. Site Photo")}" value="${frappe.utils.escape_html(r.label)}"${r._uploading ? " disabled" : ""}>
                            <div class="gl-dlg-url-wrap">
                                <input type="text" class="form-control gl-dlg-url" placeholder="https://…" value="${frappe.utils.escape_html(r.url)}"${r._uploading ? " disabled" : ""}>
                                ${r._uploading ? `<div class="gl-dlg-pbar"><div class="gl-dlg-prog" style="width:0%"></div></div>` : ""}
                            </div>
                            <button class="gl-dlg-del" title="${__("Remove")}"${r._uploading ? " disabled" : ""}>×</button>
                        </div>`
                    ).join("")}
                </div>
                <button class="btn btn-xs btn-default gl-dlg-add-link">+ ${__("Add URL manually")}</button>
            </div>`);

        const repaint = () => _renderAttachDialogBody($wrap, items, docname, uploadable, dialog);

        $wrap.off("click.gla").on("click.gla", ".gl-dlg-del", function () {
            items.splice(parseInt($(this).closest(".gl-dlg-row").attr("data-idx"), 10), 1);
            repaint();
        });
        $wrap.on("click.gla", ".gl-dlg-add-link", () => {
            items.push({ label: "", url: "" });
            repaint();
            $wrap.find(".gl-dlg-row").last().find(".gl-dlg-label").focus();
        });

        if (uploadable) {
            $wrap.on("click.gla", ".gl-dlg-upload-btn", () => $wrap.find(".gl-dlg-file-input")[0].click());
            $wrap.on("change.gla", ".gl-dlg-file-input", function () {
                Array.from(this.files).forEach(file => {
                    const idx = items.length;
                    items.push({ label: file.name, url: "", _uploading: true });
                    repaint();
                    _uploadFile(file, docname, result => {
                        items[idx] = { label: result.file_name || file.name, url: result.file_url };
                        repaint();
                    }, pct => {
                        $wrap.find(`.gl-dlg-row[data-idx="${idx}"] .gl-dlg-prog`).css("width", `${pct}%`);
                    });
                });
                this.value = "";
            });
        }
    }

    function _uploadFile(file, docname, onSuccess, onProgress) {
        const fd = new FormData();
        fd.append("file", file, file.name);
        fd.append("is_private", "0");
        fd.append("folder", "Home/Attachments");
        fd.append("docname", docname);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/method/upload_file");
        xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);
        xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText);
                if (d.message?.file_url) onSuccess(d.message);
                else frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
            } catch { frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2); }
        };
        xhr.onerror = () => frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
        xhr.send(fd);
    }

    function _attachPreviewItem(r) {
        const eu = frappe.utils.escape_html(r.url);
        const el = frappe.utils.escape_html(r.label || r.url);
        const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
        if (isImg) return `<a href="${eu}" target="_blank" class="gl-att-thumb-wrap" title="${el}"><img src="${eu}" class="gl-att-thumb" alt="${el}"><span class="gl-att-thumb-lbl">${el}</span></a>`;
        return `<a href="${eu}" target="_blank" class="gl-att-chip" title="${eu}">${SVG.file}<span>${el}</span></a>`;
    }

    // ── Unified measure/MTO dialog ─────────────────────────────────────────────
    const MEASURE_UNITS = ["m", "m²", "m³", "cm", "mm", "ft", "in", "kg", "g", "L", "mL", "pcs", "units"];

    /**
     * opts:
     *   doctype, measureDoctype, measureTableField  — schema
     *   docname, listview, rerenderFn               — context
     *   measureCounts                               — makeCountCache() instance (optional)
     *   units                                       — array of unit strings (optional, defaults to MEASURE_UNITS)
     */
    function openMeasureDialog(opts) {
        const {
            doctype, measureDoctype, measureTableField,
            docname, listview, rerenderFn,
            measureCounts, units = MEASURE_UNITS,
        } = opts;

        frappe.call({
            method: "frappe.client.get",
            args: { doctype, name: docname },
            callback: ({ message }) => {
                const rows = Array.isArray(message?.[measureTableField])
                    ? message[measureTableField].map(r => ({ label: r.label || "", value: r.value ?? "", unit: r.unit || "m" }))
                    : [];
                _showMeasureDialog({ doctype, measureDoctype, measureTableField, docname, listview, rerenderFn, measureCounts, units, rows });
            },
        });
    }

    function _showMeasureDialog({ doctype, measureDoctype, measureTableField, docname, listview, rerenderFn, measureCounts, units, rows }) {
        const unitOpts = units.map(u => `<option value="${u}">${u}</option>`).join("");

        const dialog = new frappe.ui.Dialog({
            title: __("Measurements — {0}", [docname]),
            size: "large",
            fields: [{ fieldname: "html", fieldtype: "HTML" }],
            primary_action_label: __("Save"),
            primary_action() {
                const collected = [];
                dialog.$wrapper.find(".gl-mto-row").each(function () {
                    const label = $(this).find(".gl-mto-label").val().trim();
                    const value = parseFloat($(this).find(".gl-mto-value").val());
                    const unit  = $(this).find(".gl-mto-unit").val();
                    if (label || !isNaN(value)) collected.push({ label, value: isNaN(value) ? null : value, unit });
                });

                frappe.call({
                    method: "frappe.client.get",
                    args: { doctype, name: docname },
                    callback: ({ message: doc }) => {
                        if (!doc) return;
                        doc[measureTableField] = collected.map(r => ({ doctype: measureDoctype, label: r.label, value: r.value, unit: r.unit }));
                        frappe.call({
                            method: "frappe.client.save",
                            args: { doc },
                            callback: ({ exc }) => {
                                if (exc) return;
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: { doctype, name: docname, fieldname: "has_measurements", value: collected.length ? 1 : 0 },
                                    callback: () => {
                                        frappe.show_alert({ message: __("Measurements saved"), indicator: "green" }, 1.0);
                                        measureCounts?.update(docname, collected.length);
                                        const row = (listview.data || []).find(d => d.name === docname);
                                        if (row) row.has_measurements = collected.length ? 1 : 0;
                                        rerenderFn?.();
                                        dialog.hide();
                                    },
                                });
                            },
                        });
                    },
                });
            },
        });

        dialog.show();
        const $wrap = dialog.fields_dict.html.$wrapper;

        $wrap.html(`
            <div class="gl-mto-dialog">
                <div class="gl-mto-head">
                    <span>${__("Description")}</span>
                    <span>${__("Value")}</span>
                    <span>${__("Unit")}</span>
                    <span></span>
                </div>
                <div class="gl-mto-rows"></div>
                <button class="btn btn-xs btn-default gl-mto-add">+ ${__("Add measurement")}</button>
            </div>`);

        const $rows = $wrap.find(".gl-mto-rows");
        const addRow = (label = "", value = "", unit = "m") => {
            const selOpts = units.map(u => `<option value="${u}"${u === unit ? " selected" : ""}>${u}</option>`).join("");
            const $row = $(`
                <div class="gl-mto-row">
                    <input type="text"   class="form-control gl-mto-label" placeholder="${__("e.g. Room width")}" value="${frappe.utils.escape_html(label)}">
                    <input type="number" class="form-control gl-mto-value" placeholder="0" value="${value}" step="any">
                    <select class="form-control gl-mto-unit">${selOpts}</select>
                    <button class="gl-mto-del" title="${__("Remove")}">×</button>
                </div>`);
            $row.find(".gl-mto-del").on("click", () => $row.remove());
            $rows.append($row);
        };

        rows.forEach(r => addRow(r.label, r.value, r.unit));
        if (!rows.length) addRow();
        $wrap.find(".gl-mto-add").on("click", () => addRow());
    }

    // ── Sticky column offset calculator ───────────────────────────────────────
    /**
     * Returns { field: leftPx } for each contiguous sticky column (col.sticky === true)
     * starting from column index 0. leftPx is the CSS `left` value to use for
     * `position:sticky`, where 42px is the fixed row-number column width.
     */
    function computeStickyOffsets(cols, colWidths) {
        const offsets = {};
        let left = 42; // row-number column width
        for (const col of cols) {
            if (!col.sticky) break;
            offsets[col.field] = left;
            left += colWidths[col.field] || col.width || 120;
        }
        return offsets;
    }

    // ── Shared CSS ─────────────────────────────────────────────────────────────
    const BASE_CSS = `
/* ── Design tokens ──────────────────────────────────────────────────────────
   Single source of truth. Override in your own CSS to retheme everything:
   .my-app { --erpnx-accent: #E44; --erpnx-grid-radius: 6px; }            */
:root {
    --erpnx-accent:       #378ADD;
    --erpnx-grid-radius:  12px;
    --erpnx-cell-radius:  8px;
    --erpnx-border-w:     0.5px;
    --erpnx-font:         12px;
    --erpnx-cell-h:       34px;
}

/* ── Host ─────────────────────────────────────────────────────────────────── */
.gl-host            { width: 100%; position: relative; }
.gl-host--scroll    { width: 100%; overflow-x: auto; scrollbar-width: none; }
.gl-host--scroll::-webkit-scrollbar { display: none; }

/* ── Custom horizontal scrollbar ─────────────────────────────────────────── */
.gl-hscroll-wrap {
    padding: 5px 0 2px;
}
.gl-hscroll-track {
    position: relative;
    height: 8px;
    background: var(--bg-light-gray, #eef0f4);
    border-radius: 6px;
    cursor: pointer;
    overflow: hidden;
}
.gl-hscroll-thumb {
    position: absolute;
    top: 0; bottom: 0; left: 0;
    min-width: 40px;
    background: linear-gradient(90deg,
        transparent 0%,
        #5ab3f0 22%,
        #2474c8 50%,
        #5ab3f0 78%,
        transparent 100%
    );
    border-radius: 6px;
    cursor: grab;
    transition: opacity 0.15s;
    opacity: 0.88;
}
.gl-hscroll-thumb:hover  { opacity: 1; }
.gl-hscroll-thumb.gl-hs-drag {
    cursor: grabbing;
    background: linear-gradient(90deg,
        transparent 0%,
        #3a9be8 22%,
        #1861b8 50%,
        #3a9be8 78%,
        transparent 100%
    );
    opacity: 1;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.gl-toolbar {
    display: flex; align-items: center; padding: 10px 12px 14px; gap: 8px;
}
.gl-add-btn    { display: inline-flex; align-items: center; gap: 6px; }
.gl-add-icon   { font-size: 14px; line-height: 1; font-weight: 500; }

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.gl-grid {
    display: grid;
    border: var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
    border-radius: var(--erpnx-grid-radius);
    overflow: clip;
    font-size: var(--erpnx-font);
    font-weight: 400;
    background: var(--card-bg, #fff);
}
.gl-grid--scroll { min-width: max-content; }
.gl-grid--fill   { width: 100%; }

/* ── Cells ────────────────────────────────────────────────────────────────── */
.gl-cell {
    display: flex; align-items: center;
    border-right:  var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
    border-bottom: var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
    padding: 5px 8px; min-height: var(--erpnx-cell-h);
    overflow: hidden; position: relative;
    background: var(--card-bg, #fff);
    transition: background 0.1s;
    min-width: 0;
}

.gl-cell.gl-row-hover:not(.gl-hdr):not(.gl-rn) { background: var(--bg-light-gray, #f7f8fa); }
.gl-cell.gl-editing:not(.gl-hdr):not(.gl-rn)   { background: var(--bg-light-gray, #f7f8fa); }
.gl-cell.gl-editing-first { border-left: 2px solid var(--erpnx-accent); }

/* area/textarea cells must not clip */
.gl-cell:has(.gl-area) { align-items: flex-start; overflow: visible; }

/* ── Header ───────────────────────────────────────────────────────────────── */
.gl-hdr {
    background: var(--card-bg, #fff) !important;
    font-size: 11px; font-weight: 500;
    color: var(--text-muted, #6c757d);
    user-select: none; cursor: default;
    padding: 6px 8px; justify-content: center;
    position: sticky; top: 0; z-index: 10;
    white-space: nowrap;
}

/* ── Resize handle ────────────────────────────────────────────────────────── */
.gl-rh {
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 6px; cursor: col-resize;
}
.gl-rh:hover { background: color-mix(in srgb, var(--erpnx-accent) 30%, transparent); }

/* ── Row-number gutter ────────────────────────────────────────────────────── */
.gl-rn {
    justify-content: center;
    color: var(--text-muted, #adb5bd);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    user-select: none; cursor: default;
    position: sticky; left: 0; z-index: 5;
}
.gl-hdr.gl-rn { z-index: 16; } /* above sticky-header cells */
.gl-rn.gl-row-hover:not(.gl-hdr) { background: var(--bg-light-gray, #f7f8fa); }
.gl-rn.gl-editing:not(.gl-hdr)   { background: var(--bg-light-gray, #f7f8fa); }

/* ── Display spans ────────────────────────────────────────────────────────── */
.gl-d {
    display: block; width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    cursor: text; line-height: 1.4;
    padding: 3px 4px; border-radius: var(--erpnx-cell-radius);
    border: var(--erpnx-border-w) solid transparent;
    font-size: var(--erpnx-font); font-weight: 400;
}
.gl-d:focus { outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px; border-color: var(--erpnx-accent); }
.gl-ph      { color: var(--text-muted, #adb5bd); font-style: italic; }

.gl-d-url   { cursor: pointer; color: var(--erpnx-accent); text-decoration: underline dotted; }
.gl-link-val { color: var(--erpnx-accent); }
.gl-d-link  { cursor: text; }

/* ── Datetime (read-only) ─────────────────────────────────────────────────── */
.gl-datetime {
    color: var(--text-muted, #8d96a0);
    font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap;
}

/* ── Status pill ──────────────────────────────────────────────────────────── */
.gl-status-pill {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 20px;
    font-size: 11px; font-weight: 500;
    white-space: nowrap; cursor: default;
}

/* ── Inline input ─────────────────────────────────────────────────────────── */
.gl-inp {
    width: 100%;
    border: var(--erpnx-border-w) solid var(--erpnx-accent);
    outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px;
    border-radius: var(--erpnx-cell-radius); padding: 2px 6px;
    font-size: var(--erpnx-font); font-weight: 400;
    background: var(--card-bg, #fff); font-family: inherit;
}

/* ── Select ───────────────────────────────────────────────────────────────── */
.gl-sel {
    width: 100%; border: none; background: transparent;
    font-size: var(--erpnx-font); font-weight: 400;
    cursor: pointer; outline: none; font-family: inherit;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238d96a0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 6px center; padding-right: 18px;
}
.gl-sel:focus { outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px; border-radius: var(--erpnx-cell-radius); }

/* ── Link dropdown ────────────────────────────────────────────────────────── */
.gl-lw { position: relative; width: 100%; }
.gl-dd {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--card-bg, #fff);
    border: var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
    border-radius: var(--erpnx-grid-radius);
    box-shadow: 0 4px 12px rgba(0,0,0,.12);
    z-index: 9999; max-height: 200px; overflow-y: auto;
    display: none; padding: 4px;
}
.gl-dd-item {
    padding: 6px 10px; font-size: var(--erpnx-font); font-weight: 400;
    cursor: pointer; border-radius: var(--erpnx-cell-radius);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gl-dd-item:hover { background: var(--bg-light-gray, #f7f8fa); color: var(--erpnx-accent); }

/* ── Autocomplete (avatar) ────────────────────────────────────────────────── */
.gl-ac-menu {
    position: absolute; z-index: 9999; padding: 4px;
    max-height: 260px; overflow-y: auto;
    /* inherits .gl-dd box model */
}
.gl-ac-item     { display: flex; flex-direction: column; gap: 1px; }
.gl-ac-primary  { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gl-ac-sub      { font-size: 11px; color: var(--text-muted, #8d96a0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Avatar cell ──────────────────────────────────────────────────────────── */
.gl-avatar-wrap {
    position: relative; display: flex;
    align-items: center; justify-content: center; width: 100%;
}
.gl-avatar {
    width: 22px; height: 22px; border-radius: 50%;
    background: hsl(var(--gl-av-h, 210), 58%, 52%);
    color: #fff; font-weight: 500; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; user-select: none; transition: opacity 0.12s;
}
.gl-avatar--grey  { background: var(--text-muted, #8d96a0); }
.gl-avatar-input  {
    position: absolute; inset: 0; opacity: 0;
    cursor: pointer; border-radius: 50%;
    border: none; outline: none; font-size: var(--erpnx-font);
    background: transparent;
}
.gl-avatar-input:focus {
    opacity: 1; border-radius: var(--erpnx-cell-radius);
    border: var(--erpnx-border-w) solid var(--erpnx-accent);
    background: var(--card-bg, #fff);
    outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px;
}
.gl-avatar-wrap:focus-within .gl-avatar { opacity: 0; }

/* ── Maps cell ────────────────────────────────────────────────────────────── */
.gl-map-cell    { display: flex; align-items: center; gap: 4px; width: 100%; overflow: hidden; }
.gl-map-display { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--erpnx-font); color: var(--text-muted, #8d96a0); }
.gl-map-input   {
    flex: 1; min-width: 0;
    border: var(--erpnx-border-w) solid var(--erpnx-accent);
    border-radius: var(--erpnx-cell-radius); padding: 2px 6px;
    font-size: var(--erpnx-font); font-family: inherit;
    background: var(--card-bg, #fff); outline: none;
}

/* ── Textarea / area ──────────────────────────────────────────────────────── */
.gl-area {
    resize: none; overflow: hidden; line-height: 1.4;
    min-height: 28px; font-size: var(--erpnx-font);
    font-family: inherit; border: var(--erpnx-border-w) solid transparent;
    background: transparent; padding: 3px 6px;
    border-radius: var(--erpnx-cell-radius);
    width: 100%; box-sizing: border-box;
    transition: border-color .12s, background .12s;
}
.gl-area:focus {
    border-color: var(--erpnx-accent); background: var(--card-bg, #fff);
    outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px;
}

/* ── Number input ─────────────────────────────────────────────────────────── */
.gl-number {
    width: 100%; text-align: right;
    border: var(--erpnx-border-w) solid transparent; background: transparent;
    padding: 3px 6px; font-size: var(--erpnx-font); font-family: inherit;
    border-radius: var(--erpnx-cell-radius);
}
.gl-number:focus { border-color: var(--erpnx-accent); background: var(--card-bg, #fff); outline: 1.5px solid var(--erpnx-accent); outline-offset: -1px; }
.gl-number::-webkit-outer-spin-button,
.gl-number::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.gl-number[type=number] { -moz-appearance: textfield; }

/* ── Icon button (shared) ─────────────────────────────────────────────────── */
.gl-icon-btn {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    border: var(--erpnx-border-w) solid transparent;
    border-radius: var(--erpnx-cell-radius);
    background: transparent; cursor: pointer;
    color: var(--text-muted, #6c757d);
    transition: background .12s, border-color .12s, color .12s;
    text-decoration: none; flex-shrink: 0;
}
.gl-icon-btn:hover       { background: var(--bg-light-gray, #f7f8fa); border-color: var(--border-color, #e2e8f0); color: var(--text-color, #1f272e); }
.gl-icon-btn--dim        { opacity: 0.3; cursor: default; pointer-events: none; }
.gl-map-open:hover       { color: var(--erpnx-accent); }
.fd-draw-btn--has        { color: var(--erpnx-accent); }

/* ── Badge ────────────────────────────────────────────────────────────────── */
.gl-badge {
    position: absolute; top: -4px; right: -5px;
    min-width: 14px; height: 14px; padding: 0 3px;
    background: var(--erpnx-accent); color: #fff;
    font-size: 9px; font-weight: 500; line-height: 14px;
    border-radius: 7px; box-sizing: border-box;
    pointer-events: none; text-align: center;
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
.gl-empty {
    padding: 32px; text-align: center;
    color: var(--text-muted, #adb5bd); font-size: var(--erpnx-font); font-weight: 400;
    border-bottom: var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
    border-right:  var(--erpnx-border-w) solid var(--border-color, #e2e8f0);
}

/* ── Attachment preview ───────────────────────────────────────────────────── */
.gl-att-preview      { margin-bottom: 12px; }
.gl-att-preview-lbl  { font-size: 11px; text-transform: uppercase; color: #8d96a0; letter-spacing: .04em; margin-bottom: 8px; }
.gl-att-list         { display: flex; flex-wrap: wrap; gap: 10px; }
.gl-att-thumb-wrap   { display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; color: inherit; max-width: 90px; }
.gl-att-thumb        { width: 80px; height: 80px; object-fit: cover; border-radius: var(--erpnx-cell-radius); border: 1px solid var(--border-color, #e2e6ea); }
.gl-att-thumb:hover  { opacity: .85; }
.gl-att-thumb-lbl    { font-size: 10.5px; color: #8d96a0; text-align: center; width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gl-att-chip         { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: var(--erpnx-cell-radius); border: 1px solid var(--border-color, #e2e6ea); background: var(--bg-light-gray, #f7f9fa); text-decoration: none; color: var(--text-color, #1f272e); font-size: var(--erpnx-font); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gl-att-chip:hover   { background: #eef2f5; border-color: #c8d0d8; }
.gl-att-divider      { border: none; border-top: 1px solid var(--border-color, #e2e6ea); margin: 12px 0; }

/* ── Attachment dialog rows ───────────────────────────────────────────────── */
.gl-dlg-upload-area  { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 12px; background: var(--bg-light-gray, #f7f9fa); border: var(--erpnx-border-w) dashed var(--border-color, #e2e6ea); border-radius: var(--erpnx-cell-radius); }
.gl-dlg-upload-btn   { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--erpnx-cell-radius); border: var(--erpnx-border-w) solid var(--erpnx-accent); background: #fff; color: var(--erpnx-accent); font-size: var(--erpnx-font); font-weight: 500; cursor: pointer; white-space: nowrap; transition: background .12s; }
.gl-dlg-upload-btn:hover { background: #f0f7ff; }
.gl-dlg-upload-or    { font-size: 11px; color: var(--text-muted, #8d96a0); }
.gl-dlg-head         { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; color: #8d96a0; letter-spacing: .04em; }
.gl-dlg-col-label    { flex: 0 0 160px; }
.gl-dlg-col-url      { flex: 1 1 auto; }
.gl-dlg-col-act      { flex: 0 0 32px; }
.gl-dlg-row          { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
.gl-dlg-row .gl-dlg-label { flex: 0 0 160px; }
.gl-dlg-url-wrap     { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.gl-dlg-pbar         { height: 3px; background: var(--border-color, #e2e6ea); border-radius: 2px; overflow: hidden; }
.gl-dlg-prog         { height: 100%; background: var(--erpnx-accent); border-radius: 2px; transition: width .15s; }
.gl-dlg-del          { flex: 0 0 32px; text-align: center; cursor: pointer; color: #c0392b; background: none; border: none; font-size: 16px; padding-top: 4px; }
.gl-dlg-del:disabled { opacity: .35; cursor: default; }
.gl-dlg-add-link     { margin-top: 4px; }

/* ── Attachment icon area (shared) ───────────────────────────────────────── */
.gl-attach-list  { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.gl-attach-row   { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: var(--erpnx-grid-radius); border: var(--erpnx-border-w) solid var(--border-color, #e2e8f0); }
.gl-attach-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: var(--erpnx-cell-radius); }
.gl-attach-icon  { width: 48px; height: 48px; border-radius: var(--erpnx-cell-radius); background: var(--bg-light-gray, #f1f3f5); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--text-muted, #6c757d); }
.gl-attach-info  { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.gl-attach-label { flex: 1; font-size: var(--erpnx-font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gl-attach-link  { color: var(--text-muted, #adb5bd); flex-shrink: 0; }
.gl-attach-link:hover { color: var(--erpnx-accent); }
.gl-del-attach   { background: none; border: none; cursor: pointer; color: var(--text-muted, #adb5bd); padding: 3px; border-radius: var(--erpnx-cell-radius); flex-shrink: 0; transition: color .12s, background .12s; }
.gl-del-attach:hover { color: var(--text-danger, #e53935); background: var(--bg-light-gray, #f7f8fa); }
.gl-no-attach    { text-align: center; color: var(--text-muted, #adb5bd); padding: 16px 0; font-size: var(--erpnx-font); }

/* ── Measure/MTO dialog ───────────────────────────────────────────────────── */
.gl-mto-dialog   { display: flex; flex-direction: column; gap: 0; }
.gl-mto-head     { display: grid; grid-template-columns: 1fr 120px 90px 32px; gap: 8px; padding: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #8d96a0; letter-spacing: .04em; }
.gl-mto-row      { display: grid; grid-template-columns: 1fr 120px 90px 32px; gap: 8px; align-items: center; margin-bottom: 6px; }
.gl-mto-del      { width: 32px; text-align: center; cursor: pointer; color: #c0392b; background: none; border: none; font-size: 16px; }
.gl-mto-add      { margin-top: 4px; align-self: flex-start; }

/* ── Sticky (frozen) columns ─────────────────────────────────────────────────
   Columns with { sticky: true } in their COLS definition get position:sticky
   and a frosted-glass background so content scrolls behind them cleanly.
   The last sticky col gets a soft right-edge shadow as a premium divider.    */
.gl-col--sticky {
    position: sticky;
    z-index: 3;
    background: color-mix(in srgb, var(--card-bg, #fff) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
.gl-col--sticky-last {
    box-shadow: 4px 0 14px rgba(0,0,0,.07);
}
.gl-hdr.gl-col--sticky {
    z-index: 14; /* above normal headers (10) */
}
/* Hover / selection states must work even under backdrop-filter */
.gl-col--sticky.gl-row-hover:not(.gl-hdr):not(.gl-rn) {
    background: color-mix(in srgb, var(--bg-light-gray, #f7f8fa) 90%, transparent);
}
.gl-col--sticky.gl-row--sel:not(.gl-hdr):not(.gl-rn) {
    background: color-mix(in srgb, var(--erpnx-accent) 10%, transparent) !important;
}

/* ── Row selection ────────────────────────────────────────────────────────── */
.gl-rn--sel  { background: var(--erpnx-accent) !important; color: #fff !important; }
.gl-row--sel { background: color-mix(in srgb, var(--erpnx-accent) 8%, transparent) !important; }
.gl-del-sel-btn { white-space: nowrap; }
`;

    // ── Public API ─────────────────────────────────────────────────────────────
    window.GL = {
        // Icons
        SVG,
        // CSS
        injectBaseStyles,
        injectDoctypeHide,
        // Listview
        suppressRefresh,
        hideNative,
        bootstrap,
        // Layout
        gridTpl,
        rnCell,
        rnHeader,
        computeStickyOffsets,
        // Renderers
        renderText,
        renderLink,
        renderUrl,
        renderSelect,
        renderDate,
        renderStatus,
        renderDatetime,
        renderAvatar,
        renderMaps,
        renderArea,
        renderAttachBtn,
        renderDrawingBtn,
        renderMeasureBtn,
        renderNumber,
        // State
        editState,
        makeLinkNameCache,
        makeColWidths,
        makeCountCache,
        // Save / delete
        fastSave,
        saveLinkedField,
        deleteRow,
        // Upserts
        upsertCompany,
        upsertUser,
        upsertEmployee,
        // Binders
        bindHover,
        bindDelete,
        bindColResize,
        bindHScroll,
        bindOutsideClick,
        bindTextEdit,
        bindUrlEdit,
        bindDateEdit,
        bindLinkEdit,
        bindSelectChange,
        bindAddRow,
        bindAreaAutogrow,
        bindAreaSave,
        bindMapsToggle,
        bindMapsEdit,
        bindNumberChange,
        bindAvatarAutocomplete,
        bindDrawings,
        bindAttachments,
        bindMeasurements,
        bindRowSelect,
        // Dialogs
        openAttachDialog,
        openMeasureDialog,
        // PG helpers
        hideChrome,
        pgRender,
    };

    // ── Shared PG list helpers ────────────────────────────────────────────────

    // Hides all Frappe native chrome for any list view
    function hideChrome(lv) {
        lv.$page.find([
            ".page-head", ".page-form",
            ".standard-filter-section", ".filter-section",
            ".sort-selector", ".filter-selector",
            ".list-filters-area", ".list-filter-area",
            ".sort-filter-area", ".tag-filters-area",
            ".list-header-meta", ".list-toolbar-wrapper", ".list-toolbar",
            ".list-row-head", ".list-headers", ".list-subjects",
            "header.frappe-list-head",
        ].join(",")).hide();
    }

    // Standard PG render loop: fetch → map → mount → stats
    // opts: { doctype, fields, orderBy, mapFn(raw,i)→row, cfg, statsFn(raw)→cards[], addDoc }
    function pgRender(lv, opts) {
        const host = GL.bootstrap(lv, { doctype: opts.doctype });
        if (!host) return;
        GL.hideNative(lv);
        host.innerHTML = `<div class="pl-loading">Loading…</div>`;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: opts.doctype,
                fields: opts.fields,
                limit_page_length: opts.limit || 500,
                order_by: opts.orderBy || "creation desc",
            },
            callback(r) {
                if (!document.contains(host)) return;
                const raw  = r.message || [];
                const rows = raw.map((d, i) => opts.mapFn(d, i));
                const cfg  = Object.assign({}, opts.cfg, {
                    rows,
                    onReload() { pgRender(lv, opts); },
                    onEdit(name, ff, val) {
                        frappe.db.set_value(opts.doctype, name, ff, val)
                            .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
                    },
                    onAddRow: opts.onAddRow ? (reload) => opts.onAddRow(reload, lv) : undefined,
                    onDeleteRows(names, reload) {
                        const lbl = names.length === 1 ? `1 ${opts.doctype.toLowerCase()}` : `${names.length} records`;
                        frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                            let done = 0;
                            names.forEach(n => frappe.call({
                                method: "frappe.client.delete",
                                args: { doctype: opts.doctype, name: n },
                                callback() { if (++done === names.length) { frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2); reload(); } },
                            }));
                        });
                    },
                });
                PG.mount(host, cfg);
                if (opts.statsFn) PG.renderStats(host, opts.statsFn(raw));
            },
        });
    }

    // Inject base styles as soon as this script loads
    injectBaseStyles();
})();
