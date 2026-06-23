// site_survey_list.js — Site Survey list view powered by PG (prospect_grid.js)
(function () {
"use strict";

const SS_DOCTYPE = "Site Survey";

const _SS_CFG = {
    tabs: ["Assignment", "Site", "Notes"],
    fixed: [
        { key:"num",      label:"#",        cls:"pg-f-num",  width:42,  type:"rownum" },
        { key:"status",   label:"Status",   cls:"pg-f-stat", width:110, frappe_field:"status", type:"status",
          map:{ Draft:"pg-badge-gray", Scheduled:"pg-badge-indigo", "In Progress":"pg-badge-amber", Completed:"pg-badge-lime", Cancelled:"pg-badge-red" } },
        { key:"survey_dt",label:"Date",     cls:"pg-f-dt",   width:105, frappe_field:"survey_date", type:"date" },
        { key:"site_loc", label:"Location", cls:"pg-f-loc",  width:180, frappe_field:"site_location", shadow:true },
    ],
    cols: [
        { tab:0, key:"assigned",  label:"Surveyor",   type:"text", frappe_field:"assigned_to", width:130 },
        { tab:0, key:"customer",  label:"Customer",   type:"text", frappe_field:"customer"    },
        { tab:0, key:"lead",      label:"Lead",       type:"text", frappe_field:"lead"        },
        { tab:0, key:"contact",   label:"Contact",    type:"text", frappe_field:"contact"     },
        { tab:1, key:"maps",      label:"Maps",       type:"maps", frappe_field:"google_maps_url" },
        { tab:1, key:"site_type", label:"Site Type",  type:"select", frappe_field:"site_type",  options:["","Residential","Commercial","Industrial"] },
        { tab:1, key:"roof_type", label:"Roof Type",  type:"select", frappe_field:"roof_type",  options:["","Flat","Pitched","Mixed","N/A"] },
        { tab:1, key:"area",      label:"Area (m²)",  type:"num",  frappe_field:"site_area"   },
        { tab:2, key:"notes",     label:"Notes",      type:"notes",frappe_field:"notes",        width:220 },
        { tab:2, key:"updates",   label:"Updates",    type:"notes",frappe_field:"updates",      width:220 },
        { tab:2, key:"drawing",   label:"Drawing",    type:"drawing"                           },
        { tab:2, key:"files",     label:"Files",      type:"files"                             },
    ],
    rows: [],
    editable: true,
    doctype: SS_DOCTYPE,
};

const _SS_FIELDS = [
    "name","status","survey_date","site_location","assigned_to",
    "customer","lead","contact","google_maps_url","site_type","roof_type",
    "site_area","notes","updates","has_drawing",
];

frappe.provide("frappe.listview_settings");
frappe.listview_settings["Site Survey"] = {
    onload(lv) { GL.suppressRefresh(lv); _ss_hide(lv); },
    refresh(lv) { _ss_hide(lv); _ss_render(lv); },
};

function _ss_hide(lv) {
    lv.$page.find(".page-head,.page-form,.standard-filter-section,.filter-section,.sort-selector,.filter-selector,.list-filters-area,.list-filter-area,.sort-filter-area,.tag-filters-area,.list-header-meta,.list-toolbar-wrapper,.list-toolbar,.list-row-head,.list-headers,.list-subjects").hide();
}

function _ss_render(lv) {
    const host = GL.bootstrap(lv, { doctype: SS_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    host.innerHTML = `<div class="pl-loading">Loading surveys…</div>`;
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: SS_DOCTYPE, fields: _SS_FIELDS, limit_page_length: 500, order_by: "survey_date desc" },
        callback(r) {
            if (!document.contains(host)) return;
            const rows = (r.message || []).map((d, i) => ({
                name: d.name, num: i + 1,
                status:    d.status || "",
                survey_dt: d.survey_date || "",
                site_loc:  d.site_location || "",
                assigned:  d.assigned_to || "",
                customer:  d.customer || "", lead: d.lead || "", contact: d.contact || "",
                maps:      d.google_maps_url || "",
                site_type: d.site_type || "", roof_type: d.roof_type || "",
                area:      d.site_area ? String(d.site_area) : "",
                notes:     d.notes || "", updates: d.updates || "",
                has_drawing: d.has_drawing || 0,
            }));
            PG.mount(host, Object.assign({}, _SS_CFG, {
                rows,
                onReload() { _ss_render(lv); },
                onEdit(name, ff, val) {
                    frappe.db.set_value(SS_DOCTYPE, name, ff, val)
                        .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
                },
                onAddRow(reload) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: SS_DOCTYPE, status: "Draft", survey_date: frappe.datetime.now_date() } },
                        callback(r) { if (!r.exc) { frappe.show_alert({ message: "Survey added", indicator: "green" }, 1.5); reload(); } },
                    });
                },
                onDeleteRows(names, reload) {
                    const lbl = names.length === 1 ? "1 survey" : `${names.length} surveys`;
                    frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                        let done = 0;
                        names.forEach(n => frappe.call({
                            method: "frappe.client.delete", args: { doctype: SS_DOCTYPE, name: n },
                            callback() { if (++done === names.length) { frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2); reload(); } },
                        }));
                    });
                },
            }));
        },
    });
}

if (!document.getElementById("ss-pg-styles")) {
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
}

})();
