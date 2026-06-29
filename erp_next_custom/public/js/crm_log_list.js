// crm_log_list.js — CRM Log list view powered by PG
// Flow: who called → interaction details → contact info → site → notes → links
(function () {
"use strict";

const CL_DOCTYPE = "CRM Log";

const _CL_CFG = {
    tabs: ["Log Details", "Contact Info", "Site", "Notes & Outcome", "Links"],
    fixed: [
    { key:"num",     label:"#",       cls:"pg-f-num",   width:34,  type:"rownum" },

    { key:"status",  label:"Status",  cls:"pg-f-stat",  width:85, frappe_field:"status", type:"status",
      map:{ Open:"pg-badge-blue", Scheduled:"pg-badge-indigo", Viewed:"pg-badge-teal", Cancelled:"pg-badge-gray", Done:"pg-badge-lime" } },

    { key:"log_date", label:"Date & Time", cls:"pg-f-date", width:140, type:"text" },

    { key:"prefix",  label:"Pre",     cls:"pg-f-pre",   width:48, frappe_field:"prefix", type:"select", options:["","Mr","Ms","Mrs","Dr","Eng","Arch"] },

    { key:"first",   label:"First",   cls:"pg-f-first", width:85, frappe_field:"first_name" },

    { key:"last",    label:"Last",    cls:"pg-f-last",  width:85, frappe_field:"last_name" },

    { key:"company", label:"Company", cls:"pg-f-co",    width:140, frappe_field:"company_name", type:"company", companySource:"client", shadow:true },

    { key:"mobile", label:"Mobile", cls:"pg-f-mobile", width:115, type:"phone", frappe_field:"mobile" },
],
    cols: [
        // Tab 0 — Log Details: when, what kind, who owns it
        { tab:0, key:"description", label:"Description", type:"notes", frappe_field:"description", width:240 },
        { tab:0, key:"owner_initials", label:"Owner",     type:"owner"                                                                             },
        { tab:0, key:"log_type",    label:"Call Type",    type:"select", frappe_field:"log_type",  options:["","Inbound call","Quotation","Field","Job","Transport","Yard"] },
        { tab:0, key:"category",    label:"Category",     type:"select", frappe_field:"category",  options:["","Lead","Site Surveys","Measurements Take Off","Estimation","Quotation"] },
        // Tab 1 — Contact Info: how to reach them
        
        { tab:1, key:"tel",         label:"Tel",          type:"phone",  frappe_field:"tel"         },
        { tab:1, key:"email",       label:"Email",        type:"link",   frappe_field:"email"       },
        // Tab 2 — Site: where the project is
        { tab:2, key:"site_loc",    label:"Location",     type:"text",            frappe_field:"site_location", width:200 },
        { tab:2, key:"maps",        label:"Maps",         type:"maps",            frappe_field:"google_maps_url" },
        { tab:2, key:"loc_country", label:"Country",      type:"locautocomplete", frappe_field:"loc_country",   locField:"country",  width:90 },
        { tab:2, key:"loc_dist",    label:"District",     type:"locautocomplete", frappe_field:"loc_district",  locField:"district", width:110 },
        { tab:2, key:"loc_city",    label:"City",         type:"locautocomplete", frappe_field:"loc_city",      locField:"city",     width:90 },
        { tab:2, key:"loc_street",  label:"Street",       type:"locautocomplete", frappe_field:"loc_street",    locField:"street",   width:130 },
        // Tab 3 — Notes & Outcome: what happened
        
        { tab:3, key:"updates",     label:"Updates",      type:"notes",  frappe_field:"updates",     width:240 },
        { tab:3, key:"drawing",     label:"Drawing",      type:"drawing"                             },
        { tab:3, key:"files",       label:"Files",        type:"files"                               },
        // Tab 4 — Links: connect to CRM ecosystem
        { tab:4, key:"crm_lead",    label:"Lead",         type:"text",   frappe_field:"crm_lead",    icon:"lead_ic"  },
        { tab:4, key:"crm_contact", label:"Contact",      type:"text",   frappe_field:"crm_contact", icon:"person"   },
        { tab:4, key:"crm_customer",label:"Customer",     type:"text",   frappe_field:"crm_customer",icon:"building" },
    ],
    rows: [],
    locFields: { country: "loc_country", district: "loc_district", city: "loc_city", street: "loc_street" },
    locKeys: { country: "loc_country", district: "loc_dist", city: "loc_city", street: "loc_street" },
    editable: true,
    doctype: CL_DOCTYPE,
    searchPlaceholder: "Search logs…",
    exportLabel: "Export Logs",
};

const _CL_FIELDS = [
    "name","status","date","prefix","first_name","last_name","company_name",
    "log_type","category","assigned_to","owner",
    "mobile","tel","email",
    "site_location","google_maps_url","loc_country","loc_city","loc_district","loc_street",
    "description","updates","has_drawing",
    "crm_lead","crm_contact","crm_customer",
];

function _cl_joinLocation(row) {
    return [row.loc_country, row.loc_dist, row.loc_city, row.loc_street]
        .map(v => (v || "").trim())
        .filter(Boolean)
        .join(", ");
}

function _cl_updateLocationCells(name, row, fields) {
    const keyMap = { loc_country: "loc_country", loc_district: "loc_dist", loc_city: "loc_city", loc_street: "loc_street" };
    const toSave = {};
    const tr = document.querySelector(`tr[data-row-name="${CSS.escape(name)}"]`);

    for (const [ff, val] of Object.entries(fields)) {
        if (!val) continue;
        toSave[ff] = val;
        if (row && keyMap[ff]) row[keyMap[ff]] = val;
        if (tr) {
            const td = tr.querySelector(`td[data-ff="${ff}"]`);
            if (td) {
                td.dataset.val = val;
                td.innerHTML = `<span>${frappe.utils.escape_html(val)}</span>`;
            }
        }
    }

    const siteLocation = _cl_joinLocation(row || {
        loc_country: fields.loc_country,
        loc_dist: fields.loc_district,
        loc_city: fields.loc_city,
        loc_street: fields.loc_street,
    });
    if (siteLocation) {
        toSave.site_location = siteLocation;
        if (row) row.site_loc = siteLocation;
        if (tr) {
            const siteTd = tr.querySelector('td[data-ff="site_location"]');
            if (siteTd) {
                siteTd.dataset.val = siteLocation;
                siteTd.innerHTML = `<span>${frappe.utils.escape_html(siteLocation)}</span>`;
            }
        }
    }

    if (Object.keys(toSave).length) {
        frappe.db.set_value(CL_DOCTYPE, name, toSave)
            .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
    }
}

function _cl_fmtDateTime(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    const date = d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
    const time = d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
    return `${date} ${time}`;
}

function _cl_initials(email) {
    if (!email) return "?";
    return email.split("@")[0].split(/[.\-_]/).map(s => s[0]?.toUpperCase() || "").join("").slice(0, 2) || "?";
}

frappe.provide("frappe.listview_settings");
frappe.listview_settings["CRM Log"] = {
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _cl_render(lv); },
};

function _cl_render(lv) {
    GL.pgRender(lv, {
        doctype: CL_DOCTYPE,
        fields:  _CL_FIELDS,
        orderBy: "date desc",
        mapFn(d, i) {
            const ownerEmail = d.owner || d.assigned_to || "";
            return {
                name: d.name, num: i + 1,
                status:  d.status || "",
                prefix:  d.prefix || "",
                first:   d.first_name || "", last: d.last_name || "", company: d.company_name || "",
                log_date:        _cl_fmtDateTime(d.date),
                owner:           ownerEmail,
                owner_initials:  _cl_initials(ownerEmail),
                log_type:        d.log_type || "", category: d.category || "",
                mobile: d.mobile || "", tel: d.tel || "", email: d.email || "",
                site_loc:    d.site_location || "", maps: d.google_maps_url || "",
                loc_country: d.loc_country || "Lebanon", loc_city: d.loc_city || "", loc_dist: d.loc_district || "", loc_street: d.loc_street || "",
                description: d.description ? d.description.replace(/<[^>]*>/g, "") : "",
                updates:     d.updates     ? d.updates.replace(/<[^>]*>/g, "")     : "",
                has_drawing: d.has_drawing || 0,
                crm_lead: d.crm_lead || "", crm_contact: d.crm_contact || "", crm_customer: d.crm_customer || "",
            };
        },
        cfg: _CL_CFG,
        onAddRow(reload) {
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: { doctype: CL_DOCTYPE, status: "Open", first_name: "New", loc_country: "Lebanon", site_location: "Lebanon" } },
                callback(r) { if (!r.exc) { frappe.show_alert({ message: "Log added", indicator: "green" }, 1.5); reload(); } },
            });
        },
        onLocFill(name, geoFields, changedLocField, rows) {
            const row = rows.find(r => r.name === name);
            const toFill = {};
            const keyMap = { loc_country: "loc_country", loc_district: "loc_dist", loc_city: "loc_city", loc_street: "loc_street" };
            const ffToLocField = { loc_country: "country", loc_district: "district", loc_city: "city", loc_street: "street" };

            for (const [ff, val] of Object.entries(geoFields)) {
                if (!val) continue;
                const lf = ffToLocField[ff];
                if (lf === changedLocField || !(row && row[keyMap[ff]])) {
                    toFill[ff] = val;
                }
            }

            if (Object.keys(toFill).length) _cl_updateLocationCells(name, row, toFill);
        },
        statsFn(raw) {
            const total  = raw.length;
            const open   = raw.filter(d => d.status === "Open").length;
            const done   = raw.filter(d => d.status === "Done").length;
            const now    = new Date(); const m = now.getMonth(), y = now.getFullYear();
            const month  = raw.filter(d => { if (!d.date) return false; const c = new Date(d.date); return c.getMonth()===m && c.getFullYear()===y; }).length;
            return [
                { num: total, label: "Total Logs",  sub: "all time",     colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/><line x1="5" y1="7" x2="11" y2="7"/><line x1="5" y1="10" x2="9" y2="10"/></svg>` },
                { num: open,  label: "Open",        sub: "needs action", colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8"/><circle cx="8" cy="11" r=".5" fill="currentColor"/></svg>` },
                { num: month, label: "This Month",  sub: "log entries",  colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: done,  label: "Done",        sub: "completed",    colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,8 6,12 14,4"/></svg>` },
            ];
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

})(); // end IIFE
