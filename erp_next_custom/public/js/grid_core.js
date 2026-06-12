/**
 * grid_core.js — shared spreadsheet-grid engine
 * Loaded globally via app_include_js. Exposes window.GL.
 *
 * Each doctype list-view file calls GL.* instead of duplicating logic.
 * CRM Log keeps its own internals (avatar, maps, textarea, localStorage widths)
 * but can migrate incrementally.
 */
(function () {
    "use strict";

    // ── Shared SVG icons ──────────────────────────────────────────────────────
    const SVG = {
        paperclip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
        trash:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
        external:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
        del:       `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    };

    // ── CSS injection ─────────────────────────────────────────────────────────
    const STYLE_VERSION = "gl-v3";

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

    // Inject doctype-specific hide rules (called once per doctype on bootstrap)
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

    // ── Listview helpers ──────────────────────────────────────────────────────
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

    /**
     * bootstrap — call in onload. Injects CSS, creates host div, returns it.
     * opts: { doctype, hostClass?, scrollable? }
     */
    function bootstrap(listview, opts = {}) {
        injectBaseStyles();
        injectDoctypeHide(opts.doctype || "");

        const $result = listview.$result || listview.$page.find(".list-result");
        if (!$result.length) return null;

        // Re-use existing host on re-render
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

    // ── Grid template ─────────────────────────────────────────────────────────
    /**
     * Returns the CSS gridTemplateColumns string.
     * Each col can have `width` (px, default) or `fr` (fractional).
     * colWidths = { [field]: px } user-overrides from resizing.
     */
    function gridTpl(cols, colWidths) {
        const tracks = cols.map(c => {
            if (colWidths[c.field]) return `${colWidths[c.field]}px`;
            if (c.fr != null)       return `${c.fr}fr`;
            return `${c.width || 120}px`;
        });
        return ["42px", ...tracks].join(" ");
    }

    // ── Rownum cell HTML ──────────────────────────────────────────────────────
    function rnCell(doc, ri) {
        return (
            `<div class="gl-cell gl-rn" data-name="${doc.name}">` +
            `<span class="gl-rn-num">${ri + 1}</span>` +
            `<button class="gl-rn-del" data-name="${doc.name}" title="${frappe.utils.escape_html(__("Delete"))}">${SVG.del}</button>` +
            `</div>`
        );
    }

    function rnHeader() {
        return `<div class="gl-cell gl-hdr gl-rn">#</div>`;
    }

    // ── Cell renderers ────────────────────────────────────────────────────────
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

    // ── Edit state manager ────────────────────────────────────────────────────
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

    // ── Save ──────────────────────────────────────────────────────────────────
    const _GL_SAVING = {};

    function fastSave(doctype, name, field, value) {
        const key = `${doctype}::${name}::${field}`;
        if (_GL_SAVING[key]) return Promise.reject("in-flight");
        _GL_SAVING[key] = true;
        return frappe.client.set_value(doctype, name, field, value)
            .then(r  => { delete _GL_SAVING[key]; return r; })
            .catch(e => { delete _GL_SAVING[key]; throw e; });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
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

    // ── Event binders ─────────────────────────────────────────────────────────

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

    function bindColResize($grid, cols, colWidths, getTpl) {
        $grid.on("mousedown.gl-rz", ".gl-rh", function (e) {
            e.preventDefault();
            const ci    = parseInt($(this).attr("data-col"), 10);
            const col   = cols[ci];
            const startX = e.clientX;
            const computed = getComputedStyle($grid[0]).gridTemplateColumns.split(" ");
            const startW = parseFloat(computed[ci + 1]) || (col.fr ? col.fr * 100 : col.width) || 120;
            const onMove = ev => {
                colWidths[col.field] = Math.max(40, startW + (ev.clientX - startX));
                $grid[0].style.gridTemplateColumns = getTpl();
            };
            $(document)
                .on("mousemove.gl-rz", onMove)
                .on("mouseup.gl-rz", () => $(document).off("mousemove.gl-rz mouseup.gl-rz"));
        });
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
            if (type === "date") return; // handled by bindDateEdit
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            esm.set(name);
            const $i = $(`<input class="gl-inp" type="${type}" value="${frappe.utils.escape_html(cur)}">`);
            $s.html($i); $i.focus().select();
            $i.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); $i.blur(); }
                if (ev.key === "Escape") $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`);
            });
            $i.on("blur", function () {
                const v = $(this).val().trim();
                if (v === cur) { $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); return; }
                saveFn(name, field, v)
                    .then(() => { if (doc) doc[field] = v; $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); })
                    .catch(() => { $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`); });
            });
        });
    }

    // URL click-to-open + edit on text-type URLs
    function bindUrlEdit($grid, rows, saveFn, esm) {
        $grid.on("click.gl-ue", ".gl-d-url", function (e) {
            if ($(this).find("input").length) return;
            if (e.ctrlKey || e.metaKey) return;
            const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
            const doc = rows.find(r => r.name === name);
            const cur = doc?.[field] || "";
            // Single click → open if URL exists
            if (cur && !$(this).find("input").length) {
                window.open(/^https?:\/\//i.test(cur) ? cur : `https://${cur}`, "_blank", "noopener");
                return;
            }
            // Fall through to inline edit when URL is empty
            esm.set(name);
            const $i = $(`<input class="gl-inp" type="url" value="${frappe.utils.escape_html(cur)}">`);
            $s.html($i); $i.focus().select();
            $i.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); $i.blur(); }
                if (ev.key === "Escape") $s.html(frappe.utils.escape_html(cur) || `<span class="gl-ph">—</span>`);
            });
            $i.on("blur", function () {
                const v = $(this).val().trim();
                if (v === cur) { $s.html(frappe.utils.escape_html(v) || `<span class="gl-ph">—</span>`); return; }
                saveFn(name, field, v)
                    .then(() => { if (doc) doc[field] = v; $s.html(frappe.utils.escape_html(v) ? `<span class="gl-d-url">${frappe.utils.escape_html(v)}</span>` : `<span class="gl-ph">—</span>`); })
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
            esm.set(name);
            const $i = $(`<input class="gl-inp" type="date" value="${cur}">`);
            $s.html($i); $i.focus();
            const fmt = v => v ? frappe.utils.escape_html(frappe.datetime.str_to_user(v)) : `<span class="gl-ph">—</span>`;
            const commit = () => {
                const v = $i.val();
                if (v === cur) { $s.html(fmt(v)); return; }
                saveFn(name, field, v || null)
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
            esm.set(name);

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
                saveFn(name, field, v || null)
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
            saveFn(name, field, v).then(() => { if (doc) doc[field] = v; });
        });
    }

    function bindAddRow($host, addFn) {
        $host.off("click.gl-add").on("click.gl-add", ".gl-add-btn", addFn);
    }

    // ── Shared CSS ────────────────────────────────────────────────────────────
    const BASE_CSS = `
/* ── Host ────────────────────────────────────────────────────────────────── */
.gl-host { width: 100%; }
.gl-host--scroll { overflow-x: auto; }

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.gl-toolbar { display: flex; align-items: center; padding: 9px 12px; gap: 8px; }
.gl-add-btn { display: inline-flex; align-items: center; gap: 6px; }
.gl-add-icon { font-size: 14px; line-height: 1; font-weight: 500; }

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.gl-grid {
    display: grid;
    border: 0.5px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    overflow: hidden;
    font-size: 12px;
    font-weight: 400;
    background: var(--card-bg, #fff);
}
.gl-grid--scroll { min-width: max-content; }
.gl-grid--fill   { width: 100%; }

/* ── Cells ────────────────────────────────────────────────────────────────── */
.gl-cell {
    display: flex; align-items: center;
    border-right: 0.5px solid var(--border-color, #e2e8f0);
    border-bottom: 0.5px solid var(--border-color, #e2e8f0);
    padding: 5px 8px; min-height: 34px;
    overflow: hidden; position: relative;
    background: var(--card-bg, #fff);
    transition: background 0.1s;
    min-width: 0;
}

.gl-cell.gl-row-hover:not(.gl-hdr):not(.gl-rn) { background: var(--bg-light-gray, #f7f8fa); }
.gl-cell.gl-editing:not(.gl-hdr):not(.gl-rn)   { background: var(--bg-light-gray, #f7f8fa); }
.gl-cell.gl-editing-first { border-left: 2px solid #378ADD; }

/* ── Header ───────────────────────────────────────────────────────────────── */
.gl-hdr {
    background: var(--card-bg, #fff) !important;
    font-size: 11px; font-weight: 500;
    color: var(--text-muted, #6c757d);
    user-select: none; cursor: default;
    padding: 6px 8px; justify-content: center;
}

/* ── Resize handle ────────────────────────────────────────────────────────── */
.gl-rh {
    position: absolute; right: 0; top: 0; bottom: 0;
    width: 6px; cursor: col-resize;
}
.gl-rh:hover { background: rgba(55,138,221,0.30); }

/* ── Row-number gutter ────────────────────────────────────────────────────── */
.gl-rn {
    justify-content: center;
    color: var(--text-muted, #adb5bd);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    user-select: none; cursor: default;
}
.gl-rn.gl-row-hover:not(.gl-hdr) { background: var(--bg-light-gray, #f7f8fa); }
.gl-rn.gl-editing:not(.gl-hdr)   { background: var(--bg-light-gray, #f7f8fa); }

/* Delete: shows on row-number hover, replaces the number */
.gl-rn-del {
    display: none;
    align-items: center; justify-content: center;
    width: 20px; height: 20px;
    border: none; border-radius: 6px;
    background: none; cursor: pointer;
    color: var(--text-danger, #e03737);
    transition: background 0.12s;
    padding: 0;
}
.gl-rn-del:hover { background: rgba(224,55,55,0.10); }
.gl-cell.gl-rn:not(.gl-hdr):hover .gl-rn-num { display: none; }
.gl-cell.gl-rn:not(.gl-hdr):hover .gl-rn-del { display: flex; }

/* ── Display spans ────────────────────────────────────────────────────────── */
.gl-d {
    display: block; width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    cursor: text; line-height: 1.4;
    padding: 3px 4px; border-radius: 8px;
    border: 0.5px solid transparent;
    font-size: 12px; font-weight: 400;
}
.gl-d:focus { outline: 1.5px solid #378ADD; outline-offset: -1px; border-color: #378ADD; }
.gl-ph      { color: var(--text-muted, #adb5bd); font-style: italic; }

.gl-d-url  { cursor: pointer; color: #378ADD; text-decoration: underline dotted; }
.gl-link-val { color: #378ADD; }
.gl-d-link { cursor: text; }

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
    border: 0.5px solid #378ADD;
    outline: 1.5px solid #378ADD;
    outline-offset: -1px;
    border-radius: 8px; padding: 2px 6px;
    font-size: 12px; font-weight: 400;
    background: var(--card-bg, #fff);
    font-family: inherit;
}

/* ── Select ───────────────────────────────────────────────────────────────── */
.gl-sel {
    width: 100%; border: none; background: transparent;
    font-size: 12px; font-weight: 400; cursor: pointer; outline: none;
    font-family: inherit;
}
.gl-sel:focus { outline: 1.5px solid #378ADD; outline-offset: -1px; border-radius: 8px; }

/* ── Link dropdown ────────────────────────────────────────────────────────── */
.gl-lw { position: relative; width: 100%; }
.gl-dd {
    position: absolute; top: 100%; left: 0; right: 0;
    background: var(--card-bg, #fff);
    border: 0.5px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,.12);
    z-index: 9999; max-height: 200px; overflow-y: auto;
    display: none; padding: 4px;
}
.gl-dd-item {
    padding: 6px 10px; font-size: 12px; font-weight: 400;
    cursor: pointer; border-radius: 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gl-dd-item:hover { background: var(--bg-light-gray, #f7f8fa); color: #378ADD; }

/* ── Empty state ──────────────────────────────────────────────────────────── */
.gl-empty {
    padding: 32px; text-align: center;
    color: var(--text-muted, #adb5bd); font-size: 12px; font-weight: 400;
    border-bottom: 0.5px solid var(--border-color, #e2e8f0);
    border-right: 0.5px solid var(--border-color, #e2e8f0);
}

/* ── Attachment dialog (shared by contacts + CRM) ────────────────────────── */
.gl-attach-list  { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.gl-attach-row   { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; border: 0.5px solid var(--border-color, #e2e8f0); }
.gl-attach-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
.gl-attach-icon  { width: 48px; height: 48px; border-radius: 8px; background: var(--bg-light-gray, #f1f3f5); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 500; color: var(--text-muted, #6c757d); }
.gl-attach-info  { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.gl-attach-label { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gl-attach-link  { color: var(--text-muted, #adb5bd); flex-shrink: 0; }
.gl-attach-link:hover { color: #378ADD; }
.gl-del-attach {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted, #adb5bd); padding: 3px; border-radius: 8px; flex-shrink: 0;
    transition: color 0.12s, background 0.12s;
}
.gl-del-attach:hover { color: var(--text-danger, #e53935); background: var(--bg-light-gray, #f7f8fa); }
.gl-no-attach { text-align: center; color: var(--text-muted, #adb5bd); padding: 16px 0; font-size: 12px; }

/* ── Attachment / icon button ─────────────────────────────────────────────── */
.gl-icon-btn {
    position: relative;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted, #6c757d);
    padding: 0; display: flex; align-items: center; gap: 3px;
    pointer-events: auto;
}
.gl-icon-btn .gl-badge {
    position: absolute; top: -1px; right: -3px;
    background: #378ADD; color: #fff;
    border-radius: 8px; font-size: 9px; font-weight: 500;
    padding: 0 4px; min-width: 14px; text-align: center; line-height: 14px;
}
`;

    // ── Public API ────────────────────────────────────────────────────────────
    window.GL = {
        SVG,
        injectBaseStyles,
        injectDoctypeHide,
        suppressRefresh,
        hideNative,
        bootstrap,
        gridTpl,
        rnCell,
        rnHeader,
        // Renderers
        renderText,
        renderLink,
        renderUrl,
        renderSelect,
        renderDate,
        renderStatus,
        // State
        editState,
        // Save / delete
        fastSave,
        deleteRow,
        // Binders
        bindHover,
        bindDelete,
        bindColResize,
        bindOutsideClick,
        bindTextEdit,
        bindUrlEdit,
        bindDateEdit,
        bindLinkEdit,
        bindSelectChange,
        bindAddRow,
    };

    // Inject base CSS as soon as this script loads
    injectBaseStyles();
})();
