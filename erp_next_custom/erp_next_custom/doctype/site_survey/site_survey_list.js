// Site Survey — Custom Spreadsheet Grid
// Mirrors the CRM Log / Contacts grid UX (single-click row edit, double-click form nav).
// ─────────────────────────────────────────────────────────────────────────────

const SS_COLUMNS = [
    { field: "status", label: "Status", type: "select", width: 130, options: ["Draft", "Scheduled", "In Progress", "Completed", "Cancelled"] },
    { field: "survey_date", label: "Date", type: "date", width: 110 },
    { field: "assigned_to", label: "Surveyor", type: "avatar", width: 60 },
    { field: "customer", label: "Customer", type: "link", width: 150, link_doctype: "Customer", link_namefield: "customer_name" },
    { field: "lead", label: "Lead", type: "link", width: 150, link_doctype: "Lead", link_namefield: "lead_name" },
    { field: "contact", label: "Contact", type: "link", width: 150, link_doctype: "Contact", link_namefield: "first_name" },
    { field: "site_location", label: "Site Location", type: "text", width: 160 },
    { field: "google_maps_url", label: "Maps", type: "maps", width: 120 },
    { field: "site_type", label: "Site Type", type: "select", width: 120, options: ["", "Residential", "Commercial", "Industrial"] },
    { field: "roof_type", label: "Roof Type", type: "select", width: 110, options: ["", "Flat", "Pitched", "Mixed", "N/A"] },
    { field: "site_area", label: "Area (m²)", type: "number", width: 100 },
    { field: "notes", label: "Notes", type: "area", width: 260 },
    { field: "updates", label: "Updates", type: "area", width: 260 },
    { field: "attachments", label: "Files", type: "attach", width: 52 },
    { field: "drawing", label: "Drawing", type: "drawing", width: 52 },
    { field: "measurements", label: "MTO", type: "measure", width: 52 },
];

const SS_DOCTYPE = "Site Survey";
const SS_ATTACH_DOCTYPE = "Site Survey Attachment";
const SS_ATTACH_TABLE_FIELD = "attachments";
const SS_MEASURE_DOCTYPE = "Site Survey Measurement";
const SS_MEASURE_TABLE_FIELD = "measurements";
const SS_COL_WIDTH_KEY = "ss_col_widths";
const SS_STYLE_VERSION = "v7";

const SS_FIELDS = [
    ...SS_COLUMNS.filter(c => !["attachments", "drawing", "measurements"].includes(c.field)).map(c => c.field),
    "name",
    "attachments",
    "has_drawing",
    "has_measurements",
];

// ─── Column-width persistence ─────────────────────────────────────────────────

const SS_COL_WIDTHS = (() => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SS_COL_WIDTH_KEY) || "{}");
        return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "number"));
    } catch { return {}; }
})();

const ss_stored_col_width = (field) => typeof SS_COL_WIDTHS[field] === "number" ? SS_COL_WIDTHS[field] : null;
const ss_persist_col_widths = () => { try { localStorage.setItem(SS_COL_WIDTH_KEY, JSON.stringify(SS_COL_WIDTHS)); } catch { /* noop */ } };

// ─── Frappe list settings ─────────────────────────────────────────────────────

frappe.listview_settings["Site Survey"] = {
    hide_name_column: true,
    add_fields: SS_FIELDS,

    onload(listview) {
        ss_inject_styles();
        ss_suppress_native_refresh(listview);
    },

    refresh(listview) {
        ss_inject_styles();
        ss_render_grid(listview);
    },
};

// ─── Suppress native auto-refresh ─────────────────────────────────────────────

function ss_suppress_native_refresh(listview) {
    if (listview.auto_refresh) {
        try { clearInterval(listview.auto_refresh); } catch { /* noop */ }
        listview.auto_refresh = null;
    }
    if (typeof listview.setup_auto_refresh === "function") listview.setup_auto_refresh = () => { };
    try { frappe.realtime.off("list_update"); } catch { /* noop */ }
    if (listview.on_doctype_update) listview.on_doctype_update = () => { };
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

let _SS_EDITING_ROW = null;
let _SS_CURRENT_LISTVIEW = null;

function ss_render_grid(listview) {
    _SS_EDITING_ROW = null;
    _SS_CURRENT_LISTVIEW = listview;
    const $result = listview.$result;
    if (!$result?.length) return;

    _ss_hide_native_list(listview, $result);

    let $host = $result.closest("[data-page-route]").find(".ss-grid-host");
    if (!$host.length) {
        $host = $(`<div class="ss-grid-host"></div>`);
        $result.before($host);
    }
    $host.empty();

    const data = listview.data || [];
    const shell = _ss_build_grid_shell(data);

    $host.append(_ss_build_toolbar()).append(shell);
    ss_bind_events(listview, shell, $host);
}

function _ss_hide_native_list(listview, $result) {
    $result.find(".result-list, .list-row-head, .list-row-container, .list-row, .no-result").hide();
    listview.$page.find(".list-row-head, .list-headers").hide();
}

function _ss_build_grid_shell(data) {
    const shell = document.createElement("div");
    shell.className = "ss-grid-shell";
    const tracks = ["42px", ...SS_COLUMNS.map(c => `${ss_stored_col_width(c.field) || c.width || 120}px`)];
    shell.style.gridTemplateColumns = tracks.join(" ");
    shell.innerHTML = _ss_header_html() + _ss_body_html(data);
    return shell;
}

function _ss_header_html() {
    const cells = SS_COLUMNS.map(col =>
        `<div class="ss-cell ss-headcell" data-field="${col.field}">
			${__(col.label)}
			<span class="ss-col-resize" data-field="${col.field}"></span>
		</div>`
    ).join("");
    return `<div class="ss-cell ss-rownum ss-headcell">#</div>${cells}`;
}

function _ss_body_html(data) {
    if (!data.length) {
        return `<div class="ss-empty" style="grid-column:1/-1">${__("No records yet — add your first row below.")}</div>`;
    }
    return data.map((doc, i) => _ss_row_html(doc, i)).join("");
}

function _ss_row_html(doc, index) {
    const cells = SS_COLUMNS.map(col =>
        `<div class="ss-cell ss-data-cell" data-row="${doc.name}" data-field="${col.field}">${ss_render_cell(col, doc)}</div>`
    ).join("");
    return `
		<div class="ss-cell ss-rownum" data-row="${doc.name}">
			<span class="ss-rownum-text">${index + 1}</span>
			<button class="ss-row-del" data-name="${doc.name}" title="${__("Delete row")}">×</button>
		</div>
		${cells}`;
}

function _ss_build_toolbar() {
    const t = document.createElement("div");
    t.className = "ss-toolbar";
    t.innerHTML = `<button class="btn btn-default btn-sm ss-add-row-btn"><span class="ss-add-icon">+</span> ${__("Add Row")}</button>`;
    return t;
}

// ─── Cell renderers ───────────────────────────────────────────────────────────

function ss_render_cell(col, doc) {
    const raw = doc[col.field];
    const name = doc.name;
    switch (col.type) {
        case "select": return _ss_render_select(col, name, raw);
        case "avatar": return _ss_render_avatar(col, name, raw);
        case "date": return _ss_render_date(raw);
        case "maps": return _ss_render_maps(col, name, raw);
        case "area": return _ss_render_area(col, name, raw);
        case "attach": return _ss_render_attach(name, raw);
        case "number": return _ss_render_number(col, name, raw);
        case "link": return _ss_render_link(col, name, raw);
        case "drawing": return _ss_render_drawing(name, doc);
        case "measure": return _ss_render_measure(name, doc);
        default: return _ss_render_text(col, name, raw);
    }
}

function _ss_render_select(col, name, raw) {
    const hasValue = col.options.includes(raw);
    const blank = hasValue ? "" : `<option value="" selected></option>`;
    const opts = col.options.map(o =>
        `<option value="${o}"${o === raw ? " selected" : ""}>${o ? __(o) : ""}</option>`
    ).join("");
    return `<select class="ss-input ss-select" data-name="${name}" data-field="${col.field}">${blank}${opts}</select>`;
}

// Link-name resolution cache shared across all link-type fields
const _SS_LINK_NAMES = new Map();
const _SS_LINK_PENDING = new Set();

const SS_LINK_FIELDS = {
    assigned_to: { doctype: "User", namefield: "full_name", searchfield: "full_name" },
    customer: { doctype: "Customer", namefield: "customer_name", searchfield: "customer_name" },
    lead: { doctype: "Lead", namefield: "lead_name", searchfield: "lead_name" },
    contact: { doctype: "Contact", namefield: "first_name", searchfield: "first_name" },
};

function _ss_resolve_name(fieldname, id) {
    const cfg = SS_LINK_FIELDS[fieldname];
    if (!cfg || !id) return null;
    const key = `${cfg.doctype}::${id}`;
    if (_SS_LINK_NAMES.has(key)) return _SS_LINK_NAMES.get(key);
    if (!_SS_LINK_PENDING.has(key)) {
        _SS_LINK_PENDING.add(key);
        frappe.db.get_value(cfg.doctype, id, cfg.namefield, (r) => {
            _SS_LINK_PENDING.delete(key);
            _SS_LINK_NAMES.set(key, r?.[cfg.namefield] || id);
            if (_SS_CURRENT_LISTVIEW) ss_render_grid(_SS_CURRENT_LISTVIEW);
        });
    }
    return null;
}

function _ss_render_avatar(col, name, raw) {
    const display = raw ? (_ss_resolve_name(col.field, raw) || raw) : "";
    const initial = display ? display.charAt(0).toUpperCase() : "?";
    const hue = display ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
    return `
		<div class="ss-avatar-wrap">
			<div class="ss-avatar" style="--h:${hue}" title="${frappe.utils.escape_html(display)}">${initial}</div>
			<input type="text" class="ss-input ss-avatar-input"
				data-name="${name}" data-field="${col.field}" data-link="User"
				value="${frappe.utils.escape_html(display)}"
				placeholder="user…" autocomplete="off">
		</div>`;
}

function _ss_render_link(col, name, raw) {
    const display = raw ? (_ss_resolve_name(col.field, raw) || raw) : "";
    const val = frappe.utils.escape_html(display);
    const ph = `<span class="ss-cell-ph">${__(col.label)}</span>`;
    return `<span class="ss-cell-display"
		data-name="${name}" data-field="${col.field}" data-type="link" data-link="${col.link_doctype}"
		data-link-nf="${col.link_namefield}" tabindex="0" title="${val}">${display ? val : ph}</span>`;
}

function _ss_render_date(raw) {
    return `<div class="ss-cell-date">${ss_fmt_date(raw)}</div>`;
}

function _ss_render_number(col, name, raw) {
    const val = raw != null && raw !== "" ? raw : "";
    return `<input type="number" class="ss-input ss-number-input"
		data-name="${name}" data-field="${col.field}"
		value="${val}" placeholder="—" step="any">`;
}

function _ss_render_text(col, name, raw) {
    const val = frappe.utils.escape_html(raw || "");
    const display = raw ? val : `<span class="ss-cell-ph">${__(col.label)}</span>`;
    return `<span class="ss-cell-display"
		data-name="${name}" data-field="${col.field}" data-type="text"
		tabindex="0" title="${val}">${display}</span>`;
}

function _ss_render_area(col, name, raw) {
    return `<textarea class="ss-input ss-area"
		data-name="${name}" data-field="${col.field}"
		rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`;
}

const _SS_SVG = {
    map: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    pen: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    clip: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

function _ss_render_maps(col, name, raw) {
    const escaped = frappe.utils.escape_html(raw || "");
    const mapBtn = raw
        ? `<a href="${escaped}" target="_blank" class="ss-icon-btn ss-map-open" title="Open map">${_SS_SVG.map}</a>`
        : `<span class="ss-icon-btn ss-map-open ss-icon-btn--disabled">${_SS_SVG.map}</span>`;
    return `
		<div class="ss-map-cell">
			<span class="ss-map-display" title="${escaped}">${raw ? "URL set" : "<span class='ss-muted'>No URL</span>"}</span>
			<input type="text" class="ss-input ss-map-input"
				data-name="${name}" data-field="${col.field}"
				value="${escaped}" placeholder="Paste Google Maps URL..." style="display:none">
			<button class="ss-icon-btn ss-map-pen" data-name="${name}" title="Edit URL">${_SS_SVG.pen}</button>
			${mapBtn}
		</div>`;
}

const _SS_ATTACH_COUNTS = new Map();

function _ss_attach_count(name, raw) {
    if (Array.isArray(raw)) { _SS_ATTACH_COUNTS.set(name, raw.length); return raw.length; }
    return _SS_ATTACH_COUNTS.get(name) ?? 0;
}

function _ss_render_attach(name, raw) {
    const count = _ss_attach_count(name, raw);
    const badge = count ? `<span class="ss-attach-badge">${count}</span>` : "";
    return `<button class="ss-icon-btn ss-attach-btn" data-name="${name}" title="${count} file(s)">${_SS_SVG.clip}${badge}</button>`;
}

const _SS_SVG_PENCIL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;

function _ss_render_drawing(name, doc) {
    const has = doc?.has_drawing;
    const cls = has ? "ss-icon-btn ss-draw-btn ss-draw-btn--has" : "ss-icon-btn ss-draw-btn";
    return `<button class="${cls}" data-name="${name}" title="${has ? __("Edit drawing") : __("Add drawing")}">${_SS_SVG_PENCIL}</button>`;
}

// ─── Drawing dialog (AutoCAD-style) ───────────────────────────────────────────

const SS_DRAW_GRID = 20; // px between snap/grid points (1 cell = 1 unit at default scale)

// Display-unit conversion factors relative to metres
const SS_DRAW_UNITS = { "m": 1, "cm": 100, "mm": 1000, "ft": 3.28084, "in": 39.3701 };

const _SS_SVG_DRAW_RULER = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`;

function ss_open_drawing_dialog(listview, docname) {
    frappe.db.get_value(SS_DOCTYPE, docname, "drawing", (r) => {
        _ss_show_drawing_dialog(listview, docname, r?.drawing || "");
    });
}

function _ss_parse_drawing(raw) {
    if (!raw) return { shapes: [], scale: null };
    try {
        const parsed = JSON.parse(raw);
        if ((parsed?.version === 2 || parsed?.version === 3) && Array.isArray(parsed.shapes)) {
            return { shapes: parsed.shapes, scale: parsed.scale || null };
        }
    } catch { /* fall through */ }
    return { shapes: [], scale: null, _legacy_jpeg: raw }; // old raster image
}

function _ss_show_drawing_dialog(listview, docname, existingData) {
    const saved = _ss_parse_drawing(existingData);
    let shapes = saved.shapes; // mutable array: line | freehand | dim shapes

    // ── scale state (pxPerMeter is what gets calibrated; default 1 grid cell = 1 m) ──
    const scale = saved.scale && saved.scale.pxPerMeter > 0
        ? { pxPerMeter: saved.scale.pxPerMeter, unit: SS_DRAW_UNITS[saved.scale.unit] ? saved.scale.unit : "m" }
        : { pxPerMeter: SS_DRAW_GRID, unit: "m" };
    let displayPxPerMeter = scale.pxPerMeter; // animated value used for rendering
    let scaleAnimFrame = null;

    // ── history state for undo ──
    let history = [];
    const saveState = () => {
        const json = JSON.stringify(shapes);
        if (!history.length || history[history.length - 1] !== json) {
            history.push(json);
        }
    };

    // ── tool / colour state ──
    let tool = "line";   // "select" | "line" | "rect" | "circle" | "text" | "freehand" | "eraser" | "measure"
    let color = "#1f272e";

    // ── state variables for new features ──
    let selectedShapeIndices = [];
    let transformState = null; // { mode: "move"|"scale", handle: "tl"|"tr"|"bl"|"br", startX, startY, origShapes: [...], saved: false }
    let draftShape = null;
    let boxSelectDraft = null;
    let textInputEl = null;
    let propsPanelEl = null;

    // ── line chaining state ──
    let chainStart = null;  // {x,y} — anchor of next segment; persists across segments
    let anchorJustPlaced = false;
    let pointerDown = false;
    let downPos = null;
    let pointerMoved = false;

    // ── freehand state ──
    let freeDrawing = false;
    let freePoints = [];
    
    // ── eraser state ──
    let eraseMode = false;
    let eraseModeSaved = false;

    // ── dimension state ──
    let dimDraft = null; // {x,y} start point while dragging a new dimension
    let dimDragIdx = null; // index of dim whose offset is being dragged
    let dimHitWasLabel = false;

    // ── value-input overlay tracking ──
    let _valInputEl = null;
    let _valShapeIdx = null;

    const dialog = new frappe.ui.Dialog({
        title: __("Drawing — {0}", [docname]),
        size: "extra-large",
        fields: [{ fieldname: "draw_wrap", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            const payload = JSON.stringify({
                version: 3,
                shapes,
                scale: { pxPerMeter: scale.pxPerMeter, unit: scale.unit },
            });
            frappe.call({
                method: "frappe.client.set_value",
                args: { doctype: SS_DOCTYPE, name: docname, fieldname: "drawing", value: payload },
                callback: ({ exc }) => {
                    if (exc) return;
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: { doctype: SS_DOCTYPE, name: docname, fieldname: "has_drawing", value: shapes.length ? 1 : 0 },
                        callback: () => {
                            frappe.show_alert({ message: __("Drawing saved"), indicator: "green" }, 1.0);
                            const row = (listview.data || []).find(d => d.name === docname);
                            if (row) row.has_drawing = shapes.length ? 1 : 0;
                            ss_render_grid(listview);
                            dialog.hide();
                        },
                    });
                },
            });
        },
    });

    dialog.show();

    const $wrap = dialog.fields_dict.draw_wrap.$wrapper;

    // ── toolbar + canvas HTML ──
    const unitOpts = Object.keys(SS_DRAW_UNITS).map(u =>
        `<option value="${u}"${u === scale.unit ? " selected" : ""}>${u}</option>`
    ).join("");

    $wrap.html(`
        <div class="ss-draw-dialog">
            <div class="ss-draw-toolbar">
                <div class="ss-draw-tools">
                    <button class="ss-draw-tool" data-tool="select" title="${__("Select, move and scale shapes, or edit properties")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                    </button>
                    <button class="ss-draw-tool ss-draw-tool--active" data-tool="line" title="${__("Draw lines")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="rect" title="${__("Draw rectangle")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="circle" title="${__("Draw circle")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="text" title="${__("Add text")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="freehand" title="${__("Freehand draw")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 Q7 10 10 14 Q13 18 16 10 Q19 2 21 8"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="eraser" title="${__("Eraser — click or drag to delete shapes")}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16l11-11 6 6-4.5 4.5"/><path d="M6.5 17.5l4-4"/></svg>
                    </button>
                    <button class="ss-draw-tool" data-tool="measure" title="${__("Dimension — drag between points, or click a shape to auto-measure")}">
                        ${_SS_SVG_DRAW_RULER}
                    </button>
                    <div class="ss-draw-sep"></div>
                    <button class="ss-draw-tool ss-draw-color-btn ss-draw-color-active" data-color="#1f272e" title="Black"><span class="ss-draw-swatch" style="background:#1f272e"></span></button>
                    <button class="ss-draw-tool ss-draw-color-btn" data-color="#e74c3c" title="Red"><span class="ss-draw-swatch" style="background:#e74c3c"></span></button>
                    <button class="ss-draw-tool ss-draw-color-btn" data-color="#378ADD" title="Blue"><span class="ss-draw-swatch" style="background:#378ADD"></span></button>
                    <button class="ss-draw-tool ss-draw-color-btn" data-color="#27ae60" title="Green"><span class="ss-draw-swatch" style="background:#27ae60"></span></button>
                    <button class="ss-draw-tool ss-draw-color-btn" data-color="#f39c12" title="Orange"><span class="ss-draw-swatch" style="background:#f39c12"></span></button>
                    <div class="ss-draw-sep"></div>
                    <select class="ss-draw-unit" title="${__("Display unit")}">${unitOpts}</select>
                    <button class="ss-draw-undo-btn" title="${__("Undo last action")}">${__("Undo")}</button>
                </div>
                <button class="ss-draw-clear-btn" title="${__("Clear canvas")}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                    ${__("Clear")}
                </button>
            </div>
            <div class="ss-draw-canvas-wrap">
                <canvas class="ss-draw-canvas"></canvas>
            </div>
        </div>`);

    // ── canvas sizing — match CSS px to logical px (no pointer offset) ──
    const canvas = $wrap.find(".ss-draw-canvas")[0];
    const wrapEl = $wrap.find(".ss-draw-canvas-wrap")[0];
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(wrapEl.offsetWidth || 800, 600);
    const cssH = Math.round(cssW * 0.52);

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    if (saved._legacy_jpeg) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, cssW, cssH); render(); };
        img.src = saved._legacy_jpeg;
    }

    // ── coordinate helpers ──
    const canvasPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const src = (e.touches && e.touches.length) ? e.touches[0]
            : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
                : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const snap = (v) => Math.round(v / SS_DRAW_GRID) * SS_DRAW_GRID;
    const snapPt = (pt) => ({ x: snap(pt.x), y: snap(pt.y) });

    // Dimension endpoints snap to nearby line endpoints first, then the grid
    const snapDimPt = (raw) => {
        let best = null, bd = 14;
        for (const s of shapes) {
            if (s.type !== "line") continue;
            for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
                const d = Math.hypot(raw.x - px, raw.y - py);
                if (d < bd) { bd = d; best = { x: px, y: py }; }
            }
        }
        return best || snapPt(raw);
    };

    // ── geometry helpers ──
    const distSeg = (px, py, ax, ay, bx, by) => {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (!len2) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    };

    const getBBox = (s) => {
        if (!s) return null;
        if (s.type === "line" || s.type === "dim") {
            return {
                minX: Math.min(s.x1, s.x2), minY: Math.min(s.y1, s.y2),
                maxX: Math.max(s.x1, s.x2), maxY: Math.max(s.y1, s.y2)
            };
        } else if (s.type === "rect") {
            return {
                minX: Math.min(s.x, s.x + s.w), minY: Math.min(s.y, s.y + s.h),
                maxX: Math.max(s.x, s.x + s.w), maxY: Math.max(s.y, s.y + s.h)
            };
        } else if (s.type === "circle") {
            return {
                minX: s.x - s.r, minY: s.y - s.r,
                maxX: s.x + s.r, maxY: s.y + s.r
            };
        } else if (s.type === "freehand") {
            if (!s.points.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of s.points) {
                if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
                if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
            }
            return { minX, minY, maxX, maxY };
        } else if (s.type === "text") {
            ctx.save();
            ctx.font = s.font || "14px sans-serif";
            const m = ctx.measureText(s.text);
            ctx.restore();
            return {
                minX: s.x, minY: s.y - 14,
                maxX: s.x + m.width, maxY: s.y + 4
            };
        }
        return null;
    };

    const getGroupBBox = (indices) => {
        if (!indices || !indices.length) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const idx of indices) {
            const bb = getBBox(shapes[idx]);
            if (bb) {
                if (bb.minX < minX) minX = bb.minX;
                if (bb.minY < minY) minY = bb.minY;
                if (bb.maxX > maxX) maxX = bb.maxX;
                if (bb.maxY > maxY) maxY = bb.maxY;
            }
        }
        if (minX === Infinity) return null;
        return { minX, minY, maxX, maxY };
    };

    const dimGeom = (s) => {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const off = (typeof s.offset === "number") ? s.offset : 26;
        return {
            len, ux, uy, nx, ny, off,
            ax: s.x1 + nx * off, ay: s.y1 + ny * off,
            bx: s.x2 + nx * off, by: s.y2 + ny * off,
            mx: (s.x1 + s.x2) / 2 + nx * off,
            my: (s.y1 + s.y2) / 2 + ny * off,
        };
    };

    const dimText = (lenPx) => {
        const val = (lenPx / displayPxPerMeter) * SS_DRAW_UNITS[scale.unit];
        const rounded = Math.round(val * 100) / 100;
        return `${rounded} ${scale.unit}`;
    };

    const hitShape = (x, y, s, tol = 10) => {
        if (s.type === "line") return distSeg(x, y, s.x1, s.y1, s.x2, s.y2) < tol;
        if (s.type === "freehand") {
            for (let i = 1; i < s.points.length; i++) {
                const [ax, ay] = s.points[i - 1], [bx, by] = s.points[i];
                if (distSeg(x, y, ax, ay, bx, by) < tol) return true;
            }
            return false;
        }
        if (s.type === "dim") return hitDim(x, y, s).hit;
        if (s.type === "rect") {
            const minX = Math.min(s.x, s.x + s.w), maxX = Math.max(s.x, s.x + s.w);
            const minY = Math.min(s.y, s.y + s.h), maxY = Math.max(s.y, s.y + s.h);
            return x >= minX - tol && x <= maxX + tol && y >= minY - tol && y <= maxY + tol;
        }
        if (s.type === "circle") {
            const d = Math.hypot(x - s.x, y - s.y);
            return d <= s.r + tol;
        }
        if (s.type === "text") {
            const bb = getBBox(s);
            if (!bb) return false;
            return x >= bb.minX - tol && x <= bb.maxX + tol && y >= bb.minY - tol && y <= bb.maxY + tol;
        }
        return false;
    };

    const hitDim = (x, y, s) => {
        const g = dimGeom(s);
        ctx.save();
        ctx.font = "bold 11px sans-serif";
        const tw = ctx.measureText(dimText(g.len)).width;
        ctx.restore();
        const onLabel = Math.abs(x - g.mx) < tw / 2 + 8 && Math.abs(y - g.my) < 12;
        const onLine = distSeg(x, y, g.ax, g.ay, g.bx, g.by) < 9;
        return { hit: onLabel || onLine, label: onLabel };
    };

    const checkOverlap = (box, s) => {
        const bb = getBBox(s);
        if (!bb) return false;
        const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2);
        return !(bb.minX > maxX || bb.maxX < minX || bb.minY > maxY || bb.maxY < minY);
    };

    // ── rendering ──
    const render = (ghost) => {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cssW, cssH);

        // dot grid
        ctx.fillStyle = "#d0d5dd";
        for (let gx = 0; gx <= cssW; gx += SS_DRAW_GRID) {
            for (let gy = 0; gy <= cssH; gy += SS_DRAW_GRID) {
                ctx.beginPath();
                ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        shapes.forEach((s, i) => drawShape(s, i === _valShapeIdx || selectedShapeIndices.includes(i), false));

        if (ghost) drawShape(ghost, false, true);

        // draw selection box and handles
        if (selectedShapeIndices.length > 0) {
            drawSelectionBox(getGroupBBox(selectedShapeIndices));
        }

        // draw box select draft
        if (boxSelectDraft) {
            ctx.save();
            ctx.fillStyle = "rgba(55,138,221,0.15)";
            ctx.strokeStyle = "#378ADD";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const x = Math.min(boxSelectDraft.x1, boxSelectDraft.x2);
            const y = Math.min(boxSelectDraft.y1, boxSelectDraft.y2);
            const w = Math.abs(boxSelectDraft.x2 - boxSelectDraft.x1);
            const h = Math.abs(boxSelectDraft.y2 - boxSelectDraft.y1);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.restore();
        }

        // chain anchor marker
        if (tool === "line" && chainStart) {
            ctx.beginPath();
            ctx.arc(chainStart.x, chainStart.y, 5, 0, Math.PI * 2);
            ctx.strokeStyle = "#378ADD";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    };

    const drawArrow = (x, y, ux, uy, colr) => {
        // tip at (x,y); body extends along (ux,uy)
        const sz = 9, w = 3.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ux * sz - (-uy) * w, y + uy * sz - ux * w);
        ctx.lineTo(x + ux * sz + (-uy) * w, y + uy * sz + ux * w);
        ctx.closePath();
        ctx.fillStyle = colr;
        ctx.fill();
    };

    const drawDim = (s, highlighted, ghost) => {
        const g = dimGeom(s);
        const c = highlighted ? "#f39c12" : (s.color || "#1f272e");
        ctx.save();
        ctx.globalAlpha = ghost ? 0.5 : 1;
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";

        // extension lines
        ctx.beginPath();
        ctx.moveTo(s.x1 + g.nx * 4, s.y1 + g.ny * 4);
        ctx.lineTo(s.x1 + g.nx * (g.off + (g.off >= 0 ? 5 : -5)), s.y1 + g.ny * (g.off + (g.off >= 0 ? 5 : -5)));
        ctx.moveTo(s.x2 + g.nx * 4, s.y2 + g.ny * 4);
        ctx.lineTo(s.x2 + g.nx * (g.off + (g.off >= 0 ? 5 : -5)), s.y2 + g.ny * (g.off + (g.off >= 0 ? 5 : -5)));
        ctx.stroke();

        // dimension line
        ctx.beginPath();
        ctx.moveTo(g.ax, g.ay);
        ctx.lineTo(g.bx, g.by);
        ctx.stroke();

        drawArrow(g.ax, g.ay, g.ux, g.uy, c);
        drawArrow(g.bx, g.by, -g.ux, -g.uy, c);

        // value label
        const text = dimText(g.len);
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(g.mx - tw / 2 - 5, g.my - 9, tw + 10, 18);
        ctx.fillStyle = c;
        ctx.fillText(text, g.mx, g.my);

        ctx.restore();
    };

    const drawSelectionBox = (bb) => {
        if (!bb) return;
        ctx.save();
        ctx.strokeStyle = "#378ADD";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const pad = 4;
        ctx.strokeRect(bb.minX - pad, bb.minY - pad, bb.maxX - bb.minX + pad*2, bb.maxY - bb.minY + pad*2);
        
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        const handles = [
            [bb.minX - pad, bb.minY - pad], // tl
            [bb.maxX + pad, bb.minY - pad], // tr
            [bb.minX - pad, bb.maxY + pad], // bl
            [bb.maxX + pad, bb.maxY + pad]  // br
        ];
        for (const [hx, hy] of handles) {
            ctx.fillRect(hx - 4, hy - 4, 8, 8);
            ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        }
        ctx.restore();
    };

    const drawShape = (s, highlighted, ghost) => {
        if (s.type === "dim") { drawDim(s, highlighted, ghost); return; }

        ctx.save();
        ctx.globalAlpha = ghost ? 0.45 : 1;
        ctx.strokeStyle = highlighted ? "#f39c12" : s.color;
        ctx.fillStyle = highlighted ? "#f39c12" : s.color;
        ctx.lineWidth = highlighted ? 3 : 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (s.type === "line") {
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();

            [[s.x1, s.y1], [s.x2, s.y2]].forEach(([px, py]) => {
                ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            });
        } else if (s.type === "freehand") {
            ctx.beginPath();
            s.points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
            ctx.stroke();
        } else if (s.type === "rect") {
            ctx.strokeRect(s.x, s.y, s.w, s.h);
            ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill(); // start point
        } else if (s.type === "circle") {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill(); // center point
        } else if (s.type === "text") {
            ctx.font = s.font || "14px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(s.text, s.x, s.y);
        }

        // draw height and floors badge if exists
        if (s.height || s.floors) {
            const bb = getBBox(s);
            if (bb) {
                const label = `${s.height ? s.height + 'm' : ''}${s.height && s.floors ? ' | ' : ''}${s.floors ? s.floors + ' fl' : ''}`;
                ctx.font = "bold 10px sans-serif";
                const tw = ctx.measureText(label).width;
                const bx = bb.maxX - tw;
                const by = bb.maxY + 6;
                ctx.fillStyle = "rgba(255,255,255,0.92)";
                ctx.fillRect(bx - 4, by - 2, tw + 8, 14);
                ctx.fillStyle = s.color || "#1f272e";
                ctx.fillText(label, bx, by + 9);
            }
        }

        ctx.restore();
    };

    render();

    // ── scale calibration animation ──
    const animateScaleTo = (target) => {
        if (scaleAnimFrame) cancelAnimationFrame(scaleAnimFrame);
        const start = displayPxPerMeter;
        const t0 = performance.now();
        const dur = 420;
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
            displayPxPerMeter = start + (target - start) * e;
            render();
            if (k < 1) {
                scaleAnimFrame = requestAnimationFrame(step);
            } else {
                scale.pxPerMeter = target;
                displayPxPerMeter = target;
                scaleAnimFrame = null;
                render();
            }
        };
        scaleAnimFrame = requestAnimationFrame(step);
    };

    // ── text/value overlays ──
    const removeOverlayInputs = () => {
        if (_valInputEl?.parentNode) _valInputEl.parentNode.removeChild(_valInputEl);
        if (textInputEl?.parentNode) textInputEl.parentNode.removeChild(textInputEl);
        _valInputEl = null; _valShapeIdx = null;
        textInputEl = null;
    };

    const showValInput = (idx) => {
        removeOverlayInputs();
        _valShapeIdx = idx;
        const s = shapes[idx];
        const g = dimGeom(s);

        const inp = document.createElement("input");
        inp.type = "text";
        inp.inputMode = "decimal";
        inp.placeholder = `e.g. 2.5`;
        inp.value = String(Math.round((g.len / displayPxPerMeter) * SS_DRAW_UNITS[scale.unit] * 100) / 100);
        inp.style.cssText = `
            position:absolute;
            left:${g.mx - 42}px; top:${g.my - 14}px;
            width:84px; font-size:12px; font-weight:600;
            border:2px solid #f39c12; border-radius:5px;
            padding:2px 4px; text-align:center;
            background:#fffbe6; color:#333;
            box-shadow:0 2px 8px rgba(0,0,0,.22); z-index:20;
        `;
        wrapEl.style.position = "relative";
        wrapEl.appendChild(inp);
        _valInputEl = inp;
        inp.focus(); inp.select();

        const commit = () => {
            const v = parseFloat(inp.value);
            const wasIdx = _valShapeIdx;
            removeOverlayInputs();
            if (wasIdx !== null && shapes[wasIdx] && !isNaN(v) && v > 0) {
                const len = dimGeom(shapes[wasIdx]).len;
                const targetPxPerMeter = len / (v / SS_DRAW_UNITS[scale.unit]);
                animateScaleTo(targetPxPerMeter);
            } else {
                render();
            }
        };
        inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.stopPropagation(); commit(); }
            if (e.key === "Escape") { e.stopPropagation(); removeOverlayInputs(); render(); }
        });
        inp.addEventListener("blur", commit);
        render();
    };

    const showTextInput = (x, y) => {
        removeOverlayInputs();
        hidePropsPanel();
        selectedShapeIndices = [];

        const inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = "Enter text...";
        inp.style.cssText = `
            position:absolute;
            left:${x}px; top:${y - 10}px;
            font-size:14px; font-family:sans-serif;
            border:1px solid #378ADD; border-radius:4px;
            padding:4px 6px; background:#fff; z-index:20;
            outline:none;
        `;
        wrapEl.style.position = "relative";
        wrapEl.appendChild(inp);
        textInputEl = inp;
        inp.focus();

        const commit = () => {
            const val = inp.value.trim();
            removeOverlayInputs();
            if (val) {
                saveState();
                shapes.push({ type: "text", text: val, x, y, font: "14px sans-serif", color });
            }
            render();
        };
        inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.stopPropagation(); commit(); }
            if (e.key === "Escape") { e.stopPropagation(); removeOverlayInputs(); render(); }
        });
        inp.addEventListener("blur", commit);
    };

    // ── properties panel ──
    const hidePropsPanel = () => {
        if (propsPanelEl?.parentNode) propsPanelEl.parentNode.removeChild(propsPanelEl);
        propsPanelEl = null;
    };

    const showPropsPanel = () => {
        hidePropsPanel();
        if (selectedShapeIndices.length !== 1) return; // only show for exactly one item
        const idx = selectedShapeIndices[0];
        const s = shapes[idx];
        if (!s) return;

        const bb = getBBox(s);
        if (!bb) return;

        const panel = document.createElement("div");
        panel.style.cssText = `
            position:absolute;
            left:${bb.maxX + 15}px; top:${bb.minY}px;
            background:#fff; border:1px solid var(--border-color,#e2e6ea);
            border-radius:8px; padding:10px; box-shadow:0 4px 12px rgba(0,0,0,0.1);
            z-index:30; display:flex; flex-direction:column; gap:8px;
            width:160px; font-size:12px;
        `;
        
        panel.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px;">Region Properties</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <label style="margin:0;color:#8d96a0;">Height (m)</label>
                <input type="number" class="ss-prop-h" value="${s.height || ''}" style="width:60px;padding:2px 4px;border:1px solid #e2e6ea;border-radius:4px;" step="any">
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <label style="margin:0;color:#8d96a0;">Floors</label>
                <input type="number" class="ss-prop-f" value="${s.floors || ''}" style="width:60px;padding:2px 4px;border:1px solid #e2e6ea;border-radius:4px;">
            </div>
        `;

        wrapEl.style.position = "relative";
        wrapEl.appendChild(panel);
        propsPanelEl = panel;

        let propsSaveTriggered = false;
        const updateProps = () => {
            if (shapes[idx]) {
                if (!propsSaveTriggered) {
                    saveState();
                    propsSaveTriggered = true;
                }
                const h = panel.querySelector('.ss-prop-h').value;
                const f = panel.querySelector('.ss-prop-f').value;
                shapes[idx].height = h ? parseFloat(h) : null;
                shapes[idx].floors = f ? parseInt(f, 10) : null;
                render();
            }
        };

        panel.querySelector('.ss-prop-h').addEventListener('focus', () => propsSaveTriggered = false);
        panel.querySelector('.ss-prop-f').addEventListener('focus', () => propsSaveTriggered = false);
        panel.querySelector('.ss-prop-h').addEventListener('input', updateProps);
        panel.querySelector('.ss-prop-f').addEventListener('input', updateProps);
    };

    // ── pointer events ──
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", () => { 
        if (freeDrawing) { freeDrawing = false; render(); }
        eraseMode = false;
        eraseModeSaved = false;
    });
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onUp, { passive: false });
    canvas.addEventListener("dblclick", (e) => { e.preventDefault(); endChain(); });
    canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); endChain(); });

    function endChain() {
        if (chainStart) { chainStart = null; render(); }
    }

    const keydownHandler = (e) => {
        // Handle deletion of shapes
        if ((e.key === "Delete" || e.key === "Backspace") && tool === "select" && selectedShapeIndices.length > 0) {
            // Check if we are typing in an input
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
            if (activeTag !== "input" && activeTag !== "textarea") {
                e.preventDefault(); e.stopPropagation();
                saveState();
                // delete in reverse order to keep indices valid
                const toDelete = [...selectedShapeIndices].sort((a,b)=>b-a);
                for (const idx of toDelete) {
                    shapes.splice(idx, 1);
                }
                selectedShapeIndices = [];
                hidePropsPanel();
                render();
            }
        }
        
        if (e.key === "Escape" && chainStart) {
            e.preventDefault(); e.stopPropagation(); endChain();
        }
    };
    document.addEventListener("keydown", keydownHandler, true);
    
    const prevOnHide = dialog.onhide;
    dialog.onhide = () => {
        document.removeEventListener("keydown", keydownHandler, true);
        if (scaleAnimFrame) cancelAnimationFrame(scaleAnimFrame);
        if (typeof prevOnHide === "function") prevOnHide();
    };

    function checkHandleHit(x, y, bb) {
        if (!bb) return null;
        const pad = 4;
        const handles = [
            { id: "tl", x: bb.minX - pad, y: bb.minY - pad },
            { id: "tr", x: bb.maxX + pad, y: bb.minY - pad },
            { id: "bl", x: bb.minX - pad, y: bb.maxY + pad },
            { id: "br", x: bb.maxX + pad, y: bb.maxY + pad }
        ];
        for (const h of handles) {
            if (x >= h.x - 8 && x <= h.x + 8 && y >= h.y - 8 && y <= h.y + 8) return h.id;
        }
        return null;
    }

    function onDown(e) {
        e.preventDefault();
        const raw = canvasPos(e);
        downPos = raw;
        pointerMoved = false;
        pointerDown = true;
        removeOverlayInputs();

        if (tool === "select") {
            let hitGroupBB = false;
            let groupBB = null;

            if (selectedShapeIndices.length > 0) {
                groupBB = getGroupBBox(selectedShapeIndices);
                const handle = checkHandleHit(raw.x, raw.y, groupBB);
                if (handle) {
                    transformState = { 
                        mode: "scale", handle, startX: raw.x, startY: raw.y, 
                        origShapes: selectedShapeIndices.map(i => JSON.parse(JSON.stringify(shapes[i]))),
                        groupBB: groupBB, saved: false
                    };
                    return;
                }
                if (!e.shiftKey && groupBB && raw.x >= groupBB.minX && raw.x <= groupBB.maxX && raw.y >= groupBB.minY && raw.y <= groupBB.maxY) {
                    hitGroupBB = true;
                }
            }
            
            // Check hit on individual shapes
            let hitIdx = null;
            for (let i = shapes.length - 1; i >= 0; i--) {
                if (hitShape(raw.x, raw.y, shapes[i])) { hitIdx = i; break; }
            }
            
            if (e.shiftKey && hitIdx !== null) {
                // Toggle selection
                const pos = selectedShapeIndices.indexOf(hitIdx);
                if (pos === -1) selectedShapeIndices.push(hitIdx);
                else selectedShapeIndices.splice(pos, 1);
                showPropsPanel();
                render();
                return;
            }

            // Clicked inside bounding box but not explicitly toggling a new shape
            // Or clicked an existing selected shape without shift. Start move.
            if ((hitGroupBB && hitIdx === null) || (hitIdx !== null && selectedShapeIndices.includes(hitIdx))) {
                transformState = { 
                    mode: "move", startX: raw.x, startY: raw.y, 
                    origShapes: selectedShapeIndices.map(i => JSON.parse(JSON.stringify(shapes[i]))),
                    saved: false
                };
                return;
            }

            // Clicked a new shape outside the current selection bounds
            if (hitIdx !== null) {
                selectedShapeIndices = [hitIdx];
                showPropsPanel();
                transformState = { 
                    mode: "move", startX: raw.x, startY: raw.y, 
                    origShapes: [JSON.parse(JSON.stringify(shapes[hitIdx]))],
                    saved: false
                };
                render();
                return;
            }
            
            // Clicked empty space
            if (!e.shiftKey) {
                selectedShapeIndices = [];
                hidePropsPanel();
            }
            boxSelectDraft = { x1: raw.x, y1: raw.y, x2: raw.x, y2: raw.y };
            render();
            return;
        }

        selectedShapeIndices = [];
        hidePropsPanel();

        if (tool === "measure") {
            // Check if dragging an existing dim
            for (let i = shapes.length - 1; i >= 0; i--) {
                if (shapes[i].type !== "dim") continue;
                const h = hitDim(raw.x, raw.y, shapes[i]);
                if (h.hit) { dimDragIdx = i; dimHitWasLabel = h.label; return; }
            }
            
            // Check if clicking a rect/circle/line to auto-measure
            for (let i = shapes.length - 1; i >= 0; i--) {
                const s = shapes[i];
                if ((s.type === "rect" || s.type === "circle" || s.type === "line") && hitShape(raw.x, raw.y, s)) {
                    saveState();
                    if (s.type === "rect") {
                        shapes.push({ type: "dim", x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y, offset: -26, color });
                        shapes.push({ type: "dim", x1: s.x + s.w, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, offset: 26, color });
                    } else if (s.type === "circle") {
                        shapes.push({ type: "dim", x1: s.x, y1: s.y, x2: s.x + s.r, y2: s.y, offset: -26, color });
                    } else if (s.type === "line") {
                        shapes.push({ type: "dim", x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, offset: 26, color });
                    }
                    render();
                    return; // Stop processing down event
                }
            }
            
            dimDraft = snapDimPt(raw);
            return;
        }

        if (tool === "eraser") {
            eraseMode = true;
            eraseModeSaved = false;
            for (let i = shapes.length - 1; i >= 0; i--) {
                if (hitShape(raw.x, raw.y, shapes[i])) { 
                    if (!eraseModeSaved) { saveState(); eraseModeSaved = true; }
                    shapes.splice(i, 1); 
                    render(); 
                    return; 
                }
            }
            return;
        }

        if (tool === "line") {
            if (!chainStart) {
                chainStart = snapPt(raw);
                anchorJustPlaced = true;
                render();
            }
            return;
        }

        if (tool === "rect") {
            draftShape = { type: "rect", x: snap(raw.x), y: snap(raw.y), w: 0, h: 0, color };
            return;
        }

        if (tool === "circle") {
            draftShape = { type: "circle", x: snap(raw.x), y: snap(raw.y), r: 0, color };
            return;
        }

        if (tool === "text") {
            showTextInput(raw.x, raw.y);
            return;
        }

        if (tool === "freehand") {
            freeDrawing = true;
            freePoints = [[raw.x, raw.y]];
        }
    }

    function applyTransform(s, origS, state, dx, dy, shiftKey) {
        if (state.mode === "move") {
            if (s.type === "rect" || s.type === "circle" || s.type === "text") {
                s.x = origS.x + dx;
                s.y = origS.y + dy;
            } else if (s.type === "line" || s.type === "dim") {
                s.x1 = origS.x1 + dx; s.y1 = origS.y1 + dy;
                s.x2 = origS.x2 + dx; s.y2 = origS.y2 + dy;
            } else if (s.type === "freehand") {
                s.points = origS.points.map(p => [p[0] + dx, p[1] + dy]);
            }
        } else if (state.mode === "scale") {
            const bb = state.groupBB;
            if (!bb) return;
            let nMinX = bb.minX, nMinY = bb.minY, nMaxX = bb.maxX, nMaxY = bb.maxY;
            
            if (state.handle.includes("l")) nMinX += dx;
            if (state.handle.includes("r")) nMaxX += dx;
            if (state.handle.includes("t")) nMinY += dy;
            if (state.handle.includes("b")) nMaxY += dy;
            
            if (nMaxX < nMinX) { const t = nMinX; nMinX = nMaxX; nMaxX = t; }
            if (nMaxY < nMinY) { const t = nMinY; nMinY = nMaxY; nMaxY = t; }

            let scaleX = (nMaxX - nMinX) / (bb.maxX - bb.minX || 1);
            let scaleY = (nMaxY - nMinY) / (bb.maxY - bb.minY || 1);

            if (shiftKey) {
                const sVal = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                scaleX = scaleX < 0 ? -sVal : sVal;
                scaleY = scaleY < 0 ? -sVal : sVal;
                
                if (state.handle.includes("l")) nMinX = bb.maxX - (bb.maxX - bb.minX) * Math.abs(scaleX);
                else nMaxX = bb.minX + (bb.maxX - bb.minX) * Math.abs(scaleX);
                
                if (state.handle.includes("t")) nMinY = bb.maxY - (bb.maxY - bb.minY) * Math.abs(scaleY);
                else nMaxY = bb.minY + (bb.maxY - bb.minY) * Math.abs(scaleY);
            }

            if (s.type === "rect") {
                s.x = nMinX + (origS.x - bb.minX) * scaleX;
                s.y = nMinY + (origS.y - bb.minY) * scaleY;
                s.w = origS.w * scaleX;
                s.h = origS.h * scaleY;
            } else if (s.type === "circle") {
                s.x = nMinX + (origS.x - bb.minX) * scaleX;
                s.y = nMinY + (origS.y - bb.minY) * scaleY;
                s.r = origS.r * Math.max(Math.abs(scaleX), Math.abs(scaleY));
            } else if (s.type === "line" || s.type === "dim") {
                s.x1 = nMinX + (origS.x1 - bb.minX) * scaleX;
                s.y1 = nMinY + (origS.y1 - bb.minY) * scaleY;
                s.x2 = nMinX + (origS.x2 - bb.minX) * scaleX;
                s.y2 = nMinY + (origS.y2 - bb.minY) * scaleY;
            } else if (s.type === "freehand") {
                s.points = origS.points.map(p => [
                    nMinX + (p[0] - bb.minX) * scaleX,
                    nMinY + (p[1] - bb.minY) * scaleY
                ]);
            } else if (s.type === "text") {
                s.x = nMinX + (origS.x - bb.minX) * scaleX;
                s.y = nMinY + (origS.y - bb.minY) * scaleY;
            }
        }
    }

    function onMove(e) {
        const raw = canvasPos(e);
        if (pointerDown && downPos && Math.hypot(raw.x - downPos.x, raw.y - downPos.y) > 4) pointerMoved = true;

        if (tool === "select" && boxSelectDraft && pointerDown) {
            e.preventDefault();
            boxSelectDraft.x2 = raw.x;
            boxSelectDraft.y2 = raw.y;
            render();
            return;
        }

        if (tool === "select" && transformState && selectedShapeIndices.length > 0 && pointerDown) {
            e.preventDefault();
            if (!transformState.saved && pointerMoved) {
                saveState();
                transformState.saved = true;
            }
            selectedShapeIndices.forEach((idx, arrIdx) => {
                applyTransform(shapes[idx], transformState.origShapes[arrIdx], transformState, raw.x - transformState.startX, raw.y - transformState.startY, e.shiftKey);
            });
            render();
            if (propsPanelEl && selectedShapeIndices.length === 1) {
                const bb = getBBox(shapes[selectedShapeIndices[0]]);
                if (bb) {
                    propsPanelEl.style.left = `${bb.maxX + 15}px`;
                    propsPanelEl.style.top = `${bb.minY}px`;
                }
            }
            return;
        }
        
        if (tool === "eraser" && eraseMode && pointerDown) {
            e.preventDefault();
            let erased = false;
            for (let i = shapes.length - 1; i >= 0; i--) {
                if (hitShape(raw.x, raw.y, shapes[i])) { 
                    if (!eraseModeSaved) { saveState(); eraseModeSaved = true; }
                    shapes.splice(i, 1); 
                    erased = true;
                }
            }
            if (erased) render();
            return;
        }

        if (tool === "line" && chainStart) {
            e.preventDefault();
            const pt = snapPt(raw);
            render({ type: "line", x1: chainStart.x, y1: chainStart.y, x2: pt.x, y2: pt.y, color, measurement: "" });
            return;
        }

        if (tool === "rect" && draftShape && pointerDown) {
            e.preventDefault();
            const pt = snapPt(raw);
            draftShape.w = pt.x - draftShape.x;
            draftShape.h = pt.y - draftShape.y;
            render(draftShape);
            return;
        }

        if (tool === "circle" && draftShape && pointerDown) {
            e.preventDefault();
            const pt = snapPt(raw);
            draftShape.r = Math.hypot(pt.x - draftShape.x, pt.y - draftShape.y);
            render(draftShape);
            return;
        }

        if (tool === "measure") {
            if (dimDragIdx !== null && pointerDown) {
                e.preventDefault();
                if (pointerMoved && !transformState?.saved) {
                    saveState();
                    transformState = { saved: true }; // hack to prevent multiple saves
                }
                const s = shapes[dimDragIdx];
                const g = dimGeom(s);
                s.offset = (raw.x - s.x1) * g.nx + (raw.y - s.y1) * g.ny;
                render();
                return;
            }
            if (dimDraft && pointerDown) {
                e.preventDefault();
                const pt = snapDimPt(raw);
                render({ type: "dim", x1: dimDraft.x, y1: dimDraft.y, x2: pt.x, y2: pt.y, offset: 26, color });
                return;
            }
            return;
        }

        if (tool === "freehand" && freeDrawing) {
            e.preventDefault();
            freePoints.push([raw.x, raw.y]);
            render({ type: "freehand", points: freePoints, color });
        }
    }

    function onUp(e) {
        const raw = canvasPos(e);
        pointerDown = false;
        eraseMode = false;
        eraseModeSaved = false;

        if (tool === "select" && boxSelectDraft) {
            for (let i = 0; i < shapes.length; i++) {
                if (checkOverlap(boxSelectDraft, shapes[i]) && !selectedShapeIndices.includes(i)) {
                    selectedShapeIndices.push(i);
                }
            }
            boxSelectDraft = null;
            showPropsPanel();
            render();
            return;
        }

        if (tool === "select" && transformState) {
            transformState = null;
            return;
        }

        if (tool === "line" && chainStart) {
            const end = snapPt(raw);
            const d = Math.hypot(end.x - chainStart.x, end.y - chainStart.y);
            if (d > 2) {
                saveState();
                shapes.push({ type: "line", x1: chainStart.x, y1: chainStart.y, x2: end.x, y2: end.y, color, measurement: "" });
                chainStart = end;
            } else if (!anchorJustPlaced) {
                chainStart = null;
            }
            anchorJustPlaced = false;
            render();
            return;
        }

        if ((tool === "rect" || tool === "circle") && draftShape) {
            if ((tool === "rect" && Math.abs(draftShape.w) > 2 && Math.abs(draftShape.h) > 2) ||
                (tool === "circle" && draftShape.r > 2)) {
                saveState();
                // normalize rect
                if (draftShape.type === "rect") {
                    if (draftShape.w < 0) { draftShape.x += draftShape.w; draftShape.w = Math.abs(draftShape.w); }
                    if (draftShape.h < 0) { draftShape.y += draftShape.h; draftShape.h = Math.abs(draftShape.h); }
                }
                shapes.push(draftShape);
            }
            draftShape = null;
            render();
            return;
        }

        if (tool === "measure") {
            if (dimDragIdx !== null) {
                const idx = dimDragIdx;
                dimDragIdx = null;
                transformState = null;
                if (!pointerMoved && dimHitWasLabel) showValInput(idx);
                else render();
                return;
            }
            if (dimDraft) {
                const end = snapDimPt(raw);
                if (Math.hypot(end.x - dimDraft.x, end.y - dimDraft.y) > 4) {
                    saveState();
                    shapes.push({ type: "dim", x1: dimDraft.x, y1: dimDraft.y, x2: end.x, y2: end.y, offset: 26, color });
                }
                dimDraft = null;
                render();
                return;
            }
            return;
        }

        if (tool === "freehand" && freeDrawing) {
            freeDrawing = false;
            if (freePoints.length > 1) {
                saveState();
                shapes.push({ type: "freehand", points: [...freePoints], color });
            }
            freePoints = [];
            render();
        }
    }

    // ── toolbar interactions ──
    const $toolbar = $wrap.find(".ss-draw-toolbar");

    $toolbar.on("click", ".ss-draw-tool[data-tool]", function () {
        tool = $(this).attr("data-tool");
        chainStart = null; dimDraft = null; dimDragIdx = null; draftShape = null;
        transformState = null; selectedShapeIndices = []; boxSelectDraft = null;
        removeOverlayInputs(); hidePropsPanel();
        
        $toolbar.find(".ss-draw-tool[data-tool]").removeClass("ss-draw-tool--active");
        $(this).addClass("ss-draw-tool--active");
        
        if (tool === "select") canvas.style.cursor = "default";
        else if (tool === "text") canvas.style.cursor = "text";
        else if (tool === "eraser") canvas.style.cursor = "crosshair"; // brush cursor
        else canvas.style.cursor = "crosshair";
        
        render();
    });

    $toolbar.on("click", ".ss-draw-color-btn", function () {
        color = $(this).attr("data-color");
        $toolbar.find(".ss-draw-color-btn").removeClass("ss-draw-color-active");
        $(this).addClass("ss-draw-color-active");
        
        // update color of selected shapes if in select mode
        if (tool === "select" && selectedShapeIndices.length > 0) {
            saveState();
            for (const idx of selectedShapeIndices) {
                if (shapes[idx]) shapes[idx].color = color;
            }
            render();
        }
    });

    $toolbar.on("change", ".ss-draw-unit", function () {
        scale.unit = $(this).val();
        render();
    });

    $toolbar.on("click", ".ss-draw-undo-btn", () => {
        if (history.length > 0) {
            shapes = JSON.parse(history.pop());
            chainStart = null; draftShape = null; selectedShapeIndices = []; transformState = null; boxSelectDraft = null;
            removeOverlayInputs(); hidePropsPanel();
            render();
        }
    });

    $toolbar.on("click", ".ss-draw-clear-btn", () => {
        if (!shapes.length || confirm(__("Clear all? Cannot be undone."))) {
            saveState();
            shapes = [];
            chainStart = null; dimDraft = null; dimDragIdx = null; draftShape = null;
            selectedShapeIndices = []; transformState = null; boxSelectDraft = null;
            removeOverlayInputs(); hidePropsPanel();
            render();
        }
    });

    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
}


// ─── Row editing state ────────────────────────────────────────────────────────

function _ss_set_editing_row($shell, docname) {
    if (_SS_EDITING_ROW === docname) return;
    _ss_clear_editing_row($shell);
    _SS_EDITING_ROW = docname;
    if (docname) $shell.find(`.ss-cell[data-row="${docname}"]`).addClass("ss-row--editing");
}

function _ss_clear_editing_row($shell) {
    if (_SS_EDITING_ROW) $shell.find(`.ss-cell[data-row="${_SS_EDITING_ROW}"]`).removeClass("ss-row--editing");
    _SS_EDITING_ROW = null;
}

// ─── Event binding ────────────────────────────────────────────────────────────

function ss_bind_events(listview, shell, $host) {
    const $shell = $(shell);

    _ss_bind_row_hover($shell);
    _ss_bind_textarea_autogrow($shell);
    _ss_init_saved_vals($shell);

    const handle_update = _ss_make_update_handler(listview);
    $shell.on("change.ss", ".ss-select", handle_update);
    $shell.on("blur.ss", ".ss-input:not(.ss-select):not([data-inline])", handle_update);
    $shell.on("keydown.ss", "input.ss-input", (e) => {
        if (e.key === "Enter") { e.preventDefault(); $(e.currentTarget).blur(); }
    });

    _ss_bind_click_to_edit($shell, listview, handle_update);
    _ss_bind_link_autocomplete($shell, listview);
    _ss_bind_add_row($host, listview);
    _ss_bind_attachments($shell, listview);
    _ss_bind_measurements($shell, listview);
    _ss_bind_drawings($shell, listview);
    _ss_bind_maps_toggle($shell);
    _ss_bind_delete_row($shell, listview);
    _ss_bind_col_resize($shell, shell);

    $(document).off("mousedown.ssrow").on("mousedown.ssrow", function (e) {
        if (!$(e.target).closest(".ss-grid-shell").length) _ss_clear_editing_row($shell);
    });
}

function _ss_bind_row_hover($shell) {
    $shell.on("mouseenter.ss", ".ss-cell[data-row]", function () {
        $shell.find(`.ss-cell[data-row="${$(this).attr("data-row")}"]`).addClass("ss-row-hover");
    });
    $shell.on("mouseleave.ss", ".ss-cell[data-row]", function () {
        $shell.find(`.ss-cell[data-row="${$(this).attr("data-row")}"]`).removeClass("ss-row-hover");
    });
}

function _ss_bind_textarea_autogrow($shell) {
    const grow = function () { this.style.height = "auto"; this.style.height = `${this.scrollHeight}px`; };
    $shell.on("input.ss", ".ss-area", grow);
    $shell.find(".ss-area").each(grow);
}

function _ss_init_saved_vals($shell) {
    $shell.find(".ss-input[data-field]").each(function () {
        $(this).data("last-saved-val", ($(this).val() || "").trim());
    });
}

function _ss_make_update_handler(listview) {
    return function () {
        const $el = $(this);
        const docname = $el.attr("data-name");
        const fieldname = $el.attr("data-field");
        const val = ($el.val() || "").trim();
        if (!docname || !fieldname) return;
        if ($el.data("last-saved-val") === val) return;
        ss_fast_save(listview, docname, fieldname, val, $el);
    };
}

function _ss_bind_click_to_edit($shell, listview, handle_update) {
    const activate = ($span, typedChar) => {
        if ($span.data("editing")) return;
        $span.data("editing", true);

        const docname = $span.attr("data-name");
        const fieldname = $span.attr("data-field");
        const type = $span.attr("data-type") || "text";
        const current = $span.attr("title") || "";
        const linkDt = $span.attr("data-link") || null;

        const inputType = type === "link" ? "text" : type;
        const $input = $(`<input type="${inputType}" class="ss-input ss-cell-input--inline">`)
            .val(typedChar != null ? typedChar : current)
            .attr({ "data-name": docname, "data-field": fieldname, "data-inline": "1" })
            .data("last-saved-val", current.trim());

        if (linkDt) $input.attr("data-link", linkDt);

        $span.replaceWith($input);
        $input.trigger("focus");
        if (typedChar == null) $input[0].select();

        $input.on("blur.ssinline", function () {
            const unchanged = $input.data("last-saved-val") === ($input.val() || "").trim();
            handle_update.call(this);
            if (unchanged) ss_render_grid(listview);
        });
        $input.on("keydown.ssinline", (e) => {
            if (e.key === "Enter") { e.preventDefault(); $input.trigger("blur"); }
            if (e.key === "Escape") {
                e.preventDefault();
                _ss_clear_editing_row($shell);
                $input.off("blur.ssinline");
                ss_render_grid(listview);
            }
        });
    };

    // Single click on data cell → activate row editing
    $shell.on("click.ss", ".ss-data-cell", function () {
        _ss_set_editing_row($shell, $(this).attr("data-row"));
    });

    // Click on display span → activate inline input
    $shell.on("click.ss", ".ss-cell-display", function () { activate($(this), null); });

    // Double click → navigate to form
    $shell.on("dblclick.ss", ".ss-data-cell", function (e) {
        e.preventDefault();
        const docname = $(this).attr("data-row");
        if (docname) frappe.set_route("Form", SS_DOCTYPE, docname);
    });

    $shell.on("keydown.ss", ".ss-cell-display", function (e) {
        if (e.key === "Enter") { e.preventDefault(); activate($(this), null); }
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault(); activate($(this), e.key);
        }
    });
}

// ─── Link-field autocomplete ──────────────────────────────────────────────────

function _ss_bind_link_autocomplete($shell, listview) {
    let $menu = null, activeInput = null, debounceTimer = null;

    const closeMenu = () => { if ($menu) { $menu.remove(); $menu = null; } activeInput = null; };

    const linkConfig = {
        User: { doctype: "User", fields: ["name", "full_name", "email"], searchfield: "full_name", primary: "full_name", sub: "email", id: "name" },
        Customer: { doctype: "Customer", fields: ["name", "customer_name"], searchfield: "customer_name", primary: "customer_name", sub: "", id: "name" },
        Lead: { doctype: "Lead", fields: ["name", "lead_name", "company_name"], searchfield: "lead_name", primary: "lead_name", sub: "company_name", id: "name" },
        Contact: { doctype: "Contact", fields: ["name", "first_name", "last_name", "company_name"], searchfield: "first_name", primary: "first_name", sub: "company_name", id: "name" },
    };

    const positionMenu = ($input) => {
        const rect = $input[0].getBoundingClientRect();
        $menu.css({ top: `${rect.bottom + window.scrollY}px`, left: `${rect.left + window.scrollX}px`, width: `${Math.max(rect.width, 220)}px` });
    };

    const renderMenu = ($input, results) => {
        if (!$menu) $menu = $(`<div class="ss-ac-menu"></div>`).appendTo(document.body);
        const items = results.map(r => {
            const primary = frappe.utils.escape_html(r.primary);
            const sub = r.sub ? `<span class="ss-ac-sub">${frappe.utils.escape_html(r.sub)}</span>` : "";
            return `<div class="ss-ac-item" data-value="${primary}" data-id="${frappe.utils.escape_html(r.id)}">
				<span class="ss-ac-primary">${primary}</span>${sub}
			</div>`;
        }).join("");
        if (!items) { closeMenu(); return; }
        $menu.html(items);
        positionMenu($input);
    };

    const search = ($input, typed) => {
        const cfg = linkConfig[$input.attr("data-link")];
        if (!cfg) return;
        const filters = typed.trim() ? { [cfg.searchfield]: ["like", `%${typed.trim()}%`] } : {};
        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: cfg.doctype, fields: cfg.fields, filters, limit_page_length: 8, order_by: `${cfg.searchfield} asc` },
            callback: ({ message }) => {
                if (activeInput !== $input[0]) return;
                const results = (message || []).map(row => {
                    const primary = row[cfg.primary] || row.name;
                    const id = row[cfg.id] || row.name;
                    _SS_LINK_NAMES.set(`${cfg.doctype}::${id}`, primary);
                    return { primary, sub: row[cfg.sub] || "", id };
                });
                renderMenu($input, results);
            },
        });
    };

    $shell.on("input.ssac focus.ssac", ".ss-input[data-link]", function () {
        activeInput = this;
        const $input = $(this);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => search($input, $input.val() || ""), 180);
    });

    $(document).off("mousedown.ssac").on("mousedown.ssac", ".ss-ac-item", function (e) {
        e.preventDefault();
        if (!activeInput) return;
        const $input = $(activeInput);
        const id = $(this).attr("data-id");
        const name = $(this).attr("data-value");
        const cfg = linkConfig[$input.attr("data-link")];
        if (cfg) _SS_LINK_NAMES.set(`${cfg.doctype}::${id}`, name);
        $input.val(id);
        closeMenu();
        $input.trigger("blur");
    });

    $shell.on("blur.ssac", ".ss-input[data-link]", () => setTimeout(closeMenu, 120));
    $(document).off("click.ssacout").on("click.ssacout", (e) => {
        if ($menu && !$(e.target).closest(".ss-ac-menu, .ss-input[data-link]").length) closeMenu();
    });
}

// ─── Toolbar / row actions ────────────────────────────────────────────────────

function _ss_bind_add_row($host, listview) {
    $host.off("click.ssadd").on("click.ssadd", ".ss-add-row-btn", () => ss_add_blank_row(listview));
}

function _ss_bind_measurements($shell, listview) {
    $shell.on("click.ss", ".ss-measure-btn", function (e) {
        e.stopPropagation();
        ss_open_measure_dialog(listview, $(this).attr("data-name"));
    });
}

function _ss_bind_drawings($shell, listview) {
    $shell.on("click.ss", ".ss-draw-btn", function (e) {
        e.stopPropagation();
        ss_open_drawing_dialog(listview, $(this).attr("data-name"));
    });
}

function _ss_bind_attachments($shell, listview) {
    $shell.on("click.ss", ".ss-attach-btn", function () {
        ss_open_attach_dialog(listview, $(this).attr("data-name"));
    });
}

function _ss_bind_maps_toggle($shell) {
    $shell.on("click.ss", ".ss-map-pen", function (e) {
        e.stopPropagation();
        const $cell = $(this).closest(".ss-map-cell");
        const $input = $cell.find(".ss-map-input");
        const $display = $cell.find(".ss-map-display");
        if ($input.is(":visible")) { $input.hide(); $display.show(); $input.blur(); }
        else { $display.hide(); $input.show().focus().select(); }
    });
}

function _ss_bind_delete_row($shell, listview) {
    $shell.on("click.ss", ".ss-row-del", function (e) {
        e.stopPropagation();
        ss_delete_row(listview, $(this).attr("data-name"));
    });
}

function _ss_bind_col_resize($shell, shell) {
    $shell.on("mousedown.ss", ".ss-col-resize", function (e) {
        e.preventDefault(); e.stopPropagation();
        const field = $(this).attr("data-field");
        const startX = e.pageX;
        const startW = $shell.find(`.ss-headcell[data-field="${field}"]`).outerWidth();
        const colIdx = SS_COLUMNS.findIndex(c => c.field === field) + 1;
        $("body").css("user-select", "none");
        const onMove = (ev) => {
            const newW = Math.max(48, startW + (ev.pageX - startX));
            const tracks = shell.style.gridTemplateColumns.split(" ");
            tracks[colIdx] = `${newW}px`;
            shell.style.gridTemplateColumns = tracks.join(" ");
            SS_COL_WIDTHS[field] = newW;
        };
        const onUp = () => {
            $(document).off("mousemove.sscol mouseup.sscol");
            $("body").css("user-select", "");
            ss_persist_col_widths();
        };
        $(document).on("mousemove.sscol", onMove).on("mouseup.sscol", onUp);
    });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function ss_add_blank_row(listview) {
    frappe.call({
        method: "frappe.client.insert",
        args: { doc: { doctype: SS_DOCTYPE, status: "Draft", survey_date: frappe.datetime.get_today() } },
        callback: ({ exc, message }) => {
            if (exc || !message) return;
            frappe.show_alert({ message: __("New Row Added"), indicator: "green" }, 1.2);
            if (!Array.isArray(listview.data)) listview.data = [];
            listview.data.push(message);
            ss_render_grid(listview);
        },
    });
}

function ss_delete_row(listview, docname) {
    frappe.confirm(__("Delete row {0}? This cannot be undone.", [docname]), () => {
        frappe.call({
            method: "frappe.client.delete",
            args: { doctype: SS_DOCTYPE, name: docname },
            callback: ({ exc }) => {
                if (exc) return;
                frappe.show_alert({ message: __("Row deleted"), indicator: "red" }, 1.2);
                listview.data = (listview.data || []).filter(d => d.name !== docname);
                ss_render_grid(listview);
            },
        });
    });
}

const _SS_SAVING = new Set();

function ss_fast_save(listview, docname, fieldname, val, $el) {
    const key = `${docname}::${fieldname}`;
    if (_SS_SAVING.has(key)) return;
    _SS_SAVING.add(key);
    frappe.call({
        method: "frappe.client.set_value",
        args: { doctype: SS_DOCTYPE, name: docname, fieldname, value: val },
        callback: ({ exc }) => {
            _SS_SAVING.delete(key);
            if (exc) return;
            if ($el) $el.data("last-saved-val", val);
            frappe.show_alert({ message: __("Saved"), indicator: "green" }, 0.8);
            const row = (listview.data || []).find(d => d.name === docname);
            if (row) row[fieldname] = val;
            ss_render_grid(listview);
        },
        error: () => _SS_SAVING.delete(key),
    });
}

// ─── Measurements Take Off ────────────────────────────────────────────────────

const _SS_SVG_RULER = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`;

const _SS_MEASURE_COUNTS = new Map();

function _ss_measure_count(name, raw) {
    if (Array.isArray(raw)) { _SS_MEASURE_COUNTS.set(name, raw.length); return raw.length; }
    return _SS_MEASURE_COUNTS.get(name) ?? 0;
}

function _ss_render_measure(name, doc) {
    const count = doc?.has_measurements ? (_SS_MEASURE_COUNTS.get(name) || "✓") : 0;
    const badge = count ? `<span class="ss-attach-badge">${count}</span>` : "";
    return `<button class="ss-icon-btn ss-measure-btn" data-name="${name}" title="${__("Measurements")}">${_SS_SVG_RULER}${badge}</button>`;
}

function ss_open_measure_dialog(listview, docname) {
    frappe.call({
        method: "frappe.client.get",
        args: { doctype: SS_DOCTYPE, name: docname },
        callback: ({ message }) => {
            const rows = Array.isArray(message?.[SS_MEASURE_TABLE_FIELD])
                ? message[SS_MEASURE_TABLE_FIELD].map(r => ({ label: r.label || "", value: r.value ?? "", unit: r.unit || "m" }))
                : [];
            _ss_show_measure_dialog(listview, docname, rows);
        },
    });
}

const SS_UNITS = ["m", "m²", "m³", "cm", "mm", "ft", "in", "kg", "g", "L", "mL", "pcs", "units"];

function _ss_show_measure_dialog(listview, docname, existing) {
    const dialog = new frappe.ui.Dialog({
        title: __("Measurements Take Off — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "mto_html", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            const collected = [];
            dialog.$wrapper.find(".ss-mto-row").each(function () {
                const label = $(this).find(".ss-mto-label").val().trim();
                const value = parseFloat($(this).find(".ss-mto-value").val());
                const unit = $(this).find(".ss-mto-unit").val();
                if (label || !isNaN(value)) collected.push({ label, value: isNaN(value) ? null : value, unit });
            });

            frappe.call({
                method: "frappe.client.get",
                args: { doctype: SS_DOCTYPE, name: docname },
                callback: ({ message: doc }) => {
                    if (!doc) return;
                    doc[SS_MEASURE_TABLE_FIELD] = collected.map(r => ({
                        doctype: SS_MEASURE_DOCTYPE, label: r.label, value: r.value, unit: r.unit,
                    }));
                    frappe.call({
                        method: "frappe.client.save",
                        args: { doc },
                        callback: ({ exc }) => {
                            if (exc) return;
                            frappe.call({
                                method: "frappe.client.set_value",
                                args: { doctype: SS_DOCTYPE, name: docname, fieldname: "has_measurements", value: collected.length ? 1 : 0 },
                                callback: () => {
                                    frappe.show_alert({ message: __("Measurements saved"), indicator: "green" }, 1.0);
                                    _SS_MEASURE_COUNTS.set(docname, collected.length);
                                    const row = (listview.data || []).find(d => d.name === docname);
                                    if (row) row.has_measurements = collected.length ? 1 : 0;
                                    ss_render_grid(listview);
                                    dialog.hide();
                                },
                            });
                        },
                    });
                },
            });
        },
    });

    dialog.show();
    const $wrap = dialog.fields_dict.mto_html.$wrapper;
    const unitOpts = SS_UNITS.map(u => `<option value="${u}">${u}</option>`).join("");

    $wrap.html(`
		<div class="ss-mto-dialog">
			<div class="ss-mto-head">
				<span class="ss-mto-col-label">${__("Description")}</span>
				<span class="ss-mto-col-value">${__("Value")}</span>
				<span class="ss-mto-col-unit">${__("Unit")}</span>
				<span class="ss-mto-col-del"></span>
			</div>
			<div class="ss-mto-rows"></div>
			<button class="btn btn-xs btn-default ss-mto-add">+ ${__("Add measurement")}</button>
		</div>`);

    const $rows = $wrap.find(".ss-mto-rows");
    const add_row = (label = "", value = "", unit = "m") => {
        const selOpts = SS_UNITS.map(u => `<option value="${u}"${u === unit ? " selected" : ""}>${u}</option>`).join("");
        const $row = $(`
			<div class="ss-mto-row">
				<input type="text"   class="form-control ss-mto-label" placeholder="${__("e.g. Living room width")}" value="${frappe.utils.escape_html(label)}">
				<input type="number" class="form-control ss-mto-value" placeholder="0" value="${value}" step="any">
				<select class="form-control ss-mto-unit">${selOpts}</select>
				<button class="ss-mto-del" title="${__("Remove")}">×</button>
			</div>`);
        $row.find(".ss-mto-del").on("click", () => $row.remove());
        $rows.append($row);
    };

    existing.forEach(r => add_row(r.label, r.value, r.unit));
    if (!existing.length) add_row();
    $wrap.find(".ss-mto-add").on("click", () => add_row());
}

// ─── File upload helper ───────────────────────────────────────────────────────

function _ss_upload_file(file, docname, onSuccess, onProgress) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("is_private", "0");
    fd.append("folder", "Home/Attachments");
    fd.append("doctype", SS_DOCTYPE);
    fd.append("docname", docname);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/method/upload_file");
    xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress && onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
        try {
            const data = JSON.parse(xhr.responseText);
            if (data.message?.file_url) onSuccess(data.message);
            else frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
        } catch {
            frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
        }
    };
    xhr.onerror = () => frappe.show_alert({ message: __("Upload failed"), indicator: "red" }, 2);
    xhr.send(fd);
}

// ─── Attachments dialog ───────────────────────────────────────────────────────

function ss_open_attach_dialog(listview, docname) {
    // Live items array — shared between render, upload callbacks, and save
    let items = [];

    const repaint = ($wrap) => _ss_render_attach_dialog($wrap, items, docname);

    const dialog = new frappe.ui.Dialog({
        title: __("Files — {0}", [docname]),
        size: "large",
        fields: [{ fieldname: "attach_html", fieldtype: "HTML" }],
        primary_action_label: __("Save"),
        primary_action() {
            // Collect manual-entry rows that may have been edited
            const $wrap = dialog.fields_dict.attach_html.$wrapper;
            $wrap.find(".ss-dlg-row").each(function () {
                const idx = parseInt($(this).attr("data-idx"), 10);
                const label = $(this).find(".ss-dlg-label").val().trim();
                const url = $(this).find(".ss-dlg-url").val().trim();
                if (!isNaN(idx) && items[idx] !== undefined) {
                    items[idx] = { label, url };
                }
            });
            const collected = items.filter(r => r.url);

            frappe.call({
                method: "frappe.client.get",
                args: { doctype: SS_DOCTYPE, name: docname },
                callback: ({ exc: getExc, message: doc }) => {
                    if (getExc || !doc) return;
                    doc[SS_ATTACH_TABLE_FIELD] = collected.map(r => ({
                        doctype: SS_ATTACH_DOCTYPE, label: r.label, url: r.url,
                    }));
                    frappe.call({
                        method: "frappe.client.save",
                        args: { doc },
                        callback: ({ exc }) => {
                            if (exc) return;
                            frappe.show_alert({ message: __("Files saved"), indicator: "green" }, 1.0);
                            const localDoc = (listview.data || []).find(d => d.name === docname);
                            if (localDoc) localDoc[SS_ATTACH_TABLE_FIELD] = collected;
                            _SS_ATTACH_COUNTS.set(docname, collected.length);
                            ss_render_grid(listview);
                            dialog.hide();
                        },
                    });
                },
            });
        },
    });

    dialog.show();

    frappe.call({
        method: "frappe.client.get",
        args: { doctype: SS_DOCTYPE, name: docname },
        callback: ({ exc, message }) => {
            const $wrap = dialog.fields_dict.attach_html.$wrapper;
            if (exc || !message) { $wrap.html(`<p style="color:#c0392b">${__("Could not load files.")}</p>`); return; }
            items = Array.isArray(message[SS_ATTACH_TABLE_FIELD])
                ? message[SS_ATTACH_TABLE_FIELD].map(r => ({ label: r.label || "", url: r.url || "" }))
                : [];
            _SS_ATTACH_COUNTS.set(docname, items.length);

            _ss_render_attach_dialog($wrap, items, docname);

            // Wire upload button after render
            $wrap.on("click", ".ss-dlg-upload-btn", () => $wrap.find(".ss-dlg-file-input")[0].click());
            $wrap.on("change", ".ss-dlg-file-input", function () {
                Array.from(this.files).forEach(file => {
                    const tempIdx = items.length;
                    items.push({ label: file.name, url: "", _uploading: true });
                    repaint($wrap);

                    _ss_upload_file(
                        file,
                        docname,
                        (result) => {
                            items[tempIdx] = { label: result.file_name || file.name, url: result.file_url };
                            repaint($wrap);
                        },
                        (pct) => {
                            $wrap.find(`.ss-dlg-row[data-idx="${tempIdx}"] .ss-dlg-progress`).css("width", `${pct}%`);
                        },
                    );
                });
                this.value = ""; // reset so same file can be re-selected
            });
        },
    });
}

function _ss_render_attach_dialog($wrap, items, docname) {
    const savedRows = items.filter(r => r.url && !r._uploading);
    const previewHtml = savedRows.length
        ? `<div class="ss-att-preview">
			<div class="ss-att-preview-lbl">${__("Preview")}</div>
			<div class="ss-att-list">${savedRows.map(_ss_preview_item).join("")}</div>
		   </div><hr class="ss-att-divider">`
        : "";

    $wrap.html(`
		<div class="ss-attach-dlg">
			${previewHtml}
			<div class="ss-dlg-upload-area">
				<button class="ss-dlg-upload-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					${__("Upload files")}
				</button>
				<span class="ss-dlg-upload-or">${__("or paste a URL in the table below")}</span>
				<input type="file" class="ss-dlg-file-input" multiple style="display:none">
			</div>
			<div class="ss-dlg-head">
				<div class="ss-dlg-col-label">${__("Label")}</div>
				<div class="ss-dlg-col-url">${__("URL / Path")}</div>
				<div class="ss-dlg-col-act"></div>
			</div>
			<div class="ss-dlg-rows">
				${items.map((r, i) => `
					<div class="ss-dlg-row" data-idx="${i}">
						<input type="text" class="form-control ss-dlg-label" placeholder="${__("e.g. Site Photo")}" value="${frappe.utils.escape_html(r.label)}"${r._uploading ? " disabled" : ""}>
						<div class="ss-dlg-url-wrap">
							<input type="text" class="form-control ss-dlg-url" placeholder="https://..." value="${frappe.utils.escape_html(r.url)}"${r._uploading ? " disabled" : ""}>
							${r._uploading ? `<div class="ss-dlg-progress-bar"><div class="ss-dlg-progress" style="width:0%"></div></div>` : ""}
						</div>
						<button class="ss-dlg-del" title="${__("Remove")}"${r._uploading ? " disabled" : ""}>×</button>
					</div>`).join("")}
			</div>
			<button class="btn btn-xs btn-default ss-dlg-add-link">+ ${__("Add URL manually")}</button>
		</div>`);

    // Delete existing rows
    $wrap.on("click", ".ss-dlg-del", function () {
        const idx = parseInt($(this).closest(".ss-dlg-row").attr("data-idx"), 10);
        items.splice(idx, 1);
        _ss_render_attach_dialog($wrap, items, docname);
    });

    // Add manual URL row
    $wrap.on("click", ".ss-dlg-add-link", () => {
        items.push({ label: "", url: "" });
        _ss_render_attach_dialog($wrap, items, docname);
        $wrap.find(".ss-dlg-row").last().find(".ss-dlg-label").focus();
    });
}

function _ss_preview_item(r) {
    const eu = frappe.utils.escape_html(r.url);
    const el = frappe.utils.escape_html(r.label || r.url);
    const isImg = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);
    if (isImg) return `<a href="${eu}" target="_blank" class="ss-att-thumb-wrap" title="${el}"><img src="${eu}" class="ss-att-thumb" alt="${el}"><span class="ss-att-thumb-lbl">${el}</span></a>`;
    return `<a href="${eu}" target="_blank" class="ss-att-chip" title="${eu}">${_SS_SVG.file}<span>${el}</span></a>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ss_fmt_date(v) {
    if (!v) return "-";
    try {
        const [year, month, day] = String(v).split("-");
        return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year.substring(2)}`;
    } catch { return v; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function ss_inject_styles() {
    const existing = document.getElementById("ss-grid-styles");
    if (existing?.dataset.version === SS_STYLE_VERSION) return;
    existing?.remove();

    const style = Object.assign(document.createElement("style"), { id: "ss-grid-styles" });
    style.dataset.version = SS_STYLE_VERSION;
    style.textContent = `
		[data-doctype="Site Survey"] .result-list,
		[data-doctype="Site Survey"] .list-row-head,
		[data-doctype="Site Survey"] .list-row-container,
		[data-doctype="Site Survey"] .list-row,
		[data-doctype="Site Survey"] .list-headers,
		[data-doctype="Site Survey"] .frappe-list .list-row-head,
		[data-doctype="Site Survey"] .no-result { display:none !important; }

		[data-doctype="Site Survey"] .result,
		[data-doctype="Site Survey"] .frappe-list .result {
			overflow:visible !important; height:auto !important; max-height:none !important;
		}
		[data-doctype="Site Survey"] .frappe-list .result > *,
		[data-doctype="Site Survey"] .list-header-subject,
		[data-doctype="Site Survey"] .checkbox { display:none !important; }

		.ss-grid-host {
			display:block; padding:8px 0 12px;
			overflow:auto; max-height:calc(100vh - 200px);
			position:relative; z-index:0;
		}

		.ss-grid-shell {
			--ss-border:  var(--border-color, #e2e6ea);
			--ss-head-bg: var(--card-bg, #fff);
			--ss-bg-sec:  var(--bg-light-gray, #f7f9fa);
			--ss-text:    var(--text-color, #1f272e);
			--ss-muted:   var(--text-muted, #8d96a0);
			--ss-accent:  #378ADD;
			display:grid; width:max-content; min-width:100%;
			font-size:12px; font-weight:400; color:var(--ss-text);
			border:0.5px solid var(--ss-border); border-radius:12px;
			background:var(--card-bg, #fff);
			overflow:hidden;
		}

		.ss-cell {
			display:flex; align-items:center;
			padding:5px 8px;
			border-right:0.5px solid var(--ss-border);
			border-bottom:0.5px solid var(--ss-border);
			min-height:32px; min-width:0; overflow:hidden;
		}

		.ss-headcell {
			position:sticky; top:0; z-index:10;
			justify-content:center; text-align:center;
			padding:6px 8px; background:var(--ss-head-bg);
			font-size:11px; font-weight:500; color:var(--ss-muted);
			white-space:nowrap;
		}

		.ss-col-resize {
			position:absolute; top:0; right:-3px; width:7px; height:100%;
			cursor:col-resize; z-index:12; user-select:none;
		}
		.ss-col-resize:hover { background:rgba(55,138,221,0.30); }

		.ss-rownum {
			justify-content:center; color:var(--ss-muted);
			font-variant-numeric:tabular-nums;
			background:var(--ss-head-bg);
			position:sticky; left:0; z-index:5;
		}
		.ss-headcell.ss-rownum { z-index:11; }

		.ss-row-del {
			display:none; border:none; background:none; cursor:pointer;
			color:var(--text-danger,#c0392b); font-size:16px; line-height:1;
			padding:0; width:100%; text-align:center;
			opacity:0; transition:opacity 0.15s;
		}
		.ss-rownum:hover .ss-rownum-text { display:none; }
		.ss-rownum:hover .ss-row-del     { display:block; opacity:1; }

		.ss-cell.ss-row-hover,
		.ss-rownum.ss-row-hover    { background:var(--ss-bg-sec); }
		.ss-cell.ss-row--editing   { background:var(--ss-bg-sec); }
		.ss-rownum.ss-row--editing { background:var(--ss-bg-sec); border-left:2px solid #378ADD; }

		.ss-input {
			width:100%; min-width:0;
			border:0.5px solid transparent; background:transparent;
			padding:3px 6px; font-size:12px; font-weight:400; border-radius:8px;
			color:var(--ss-text);
			transition:border-color .12s, background .12s;
			box-sizing:border-box; font-family:inherit;
			text-align:center; text-overflow:ellipsis;
		}
		.ss-input:hover { border-color:var(--ss-border); }
		.ss-input:focus {
			border-color:#378ADD; background:var(--card-bg,#fff);
			outline:1.5px solid #378ADD; outline-offset:-1px;
		}

		.ss-cell-display {
			width:100%; min-width:0; text-align:center;
			white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
			padding:4px 6px; border:0.5px solid transparent; border-radius:8px;
			cursor:text; color:var(--ss-text); font-size:12px; font-weight:400;
		}
		.ss-cell-display:hover { border-color:var(--ss-border); }
		.ss-cell-display:focus { outline:1.5px solid #378ADD; outline-offset:-1px; border-color:#378ADD; }
		.ss-cell-ph            { color:var(--ss-muted); opacity:0.55; }
		.ss-cell-input--inline { text-align:center; }

		.ss-select {
			width:auto; max-width:100%;
			font-size:12px; cursor:pointer; appearance:none;
			background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238d96a0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
			background-repeat:no-repeat; background-position:right 6px center; padding-right:18px;
		}

		.ss-area {
			resize:none; overflow:hidden; line-height:1.4;
			min-height:28px; white-space:pre-wrap; font-size:12px; font-weight:400;
		}
		.ss-cell:has(.ss-area) { align-items:flex-start; overflow:visible; }

		.ss-number-input { text-align:right; }
		.ss-number-input::-webkit-outer-spin-button,
		.ss-number-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
		.ss-number-input[type=number] { -moz-appearance:textfield; }

		.ss-cell-date {
			padding:5px 8px; color:var(--ss-muted);
			white-space:nowrap; font-variant-numeric:tabular-nums;
			font-size:11px; font-weight:400;
		}

		.ss-avatar-wrap { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }
		.ss-avatar {
			width:22px; height:22px; border-radius:50%;
			background:hsl(var(--h,210),58%,52%);
			color:#fff; font-weight:500; font-size:10px;
			display:flex; align-items:center; justify-content:center;
			flex-shrink:0; cursor:text; user-select:none;
		}
		.ss-avatar-input {
			position:absolute; inset:0; opacity:0; cursor:pointer; border-radius:50%;
		}
		.ss-avatar-input:focus {
			opacity:1; outline:1.5px solid #378ADD; outline-offset:-1px;
			background:var(--card-bg,#fff);
		}
		.ss-avatar-wrap:focus-within .ss-avatar { opacity:0; }

		.ss-map-cell    { display:flex; align-items:center; gap:4px; width:100%; overflow:hidden; }
		.ss-map-display { flex:1; color:var(--ss-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 2px; font-size:12px; }
		.ss-muted       { color:var(--ss-muted); font-style:italic; }
		.ss-map-input   { flex:1; min-width:0; }

		.ss-icon-btn {
			flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
			width:26px; height:26px; border:0.5px solid transparent; border-radius:8px;
			background:transparent; cursor:pointer; color:var(--ss-muted);
			transition:background .12s, border-color .12s, color .12s; text-decoration:none;
		}
		.ss-icon-btn:hover        { background:var(--ss-bg-sec); border-color:var(--ss-border); color:var(--ss-text); }
		.ss-icon-btn--disabled    { opacity:0.3; cursor:default; pointer-events:none; }
		.ss-map-open:hover        { color:#378ADD; }

		.ss-attach-btn   { position:relative; }
		.ss-attach-badge {
			position:absolute; top:-4px; right:-5px;
			min-width:14px; height:14px; padding:0 3px;
			background:#378ADD; color:#fff;
			font-size:9px; font-weight:500; line-height:14px;
			border-radius:7px; pointer-events:none;
		}

		.ss-ac-menu {
			position:absolute; z-index:2000;
			background:var(--card-bg,#fff);
			border:0.5px solid var(--ss-border,#e2e6ea);
			border-radius:12px; box-shadow:0 6px 24px rgba(0,0,0,0.12);
			max-height:260px; overflow-y:auto; padding:4px;
			font-size:12px; font-weight:400; color:var(--ss-text,#1f272e);
		}
		.ss-ac-item { display:flex; flex-direction:column; gap:1px; padding:6px 10px; border-radius:8px; cursor:pointer; }
		.ss-ac-item:hover   { background:var(--ss-bg-sec,#f4f5f6); }
		.ss-ac-primary      { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
		.ss-ac-sub          { font-size:11px; font-weight:400; color:var(--ss-muted,#8d96a0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

		.ss-toolbar    { display:flex; align-items:center; padding:9px 12px; }
		.ss-add-row-btn { display:inline-flex; align-items:center; gap:6px; }
		.ss-add-icon   { font-size:14px; line-height:1; font-weight:500; }

		.ss-empty {
			padding:40px 20px; text-align:center; color:var(--ss-muted);
			position:sticky; left:0; width:100%; font-size:12px;
		}

		/* ── File upload dialog ── */
		.ss-dlg-upload-area {
			display:flex; align-items:center; gap:12px;
			padding:12px; margin-bottom:12px;
			background:var(--bg-light-gray,#f7f9fa);
			border:0.5px dashed var(--border-color,#e2e6ea);
			border-radius:8px;
		}
		.ss-dlg-upload-btn {
			display:inline-flex; align-items:center; gap:6px;
			padding:6px 14px; border-radius:8px;
			border:0.5px solid #378ADD; background:#fff;
			color:#378ADD; font-size:12px; font-weight:500;
			cursor:pointer; white-space:nowrap;
			transition:background .12s;
		}
		.ss-dlg-upload-btn:hover { background:#f0f7ff; }
		.ss-dlg-upload-or { font-size:11px; color:var(--text-muted,#8d96a0); }
		.ss-dlg-url-wrap  { flex:1; display:flex; flex-direction:column; gap:3px; }
		.ss-dlg-progress-bar { height:3px; background:#e2e6ea; border-radius:2px; overflow:hidden; }
		.ss-dlg-progress     { height:100%; background:#378ADD; border-radius:2px; transition:width .15s; }
		.ss-dlg-head { display:flex; gap:8px; align-items:center; margin-bottom:4px; font-size:11px; text-transform:uppercase; color:#8d96a0; letter-spacing:.04em; }
		.ss-dlg-col-label { flex:0 0 160px; }
		.ss-dlg-col-url   { flex:1 1 auto; }
		.ss-dlg-col-act   { flex:0 0 32px; }
		.ss-dlg-row { display:flex; gap:8px; align-items:flex-start; margin-bottom:6px; }
		.ss-dlg-row .ss-dlg-label { flex:0 0 160px; }
		.ss-dlg-del { flex:0 0 32px; text-align:center; cursor:pointer; color:#c0392b; background:none; border:none; font-size:16px; padding-top:4px; }
		.ss-dlg-del:disabled { opacity:.35; cursor:default; }
		.ss-dlg-add-link { margin-top:4px; }
		.ss-att-preview { margin-bottom:12px; }
		.ss-att-preview-lbl { font-size:11px; text-transform:uppercase; color:#8d96a0; letter-spacing:.04em; margin-bottom:8px; }
		.ss-att-list { display:flex; flex-wrap:wrap; gap:10px; }
		.ss-att-thumb-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; text-decoration:none; color:inherit; max-width:90px; }
		.ss-att-thumb { width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid #e2e6ea; }
		.ss-att-thumb:hover { opacity:.85; }
		.ss-att-thumb-lbl { font-size:10.5px; color:#8d96a0; text-align:center; width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
		.ss-att-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:6px; border:1px solid #e2e6ea; background:#f7f9fa; text-decoration:none; color:#1f272e; font-size:12px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
		.ss-att-chip:hover { background:#eef2f5; border-color:#c8d0d8; }
		.ss-att-divider { border:none; border-top:1px solid #e2e6ea; margin:12px 0; }

		/* ── Measurements dialog ── */
		.ss-mto-dialog { display:flex; flex-direction:column; gap:0; }
		.ss-mto-head {
			display:grid; grid-template-columns:1fr 120px 90px 32px;
			gap:8px; padding:0 0 6px;
			font-size:11px; text-transform:uppercase; color:#8d96a0; letter-spacing:.04em;
		}
		.ss-mto-row {
			display:grid; grid-template-columns:1fr 120px 90px 32px;
			gap:8px; align-items:center; margin-bottom:6px;
		}
		.ss-mto-value { text-align:right; }
		.ss-mto-del   { width:32px; text-align:center; cursor:pointer; color:#c0392b; background:none; border:none; font-size:16px; }
		.ss-mto-add   { margin-top:4px; align-self:flex-start; }

		/* Drawing button — accent when drawing exists */
		.ss-draw-btn--has { color:#378ADD; }
		.ss-draw-btn--has:hover { color:#378ADD; }

		/* Drawing dialog */
		.ss-draw-dialog { display:flex; flex-direction:column; gap:0; }

		.ss-draw-toolbar {
			display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;
			padding:8px 12px; background:var(--bg-light-gray,#f7f9fa);
			border-bottom:0.5px solid var(--border-color,#e2e6ea);
			border-radius:12px 12px 0 0;
		}
		.ss-draw-tools { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
		.ss-draw-sep   { width:1px; height:22px; background:var(--border-color,#e2e6ea); margin:0 2px; }

		.ss-draw-tool {
			display:inline-flex; align-items:center; justify-content:center;
			width:30px; height:30px; border-radius:7px;
			border:0.5px solid transparent; background:transparent;
			cursor:pointer; color:var(--text-muted,#8d96a0);
			transition:background .12s, border-color .12s, color .12s;
		}
		.ss-draw-tool:hover   { background:var(--card-bg,#fff); border-color:var(--border-color,#e2e6ea); color:var(--text-color,#1f272e); }
		.ss-draw-tool--active { background:var(--card-bg,#fff); border-color:#378ADD; box-shadow:0 0 0 1.5px #378ADD; color:#378ADD; }
		.ss-draw-color-btn    { padding:4px; }
		.ss-draw-color-active { border-color:#333 !important; box-shadow:0 0 0 1.5px #333 !important; }
		.ss-draw-swatch       { display:block; width:15px; height:15px; border-radius:50%; }

		.ss-draw-unit {
			height:30px; padding:2px 8px; border-radius:7px;
			border:0.5px solid var(--border-color,#e2e6ea);
			background:var(--card-bg,#fff); cursor:pointer;
			font-size:12px; font-weight:500; color:var(--text-color,#1f272e);
		}
		.ss-draw-unit:focus { outline:1.5px solid #378ADD; outline-offset:-1px; }

		.ss-draw-undo-btn {
			display:inline-flex; align-items:center;
			padding:4px 10px; border-radius:7px;
			border:0.5px solid var(--border-color,#e2e6ea);
			background:var(--card-bg,#fff); cursor:pointer;
			font-size:11px; color:var(--text-muted,#8d96a0);
			transition:background .12s, color .12s;
		}
		.ss-draw-undo-btn:hover { color:var(--text-color,#1f272e); background:#f0f0f0; }

		.ss-draw-clear-btn {
			display:inline-flex; align-items:center; gap:5px;
			padding:5px 12px; border-radius:7px;
			border:0.5px solid var(--border-color,#e2e6ea);
			background:var(--card-bg,#fff); cursor:pointer;
			font-size:12px; color:var(--text-muted,#8d96a0);
			transition:background .12s, color .12s, border-color .12s;
		}
		.ss-draw-clear-btn:hover { color:var(--text-danger,#c0392b); border-color:var(--text-danger,#c0392b); background:#fff5f5; }

		.ss-draw-canvas-wrap {
			background:#ffffff; border-radius:0 0 12px 12px;
			overflow:hidden; line-height:0; position:relative;
		}
		/* No width:100% — explicit px size set via JS to prevent pointer offset */
		.ss-draw-canvas { display:block; touch-action:none; border-radius:0 0 12px 12px; cursor:crosshair; }

		@media (max-width:1280px) {
			.ss-grid-shell { font-size:11px; }
			.ss-cell        { padding:4px 6px; min-height:28px; }
			.ss-headcell    { padding:5px 6px; font-size:10px; }
			.ss-input, .ss-cell-display, .ss-area, .ss-cell-date { font-size:11px; }
			.ss-avatar      { width:20px; height:20px; font-size:9px; }
			.ss-select      { font-size:11px; }
			.ss-icon-btn    { width:22px; height:22px; }
		}
	`;
    document.head.appendChild(style);
}