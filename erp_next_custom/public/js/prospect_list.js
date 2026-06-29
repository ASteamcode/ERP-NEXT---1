// prospect_list.js — Prospect list view powered by PG (prospect_grid.js)
"use strict";

// Draft row state — survives re-renders until committed to server
let _draftRow   = null; // { name:"__draft__", ...keyedFields }
let _draftExtra = {};   // frappe_field → value buffered before company_name is known

function _ffToKey(frappe_field) {
    const all = [..._PROSPECT_CFG.fixed, ..._PROSPECT_CFG.cols];
    const col = all.find(c => c.frappe_field === frappe_field);
    return col ? col.key : null;
}

function _focusDraftCompany(host) {
    // After re-render, click-open the company cell in the draft row
    requestAnimationFrame(() => {
        const tr = host && host.querySelector('tr[data-row-name="__draft__"]');
        if (!tr) return;
        const companyTd = tr.querySelector('.pg-f-co.pg-ed');
        if (companyTd) companyTd.click();
    });
}

function _extractMapsCoords(url) {
    // @lat,lng,zoom  or  @lat,lng
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: m[1], lng: m[2] };
    // ?q=lat,lng
    const q = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (q) return { lat: q[1], lng: q[2] };
    return null;
}

// Fill multiple location cells in one server call (avoids deadlock from parallel set_value)
function _fillLocationCells(name, row, fields) {
    const keyMap = { custom_site_country: "site_country", custom_site_district: "site_district", custom_site_city: "site_city", custom_site_street: "site_street" };
    const toSave = {};
    const tr = document.querySelector(`tr[data-row-name="${CSS.escape(name)}"]`);
    for (const [ff, val] of Object.entries(fields)) {
        if (!val) continue;
        toSave[ff] = val;
        if (row) row[keyMap[ff]] = val;
        if (tr) {
            const td = tr.querySelector(`td[data-ff="${ff}"]`);
            if (td) { td.dataset.val = val; td.innerHTML = `<span>${val}</span>`; }
        }
    }
    if (Object.keys(toSave).length) {
        frappe.db.set_value("Prospect", name, toSave)
            .catch(() => {});
    }
}

function _geocodeAndFillLocation(name, url, row) {
    const coords = _extractMapsCoords(url);
    if (!coords) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&addressdetails=1`, {
        headers: { "Accept-Language": "en" }
    })
    .then(r => r.json())
    .then(data => {
        const a = data.address || {};
        _fillLocationCells(name, row, {
            custom_site_country:  a.country,
            custom_site_district: a.state || a.state_district || a.county,
            custom_site_city:     a.city  || a.town || a.village || a.suburb,
            custom_site_street:   a.road  || a.pedestrian || a.neighbourhood,
        });
    })
    .catch(() => {});
}

const _PROSPECT_CFG = {
    tabs: ["Profile & Contact", "Site Info", "Scope & Specs", "Site Team", "Social & Web"],
    fixed: [
        { key: "num",     label: "#",          cls: "pg-f-num",   width: 42,  type: "rownum" },
        { key: "title",   label: "Title",      cls: "pg-f-title", width: 54,  frappe_field: "custom_salutation", type: "select", options: ["", "Mr", "Ms", "Mrs", "Dr", "Arch", "Eng"] },
        { key: "first",   label: "First Name", cls: "pg-f-first", width: 105, frappe_field: "custom_first_name"  },
        { key: "last",    label: "Last Name",  cls: "pg-f-last",  width: 110, frappe_field: "custom_last_name"   },
        { key: "company", label: "Company",    cls: "pg-f-co",    width: 168, frappe_field: "company_name", type: "company", shadow: true },
    ],
    cols: [
        { tab: 0, key: "owner_initials", label: "Owner", type: "owner"                                       },
        { tab: 0, key: "activity", label: "Activity Type",   type: "dynselect", frappe_field: "custom_company_activity_type",
          dynKey: "pg_acttype",
          options: ["Construction", "Real Estate Development", "Architecture", "Engineering", "General Contracting", "Interior Design", "Infrastructure", "Government / Public Works", "Industrial", "Commercial Development", "Residential Development"] },
        { tab: 0, key: "source",   label: "Source",         type: "select", frappe_field: "custom_lead_source",
          options: ["", "Referral", "Cold Call", "Walk-in", "Website", "Exhibition", "Social Media", "Digital"] },
        { tab: 0, key: "role",     label: "Role",           type: "dynselect", frappe_field: "custom_position", dynKey: "pg_role",
          options: ["Owner / Partner","General Manager","Project Manager","Site Engineer","Site Foreman / معلم","Technical / Studies Engineer","Procurement / Purchasing","Architect","Quantity Surveyor","Accountant / Finance","Other"] },
        { tab: 0, key: "stage",    label: "Stage",          type: "status", frappe_field: "custom_stage",
          map: {
            "Prospect":      "pg-badge-gray",
            "Outreached":    "pg-badge-blue",
            "Passby Visit":  "pg-badge-indigo",
            "Lead":          "pg-badge-teal",
            "Site Visit":    "pg-badge-purple",
            "Quotation":     "pg-badge-orange",
            "Negotiation":   "pg-badge-yellow",
            "Won":           "pg-badge-green",
            "Job Scheduled": "pg-badge-emerald",
            "Lost":          "pg-badge-red",
          } },
        { tab: 0, key: "mobile",   label: "Primary Mobile", type: "phone",  frappe_field: "custom_mobile", width: 170 },
        { tab: 0, key: "email",    label: "Email",          type: "link",   frappe_field: "custom_email"          },
        { tab: 1, key: "site_country",  label: "Country",  type: "locautocomplete", frappe_field: "custom_site_country",  locField: "country",  width: 90  },
        { tab: 1, key: "site_district", label: "District", type: "locautocomplete", frappe_field: "custom_site_district", locField: "district", width: 110 },
        { tab: 1, key: "site_city",     label: "City",     type: "locautocomplete", frappe_field: "custom_site_city",     locField: "city",     width: 90  },
        { tab: 1, key: "site_street",   label: "Street",   type: "locautocomplete", frappe_field: "custom_site_street",   locField: "street",   width: 130 },
        { tab: 1, key: "maps",        label: "Google Maps",    type: "maps",   frappe_field: "custom_maps_url",   width: 130 },
        { tab: 1, key: "description", label: "Description",   type: "notes",  frappe_field: "custom_description", width: 340 },
        { tab: 1, key: "files",       label: "Files",          type: "files"                                      },
        { tab: 1, key: "drawing",  label: "Drawing",        type: "drawing"                                       },
        { tab: 2, key: "pstatus",  label: "Project Status", type: "status", frappe_field: "custom_project_status",
          map: { "Empty lot": "pg-badge-gray", "Excavation": "pg-badge-amber", "Concrete structure": "pg-badge-orange", "Topped out": "pg-badge-yellow", "Finishing": "pg-badge-lime", "MEP": "pg-badge-blue", "Completed": "pg-badge-green" } },
        { tab: 2, key: "pstart",   label: "Start Date",     type: "date",   frappe_field: "custom_project_start" },
        { tab: 2, key: "floors",   label: "Floors",         type: "num",    frappe_field: "custom_floors"        },
        { tab: 2, key: "ptype",    label: "Project Type",   type: "select", frappe_field: "custom_project_type",
          options: ["", "Commercial", "Residential", "Industrial", "Religious", "Building – New Construction", "Building – Renovation / Façade", "High-Rise / Tower", "Industrial / Plant", "Bridge / Infrastructure", "Heritage / Restoration", "Shoring / Propping", "Event / Temporary Structure", "Other"] },
        { tab: 2, key: "scaffold", label: "Scaffold Type",  type: "select", frappe_field: "custom_scaffold_type",
          options: ["", "External Scaffolding", "Propping Scaffolding", "Adjustable Props", "Rental per Piece", "Sales per Piece", "Sales Used", "Mobile Scaffolding"] },
        { tab: 2, key: "area",     label: "Area (sqm)",     type: "num",    frappe_field: "custom_area"          },
        { tab: 2, key: "scope_notes", label: "Notes",       type: "notes",  frappe_field: "custom_scope_notes", width: 200 },
        { tab: 3, key: "architect",  label: "Contact Person #1", type: "contact-link", frappe_field: "custom_architect",         contactPre: "", noAvatar: true },
        { tab: 3, key: "cp1",        label: "Contact Person #2", type: "contact-link", frappe_field: "custom_project_owner",     contactPre: "", noAvatar: true },
        { tab: 3, key: "cp2",        label: "Contact Person #3", type: "contact-link", frappe_field: "custom_site_engineer",     contactPre: "", noAvatar: true },
        { tab: 3, key: "cp3",        label: "Contact Person #4", type: "contact-link", frappe_field: "custom_safety_officer",    contactPre: "", noAvatar: true },
        { tab: 3, key: "cp4",        label: "Contact Person #5", type: "contact-link", frappe_field: "custom_contact_person_4",  contactPre: "", noAvatar: true },
        { tab: 3, key: "workers",    label: "Workers on Site",   type: "num",    frappe_field: "custom_workers_count" },
        { tab: 3, key: "contract",   label: "Contract Value",    type: "text",   frappe_field: "custom_contract_value"},
        { tab: 4, key: "instagram",label: "Instagram",      type: "link",   frappe_field: "custom_instagram"    },
        { tab: 4, key: "linkedin", label: "LinkedIn",       type: "link",   frappe_field: "custom_linkedin"     },
        { tab: 4, key: "facebook", label: "Facebook",       type: "link",   frappe_field: "custom_facebook"     },
        { tab: 4, key: "telegram", label: "Telegram",       type: "link",   frappe_field: "custom_telegram"     },
        { tab: 4, key: "website",  label: "Website",        type: "link",   frappe_field: "website"             },
        { tab: 4, key: "tiktok",   label: "TikTok",         type: "link",   frappe_field: "custom_tiktok"       },
        { tab: 4, key: "x",        label: "X",              type: "link",   frappe_field: "custom_x"            },
    ],
    rows: [],
    editable: true,
    doctype: "Prospect",
    searchPlaceholder: "Search Sales REP CRM…",
    exportLabel: "Export Sales REP CRM",
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
    $p.find(".list-paging-area").hide();
}

const _PL_LIMIT = 500;
let _pl_allRows = [];   // accumulates rows across load-more calls

// ── Render ─────────────────────────────────────────────────────────
function _pl_render(listview) {
    _pl_allRows = [];
    _pl_fetch(listview, 0);
}

function _pl_fetch(listview, offset) {
    const host = GL.bootstrap(listview, { doctype: "Prospect" });
    if (!host) return;
    GL.hideNative(listview);

    if (offset === 0) host.innerHTML = `<div class="pl-loading">Loading prospects…</div>`;

    frappe.call({
        method: "erp_next_custom.erp_next_custom.page.project_board.project_board.get_prospects",
        args: { limit: _PL_LIMIT, offset },
        callback(r) {
            if (!host || !document.contains(host)) return;
            const newRows = r.message || [];
            if (offset === 0) _pl_allRows = newRows;
            else _pl_allRows = [..._pl_allRows, ...newRows];
            const rows = _pl_allRows;
            const hasMore = newRows.length === _PL_LIMIT;

            // ── Quick stats (computed here, rendered after PG.mount) ─────
            const _qs_total     = rows.length;
            const _qs_leads     = rows.filter(d => (d.custom_prospect_status || "") === "Lead").length;
            const _qs_converted = rows.filter(d => (d.custom_prospect_status || "") === "Converted").length;
            const _qs_rate      = _qs_total ? Math.round((_qs_converted / _qs_total) * 100) : 0;
            const _qs_month     = (() => {
                const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
                return rows.filter(d => { if (!d.creation) return false; const c = new Date(d.creation); return c.getMonth()===m && c.getFullYear()===y; }).length;
            })();
            const _qs_cards = [
                { num: _qs_total,      label: "Total Sales REP CRM", sub: "all time",         colorCls: "pg-qs-c1",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-2.8 2.2-5 5-5"/><circle cx="12" cy="11" r="3"/><path d="M9 11h6"/></svg>` },
                { num: _qs_leads,      label: "Active Leads",   sub: "prospect status",   colorCls: "pg-qs-c2",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 4H14l-3.5 2.5 1.5 4L8 10.5 4 12.5l1.5-4L2 6h4.5z"/></svg>` },
                { num: _qs_month,      label: "This Month",     sub: "new prospects",     colorCls: "pg-qs-c3",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/><line x1="2" y1="7" x2="14" y2="7"/></svg>` },
                { num: _qs_rate + "%", label: "Conversion",     sub: "converted / total", colorCls: "pg-qs-c4",
                  icon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,11 5,7 9,9 15,3"/><polyline points="11,3 15,3 15,7"/></svg>` },
            ];

            // Prepend unsaved draft row if one exists
            const displayRows = _draftRow ? [...rows, _draftRow] : rows;

            const cfg = Object.assign({}, _PROSPECT_CFG, {
                rows: displayRows,

                hasMore,
                onLoadMore() { _pl_fetch(listview, _pl_allRows.length); },
                onReload() { _pl_render(listview); },

                onEdit(name, frappe_field, value) {
                    // ── Draft row handling ──────────────────────────────
                    if (name === "__draft__") {
                        // Buffer into display row + extra fields map
                        const key = _ffToKey(frappe_field);
                        if (key) _draftRow[key] = value;
                        if (value && value.trim()) {
                            _draftExtra[frappe_field] = value;
                        } else {
                            delete _draftExtra[frappe_field];
                        }

                        // Save only when BOTH company_name AND custom_first_name are filled
                        const hasCompany = !!(_draftExtra["company_name"]  || "").trim();
                        const hasFirst   = !!(_draftExtra["custom_first_name"] || "").trim();
                        if (!hasCompany || !hasFirst) return;

                        // Pack everything into one insert — no separate set_value calls
                        const doc = Object.assign(
                            { doctype: "Prospect", custom_prospect_status: "Lead" },
                            _draftExtra
                        );
                        _draftRow   = null;
                        _draftExtra = {};

                        frappe.call({
                            method: "frappe.client.insert",
                            args: { doc },
                            callback() { _pl_render(listview); },
                            error()    {
                                frappe.show_alert({ message: "Failed to save new row", indicator: "red" }, 4);
                                _pl_render(listview);
                            },
                        });
                        return;
                    }
                    // ── Normal saved row ────────────────────────────────
                    frappe.db.set_value("Prospect", name, frappe_field, value)
                        .catch(err => frappe.show_alert({ message: "Save failed: " + err, indicator: "red" }, 4));

                    // ── Maps → auto-fill location fields if empty ───────
                    if (frappe_field === "custom_maps_url" && value) {
                        const row = rows.find(r => r.name === name);
                        if (row && !row.site_country) _geocodeAndFillLocation(name, value, row);
                    }
                },

                onLocFill(name, geoFields, changedLocField) {
                    const row = rows.find(r => r.name === name);
                    // Only set fields that aren't already filled (except the one the user just typed)
                    const toFill = {};
                    const keyMap = { custom_site_country: "site_country", custom_site_district: "site_district", custom_site_city: "site_city", custom_site_street: "site_street" };
                    const ffToLocField = { custom_site_country: "country", custom_site_district: "district", custom_site_city: "city", custom_site_street: "street" };
                    for (const [ff, val] of Object.entries(geoFields)) {
                        if (!val) continue;
                        const lf = ffToLocField[ff];
                        // Always set the field the user picked; only auto-set others if empty
                        if (lf === changedLocField || !(row && row[keyMap[ff]])) {
                            toFill[ff] = val;
                        }
                    }
                    if (Object.keys(toFill).length) _fillLocationCells(name, row, toFill);
                },

                onAddRow(reload) {
                    if (_draftRow) { _focusDraftCompany(host); return; }
                    _draftRow   = { name: "__draft__", custom_prospect_status: "Lead" };
                    _draftExtra = {};
                    reload();
                    _focusDraftCompany(host);
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
            PG.renderStats(host, _qs_cards);

            // ── Patch existing contact cells to show salutation ──────
            const _SAL_PREFIXES = new Set(["Mr","Ms","Mrs","Dr","Arch","Eng","Prof"]);
            const _needsPatch = n => n && !_SAL_PREFIXES.has(n.split(" ")[0]);
            const _spans = Array.from(host.querySelectorAll(".pg-cl-name")).filter(s => _needsPatch(s.dataset.contactName));
            const _names = [...new Set(_spans.map(s => s.dataset.contactName).filter(Boolean))];
            if (_names.length) {
                frappe.call({
                    method: "frappe.client.get_list",
                    args: { doctype: "Contact", filters: [["full_name", "in", _names]], fields: ["full_name", "salutation"], limit: _names.length + 10 },
                    callback(r) {
                        const salMap = {};
                        (r.message || []).forEach(c => { if (c.salutation) salMap[c.full_name] = c.salutation; });
                        _spans.forEach(span => {
                            const raw = span.dataset.contactName;
                            const sal = salMap[raw];
                            if (sal) {
                                const display = `${sal} ${raw}`;
                                span.textContent = display;
                                span.dataset.contactName = display;
                                // also update the td's data-val so edits start from correct value
                                const td = span.closest("td");
                                if (td) td.dataset.val = display;
                            }
                        });
                    },
                });
            }
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

/* Draft (unsaved) row highlight */
tr[data-row-name="__draft__"] td { background: #f0f7ff !important; }
tr[data-row-name="__draft__"] td.pg-f-num-cell { color: #2563eb !important; }
tr[data-row-name="__draft__"] td.pg-f-num-cell::after { content: " ✦"; font-size: 8px; }

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
.page-container[data-page-route="List/Prospect/List"] .list-row-head,
.page-container[data-page-route="List/Prospect/List"] .list-paging-area { display: none !important; }
`;
    document.head.appendChild(s);
})();
