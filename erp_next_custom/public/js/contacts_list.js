// contacts_list.js — built on GL (grid_core.js)
"use strict";

const CONTACT_DOCTYPE    = "Contact";
const CONTACT_ATT_TABLE  = "attachments";
const CONTACT_ATT_DT     = "Contact Attachment";

const CONTACT_TYPE_OPTIONS = ["", "Supplier", "Employee", "Worker", "Client", "Lead", "Prospect"];

const CONTACT_COLS = [
    { field: "salutation",   label: "Pre",         type: "select", width: 72,  options: ["","Mr","Ms","Mrs","Dr","Eng","Arch"], sticky: true },
    { field: "first_name",   label: "Name",        type: "text",   width: 120, sticky: true },
    { field: "last_name",    label: "Surname",     type: "text",   width: 120, sticky: true },
    { field: "contact_type", label: "Type",        type: "select", width: 110, options: CONTACT_TYPE_OPTIONS },
    { field: "profession",   label: "Profession",  type: "text",   width: 140 },
    { field: "company_name", label: "Company",     type: "link",   width: 150, link_doctype: "Company" },
    { field: "position",     label: "Position",    type: "text",   width: 140 },
    { field: "mobile_no",    label: "Mobile",      type: "tel-wa", width: 150 },
    { field: "email_id",     label: "Email",       type: "email",  width: 190 },
    { field: "website",      label: "Website",     type: "url",    width: 170 },
    { field: "instagram",    label: "Instagram",   type: "text",   width: 150 },
    { field: "linkedin",     label: "LinkedIn",    type: "url",    width: 170 },
    { field: "attach",       label: "Attach",      type: "attach", width: 52,  fixed: true },
];

const _C_WA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 .16 11.891C.163 5.335 5.497 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;

const _C_COL_WIDTHS = {};
const _C_ATT_COUNTS = {};

// ─── Entry point ──────────────────────────────────────────────────────────────
frappe.provide("frappe.listview_settings.Contact");

frappe.listview_settings.Contact = {
    add_fields: ["salutation","first_name","last_name","contact_type","profession","company_name","position","mobile_no","email_id","website","instagram","linkedin"],

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: CONTACT_DOCTYPE });
    },

    refresh(listview) {
        _c_render(listview);
    },
};

// ─── Render ───────────────────────────────────────────────────────────────────
function _c_render(listview) {
    const host = GL.bootstrap(listview, { doctype: CONTACT_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _c_inject_styles();

    const rows = listview.data || [];
    const uncached = rows.filter(r => _C_ATT_COUNTS[r.name] === undefined);
    if (uncached.length) {
        _c_fetch_att_counts(uncached.map(r => r.name), () => _c_paint(listview, host, rows));
    } else {
        _c_paint(listview, host, rows);
    }
}

function _c_fetch_att_counts(names, cb) {
    if (!names.length) { cb(); return; }
    names.forEach(n => { _C_ATT_COUNTS[n] = 0; });
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: CONTACT_ATT_DT, filters: [["parent","in",names],["parenttype","=",CONTACT_DOCTYPE]], fields: ["parent","name"], limit_page_length: 999 },
        callback({ message }) {
            (message || []).forEach(r => { _C_ATT_COUNTS[r.parent] = (_C_ATT_COUNTS[r.parent] || 0) + 1; });
            cb();
        },
    });
}

// ─── Paint ────────────────────────────────────────────────────────────────────
function _c_paint(listview, host, rows) {
    const cols = CONTACT_COLS;
    const getTpl = () => GL.gridTpl(cols, _C_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add Contact")}</button>`;

    const so = GL.computeStickyOffsets(cols, _C_COL_WIDTHS);
    const stickyLast = Object.keys(so).pop() || null;

    const html = [GL.rnHeader()];
    cols.forEach((col, ci) => {
        const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
        const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
        html.push(`<div class="gl-cell gl-hdr${scls}" data-col="${ci}" data-field="${col.field}"${ssty}><span>${__(col.label)}</span><div class="gl-rh" data-col="${ci}"></div></div>`);
    });

    if (!rows.length) {
        html.push(`<div class="gl-empty" style="grid-column:1/${cols.length + 2}">${__("No contacts found")}</div>`);
    }

    rows.forEach((doc, ri) => {
        html.push(GL.rnCell(doc, ri));
        cols.forEach((col, ci) => {
            const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
            const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
            html.push(`<div class="gl-cell${scls}" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}"${ssty}>${_c_cell(col, doc)}</div>`);
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

    _c_bind(listview, host, rows, cols, getTpl);
}

// ─── Cell renderers ───────────────────────────────────────────────────────────
function _c_cell(col, doc) {
    const raw = doc[col.field];
    if (col.type === "attach")  return _c_render_attach_btn(doc.name);
    if (col.type === "select")  return GL.renderSelect(col, doc.name, raw);
    if (col.type === "url")     return GL.renderUrl(col, doc.name, raw);
    if (col.type === "link")    return GL.renderLink(col, doc.name, raw);
    if (col.type === "tel-wa")  return _c_render_tel_wa(col, doc.name, raw);
    return GL.renderText(col, doc.name, raw, col.type);
}

function _c_render_tel_wa(col, name, raw) {
    const digits  = (raw || "").replace(/[^0-9]/g, "");
    const waHref  = digits ? `https://wa.me/${digits}` : "";
    const waIcon  = waHref
        ? `<a class="gl-icon-btn c-wa-btn" href="${waHref}" target="_blank" rel="noopener" title="${__("Open WhatsApp")}">${_C_WA_SVG}</a>`
        : `<span class="gl-icon-btn c-wa-btn--off" title="${__("No number")}">${_C_WA_SVG}</span>`;
    return `<div class="c-tel-wrap">${GL.renderText(col, name, raw, "tel")}${waIcon}</div>`;
}

function _c_render_attach_btn(name) {
    const count = _C_ATT_COUNTS[name] || 0;
    const badge = count ? `<span class="gl-badge">${count}</span>` : "";
    return `<button class="gl-icon-btn c-att-btn" data-name="${name}" title="${count} attachment(s)">${GL.SVG.paperclip}${badge}</button>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────
function _c_bind(listview, host, rows, cols, getTpl) {
    const $host = $(host);
    const $grid = $host.find(".gl-grid");
    const esm   = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(CONTACT_DOCTYPE, name, field, val);

    const getTplFull = () => {
        const t = getTpl();
        const _so = GL.computeStickyOffsets(cols, _C_COL_WIDTHS);
        Object.entries(_so).forEach(([f, l]) => $grid.find(`.gl-cell[data-field="${f}"]`).css('left', `${l}px`));
        host._glRefreshHScroll?.();
        return t;
    };
    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _C_COL_WIDTHS, getTplFull);
    GL.bindHScroll(host, $grid);
    const _c_del = (docname) => new Promise((res, rej) => {
        frappe.call({
            method: "frappe.client.delete",
            args: { doctype: CONTACT_DOCTYPE, name: docname },
            callback: ({ exc }) => {
                if (exc) { rej(exc); return; }
                listview.data = (listview.data || []).filter(d => d.name !== docname);
                res();
            },
            error: rej,
        });
    });
    GL.bindRowSelect($grid, $host.find(".gl-toolbar"), rows, _c_del, () => _c_render(listview));
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindUrlEdit($grid, rows, saveFn, esm);
    GL.bindDateEdit($grid, rows, saveFn, esm);
    GL.bindLinkEdit($grid, rows, saveFn, esm);
    GL.bindSelectChange($grid, rows, saveFn);
    GL.bindOutsideClick($grid, esm, "contacts");

    // Row click → set editing; double-click → open form
    $grid.on("click.c", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const name = $(this).attr("data-name"); if (name) esm.set(name);
    });
    $grid.on("dblclick.c", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const name = $(this).attr("data-name"); if (name) frappe.set_route("Form", CONTACT_DOCTYPE, name);
    });

    // Attachment modal
    $grid.on("click.c", ".c-att-btn", function (e) {
        e.stopPropagation();
        _c_open_att_dialog($(this).attr("data-name"), listview, $grid);
    });

    // Add row
    GL.bindAddRow($host, () => {
        frappe.call({
            method: "frappe.client.insert",
            args: { doc: { doctype: CONTACT_DOCTYPE, first_name: "New" } },
            callback({ exc, message }) {
                if (exc || !message) return;
                frappe.show_alert({ message: __("Contact added"), indicator: "green" }, 1.2);
                if (!Array.isArray(listview.data)) listview.data = [];
                listview.data.unshift(message);
                _c_render(listview);
            },
        });
    });
}

// ─── Attachment dialog ────────────────────────────────────────────────────────
function _c_open_att_dialog(docname, listview, $grid) {
    frappe.call({
        method: "frappe.client.get",
        args: { doctype: CONTACT_DOCTYPE, name: docname },
        callback({ exc, message: fullDoc }) {
            if (exc || !fullDoc) return;
            const items = (fullDoc[CONTACT_ATT_TABLE] || []).map(r => ({ label: r.label || "", url: r.url || "" }));
            _c_show_att_dialog(docname, items, listview, $grid);
        },
    });
}

function _c_show_att_dialog(docname, initial, listview, $grid) {
    let items = JSON.parse(JSON.stringify(initial));

    const d = new frappe.ui.Dialog({
        title: __("Attachments"),
        fields: [
            { fieldtype: "HTML",   fieldname: "preview" },
            { fieldtype: "Section Break" },
            { fieldtype: "Data",   fieldname: "add_label", label: __("Label"), placeholder: __("e.g. Document 2025") },
            { fieldtype: "Attach", fieldname: "add_url",   label: __("File / URL") },
            { fieldtype: "Button", fieldname: "add_btn",   label: __("Add"), btn_size: "xs" },
        ],
        primary_action_label: __("Save"),
        primary_action() {
            const url = (d.get_value("add_url") || "").trim();
            if (url) items.push({ label: (d.get_value("add_label") || "").trim(), url });
            _c_save_attachments(docname, items, listview, $grid, d);
        },
    });

    const repaint = () => {
        const $p = d.fields_dict.preview.$wrapper;
        $p.html(_c_att_html(items));
        $p.off("click.catt").on("click.catt", ".gl-del-attach", function () {
            items.splice(parseInt($(this).attr("data-idx"), 10), 1);
            repaint();
        });
    };

    d.fields_dict.add_btn.$input.on("click", () => {
        const url = (d.get_value("add_url") || "").trim();
        if (!url) { frappe.show_alert({ message: __("Please provide a file or URL"), indicator: "orange" }, 2); return; }
        items.push({ label: (d.get_value("add_label") || "").trim(), url });
        d.set_value("add_label", ""); d.set_value("add_url", ""); repaint();
    });

    d.show(); repaint();
}

function _c_att_html(items) {
    if (!items.length) return `<div class="gl-no-attach">${__("No attachments yet.")}</div>`;
    const rows = items.map((r, i) => {
        const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
        const isPDF = /\.pdf(\?|$)/i.test(r.url);
        const preview = isImg
            ? `<img class="gl-attach-thumb" src="${frappe.utils.escape_html(r.url)}" alt="${frappe.utils.escape_html(r.label)}">`
            : `<span class="gl-attach-icon">${isPDF ? "PDF" : "FILE"}</span>`;
        return `<div class="gl-attach-row">${preview}<div class="gl-attach-info"><span class="gl-attach-label">${frappe.utils.escape_html(r.label || r.url)}</span><a class="gl-attach-link" href="${frappe.utils.escape_html(r.url)}" target="_blank" rel="noopener">${GL.SVG.external}</a></div><button class="gl-del-attach" data-idx="${i}" title="${__("Remove")}">${GL.SVG.trash}</button></div>`;
    }).join("");
    return `<div class="gl-attach-list">${rows}</div>`;
}

function _c_save_attachments(docname, items, listview, $grid, dialog) {
    frappe.call({
        method: "frappe.client.get",
        args: { doctype: CONTACT_DOCTYPE, name: docname },
        callback({ exc, message: doc }) {
            if (exc || !doc) return;
            doc[CONTACT_ATT_TABLE] = items.map(r => ({ doctype: CONTACT_ATT_DT, label: r.label, url: r.url }));
            frappe.call({
                method: "frappe.client.save",
                args: { doc },
                callback({ exc: e }) {
                    if (e) return;
                    frappe.show_alert({ message: __("Attachments saved"), indicator: "green" }, 1.5);
                    _C_ATT_COUNTS[docname] = items.length;
                    const badge = items.length ? `<span class="gl-badge">${items.length}</span>` : "";
                    $grid.find(`.c-att-btn[data-name="${docname}"]`).html(GL.SVG.paperclip + badge);
                    dialog.hide();
                },
            });
        },
    });
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _c_inject_styles() {
    if (document.getElementById("c-gl-styles")) return;
    const s = document.createElement("style");
    s.id = "c-gl-styles";
    s.textContent = `
.c-tel-wrap { display:flex; align-items:center; gap:4px; width:100%; overflow:hidden; }
.c-tel-wrap .gl-d { flex:1; min-width:0; }
.c-wa-btn { color:#25D366; flex-shrink:0; }
.c-wa-btn:hover { color:#1da851; }
.c-wa-btn--off { color:var(--text-muted,#adb5bd); opacity:0.3; flex-shrink:0; cursor:default; pointer-events:none; }
    `;
    document.head.appendChild(s);
}
