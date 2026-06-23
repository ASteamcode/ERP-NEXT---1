// crm_log_list.js — CRM Log list view powered by PG (prospect_grid.js)
"use strict";

const CL_DOCTYPE = "CRM Log";

const _CL_CFG = {
    tabs: ["Log", "Contact", "Site", "Notes", "Links"],
    fixed: [
        { key:"num",     label:"#",       cls:"pg-f-num",   width:42,  type:"rownum" },
        { key:"status",  label:"Status",  cls:"pg-f-stat",  width:108, frappe_field:"status", type:"status",
          map:{ Open:"pg-badge-blue", Scheduled:"pg-badge-indigo", Viewed:"pg-badge-teal", Cancelled:"pg-badge-gray", Done:"pg-badge-lime" } },
        { key:"prefix",  label:"Pre",     cls:"pg-f-pre",   width:52,  frappe_field:"prefix", type:"select", options:["","Mr","Ms","Mrs","Dr","Eng","Arch"] },
        { key:"first",   label:"First",   cls:"pg-f-first", width:100, frappe_field:"first_name" },
        { key:"last",    label:"Last",    cls:"pg-f-last",  width:100, frappe_field:"last_name"  },
        { key:"company", label:"Company", cls:"pg-f-co",    width:168, frappe_field:"company_name", type:"company", shadow:true },
    ],
    cols: [
        { tab:0, key:"log_date",    label:"Date",       type:"text"                                                                           },
        { tab:0, key:"log_type",    label:"Type",       type:"select", frappe_field:"log_type",   options:["","Inbound call","Quotation","Field","Job","Transport","Yard"] },
        { tab:0, key:"category",    label:"Category",   type:"select", frappe_field:"category",   options:["","Lead","Site Surveys","Measurements Take Off","Estimation","Quotation"] },
        { tab:1, key:"mobile",      label:"Mobile",     type:"phone",  frappe_field:"mobile"      },
        { tab:1, key:"tel",         label:"Tel",        type:"phone",  frappe_field:"tel"         },
        { tab:1, key:"email",       label:"Email",      type:"link",   frappe_field:"email"       },
        { tab:1, key:"assigned",    label:"Assigned To",type:"text",   frappe_field:"assigned_to", icon:"person" },
        { tab:2, key:"site_loc",    label:"Location",   type:"text",   frappe_field:"site_location", width:220 },
        { tab:2, key:"maps",        label:"Maps",       type:"maps",   frappe_field:"google_maps_url" },
        { tab:3, key:"description", label:"Description",type:"notes",  frappe_field:"description", width:220 },
        { tab:3, key:"updates",     label:"Updates",    type:"notes",  frappe_field:"updates",     width:220 },
        { tab:3, key:"drawing",     label:"Drawing",    type:"drawing"                             },
        { tab:3, key:"files",       label:"Files",      type:"files"                               },
        { tab:4, key:"crm_lead",    label:"Lead",       type:"text",   frappe_field:"crm_lead",    icon:"lead_ic"  },
        { tab:4, key:"crm_contact", label:"Contact",    type:"text",   frappe_field:"crm_contact", icon:"person"   },
        { tab:4, key:"crm_customer",label:"Customer",   type:"text",   frappe_field:"crm_customer",icon:"building" },
    ],
    rows: [],
    editable: true,
    doctype: CL_DOCTYPE,
};

const _CL_FIELDS = [
    "name","status","date","prefix","first_name","last_name","company_name",
    "log_type","category","mobile","tel","email","assigned_to",
    "site_location","google_maps_url",
    "description","updates","has_drawing","crm_lead","crm_contact","crm_customer",
];

function _cl_fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

frappe.provide("frappe.listview_settings");
frappe.listview_settings["CRM Log"] = {
    onload(lv) { GL.suppressRefresh(lv); _cl_hide(lv); },
    refresh(lv) { _cl_hide(lv); _cl_render(lv); },
};

function _cl_hide(lv) {
    lv.$page.find(".page-head,.page-form,.standard-filter-section,.filter-section,.sort-selector,.filter-selector,.list-filters-area,.list-filter-area,.sort-filter-area,.tag-filters-area,.list-header-meta,.list-toolbar-wrapper,.list-toolbar,.list-row-head,.list-headers,.list-subjects").hide();
}

function _cl_render(lv) {
    const host = GL.bootstrap(lv, { doctype: CL_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    host.innerHTML = `<div class="pl-loading">Loading logs…</div>`;
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: CL_DOCTYPE, fields: _CL_FIELDS, limit_page_length: 500, order_by: "date desc" },
        callback(r) {
            if (!document.contains(host)) return;
            const rows = (r.message || []).map((d, i) => ({
                name: d.name, num: i + 1,
                status:  d.status || "",
                prefix:  d.prefix || "",
                first:   d.first_name || "", last: d.last_name || "", company: d.company_name || "",
                log_date: _cl_fmtDate(d.date),
                log_type: d.log_type || "", category: d.category || "",
                mobile: d.mobile || "", tel: d.tel || "", email: d.email || "",
                assigned: d.assigned_to || "",
                site_loc: d.site_location || "", maps: d.google_maps_url || "",
                description: d.description ? d.description.replace(/<[^>]*>/g, "") : "",
                updates: d.updates ? d.updates.replace(/<[^>]*>/g, "") : "",
                has_drawing: d.has_drawing || 0,
                crm_lead: d.crm_lead || "", crm_contact: d.crm_contact || "", crm_customer: d.crm_customer || "",
            }));
            PG.mount(host, Object.assign({}, _CL_CFG, {
                rows,
                onReload() { _cl_render(lv); },
                onEdit(name, ff, val) {
                    frappe.db.set_value(CL_DOCTYPE, name, ff, val)
                        .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
                },
                onAddRow(reload) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: CL_DOCTYPE, status: "Open", first_name: "New" } },
                        callback(r) { if (!r.exc) { frappe.show_alert({ message: "Log added", indicator: "green" }, 1.5); reload(); } },
                    });
                },
                onDeleteRows(names, reload) {
                    const lbl = names.length === 1 ? "1 log" : `${names.length} logs`;
                    frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                        let done = 0;
                        names.forEach(n => frappe.call({
                            method: "frappe.client.delete", args: { doctype: CL_DOCTYPE, name: n },
                            callback() { if (++done === names.length) { frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2); reload(); } },
                        }));
                    });
                },
            }));
        },
    });
}

(function () {
    if (document.getElementById("cl-pg-styles")) return;
    const s = document.createElement("style"); s.id = "cl-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/CRM Log/List"] .list-row-head,
.page-container[data-page-route="List/CRM Log/List"] .list-headers,
.page-container[data-page-route="List/CRM Log/List"] .list-subjects,
.page-container[data-page-route="List/CRM Log/List"] .page-head,
.page-container[data-page-route="List/CRM Log/List"] .page-form,
.page-container[data-page-route="List/CRM Log/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();
