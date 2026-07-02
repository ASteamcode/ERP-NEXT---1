// leads_list.js — Lead list view powered by PG
// Flow: captured → owner → contact → social presence
(function () {
"use strict";

const LEAD_DOCTYPE = "Lead";

const _LL_CFG = {
    tabs: ["Profile & Contact", "Social & Web"],
    fixed: [
        { key:"num",     label:"#",       cls:"pg-f-num",   width:42,  type:"rownum" },
        { key:"first",   label:"First",   cls:"pg-f-first", width:105, frappe_field:"first_name" },
        { key:"last",    label:"Last",    cls:"pg-f-last",  width:105, frappe_field:"last_name"  },
        { key:"company", label:"Company", cls:"pg-f-co",    width:168, frappe_field:"company_name", type:"company", shadow:true },
    ],
    cols: [
        // Tab 0 — Profile & Contact: mirrors Prospect tab 0
        { tab:0, key:"owner_initials", label:"Owner",          type:"owner"                                    },
        { tab:0, key:"mobile",         label:"Primary Mobile", type:"phone", frappe_field:"mobile_no"          },
        { tab:0, key:"email",          label:"Email",          type:"link",  frappe_field:"email_id"           },
        // Tab 1 — Social & Web: mirrors Prospect tab 4
        { tab:1, key:"instagram",  label:"Instagram", type:"link", frappe_field:"custom_instagram" },
        { tab:1, key:"linkedin",   label:"LinkedIn",  type:"link", frappe_field:"custom_linkedin"  },
        { tab:1, key:"facebook",   label:"Facebook",  type:"link", frappe_field:"custom_facebook"  },
        { tab:1, key:"telegram",   label:"Telegram",  type:"link", frappe_field:"custom_telegram"  },
        { tab:1, key:"website",    label:"Website",   type:"link", frappe_field:"website"          },
    ],
    rows: [],
    editable: true,
    doctype: LEAD_DOCTYPE,
    searchPlaceholder: "Search leads…",
    exportLabel: "Export Leads",
};

const _LL_FIELDS = [
    "name","status","first_name","last_name","company_name",
    "mobile_no","email_id","lead_owner","website",
];

frappe.provide("frappe.listview_settings.Lead");
frappe.listview_settings.Lead = {
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _ll_render(lv); },
};

function _ll_render(lv) {
    GL.pgRender(lv, {
        doctype: LEAD_DOCTYPE,
        fields:  _LL_FIELDS,
        orderBy: "creation asc",
        mapFn(d, i) {
            const lo = d.lead_owner || "";
            const initials = lo.split("@")[0].split(/[.\-_]/).map(s => s[0]?.toUpperCase() || "").join("").slice(0, 2) || "?";
            return {
                name: d.name, num: i + 1,
                owner: lo,
                owner_initials: initials,
                status:  d.status || "",
                first:   d.first_name || "", last: d.last_name || "", company: d.company_name || "",
                mobile:  d.mobile_no  || "",
                email:   d.email_id   || "",
                instagram: "", linkedin: "", facebook: "", telegram: "",
                website: d.website || "",
            };
        },
        cfg: _LL_CFG,
        onAddRow(reload) {
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: LEAD_DOCTYPE, first_name: "New", lead_name: "New Lead", status: "Open" } },
                callback(r) { if (!r.exc) { frappe.show_alert({ message: "Lead added", indicator: "green" }, 1.5); reload(); } },
            });
        },
        statsFn(raw) {
            const total     = raw.length;
            const active    = raw.filter(d => d.status === "Open" || d.status === "Replied").length;
            const converted = raw.filter(d => d.status === "Converted").length;
            const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
            const month = raw.filter(d => { if (!d.creation) return false; const c = new Date(d.creation); return c.getMonth()===m && c.getFullYear()===y; }).length;
            return [
                { num: total,     label: "Total Leads",  sub: "all time",       colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 4H14l-3.5 2.5 1.5 4L8 10.5 4 12.5l1.5-4L2 6h4.5z"/></svg>` },
                { num: active,    label: "Active",       sub: "open + replied", colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10,10"/></svg>` },
                { num: month,     label: "This Month",   sub: "new leads",      colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: converted, label: "Converted",    sub: "closed won",     colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,11 5,7 9,9 15,3"/><polyline points="11,3 15,3 15,7"/></svg>` },
            ];
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

})(); // end IIFE
