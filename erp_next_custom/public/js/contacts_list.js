// contacts_list.js — Contact list view powered by PG (prospect_grid.js)
"use strict";

const CONTACT_DOCTYPE = "Contact";

const _CC_CFG = {
    tabs: ["Profile", "Contact", "Info"],
    fixed: [
        { key:"num",     label:"#",      cls:"pg-f-num",   width:42,  type:"rownum" },
        { key:"title",   label:"Pre",    cls:"pg-f-title", width:54,  frappe_field:"salutation", type:"select", options:["","Mr","Ms","Mrs","Dr","Eng","Arch"] },
        { key:"first",   label:"First",  cls:"pg-f-first", width:105, frappe_field:"first_name" },
        { key:"last",    label:"Last",   cls:"pg-f-last",  width:105, frappe_field:"last_name"  },
        { key:"company", label:"Company",cls:"pg-f-co",    width:168, frappe_field:"company_name", type:"company", shadow:true },
    ],
    cols: [
        { tab:0, key:"status",      label:"Status",      type:"status", frappe_field:"status",
          map:{ Passive:"pg-badge-gray", Open:"pg-badge-blue", Replied:"pg-badge-teal" } },
        { tab:0, key:"designation", label:"Role/Title",  type:"text",  frappe_field:"designation" },
        { tab:0, key:"department",  label:"Department",  type:"text",  frappe_field:"department"  },
        { tab:0, key:"mobile",      label:"Mobile",      type:"phone", frappe_field:"mobile_no"   },
        { tab:1, key:"email",       label:"Email",       type:"link",  frappe_field:"email_id"    },
        { tab:1, key:"phone",       label:"Phone",       type:"phone", frappe_field:"phone"       },
        { tab:2, key:"gender",      label:"Gender",      type:"text",  frappe_field:"gender"      },
        { tab:2, key:"middle",      label:"Middle Name", type:"text",  frappe_field:"middle_name" },
    ],
    rows: [],
    editable: true,
    doctype: CONTACT_DOCTYPE,
};

const _CC_FIELDS = [
    "name","salutation","first_name","last_name","company_name",
    "status","designation","department","mobile_no",
    "email_id","phone","gender","middle_name",
];

frappe.provide("frappe.listview_settings.Contact");
frappe.listview_settings.Contact = {
    add_fields: _CC_FIELDS,
    onload(lv) { GL.suppressRefresh(lv); _cc_hide(lv); },
    refresh(lv) { _cc_hide(lv); _cc_render(lv); },
};

function _cc_hide(lv) {
    lv.$page.find(".page-head,.page-form,.standard-filter-section,.filter-section,.sort-selector,.filter-selector,.list-filters-area,.list-filter-area,.sort-filter-area,.tag-filters-area,.list-header-meta,.list-toolbar-wrapper,.list-toolbar,.list-row-head,.list-headers,.list-subjects").hide();
}

function _cc_render(lv) {
    const host = GL.bootstrap(lv, { doctype: CONTACT_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    host.innerHTML = `<div class="pl-loading">Loading contacts…</div>`;
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: CONTACT_DOCTYPE, fields: _CC_FIELDS, limit_page_length: 500, order_by: "creation asc" },
        callback(r) {
            if (!document.contains(host)) return;
            const rows = (r.message || []).map((d, i) => ({
                name: d.name, num: i + 1,
                title:  d.salutation || "",
                first:  d.first_name || "", last: d.last_name || "", company: d.company_name || "",
                status:      d.status || "",
                designation: d.designation || "", department: d.department || "",
                mobile: d.mobile_no || "",
                email:  d.email_id || "", phone: d.phone || "",
                gender: d.gender || "", middle: d.middle_name || "",
            }));
            PG.mount(host, Object.assign({}, _CC_CFG, {
                rows,
                onReload() { _cc_render(lv); },
                onEdit(name, ff, val) {
                    frappe.db.set_value(CONTACT_DOCTYPE, name, ff, val)
                        .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
                },
                onAddRow(reload) {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: { doc: { doctype: CONTACT_DOCTYPE, first_name: "New" } },
                        callback(r) { if (!r.exc) { frappe.show_alert({ message: "Contact added", indicator: "green" }, 1.5); reload(); } },
                    });
                },
                onDeleteRows(names, reload) {
                    const lbl = names.length === 1 ? "1 contact" : `${names.length} contacts`;
                    frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                        let done = 0;
                        names.forEach(n => frappe.call({
                            method: "frappe.client.delete", args: { doctype: CONTACT_DOCTYPE, name: n },
                            callback() { if (++done === names.length) { frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2); reload(); } },
                        }));
                    });
                },
            }));
        },
    });
}

(function () {
    if (document.getElementById("cc-pg-styles")) return;
    const s = document.createElement("style"); s.id = "cc-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 32px;box-sizing:border-box;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Contact/List"] .list-row-head,
.page-container[data-page-route="List/Contact/List"] .list-headers,
.page-container[data-page-route="List/Contact/List"] .list-subjects,
.page-container[data-page-route="List/Contact/List"] header.frappe-list-head { display:none !important; }
    `;
    document.head.appendChild(s);
})();
