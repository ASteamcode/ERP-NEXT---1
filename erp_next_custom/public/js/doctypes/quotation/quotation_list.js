// quotation_list.js — Quotation list view powered by PG
// Flow: quotation # → status → client → totals → validity → CRM links
(function () {
"use strict";

const Q_DOCTYPE = "Quotation";

function _q_fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

const _Q_CFG = {
    tabs: ["Details", "CRM Links"],
    fixed: [
        { key:"num",      label:"#",         cls:"pg-f-num",   width:42,  type:"rownum" },
        { key:"status",   label:"Status",    cls:"pg-f-stat",  width:118, frappe_field:"status", type:"status",
          map:{ Draft:"pg-badge-gray", Open:"pg-badge-blue", Replied:"pg-badge-amber",
                Ordered:"pg-badge-green", Cancelled:"pg-badge-red", Expired:"pg-badge-red", Lost:"pg-badge-red" } },
        { key:"qname",    label:"Quotation", cls:"pg-f-first", width:150, frappe_field:"name",
          type:"form-link", link_doctype:"Quotation" },
        { key:"client",   label:"Client",    cls:"pg-f-co",    width:190, frappe_field:"customer_name", type:"company", shadow:true },
    ],
    cols: [
        // Tab 0 — Details: dates, value
        { tab:0, key:"q_date",   label:"Date",       type:"text",   frappe_field:"transaction_date" },
        { tab:0, key:"valid",    label:"Valid Till",  type:"text",   frappe_field:"valid_till"       },
        { tab:0, key:"total",    label:"Total",       type:"num",    frappe_field:"grand_total"      },
        { tab:0, key:"currency", label:"Currency",    type:"text",   frappe_field:"currency"         },
        // Tab 1 — CRM Links: connect to the pipeline
        { tab:1, key:"crm_log",    label:"CRM Log",      type:"text", frappe_field:"custom_crm_log",              icon:"lead_ic"  },
        { tab:1, key:"lead",       label:"Lead",         type:"text", frappe_field:"custom_lead",                 icon:"lead_ic"  },
        { tab:1, key:"survey",     label:"Site Survey",  type:"text", frappe_field:"custom_site_survey"                           },
        { tab:1, key:"mto",        label:"MTO",          type:"text", frappe_field:"custom_measurement_take_off"                  },
    ],
    rows: [],
    editable: false,
    doctype: Q_DOCTYPE,
    searchPlaceholder: "Search quotations…",
    exportLabel: "Export Quotations",
};

const _Q_FIELDS = [
    "name","status","transaction_date","valid_till",
    "customer_name","grand_total","currency",
    "custom_crm_log","custom_lead","custom_site_survey","custom_measurement_take_off",
];

frappe.provide("frappe.listview_settings.Quotation");
frappe.listview_settings.Quotation = {
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _q_render(lv); },
};

function _q_render(lv) {
    GL.pgRender(lv, {
        doctype: Q_DOCTYPE,
        fields:  _Q_FIELDS,
        orderBy: "transaction_date desc",
        mapFn(d, i) {
            return {
                name: d.name, num: i + 1,
                status:   d.status        || "",
                qname:    d.name          || "",
                client:   d.customer_name || "",
                q_date:   _q_fmtDate(d.transaction_date),
                valid:    _q_fmtDate(d.valid_till),
                total:    d.grand_total != null ? String(d.grand_total) : "",
                currency: d.currency     || "",
                crm_log:  d.custom_crm_log              || "",
                lead:     d.custom_lead                 || "",
                survey:   d.custom_site_survey          || "",
                mto:      d.custom_measurement_take_off || "",
            };
        },
        cfg: _Q_CFG,
        statsFn(raw) {
            const total    = raw.length;
            const open     = raw.filter(d => d.status === "Open" || d.status === "Replied").length;
            const ordered  = raw.filter(d => d.status === "Ordered").length;
            const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
            const month    = raw.filter(d => {
                if (!d.transaction_date) return false;
                const c = new Date(d.transaction_date);
                return c.getMonth() === m && c.getFullYear() === y;
            }).length;
            const totalVal = raw.reduce((s, d) => s + (Number(d.grand_total) || 0), 0);
            const cur      = raw[0]?.currency || "";
            const fmtVal   = totalVal >= 1_000_000
                ? `${(totalVal/1_000_000).toFixed(1)}M`
                : totalVal >= 1_000 ? `${(totalVal/1_000).toFixed(0)}K` : String(Math.round(totalVal));
            return [
                { num: total,         label: "Total Quotes",  sub: "all time",      colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="1" width="10" height="13" rx="1.2"/><line x1="4" y1="5" x2="10" y2="5"/><line x1="4" y1="8" x2="10" y2="8"/><line x1="4" y1="11" x2="7" y2="11"/></svg>` },
                { num: open,          label: "Active",        sub: "open + replied",colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10,10"/></svg>` },
                { num: month,         label: "This Month",    sub: "by date",       colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: `${cur} ${fmtVal}`, label: "Total Value", sub: `${ordered} ordered`, colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 4v1.5M8 10.5V12M5.5 6.5c0-.8.7-1.5 2-1.5s2 .5 2 1.5-2 1-2 2 .7 1.5 2 1.5 2-.7 2-1.5"/></svg>` },
            ];
        },
    });
}

(function () {
    if (document.getElementById("q-pg-styles")) return;
    const s = document.createElement("style"); s.id = "q-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Quotation/List"] .list-row-head,
.page-container[data-page-route="List/Quotation/List"] .list-headers,
.page-container[data-page-route="List/Quotation/List"] .list-subjects,
.page-container[data-page-route="List/Quotation/List"] .page-head,
.page-container[data-page-route="List/Quotation/List"] .page-form,
.page-container[data-page-route="List/Quotation/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();

})(); // end IIFE
