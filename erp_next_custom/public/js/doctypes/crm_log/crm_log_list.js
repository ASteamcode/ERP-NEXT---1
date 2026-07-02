// crm_log_list.js - CRM Log ListView configuration and data behavior
// Flow: who called → interaction details → contact info → site → notes → links

(function () {
"use strict";


// ============================================================================
// Behavior: Screen Ownership
// Function: Defines what the CRM Log ListView shows, how log records map to
// GridShell rows, and which log-specific actions run around the shared UI.
// ============================================================================
const CL_DOCTYPE = "CRM Log";


// ============================================================================
// Behavior: Grid Schema
// Function: Declares CRM Log tabs, fixed columns, editable fields, cell types,
// field mappings, and GridShell options.
// ============================================================================
const _CL_CFG = {
    tabs: ["Log Details", "Contact Info", "Site", "Notes & Outcome", "Links"],

    fixed: [
        { key:"num", label:"#", cls:"pg-f-num", width:42, type:"rownum" },
        { key:"log_date", label:"Date & Time", cls:"pg-f-date", width:132, type:"text" },
        { key:"status", label:"Status", cls:"pg-f-stat", width:74, frappe_field:"status", type:"status",
            map:{
                Open:"pg-badge-blue",
                Scheduled:"pg-badge-indigo",
                Viewed:"pg-badge-teal",
                Cancelled:"pg-badge-gray",
                Done:"pg-badge-lime"
            }
        },
        
    ],

    cols: [
        // Tab 0 — Log Details
        { tab:0, key:"prefix", label:"Pre", type:"select", frappe_field:"prefix", width:48, plain:true,
            options:["","Mr","Ms","Mrs","Dr","Eng","Arch"]
        },

        { tab:0, key:"first", label:"First", type:"text", frappe_field:"first_name", width:80, required:true },

        { tab:0, key:"last", label:"Last", type:"text", frappe_field:"last_name", width:80 },

        { tab:0, key:"company", label:"Company", type:"company", frappe_field:"company_name", companySource:"client", shadow:true, width:140, lockWidth:true, required:true },

        { tab:0, key:"mobile", label:"Mobile", type:"phone", frappe_field:"mobile", width:100 },

        { tab:0, key:"site_loc", label:"Location", type:"text", frappe_field:"site_location", width:130 },

        { tab:0, key:"description", label:"Description", type:"notes", frappe_field:"description", width:420 },

        { tab:0, key:"owner_initials", label:"Owner", type:"owner", width:70 },

        { tab:0, key:"log_type", label:"Call Type", type:"select", frappe_field:"log_type", width:130,
            options:["","Inbound call","Quotation","Field","Job","Transport","Yard"]
        },

        { tab:0, key:"category", label:"Category", type:"select", frappe_field:"category", width:130,
            options:["","Lead","Site Surveys","Measurements Take Off","Estimation","Quotation"]
        },

        // Tab 1 — Contact Info
        { tab:1, key:"tel", label:"Tel", type:"phone", frappe_field:"tel", width:120 },

        { tab:1, key:"email", label:"Email", type:"link", frappe_field:"email", width:190 },

        // Tab 2 — Site
        
        { tab:2, key:"maps", label:"Maps", type:"maps", frappe_field:"google_maps_url", width:80 },

        { tab:2, key:"loc_country", label:"Country", type:"locautocomplete", frappe_field:"loc_country", locField:"country", width:90 },

        { tab:2, key:"loc_dist", label:"District", type:"locautocomplete", frappe_field:"loc_district", locField:"district", width:110 },

        { tab:2, key:"loc_city", label:"City", type:"locautocomplete", frappe_field:"loc_city", locField:"city", width:90 },

        { tab:2, key:"loc_street", label:"Street", type:"locautocomplete", frappe_field:"loc_street", locField:"street", width:130 },

        // Tab 3 — Notes & Outcome
        { tab:3, key:"updates", label:"Updates", type:"notes", frappe_field:"updates", width:260 },

        { tab:3, key:"follow_up_date", label:"Follow Up Date", type:"date", frappe_field:"follow_up_date", width:130 },

        { tab:3, key:"follow_up_notes", label:"Follow Up Notes", type:"notes", frappe_field:"follow_up_notes", width:260 },

        { tab:3, key:"drawing", label:"Drawing", type:"drawing", width:100 },

        { tab:3, key:"files", label:"Files", type:"files", width:100 },

        // Tab 4 — Links
        { tab:4, key:"crm_lead", label:"Lead", type:"text", frappe_field:"crm_lead", icon:"lead_ic", width:150 },

        { tab:4, key:"crm_contact", label:"Contact", type:"text", frappe_field:"crm_contact", icon:"person", width:150 },

        { tab:4, key:"crm_customer", label:"Customer", type:"text", frappe_field:"crm_customer", icon:"building", width:150 },
    ],

    rows: [],
    locFields: { country: "loc_country", district: "loc_district", city: "loc_city", street: "loc_street" },
    locKeys: { country: "loc_country", district: "loc_dist", city: "loc_city", street: "loc_street" },
    editable: true,
    doctype: CL_DOCTYPE,
    searchPlaceholder: "Search logs…",
    exportLabel: "Export Logs",
    maxBodyHeight: "calc(100vh - 300px)",
    colWidthKey: "crm_log_pg_col_widths",
};


// ============================================================================
// Behavior: Data Fetch Contract
// Function: Lists the Frappe fields required to build each CRM Log grid row.
// ============================================================================
const _CL_FIELDS = [
    "name","status","date","prefix","first_name","last_name","company_name",
    "log_type","category","assigned_to","owner",
    "mobile","tel","email",
    "site_location","google_maps_url","loc_country","loc_city","loc_district","loc_street",
    "description","updates","follow_up_date","follow_up_notes","has_drawing",
    "crm_lead","crm_contact","crm_customer",
];


// ============================================================================
// Behavior: Draft Rows And Quick Entry
// Function: Manages unsaved client-side log rows before they become CRM Log docs.
// ============================================================================
let _cl_draftRow = null;
let _cl_draftExtra = {};
let _cl_bottomDraftRows = [];
let _cl_bottomDraftExtra = {};
let _cl_draftSeq = 0;
let _cl_draftSaving = new Set();
let _cl_pendingDraftFocus = null;

function _cl_isDraftName(name) {
    return !!name && String(name).startsWith("__draft__");
}

function _cl_makeDraftRow(name = "__draft__top") {
    return {
        name,
        status: "Open",
        log_date: _cl_fmtDateTime(frappe.datetime.now_datetime()),
        loc_country: "Lebanon",
        site_loc: "Lebanon",
    };
}

function _cl_ensureDraftRow() {
    if (!_cl_draftRow) {
        _cl_draftRow = _cl_makeDraftRow();
        _cl_draftExtra = {};
    }
    return _cl_draftRow;
}

function _cl_newBottomDraftRow() {
    const row = _cl_makeDraftRow(`__draft__bottom_${Date.now()}_${++_cl_draftSeq}`);
    _cl_bottomDraftRows.push(row);
    _cl_bottomDraftExtra[row.name] = {};
    return row;
}

function _cl_draftRowFor(name) {
    if (name === "__draft__top") return _cl_ensureDraftRow();
    return _cl_bottomDraftRows.find(r => r.name === name) || null;
}

function _cl_draftExtraFor(name) {
    if (name === "__draft__top") return _cl_draftExtra;
    _cl_bottomDraftExtra[name] = _cl_bottomDraftExtra[name] || {};
    return _cl_bottomDraftExtra[name];
}

function _cl_resetDraft(name) {
    if (name === "__draft__top") {
        _cl_draftRow = _cl_makeDraftRow();
        _cl_draftExtra = {};
        return;
    }
    _cl_bottomDraftRows = _cl_bottomDraftRows.filter(r => r.name !== name);
    delete _cl_bottomDraftExtra[name];
}

function _cl_displayRowsWithDraft(rows) {
    const savedRows = (rows || []).filter(r => r && !_cl_isDraftName(r.name));
    const bottomRows = _cl_bottomDraftRows.filter(r => !_cl_draftSaving.has(r.name));
    return [_cl_ensureDraftRow(), ...savedRows, ...bottomRows];
}

function _cl_ffToKey(frappe_field) {
    const all = [..._CL_CFG.fixed, ..._CL_CFG.cols];
    const col = all.find(c => c.frappe_field === frappe_field);
    return col ? col.key : null;
}

function _cl_focusDraftFirst(host, draftName = "__draft__top", scrollToRow = false) {
    setTimeout(() => {
        requestAnimationFrame(() => {
            const selector = `tr[data-row-name="${CSS.escape(draftName)}"]`;
            const tr = host && host.querySelector(selector);
            if (!tr) return;
            if (scrollToRow) tr.scrollIntoView({ block: "nearest", inline: "nearest" });
            const target = tr.querySelector('td[data-ff="first_name"][data-val=""]')
                || tr.querySelector('td[data-ff="company_name"][data-val=""]')
                || tr.querySelector('td[data-ff="first_name"]')
                || tr.querySelector('td[data-ff="company_name"]');
            if (target) target.click();
        });
    }, 250);
}


// ============================================================================
// Behavior: Location Display And Autofill
// Function: Joins location fields for display and updates related cells after
// location autocomplete or Maps-derived edits.
// ============================================================================
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

    try {
        const value = String(v).replace("T", " ");
        const [datePart, timePart = "00:00:00"] = value.split(" ");

        const [year, month, day] = datePart.split("-");
        const [hour = "00", minute = "00"] = timePart.split(":");

        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    } catch {
        return v;
    }
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


// ============================================================================
// Behavior: Fetch, Map, And Render
// Function: Fetches CRM Log documents, maps them into GridShell rows, computes
// stats, and wires log-specific save/delete actions.
// ============================================================================
function _cl_render(lv) {
    GL.pgRender(lv, {
        doctype: CL_DOCTYPE,
        fields:  _CL_FIELDS,
        orderBy: "creation asc",
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
                follow_up_date: d.follow_up_date || "",
                follow_up_notes: d.follow_up_notes ? d.follow_up_notes.replace(/<[^>]*>/g, "") : "",
                has_drawing: d.has_drawing || 0,
                crm_lead: d.crm_lead || "", crm_contact: d.crm_contact || "", crm_customer: d.crm_customer || "",
            };
        },
        cfg: _CL_CFG,
        extendRows(rows) {
            return _cl_displayRowsWithDraft(rows);
        },
        onEdit(name, frappe_field, value, ctx) {
            if (_cl_isDraftName(name)) {
                if (_cl_draftSaving.has(name)) return Promise.resolve();
                const draftRow = _cl_draftRowFor(name);
                const draftExtra = _cl_draftExtraFor(name);
                if (!draftRow) return Promise.resolve();

                const key = _cl_ffToKey(frappe_field);
                const cleanValue = value == null ? "" : String(value);
                if (key) draftRow[key] = cleanValue;
                if (cleanValue.trim()) draftExtra[frappe_field] = cleanValue;
                else delete draftExtra[frappe_field];

                const hasFirst = !!(draftExtra.first_name || "").trim();
                const hasCompany = !!(draftExtra.company_name || "").trim();
                if (!hasFirst || !hasCompany) return Promise.resolve();

                const doc = Object.assign({
                    doctype: CL_DOCTYPE,
                    status: "Open",
                    date: frappe.datetime.now_datetime(),
                    loc_country: "Lebanon",
                    site_location: "Lebanon",
                }, draftExtra);

                _cl_draftSaving.add(name);
                _cl_resetDraft(name);

                return frappe.call({
                    method: "frappe.client.insert",
                    args: { doc },
                    callback(r) {
                        _cl_draftSaving.delete(name);
                        if (!r.exc) frappe.show_alert({ message: "Log added", indicator: "green" }, 1.5);
                        ctx.reload();
                    },
                    error() {
                        _cl_draftSaving.delete(name);
                        frappe.show_alert({ message: "Failed to save new log", indicator: "red" }, 4);
                        ctx.reload();
                    },
                });
            }
            return frappe.db.set_value(CL_DOCTYPE, name, frappe_field, value)
                .catch(e => frappe.show_alert({ message: "Save failed: " + e, indicator: "red" }, 4));
        },
        onAddRow(reload, lv, grid) {
            const row = _cl_newBottomDraftRow();
            if (grid && grid.appendRow) {
                grid.appendRow(row);
                const host = GL.bootstrap(lv, { doctype: CL_DOCTYPE });
                requestAnimationFrame(() => _cl_focusDraftFirst(host, row.name, true));
                return;
            }
            _cl_pendingDraftFocus = row.name;
            reload();
        },
        onDeleteRows(names, reload) {
            const draftNames = names.filter(_cl_isDraftName);
            const savedNames = names.filter(n => !_cl_isDraftName(n));
            const clearDrafts = () => draftNames.forEach(_cl_resetDraft);
            if (!savedNames.length) { clearDrafts(); reload(); return; }

            const lbl = savedNames.length === 1 ? "1 crm log" : `${savedNames.length} records`;
            frappe.confirm(`Delete ${lbl}? This cannot be undone.`, () => {
                clearDrafts();
                let done = 0;
                savedNames.forEach(n => frappe.call({
                    method: "frappe.client.delete",
                    args: { doctype: CL_DOCTYPE, name: n },
                    callback() {
                        if (++done === savedNames.length) {
                            frappe.show_alert({ message: "Deleted", indicator: "orange" }, 2);
                            reload();
                        }
                    },
                }));
            });
        },
        afterMount(host) {
            if (!_cl_pendingDraftFocus) return;
            const focusName = _cl_pendingDraftFocus;
            _cl_pendingDraftFocus = null;
            _cl_focusDraftFirst(host, focusName, true);
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

// ============================================================================
// Behavior: CRM Log List Styling
// Function: Adds only CRM Log-specific CSS. Shared table styling stays in
// core/grid/tabbed_grid.js.
// ============================================================================
(function () {
    if (document.getElementById("cl-pg-styles")) return;
    const s = document.createElement("style"); s.id = "cl-pg-styles";
    s.textContent = `
.gl-host{padding:12px 16px 0;box-sizing:border-box;}
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
