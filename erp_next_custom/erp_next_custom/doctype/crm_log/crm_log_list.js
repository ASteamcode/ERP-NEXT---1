// crm_log_list.js — built on GL (grid_core.js)
"use strict";

const CRM_DOCTYPE       = "CRM Log";
const CRM_ATTACH_DT     = "CRM Log Attachment";
const CRM_ATTACH_FIELD  = "attachments";
const CRM_COL_WIDTH_KEY = "crm_gl_col_widths";

const CRM_COLS = [
    { field: "status",          label: "Status",        type: "select",   width: 130, options: ["Open","Scheduled","Viewed","Cancelled","Done"] },
    { field: "category",        label: "Category",      type: "select",   width: 170, options: ["Lead","Site Surveys","Measurements Take Off","Estimation","Quotation"] },
    { field: "date",            label: "Created",       type: "datetime", width: 150 },
    { field: "user",            label: "User",          type: "avatar",   width: 52 },
    { field: "assigned_to",     label: "To",            type: "avatar",   width: 52, variant: "grey" },
    { field: "log_type",        label: "Type",          type: "select",   width: 130, options: ["Inbound call","Quotation","Field","Job","Transport","Yard"] },
    { field: "prefix",          label: "Pre",           type: "select",   width: 64,  options: ["Mr","Ms","Mrs","Dr","Eng","Arch"] },
    { field: "first_name",      label: "Name",          type: "text",     width: 120 },
    { field: "last_name",       label: "Surname",       type: "text",     width: 120 },
    { field: "company_name",    label: "Company",       type: "text",     width: 150 },
    { field: "mobile",          label: "Mobile",        type: "tel",      width: 130 },
    { field: "tel",             label: "Tel",           type: "tel",      width: 120 },
    { field: "email",           label: "Email",         type: "email",    width: 190 },
    { field: "description",     label: "Description",   type: "area",     width: 200 },
    { field: "updates",         label: "Update(s)",     type: "area",     width: 200 },
    { field: "site_location",   label: "Site Location", type: "text",     width: 150 },
    { field: "google_maps_url", label: "Maps",          type: "maps",     width: 120 },
    { field: "attachments",     label: "Files",         type: "attach",   width: 52 },
    { field: "drawing",         label: "Drawing",       type: "drawing",  width: 52 },
];

const CRM_FIELDS = [
    ...CRM_COLS.filter(c => !["attachments","drawing"].includes(c.type)).map(c => c.field),
    "name", "attachments", "has_drawing", "crm_lead",
];

const _CRM_COL_WIDTHS = (() => {
    try {
        const p = JSON.parse(localStorage.getItem(CRM_COL_WIDTH_KEY) || "{}");
        return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "number"));
    } catch { return {}; }
})();

const _crm_persist_widths = () => {
    try { localStorage.setItem(CRM_COL_WIDTH_KEY, JSON.stringify(_CRM_COL_WIDTHS)); } catch {}
};

// State
const _CRM_ATTACH_COUNTS  = new Map();
const _CRM_LINK_NAMES     = new Map();
const _CRM_LINK_PENDING   = new Set();
let   _CRM_CURRENT_LISTVIEW = null;

const CRM_LINK_CFG = {
    user:        { doctype: "User",     namefield: "full_name" },
    assigned_to: { doctype: "Employee", namefield: "employee_name" },
};

// ── Entry point ────────────────────────────────────────────────────────────────
frappe.listview_settings["CRM Log"] = {
    hide_name_column: true,
    add_fields: CRM_FIELDS,

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: CRM_DOCTYPE });
    },

    refresh(listview) {
        _crm_render(listview);
    },
};

// ── Render ─────────────────────────────────────────────────────────────────────
function _crm_render(listview) {
    _CRM_CURRENT_LISTVIEW = listview;
    const host = GL.bootstrap(listview, { doctype: CRM_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _crm_paint(listview, host, listview.data || []);
    _crm_inject_styles();
}

function _crm_paint(listview, host, rows) {
    const cols   = CRM_COLS;
    const getTpl = () => GL.gridTpl(cols, _CRM_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add Row")}</button><button class="btn btn-primary btn-sm crm-promote-btn" title="${__("Validate Lead rows — creates/updates Lead, Site Survey and MTO sequentially")}">${__("Validate Records")}</button>`;

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
            html.push(`<div class="gl-cell" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}">${_crm_cell(col, doc)}</div>`);
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

    _crm_bind(listview, host, rows, cols, getTpl);
}

// ── Cell renderers ─────────────────────────────────────────────────────────────
function _crm_cell(col, doc) {
    const raw = doc[col.field];
    switch (col.type) {
        case "select":   return GL.renderSelect(col, doc.name, raw);
        case "text":
        case "tel":
        case "email":    return GL.renderText(col, doc.name, raw, col.type);
        case "datetime": return `<span class="crm-dt">${frappe.utils.escape_html(_crm_fmt_date(raw))}</span>`;
        case "avatar":   return _crm_render_avatar(col, doc.name, raw);
        case "maps":     return _crm_render_maps(col, doc.name, raw);
        case "area":     return _crm_render_area(col, doc.name, raw);
        case "attach":    return _crm_render_attach(doc.name, raw);
        case "drawing":   return frappe_drawing.render_btn(doc.name, doc.has_drawing);
        case "crm-lead":  return _crm_render_lead_cell(doc.name, doc.category, raw);
        default:          return GL.renderText(col, doc.name, raw, "text");
    }
}

function _crm_resolve_name(fieldname, id) {
    const cfg = CRM_LINK_CFG[fieldname];
    if (!cfg || !id) return null;
    const key = `${cfg.doctype}::${id}`;
    if (_CRM_LINK_NAMES.has(key)) return _CRM_LINK_NAMES.get(key);
    if (!_CRM_LINK_PENDING.has(key)) {
        _CRM_LINK_PENDING.add(key);
        frappe.db.get_value(cfg.doctype, id, cfg.namefield, r => {
            _CRM_LINK_PENDING.delete(key);
            _CRM_LINK_NAMES.set(key, r?.[cfg.namefield] || id);
            if (_CRM_CURRENT_LISTVIEW) _crm_render(_CRM_CURRENT_LISTVIEW);
        });
    }
    return null;
}

function _crm_render_avatar(col, name, raw) {
    const display  = raw ? (_crm_resolve_name(col.field, raw) || raw) : "";
    const initial  = display ? display.charAt(0).toUpperCase() : "?";
    const hue      = display ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
    const isGrey   = col.variant === "grey";
    const avCls    = isGrey ? "crm-avatar crm-avatar--grey" : "crm-avatar";
    const hueAttr  = isGrey ? "" : `style="--h:${hue}"`;
    const linkType = isGrey ? "Employee" : "User";
    const ph       = isGrey ? __("employee…") : __("user…");
    return (
        `<div class="crm-avatar-wrap">` +
        `<div class="${avCls}" ${hueAttr} title="${frappe.utils.escape_html(display)}">${initial}</div>` +
        `<input type="text" class="crm-avatar-input" data-name="${name}" data-field="${col.field}" data-link="${linkType}"` +
        ` value="${frappe.utils.escape_html(display)}" placeholder="${ph}" autocomplete="off">` +
        `</div>`
    );
}

function _crm_render_area(col, name, raw) {
    return `<textarea class="crm-area" data-name="${name}" data-field="${col.field}" rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`;
}

const _CRM_SVG = {
    map: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    pen: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

function _crm_render_maps(col, name, raw) {
    const esc    = frappe.utils.escape_html(raw || "");
    const mapBtn = raw
        ? `<a href="${esc}" target="_blank" class="gl-icon-btn crm-map-open" title="${__("Open map")}">${_CRM_SVG.map}</a>`
        : `<span class="gl-icon-btn crm-map-open--off">${_CRM_SVG.map}</span>`;
    return (
        `<div class="crm-map-cell">` +
        `<span class="crm-map-disp" title="${esc}">${raw ? __("URL set") : `<span class="crm-muted">${__("No URL")}</span>`}</span>` +
        `<input type="text" class="crm-map-inp" data-name="${name}" data-field="${col.field}" value="${esc}" placeholder="${__("Paste Google Maps URL…")}" style="display:none">` +
        `<button class="gl-icon-btn crm-map-pen" data-name="${name}" title="${__("Edit URL")}">${_CRM_SVG.pen}</button>` +
        mapBtn +
        `</div>`
    );
}

function _crm_attach_count(name, raw) {
    if (Array.isArray(raw)) { _CRM_ATTACH_COUNTS.set(name, raw.length); return raw.length; }
    return _CRM_ATTACH_COUNTS.get(name) ?? 0;
}

function _crm_render_attach(name, raw) {
    const count = _crm_attach_count(name, raw);
    const badge = count ? `<span class="gl-badge">${count}</span>` : "";
    return `<button class="gl-icon-btn crm-attach-btn" data-name="${name}" title="${count} file(s)">${GL.SVG.paperclip}${badge}</button>`;
}

function _crm_render_lead_cell(name, category, leadName) {
    if (leadName) {
        const esc = frappe.utils.escape_html(leadName);
        return `<a class="crm-lead-link" href="/app/lead/${encodeURIComponent(leadName)}" onclick="event.stopPropagation()" title="${esc}">${esc}</a>`;
    }
    if (category === "Lead") {
        return `<button class="gl-icon-btn crm-create-lead-btn" data-name="${frappe.utils.escape_html(name)}" title="${__("Create Lead")}"><span class="crm-lead-cta">+ Lead</span></button>`;
    }
    return `<span class="gl-ph">—</span>`;
}

// ── Event binding ──────────────────────────────────────────────────────────────
function _crm_bind(listview, host, rows, cols, getTpl) {
    const $host = $(host);
    const $grid = $host.find(".gl-grid");
    const esm   = GL.editState($grid);

    const saveFn = (name, field, val) => {
        if (val !== "") {
            if (field === "company_name") { crm_upsert_company_and_save(name, val, listview, null); return Promise.resolve(); }
            if (field === "user")         { crm_upsert_user_and_save(name, val, listview, null);    return Promise.resolve(); }
            if (field === "assigned_to")  { crm_upsert_employee_and_save(name, val, listview, null); return Promise.resolve(); }
        }
        return GL.fastSave(CRM_DOCTYPE, name, field, val);
    };

    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _CRM_COL_WIDTHS, getTpl);

    // Custom delete: warn if this log is linked to a Lead
    $grid.on("click.crm-del", ".gl-rn-del", function (e) {
        e.stopPropagation();
        const docname = $(this).attr("data-name");
        const row     = rows.find(r => r.name === docname);
        const msg     = row?.crm_lead
            ? __("This log is linked to Lead {0}. The Lead will remain — only this log will be deleted. Continue?", [row.crm_lead])
            : __("Delete this CRM Log? This cannot be undone.");
        frappe.confirm(msg, () => {
            frappe.call({
                method: "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.delete_crm_log",
                args: { crm_log_name: docname },
                callback: ({ exc }) => {
                    if (exc) return;
                    frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.2);
                    listview.data = (listview.data || []).filter(d => d.name !== docname);
                    _crm_render(listview);
                },
            });
        });
    });
    GL.bindSelectChange($grid, rows, saveFn);
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindOutsideClick($grid, esm, "crm");
    GL.bindAddRow($host, () => _crm_add_row(listview));

    // Persist widths after resize
    $grid.on("mousedown.crm-rz", ".gl-rh", () => {
        $(document).one("mouseup.crm-rz-p", _crm_persist_widths);
    });

    // Row click → editing state; double-click → form
    $grid.on("click.crm", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const n = $(this).attr("data-name"); if (n) esm.set(n);
    });
    $grid.on("dblclick.crm", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const n = $(this).attr("data-name"); if (n) frappe.set_route("Form", CRM_DOCTYPE, n);
    });

    // Area autogrow + save
    const autogrow = function () { this.style.height = "auto"; this.style.height = `${this.scrollHeight}px`; };
    $grid.on("input.crm-area", ".crm-area", autogrow);
    $grid.find(".crm-area").each(autogrow);
    $grid.on("blur.crm-area", ".crm-area", function () {
        const $el = $(this);
        const name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = $el.val();
        const row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        GL.fastSave(CRM_DOCTYPE, name, field, val).then(() => { if (row) row[field] = val; });
    });

    // Avatar blur → upsert save
    $grid.on("blur.crm-av", ".crm-avatar-input", function () {
        const $el = $(this);
        const name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        if (!name || !field || !val) return;
        if (field === "user")        crm_upsert_user_and_save(name, val, listview, $el);
        if (field === "assigned_to") crm_upsert_employee_and_save(name, val, listview, $el);
    });

    // Maps toggle + save on blur
    $grid.on("click.crm-map", ".crm-map-pen", function (e) {
        e.stopPropagation();
        const $cell = $(this).closest(".crm-map-cell");
        const $inp  = $cell.find(".crm-map-inp");
        const $disp = $cell.find(".crm-map-disp");
        if ($inp.is(":visible")) { $inp.hide(); $disp.show(); $inp.trigger("blur"); }
        else { $disp.hide(); $inp.show().focus().select(); }
    });
    $grid.on("blur.crm-map", ".crm-map-inp", function () {
        const $el = $(this);
        const name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        const row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        GL.fastSave(CRM_DOCTYPE, name, field, val).then(() => {
            if (row) row[field] = val;
            _crm_render(listview);
        });
    });

    // Attachments
    $grid.on("click.crm-att", ".crm-attach-btn", function () {
        crm_open_attachments_dialog(listview, $(this).attr("data-name"));
    });

    // Drawings
    $grid.on("click.crm-draw", ".fd-draw-btn", function (e) {
        e.stopPropagation();
        const docname = $(this).attr("data-name");
        frappe_drawing.open({
            doctype: CRM_DOCTYPE, docname,
            drawing_field: "drawing", has_drawing_field: "has_drawing",
            on_saved(hasShapes) {
                const row = (listview.data || []).find(d => d.name === docname);
                if (row) row.has_drawing = hasShapes ? 1 : 0;
                _crm_render(listview);
            },
        });
    });

    // Validate Records — sequential Lead → Site Survey → MTO pipeline, one row at a time
    $host.on("click.crm-promote", ".crm-promote-btn", function () {
        const queue = rows.filter(r => r.category === "Lead").slice();
        if (!queue.length) {
            frappe.show_alert({ message: __("No Lead rows to validate"), indicator: "orange" }, 2);
            return;
        }

        const $btn = $host.find(".crm-promote-btn").prop("disabled", true);
        let created = 0, updated = 0, errors = 0;
        frappe.show_alert({ message: __("Validating {0} Lead row(s)…", [queue.length]), indicator: "blue" }, 2);

        const finish = () => {
            $btn.prop("disabled", false);
            _crm_render(listview);
            frappe.show_alert({
                message: __("{0} created · {1} updated · {2} errors", [created, updated, errors]),
                indicator: errors ? "orange" : "green",
            }, 5);
        };

        const next = () => {
            if (!queue.length) { finish(); return; }
            const row = queue.shift();
            frappe.call({
                method: "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.validate_crm_log",
                args: { crm_log_name: row.name },
                callback({ message, exc }) {
                    if (exc || !message) {
                        errors++;
                    } else {
                        if (message.lead_action === "created") created++;
                        else updated++;
                        row.crm_lead = message.lead;
                    }
                    setTimeout(next, 200);
                },
                error() {
                    errors++;
                    setTimeout(next, 200);
                },
            });
        };
        next();
    });

    // Bulk row selection + delete (uses custom delete_crm_log to clear Lead backlinks)
    const _crm_del = (docname) => new Promise((res, rej) => {
        frappe.call({
            method: "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.delete_crm_log",
            args: { crm_log_name: docname },
            callback: ({ exc }) => {
                if (exc) { rej(exc); return; }
                listview.data = (listview.data || []).filter(d => d.name !== docname);
                res();
            },
            error: rej,
        });
    });
    GL.bindRowSelect($grid, $host.find(".gl-toolbar"), rows, _crm_del, () => _crm_render(listview));

    _crm_bind_avatar_ac($grid, listview);
}

// ── Avatar autocomplete ────────────────────────────────────────────────────────
function _crm_bind_avatar_ac($grid, listview) {
    let $menu = null, activeInput = null, debounceTimer = null;

    const closeMenu = () => { if ($menu) { $menu.remove(); $menu = null; } activeInput = null; };

    const linkConfig = {
        User: {
            doctype: "User", fields: ["name","full_name","email"],
            searchfield: "full_name", primary: "full_name", sub: "email", id: "name",
        },
        Employee: {
            doctype: "Employee", fields: ["name","employee_name","company_email"],
            searchfield: "employee_name", primary: "employee_name", sub: "company_email", id: "name",
        },
    };

    const positionMenu = ($input) => {
        const rect = $input[0].getBoundingClientRect();
        $menu.css({ top: `${rect.bottom + window.scrollY}px`, left: `${rect.left + window.scrollX}px`, width: `${Math.max(rect.width, 220)}px` });
    };

    const renderMenu = ($input, results) => {
        if (!$menu) $menu = $(`<div class="crm-ac-menu"></div>`).appendTo(document.body);
        const items = results.map(r => {
            const p = frappe.utils.escape_html(r.primary);
            const s = r.sub ? `<span class="crm-ac-sub">${frappe.utils.escape_html(r.sub)}</span>` : "";
            return `<div class="crm-ac-item" data-value="${frappe.utils.escape_html(r.primary)}" data-id="${frappe.utils.escape_html(r.id)}"><span class="crm-ac-primary">${p}</span>${s}</div>`;
        }).join("");
        if (!items) { closeMenu(); return; }
        $menu.html(items);
        positionMenu($input);
    };

    const search = ($input, typed) => {
        const cfg = linkConfig[$input.attr("data-link")];
        if (!cfg) return;
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: cfg.doctype, fields: cfg.fields, filters: typed.trim() ? { [cfg.searchfield]: ["like", `%${typed.trim()}%`] } : {}, limit_page_length: 8, order_by: `${cfg.searchfield} asc` },
            callback: ({ message }) => {
                if (activeInput !== $input[0]) return;
                const results = (message || []).map(row => {
                    const primary = row[cfg.primary] || row.name;
                    const id      = row[cfg.id] || row.name;
                    _CRM_LINK_NAMES.set(`${cfg.doctype}::${id}`, primary);
                    return { primary, sub: row[cfg.sub] || "", id };
                });
                renderMenu($input, results);
            },
        });
    };

    $grid.on("input.crmac focus.crmac", ".crm-avatar-input[data-link]", function () {
        activeInput = this;
        const $input = $(this);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => search($input, $input.val() || ""), 180);
    });

    $(document).off("mousedown.crmac").on("mousedown.crmac", ".crm-ac-item", function (e) {
        e.preventDefault();
        if (!activeInput) return;
        const $input = $(activeInput);
        const id     = $(this).attr("data-id");
        const name   = $(this).attr("data-value");
        const cfg    = linkConfig[$input.attr("data-link")];
        if (cfg) _CRM_LINK_NAMES.set(`${cfg.doctype}::${id}`, name);
        $input.val(id);
        closeMenu();
        $input.trigger("blur");
    });

    $grid.on("blur.crmac", ".crm-avatar-input[data-link]", () => setTimeout(closeMenu, 120));
    $(document).off("click.crmacout").on("click.crmacout", e => {
        if ($menu && !$(e.target).closest(".crm-ac-menu, .crm-avatar-input").length) closeMenu();
    });
}

// ── CRUD ───────────────────────────────────────────────────────────────────────
function _crm_add_row(listview) {
    frappe.call({
        method: "frappe.client.insert",
        args: { doc: { doctype: CRM_DOCTYPE, status: "Open", date: frappe.datetime.now_datetime() } },
        callback: ({ exc, message }) => {
            if (exc || !message) return;
            frappe.show_alert({ message: __("New Row Added"), indicator: "green" }, 1.2);
            if (!Array.isArray(listview.data)) listview.data = [];
            listview.data.push(message);
            _crm_render(listview);
        },
    });
}

// ── Upsert helpers ─────────────────────────────────────────────────────────────
function crm_upsert_company_and_save(crm_docname, company_value, listview, $el) {
    frappe.db.get_value("Company", { company_name: company_value }, "name", r => {
        if (r?.name) { crm_save_linked_field(listview, crm_docname, "company_name", r.name, company_value, $el); return; }
        frappe.show_alert({ message: __("Creating company '{0}'…", [company_value]), indicator: "orange" }, 1.0);
        const abbr = company_value.substring(0, 4).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "NEW";
        frappe.call({
            method: "frappe.client.insert",
            args: { doc: { doctype: "Company", company_name: company_value, abbr, default_currency: frappe.defaults.get_default("currency") || "USD" } },
            callback: ({ exc, message }) => {
                if (!exc && message) {
                    frappe.show_alert({ message: __("Company '{0}' Created", [company_value]), indicator: "green" }, 1.2);
                    crm_save_linked_field(listview, crm_docname, "company_name", message.name, company_value, $el);
                }
            },
        });
    });
}

function crm_upsert_user_and_save(crm_docname, user_value, listview, $el) {
    frappe.db.get_value("User", { name: user_value }, "name", byId => {
        if (byId?.name) { crm_save_linked_field(listview, crm_docname, "user", byId.name, user_value, $el); return; }
        const filter = user_value.includes("@") ? { name: user_value } : { full_name: user_value };
        frappe.db.get_value("User", filter, "name", r => {
            if (r?.name) { crm_save_linked_field(listview, crm_docname, "user", r.name, user_value, $el); return; }
            frappe.show_alert({ message: __("Creating user '{0}'…", [user_value]), indicator: "orange" }, 1.0);
            const is_email = user_value.includes("@");
            const email    = is_email ? user_value : `${user_value.toLowerCase().replace(/\s+/g, "")}@example.com`;
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "User", email, first_name: is_email ? user_value.split("@")[0] : user_value, send_welcome_email: 0 } },
                callback: ({ exc, message }) => {
                    if (!exc && message) {
                        frappe.show_alert({ message: __("User '{0}' Created", [user_value]), indicator: "green" }, 1.2);
                        crm_save_linked_field(listview, crm_docname, "user", message.name, user_value, $el);
                    }
                },
            });
        });
    });
}

function crm_upsert_employee_and_save(crm_docname, employee_value, listview, $el) {
    frappe.db.get_value("Employee", { name: employee_value }, "name", byId => {
        if (byId?.name) { crm_save_linked_field(listview, crm_docname, "assigned_to", byId.name, employee_value, $el); return; }
        frappe.db.get_value("Employee", { employee_name: employee_value }, "name", r => {
            if (r?.name) { crm_save_linked_field(listview, crm_docname, "assigned_to", r.name, employee_value, $el); return; }
            frappe.show_alert({ message: __("Creating employee '{0}'…", [employee_value]), indicator: "orange" }, 1.0);
            const row_company = listview.data.find(d => d.name === crm_docname)?.company_name || "";
            const do_insert = (company) => frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: "Employee", first_name: employee_value, company: company || frappe.defaults.get_default("company") || "" } },
                callback: ({ exc, message }) => {
                    if (!exc && message) {
                        frappe.show_alert({ message: __("Employee '{0}' Created", [employee_value]), indicator: "green" }, 1.2);
                        crm_save_linked_field(listview, crm_docname, "assigned_to", message.name, employee_value, $el);
                    }
                },
            });
            if (row_company) frappe.db.get_value("Company", { company_name: row_company }, "name", c => do_insert(c?.name || ""));
            else do_insert("");
        });
    });
}

function crm_save_linked_field(listview, docname, fieldname, actual_value, input_string, $el) {
    frappe.call({
        method: "frappe.client.set_value",
        args: { doctype: CRM_DOCTYPE, name: docname, fieldname, value: actual_value },
        callback: ({ exc }) => {
            if (exc) return;
            if ($el) $el.data("last-saved-val", input_string);
            frappe.show_alert({ message: __("Linked"), indicator: "green" }, 0.8);
            const row = (listview.data || []).find(d => d.name === docname);
            if (row) row[fieldname] = actual_value;
            _crm_render(listview);
        },
    });
}

// ── Attachments dialog ─────────────────────────────────────────────────────────
function crm_open_attachments_dialog(listview, docname) {
    const dialog = new frappe.ui.Dialog({
        title: __("Attachments — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "attach_html", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            const collected = [];
            dialog.$wrapper.find(".crm-dlg-row").each(function () {
                const label = $(this).find(".crm-dlg-label").val().trim();
                const url   = $(this).find(".crm-dlg-url").val().trim();
                if (label || url) collected.push({ label, url });
            });
            frappe.call({
                method: "frappe.client.get",
                args: { doctype: CRM_DOCTYPE, name: docname },
                callback: ({ exc, message: doc }) => {
                    if (exc || !doc) return;
                    doc[CRM_ATTACH_FIELD] = collected.map(r => ({ doctype: CRM_ATTACH_DT, label: r.label, url: r.url }));
                    frappe.call({
                        method: "frappe.client.save",
                        args: { doc },
                        callback: ({ exc: e }) => {
                            if (e) return;
                            frappe.show_alert({ message: __("Attachments saved"), indicator: "green" }, 1.0);
                            const localDoc = (listview.data || []).find(d => d.name === docname);
                            if (localDoc) localDoc[CRM_ATTACH_FIELD] = collected;
                            _CRM_ATTACH_COUNTS.set(docname, collected.length);
                            _crm_render(listview);
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
        args: { doctype: CRM_DOCTYPE, name: docname },
        callback: ({ exc, message }) => {
            const $w = dialog.fields_dict.attach_html.$wrapper;
            if (exc || !message) { $w.html(`<p style="color:#c0392b">${__("Could not load attachments.")}</p>`); return; }
            const rows = Array.isArray(message[CRM_ATTACH_FIELD])
                ? message[CRM_ATTACH_FIELD].map(r => ({ label: r.label || "", url: r.url || "" }))
                : [];
            const prev = _CRM_ATTACH_COUNTS.get(docname);
            _CRM_ATTACH_COUNTS.set(docname, rows.length);
            if (prev !== rows.length) _crm_render(listview);
            _crm_render_attach_dialog($w, rows, docname);
        },
    });
}

function _crm_render_attach_dialog($w, rows, docname) {
    const savedRows = rows.filter(r => r.url);
    const previewHtml = savedRows.length
        ? `<div class="crm-att-section"><div class="crm-att-label">${__("Preview")}</div><div class="crm-att-list">${savedRows.map(_crm_attach_preview_item).join("")}</div></div><hr class="crm-att-hr">`
        : "";

    $w.html(`
        <style>
            .crm-dlg-head,.crm-dlg-row{display:flex;gap:8px;align-items:center;margin-bottom:6px;}
            .crm-dlg-head{font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;margin-bottom:8px;}
            .crm-dlg-col-label,.crm-dlg-label{flex:0 0 160px;}
            .crm-dlg-col-url,.crm-dlg-url{flex:1 1 auto;}
            .crm-dlg-col-act,.crm-dlg-del{flex:0 0 32px;text-align:center;}
            .crm-dlg-del{cursor:pointer;color:#c0392b;background:none;border:none;font-size:16px;}
            .crm-att-section{margin-bottom:12px;}
            .crm-att-label{font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;margin-bottom:8px;}
            .crm-att-list{display:flex;flex-wrap:wrap;gap:10px;}
            .crm-att-thumb-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:inherit;max-width:90px;}
            .crm-att-thumb{width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e2e6ea;}
            .crm-att-thumb:hover{opacity:.85;}
            .crm-att-thumb-lbl{font-size:10.5px;color:#8d96a0;text-align:center;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .crm-att-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;border:1px solid #e2e6ea;background:#f7f9fa;text-decoration:none;color:#1f272e;font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .crm-att-chip:hover{background:#eef2f5;}
            .crm-att-hr{border:none;border-top:1px solid #e2e6ea;margin:12px 0;}
        </style>
        <div>
            ${previewHtml}
            <div class="crm-dlg-head"><div class="crm-dlg-col-label">${__("Label")}</div><div class="crm-dlg-col-url">${__("Link")}</div><div class="crm-dlg-col-act"></div></div>
            <div class="crm-dlg-rows"></div>
            <button class="btn btn-xs btn-default crm-dlg-add">+ ${__("Add attachment")}</button>
        </div>`);

    const $rows  = $w.find(".crm-dlg-rows");
    const addRow = (label = "", url = "") => {
        const $r = $(`<div class="crm-dlg-row">
            <input type="text" class="form-control crm-dlg-label" placeholder="${__("Label")}" value="${frappe.utils.escape_html(label)}">
            <input type="text" class="form-control crm-dlg-url" placeholder="https://…" value="${frappe.utils.escape_html(url)}">
            <button class="crm-dlg-del" title="${__("Remove")}">×</button>
        </div>`);
        $r.find(".crm-dlg-del").on("click", () => $r.remove());
        $rows.append($r);
    };

    rows.forEach(r => addRow(r.label, r.url));
    if (!rows.length) addRow();
    $w.find(".crm-dlg-add").on("click", () => addRow());
}

function _crm_attach_preview_item(r) {
    const eu = frappe.utils.escape_html(r.url), el = frappe.utils.escape_html(r.label || r.url);
    const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
    return isImg
        ? `<a href="${eu}" target="_blank" class="crm-att-thumb-wrap" title="${el}"><img src="${eu}" class="crm-att-thumb" alt="${el}"><span class="crm-att-thumb-lbl">${el}</span></a>`
        : `<a href="${eu}" target="_blank" class="crm-att-chip" title="${eu}"><span>${el}</span></a>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function _crm_fmt_date(v) {
    if (!v) return "–";
    try {
        const [d, t = "00:00:00"] = String(v).split(" ");
        const [year, mo, day]     = d.split("-");
        const [hh, mm]            = t.split(":");
        return `${parseInt(day, 10)}/${parseInt(mo, 10)}/${year.substring(2)} ${hh}:${mm}`;
    } catch { return v; }
}

// ── CRM-specific CSS ───────────────────────────────────────────────────────────
function _crm_inject_styles() {
    if (document.getElementById("crm-gl-styles")) return;
    const s = document.createElement("style");
    s.id = "crm-gl-styles";
    s.textContent = `
.crm-dt { font-size:11px; color:var(--text-muted,#8d96a0); white-space:nowrap; font-variant-numeric:tabular-nums; }

.crm-avatar-wrap  { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }
.crm-avatar {
    width:22px; height:22px; border-radius:50%;
    background:hsl(var(--h,210),58%,52%);
    color:#fff; font-weight:500; font-size:10px;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; cursor:text; user-select:none;
}
.crm-avatar--grey  { background:var(--gray-500,#8d96a0); }
.crm-avatar-input  { position:absolute; inset:0; opacity:0; cursor:pointer; border-radius:50%; }
.crm-avatar-input:focus { opacity:1; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.crm-avatar-wrap:focus-within .crm-avatar { opacity:0; }

.crm-map-cell  { display:flex; align-items:center; gap:4px; width:100%; overflow:hidden; }
.crm-map-disp  { flex:1; color:var(--text-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px; font-size:12px; }
.crm-map-inp   { flex:1; min-width:0; border:0.5px solid #378ADD; border-radius:8px; padding:2px 6px; font-size:12px; font-family:inherit; background:var(--card-bg,#fff); }
.crm-map-open--off { opacity:0.3; cursor:default; pointer-events:none; }
.crm-muted     { color:var(--text-muted,#8d96a0); font-style:italic; }

.crm-area {
    width:100%; min-width:0; resize:none; overflow:hidden; line-height:1.4;
    min-height:28px; white-space:pre-wrap; font-size:12px; font-weight:400;
    border:0.5px solid transparent; background:transparent; padding:3px 6px;
    border-radius:8px; font-family:inherit; color:var(--text-color,#1f272e);
    box-sizing:border-box;
}
.crm-area:hover { border-color:var(--border-color,#e2e8f0); }
.crm-area:focus { border-color:#378ADD; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.gl-cell:has(.crm-area) { align-items:flex-start; overflow:visible; }

.crm-attach-btn { position:relative; }

.crm-lead-link { display:block; color:#378ADD; text-decoration:none; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px; }
.crm-lead-link:hover { text-decoration:underline; }
.crm-lead-cta  { font-size:10px; white-space:nowrap; }

.crm-ac-menu {
    position:absolute; z-index:2000; background:var(--card-bg,#fff);
    border:0.5px solid var(--border-color,#e2e6ea); border-radius:12px;
    box-shadow:0 6px 24px rgba(0,0,0,.12); max-height:260px; overflow-y:auto;
    padding:4px; font-size:12px; color:var(--text-color,#1f272e);
}
.crm-ac-item    { display:flex; flex-direction:column; gap:1px; padding:6px 10px; border-radius:8px; cursor:pointer; }
.crm-ac-item:hover { background:var(--bg-light-gray,#f4f5f6); }
.crm-ac-primary { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.crm-ac-sub     { font-size:11px; color:var(--text-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    `;
    document.head.appendChild(s);
}
