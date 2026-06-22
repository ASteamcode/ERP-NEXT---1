// prospect_list.js — Prospect list view powered by PG (prospect_grid.js)
"use strict";

const _PROSPECT_CFG = {
    tabs: ["Profile & Context", "Site Info", "Scope & Specs", "Site Team", "Social & Web"],
    fixed: [
        { key: "num",     label: "#",          cls: "pg-f-num",   width: 42,  type: "rownum" },
        { key: "title",   label: "Title",      cls: "pg-f-title", width: 54,  frappe_field: "custom_salutation", type: "select", options: ["", "Mr", "Ms", "Mrs", "Dr", "Arch", "Eng"] },
        { key: "first",   label: "First Name", cls: "pg-f-first", width: 105, frappe_field: "custom_first_name"  },
        { key: "last",    label: "Last Name",  cls: "pg-f-last",  width: 110, frappe_field: "custom_last_name"   },
        { key: "company", label: "Company",    cls: "pg-f-co",    width: 168, frappe_field: "company_name", shadow: true },
    ],
    cols: [
        { tab: 0, key: "owner_initials", label: "Owner", type: "owner"                                       },
        { tab: 0, key: "role",     label: "Role",           type: "text",   frappe_field: "custom_position"       },
        { tab: 0, key: "status",   label: "Status",         type: "status", frappe_field: "custom_prospect_status",
          map: { Lead: "pg-badge-blue", "In Discussion": "pg-badge-amber", Contacted: "pg-badge-gray", Converted: "pg-badge-green", Lost: "pg-badge-red" } },
        { tab: 0, key: "mobile",   label: "Primary Mobile", type: "phone",  frappe_field: "custom_mobile"         },
        { tab: 0, key: "email",    label: "Email",          type: "link",   frappe_field: "custom_email"          },
        { tab: 1, key: "city",     label: "Site Location",  type: "text",   frappe_field: "custom_site_location"  },
        { tab: 1, key: "maps",     label: "Google Maps",    type: "maps",   frappe_field: "custom_maps_url"       },
        { tab: 1, key: "files",    label: "Files",          type: "files"                                         },
        { tab: 1, key: "drawing",  label: "Drawing",        type: "drawing"                                       },
        { tab: 2, key: "pstatus",  label: "Project Status", type: "status", frappe_field: "custom_project_status",
          map: { "Empty lot": "pg-badge-gray", "Excavation": "pg-badge-amber", "Concrete structure": "pg-badge-amber", "Topped out": "pg-badge-blue", "Finishing": "pg-badge-blue", "MEP": "pg-badge-amber", "Completed": "pg-badge-green" } },
        { tab: 2, key: "pstart",   label: "Start Date",     type: "date",   frappe_field: "custom_project_start" },
        { tab: 2, key: "floors",   label: "Floors",         type: "num",    frappe_field: "custom_floors"        },
        { tab: 2, key: "area",     label: "Area (sqm)",     type: "num",    frappe_field: "custom_area"          },
        { tab: 2, key: "scaffold", label: "Scaffold Type",  type: "text",   frappe_field: "custom_scaffold_type" },
        { tab: 2, key: "ptype",    label: "Project Type",   type: "text",   frappe_field: "custom_project_type"  },
        { tab: 3, key: "architect",  label: "Architect",       type: "text",   frappe_field: "custom_architect"     },
        { tab: 3, key: "proj_owner", label: "Project Owner",   type: "text",   frappe_field: "custom_project_owner" },
        { tab: 3, key: "site_eng",   label: "Site Engineer",   type: "text",   frappe_field: "custom_site_engineer" },
        { tab: 3, key: "workers",    label: "Workers on Site", type: "num",    frappe_field: "custom_workers_count" },
        { tab: 3, key: "safety",     label: "Safety Officer",  type: "text",   frappe_field: "custom_safety_officer"},
        { tab: 3, key: "contract",   label: "Contract Value",  type: "text",   frappe_field: "custom_contract_value"},
        { tab: 4, key: "instagram",label: "Instagram",      type: "link",   frappe_field: "custom_instagram"    },
        { tab: 4, key: "linkedin", label: "LinkedIn",       type: "link",   frappe_field: "custom_linkedin"     },
        { tab: 4, key: "facebook", label: "Facebook",       type: "link",   frappe_field: "custom_facebook"     },
        { tab: 4, key: "telegram", label: "Telegram",       type: "link",   frappe_field: "custom_telegram"     },
        { tab: 4, key: "website",  label: "Website",        type: "link",   frappe_field: "website"             },
    ],
    rows: [],
    editable: true,
    doctype: "Prospect",
};

// ── Listview hook ──────────────────────────────────────────────────
frappe.provide("frappe.listview_settings.Prospect");

frappe.listview_settings.Prospect = {
    onload(listview) {
        GL.suppressRefresh(listview);
        _pl_hide_chrome(listview);
    },
    refresh(listview) {
        _pl_hide_chrome(listview);
        _pl_render(listview);
    },
};

function _pl_hide_chrome(listview) {
    const $p = listview.$page;
    $p.find(".page-head").hide();
    $p.find(".page-form").hide();
    $p.find(".standard-filter-section, .filter-section, .sort-selector, .filter-selector").hide();
    $p.find(".list-filters-area, .list-filter-area, .sort-filter-area, .tag-filters-area").hide();
    $p.find(".list-header-meta, .list-toolbar-wrapper, .list-toolbar").hide();
    $p.find("header.list-row-head, .list-row-head").hide();
}

// ── Render ─────────────────────────────────────────────────────────
function _pl_render(listview) {
    const host = GL.bootstrap(listview, { doctype: "Prospect" });
    if (!host) return;
    GL.hideNative(listview);

    host.innerHTML = `<div class="pl-loading">Loading prospects…</div>`;

    frappe.call({
        method: "erp_next_custom.erp_next_custom.page.project_board.project_board.get_prospects",
        callback(r) {
            if (!host || !document.contains(host)) return;
            const cfg = Object.assign({}, _PROSPECT_CFG, {
                rows: r.message || [],

                onReload() { _pl_render(listview); },

                onEdit(name, frappe_field, value) {
                    frappe.db.set_value("Prospect", name, frappe_field, value)
                        .catch(err => frappe.show_alert({ message: "Save failed: " + err, indicator: "red" }, 4));
                },

                onAddRow(reload) {
                    const d = new frappe.ui.Dialog({
                        title: "Add Prospect",
                        fields: [
                            { label: "First Name", fieldname: "custom_first_name", fieldtype: "Data", reqd: 0 },
                            { label: "Last Name",  fieldname: "custom_last_name",  fieldtype: "Data", reqd: 0 },
                            { label: "Company",    fieldname: "company_name",       fieldtype: "Data", reqd: 1 },
                            { label: "Status",     fieldname: "custom_prospect_status", fieldtype: "Select",
                              options: "Lead\nIn Discussion\nContacted\nConverted\nLost", default: "Lead" },
                        ],
                        primary_action_label: "Create",
                        primary_action(vals) {
                            d.hide();
                            frappe.call({
                                method: "frappe.client.insert",
                                args: {
                                    doc: Object.assign({ doctype: "Prospect" }, vals),
                                },
                                callback() {
                                    frappe.show_alert({ message: "Prospect created", indicator: "green" }, 3);
                                    reload();
                                },
                            });
                        },
                    });
                    d.show();
                },

                onDeleteRows(names, reload) {
                    const label = names.length === 1 ? "1 prospect" : `${names.length} prospects`;
                    frappe.confirm(
                        `Delete ${label}? This cannot be undone.`,
                        () => {
                            let done = 0;
                            names.forEach(n => {
                                frappe.call({
                                    method: "frappe.client.delete",
                                    args: { doctype: "Prospect", name: n },
                                    callback() {
                                        done++;
                                        if (done === names.length) {
                                            frappe.show_alert({ message: `Deleted ${label}`, indicator: "orange" }, 3);
                                            reload();
                                        }
                                    },
                                });
                            });
                        }
                    );
                },

                onExportLeads(rows, reload) {
                    const leads = rows.filter(r => r.status === "Lead");
                    if (!leads.length) {
                        frappe.show_alert({ message: "No rows with status 'Lead'.", indicator: "orange" }, 4);
                        return;
                    }
                    frappe.confirm(
                        `Export ${leads.length} prospect(s) to Lead and Contact? Duplicates (matched by email) will be skipped.`,
                        () => {
                            // Two operations per row (Lead + Contact)
                            const total = leads.length * 2;
                            let done = 0;
                            let lCreated = 0, lSkipped = 0;
                            let cCreated = 0, cSkipped = 0;
                            let errs = 0;

                            function _checkDone() {
                                if (done < total) return;
                                const parts = [];
                                if (lCreated) parts.push(`${lCreated} lead${lCreated > 1 ? "s" : ""} created`);
                                if (lSkipped) parts.push(`${lSkipped} lead${lSkipped > 1 ? "s" : ""} skipped`);
                                if (cCreated) parts.push(`${cCreated} contact${cCreated > 1 ? "s" : ""} created`);
                                if (cSkipped) parts.push(`${cSkipped} contact${cSkipped > 1 ? "s" : ""} skipped`);
                                if (errs)     parts.push(`${errs} failed`);
                                frappe.show_alert({
                                    message: "Export: " + (parts.join(", ") || "nothing to do"),
                                    indicator: errs ? "orange" : "green",
                                }, 7);
                                reload();
                            }

                            function _isDupe(msg) {
                                return msg.includes("Duplicate") || msg.includes("duplicate") || msg.includes("already exists");
                            }

                            function _insertLead(row) {
                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            doctype:      "Lead",
                                            first_name:   row.first   || row.company || "Unknown",
                                            last_name:    row.last    || "",
                                            company_name: row.company || "",
                                            mobile_no:    row.mobile  || "",
                                            email_id:     row.email   || "",
                                            website:      row.website || "",
                                            lead_name:    [row.first, row.last].filter(Boolean).join(" ") || row.company || "Lead",
                                        },
                                    },
                                    callback()  { lCreated++; done++; _checkDone(); },
                                    error(err)  {
                                        _isDupe((err && err.message) || "") ? lSkipped++ : errs++;
                                        done++; _checkDone();
                                    },
                                });
                            }

                            function _insertContact(row) {
                                const doc = {
                                    doctype:      "Contact",
                                    first_name:   row.first   || row.company || "Unknown",
                                    last_name:    row.last    || "",
                                    company_name: row.company || "",
                                };
                                if (row.email)  doc.email_ids  = [{ email_id: row.email,  is_primary: 1 }];
                                if (row.mobile) doc.phone_nos  = [{ phone: row.mobile, is_primary_mobile_no: 1 }];
                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: { doc },
                                    callback()  { cCreated++; done++; _checkDone(); },
                                    error(err)  {
                                        _isDupe((err && err.message) || "") ? cSkipped++ : errs++;
                                        done++; _checkDone();
                                    },
                                });
                            }

                            leads.forEach(row => {
                                // ── Lead: check by email then insert ──
                                if (row.email) {
                                    frappe.call({
                                        method: "frappe.client.get_list",
                                        args: { doctype: "Lead", filters: { email_id: row.email }, fields: ["name"], limit: 1 },
                                        callback(r) {
                                            if (r.message && r.message.length) { lSkipped++; done++; _checkDone(); }
                                            else _insertLead(row);
                                        },
                                        error() { _insertLead(row); },
                                    });
                                } else {
                                    _insertLead(row);
                                }

                                // ── Contact: check by email then insert ──
                                if (row.email) {
                                    frappe.call({
                                        method: "frappe.client.get_list",
                                        args: { doctype: "Contact Email", filters: { email_id: row.email }, fields: ["parent"], limit: 1 },
                                        callback(r) {
                                            if (r.message && r.message.length) { cSkipped++; done++; _checkDone(); }
                                            else _insertContact(row);
                                        },
                                        error() { _insertContact(row); },
                                    });
                                } else {
                                    _insertContact(row);
                                }
                            });
                        }
                    );
                },
            });
            PG.mount(host, cfg);
        },
    });
}

// ── Styles ─────────────────────────────────────────────────────────
(function () {
    if (document.getElementById("pl-styles")) return;
    const s = document.createElement("style");
    s.id = "pl-styles";
    s.textContent = `
.gl-host { padding: 12px 16px 32px; box-sizing: border-box; }
.pl-loading { padding: 48px; text-align: center; color: #9ca3af; font-size: 13px; }

/* Strip all native Frappe chrome from the Prospect list page */
.page-container[data-page-route="List/Prospect/List"] .page-head,
.page-container[data-page-route="List/Prospect/List"] .page-form,
.page-container[data-page-route="List/Prospect/List"] .standard-filter-section,
.page-container[data-page-route="List/Prospect/List"] .filter-section,
.page-container[data-page-route="List/Prospect/List"] .sort-selector,
.page-container[data-page-route="List/Prospect/List"] .filter-selector,
.page-container[data-page-route="List/Prospect/List"] .list-filters-area,
.page-container[data-page-route="List/Prospect/List"] .list-filter-area,
.page-container[data-page-route="List/Prospect/List"] .sort-filter-area,
.page-container[data-page-route="List/Prospect/List"] .tag-filters-area,
.page-container[data-page-route="List/Prospect/List"] .list-header-meta,
.page-container[data-page-route="List/Prospect/List"] .list-toolbar-wrapper,
.page-container[data-page-route="List/Prospect/List"] .list-toolbar,
.page-container[data-page-route="List/Prospect/List"] .list-row-head { display: none !important; }
`;
    document.head.appendChild(s);
})();
