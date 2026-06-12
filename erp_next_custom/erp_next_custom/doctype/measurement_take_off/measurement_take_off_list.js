// measurement_take_off_list.js — built on GL (grid_core.js)
"use strict";

const MTO_DOCTYPE = "Measurement Take Off";

const MTO_COLS = [
    { field: "status",      label: "Status",      type: "select",  width: 130, options: ["Draft","In Progress","Completed","Cancelled"] },
    { field: "date",        label: "Date",         type: "date",    width: 120 },
    { field: "assigned_to", label: "Assigned To",  type: "avatar",  width: 52 },
    { field: "lead",        label: "Lead",         type: "link",    width: 160, link_doctype: "Lead",        link_namefield: "lead_name" },
    { field: "site_survey", label: "Site Survey",  type: "link",    width: 160, link_doctype: "Site Survey", link_namefield: "name" },
    { field: "contact",     label: "Contact",      type: "link",    width: 150, link_doctype: "Contact",     link_namefield: "first_name" },
    { field: "notes",       label: "Notes",        type: "text",    width: 200 },
];

const MTO_FIELDS = MTO_COLS.map(c => c.field).concat(["name"]);

const _MTO_COL_WIDTHS = {};

const _MTO_LINK_NAMES   = new Map();
const _MTO_LINK_PENDING = new Set();
let   _MTO_CURRENT_LISTVIEW = null;

const MTO_LINK_CFG = {
    assigned_to: { doctype: "User",        namefield: "full_name",     searchfield: "full_name",     id: "name" },
    lead:        { doctype: "Lead",        namefield: "lead_name",     searchfield: "lead_name",     id: "name" },
    site_survey: { doctype: "Site Survey", namefield: "name",          searchfield: "name",           id: "name" },
    contact:     { doctype: "Contact",     namefield: "first_name",    searchfield: "first_name",     id: "name" },
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
}

function _mto_paint(listview, host, rows) {
    const cols   = MTO_COLS;
    const getTpl = () => GL.gridTpl(cols, _MTO_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add MTO")}</button>`;

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
            html.push(`<div class="gl-cell" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}">${_mto_cell(col, doc)}</div>`);
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
        case "select": return GL.renderSelect(col, doc.name, raw);
        case "date":   return GL.renderDate(col, doc.name, raw);
        case "avatar": return _mto_render_avatar(col, doc.name, raw);
        case "link":   return _mto_render_link(col, doc.name, raw);
        default:       return GL.renderText(col, doc.name, raw, "text");
    }
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

// ── Event binding ──────────────────────────────────────────────────────────────
function _mto_bind(listview, host, rows, cols, getTpl) {
    const $host  = $(host);
    const $grid  = $host.find(".gl-grid");
    const esm    = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(MTO_DOCTYPE, name, field, val);

    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _MTO_COL_WIDTHS, getTpl);
    GL.bindDelete($grid, MTO_DOCTYPE, listview, () => _mto_render(listview));
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

    _mto_bind_link_edit($grid, rows, listview, esm, saveFn);
    _mto_bind_avatar_blur($grid, rows, saveFn, listview);
    _mto_bind_link_ac($grid, listview);
}

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

function _mto_bind_avatar_blur($grid, rows, saveFn, listview) {
    $grid.on("blur.mto-av", ".mto-avatar-input", function () {
        const $el = $(this), name = $el.attr("data-name"), field = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        if (!name || !field || !val) return;
        saveFn(name, field, val).then(() => {
            const row = rows.find(r => r.name === name);
            if (row) row[field] = val;
        });
    });
}

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
(function _mto_inject_styles() {
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
})();
