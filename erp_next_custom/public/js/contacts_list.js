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
const _CC_LIMIT = 100;
let _cc_allRows = [], _cc_offset = 0;

frappe.provide("frappe.listview_settings.Contact");
frappe.listview_settings.Contact = {
    add_fields: _CC_FIELDS,
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _cc_render(lv, 0); },
};

function _toRow(d, i) {
    return {
        name: d.name, num: i + 1,
        title:  d.salutation || "",
        first:  d.first_name || "", last: d.last_name || "", company: d.company_name || "",
        status:      d.status || "",
        designation: d.designation || "", department: d.department || "",
        mobile: d.mobile_no || "",
        email:  d.email_id || "", phone: d.phone || "",
        gender: d.gender || "", middle: d.middle_name || "",
    };
}

function _cc_render(lv, offset) {
    const host = GL.bootstrap(lv, { doctype: CONTACT_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    if (offset === 0) { host.innerHTML = `<div class="pl-loading">Loading contacts…</div>`; _cc_allRows = []; }

    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: CONTACT_DOCTYPE, fields: _CC_FIELDS, limit_page_length: _CC_LIMIT, limit_start: offset, order_by: "first_name asc, last_name asc" },
        callback(r) {
            if (!document.contains(host)) return;
            const newRows = r.message || [];
            if (offset === 0) _cc_allRows = newRows.map(_toRow);
            else _cc_allRows = [..._cc_allRows, ...newRows.map((d, i) => _toRow(d, _cc_allRows.length + i))];
            // fix sequential nums
            _cc_allRows.forEach((row, i) => { row.num = i + 1; });

            const hasMore = newRows.length === _CC_LIMIT;

            PG.mount(host, Object.assign({}, _CC_CFG, {
                rows: _cc_allRows,
                hasMore,
                onLoadMore() { _cc_render(lv, _cc_allRows.length); },
                onReload() { _cc_render(lv, 0); },
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
.page-container[data-page-route="List/Contact/List"] .gl-host{padding:12px 16px 32px;box-sizing:border-box;height:calc(100vh - 112px);min-height:420px;overflow:hidden;}
.pl-loading{padding:48px;text-align:center;color:#9ca3af;font-size:13px;}
.page-container[data-page-route="List/Contact/List"] .list-row-head,
.page-container[data-page-route="List/Contact/List"] .list-headers,
.page-container[data-page-route="List/Contact/List"] .list-subjects,
.page-container[data-page-route="List/Contact/List"] header.frappe-list-head { display:none !important; }
.page-container[data-page-route="List/Contact/List"] .layout-main { overflow:hidden !important; }
.page-container[data-page-route="List/Contact/List"] .gl-host .pg-shell { height:100%;display:flex;flex-direction:column;border-radius:14px!important;overflow:hidden!important; }
.page-container[data-page-route="List/Contact/List"] .gl-host .pg-tbl-outer { flex:1;min-height:0;overflow:auto!important; }
.page-container[data-page-route="List/Contact/List"] .gl-host .pg-tbl thead { position:sticky;top:0;z-index:5; }
.page-container[data-page-route="List/Contact/List"] .gl-host .pg-load-more-wrap { flex:none; }
    `;
    document.head.appendChild(s);
})();
