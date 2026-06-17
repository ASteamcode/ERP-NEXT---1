// measurement_take_off_list.js — built on GL (grid_core.js)
"use strict";

const MTO_DOCTYPE = "Measurement Take Off";

const MTO_COLS = [
    { field: "attachments",    label: "Files",         type: "attach",  width: 52,  sticky: true },
    { field: "status",         label: "Status",        type: "select",  width: 130, options: ["Draft","In Progress","Completed","Cancelled"], sticky: true },
    { field: "date",           label: "Date",           type: "date",    width: 120, sticky: true },
    { field: "assigned_to",    label: "Assigned To",   type: "avatar",  width: 52 },
    { field: "lead",           label: "Lead",           type: "link",    width: 160, link_doctype: "Lead",        link_namefield: "lead_name" },
    { field: "site_survey",    label: "Site Survey",   type: "link",    width: 160, link_doctype: "Site Survey", link_namefield: "name" },
    { field: "contact",        label: "Contact",       type: "link",    width: 150, link_doctype: "Contact",     link_namefield: "first_name" },
    { field: "site_location",  label: "Site Location", type: "text",    width: 160 },
    { field: "google_maps_url",label: "Maps",           type: "maps",    width: 120 },
    { field: "site_type",      label: "Site Type",     type: "select",  width: 130, options: ["","Residential","Commercial","Industrial"] },
    { field: "roof_type",      label: "Roof Type",     type: "select",  width: 120, options: ["","Flat","Pitched","Mixed","N/A"] },
    { field: "site_area",      label: "Area (m²)",     type: "number",  width: 100 },
    { field: "notes",          label: "Notes",          type: "area",    width: 200 },
];

const MTO_FIELDS = [
    ...MTO_COLS.filter(c => c.type !== "attach").map(c => c.field),
    "name",
];

const _MTO_COL_WIDTHS = {};

const _MTO_ATTACH_COUNTS = new Map();
const _MTO_LINK_NAMES    = new Map();
const _MTO_LINK_PENDING  = new Set();
let   _MTO_CURRENT_LISTVIEW = null;

const MTO_LINK_CFG = {
    assigned_to: { doctype: "User",        namefield: "full_name",  searchfield: "full_name",  id: "name" },
    lead:        { doctype: "Lead",        namefield: "lead_name",  searchfield: "lead_name",  id: "name" },
    site_survey: { doctype: "Site Survey", namefield: "name",       searchfield: "name",        id: "name" },
    contact:     { doctype: "Contact",     namefield: "first_name", searchfield: "first_name",  id: "name" },
};

const _MTO_SVG = {
    map: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    pen: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

// ── Entry point ────────────────────────────────────────────────────────────────
frappe.listview_settings["Measurement Take Off"] = {
    hide_name_column: true,
    add_fields: MTO_FIELDS,

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: MTO_DOCTYPE });
    },

    refresh(listview) {
        _mto_render(listview);
    },
};

// ── Render ─────────────────────────────────────────────────────────────────────
function _mto_render(listview) {
    _MTO_CURRENT_LISTVIEW = listview;
    const host = GL.bootstrap(listview, { doctype: MTO_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _mto_paint(listview, host, listview.data || []);
    _mto_inject_styles();
}

function _mto_paint(listview, host, rows) {
    const cols   = MTO_COLS;
    const getTpl = () => GL.gridTpl(cols, _MTO_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add MTO")}</button>`;

    const so = GL.computeStickyOffsets(cols, _MTO_COL_WIDTHS);
    const stickyLast = Object.keys(so).pop() || null;

    const html = [GL.rnHeader()];
    cols.forEach((col, ci) => {
        const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
        const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
        html.push(`<div class="gl-cell gl-hdr${scls}" data-col="${ci}" data-field="${col.field}"${ssty}><span>${__(col.label)}</span><div class="gl-rh" data-col="${ci}"></div></div>`);
    });

    if (!rows.length) {
        html.push(`<div class="gl-empty" style="grid-column:1/${cols.length + 2}">${__("No records yet — add your first row below.")}</div>`);
    }

    rows.forEach((doc, ri) => {
        html.push(GL.rnCell(doc, ri));
        cols.forEach((col, ci) => {
            const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
            const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
            html.push(`<div class="gl-cell${scls}" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}"${ssty}>${_mto_cell(col, doc)}</div>`);
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

    _mto_bind(listview, host, rows, cols, getTpl);
}

// ── Cell renderers ─────────────────────────────────────────────────────────────
function _mto_cell(col, doc) {
    const raw = doc[col.field];
    switch (col.type) {
        case "attach":  return _mto_render_attach(doc.name);
        case "select":  return GL.renderSelect(col, doc.name, raw);
        case "date":    return GL.renderDate(col, doc.name, raw);
        case "text":    return GL.renderText(col, doc.name, raw, "text");
        case "avatar":  return _mto_render_avatar(col, doc.name, raw);
        case "link":    return _mto_render_link(col, doc.name, raw);
        case "maps":    return _mto_render_maps(col, doc.name, raw);
        case "number":  return _mto_render_number(col, doc.name, raw);
        case "area":    return _mto_render_area(col, doc.name, raw);
        default:        return GL.renderText(col, doc.name, raw, "text");
    }
}

function _mto_render_attach(name) {
    const count = _MTO_ATTACH_COUNTS.get(name) ?? 0;
    const badge = count ? `<span class="gl-badge">${count}</span>` : "";
    return `<button class="gl-icon-btn mto-attach-btn" data-name="${name}" title="${count} file(s)">${GL.SVG.paperclip}${badge}</button>`;
}

function _mto_resolve_name(fieldname, id) {
    const cfg = MTO_LINK_CFG[fieldname];
    if (!cfg || !id) return null;
    const key = `${cfg.doctype}::${id}`;
    if (_MTO_LINK_NAMES.has(key)) return _MTO_LINK_NAMES.get(key);
    if (!_MTO_LINK_PENDING.has(key)) {
        _MTO_LINK_PENDING.add(key);
        frappe.db.get_value(cfg.doctype, id, cfg.namefield, r => {
            _MTO_LINK_PENDING.delete(key);
            _MTO_LINK_NAMES.set(key, r?.[cfg.namefield] || id);
            if (_MTO_CURRENT_LISTVIEW) _mto_render(_MTO_CURRENT_LISTVIEW);
        });
    }
    return null;
}

function _mto_render_avatar(col, name, raw) {
    const display = raw ? (_mto_resolve_name(col.field, raw) || raw) : "";
    const initial = display ? display.charAt(0).toUpperCase() : "?";
    const hue     = display ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
    return (
        `<div class="mto-avatar-wrap">` +
        `<div class="mto-avatar" style="--h:${hue}" title="${frappe.utils.escape_html(display)}">${initial}</div>` +
        `<input type="text" class="mto-avatar-input" data-name="${name}" data-field="${col.field}" data-link="User"` +
        ` value="${frappe.utils.escape_html(display)}" placeholder="${__("user…")}" autocomplete="off">` +
        `</div>`
    );
}

function _mto_render_link(col, name, raw) {
    const display = raw ? (_mto_resolve_name(col.field, raw) || raw) : "";
    const v = frappe.utils.escape_html(display);
    return (
        `<span class="mto-lnk" data-name="${name}" data-field="${col.field}"` +
        ` data-link="${col.link_doctype || ""}" data-link-nf="${col.link_namefield || ""}"` +
        ` tabindex="0" title="${v}">` +
        (display ? v : `<span class="gl-ph">—</span>`) +
        `</span>`
    );
}

function _mto_render_maps(col, name, raw) {
    const esc    = frappe.utils.escape_html(raw || "");
    const mapBtn = raw
        ? `<a href="${esc}" target="_blank" class="gl-icon-btn mto-map-open" title="${__("Open map")}">${_MTO_SVG.map}</a>`
        : `<span class="gl-icon-btn mto-map-open--off">${_MTO_SVG.map}</span>`;
    return (
        `<div class="mto-map-cell">` +
        `<span class="mto-map-disp" title="${esc}">${raw ? __("URL set") : `<span class="gl-ph">${__("No URL")}</span>`}</span>` +
        `<input type="text" class="mto-map-inp" data-name="${name}" data-field="${col.field}" value="${esc}" placeholder="${__("Paste Google Maps URL…")}" style="display:none">` +
        `<button class="gl-icon-btn mto-map-pen" data-name="${name}" title="${__("Edit URL")}">${_MTO_SVG.pen}</button>` +
        mapBtn +
        `</div>`
    );
}

function _mto_render_number(col, name, raw) {
    const v = raw != null && raw !== "" ? raw : "";
    return `<input type="number" class="mto-num" data-name="${name}" data-field="${col.field}" value="${v}" placeholder="—" step="any">`;
}

function _mto_render_area(col, name, raw) {
    return `<textarea class="mto-area" data-name="${name}" data-field="${col.field}" rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`;
}

// ── Event binding ──────────────────────────────────────────────────────────────
function _mto_bind(listview, host, rows, cols, getTpl) {
    const $host  = $(host);
    const $grid  = $host.find(".gl-grid");
    const esm    = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(MTO_DOCTYPE, name, field, val);

    const getTplFull = () => {
        const t = getTpl();
        const _so = GL.computeStickyOffsets(cols, _MTO_COL_WIDTHS);
        Object.entries(_so).forEach(([f, l]) => $grid.find(`.gl-cell[data-field="${f}"]`).css('left', `${l}px`));
        host._glRefreshHScroll?.();
        return t;
    };

    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _MTO_COL_WIDTHS, getTplFull);
    GL.bindHScroll(host, $grid);

    const _mto_del = (docname) => new Promise((res, rej) => {
        frappe.call({
            method: "frappe.client.delete",
            args: { doctype: MTO_DOCTYPE, name: docname },
            callback: ({ exc }) => {
                if (exc) { rej(exc); return; }
                listview.data = (listview.data || []).filter(d => d.name !== docname);
                res();
            },
            error: rej,
        });
    });
    GL.bindRowSelect($grid, $host.find(".gl-toolbar"), rows, _mto_del, () => _mto_render(listview));

    GL.bindSelectChange($grid, rows, saveFn);
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindDateEdit($grid, rows, saveFn, esm);
    GL.bindOutsideClick($grid, esm, "mto");
    GL.bindAddRow($host, () => _mto_add_row(listview));

    $grid.on("click.mto", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const n = $(this).attr("data-name"); if (n) esm.set(n);
    });
    $grid.on("dblclick.mto", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const n = $(this).attr("data-name"); if (n) frappe.set_route("Form", MTO_DOCTYPE, n);
    });

    // Area autogrow + save
    const autogrow = function () { this.style.height = "auto"; this.style.height = `${this.scrollHeight}px`; };
    $grid.on("input.mto-area", ".mto-area", autogrow);
    $grid.find(".mto-area").each(autogrow);
    $grid.on("blur.mto-area", ".mto-area", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = $el.val(), row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        saveFn(name, field, val).then(() => { if (row) row[field] = val; });
    });

    // Number save
    $grid.on("blur.mto-num keydown.mto-num", ".mto-num", function (e) {
        if (e.type === "keydown" && e.key !== "Enter") return;
        if (e.type === "keydown") { $(this).trigger("blur"); return; }
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = $el.val().trim(), row = rows.find(r => r.name === name);
        const cur = row?.[field] != null ? String(row[field]) : "";
        if (!name || !field || val === cur) return;
        saveFn(name, field, val || null).then(() => { if (row) row[field] = val; });
    });

    // Maps toggle + save
    $grid.on("click.mto-map", ".mto-map-pen", function (e) {
        e.stopPropagation();
        const $cell = $(this).closest(".mto-map-cell");
        const $inp  = $cell.find(".mto-map-inp");
        const $disp = $cell.find(".mto-map-disp");
        if ($inp.is(":visible")) { $inp.hide(); $disp.show(); $inp.trigger("blur"); }
        else { $disp.hide(); $inp.show().focus().select(); }
    });
    $grid.on("blur.mto-map", ".mto-map-inp", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim(), row = rows.find(r => r.name === name);
        if (!name || !field || val === (row?.[field] || "")) return;
        saveFn(name, field, val).then(() => {
            if (row) row[field] = val;
            _mto_render(listview);
        });
    });

    // File attach
    $grid.on("click.mto-att", ".mto-attach-btn", function (e) {
        e.stopPropagation();
        _mto_open_attach_dialog(listview, $(this).attr("data-name"), $grid, rows);
    });

    // Avatar blur → save
    $grid.on("blur.mto-av", ".mto-avatar-input", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        if (!name || !field || !val) return;
        saveFn(name, field, val).then(() => {
            const row = rows.find(r => r.name === name);
            if (row) row[field] = val;
        });
    });

    _mto_bind_link_edit($grid, rows, listview, esm, saveFn);
    _mto_bind_link_ac($grid, listview);

    // Batch-load attachment counts for all visible rows
    _mto_load_attach_counts(rows, $grid);
}

// ── Attachment count loader ────────────────────────────────────────────────────
function _mto_load_attach_counts(rows, $grid) {
    if (!rows.length) return;
    const names = rows.map(r => r.name);
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "File",
            filters: { attached_to_doctype: MTO_DOCTYPE, attached_to_name: ["in", names] },
            fields: ["attached_to_name"],
            limit_page_length: 500,
        },
        callback: ({ message }) => {
            const counts = {};
            (message || []).forEach(f => { counts[f.attached_to_name] = (counts[f.attached_to_name] || 0) + 1; });
            rows.forEach((doc, ri) => {
                const n = counts[doc.name] || 0;
                _MTO_ATTACH_COUNTS.set(doc.name, n);
                $grid.find(`.gl-cell[data-row="${ri}"][data-field="attachments"]`).html(_mto_render_attach(doc.name));
            });
        },
    });
}

function _mto_update_attach_cell($grid, rows, docname) {
    const ri = rows.findIndex(d => d.name === docname);
    if (ri >= 0) $grid.find(`.gl-cell[data-row="${ri}"][data-field="attachments"]`).html(_mto_render_attach(docname));
}

// ── Attachments dialog ─────────────────────────────────────────────────────────
function _mto_open_attach_dialog(listview, docname, $grid, rows) {
    let items = [];

    const dialog = new frappe.ui.Dialog({
        title: __("Files — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "attach_html", fieldtype: "HTML" }],
    });

    dialog.show();
    const $w = dialog.fields_dict.attach_html.$wrapper;

    const refresh = () => {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "File",
                filters: { attached_to_doctype: MTO_DOCTYPE, attached_to_name: docname },
                fields: ["name", "file_name", "file_url"],
                limit_page_length: 100,
            },
            callback: ({ message }) => {
                items = (message || []).map(f => ({ id: f.name, label: f.file_name || "", url: f.file_url || "" }));
                _MTO_ATTACH_COUNTS.set(docname, items.length);
                _mto_render_attach_dialog($w, items, docname, refresh);
                _mto_update_attach_cell($grid, rows, docname);
            },
        });
    };

    refresh();

    $w.on("click", ".mto-dlg-upload-btn", () => $w.find(".mto-dlg-file-input")[0].click());
    $w.on("change", ".mto-dlg-file-input", function () {
        Array.from(this.files).forEach(file => {
            const idx = items.length;
            items.push({ label: file.name, url: "", _uploading: true });
            _mto_render_attach_dialog($w, items, docname, refresh);
            _mto_upload_file(file, docname,
                () => refresh(),
                pct => { $w.find(`.mto-dlg-row[data-idx="${idx}"] .mto-dlg-progress`).css("width", `${pct}%`); }
            );
        });
        this.value = "";
    });
}

function _mto_render_attach_dialog($w, items, docname, refresh) {
    const saved = items.filter(r => r.url && !r._uploading);
    const preview = saved.length
        ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;color:#8d96a0;letter-spacing:.04em;margin-bottom:8px">${__("Preview")}</div><div style="display:flex;flex-wrap:wrap;gap:10px">${saved.map(_mto_preview_item).join("")}</div></div><hr style="border:none;border-top:1px solid #e2e6ea;margin:12px 0">`
        : "";

    $w.html(`
        <style>
            .mto-dlg-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;}
            .mto-dlg-label{flex:0 0 180px;font-size:12px;color:var(--text-muted,#8d96a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:6px 0;}
            .mto-dlg-url-wrap{flex:1;display:flex;flex-direction:column;gap:3px;}
            .mto-dlg-url{flex:1;font-size:12px;color:var(--text-color,#1f272e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 0;}
            .mto-dlg-del{flex:0 0 32px;text-align:center;cursor:pointer;color:#c0392b;background:none;border:none;font-size:16px;padding-top:2px;}
            .mto-dlg-upload-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:0.5px solid #378ADD;background:#fff;color:#378ADD;font-size:12px;font-weight:500;cursor:pointer;}
            .mto-dlg-upload-btn:hover{background:#f0f7ff;}
            .mto-dlg-progress-bar{height:3px;background:#e2e6ea;border-radius:2px;overflow:hidden;}
            .mto-dlg-progress{height:100%;background:#378ADD;border-radius:2px;transition:width .1s;}
        </style>
        <div>
            ${preview}
            <div style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:12px;background:var(--bg-light-gray,#f7f9fa);border:0.5px dashed #e2e6ea;border-radius:8px">
                <button class="mto-dlg-upload-btn">${__("Upload files")}</button>
                <input type="file" class="mto-dlg-file-input" multiple style="display:none">
            </div>
            <div class="mto-dlg-rows">
                ${items.map((r, i) => `
                    <div class="mto-dlg-row" data-idx="${i}">
                        <span class="mto-dlg-label" title="${frappe.utils.escape_html(r.label)}">${frappe.utils.escape_html(r.label)}</span>
                        <div class="mto-dlg-url-wrap">
                            ${r._uploading
                                ? `<span class="mto-dlg-url" style="color:#8d96a0">${__("Uploading…")}</span><div class="mto-dlg-progress-bar"><div class="mto-dlg-progress" style="width:0%"></div></div>`
                                : `<a class="mto-dlg-url" href="${frappe.utils.escape_html(r.url)}" target="_blank" rel="noopener">${frappe.utils.escape_html(r.url)}</a>`}
                        </div>
                        <button class="mto-dlg-del" data-file-id="${frappe.utils.escape_html(r.id || "")}"${r._uploading ? " disabled" : ""}>×</button>
                    </div>`).join("")}
            </div>
            ${!items.length ? `<p style="color:#8d96a0;font-size:12px;text-align:center;padding:12px 0">${__("No files attached yet.")}</p>` : ""}
        </div>`);

    $w.off("click.mto-dlg-del").on("click.mto-dlg-del", ".mto-dlg-del", function () {
        const fileId = $(this).attr("data-file-id");
        if (!fileId) return;
        frappe.call({
            method: "frappe.client.delete",
            args: { doctype: "File", name: fileId },
            callback: ({ exc }) => { if (!exc) refresh(); },
        });
    });
}

function _mto_preview_item(r) {
    const eu = frappe.utils.escape_html(r.url), el = frappe.utils.escape_html(r.label || r.url);
    const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
    return isImg
        ? `<a href="${eu}" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:inherit;max-width:90px" title="${el}"><img src="${eu}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #e2e6ea" alt="${el}"><span style="font-size:10.5px;color:#8d96a0;text-align:center;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el}</span></a>`
        : `<a href="${eu}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;border:1px solid #e2e6ea;background:#f7f9fa;text-decoration:none;color:#1f272e;font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${eu}"><span>${el}</span></a>`;
}

function _mto_upload_file(file, docname, onSuccess, onProgress) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("is_private", "0");
    fd.append("folder", "Home/Attachments");
    fd.append("doctype", MTO_DOCTYPE);
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

// ── Link cell click-to-edit ────────────────────────────────────────────────────
function _mto_bind_link_edit($grid, rows, listview, esm, saveFn) {
    $grid.on("click.mto-lnk", ".mto-lnk", function () {
        if ($(this).find("input").length) return;
        const $s     = $(this);
        const name   = $s.attr("data-name"), field = $s.attr("data-field");
        const linkDt = $s.attr("data-link") || "";
        const linkNf = $s.attr("data-link-nf") || "";
        const doc    = rows.find(r => r.name === name);
        const cur    = doc?.[field] || "";
        esm.set(name);

        const $i = $(`<input class="gl-inp mto-lnk-inp" type="text" autocomplete="off" value="${frappe.utils.escape_html(cur)}" data-name="${name}" data-field="${field}" data-link="${linkDt}">`);
        $s.html($i); $i.focus().select();

        $i.on("keydown", ev => {
            if (ev.key === "Enter")  { ev.preventDefault(); $i.trigger("blur"); }
            if (ev.key === "Escape") { $s.html(_mto_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)); }
        });
        $i.on("blur", function () {
            setTimeout(() => {
                const v = $(this).val().trim();
                if (!v || v === cur) { $s.html(_mto_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)); return; }
                saveFn(name, field, v).then(() => {
                    if (doc) { doc[field] = v; _MTO_LINK_NAMES.delete(`${linkDt}::${v}`); }
                    _mto_render(listview);
                }).catch(() => $s.html(_mto_render_link({ field, link_doctype: linkDt, link_namefield: linkNf }, name, cur)));
            }, 160);
        });
    });
}

// ── Link / avatar autocomplete ─────────────────────────────────────────────────
function _mto_bind_link_ac($grid, listview) {
    let $menu = null, activeInput = null, timer = null;

    const closeMenu = () => { if ($menu) { $menu.remove(); $menu = null; } activeInput = null; };

    const search = ($inp, typed) => {
        const doctype = $inp.attr("data-link");
        if (!doctype) return;
        const cfg = Object.values(MTO_LINK_CFG).find(c => c.doctype === doctype);
        if (!cfg) return;
        const fields = [...new Set(["name", cfg.namefield].filter(Boolean))];
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype, fields, filters: typed.trim() ? { [cfg.searchfield]: ["like", `%${typed.trim()}%`] } : {}, limit_page_length: 8, order_by: `${cfg.searchfield} asc` },
            callback: ({ message }) => {
                if (activeInput !== $inp[0]) return;
                if (!$menu) $menu = $(`<div class="mto-ac-menu"></div>`).appendTo(document.body);
                const items = (message || []).map(row => {
                    const primary = row[cfg.namefield] || row.name;
                    _MTO_LINK_NAMES.set(`${doctype}::${row.name}`, primary);
                    return `<div class="mto-ac-item" data-id="${frappe.utils.escape_html(row.name)}" data-val="${frappe.utils.escape_html(primary)}"><span>${frappe.utils.escape_html(primary)}</span></div>`;
                }).join("");
                if (!items) { closeMenu(); return; }
                $menu.html(items);
                const rect = $inp[0].getBoundingClientRect();
                $menu.css({ top: `${rect.bottom + window.scrollY}px`, left: `${rect.left + window.scrollX}px`, width: `${Math.max(rect.width, 200)}px` });
            },
        });
    };

    $grid.on("input.mtoac focus.mtoac", ".mto-lnk-inp[data-link], .mto-avatar-input[data-link]", function () {
        activeInput = this;
        const $inp = $(this);
        clearTimeout(timer);
        timer = setTimeout(() => search($inp, $inp.val() || ""), 180);
    });

    $(document).off("mousedown.mtoac").on("mousedown.mtoac", ".mto-ac-item", function (e) {
        e.preventDefault();
        if (!activeInput) return;
        const $inp  = $(activeInput);
        const id    = $(this).attr("data-id");
        const val   = $(this).attr("data-val");
        const dtype = $inp.attr("data-link");
        if (dtype) _MTO_LINK_NAMES.set(`${dtype}::${id}`, val);
        $inp.val(id);
        closeMenu();
        $inp.trigger("blur");
    });

    $grid.on("blur.mtoac", ".mto-lnk-inp, .mto-avatar-input", () => setTimeout(closeMenu, 120));
    $(document).off("click.mtoacout").on("click.mtoacout", e => {
        if ($menu && !$(e.target).closest(".mto-ac-menu, .mto-lnk-inp, .mto-avatar-input").length) closeMenu();
    });
}

// ── CRUD ───────────────────────────────────────────────────────────────────────
function _mto_add_row(listview) {
    frappe.call({
        method: "frappe.client.insert",
        args: { doc: { doctype: MTO_DOCTYPE, status: "Draft", date: frappe.datetime.get_today() } },
        callback: ({ exc, message }) => {
            if (exc || !message) return;
            frappe.show_alert({ message: __("New Row Added"), indicator: "green" }, 1.2);
            if (!Array.isArray(listview.data)) listview.data = [];
            listview.data.push(message);
            _mto_render(listview);
        },
    });
}

// ── CSS ────────────────────────────────────────────────────────────────────────
function _mto_inject_styles() {
    if (document.getElementById("mto-gl-styles")) return;
    const s = document.createElement("style");
    s.id = "mto-gl-styles";
    s.textContent = `
.mto-avatar-wrap  { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }
.mto-avatar {
    width:22px; height:22px; border-radius:50%;
    background:hsl(var(--h,210),58%,52%);
    color:#fff; font-weight:500; font-size:10px;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; cursor:text; user-select:none;
}
.mto-avatar-input { position:absolute; inset:0; opacity:0; cursor:pointer; border-radius:50%; }
.mto-avatar-input:focus { opacity:1; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.mto-avatar-wrap:focus-within .mto-avatar { opacity:0; }

.mto-lnk {
    display:block; width:100%;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    cursor:text; line-height:1.4; padding:3px 4px;
    border-radius:8px; border:0.5px solid transparent;
    font-size:12px; font-weight:400; color:#378ADD;
}
.mto-lnk:hover { border-color:var(--border-color,#e2e8f0); }
.mto-lnk-inp   { display:block; width:100%; }

.mto-map-cell  { display:flex; align-items:center; gap:4px; width:100%; overflow:hidden; }
.mto-map-disp  { flex:1; color:var(--text-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px; font-size:12px; }
.mto-map-inp   { flex:1; min-width:0; border:0.5px solid #378ADD; border-radius:8px; padding:2px 6px; font-size:12px; font-family:inherit; background:var(--card-bg,#fff); }
.mto-map-open--off { opacity:0.3; cursor:default; pointer-events:none; }

.mto-area {
    width:100%; min-width:0; resize:none; overflow:hidden; line-height:1.4;
    min-height:28px; white-space:pre-wrap; font-size:12px; font-weight:400;
    border:0.5px solid transparent; background:transparent; padding:3px 6px;
    border-radius:8px; font-family:inherit; color:var(--text-color,#1f272e);
    box-sizing:border-box;
}
.mto-area:hover  { border-color:var(--border-color,#e2e8f0); }
.mto-area:focus  { border-color:#378ADD; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.gl-cell:has(.mto-area) { align-items:flex-start; overflow:visible; }

.mto-num {
    width:100%; border:0.5px solid transparent; background:transparent;
    padding:3px 6px; font-size:12px; border-radius:8px; text-align:right;
    font-family:inherit; color:var(--text-color,#1f272e); box-sizing:border-box;
}
.mto-num:hover  { border-color:var(--border-color,#e2e8f0); }
.mto-num:focus  { border-color:#378ADD; outline:1.5px solid #378ADD; outline-offset:-1px; background:var(--card-bg,#fff); }
.mto-num::-webkit-outer-spin-button,.mto-num::-webkit-inner-spin-button { -webkit-appearance:none; }
.mto-num[type=number] { -moz-appearance:textfield; }

.mto-attach-btn { position:relative; }

.mto-ac-menu {
    position:absolute; z-index:2000; background:var(--card-bg,#fff);
    border:0.5px solid var(--border-color,#e2e6ea); border-radius:12px;
    box-shadow:0 6px 24px rgba(0,0,0,.12); max-height:260px; overflow-y:auto;
    padding:4px; font-size:12px; color:var(--text-color,#1f272e);
}
.mto-ac-item { padding:6px 10px; border-radius:8px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mto-ac-item:hover { background:var(--bg-light-gray,#f4f5f6); }
    `;
    document.head.appendChild(s);
}
