// leads_list.js — Lead list view powered by PG (prospect_grid.js)
"use strict";

const LEAD_DOCTYPE = "Lead";

const _LL_CFG = {
    tabs: ["Contact", "Details", "Qualification"],
    fixed: [
        { key:"num",     label:"#",        cls:"pg-f-num",   width:42,  type:"rownum" },
        { key:"status",  label:"Status",   cls:"pg-f-stat",  width:110, frappe_field:"status", type:"status",
          map:{ Open:"pg-badge-blue", Replied:"pg-badge-teal", Opportunity:"pg-badge-indigo", Interest:"pg-badge-green", "Do Not Contact":"pg-badge-red", Converted:"pg-badge-lime" } },
        { key:"first",   label:"First",    cls:"pg-f-first", width:105, frappe_field:"first_name" },
        { key:"last",    label:"Last",     cls:"pg-f-last",  width:105, frappe_field:"last_name"  },
        { key:"company", label:"Company",  cls:"pg-f-co",    width:168, frappe_field:"company_name", type:"company", shadow:true },
    ],
    cols: [
        { tab:0, key:"email",   label:"Email",     type:"link",   frappe_field:"email_id"    },
        { tab:0, key:"mobile",  label:"Mobile",    type:"phone",  frappe_field:"mobile_no"   },
        { tab:0, key:"phone",   label:"Phone",     type:"phone",  frappe_field:"phone"       },
        { tab:0, key:"whatsapp",label:"WhatsApp",  type:"phone",  frappe_field:"whatsapp_no" },
        { tab:1, key:"type",    label:"Type",      type:"select", frappe_field:"type",        options:["","Client","Channel Partner","Consultant"] },
        { tab:1, key:"territory",label:"Territory",type:"text",   frappe_field:"territory"   },
        { tab:1, key:"owner",   label:"Owner",     type:"text",   frappe_field:"lead_owner"  },
        { tab:1, key:"website", label:"Website",   type:"link",   frappe_field:"website"     },
        { tab:2, key:"qual_status",label:"Qual. Status", type:"status", frappe_field:"qualification_status",
          map:{ Qualified:"pg-badge-green", Unqualified:"pg-badge-red", "In Process":"pg-badge-amber" } },
        { tab:2, key:"job_title",  label:"Job Title",    type:"text", frappe_field:"job_title"     },
        { tab:2, key:"revenue",    label:"Revenue",       type:"num",  frappe_field:"annual_revenue" },
    ],
    rows: [],
    editable: true,
    doctype: LEAD_DOCTYPE,
};

const _LL_FIELDS = [
    "name","status","first_name","last_name","company_name",
    "email_id","mobile_no","phone","whatsapp_no",
    "type","territory","lead_owner","website",
    "qualification_status","job_title","annual_revenue",
];

frappe.provide("frappe.listview_settings.Lead");
frappe.listview_settings.Lead = {
    onload(lv) { GL.suppressRefresh(lv); _ll_hide(lv); },
    refresh(lv) { _ll_hide(lv); _ll_render(lv); },
};

function _ll_hide(lv) {
    lv.$page.find(".page-head,.page-form,.standard-filter-section,.filter-section,.sort-selector,.filter-selector,.list-filters-area,.list-filter-area,.sort-filter-area,.tag-filters-area,.list-header-meta,.list-toolbar-wrapper,.list-toolbar,.list-row-head,.list-headers,.list-subjects").hide();
}

function _ll_render(lv) {
    const host = GL.bootstrap(lv, { doctype: LEAD_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    host.innerHTML = `<div class="pl-loading">Loading leads…</div>`;
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: LEAD_DOCTYPE, fields: _LL_FIELDS, limit_page_length: 500, order_by: "creation asc" },
        callback(r) {
            if (!document.contains(host)) return;
            const rows = (r.message || []).map((d, i) => ({
                name: d.name, num: i + 1,
                status:  d.status || "",
                first:   d.first_name || "", last: d.last_name || "", company: d.company_name || "",
                email:   d.email_id || "", mobile: d.mobile_no || "",
                phone:   d.phone || "", whatsapp: d.whatsapp_no || "",
                type:    d.type || "", territory: d.territory || "",
                owner:   d.lead_owner || "", website: d.website || "",
                qual_status: d.qualification_status || "",
                job_title: d.job_title || "",
                revenue: d.annual_revenue ? String(d.annual_revenue) : "",
            }));
            PG.mount(host, Object.assign({}, _LL_CFG, {
                rows,
                onReload() { _ll_render(lv); },
                onEdit(name, ff, val) {
                    frappe.db.set_value(LEAD_DOCTYPE, name, ff, val)
                        .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
                },
                onAddRow(reload) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: LEAD_DOCTYPE, first_name: "New", lead_name: "New Lead", status: "Open" } },
                        callback(r) { if (!r.exc) { frappe.show_alert({ message: "Lead added", indicator: "green" }, 1.5); reload(); } },
                    });
                },
                onDeleteRows(names, reload) {
                    const lbl = names.length === 1 ? "1 lead" : `${names.length} leads`;
                    frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                        let done = 0;
                        names.forEach(n => frappe.call({
                            method: "frappe.client.delete", args: { doctype: LEAD_DOCTYPE, name: n },
                            callback() { if (++done === names.length) { frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2); reload(); } },
                        }));
                    });
                },
            }));
        },
    });
}

(function () {
    if (document.getElementById("ll-pg-styles")) return;
    const s = document.createElement("style"); s.id = "ll-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Lead/List"] .list-row-head,
.page-container[data-page-route="List/Lead/List"] .list-headers,
.page-container[data-page-route="List/Lead/List"] .list-subjects,
.page-container[data-page-route="List/Lead/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();
