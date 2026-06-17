// quotation_list.js — built on GL (grid_core.js)
"use strict";

const Q_DOCTYPE = "Quotation";

const Q_STATUS_META = {
    "Draft":     { color: "#6C757D", bg: "rgba(108,117,125,0.10)" },
    "Open":      { color: "#0A84FF", bg: "rgba(10,132,255,0.10)"  },
    "Replied":   { color: "#FF9F0A", bg: "rgba(255,159,10,0.10)"  },
    "Ordered":   { color: "#30D158", bg: "rgba(48,209,88,0.10)"   },
    "Cancelled": { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
    "Expired":   { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
    "Lost":      { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
};

const Q_COLS = [
    { field: "name",                        label: "Quotation #",  type: "id",       width: 160, sticky: true },
    { field: "status",                      label: "Status",       type: "status",   width: 120, sticky: true },
    { field: "transaction_date",            label: "Date",         type: "date",     width: 110 },
    { field: "valid_till",                  label: "Valid Till",   type: "date",     width: 110 },
    { field: "customer_name",               label: "Client",       type: "text",     width: 180 },
    { field: "grand_total",                 label: "Total",        type: "currency", width: 130 },
    { field: "custom_crm_log",              label: "CRM Log",      type: "link",     width: 130, link_doctype: "CRM Log"             },
    { field: "custom_lead",                 label: "Lead",         type: "link",     width: 130, link_doctype: "Lead"                },
    { field: "custom_site_survey",          label: "Site Survey",  type: "link",     width: 130, link_doctype: "Site Survey"         },
    { field: "custom_measurement_take_off", label: "MTO",          type: "link",     width: 130, link_doctype: "Measurement Take Off"},
];

const _Q_COL_WIDTHS = {};

// --- Entry point -------------------------------------------------------------
frappe.provide("frappe.listview_settings.Quotation");

frappe.listview_settings.Quotation = {
    add_fields: [
        "status","transaction_date","valid_till","customer_name","grand_total","currency",
        "custom_crm_log","custom_lead","custom_site_survey","custom_measurement_take_off",
    ],

    onload(listview) {
        GL.suppressRefresh(listview);
        GL.bootstrap(listview, { doctype: Q_DOCTYPE });
    },

    refresh(listview) {
        _q_render(listview);
    },
};

// --- Render ------------------------------------------------------------------
function _q_render(listview) {
    const host = GL.bootstrap(listview, { doctype: Q_DOCTYPE });
    if (!host) return;
    GL.hideNative(listview);
    _q_paint(listview, host, listview.data || []);
}

function _q_paint(listview, host, rows) {
    const cols   = Q_COLS;
    const getTpl = () => GL.gridTpl(cols, _Q_COL_WIDTHS);

    const toolbar = document.createElement("div");
    toolbar.className = "gl-toolbar";
    toolbar.innerHTML = `<button class="btn btn-default btn-sm gl-add-btn"><span class="gl-add-icon">+</span> ${__("New Quotation")}</button>`;

    const so = GL.computeStickyOffsets(cols, _Q_COL_WIDTHS);
    const stickyLast = Object.keys(so).pop() || null;

    const html = [GL.rnHeader()];
    cols.forEach((col, ci) => {
        const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
        const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
        html.push(`<div class="gl-cell gl-hdr${scls}" data-col="${ci}" data-field="${col.field}"${ssty}><span>${__(col.label)}</span><div class="gl-rh" data-col="${ci}"></div></div>`);
    });

    if (!rows.length) {
        html.push(`<div class="gl-empty" style="grid-column:1/${cols.length + 2}">${__("No quotations found")}</div>`);
    }

    rows.forEach((doc, ri) => {
        html.push(GL.rnCell(doc, ri));
        cols.forEach((col, ci) => {
            const scls = so[col.field] != null ? ` gl-col--sticky${stickyLast === col.field ? ' gl-col--sticky-last' : ''}` : '';
            const ssty = so[col.field] != null ? ` style="left:${so[col.field]}px"` : '';
            html.push(`<div class="gl-cell${scls}" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}"${ssty}>${_q_cell(col, doc)}</div>`);
        });
    });

    const grid = document.createElement("div");
    grid.className = "gl-grid gl-grid--scroll";
    grid.style.gridTemplateColumns = getTpl();
    grid.innerHTML = html.join("");

    const scrollWrap = document.createElement("div");
    scrollWrap.className = "gl-host--scroll";
    scrollWrap.appendChild(grid);
    host.innerHTML = "";
    host.className = "gl-host";
    host.appendChild(toolbar);
    host.appendChild(scrollWrap);

    _q_bind(listview, host, rows, cols, getTpl);
}

// --- Cell renderers ----------------------------------------------------------
function _q_cell(col, doc) {
    const raw = doc[col.field];
    switch (col.type) {
        case "id":       return `<span class="q-id" data-name="${doc.name}" tabindex="0">${frappe.utils.escape_html(doc.name)}</span>`;
        case "status":   return GL.renderStatus(raw, Q_STATUS_META);
        case "date":     return GL.renderDate(col, doc.name, raw);
        case "currency": return _q_currency(doc, raw);
        case "link":     return GL.renderLink(col, doc.name, raw);
        default:         return GL.renderText(col, doc.name, raw, "text");
    }
}

function _q_currency(doc, raw) {
    if (raw == null || raw === "") return `<span class="q-currency">—</span>`;
    const sym = (frappe.utils.get_currency_symbol || (() => doc.currency || ""))(doc.currency);
    return `<span class="q-currency">${sym} ${format_number(raw, null, 2)}</span>`;
}

// --- Events ------------------------------------------------------------------
function _q_bind(listview, host, rows, cols, getTpl) {
    const $host  = $(host);
    const $grid  = $host.find(".gl-grid");
    const esm    = GL.editState($grid);
    const saveFn = (name, field, val) => GL.fastSave(Q_DOCTYPE, name, field, val);

    const getTplFull = () => {
        const t = getTpl();
        const _so = GL.computeStickyOffsets(cols, _Q_COL_WIDTHS);
        Object.entries(_so).forEach(([f, l]) => $grid.find(`.gl-cell[data-field="${f}"]`).css('left', `${l}px`));
        host._glRefreshHScroll?.();
        return t;
    };
    GL.bindHover($grid);
    GL.bindColResize($grid, cols, _Q_COL_WIDTHS, getTplFull);
    GL.bindHScroll(host, $grid);
    GL.bindDelete($grid, Q_DOCTYPE, listview, () => _q_render(listview));
    GL.bindTextEdit($grid, rows, saveFn, esm);
    GL.bindDateEdit($grid, rows, saveFn, esm);
    GL.bindLinkEdit($grid, rows, saveFn, esm);
    GL.bindOutsideClick($grid, esm, "quotation");

    // ID cell → open form
    $grid.on("click.q", ".q-id", function (e) {
        if (e.ctrlKey || e.metaKey) return;
        frappe.set_route("Form", Q_DOCTYPE, $(this).attr("data-name"));
    });

    $grid.on("click.q", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function () {
        const name = $(this).attr("data-name"); if (name) esm.set(name);
    });
    $grid.on("dblclick.q", ".gl-cell:not(.gl-hdr):not(.gl-rn)", function (e) {
        e.preventDefault();
        const name = $(this).attr("data-name"); if (name) frappe.set_route("Form", Q_DOCTYPE, name);
    });

    GL.bindAddRow($host, () => frappe.new_doc(Q_DOCTYPE));
}

// --- Quotation-specific CSS --------------------------------------------------
(function () {
    if (document.getElementById("q-extra-css")) return;
    const s = document.createElement("style");
    s.id = "q-extra-css";
    s.textContent = `
.q-id { font-size:12px; font-weight:500; color:#378ADD; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; width:100%; }
.q-id:hover { text-decoration:underline; }
.q-currency { font-size:12px; font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; }
    `;
    document.head.appendChild(s);
})();
