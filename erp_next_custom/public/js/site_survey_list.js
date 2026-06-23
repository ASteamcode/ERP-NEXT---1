// site_survey_list.js — Site Survey list view powered by PG
// Flow: scheduled → who/for whom → go there → record site details → take measurements → capture drawings
(function () {
"use strict";

const SS_DOCTYPE = "Site Survey";

const _SS_CFG = {
    tabs: ["Assignment", "Site Info", "Measurements", "Field Capture"],
    fixed: [
        { key:"num",      label:"#",        cls:"pg-f-num",  width:42,  type:"rownum" },
        { key:"status",   label:"Status",   cls:"pg-f-stat", width:110, frappe_field:"status", type:"status",
          map:{ Draft:"pg-badge-gray", Scheduled:"pg-badge-indigo", "In Progress":"pg-badge-amber", Completed:"pg-badge-lime", Cancelled:"pg-badge-red" } },
        { key:"survey_dt",label:"Date",     cls:"pg-f-dt",   width:105, frappe_field:"survey_date", type:"date" },
        { key:"site_loc", label:"Location", cls:"pg-f-loc",  width:190, frappe_field:"site_location", shadow:true },
    ],
    cols: [
        // Tab 0 — Assignment: who is doing this and for whom
        { tab:0, key:"assigned",  label:"Surveyor",    type:"text",   frappe_field:"assigned_to",   icon:"person"   },
        { tab:0, key:"customer",  label:"Customer",    type:"text",   frappe_field:"customer",      icon:"building" },
        { tab:0, key:"lead",      label:"Lead",        type:"text",   frappe_field:"lead",          icon:"lead_ic"  },
        { tab:0, key:"contact",   label:"Contact",     type:"text",   frappe_field:"contact",       icon:"person"   },
        // Tab 1 — Site Info: physical characteristics of the site
        { tab:1, key:"maps",      label:"Maps",        type:"maps",   frappe_field:"google_maps_url" },
        { tab:1, key:"site_type", label:"Site Type",   type:"select", frappe_field:"site_type",  options:["","Residential","Commercial","Industrial","Mixed Use"] },
        { tab:1, key:"roof_type", label:"Roof Type",   type:"select", frappe_field:"roof_type",  options:["","Flat","Pitched","Mixed","Dome","N/A"] },
        { tab:1, key:"area",      label:"Area (m²)",   type:"num",    frappe_field:"site_area"   },
        // Tab 2 — Measurements: on-site dimensions (heavy site data)
        { tab:2, key:"measurements",label:"Measurements",type:"notes",frappe_field:"measurements", width:280 },
        // Tab 3 — Field Capture: drawings, photos, notes taken on site
        { tab:3, key:"notes",     label:"Site Notes",  type:"notes",  frappe_field:"notes",    width:240 },
        { tab:3, key:"updates",   label:"Updates",     type:"notes",  frappe_field:"updates",  width:240 },
        { tab:3, key:"drawing",   label:"Drawing",     type:"drawing"                           },
        { tab:3, key:"files",     label:"Photos & Files", type:"files"                          },
    ],
    rows: [],
    editable: true,
    doctype: SS_DOCTYPE,
    searchPlaceholder: "Search surveys…",
    exportLabel: "Export Surveys",
};

const _SS_FIELDS = [
    "name","status","survey_date","site_location","assigned_to",
    "customer","lead","contact","google_maps_url",
    "site_type","roof_type","site_area",
    "measurements","notes","updates","has_drawing","has_measurements",
];

frappe.provide("frappe.listview_settings");
frappe.listview_settings["Site Survey"] = {
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _ss_render(lv); },
};

function _ss_render(lv) {
    GL.pgRender(lv, {
        doctype: SS_DOCTYPE,
        fields:  _SS_FIELDS,
        orderBy: "survey_date desc",
        mapFn(d, i) {
            return {
                name: d.name, num: i + 1,
                status:       d.status        || "",
                survey_dt:    d.survey_date   || "",
                site_loc:     d.site_location || "",
                assigned:     d.assigned_to   || "",
                customer:     d.customer      || "", lead: d.lead || "", contact: d.contact || "",
                maps:         d.google_maps_url || "",
                site_type:    d.site_type     || "", roof_type: d.roof_type || "",
                area:         d.site_area     ? String(d.site_area) : "",
                measurements: d.measurements  || "",
                notes:        d.notes         || "", updates: d.updates || "",
                has_drawing:  d.has_drawing   || 0,
            };
        },
        cfg: _SS_CFG,
        onAddRow(reload) {
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: SS_DOCTYPE, status: "Draft", survey_date: frappe.datetime.now_date() } },
                callback(r) { if (!r.exc) { frappe.show_alert({ message: "Survey added", indicator: "green" }, 1.5); reload(); } },
            });
        },
        onExport(rows, reload) {
            const selected = rows.filter(r => r._selected);
            const targets  = selected.length ? selected : rows;
            if (!targets.length) { frappe.show_alert({ message: "No surveys to export", indicator: "orange" }, 2); return; }
            frappe.confirm(
                `Create ${targets.length === 1 ? "1 MTO" : targets.length + " MTOs"} from selected survey${targets.length > 1 ? "s" : ""}?`,
                () => {
                    let done = 0;
                    targets.forEach(row => {
                        frappe.call({
                            method: "frappe.client.insert",
                            args: { doc: {
                                doctype:       "Measurement Take Off",
                                status:        "Draft",
                                date:          frappe.datetime.now_date(),
                                site_location: row.site_loc || "",
                                site_survey:   row.name,
                                lead:          row.lead    || "",
                                contact:       row.contact || "",
                                site_type:     row.site_type  || "",
                                roof_type:     row.roof_type  || "",
                                site_area:     row.area       || 0,
                            }},
                            callback(r) {
                                if (!r.exc) done++;
                                if (++done >= targets.length) {
                                    frappe.show_alert({ message: `${done} MTO${done > 1 ? "s" : ""} created`, indicator: "green" }, 2);
                                    reload();
                                }
                            },
                        });
                    });
                }
            );
        },
        statsFn(raw) {
            const total     = raw.length;
            const scheduled = raw.filter(d => d.status === "Scheduled" || d.status === "In Progress").length;
            const completed = raw.filter(d => d.status === "Completed").length;
            const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
            const month = raw.filter(d => { if (!d.survey_date) return false; const c = new Date(d.survey_date); return c.getMonth()===m && c.getFullYear()===y; }).length;
            return [
                { num: total,     label: "Total Surveys", sub: "all time",          colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2h12v12H2z"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/><path d="M10 1v3M6 1v3"/></svg>` },
                { num: scheduled, label: "In Progress",   sub: "scheduled + active", colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 11,9"/></svg>` },
                { num: month,     label: "This Month",    sub: "survey dates",       colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: completed, label: "Completed",     sub: "ready for MTO",      colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,12 14,4"/></svg>` },
            ];
        },
    });
}

(function () {
    if (document.getElementById("ss-pg-styles")) return;
    const s = document.createElement("style"); s.id = "ss-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Site Survey/List"] .list-row-head,
.page-container[data-page-route="List/Site Survey/List"] .list-headers,
.page-container[data-page-route="List/Site Survey/List"] .list-subjects,
.page-container[data-page-route="List/Site Survey/List"] .page-head,
.page-container[data-page-route="List/Site Survey/List"] .page-form,
.page-container[data-page-route="List/Site Survey/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();

})(); // end IIFE
