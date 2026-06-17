// leads_list.js — built on GL (grid_core.js)
"use strict";

const LEAD_DOCTYPE = "Lead";

const LEAD_STATUS_OPTIONS = ["","Open","Replied","Opportunity","Interest","Do Not Contact","Converted"];
const LEAD_TYPE_OPTIONS   = ["","Client","Channel Partner","Consultant"];

const LEAD_COLS = [
    { field: "status",       label: "Status",    type: "select",  width: 130, options: LEAD_STATUS_OPTIONS, sticky: true },
    { field: "lead_name",    label: "Full Name", type: "text",    width: 160, sticky: true },
    { field: "company_name", label: "Company",   type: "text",    width: 160 },
    { field: "email_id",     label: "Email",     type: "email",   width: 190 },
    { field: "mobile_no",    label: "Mobile",    type: "tel",     width: 130 },
    { field: "phone",        label: "Phone",     type: "tel",     width: 120 },
    { field: "website",      label: "Website",   type: "url",     width: 170 },
    { field: "type",         label: "Type",      type: "select",  width: 130, options: LEAD_TYPE_OPTIONS },
    { field: "lead_owner",   label: "Owner",     type: "link",    width: 150, link_doctype: "User" },
    { field: "territory",    label: "Territory", type: "link",    width: 130, link_doctype: "Territory" },
    { field: "name",         label: "→ SS",      type: "nav-ss",  width: 52 },
];

const _L_COL_WIDTHS = {};

// --- Entry point -------------------------------------------------------------
frappe.provide("frappe.listview_settings.Lead");

frappe.listview_settings.Lead = {
    add_fields: ["status","lead_name","company_name","email_id","mobile_no","phone","website","type","lead_owner","territory"],

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: LEAD_DOCTYPE });
    },

    refresh(listview) {
        _l_render(listview);
    },
};

// --- Render ------------------------------------------------------------------
function _l_render(listview) {
    const host = GL.bootstrap(listview, { doctype: LEAD_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _l_paint(listview, host, listview.data || []);
}

function _l_paint(listview, host, rows) {
    const cols   = LEAD_COLS;
    const getTpl = () => GL.gridTpl(cols, _L_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("Add Lead")}</button>`;

    const so = GL.computeStickyOffsets(cols, _L_COL_WIDTHS);
    const stickyLast = Object.keys(so).pop() || null;

    const html = [GL.rnHeader()];
    cols.forEach((col, ci) => {
        const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
        const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
        html.push(`<div class="gl-cell gl-hdr${scls}" data-col="${ci}" data-field="${col.field}"${ssty}><span>${__(col.label)}</span><div class="gl-rh" data-col="${ci}"></div></div>`);
    });

    if (!rows.length) {
        html.push(`<div class="gl-empty" style="grid-column:1/${cols.length + 2}">${__("No leads found")}</div>`);
    }

    rows.forEach((doc, ri) => {
        html.push(GL.rnCell(doc, ri));
        cols.forEach((col, ci) => {
            const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
            const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
            html.push(`<div class="gl-cell${scls}" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}"${ssty}>${_l_cell(col, doc)}</div>`);
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

    _l_bind(listview, host, rows, cols, getTpl);
}

function _l_cell(col, doc) {
    const raw = doc[col.field];
    if (col.type === "select") return GL.renderSelect(col, doc.name, raw);
    if (col.type === "url")    return GL.renderUrl(col, doc.name, raw);
    if (col.type === "link")   return GL.renderLink(col, doc.name, raw);
    if (col.type === "nav-ss") return `<button class="gl-icon-btn l-nav-ss-btn" data-lead="${frappe.utils.escape_html(doc.name)}" title="${__("View Site Surveys")}">→</button>`;
    return GL.renderText(col, doc.name, raw, col.type);
}

// --- Events ------------------------------------------------------------------
function _l_bind(listview, host, rows, cols, getTpl) {
    const $host  = $(host);
    const $grid  = $host.find(".gl-grid");
    const esm    = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(LEAD_DOCTYPE, name, field, val);

    const getTplFull = () => {
        const t = getTpl();
        const _so = GL.computeStickyOffsets(cols, _L_COL_WIDTHS);
        Object.entries(_so).forEach(([f, l]) => $grid.find(`.gl-cell[data-field="${f}"]`).css('left', `${l}px`));
        host._glRefreshHScroll?.();
        return t;
    };
    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _L_COL_WIDTHS, getTplFull);
    GL.bindHScroll(host, $grid);

    // Custom delete: warn if linked Site Surveys exist
    $grid.on("click.l-del", ".gl-rn-del", function (e) {
        e.stopPropagation();
        const docname = $(this).attr("data-name");
        frappe.db.count("Site Survey", { lead: docname }).then(count => {
            const msg = count > 0
                ? __("This Lead has {0} linked Site Survey(s). They will remain but lose their lead link. Delete this Lead anyway?", [count])
                : __("Delete this Lead? This cannot be undone.");
            frappe.confirm(msg, () => {
                frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: LEAD_DOCTYPE, name: docname },
                    callback: ({ exc }) => {
                        if (exc) return;
                        frappe.show_alert({ message: __("Deleted"), indicator: "red" }, 1.2);
                        listview.data = (listview.data || []).filter(d => d.name !== docname);
                        _l_render(listview);
                    },
                });
            });
        });
    });
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindUrlEdit($grid, rows, saveFn, esm);
    GL.bindLinkEdit($grid, rows, saveFn, esm);
    GL.bindSelectChange($grid, rows, saveFn);
    GL.bindOutsideClick($grid, esm, "leads");

    $grid.on("click.l", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const name = $(this).attr("data-name"); if (name) esm.set(name);
    });
    $grid.on("dblclick.l", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const name = $(this).attr("data-name"); if (name) frappe.set_route("Form", LEAD_DOCTYPE, name);
    });

    GL.bindAddRow($host, () => {
        frappe.call({
            method: "frappe.client.insert",
            args: { doc: { doctype: LEAD_DOCTYPE, lead_name: "New Lead", status: "Open" } },
            callback({ exc, message }) {
                if (exc || !message) return;
                frappe.show_alert({ message: __("Lead added"), indicator: "green" }, 1.2);
                if (!Array.isArray(listview.data)) listview.data = [];
                listview.data.unshift(message);
                _l_render(listview);
            },
        });
    });

    // Navigate to Site Survey list filtered by this lead
    $grid.on("click.l-ss", ".l-nav-ss-btn", function (e) {
        e.stopPropagation();
        frappe.route_options = { lead: $(this).attr("data-lead") };
        frappe.set_route("List", "Site Survey");
    });
}
