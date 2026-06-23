// mto_list.js — Measurement Take Off list view powered by PG
// Flow: assigned to architect → references site survey → records site dimensions → uploads drawings + BOM
(function () {
"use strict";

const MTO_DOCTYPE = "Measurement Take Off";

const _MTO_CFG = {
    tabs: ["Assignment", "Site Reference", "Take Off", "Deliverables"],
    fixed: [
        { key:"num",      label:"#",        cls:"pg-f-num",  width:42,  type:"rownum" },
        { key:"status",   label:"Status",   cls:"pg-f-stat", width:110, frappe_field:"status", type:"status",
          map:{ Draft:"pg-badge-gray", "In Progress":"pg-badge-amber", "Under Review":"pg-badge-indigo", Completed:"pg-badge-lime", Cancelled:"pg-badge-red" } },
        { key:"mto_date", label:"Date",     cls:"pg-f-dt",   width:105, frappe_field:"date", type:"date" },
        { key:"site_loc", label:"Location", cls:"pg-f-loc",  width:190, frappe_field:"site_location", shadow:true },
    ],
    cols: [
        // Tab 0 — Assignment: who did this and what job it's for
        { tab:0, key:"assigned",    label:"Architect",    type:"text", frappe_field:"assigned_to",  icon:"person"   },
        { tab:0, key:"lead",        label:"Lead",         type:"text", frappe_field:"lead",         icon:"lead_ic"  },
        { tab:0, key:"site_survey", label:"Site Survey",  type:"text", frappe_field:"site_survey"                   },
        { tab:0, key:"contact",     label:"Contact",      type:"text", frappe_field:"contact",      icon:"person"   },
        // Tab 1 — Site Reference: physical site details pulled from the survey
        { tab:1, key:"maps",        label:"Maps",         type:"maps", frappe_field:"google_maps_url" },
        { tab:1, key:"site_type",   label:"Site Type",    type:"select", frappe_field:"site_type",  options:["","Residential","Commercial","Industrial","Mixed Use"] },
        { tab:1, key:"roof_type",   label:"Roof Type",    type:"select", frappe_field:"roof_type",  options:["","Flat","Pitched","Mixed","Dome","N/A"] },
        { tab:1, key:"area",        label:"Total Area (m²)", type:"num", frappe_field:"site_area"  },
        // Tab 2 — Take Off: the actual dimension measurements (heart of this doc)
        { tab:2, key:"items",       label:"Items / Dimensions", type:"notes", frappe_field:"items", width:320 },
        { tab:2, key:"drawing",     label:"Drawing",      type:"drawing"                              },
        // Tab 3 — Deliverables: final outputs to hand off
        { tab:3, key:"notes",       label:"Notes",        type:"notes", frappe_field:"notes",  width:240 },
        { tab:3, key:"files",       label:"Files & BOM",  type:"files"                               },
    ],
    rows: [],
    editable: true,
    doctype: MTO_DOCTYPE,
    searchPlaceholder: "Search MTOs…",
    exportLabel: "Export MTOs",
};

const _MTO_FIELDS = [
    "name","status","date","site_location","assigned_to",
    "lead","site_survey","contact","google_maps_url",
    "site_type","roof_type","site_area",
    "notes","has_drawing",
];

frappe.provide("frappe.listview_settings");
frappe.listview_settings["Measurement Take Off"] = {
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _mto_render(lv); },
};

function _mto_render(lv) {
    GL.pgRender(lv, {
        doctype: MTO_DOCTYPE,
        fields:  _MTO_FIELDS,
        orderBy: "date desc",
        mapFn(d, i) {
            return {
                name: d.name, num: i + 1,
                status:      d.status        || "",
                mto_date:    d.date          || "",
                site_loc:    d.site_location || "",
                assigned:    d.assigned_to   || "",
                lead:        d.lead          || "", site_survey: d.site_survey || "", contact: d.contact || "",
                maps:        d.google_maps_url || "",
                site_type:   d.site_type     || "", roof_type: d.roof_type || "",
                area:        d.site_area     ? String(d.site_area) : "",
                items:       "",
                notes:       d.notes         || "",
                has_drawing: d.has_drawing   || 0,
            };
        },
        cfg: _MTO_CFG,
        onAddRow(reload) {
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: MTO_DOCTYPE, status: "Draft", date: frappe.datetime.now_date() } },
                callback(r) { if (!r.exc) { frappe.show_alert({ message: "MTO added", indicator: "green" }, 1.5); reload(); } },
            });
        },
        statsFn(raw) {
            const total      = raw.length;
            const inProgress = raw.filter(d => d.status === "In Progress" || d.status === "Under Review").length;
            const completed  = raw.filter(d => d.status === "Completed").length;
            const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
            const month = raw.filter(d => { if (!d.date) return false; const c = new Date(d.date); return c.getMonth()===m && c.getFullYear()===y; }).length;
            return [
                { num: total,      label: "Total MTOs",   sub: "all time",            colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="1" width="9" height="12" rx="1"/><path d="M5 4h4M5 7h4M5 10h2"/><path d="M11 5l3 3-3 3"/></svg>` },
                { num: inProgress, label: "In Progress",  sub: "active take-offs",    colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 11,9"/></svg>` },
                { num: month,      label: "This Month",   sub: "by date",             colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: completed,  label: "Completed",    sub: "ready for quotation", colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,12 14,4"/></svg>` },
            ];
        },
    });
}

(function () {
    if (document.getElementById("mto-pg-styles")) return;
    const s = document.createElement("style"); s.id = "mto-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Measurement Take Off/List"] .list-row-head,
.page-container[data-page-route="List/Measurement Take Off/List"] .list-headers,
.page-container[data-page-route="List/Measurement Take Off/List"] .list-subjects,
.page-container[data-page-route="List/Measurement Take Off/List"] .page-head,
.page-container[data-page-route="List/Measurement Take Off/List"] .page-form,
.page-container[data-page-route="List/Measurement Take Off/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();

})(); // end IIFE
