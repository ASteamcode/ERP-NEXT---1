// site_survey_list.js — built on GL (grid_core.js)
"use strict";

const SS_DOCTYPE         = "Site Survey";
const SS_ATTACH_DT       = "Site Survey Attachment";
const SS_ATTACH_FIELD    = "attachments";
const SS_MEASURE_DT      = "Site Survey Measurement";
const SS_MEASURE_FIELD   = "measurements";

const SS_COLS = [
    { field: "status",          label: "Status",        type: "select",  width: 130, options: ["Draft","Scheduled","In Progress","Completed","Cancelled"] },
    { field: "survey_date",     label: "Date",          type: "date",    width: 120 },
    { field: "assigned_to",     label: "Surveyor",      type: "avatar",  width: 52 },
    { field: "customer",        label: "Customer",      type: "link",    width: 160, link_doctype: "Customer",  link_namefield: "customer_name" },
    { field: "lead",            label: "Lead",          type: "link",    width: 160, link_doctype: "Lead",      link_namefield: "lead_name" },
    { field: "contact",         label: "Contact",       type: "link",    width: 150, link_doctype: "Contact",   link_namefield: "first_name" },
    { field: "site_location",   label: "Site Location", type: "text",    width: 160 },
    { field: "google_maps_url", label: "Maps",          type: "maps",    width: 120 },
    { field: "site_type",       label: "Site Type",     type: "select",  width: 130, options: ["","Residential","Commercial","Industrial"] },
    { field: "roof_type",       label: "Roof Type",     type: "select",  width: 120, options: ["","Flat","Pitched","Mixed","N/A"] },
    { field: "site_area",       label: "Area (m²)",     type: "number",  width: 100 },
    { field: "notes",           label: "Notes",         type: "area",    width: 200 },
    { field: "updates",         label: "Updates",       type: "area",    width: 200 },
    { field: "attachments",     label: "Files",         type: "attach",  width: 52 },
    { field: "drawing",         label: "Drawing",       type: "drawing", width: 52 },
    { field: "measurements",    label: "Measure",       type: "measure", width: 52 },
    { field: "name",            label: "→ MTO",         type: "nav-mto", width: 52 },
];

const SS_FIELDS = [
    ...SS_COLS.filter(c => !["attachments","drawing","measurements"].includes(c.field)).map(c => c.field),
    "name", "attachments", "has_drawing", "has_measurements",
];

const _SS_COL_WIDTHS = {};

// State
const _SS_ATTACH_COUNTS  = new Map();
const _SS_MEASURE_COUNTS = new Map();
const _SS_LINK_NAMES     = new Map();
const _SS_LINK_PENDING   = new Set();
let   _SS_CURRENT_LISTVIEW = null;

const SS_LINK_CFG = {
    assigned_to: { doctype: "User",     namefield: "full_name",     searchfield: "full_name",     sub: "email",        id: "name" },
    customer:    { doctype: "Customer", namefield: "customer_name", searchfield: "customer_name", sub: "",             id: "name" },
    lead:        { doctype: "Lead",     namefield: "lead_name",     searchfield: "lead_name",     sub: "company_name", id: "name" },
    contact:     { doctype: "Contact",  namefield: "first_name",    searchfield: "first_name",    sub: "company_name", id: "name" },
};

// ── Entry point ────────────────────────────────────────────────────────────────
frappe.listview_settings["Site Survey"] = {
    hide_name_column: true,
    add_fields: SS_FIELDS,

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: SS_DOCTYPE });
    },

    refresh(listview) {
        _ss_render(listview);
    },
};

// ── Render ─────────────────────────────────────────────────────────────────────
function _ss_render(listview) {
    _SS_CURRENT_LISTVIEW = listview;
    const host = GL.bootstrap(listview, { doctype: SS_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _ss_paint(listview, host, listview.data || []);
    _ss_inject_styles();
}

function _ss_paint(listview, host, rows) {
    const cols   = SS_COLS;
    const getTpl = () => GL.gridTpl(cols, _SS_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add Row")}</button>`;

    const html = [GL.rnHeader()];
    cols.forEach((col, ci) => {
        html.push(`<div class="gl-cell gl-hdr" data-col="${ci}" data-field="${col.field}"><span>${__(col.label)}</span><div class="gl-rh" data-col="${ci}"></div></div>`);
    });

    if (!rows.length) {
        html.push(`<div class="gl-empty" style="grid-column:1/${cols.length + 2}">${__("No records yet — add your first row below.")}</div>`);
    }

    rows.forEach((doc, ri) => {
        html.push(GL.rnCell(doc, ri));
        cols.forEach((col, ci) => {
            html.push(`<div class="gl-cell" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}">${_ss_cell(col, doc)}</div>`);
        });
    });

    const grid = document.createElement("div");
    grid.className = "gl-grid gl-grid--scroll";
    grid.style.gridTemplateColumns = getTpl();
    grid.innerHTML = html.join("");

    host.innerHTML = "";
    host.className = "gl-host gl-host--scroll";
    host.appendChild(toolbar);
    host.appendChild(grid);

    _ss_bind(listview, host, rows, cols, getTpl);
}

// ── Cell renderers ─────────────────────────────────────────────────────────────
function _ss_cell(col, doc) {
    const raw = doc[col.field];
    switch (col.type) {
        case "select":  return GL.renderSelect(col, doc.name, raw);
        case "date":    return GL.renderDate(col, doc.name, raw);
        case "text":    return GL.renderText(col, doc.name, raw, "text");
        case "avatar":  return _ss_render_avatar(col, doc.name, raw);
        case "link":    return _ss_render_link(col, doc.name, raw);
        case "maps":    return _ss_render_maps(col, doc.name, raw);
        case "area":    return _ss_render_area(col, doc.name, raw);
        case "number":  return _ss_render_number(col, doc.name, raw);
        case "attach":  return _ss_render_attach(doc.name, raw);
        case "drawing":  return frappe_drawing.render_btn(doc.name, doc.has_drawing);
        case "measure":  return _ss_render_measure(doc.name, doc);
        case "nav-mto":  return `<button class="gl-icon-btn ss-nav-mto-btn" data-survey="${frappe.utils.escape_html(doc.name)}" title="${__("View Measurements Take Off")}">→</button>`;
        default:         return GL.renderText(col, doc.name, raw, "text");
    }
}

function _ss_resolve_name(fieldname, id) {
    const cfg = SS_LINK_CFG[fieldname];
    if (!cfg || !id) return null;
    const key = `${cfg.doctype}::${id}`;
    if (_SS_LINK_NAMES.has(key)) return _SS_LINK_NAMES.get(key);
    if (!_SS_LINK_PENDING.has(key)) {
        _SS_LINK_PENDING.add(key);
        frappe.db.get_value(cfg.doctype, id, cfg.namefield, r => {
            _SS_LINK_PENDING.delete(key);
            _SS_LINK_NAMES.set(key, r?.[cfg.namefield] || id);
            if (_SS_CURRENT_LISTVIEW) _ss_render(_SS_CURRENT_LISTVIEW);
        });
    }
    return null;
}

function _ss_render_avatar(col, name, raw) {
    const display = raw ? (_ss_resolve_name(col.field, raw) || raw) : "";
    const initial = display ? display.charAt(0).toUpperCase() : "?";
    const hue     = display ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
    return (
        `<div class="ss-avatar-wrap">` +
        `<div class="ss-avatar" style="--h:${hue}" title="${frappe.utils.escape_html(display)}">${initial}</div>` +
        `<input type="text" class="ss-avatar-input" data-name="${name}" data-field="${col.field}" data-link="User"` +
        ` value="${frappe.utils.escape_html(display)}" placeholder="${__("user…")}" autocomplete="off">` +
        `</div>`
    );
}

function _ss_render_link(col, name, raw) {
    const display = raw ? (_ss_resolve_name(col.field, raw) || raw) : "";
    const v = frappe.utils.escape_html(display);
    return (
        `<span class="ss-lnk" data-name="${name}" data-field="${col.field}"` +
        ` data-link="${col.link_doctype || ""}" data-link-nf="${col.link_namefield || ""}"` +
        ` tabindex="0" title="${v}">` +
        (display ? v : `<span class="gl-ph">—</span>`) +
        `</span>`
    );
}

function _ss_render_area(col, name, raw) {
    return `<textarea class="ss-area" data-name="${name}" data-field="${col.field}" rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`;
}

function _ss_render_number(col, name, raw) {
    const v = raw != null && raw !== "" ? raw : "";
    return `<input type="number" class="ss-num" data-name="${name}" data-field="${col.field}" value="${v}" placeholder="—" step="any">`;
}

const _SS_SVG = {
    map:   `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    pen:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    ruler: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`,
};

function _ss_render_maps(col, name, raw) {
    const esc    = frappe.utils.escape_html(raw || "");
    const mapBtn = raw
        ? `<a href="${esc}" target="_blank" class="gl-icon-btn ss-map-open" title="${__("Open map")}">${_SS_SVG.map}</a>`
        : `<span class="gl-icon-btn ss-map-open--off">${_SS_SVG.map}</span>`;
    return (
        `<div class="ss-map-cell">` +
        `<span class="ss-map-disp" title="${esc}">${raw ? __("URL set") : `<span class="gl-ph">${__("No URL")}</span>`}</span>` +
        `<input type="text" class="ss-map-inp" data-name="${name}" data-field="${col.field}" value="${esc}" placeholder="${__("Paste Google Maps URL…")}" style="display:none">` +
        `<button class="gl-icon-btn ss-map-pen" data-name="${name}" title="${__("Edit URL")}">${_SS_SVG.pen}</button>` +
        mapBtn +
        `</div>`
    );
}

function _ss_attach_count(name, raw) {
    if (Array.isArray(raw)) { _SS_ATTACH_COUNTS.set(name, raw.length); return raw.length; }
    return _SS_ATTACH_COUNTS.get(name) ?? 0;
}

function _ss_render_attach(name, raw) {
    const count = _ss_attach_count(name, raw);
    const badge = count ? `<span class="gl-badge">${count}</span>` : "";
    return `<button class="gl-icon-btn ss-attach-btn" data-name="${name}" title="${count} file(s)">${GL.SVG.paperclip}${badge}</button>`;
}

function _ss_render_measure(name, doc) {
    const count = doc?.has_measurements ? (_SS_MEASURE_COUNTS.get(name) || "✓") : 0;
    const badge = count ? `<span class="gl-badge">${count}</span>` : "";
    return `<button class="gl-icon-btn ss-measure-btn" data-name="${name}" title="${__("Measurements")}">${_SS_SVG.ruler}${badge}</button>`;
}

// ── Event binding ──────────────────────────────────────────────────────────────
function _ss_bind(listview, host, rows, cols, getTpl) {
    const $host = $(host);
    const $grid = $host.find(".gl-grid");
    const esm   = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(SS_DOCTYPE, name, field, val);

    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _SS_COL_WIDTHS, getTpl);

    // Custom delete: warn if linked MTOs exist
    $grid.on("click.ss-del", ".gl-rn-del", function (e) {
        e.stopPropagation();
        const docname = $(this).attr("data-name");
        frappe.db.count("Measurement Take Off", { site_survey: docname }).then(count => {
            const msg = count > 0
                ? __("This Site Survey has {0} linked Measurement Take Off(s). They will remain but lose their survey link. Delete this Site Survey anyway?", [count])
                : __("Delete this Site Survey? This cannot be undone.");
            frappe.confirm(msg, () => {
                frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: SS_DOCTYPE, name: docname },
                    callback: ({ exc }) => {
                        if (exc) return;
                        frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.2);
                        listview.data = (listview.data || []).filter(d => d.name !== docname);
                        _ss_render(listview);
                    },
                });
            });
        });
    });
    GL.bindSelectChange($grid, rows, saveFn);
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindDateEdit($grid, rows, saveFn, esm);
    GL.bindOutsideClick($grid, esm, "ss");
    GL.bindAddRow($host, () => _ss_add_row(listview));

    $grid.on("click.ss", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const n = $(this).attr("data-name"); if (n) esm.set(n);
    });
    $grid.on("dblclick.ss", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const n = $(this).attr("data-name"); if (n) frappe.set_route("Form", SS_DOCTYPE, n);
    });

    // Area autogrow + save
    const autogrow = function () { this.style.height = "auto"; this.style.height = `${this.scrollHeight}px`; };
    $grid.on("input.ss-area", ".ss-area", autogrow);
    $grid.find(".ss-area").each(autogrow);
    $grid.on("blur.ss-area", ".ss-area", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = $el.val(), row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        saveFn(name, field, val).then(() => { if (row) row[field] = val; });
    });

    // Number save
    $grid.on("blur.ss-num keydown.ss-num", ".ss-num", function (e) {
        if (e.type === "keydown" && e.key !== "Enter") return;
        if (e.type === "keydown") { $(this).trigger("blur"); return; }
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = $el.val().trim(), row = rows.find(r => r.name === name);
        const cur = row?.[field] != null ? String(row[field]) : "";
        if (!name || !field || val === cur) return;
        saveFn(name, field, val || null).then(() => { if (row) row[field] = val; });
    });

    // Link cells click-to-edit
    _ss_bind_link_edit($grid, rows, listview, esm, saveFn);

    // Avatar blur → save
    $grid.on("blur.ss-av", ".ss-avatar-input", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        if (!name || !field || !val) return;
        saveFn(name, field, val).then(() => {
            const row = rows.find(r => r.name === name);
            if (row) row[field] = val;
        });
    });

    // Maps toggle + save
    $grid.on("click.ss-map", ".ss-map-pen", function (e) {
        e.stopPropagation();
        const $cell = $(this).closest(".ss-map-cell");
        const $inp  = $cell.find(".ss-map-inp");
        const $disp = $cell.find(".ss-map-disp");
        if ($inp.is(":visible")) { $inp.hide(); $disp.show(); $inp.trigger("blur"); }
        else { $disp.hide(); $inp.show().focus().select(); }
    });
    $grid.on("blur.ss-map", ".ss-map-inp", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim(), row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        saveFn(name, field, val).then(() => {
            if (row) row[field] = val;
            _ss_render(listview);
        });
    });

    $grid.on("click.ss-att",  ".ss-attach-btn",  function () { _ss_open_attach_dialog(listview, $(this).attr("data-name")); });
    $grid.on("click.ss-meas", ".ss-measure-btn", function (e) { e.stopPropagation(); _ss_open_measure_dialog(listview, $(this).attr("data-name")); });

    // Navigate to MTO list filtered by this site survey
    $grid.on("click.ss-mto", ".ss-nav-mto-btn", function (e) {
        e.stopPropagation();
        frappe.route_options = { site_survey: $(this).attr("data-survey") };
        frappe.set_route("List", "Measurement Take Off");
    });
    $grid.on("click.ss-draw", ".fd-draw-btn", function (e) {
        e.stopPropagation();
        const docname = $(this).attr("data-name");
        frappe_drawing.open({
            doctype: SS_DOCTYPE, docname,
            drawing_field: "drawing", has_drawing_field: "has_drawing",
            on_saved(hasShapes) {
                const row = (listview.data || []).find(d => d.name === docname);
                if (row) row.has_drawing = hasShapes ? 1 : 0;
                _ss_render(listview);
            },
        });
    });

    _ss_bind_link_ac($grid, listview);
}

// ── Link cell click-to-edit ────────────────────────────────────────────────────
function _ss_bind_link_edit($grid, rows, listview, esm, saveFn) {
    $grid.on("click.ss-lnk", ".ss-lnk", function () {
        if ($(this).find("input").length) return;
        const $s     = $(this);
        const name   = $s.attr("data-name"), field = $s.attr("data-field");
        const linkDt = $s.attr("data-link") || "";
        const linkNf = $s.attr("data-link-nf") || "";
        const doc    = rows.find(r => r.name === name);
        const cur    = doc?.[field] || "";
        esm.set(name);

        const $i = $(`<input class="gl-inp ss-lnk-inp" type="text" autocomplete="off" value="${frappe.utils.escape_html(cur)}" data-name="${name}" data-field="${field}" data-link="${linkDt}">`);
        $s.html($i); $i.focus().select();

        $i.on("keydown", ev => {
            if (ev.key === "Enter")  { ev.preventDefault(); $i.trigger("blur"); }
            if (ev.key === "Escape") { $s.html(_ss_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)); }
        });
        $i.on("blur", function () {
            setTimeout(() => {
                const v = $(this).val().trim();
                if (!v || v === cur) { $s.html(_ss_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)); return; }
                saveFn(name, field, v).then(() => {
                    if (doc) { doc[field] = v; _SS_LINK_NAMES.delete(`${linkDt}::${v}`); }
                    _ss_render(listview);
                }).catch(() => $s.html(_ss_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)));
            }, 160);
        });
    });
}

// ── Link / avatar autocomplete ─────────────────────────────────────────────────
function _ss_bind_link_ac($grid, listview) {
    let $menu = null, activeInput = null, timer = null;

    const closeMenu = () => { if ($menu) { $menu.remove(); $menu = null; } activeInput = null; };

    const search = ($inp, typed) => {
        const doctype = $inp.attr("data-link");
        if (!doctype) return;
        const cfg = Object.values(SS_LINK_CFG).find(c => c.doctype === doctype);
        if (!cfg) return;
        const fields = [...new Set(["name", cfg.namefield, cfg.sub].filter(Boolean))];
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype, fields, filters: typed.trim() ? { [cfg.searchfield]: ["like", `%${typed.trim()}%`] } : {}, limit_page_length: 8, order_by: `${cfg.searchfield} asc` },
            callback: ({ message }) => {
                if (activeInput !== $inp[0]) return;
                if (!$menu) $menu = $(`<div class="ss-ac-menu"></div>`).appendTo(document.body);
                const items = (message || []).map(row => {
                    const primary = row[cfg.namefield] || row.name;
                    _SS_LINK_NAMES.set(`${doctype}::${row.name}`, primary);
                    const p = frappe.utils.escape_html(primary);
                    const s = cfg.sub && row[cfg.sub] ? `<span class="ss-ac-sub">${frappe.utils.escape_html(row[cfg.sub])}</span>` : "";
                    return `<div class="ss-ac-item" data-id="${frappe.utils.escape_html(row.name)}" data-val="${frappe.utils.escape_html(primary)}"><span class="ss-ac-primary">${p}</span>${s}</div>`;
                }).join("");
                if (!items) { closeMenu(); return; }
                $menu.html(items);
                const rect = $inp[0].getBoundingClientRect();
                $menu.css({ top: `${rect.bottom + window.scrollY}px`, left: `${rect.left + window.scrollX}px`, width: `${Math.max(rect.width, 220)}px` });
            },
        });
    };

    $grid.on("input.ssac focus.ssac", ".ss-lnk-inp[data-link], .ss-avatar-input[data-link]", function () {
        activeInput = this;
        const $inp = $(this);
        clearTimeout(timer);
        timer = setTimeout(() => search($inp, $inp.val() || ""), 180);
    });

    $(document).off("mousedown.ssac").on("mousedown.ssac", ".ss-ac-item", function (e) {
        e.preventDefault();
        if (!activeInput) return;
        const $inp  = $(activeInput);
        const id    = $(this).attr("data-id");
        const val   = $(this).attr("data-val");
        const dtype = $inp.attr("data-link");
        if (dtype) _SS_LINK_NAMES.set(`${dtype}::${id}`, val);
        $inp.val(id);
        closeMenu();
        $inp.trigger("blur");
    });

    $grid.on("blur.ssac", ".ss-lnk-inp, .ss-avatar-input", () => setTimeout(closeMenu, 120));
    $(document).off("click.ssacout").on("click.ssacout", e => {
        if ($menu && !$(e.target).closest(".ss-ac-menu, .ss-lnk-inp, .ss-avatar-input").length) closeMenu();
    });
}

// ── CRUD ───────────────────────────────────────────────────────────────────────
function _ss_add_row(listview) {
    frappe.call({
        method: "frappe.client.insert",
        args: { doc: { doctype: SS_DOCTYPE, status: "Draft", survey_date: frappe.datetime.get_today() } },
        callback: ({ exc, message }) => {
            if (exc || !message) return;
            frappe.show_alert({ message: __("New Row Added"), indicator: "green" }, 1.2);
            if (!Array.isArray(listview.data)) listview.data = [];
            listview.data.push(message);
            _ss_render(listview);
        },
    });
}

// ── Measurements dialog ────────────────────────────────────────────────────────
const SS_UNITS = ["m","m²","m³","cm","mm","ft","in","kg","g","L","mL","pcs","units"];

function _ss_open_measure_dialog(listview, docname) {
    frappe.call({
        method: "frappe.client.get",
        args: { doctype: SS_DOCTYPE, name: docname },
        callback: ({ message }) => {
            const existing = Array.isArray(message?.[SS_MEASURE_FIELD])
                ? message[SS_MEASURE_FIELD].map(r => ({ label: r.label || "", value: r.value ?? "", unit: r.unit || "m" }))
                : [];
            _ss_show_measure_dialog(listview, docname, existing);
        },
    });
}

function _ss_show_measure_dialog(listview, docname, existing) {
    const dialog = new frappe.ui.Dialog({
        title: __("Measurements — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "mto_html", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            const collected = [];
            dialog.$wrapper.find(".ss-mto-row").each(function () {
                const label = $(this).find(".ss-mto-label").val().trim();
                const value = parseFloat($(this).find(".ss-mto-value").val());
                const unit  = $(this).find(".ss-mto-unit").val();
                if (label || !isNaN(value)) collected.push({ label, value: isNaN(value) ? null : value, unit });
            });
            frappe.call({
                method: "frappe.client.get",
                args: { doctype: SS_DOCTYPE, name: docname },
                callback: ({ message: doc }) => {
                    if (!doc) return;
                    doc[SS_MEASURE_FIELD] = collected.map(r => ({ doctype: SS_MEASURE_DT, label: r.label, value: r.value, unit: r.unit }));
                    frappe.call({
                        method: "frappe.client.save",
                        args: { doc },
                        callback: ({ exc }) => {
                            if (exc) return;
                            frappe.call({
                                method: "frappe.client.set_value",
                                args: { doctype: SS_DOCTYPE, name: docname, fieldname: "has_measurements", value: collected.length ? 1 : 0 },
                                callback: () => {
                                    frappe.show_alert({ message: __("Measurements saved"), indicator: "green" }, 1.0);
                                    _SS_MEASURE_COUNTS.set(docname, collected.length);
                                    const row = (listview.data || []).find(d => d.name === docname);
                                    if (row) row.has_measurements = collected.length ? 1 : 0;
                                    _ss_render(listview);
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
    const $wrap = dialog.fields_dict.mto_html.$wrapper;
    $wrap.html(`
        <style>
            .ss-mto-head,.ss-mto-row{display:grid;grid-template-columns:1fr 120px 90px 32px;gap:8px;align-items:center;margin-bottom:6px;}
            .ss-mto-head{font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;padding-bottom:4px;}
            .ss-mto-del{text-align:center;cursor:pointer;color:#c0392b;background:none;border:none;font-size:16px;}
        </style>
        <div>
            <div class="ss-mto-head"><span>${__("Description")}</span><span>${__("Value")}</span><span>${__("Unit")}</span><span></span></div>
            <div class="ss-mto-rows"></div>
            <button class="btn btn-xs btn-default ss-mto-add">+ ${__("Add measurement")}</button>
        </div>`);

    const $rows  = $wrap.find(".ss-mto-rows");
    const addRow = (label = "", value = "", unit = "m") => {
        const selOpts = SS_UNITS.map(u => `<option value="${u}"${u === unit ? " selected" : ""}>${u}</option>`).join("");
        const $r = $(`<div class="ss-mto-row">
            <input type="text"   class="form-control ss-mto-label" placeholder="${__("e.g. Living room")}" value="${frappe.utils.escape_html(label)}">
            <input type="number" class="form-control ss-mto-value" placeholder="0" value="${value}" step="any">
            <select class="form-control ss-mto-unit">${selOpts}</select>
            <button class="ss-mto-del">×</button>
        </div>`);
        $r.find(".ss-mto-del").on("click", () => $r.remove());
        $rows.append($r);
    };

    existing.forEach(r => addRow(r.label, r.value, r.unit));
    if (!existing.length) addRow();
    $wrap.find(".ss-mto-add").on("click", () => addRow());
}

// ── Attachments dialog ─────────────────────────────────────────────────────────
function _ss_open_attach_dialog(listview, docname) {
    let items = [];

    const repaint = ($w) => _ss_render_attach_dialog($w, items, docname);

    const dialog = new frappe.ui.Dialog({
        title: __("Files — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "attach_html", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            const $w = dialog.fields_dict.attach_html.$wrapper;
            $w.find(".ss-dlg-row").each(function () {
                const idx = parseInt($(this).attr("data-idx"), 10);
                if (!isNaN(idx) && items[idx] !== undefined) {
                    items[idx] = { label: $(this).find(".ss-dlg-label").val().trim(), url: $(this).find(".ss-dlg-url").val().trim() };
                }
            });
            const collected = items.filter(r => r.url);
            frappe.call({
                method: "frappe.client.get",
                args: { doctype: SS_DOCTYPE, name: docname },
                callback: ({ exc, message: doc }) => {
                    if (exc || !doc) return;
                    doc[SS_ATTACH_FIELD] = collected.map(r => ({ doctype: SS_ATTACH_DT, label: r.label, url: r.url }));
                    frappe.call({
                        method: "frappe.client.save",
                        args: { doc },
                        callback: ({ exc: e }) => {
                            if (e) return;
                            frappe.show_alert({ message: __("Files saved"), indicator: "green" }, 1.0);
                            const localDoc = (listview.data || []).find(d => d.name === docname);
                            if (localDoc) localDoc[SS_ATTACH_FIELD] = collected;
                            _SS_ATTACH_COUNTS.set(docname, collected.length);
                            _ss_render(listview);
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
        args: { doctype: SS_DOCTYPE, name: docname },
        callback: ({ exc, message }) => {
            const $w = dialog.fields_dict.attach_html.$wrapper;
            if (exc || !message) { $w.html(`<p style="color:#c0392b">${__("Could not load files.")}</p>`); return; }
            items = Array.isArray(message[SS_ATTACH_FIELD])
                ? message[SS_ATTACH_FIELD].map(r => ({ label: r.label || "", url: r.url || "" }))
                : [];
            _SS_ATTACH_COUNTS.set(docname, items.length);
            repaint($w);

            $w.on("click", ".ss-dlg-upload-btn", () => $w.find(".ss-dlg-file-input")[0].click());
            $w.on("change", ".ss-dlg-file-input", function () {
                Array.from(this.files).forEach(file => {
                    const idx = items.length;
                    items.push({ label: file.name, url: "", _uploading: true });
                    repaint($w);
                    _ss_upload_file(file, docname,
                        result => { items[idx] = { label: result.file_name || file.name, url: result.file_url }; repaint($w); },
                        pct    => { $w.find(`.ss-dlg-row[data-idx="${idx}"] .ss-dlg-progress`).css("width", `${pct}%`); }
                    );
                });
                this.value = "";
            });
        },
    });
}

function _ss_render_attach_dialog($w, items, docname) {
    const saved   = items.filter(r => r.url && !r._uploading);
    const preview = saved.length
        ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;margin-bottom:8px">${__("Preview")}</div><div style="display:flex;flex-wrap:wrap;gap:10px">${saved.map(_ss_preview_item).join("")}</div></div><hr style="border:none;border-top:1px solid #e2e6ea;margin:12px 0">`
        : "";

    $w.html(`
        <style>
            .ss-dlg-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;}
            .ss-dlg-label{flex:0 0 160px;}
            .ss-dlg-url-wrap{flex:1;display:flex;flex-direction:column;gap:3px;}
            .ss-dlg-del{flex:0 0 32px;text-align:center;cursor:pointer;color:#c0392b;background:none;border:none;font-size:16px;padding-top:4px;}
            .ss-dlg-upload-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:0.5px solid #378ADD;background:#fff;color:#378ADD;font-size:12px;font-weight:500;cursor:pointer;}
            .ss-dlg-upload-btn:hover{background:#f0f7ff;}
            .ss-dlg-progress-bar{height:3px;background:#e2e6ea;border-radius:2px;overflow:hidden;}
            .ss-dlg-progress{height:100%;background:#378ADD;border-radius:2px;}
        </style>
        <div>
            ${preview}
            <div style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:12px;background:var(--bg-light-gray,#f7f9fa);border:0.5px dashed #e2e6ea;border-radius:8px">
                <button class="ss-dlg-upload-btn">${__("Upload files")}</button>
                <span style="font-size:11px;color:#8d96a0">${__("or paste a URL below")}</span>
                <input type="file" class="ss-dlg-file-input" multiple style="display:none">
            </div>
            <div style="display:flex;gap:8px;font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;margin-bottom:4px">
                <div style="flex:0 0 160px">${__("Label")}</div><div style="flex:1">${__("URL / Path")}</div><div style="flex:0 0 32px"></div>
            </div>
            <div class="ss-dlg-rows">
                ${items.map((r, i) => `
                    <div class="ss-dlg-row" data-idx="${i}">
                        <input type="text" class="form-control ss-dlg-label" placeholder="${__("e.g. Site Photo")}" value="${frappe.utils.escape_html(r.label)}"${r._uploading ? " disabled" : ""}>
                        <div class="ss-dlg-url-wrap">
                            <input type="text" class="form-control ss-dlg-url" placeholder="https://…" value="${frappe.utils.escape_html(r.url)}"${r._uploading ? " disabled" : ""}>
                            ${r._uploading ? `<div class="ss-dlg-progress-bar"><div class="ss-dlg-progress" style="width:0%"></div></div>` : ""}
                        </div>
                        <button class="ss-dlg-del"${r._uploading ? " disabled" : ""}>×</button>
                    </div>`).join("")}
            </div>
            <button class="btn btn-xs btn-default ss-dlg-add-link" style="margin-top:4px">+ ${__("Add URL manually")}</button>
        </div>`);

    $w.on("click", ".ss-dlg-del", function () {
        items.splice(parseInt($(this).closest(".ss-dlg-row").attr("data-idx"), 10), 1);
        _ss_render_attach_dialog($w, items, docname);
    });
    $w.on("click", ".ss-dlg-add-link", () => {
        items.push({ label: "", url: "" });
        _ss_render_attach_dialog($w, items, docname);
        $w.find(".ss-dlg-row").last().find(".ss-dlg-label").focus();
    });
}

function _ss_upload_file(file, docname, onSuccess, onProgress) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("is_private", "0");
    fd.append("folder", "Home/Attachments");
    fd.append("doctype", SS_DOCTYPE);
    fd.append("docname", docname);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/method/upload_file");
    xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
        try {
            const data = JSON.parse(xhr.responseText);
            if (data.message?.file_url) onSuccess(data.message);
            else frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
        } catch { frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2); }
    };
    xhr.onerror = () => frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
    xhr.send(fd);
}

function _ss_preview_item(r) {
    const eu = frappe.utils.escape_html(r.url), el = frappe.utils.escape_html(r.label || r.url);
    const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
    return isImg
        ? `<a href="${eu}" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:inherit;max-width:90px" title="${el}"><img src="${eu}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e2e6ea" alt="${el}"><span style="font-size:10.5px;color:#8d96a0;text-align:center;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el}</span></a>`
        : `<a href="${eu}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;border:1px solid #e2e6ea;background:#f7f9fa;text-decoration:none;color:#1f272e;font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${eu}"><span>${el}</span></a>`;
}

// ── SS-specific CSS ────────────────────────────────────────────────────────────
function _ss_inject_styles() {
    if (document.getElementById("ss-gl-styles")) return;
    const s = document.createElement("style");
    s.id = "ss-gl-styles";
    s.textContent = `
.ss-avatar-wrap  { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }
.ss-avatar {
    width:22px; height:22px; border-radius:50%;
    background:hsl(var(--h,210),58%,52%);
    color:#fff; font-weight:500; font-size:10px;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; cursor:text; user-select:none;
}
.ss-avatar-input  { position:absolute; inset:0; opacity:0; cursor:pointer; border-radius:50%; }
.ss-avatar-input:focus { opacity:1; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.ss-avatar-wrap:focus-within .ss-avatar { opacity:0; }

.ss-lnk {
    display:block; width:100%;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    cursor:text; line-height:1.4; padding:3px 4px;
    border-radius:8px; border:0.5px solid transparent;
    font-size:12px; font-weight:400; color:#378ADD;
}
.ss-lnk:hover { border-color:var(--border-color,#e2e8f0); }
.ss-lnk-inp   { display:block; width:100%; }

.ss-map-cell  { display:flex; align-items:center; gap:4px; width:100%; overflow:hidden; }
.ss-map-disp  { flex:1; color:var(--text-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px; font-size:12px; }
.ss-map-inp   { flex:1; min-width:0; border:0.5px solid #378ADD; border-radius:8px; padding:2px 6px; font-size:12px; font-family:inherit; background:var(--card-bg,#fff); }
.ss-map-open--off { opacity:0.3; cursor:default; pointer-events:none; }

.ss-area {
    width:100%; min-width:0; resize:none; overflow:hidden; line-height:1.4;
    min-height:28px; white-space:pre-wrap; font-size:12px; font-weight:400;
    border:0.5px solid transparent; background:transparent; padding:3px 6px;
    border-radius:8px; font-family:inherit; color:var(--text-color,#1f272e);
    box-sizing:border-box;
}
.ss-area:hover  { border-color:var(--border-color,#e2e8f0); }
.ss-area:focus  { border-color:#378ADD; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.gl-cell:has(.ss-area) { align-items:flex-start; overflow:visible; }

.ss-num {
    width:100%; border:0.5px solid transparent; background:transparent;
    padding:3px 6px; font-size:12px; border-radius:8px; text-align:right;
    font-family:inherit; color:var(--text-color,#1f272e); box-sizing:border-box;
}
.ss-num:hover  { border-color:var(--border-color,#e2e8f0); }
.ss-num:focus  { border-color:#378ADD; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.ss-num::-webkit-outer-spin-button,.ss-num::-webkit-inner-spin-button { -webkit-appearance:none; }
.ss-num[type=number] { -moz-appearance:textfield; }

.ss-attach-btn,.ss-measure-btn { position:relative; }

.ss-ac-menu {
    position:absolute; z-index:2000; background:var(--card-bg,#fff);
    border:0.5px solid var(--border-color,#e2e6ea); border-radius:12px;
    box-shadow:0 6px 24px rgba(0,0,0,.12); max-height:260px; overflow-y:auto;
    padding:4px; font-size:12px; color:var(--text-color,#1f272e);
}
.ss-ac-item    { display:flex; flex-direction:column; gap:1px; padding:6px 10px; border-radius:8px; cursor:pointer; }
.ss-ac-item:hover { background:var(--bg-light-gray,#f4f5f6); }
.ss-ac-primary { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ss-ac-sub     { font-size:11px; color:var(--text-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    `;
    document.head.appendChild(s);
}
