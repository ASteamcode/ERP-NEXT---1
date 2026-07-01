// contacts_list.js — Contact list view: list, thumbnail cards, and horizontal carousel
// Clean light theme. Built so a non-technical user reads: name → person → call/email.
"use strict";

const CONTACT_DOCTYPE = "Contact";
const CC_VIEW_KEY = "cc_view_mode";
const CC_VIEW_DEFAULTED_KEY = "cc_view_defaulted_to_list";

const _CC_FIELDS = [
    "name", "salutation", "first_name", "last_name", "full_name", "image",
    "company_name", "designation", "department", "gender", "status",
    "mobile_no", "email_id", "phone", "custom_site_address",
    "custom_country", "custom_city", "custom_website", "custom_source_url",
    "custom_company_type", "custom_prospect_status", "custom_lifecycle_stage",
    "custom_facebook", "custom_instagram", "custom_tiktok", "custom_x", "custom_linkedin",
];
const _CC_PAGE = 200;

// Muted, friendly avatar palette — readable on a light background.
const _AVATAR_COLORS = ["#3b6fd4", "#7b54c9", "#0c7d92", "#2f8f5b", "#c07a1e", "#c4453f", "#c14d86"];
function _ccColor(name) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) & 0x7fffffff;
    return _AVATAR_COLORS[h % _AVATAR_COLORS.length];
}
function _ccIni(name) {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function _ccFullName(d) {
    return [d.salutation, d.first_name, d.last_name].filter(Boolean).join(" ") || d.full_name || d.name;
}
// Name without the salutation — used for initials so "Mr Anthony Karam" → AK, not MK.
function _ccNameNoTitle(d) {
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || d.full_name || d.name;
}
function _ccLetter(d) {
    const src = (d.last_name || d.first_name || "").trim();
    const c = src ? src[0].toUpperCase() : "";
    return /[A-Z]/.test(c) ? c : "#";
}
function _ccAvatar(d, size, shape) {
    const nm = _ccNameNoTitle(d);
    const cls = `cc-avatar${shape === "square" ? " cc-avatar-square" : ""}`;
    if (d.image) return `<div class="${cls}" style="width:${size}px;height:${size}px;background-size:cover;background-position:center;background-image:url('${d.image}')"></div>`;
    return `<div class="${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px;background:${_ccColor(nm)}">${_ccIni(nm)}</div>`;
}
const _CC_STATUS_BADGE = {
    Draft: "pg-badge-gray", Scheduled: "pg-badge-blue", Confirmed: "pg-badge-blue",
    "In Progress": "pg-badge-amber", Completed: "pg-badge-green", Cancelled: "pg-badge-red",
};
const _CC_STAGE_BADGE = {
    "Prospect": "pg-badge-gray", "Lead (Survey Requested)": "pg-badge-blue",
    "Lead (Survey Completed)": "pg-badge-blue", "Active Client": "pg-badge-green",
    "Churned/Archived": "pg-badge-red",
};
const _CC_PSTATUS_BADGE = {
    Scraped: "pg-badge-gray", Raw: "pg-badge-gray", Vetted: "pg-badge-blue", Disqualified: "pg-badge-red",
};
const _CC_CSTATUS_BADGE = {
    Passive: "pg-badge-gray", Open: "pg-badge-blue", Replied: "pg-badge-green",
};
let _cc_relCache = {};
function _cc_fetchRelated(name, cb) {
    if (_cc_relCache[name]) { cb(_cc_relCache[name]); return; }
    let surveys = [], jobs = [], left = 2;
    const done = () => { if (--left === 0) { const data = { surveys, jobs }; _cc_relCache[name] = data; cb(data); } };
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: "Site Survey", filters: { contact: name }, fields: ["name", "status", "survey_date", "site_location", "google_maps_url", "assigned_to"], order_by: "survey_date desc", limit_page_length: 50 },
        callback(r) { surveys = r.message || []; done(); },
        error: done,
    });
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: "Custom Calendar Event", filters: { contact: name }, fields: ["name", "status", "event_type", "start_date", "location", "google_maps_url"], order_by: "start_date desc", limit_page_length: 50 },
        callback(r) { jobs = r.message || []; done(); },
        error: done,
    });
}
const _CC_IC = {
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0 0 12.05 4a8.94 8.94 0 0 0-7.74 13.4L3 21l3.7-1.27a8.93 8.93 0 0 0 5.33 1.74A8.94 8.94 0 0 0 17.6 6.32zM12.05 20a7.43 7.43 0 0 1-4-1.16l-.29-.17-2.45.84.82-2.4-.19-.3a7.46 7.46 0 1 1 6.11 3.19zm4.08-5.58c-.22-.11-1.31-.65-1.51-.72s-.35-.11-.5.11-.58.72-.71.87-.26.17-.48.06a6.05 6.05 0 0 1-1.78-1.1 6.62 6.62 0 0 1-1.23-1.53c-.13-.22 0-.34.1-.45s.22-.26.32-.39a1.48 1.48 0 0 0 .22-.37.41.41 0 0 0 0-.39c-.06-.11-.5-1.21-.69-1.66s-.37-.38-.5-.38h-.43a.82.82 0 0 0-.6.28 2.51 2.51 0 0 0-.78 1.86 4.36 4.36 0 0 0 .91 2.31 9.85 9.85 0 0 0 3.78 3.34c.53.23.94.36 1.26.46a3 3 0 0 0 1.39.09 2.27 2.27 0 0 0 1.49-1.05 1.85 1.85 0 0 0 .13-1.05c-.06-.1-.2-.16-.42-.26z"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>`,
    location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    atSign: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3v3.2a5.6 5.6 0 0 0 4 1.9v3.1a8.6 8.6 0 0 1-4-1v5.3a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 2 2.7V3h4z"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.6l-5-6.6L5.6 22H2.5l7.8-8.9L1.7 2h6.7l4.6 6.1L18.9 2zm-2.3 18h1.7L7.5 3.8H5.7L16.6 20z"/></svg>`,
    linkedin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95 4 0 4.74 2.5 4.74 5.76V21h-4v-5c0-1.2-.02-2.74-1.7-2.74-1.7 0-1.96 1.3-1.96 2.65V21H9z"/></svg>`,
};
const _CC_SOCIALS = [
    { key: "custom_website", icon: "website", label: "Website", cls: "cc-soc-web" },
    { key: "custom_instagram", icon: "instagram", label: "Instagram", cls: "cc-soc-ig" },
    { key: "custom_facebook", icon: "facebook", label: "Facebook", cls: "cc-soc-fb" },
    { key: "custom_x", icon: "x", label: "X", cls: "cc-soc-x" },
    { key: "custom_tiktok", icon: "tiktok", label: "TikTok", cls: "cc-soc-tt" },
    { key: "custom_linkedin", icon: "linkedin", label: "LinkedIn", cls: "cc-soc-li" },
];
function _ccSocialUrl(key, v) {
    v = String(v).trim();
    if (/^https?:\/\//i.test(v)) return v;
    const h = v.replace(/^@/, "");
    switch (key) {
        case "custom_instagram": return "https://instagram.com/" + h;
        case "custom_facebook": return "https://facebook.com/" + h;
        case "custom_x": return "https://x.com/" + h;
        case "custom_tiktok": return "https://tiktok.com/@" + h;
        case "custom_linkedin": return "https://linkedin.com/in/" + h;
        default: return "https://" + v;
    }
}
function _ccInfoRow(icon, label, value) {
    if (!value) return "";
    return `<div class="cc-info-row"><span class="cc-info-ic">${icon}</span><span class="cc-info-text"><span class="cc-info-label">${label}</span><span class="cc-info-val">${frappe.utils.escape_html(value)}</span></span></div>`;
}
function _ccContactMeta(d) {
    return [d.designation, d.department].filter(Boolean).join(" · ");
}
function _ccLocation(d) {
    return [d.custom_city, d.custom_country].filter(Boolean).join(", ") || d.custom_site_address || "";
}
function _ccPrimaryPhone(d) {
    return d.mobile_no || d.phone || "";
}
function _ccUiIcon(name, cls) {
    return `<svg class="cc-ui-ic ${cls || ""}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

const _CC_EXPORT_SCHEMAS = {
    crm: {
        label: "CRM CSV",
        filename: "contacts_crm",
        columns: [
            ["Contact ID", d => d.name],
            ["First Name", d => d.first_name],
            ["Last Name", d => d.last_name],
            ["Full Name", d => _ccFullName(d)],
            ["Company", d => d.company_name],
            ["Job Title", d => d.designation],
            ["Department", d => d.department],
            ["Email", d => d.email_id],
            ["Mobile", d => d.mobile_no],
            ["Phone", d => d.phone],
            ["City", d => d.custom_city],
            ["Country", d => d.custom_country],
            ["Address", d => d.custom_site_address],
            ["Website", d => d.custom_website],
            ["Lifecycle Stage", d => d.custom_lifecycle_stage],
            ["Prospect Status", d => d.custom_prospect_status],
            ["Source URL", d => d.custom_source_url],
            ["Facebook", d => d.custom_facebook],
            ["Instagram", d => d.custom_instagram],
            ["TikTok", d => d.custom_tiktok],
            ["X", d => d.custom_x],
            ["LinkedIn", d => d.custom_linkedin],
        ],
    },
    mailchimp: {
        label: "Mailchimp CSV",
        filename: "contacts_mailchimp",
        columns: [
            ["Email Address", d => d.email_id],
            ["First Name", d => d.first_name],
            ["Last Name", d => d.last_name],
            ["Phone Number", d => _ccPrimaryPhone(d)],
            ["Company", d => d.company_name],
            ["Address", d => d.custom_site_address],
            ["City", d => d.custom_city],
            ["Country", d => d.custom_country],
            ["Tags", d => [d.custom_lifecycle_stage, d.custom_prospect_status].filter(Boolean).join(",")],
        ],
    },
    drive: {
        label: "Drive XLSX",
        filename: "contacts_drive",
        columns: [
            ["Contact ID", d => d.name],
            ["Full Name", d => _ccFullName(d)],
            ["First Name", d => d.first_name],
            ["Last Name", d => d.last_name],
            ["Company", d => d.company_name],
            ["Job Title", d => d.designation],
            ["Email", d => d.email_id],
            ["Mobile", d => d.mobile_no],
            ["Phone", d => d.phone],
            ["City", d => d.custom_city],
            ["Country", d => d.custom_country],
            ["Address", d => d.custom_site_address],
            ["Website", d => d.custom_website],
            ["Lifecycle Stage", d => d.custom_lifecycle_stage],
            ["Prospect Status", d => d.custom_prospect_status],
        ],
    },
    google_contacts: {
        label: "Google Contacts CSV",
        filename: "contacts_google_contacts",
        columns: [
            ["Name", d => _ccFullName(d)],
            ["Given Name", d => d.first_name],
            ["Family Name", d => d.last_name],
            ["Organization 1 - Name", d => d.company_name],
            ["Organization 1 - Title", d => d.designation],
            ["E-mail 1 - Value", d => d.email_id],
            ["Phone 1 - Value", d => _ccPrimaryPhone(d)],
            ["Address 1 - Formatted", d => d.custom_site_address],
            ["Website 1 - Value", d => d.custom_website],
            ["Notes", d => [d.custom_lifecycle_stage, d.custom_prospect_status, d.custom_source_url].filter(Boolean).join(" | ")],
        ],
    },
};
const _CC_APP_ICONS = {
    mailchimp: `<span class="cc-app-ic cc-app-mailchimp" aria-hidden="true">M</span>`,
    drive: `<span class="cc-app-ic cc-app-drive" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#34a853" d="M8.1 3h7.8l6.1 10.6h-7.8z"/><path fill="#fbbc04" d="M2 13.6 8.1 3l6.1 10.6-3.9 6.8z"/><path fill="#4285f4" d="M10.3 20.4l3.9-6.8H22l-3.9 6.8z"/></svg></span>`,
    google_contacts: `<span class="cc-app-ic cc-app-google" aria-hidden="true">G</span>`,
};
function _ccRowsForExport() {
    return (_cc_filtered && _cc_filtered.length ? _cc_filtered : _cc_allRows).slice();
}
function _ccCell(v) {
    return v == null ? "" : String(v).replace(/\r?\n/g, " ").trim();
}
function _ccBuildMatrix(schemaKey) {
    const schema = _CC_EXPORT_SCHEMAS[schemaKey] || _CC_EXPORT_SCHEMAS.crm;
    const rows = _ccRowsForExport();
    return {
        schema,
        matrix: [schema.columns.map(c => c[0])].concat(rows.map(d => schema.columns.map(c => _ccCell(c[1](d))))),
    };
}
function _ccCsvEscape(v) {
    v = _ccCell(v);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function _ccDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function _ccExportCsv(schemaKey) {
    const { schema, matrix } = _ccBuildMatrix(schemaKey);
    if (matrix.length <= 1) { frappe.show_alert({ message: "No contacts to export", indicator: "orange" }, 3); return; }
    const csv = "\ufeff" + matrix.map(row => row.map(_ccCsvEscape).join(",")).join("\r\n");
    _ccDownloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${schema.filename}.csv`);
}
function _ccXml(v) {
    return _ccCell(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _ccCrc32(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
}
function _ccU16(n) { return [n & 255, (n >>> 8) & 255]; }
function _ccU32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
function _ccZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    files.forEach(file => {
        const name = enc.encode(file.name);
        const data = enc.encode(file.content);
        const crc = _ccCrc32(data);
        const local = new Uint8Array([
            0x50,0x4b,0x03,0x04, ..._ccU16(20), ..._ccU16(0), ..._ccU16(0), ..._ccU16(0), ..._ccU16(0),
            ..._ccU32(crc), ..._ccU32(data.length), ..._ccU32(data.length), ..._ccU16(name.length), ..._ccU16(0)
        ]);
        chunks.push(local, name, data);
        central.push({ name, crc, size: data.length, offset });
        offset += local.length + name.length + data.length;
    });
    const cdStart = offset;
    central.forEach(file => {
        const hdr = new Uint8Array([
            0x50,0x4b,0x01,0x02, ..._ccU16(20), ..._ccU16(20), ..._ccU16(0), ..._ccU16(0), ..._ccU16(0), ..._ccU16(0),
            ..._ccU32(file.crc), ..._ccU32(file.size), ..._ccU32(file.size), ..._ccU16(file.name.length), ..._ccU16(0), ..._ccU16(0),
            ..._ccU16(0), ..._ccU16(0), ..._ccU32(0), ..._ccU32(file.offset)
        ]);
        chunks.push(hdr, file.name);
        offset += hdr.length + file.name.length;
    });
    const cdSize = offset - cdStart;
    chunks.push(new Uint8Array([0x50,0x4b,0x05,0x06, ..._ccU16(0), ..._ccU16(0), ..._ccU16(central.length), ..._ccU16(central.length), ..._ccU32(cdSize), ..._ccU32(cdStart), ..._ccU16(0)]));
    return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function _ccExportXlsx(schemaKey) {
    const { schema, matrix } = _ccBuildMatrix(schemaKey);
    if (matrix.length <= 1) { frappe.show_alert({ message: "No contacts to export", indicator: "orange" }, 3); return; }
    const sheetRows = matrix.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${_ccXml(v)}</t></is></c>`).join("")}</row>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
    const files = [
        { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
        { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>` },
        { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
        { name: "xl/worksheets/sheet1.xml", content: sheet },
    ];
    _ccDownloadBlob(_ccZip(files), `${schema.filename}.xlsx`);
}
function _ccOpenImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
    input.style.display = "none";
    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        _ccCreateDataImportFromFile(file);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
}
function _ccCreateDataImportFromFile(file) {
    frappe.show_alert({ message: `Uploading ${file.name}…`, indicator: "blue" }, 4);
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("doctype", "Data Import");
    fd.append("fieldname", "import_file");
    fd.append("is_private", "1");
    fd.append("folder", "Home/Attachments");
    fetch("/api/method/upload_file", {
        method: "POST",
        headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
        body: fd,
    }).then(r => r.json()).then(data => {
        const fileUrl = data.message && data.message.file_url;
        if (!fileUrl) throw new Error("Upload failed");
        return frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Data Import",
                    reference_doctype: CONTACT_DOCTYPE,
                    import_type: "Insert New Records",
                    import_file: fileUrl,
                    send_email: 0,
                },
            },
        });
    }).then(r => {
        const name = r.message && r.message.name;
        if (!name) throw new Error("Data Import creation failed");
        frappe.show_alert({ message: "Contact import ready for review", indicator: "green" }, 3);
        frappe.set_route("Form", "Data Import", name);
    }).catch(e => {
        frappe.show_alert({ message: e.message || "Import setup failed", indicator: "red" }, 5);
    });
}
function _ccBindExchange(host) {
    host.querySelectorAll(".cc-export-menu [data-export]").forEach(btn => {
        btn.addEventListener("click", () => {
            const [format, schema] = btn.dataset.export.split(":");
            if (format === "xlsx") _ccExportXlsx(schema);
            else _ccExportCsv(schema);
        });
    });
    const importBtn = host.querySelector(".cc-import-btn");
    if (importBtn) importBtn.addEventListener("click", _ccOpenImport);
}

// CARD 1 — Quick Actions. Call & Email sit at the top, biggest thing on the page.
function _ccActionsCard(d) {
    const phone = _ccPrimaryPhone(d);
    const email = d.email_id || "";
    const waDigits = phone.replace(/[^\d]/g, "");
    const socials = _CC_SOCIALS.filter(s => d[s.key]);
    return `
    <div class="cc-qcard cc-qcard-actions">
        <div class="cc-qcard-label">${_CC_IC.phone}Get in touch</div>
        <div class="cc-action-row">
            ${phone
            ? `<a class="cc-action-btn cc-action-call" href="tel:${phone}">${_CC_IC.phone}<span>Call</span></a>`
            : `<div class="cc-action-btn disabled">${_CC_IC.phone}<span>No phone</span></div>`}
            ${email
            ? `<button class="cc-action-btn cc-action-mail" data-email="${frappe.utils.escape_html(email)}" data-contact="${frappe.utils.escape_html(d.name)}">${_CC_IC.mail}<span>Email</span></button>`
            : `<div class="cc-action-btn disabled">${_CC_IC.mail}<span>No email</span></div>`}
            ${phone ? `<a class="cc-action-btn cc-action-wa" target="_blank" href="https://wa.me/${waDigits}">${_CC_IC.whatsapp}<span>WhatsApp</span></a>` : ""}
        </div>
        <div class="cc-info-list">
            ${_ccInfoRow(_CC_IC.phone, "Phone", phone)}
            ${_ccInfoRow(_CC_IC.atSign, "Email", email)}
        </div>
        ${socials.length ? `<div class="cc-soc-row">
            ${socials.map(s => `<a class="cc-soc-btn ${s.cls}" target="_blank" rel="noopener" title="${s.label}" href="${frappe.utils.escape_html(_ccSocialUrl(s.key, d[s.key]))}">${_CC_IC[s.icon]}</a>`).join("")}
        </div>` : ""}
    </div>`;
}

// CARD 2 — Profile. Who this person is, at a glance.
function _ccProfileCard(d) {
    const role = _ccContactMeta(d);
    const loc = _ccLocation(d);
    const stage = d.custom_lifecycle_stage || "";
    const pstatus = d.custom_prospect_status || "";
    const badges = [
        stage ? `<span class="pg-badge ${_CC_STAGE_BADGE[stage] || "pg-badge-gray"}">${frappe.utils.escape_html(stage)}</span>` : "",
        pstatus ? `<span class="pg-badge ${_CC_PSTATUS_BADGE[pstatus] || "pg-badge-gray"}">${frappe.utils.escape_html(pstatus)}</span>` : "",
        d.status ? `<span class="pg-badge ${_CC_CSTATUS_BADGE[d.status] || "pg-badge-gray"}">${frappe.utils.escape_html(d.status)}</span>` : "",
    ].filter(Boolean).join("");
    return `
    <div class="cc-qcard cc-qcard-profile">
        <div class="cc-qcard-label">${_CC_IC.user}Profile</div>
        <div class="cc-profile-head">
            ${_ccAvatar(d, 56, "square")}
            <div class="cc-profile-id">
                <div class="cc-profile-name">${frappe.utils.escape_html(_ccFullName(d))}</div>
                ${role ? `<div class="cc-profile-role">${frappe.utils.escape_html(role)}</div>` : ""}
            </div>
        </div>
        ${badges ? `<div class="cc-badge-row">${badges}</div>` : ""}
        <div class="cc-info-list">
            ${_ccInfoRow(_CC_IC.building, "Company", d.company_name)}
            ${_ccInfoRow(_CC_IC.location, "Location", loc || d.custom_site_address)}
        </div>
        <a class="cc-edit-link" href="/desk/contact/${encodeURIComponent(d.name)}">Open full record</a>
    </div>`;
}

function _cc_bind_actions(container) {
    container.querySelectorAll(".cc-action-mail").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            new frappe.views.CommunicationComposer({
                doctype: CONTACT_DOCTYPE, name: btn.dataset.contact, recipients: btn.dataset.email,
            });
        });
    });
}
function _ccRelRow(badge, dateLabel, date, title, sub, mapsUrl) {
    return `<div class="cc-rel-row">
        <div class="cc-rel-main">
            <div class="cc-rel-top">
                <span class="pg-badge ${_CC_STATUS_BADGE[badge] || "pg-badge-gray"}">${badge || "—"}</span>
                <span class="cc-rel-title">${frappe.utils.escape_html(title || "—")}</span>
            </div>
            ${sub ? `<div class="cc-rel-sub">${frappe.utils.escape_html(sub)}</div>` : ""}
            ${date ? `<div class="cc-rel-meta"><span class="cc-rel-ic">${_CC_IC.calendar}</span>${dateLabel ? dateLabel + " " : ""}${frappe.datetime.str_to_user(date)}</div>` : ""}
        </div>
        ${mapsUrl ? `<a class="cc-rel-map" href="${mapsUrl}" target="_blank" title="Open in maps">${_CC_IC.location}</a>` : ""}
    </div>`;
}
function _ccSurveysCard(list) {
    const done = list.filter(s => s.status === "Completed").length;
    const rows = list.length ? list.map(s => _ccRelRow(s.status, "Survey", s.survey_date, s.site_location || "Site survey", s.assigned_to ? "Surveyor: " + s.assigned_to : "", s.google_maps_url)).join("")
        : `<div class="cc-rel-empty">No surveys recorded yet.</div>`;
    const sub = list.length ? `${done} completed of ${list.length}` : "";
    return `<div class="cc-qcard cc-qcard-survey"><div class="cc-qcard-label">${_CC_IC.clipboard}Surveys (${list.length})</div>${sub ? `<div class="cc-qcard-count">${sub}</div>` : ""}<div class="cc-rel-list">${rows}</div></div>`;
}
function _ccJobsCard(list) {
    const done = list.filter(j => j.status === "Completed").length;
    const rows = list.length ? list.map(j => _ccRelRow(j.status, "", j.start_date, j.event_type || "Job", j.location || "", j.google_maps_url)).join("")
        : `<div class="cc-rel-empty">No scheduled jobs yet.</div>`;
    const sub = list.length ? `${done} completed · worked with us ${list.length}×` : "";
    return `<div class="cc-qcard cc-qcard-jobs"><div class="cc-qcard-label">${_CC_IC.calendar}Scheduled jobs (${list.length})</div>${sub ? `<div class="cc-qcard-count">${sub}</div>` : ""}<div class="cc-rel-list">${rows}</div></div>`;
}
let _cc_allRows = [], _cc_filtered = [], _cc_offset = 0, _cc_selected = null, _cc_host = null, _cc_lv = null;

frappe.provide("frappe.listview_settings.Contact");
frappe.listview_settings.Contact = {
    add_fields: _CC_FIELDS,
    onload(lv) { GL.suppressRefresh(lv); GL.hideChrome(lv); },
    refresh(lv) { GL.hideChrome(lv); _cc_lv = lv; _cc_fetch(lv, 0); },
};

function _cc_fetch(lv, offset) {
    const host = GL.bootstrap(lv, { doctype: CONTACT_DOCTYPE });
    if (!host) return;
    GL.hideNative(lv);
    _cc_host = host;
    if (offset === 0) {
        host.innerHTML = `<div class="pl-loading">Loading contacts…</div>`;
        _cc_allRows = [];
    }
    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: CONTACT_DOCTYPE, fields: _CC_FIELDS, limit_page_length: _CC_PAGE, limit_start: offset, order_by: "last_name asc, first_name asc" },
        callback(r) {
            if (!document.contains(host)) return;
            const newRows = r.message || [];
            _cc_allRows = offset === 0 ? newRows : _cc_allRows.concat(newRows);
            const hasMore = newRows.length === _CC_PAGE;
            if (offset === 0) _cc_render(host);
            else _cc_apply_filter("", true);
            if (hasMore) _cc_fetch(lv, _cc_allRows.length);
        },
    });
}

function _cc_fill_height(host) {
    const set = () => {
        if (!document.contains(host)) return;
        const top = host.getBoundingClientRect().top;
        host.style.height = Math.max(420, window.innerHeight - top) + "px";
    };
    set();
    if (!window._cc_resize_bound) {
        window._cc_resize_bound = true;
        window.addEventListener("resize", () => { if (_cc_host) _cc_fill_height(_cc_host); });
    }
}

function _cc_render(host) {
    _cc_fill_height(host);
    let savedView = localStorage.getItem(CC_VIEW_KEY);
    if (!localStorage.getItem(CC_VIEW_DEFAULTED_KEY)) {
        savedView = "vertical";
        localStorage.setItem(CC_VIEW_KEY, savedView);
        localStorage.setItem(CC_VIEW_DEFAULTED_KEY, "1");
    }
    if (!["vertical", "cards", "horizontal"].includes(savedView)) savedView = "vertical";
    host.innerHTML = `
<div class="cc-shell" data-view="${savedView}">
    <div class="cc-toolbar">
        <div class="cc-search-wrap">
            ${_ccUiIcon("search", "cc-search-icon")}
            <input class="cc-search" placeholder="Search by name, company or email…" />
        </div>
        <div class="cc-toolbar-right">
            <div class="cc-view-toggle">
                <button class="cc-view-btn" data-view="vertical" title="List view">
                    ${_ccUiIcon("list")}
                </button>
                <button class="cc-view-btn" data-view="cards" title="Card view">
                    ${_ccUiIcon("layout-grid")}
                </button>
                <button class="cc-view-btn" data-view="horizontal" title="Carousel view">
                    ${_ccUiIcon("gallery-horizontal")}
                </button>
            </div>
            <div class="cc-exchange">
                <button class="cc-import-btn" title="Import contacts">
                    ${_ccUiIcon("upload")}
                    <span>Import</span>
                </button>
                <div class="cc-export-wrap">
                    <button class="cc-export-btn" title="Export contacts">
                        ${_ccUiIcon("download")}
                        <span>Export</span>
                    </button>
                    <div class="cc-export-menu">
                        <button data-export="csv:crm">CSV</button>
                        <button data-export="xlsx:crm">XLSX</button>
                        <div class="cc-export-sep"></div>
                        <button data-export="csv:mailchimp">${_CC_APP_ICONS.mailchimp}<span>Mailchimp</span></button>
                        <button data-export="xlsx:drive">${_CC_APP_ICONS.drive}<span>Drive</span></button>
                        <button data-export="csv:google_contacts">${_CC_APP_ICONS.google_contacts}<span>Google Contacts</span></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="cc-body">
        <div class="cc-horizontal">
            <div class="cc-stage-name"></div>
            <div class="cc-strip-row">
                <button class="cc-strip-nav cc-strip-prev" title="Previous" aria-label="Previous contacts">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div class="cc-strip"></div>
                <button class="cc-strip-nav cc-strip-next" title="Next" aria-label="Next contacts">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <div class="cc-az"></div>
            <div class="cc-detail"></div>
        </div>
        <div class="cc-vertical">
            <div class="cc-vlist"></div>
            <div class="cc-vdetail"></div>
        </div>
        <div class="cc-cards">
            <div class="cc-card-grid"></div>
        </div>
    </div>
</div>`;

    host.querySelectorAll(".cc-view-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === savedView);
        btn.addEventListener("click", () => {
            const shell = host.querySelector(".cc-shell");
            const v = btn.dataset.view;
            localStorage.setItem(CC_VIEW_KEY, v);
            shell.classList.add("cc-fade");
            setTimeout(() => { shell.dataset.view = v; shell.classList.remove("cc-fade"); }, 120);
            host.querySelectorAll(".cc-view-btn").forEach(b => b.classList.toggle("active", b === btn));
        });
    });

    let debounce = null;
    host.querySelector(".cc-search").addEventListener("input", function () {
        clearTimeout(debounce);
        const q = this.value;
        debounce = setTimeout(() => _cc_apply_filter(q), 180);
    });
    _ccBindExchange(host);

    _cc_apply_filter("", true);
}

function _cc_apply_filter(q, force) {
    if (!_cc_host || !document.contains(_cc_host)) return;
    q = (q || "").trim().toLowerCase();
    _cc_filtered = !q ? _cc_allRows.slice() : _cc_allRows.filter(d => {
        const hay = [_ccFullName(d), d.company_name, d.email_id, d.phone, d.mobile_no].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
    });
    if (!_cc_filtered.find(d => d.name === (_cc_selected && _cc_selected.name))) {
        _cc_selected = _cc_filtered[0] || null;
    }
    _cc_render_horizontal(_cc_host);
    _cc_render_vertical(_cc_host);
    _cc_render_cards(_cc_host);
}

function _cc_render_horizontal(host) {
    const strip = host.querySelector(".cc-strip");
    const az = host.querySelector(".cc-az");
    const detail = host.querySelector(".cc-detail");
    const stageName = host.querySelector(".cc-stage-name");
    if (!strip) return;

    const letters = new Set(_cc_filtered.map(_ccLetter));
    const activeLetter = _cc_selected ? _ccLetter(_cc_selected) : null;
    az.innerHTML = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").map(l =>
        `<button class="cc-az-btn${letters.has(l) ? "" : " disabled"}${l === activeLetter ? " active" : ""}" data-letter="${l}" ${letters.has(l) ? "" : "disabled"}>${l}</button>`
    ).join("");

    strip.innerHTML = _cc_filtered.map(d => `
    <div class="cc-card${_cc_selected && _cc_selected.name === d.name ? " active" : ""}" data-name="${frappe.utils.escape_html(d.name)}" data-letter="${_ccLetter(d)}">
        ${_ccAvatar(d, 96, "square")}
        <div class="cc-card-name">${frappe.utils.escape_html(_ccFullName(d))}</div>
        <div class="cc-card-sub">${frappe.utils.escape_html(d.company_name || "")}</div>
    </div>`).join("") || `<div class="cc-empty-state">No contacts match your search.</div>`;

    const prevBtn = host.querySelector(".cc-strip-prev");
    const nextBtn = host.querySelector(".cc-strip-next");
    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = "1";
        prevBtn.addEventListener("click", () => strip.scrollBy({ left: -280, behavior: "smooth" }));
        nextBtn.dataset.bound = "1";
        nextBtn.addEventListener("click", () => strip.scrollBy({ left: 280, behavior: "smooth" }));
    }

    const cards = Array.from(strip.querySelectorAll(".cc-card"));
    const selectCard = (card, doScroll) => {
        const d = _cc_filtered.find(x => x.name === card.dataset.name);
        if (!d) return;
        _cc_selected = d;
        cards.forEach(c => c.classList.toggle("active", c === card));
        az.querySelectorAll(".cc-az-btn").forEach(b => b.classList.toggle("active", b.dataset.letter === _ccLetter(d)));
        if (doScroll) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        _cc_render_detail(detail, d);
        if (stageName) stageName.textContent = _ccFullName(d);
    };
    cards.forEach(card => card.addEventListener("click", () => selectCard(card, true)));

    az.querySelectorAll(".cc-az-btn:not(.disabled)").forEach(btn => {
        btn.addEventListener("click", () => {
            const d = _cc_filtered.find(x => _ccLetter(x) === btn.dataset.letter);
            if (!d) return;
            const card = strip.querySelector(`.cc-card[data-name="${CSS.escape(d.name)}"]`);
            if (card) selectCard(card, true);
        });
    });

    if (!strip.dataset.wheelBound) {
        strip.dataset.wheelBound = "1";
        strip.addEventListener("wheel", (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { strip.scrollLeft += e.deltaY; e.preventDefault(); }
        }, { passive: false });
    }

    if (stageName) stageName.textContent = _cc_selected ? _ccFullName(_cc_selected) : "";
    _cc_render_detail(detail, _cc_selected);
}

function _cc_render_detail(detail, d) {
    if (!detail) return;
    if (!d) { detail.innerHTML = `<div class="cc-empty-state">Pick someone above to see their details.</div>`; return; }
    detail.innerHTML = `<div class="cc-qgrid">${_ccActionsCard(d)}${_ccProfileCard(d)}<div class="cc-qcard cc-qcard-loading">Loading…</div></div>`;
    _cc_bind_actions(detail);
    _cc_fetchRelated(d.name, (data) => {
        if (!detail.isConnected || !_cc_selected || _cc_selected.name !== d.name) return;
        detail.innerHTML = `<div class="cc-qgrid">${_ccActionsCard(d)}${_ccProfileCard(d)}${_ccSurveysCard(data.surveys)}${_ccJobsCard(data.jobs)}</div>`;
        _cc_bind_actions(detail);
    });
}

function _cc_render_vertical(host) {
    const list = host.querySelector(".cc-vlist");
    const vdetail = host.querySelector(".cc-vdetail");
    if (!list) return;
    let html = "";
    let lastLetter = null;
    if (!_cc_filtered.length) html = `<div class="cc-empty-state">No contacts match your search.</div>`;
    _cc_filtered.forEach(d => {
        const letter = _ccLetter(d);
        if (letter !== lastLetter) {
            html += `<div class="cc-vletter">${letter}</div>`;
            lastLetter = letter;
        }
        const active = _cc_selected && _cc_selected.name === d.name ? " active" : "";
        html += `
        <div class="cc-vrow${active}" data-name="${frappe.utils.escape_html(d.name)}">
            <div class="cc-vrow-head">
                ${_ccAvatar(d, 40)}
                <div class="cc-vrow-body">
                    <div class="cc-vrow-name">${frappe.utils.escape_html(_ccFullName(d))}</div>
                    <div class="cc-vrow-sub">${frappe.utils.escape_html(d.company_name || d.designation || "")}</div>
                </div>
                <svg class="cc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        </div>`;
    });
    list.innerHTML = html;

    const selectRow = (row) => {
        const d = _cc_filtered.find(x => x.name === row.dataset.name);
        if (!d) return;
        _cc_selected = d;
        list.querySelectorAll(".cc-vrow").forEach(r => r.classList.toggle("active", r === row));
        _cc_render_detail(vdetail, d);
    };

    list.querySelectorAll(".cc-vrow-head").forEach(head => {
        head.addEventListener("click", () => selectRow(head.closest(".cc-vrow")));
    });

    // show the currently-selected contact (or first) in the right pane
    const activeRow = list.querySelector(".cc-vrow.active") || list.querySelector(".cc-vrow");
    if (activeRow) {
        if (!list.querySelector(".cc-vrow.active")) activeRow.classList.add("active");
        _cc_render_detail(vdetail, _cc_selected || _cc_filtered[0]);
    } else if (vdetail) {
        vdetail.innerHTML = `<div class="cc-empty-state">Pick someone on the left to see their details.</div>`;
    }
}

function _cc_render_cards(host) {
    const grid = host.querySelector(".cc-card-grid");
    if (!grid) return;
    if (!_cc_filtered.length) {
        grid.innerHTML = `<div class="cc-empty-state">No contacts match your search.</div>`;
        return;
    }
    grid.innerHTML = _cc_filtered.map(d => {
        const phone = _ccPrimaryPhone(d);
        const email = d.email_id || "";
        const meta = _ccContactMeta(d);
        const loc = _ccLocation(d);
        const stage = d.custom_lifecycle_stage || d.custom_prospect_status || d.status || "";
        return `
        <article class="cc-tile" data-name="${frappe.utils.escape_html(d.name)}">
            <div class="cc-tile-top">
                ${_ccAvatar(d, 56, "square")}
                <div class="cc-tile-id">
                    <div class="cc-tile-name">${frappe.utils.escape_html(_ccFullName(d))}</div>
                    <div class="cc-tile-company">${frappe.utils.escape_html(d.company_name || "No company")}</div>
                </div>
            </div>
            ${stage ? `<div class="cc-tile-badge"><span class="pg-badge ${_CC_STAGE_BADGE[stage] || _CC_PSTATUS_BADGE[stage] || _CC_CSTATUS_BADGE[stage] || "pg-badge-gray"}">${frappe.utils.escape_html(stage)}</span></div>` : ""}
            <div class="cc-tile-lines">
                ${meta ? `<div class="cc-tile-line">${_CC_IC.user}<span>${frappe.utils.escape_html(meta)}</span></div>` : ""}
                ${loc ? `<div class="cc-tile-line">${_CC_IC.location}<span>${frappe.utils.escape_html(loc)}</span></div>` : ""}
                ${phone ? `<div class="cc-tile-line">${_CC_IC.phone}<span>${frappe.utils.escape_html(phone)}</span></div>` : ""}
                ${email ? `<div class="cc-tile-line">${_CC_IC.mail}<span>${frappe.utils.escape_html(email)}</span></div>` : ""}
            </div>
            <div class="cc-tile-actions">
                ${phone ? `<a class="cc-tile-btn" href="tel:${phone}" title="Call">${_CC_IC.phone}</a>` : ""}
                ${email ? `<button class="cc-tile-btn cc-action-mail" data-email="${frappe.utils.escape_html(email)}" data-contact="${frappe.utils.escape_html(d.name)}" title="Email">${_CC_IC.mail}</button>` : ""}
                <a class="cc-tile-open" href="/desk/contact/${encodeURIComponent(d.name)}">Open</a>
            </div>
        </article>`;
    }).join("");
    _cc_bind_actions(grid);
}

(function () {
    if (document.getElementById("cc-styles")) return;
    const s = document.createElement("style");
    s.id = "cc-styles";
    s.textContent = `
/* ============ palette (light, calm, one blue accent) ============ */
.cc-shell{
    --cc-bg:#f4f5f7;
    --cc-surface:#ffffff;
    --cc-line:#e4e7ec;
    --cc-line-soft:#eef1f4;
    --cc-ink:#1f2733;
    --cc-ink-soft:#5b6472;
    --cc-ink-mute:#8a93a3;
    --cc-accent:#2f6bff;
    --cc-accent-soft:#eaf0ff;
    --cc-shadow:0 1px 2px rgba(16,24,40,.06),0 6px 18px rgba(16,24,40,.06);
}

.page-container[data-page-route="List/Contact/List"] .gl-host{padding:0;box-sizing:border-box;height:calc(100vh - 112px);min-height:420px;overflow:hidden;background:#f4f5f7;}
.page-container[data-page-route="List/Contact/List"],
.page-container[data-page-route="List/Contact/List"] .layout-main-section,
.page-container[data-page-route="List/Contact/List"] .layout-main,
.page-container[data-page-route="List/Contact/List"] .layout-main-section-wrapper,
.page-container[data-page-route="List/Contact/List"] .page-body { background:#f4f5f7 !important; }
.pl-loading{padding:48px;text-align:center;color:#8a93a3;font-size:13px;height:100%;}
.page-container[data-page-route="List/Contact/List"] .list-row-head,
.page-container[data-page-route="List/Contact/List"] .list-headers,
.page-container[data-page-route="List/Contact/List"] .list-subjects,
.page-container[data-page-route="List/Contact/List"] header.frappe-list-head { display:none !important; }
.page-container[data-page-route="List/Contact/List"] .layout-main { overflow:hidden !important; }

.cc-shell { height:100%; display:flex; flex-direction:column; overflow:hidden; background:var(--cc-bg);
    color:var(--cc-ink); transition:opacity .15s ease;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; }
.cc-shell.cc-fade { opacity:0; }

/* ============ toolbar ============ */
.cc-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:18px 28px 14px; flex:none; }
.cc-toolbar-right { display:flex; align-items:center; gap:10px; min-width:0; }
.cc-search-wrap { position:relative; width:360px; max-width:100%; }
.cc-search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--cc-ink-mute); pointer-events:none; }
.cc-ui-ic { width:16px; height:16px; flex:none; fill:none; stroke:currentColor; }
.cc-search { width:100%; box-sizing:border-box; background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:10px; padding:11px 14px 11px 40px; font-size:14px; color:var(--cc-ink); outline:none; transition:border-color .14s,box-shadow .14s; box-shadow:var(--cc-shadow); }
.cc-search::placeholder { color:var(--cc-ink-mute); }
.cc-search:focus { border-color:var(--cc-accent); box-shadow:0 0 0 4px var(--cc-accent-soft); }
.cc-view-toggle { display:flex; gap:3px; background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:10px; padding:3px; box-shadow:var(--cc-shadow); }
.cc-view-btn { display:flex; align-items:center; justify-content:center; width:34px; height:30px; border:none; border-radius:7px; background:transparent; color:var(--cc-ink-mute); cursor:pointer; transition:background .15s,color .15s; }
.cc-view-btn:hover { color:var(--cc-ink-soft); }
.cc-view-btn.active { background:var(--cc-accent); color:#fff; }
.cc-exchange { display:flex; align-items:center; gap:8px; padding-left:10px; margin-left:2px; border-left:1px solid var(--cc-line); }
.cc-import-btn,.cc-export-btn { height:38px; display:flex; align-items:center; gap:7px; border:1px solid var(--cc-line); border-radius:8px; background:var(--cc-surface); color:var(--cc-ink-soft); font-size:13px; font-weight:600; padding:0 12px; cursor:pointer; box-shadow:var(--cc-shadow); }
.cc-import-btn svg,.cc-export-btn svg { flex:none; }
.cc-import-btn:hover,.cc-export-btn:hover { color:var(--cc-accent); border-color:#c7d6ff; background:var(--cc-accent-soft); }
.cc-export-wrap { position:relative; padding-bottom:8px; margin-bottom:-8px; }
.cc-export-menu { position:absolute; right:0; top:100%; z-index:20; display:none; min-width:190px; padding:10px 6px 6px; background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:8px; box-shadow:0 14px 32px rgba(16,24,40,.16); }
.cc-export-wrap:hover .cc-export-menu,.cc-export-wrap:focus-within .cc-export-menu { display:block; }
.cc-export-menu button { display:flex; align-items:center; gap:8px; width:100%; border:none; background:transparent; color:var(--cc-ink); text-align:left; font-size:13px; padding:8px 10px; border-radius:6px; cursor:pointer; }
.cc-export-menu button:hover { background:var(--cc-accent-soft); color:var(--cc-accent); }
.cc-export-sep { height:1px; background:var(--cc-line-soft); margin:5px 4px; }
.cc-app-ic { width:18px; height:18px; flex:none; display:inline-flex; align-items:center; justify-content:center; }
.cc-app-mailchimp { border-radius:50%; background:#ffe01b; color:#241c15; font-size:10px; font-weight:800; font-family:Arial,sans-serif; }
.cc-app-drive svg { width:18px; height:18px; display:block; }
.cc-app-google { border-radius:50%; background:#fff; color:#4285f4; border:1px solid #d7dce3; font-size:11px; font-weight:800; font-family:Arial,sans-serif; }

.cc-body { flex:1; min-height:0; position:relative; }
.cc-horizontal, .cc-vertical { position:absolute; inset:0; display:none; flex-direction:column; overflow:hidden; }
.cc-vertical { flex-direction:row; }
.cc-shell[data-view="horizontal"] .cc-horizontal { display:flex; }
.cc-shell[data-view="vertical"] .cc-vertical { display:flex; }
/* ============ horizontal — name header + carousel ============ */
.cc-stage-name { text-align:center; font-size:24px; font-weight:700; letter-spacing:-.01em; color:var(--cc-ink); padding:8px 20px 0; flex:none; min-height:30px; }
.cc-strip-row { display:flex; align-items:center; flex:none; width:100%; padding:0 18px; box-sizing:border-box; }
.cc-strip { display:flex; gap:20px; padding:22px 8px; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; flex:1; scrollbar-width:none; }
.cc-strip::-webkit-scrollbar { display:none; }
.cc-strip-nav { flex:none; display:flex; align-items:center; justify-content:center; width:40px; height:40px; border:1px solid var(--cc-line); background:var(--cc-surface); color:var(--cc-ink-soft); cursor:pointer; border-radius:50%; transition:background .15s,color .15s,border-color .15s; box-shadow:var(--cc-shadow); }
.cc-strip-nav:hover { background:var(--cc-accent); color:#fff; border-color:var(--cc-accent); }

.cc-card { flex:none; width:100px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; padding:8px; border-radius:14px; transition:transform .18s ease, background .15s; }
.cc-card:hover { transform:translateY(-2px); }
.cc-card .cc-avatar { transition:box-shadow .18s ease, transform .18s ease; }
.cc-card.active .cc-avatar { box-shadow:0 0 0 3px var(--cc-accent); transform:scale(1.04); }
.cc-card.active .cc-card-name { color:var(--cc-accent); }

.cc-avatar { border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; color:#fff; flex:none; }
.cc-avatar-square { border-radius:22%; }
.cc-card-name { font-size:13px; font-weight:600; color:var(--cc-ink); text-align:center; line-height:1.25; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-card-sub { font-size:11.5px; color:var(--cc-ink-mute); text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ============ A–Z jump bar ============ */
.cc-az { display:flex; flex-wrap:nowrap; justify-content:center; gap:6px; padding:4px 28px 16px; flex:none; overflow-x:auto; scroll-behavior:smooth; width:100%; box-sizing:border-box; scrollbar-width:none; }
.cc-az::-webkit-scrollbar { display:none; }
.cc-az-btn { flex:none; border:none; background:transparent; width:30px; height:30px; border-radius:8px; font-size:13px; font-weight:600; color:var(--cc-ink-soft); cursor:pointer; transition:background .14s,color .14s; }
.cc-az-btn:hover:not(.disabled) { background:var(--cc-accent-soft); color:var(--cc-accent); }
.cc-az-btn.active { background:var(--cc-accent); color:#fff; }
.cc-az-btn.disabled { color:#cbd2dc; cursor:default; }

/* ============ detail grid ============ */
.cc-detail { flex:1; min-height:0; overflow-y:auto; padding:4px 28px 28px; width:100%; box-sizing:border-box; }
.cc-qgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:18px; max-width:1180px; margin:0 auto; align-items:start; animation:cc-fade-in .18s ease; }
@keyframes cc-fade-in { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }
.cc-qcard { background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:14px; padding:22px; box-shadow:var(--cc-shadow); }
.cc-qcard-loading { color:var(--cc-ink-mute); font-size:13px; }
.cc-qcard-label { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--cc-ink-soft); text-transform:uppercase; letter-spacing:.05em; margin-bottom:16px; }
.cc-qcard-label svg { width:16px; height:16px; color:var(--cc-ink-mute); }
.cc-qcard-count { font-size:12.5px; color:var(--cc-ink-soft); font-weight:500; margin-top:-8px; margin-bottom:14px; }

/* the big call/email buttons — the point of the whole screen */
.cc-action-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
.cc-action-btn { flex:1 1 0; min-width:120px; display:flex; align-items:center; justify-content:center; gap:9px; padding:15px 18px; border-radius:11px; font-size:15px; font-weight:600; color:#fff; text-decoration:none; cursor:pointer; border:none; transition:filter .15s, transform .1s; }
.cc-action-btn svg { width:19px; height:19px; }
.cc-action-btn:hover { filter:brightness(1.06); }
.cc-action-btn:active { transform:translateY(1px); }
.cc-action-call { background:var(--cc-accent); }
.cc-action-mail { background:#5b54c9; }
.cc-action-wa { background:#22a565; }
.cc-action-btn.disabled { background:var(--cc-line-soft); color:var(--cc-ink-mute); cursor:default; }
.cc-action-btn.disabled:hover { filter:none; }

/* contact info list — label above value, easy to scan */
.cc-info-list { display:flex; flex-direction:column; gap:14px; }
.cc-info-row { display:flex; align-items:flex-start; gap:12px; }
.cc-info-ic { flex:none; display:flex; color:var(--cc-ink-mute); margin-top:1px; }
.cc-info-ic svg { width:18px; height:18px; }
.cc-info-text { display:flex; flex-direction:column; min-width:0; }
.cc-info-label { font-size:11px; font-weight:600; color:var(--cc-ink-mute); text-transform:uppercase; letter-spacing:.04em; }
.cc-info-val { font-size:14.5px; color:var(--cc-ink); word-break:break-word; }

.cc-soc-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
.cc-soc-btn { display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; background:var(--cc-line-soft); color:var(--cc-ink-soft); transition:background .14s,color .14s; }
.cc-soc-btn svg { width:18px; height:18px; }
.cc-soc-btn:hover { background:var(--cc-accent-soft); color:var(--cc-accent); }

.cc-profile-head { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.cc-profile-id { min-width:0; }
.cc-profile-name { font-size:17px; font-weight:700; color:var(--cc-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-profile-role { font-size:13px; color:var(--cc-ink-soft); margin-top:2px; }
.cc-badge-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px; }
.cc-edit-link { display:inline-block; margin-top:18px; font-size:13px; font-weight:600; color:var(--cc-accent); text-decoration:none; }
.cc-edit-link:hover { text-decoration:underline; }

.cc-rel-list { display:flex; flex-direction:column; gap:10px; }
.cc-rel-row { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--cc-line-soft); border-radius:10px; }
.cc-rel-main { flex:1; min-width:0; }
.cc-rel-top { display:flex; align-items:center; gap:9px; }
.cc-rel-title { font-size:14px; font-weight:600; color:var(--cc-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-rel-sub { font-size:12.5px; color:var(--cc-ink-soft); margin-top:4px; }
.cc-rel-meta { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--cc-ink-mute); margin-top:5px; }
.cc-rel-ic { display:flex; } .cc-rel-ic svg { width:13px; height:13px; }
.cc-rel-map { flex:none; display:flex; color:var(--cc-accent); padding:2px; } .cc-rel-map svg { width:18px; height:18px; }
.cc-rel-empty { color:var(--cc-ink-mute); font-size:13px; padding:8px 2px; }
.cc-empty-state { padding:48px; text-align:center; color:var(--cc-ink-mute); font-size:14px; grid-column:1/-1; }

.pg-badge { display:inline-block; padding:3px 9px; border-radius:6px; font-size:11px; font-weight:600; white-space:nowrap; }
.pg-badge-gray { background:#eef1f4; color:#5b6472; }
.pg-badge-blue { background:#eaf0ff; color:#2f6bff; }
.pg-badge-green { background:#e6f6ec; color:#1f9254; }
.pg-badge-amber { background:#fdf2e0; color:#b5740d; }
.pg-badge-red { background:#fdeaea; color:#cc3b3b; }



/* ============ thumbnail card view ============ */
.cc-cards { position:absolute; inset:0; display:none; overflow-y:auto; padding:18px 28px 32px; box-sizing:border-box; }
.cc-shell[data-view="cards"] .cc-cards { display:block; }
.cc-card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; align-items:start; }
.cc-tile { min-height:236px; display:flex; flex-direction:column; gap:14px; background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:8px; padding:16px; box-shadow:0 1px 2px rgba(16,24,40,.05); transition:box-shadow .14s,border-color .14s,transform .14s; }
.cc-tile:hover { border-color:#cbd4e1; box-shadow:0 8px 20px rgba(16,24,40,.08); transform:translateY(-1px); }
.cc-tile-top { display:flex; align-items:center; gap:12px; min-width:0; }
.cc-tile-id { min-width:0; }
.cc-tile-name { font-size:15px; font-weight:700; color:var(--cc-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-tile-company { font-size:12.5px; color:var(--cc-ink-soft); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-tile-badge { min-height:21px; }
.cc-tile-lines { display:flex; flex-direction:column; gap:8px; min-height:84px; }
.cc-tile-line { display:flex; align-items:center; gap:8px; min-width:0; color:var(--cc-ink-soft); font-size:12.5px; }
.cc-tile-line svg { width:14px; height:14px; flex:none; color:var(--cc-ink-mute); }
.cc-tile-line span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-tile-actions { display:flex; align-items:center; gap:8px; margin-top:auto; }
.cc-tile-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid var(--cc-line); border-radius:7px; background:var(--cc-surface); color:var(--cc-ink-soft); cursor:pointer; text-decoration:none; }
.cc-tile-btn:hover { color:var(--cc-accent); border-color:#c7d6ff; background:var(--cc-accent-soft); }
.cc-tile-btn svg { width:15px; height:15px; }
.cc-tile-open { margin-left:auto; font-size:13px; font-weight:600; color:var(--cc-accent); text-decoration:none; }
.cc-tile-open:hover { text-decoration:underline; }

/* ============ vertical list (master–detail) ============ */
.cc-vlist { flex:none; width:340px; overflow-y:auto; padding:16px 14px 28px; box-sizing:border-box; border-right:1px solid var(--cc-line); background:var(--cc-bg); }
.cc-vletter { position:sticky; top:0; z-index:2; background:var(--cc-bg); padding:12px 4px 6px; font-size:12px; font-weight:700; color:var(--cc-ink-mute); }
.cc-vrow { background:var(--cc-surface); border:1px solid var(--cc-line); border-radius:12px; margin-bottom:8px; overflow:hidden; transition:box-shadow .15s,border-color .15s; }
.cc-vrow:hover { box-shadow:var(--cc-shadow); }
.cc-vrow.active { border-color:var(--cc-accent); box-shadow:0 0 0 1px var(--cc-accent); }
.cc-vrow.active .cc-vrow-name { color:var(--cc-accent); }
.cc-vrow.active .cc-chevron { color:var(--cc-accent); transform:translateX(2px); }
.cc-vrow-head { display:flex; align-items:center; gap:13px; padding:12px 14px; cursor:pointer; }
.cc-vrow-body { flex:1; min-width:0; }
.cc-vrow-name { font-size:14px; font-weight:600; color:var(--cc-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-vrow-sub { font-size:12.5px; color:var(--cc-ink-mute); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-chevron { flex:none; color:var(--cc-ink-mute); transition:transform .2s ease,color .2s ease; }

.cc-vdetail { flex:1; min-width:0; overflow-y:auto; padding:24px 28px 32px; }
.cc-vdetail .cc-qgrid { grid-template-columns:1fr; max-width:560px; margin:0; }

@media (max-width:780px){
    .cc-vertical{flex-direction:column;}
    .cc-vlist{width:100%;border-right:none;border-bottom:1px solid var(--cc-line);max-height:42%;}
    .cc-vdetail{padding:18px 16px 24px;}
    .cc-vdetail .cc-qgrid{grid-template-columns:1fr;}
}
@media (max-width:600px){
    .cc-toolbar{flex-direction:column;align-items:stretch;}
    .cc-search-wrap{width:100%;}
    .cc-toolbar-right{justify-content:center;flex-wrap:wrap;}
    .cc-view-toggle{align-self:center;}
    .cc-stage-name{font-size:20px;}
    .cc-detail{padding:4px 16px 24px;}
    .cc-cards{padding:16px;}
}
@media (prefers-reduced-motion:reduce){
    .cc-shell,.cc-card,.cc-action-btn,.cc-chevron,.cc-qgrid{transition:none;animation:none;}
}
    `;
    document.head.appendChild(s);
})();