// Site Survey — Custom Spreadsheet Grid
// Mirrors the CRM Log / Contacts grid UX (single-click row edit, double-click form nav).
// ─────────────────────────────────────────────────────────────────────────────

const SS_COLUMNS = [
	{ field: "status",          label: "Status",       type: "select",  width: 130, options: ["Draft", "Scheduled", "In Progress", "Completed", "Cancelled"] },
	{ field: "survey_date",     label: "Date",         type: "date",    width: 110 },
	{ field: "assigned_to",     label: "Surveyor",     type: "avatar",  width: 60  },
	{ field: "customer",        label: "Customer",     type: "link",    width: 150, link_doctype: "Customer",  link_namefield: "customer_name" },
	{ field: "lead",            label: "Lead",         type: "link",    width: 150, link_doctype: "Lead",      link_namefield: "lead_name"     },
	{ field: "contact",         label: "Contact",      type: "link",    width: 150, link_doctype: "Contact",   link_namefield: "first_name"    },
	{ field: "site_location",   label: "Site Location",type: "text",    width: 160 },
	{ field: "google_maps_url", label: "Maps",         type: "maps",    width: 120 },
	{ field: "site_type",       label: "Site Type",    type: "select",  width: 120, options: ["", "Residential", "Commercial", "Industrial"] },
	{ field: "roof_type",       label: "Roof Type",    type: "select",  width: 110, options: ["", "Flat", "Pitched", "Mixed", "N/A"] },
	{ field: "site_area",       label: "Area (m²)",    type: "number",  width: 100 },
	{ field: "notes",           label: "Notes",        type: "area",    width: 260 },
	{ field: "updates",         label: "Updates",      type: "area",    width: 260 },
	{ field: "attachments",     label: "Files",        type: "attach",  width: 52  },
	{ field: "drawing",         label: "Drawing",      type: "drawing", width: 52  },
	{ field: "measurements",    label: "MTO",          type: "measure", width: 52  },
];

const SS_DOCTYPE             = "Site Survey";
const SS_ATTACH_DOCTYPE      = "Site Survey Attachment";
const SS_ATTACH_TABLE_FIELD  = "attachments";
const SS_MEASURE_DOCTYPE     = "Site Survey Measurement";
const SS_MEASURE_TABLE_FIELD = "measurements";
const SS_COL_WIDTH_KEY       = "ss_col_widths";
const SS_STYLE_VERSION       = "v4";

const SS_FIELDS = [
	...SS_COLUMNS.filter(c => !["attachments","drawing","measurements"].includes(c.field)).map(c => c.field),
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

const ss_stored_col_width  = (field) => typeof SS_COL_WIDTHS[field] === "number" ? SS_COL_WIDTHS[field] : null;
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
	if (typeof listview.setup_auto_refresh === "function") listview.setup_auto_refresh = () => {};
	try { frappe.realtime.off("list_update"); } catch { /* noop */ }
	if (listview.on_doctype_update) listview.on_doctype_update = () => {};
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

let _SS_EDITING_ROW      = null;
let _SS_CURRENT_LISTVIEW = null;

function ss_render_grid(listview) {
	_SS_EDITING_ROW      = null;
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

	const data  = listview.data || [];
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
	const raw  = doc[col.field];
	const name = doc.name;
	switch (col.type) {
		case "select":  return _ss_render_select(col, name, raw);
		case "avatar":  return _ss_render_avatar(col, name, raw);
		case "date":    return _ss_render_date(raw);
		case "maps":    return _ss_render_maps(col, name, raw);
		case "area":    return _ss_render_area(col, name, raw);
		case "attach":  return _ss_render_attach(name, raw);
		case "number":  return _ss_render_number(col, name, raw);
		case "link":    return _ss_render_link(col, name, raw);
		case "drawing": return _ss_render_drawing(name, doc);
		case "measure": return _ss_render_measure(name, doc);
		default:        return _ss_render_text(col, name, raw);
	}
}

function _ss_render_select(col, name, raw) {
	const hasValue = col.options.includes(raw);
	const blank = hasValue ? "" : `<option value="" selected></option>`;
	const opts  = col.options.map(o =>
		`<option value="${o}"${o === raw ? " selected" : ""}>${o ? __(o) : ""}</option>`
	).join("");
	return `<select class="ss-input ss-select" data-name="${name}" data-field="${col.field}">${blank}${opts}</select>`;
}

// Link-name resolution cache shared across all link-type fields
const _SS_LINK_NAMES   = new Map();
const _SS_LINK_PENDING = new Set();

const SS_LINK_FIELDS = {
	assigned_to: { doctype: "User",     namefield: "full_name",      searchfield: "full_name"     },
	customer:    { doctype: "Customer", namefield: "customer_name",   searchfield: "customer_name" },
	lead:        { doctype: "Lead",     namefield: "lead_name",       searchfield: "lead_name"     },
	contact:     { doctype: "Contact",  namefield: "first_name",      searchfield: "first_name"    },
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
	const display     = raw ? (_ss_resolve_name(col.field, raw) || raw) : "";
	const initial     = display ? display.charAt(0).toUpperCase() : "?";
	const hue         = display ? [...display].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
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
	const val     = frappe.utils.escape_html(display);
	const ph      = `<span class="ss-cell-ph">${__(col.label)}</span>`;
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
	const val     = frappe.utils.escape_html(raw || "");
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
	map:  `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
	pen:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
	clip: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
	file: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

function _ss_render_maps(col, name, raw) {
	const escaped = frappe.utils.escape_html(raw || "");
	const mapBtn  = raw
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

// ─── Drawing dialog ───────────────────────────────────────────────────────────

function ss_open_drawing_dialog(listview, docname) {
	// Fetch the heavy drawing data only on open, not during list load
	frappe.db.get_value(SS_DOCTYPE, docname, "drawing", (r) => {
		_ss_show_drawing_dialog(listview, docname, r?.drawing || "");
	});
}

function _ss_show_drawing_dialog(listview, docname, existingData) {
	const dialog = new frappe.ui.Dialog({
		title: __("Drawing — {0}", [docname]),
		size: "large",
		fields: [{ fieldname: "draw_wrap", fieldtype: "HTML" }],
		primary_action_label: __("Save"),
		primary_action() {
			// Flatten to JPEG for smaller storage
			const flat = document.createElement("canvas");
			flat.width  = canvas.width;
			flat.height = canvas.height;
			const fctx = flat.getContext("2d");
			fctx.fillStyle = "#ffffff";
			fctx.fillRect(0, 0, flat.width, flat.height);
			fctx.drawImage(canvas, 0, 0);
			const dataUrl = flat.toDataURL("image/jpeg", 0.85);

			// Save both fields in one call via full-doc save
			frappe.call({
				method: "frappe.client.set_value",
				args: { doctype: SS_DOCTYPE, name: docname, fieldname: "drawing", value: dataUrl },
				callback: ({ exc }) => {
					if (exc) return;
					frappe.call({
						method: "frappe.client.set_value",
						args: { doctype: SS_DOCTYPE, name: docname, fieldname: "has_drawing", value: 1 },
						callback: () => {
							frappe.show_alert({ message: __("Drawing saved"), indicator: "green" }, 1.0);
							const row = (listview.data || []).find(d => d.name === docname);
							if (row) row.has_drawing = 1;
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
	$wrap.html(`
		<div class="ss-draw-dialog">
			<div class="ss-draw-toolbar">
				<div class="ss-draw-tools">
					<button class="ss-draw-tool ss-draw-color-btn ss-draw-tool--active" data-tool="pen" data-color="#1f272e" title="Black">
						<span class="ss-draw-swatch" style="background:#1f272e"></span>
					</button>
					<button class="ss-draw-tool ss-draw-color-btn" data-tool="pen" data-color="#378ADD" title="Blue">
						<span class="ss-draw-swatch" style="background:#378ADD"></span>
					</button>
					<div class="ss-draw-sep"></div>
					<button class="ss-draw-tool ss-draw-eraser-btn" data-tool="eraser" title="Eraser">
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M20 20H7L3 16l11-11 6 6-4.5 4.5"/><path d="M6.5 17.5l4-4"/>
						</svg>
					</button>
				</div>
				<button class="ss-draw-clear-btn" title="Clear canvas">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
					</svg>
					Clear
				</button>
			</div>
			<div class="ss-draw-canvas-wrap">
				<canvas class="ss-draw-canvas"></canvas>
			</div>
		</div>`);

	// Size canvas to fit the dialog body
	const canvas  = $wrap.find(".ss-draw-canvas")[0];
	const wrapEl  = $wrap.find(".ss-draw-canvas-wrap")[0];
	const W       = Math.max(wrapEl.offsetWidth || 660, 400);
	const H       = Math.round(W * 0.56); // 16:9-ish
	canvas.width  = W;
	canvas.height = H;

	const ctx = canvas.getContext("2d");

	// White background
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, W, H);

	// Load existing drawing
	if (existingData) {
		const img = new Image();
		img.onload = () => ctx.drawImage(img, 0, 0, W, H);
		img.src    = existingData;
	}

	// ── Drawing state ──
	let drawing = false;
	let tool    = "pen";
	let color   = "#1f272e";
	let lx = 0, ly = 0;

	const PEN_SIZE    = 3;
	const ERASER_SIZE = 28;

	ctx.lineCap  = "round";
	ctx.lineJoin = "round";

	const canvasPos = (e) => {
		const rect = canvas.getBoundingClientRect();
		const src  = e.touches ? e.touches[0] : e;
		return { x: src.clientX - rect.left, y: src.clientY - rect.top };
	};

	const startDraw = (e) => {
		e.preventDefault();
		drawing     = true;
		const { x, y } = canvasPos(e);
		lx = x; ly = y;
		ctx.beginPath();
		ctx.arc(x, y, (tool === "eraser" ? ERASER_SIZE : PEN_SIZE) / 2, 0, Math.PI * 2);
		ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
		ctx.fill();
	};

	const draw = (e) => {
		e.preventDefault();
		if (!drawing) return;
		const { x, y } = canvasPos(e);
		ctx.beginPath();
		ctx.moveTo(lx, ly);
		ctx.lineTo(x, y);
		ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
		ctx.lineWidth   = tool === "eraser" ? ERASER_SIZE : PEN_SIZE;
		ctx.stroke();
		lx = x; ly = y;
	};

	const stopDraw = () => { drawing = false; };

	canvas.addEventListener("mousedown",  startDraw);
	canvas.addEventListener("mousemove",  draw);
	canvas.addEventListener("mouseup",    stopDraw);
	canvas.addEventListener("mouseleave", stopDraw);
	canvas.addEventListener("touchstart", startDraw, { passive: false });
	canvas.addEventListener("touchmove",  draw,      { passive: false });
	canvas.addEventListener("touchend",   stopDraw);

	// ── Toolbar interactions ──
	const $toolbar = $wrap.find(".ss-draw-toolbar");

	$toolbar.on("click", ".ss-draw-tool", function () {
		const $btn = $(this);
		tool = $btn.attr("data-tool");
		if (tool === "pen") color = $btn.attr("data-color");
		$toolbar.find(".ss-draw-tool").removeClass("ss-draw-tool--active");
		$btn.addClass("ss-draw-tool--active");
		canvas.style.cursor = tool === "eraser" ? "cell" : "crosshair";
	});

	$toolbar.on("click", ".ss-draw-clear-btn", () => {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, W, H);
	});

	canvas.style.cursor = "crosshair";
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
	$shell.on("change.ss", ".ss-select",                                    handle_update);
	$shell.on("blur.ss",   ".ss-input:not(.ss-select):not([data-inline])",  handle_update);
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
		const $el      = $(this);
		const docname  = $el.attr("data-name");
		const fieldname = $el.attr("data-field");
		const val      = ($el.val() || "").trim();
		if (!docname || !fieldname) return;
		if ($el.data("last-saved-val") === val) return;
		ss_fast_save(listview, docname, fieldname, val, $el);
	};
}

function _ss_bind_click_to_edit($shell, listview, handle_update) {
	const activate = ($span, typedChar) => {
		if ($span.data("editing")) return;
		$span.data("editing", true);

		const docname   = $span.attr("data-name");
		const fieldname = $span.attr("data-field");
		const type      = $span.attr("data-type") || "text";
		const current   = $span.attr("title") || "";
		const linkDt    = $span.attr("data-link") || null;

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
			if (e.key === "Enter")  { e.preventDefault(); $input.trigger("blur"); }
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
		User:     { doctype: "User",     fields: ["name","full_name","email"],         searchfield: "full_name",     primary: "full_name",    sub: "email",         id: "name" },
		Customer: { doctype: "Customer", fields: ["name","customer_name"],             searchfield: "customer_name", primary: "customer_name", sub: "",             id: "name" },
		Lead:     { doctype: "Lead",     fields: ["name","lead_name","company_name"],  searchfield: "lead_name",     primary: "lead_name",     sub: "company_name", id: "name" },
		Contact:  { doctype: "Contact",  fields: ["name","first_name","last_name","company_name"], searchfield: "first_name", primary: "first_name", sub: "company_name", id: "name" },
	};

	const positionMenu = ($input) => {
		const rect = $input[0].getBoundingClientRect();
		$menu.css({ top: `${rect.bottom + window.scrollY}px`, left: `${rect.left + window.scrollX}px`, width: `${Math.max(rect.width, 220)}px` });
	};

	const renderMenu = ($input, results) => {
		if (!$menu) $menu = $(`<div class="ss-ac-menu"></div>`).appendTo(document.body);
		const items = results.map(r => {
			const primary = frappe.utils.escape_html(r.primary);
			const sub     = r.sub ? `<span class="ss-ac-sub">${frappe.utils.escape_html(r.sub)}</span>` : "";
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
					const id      = row[cfg.id] || row.name;
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
		const id     = $(this).attr("data-id");
		const name   = $(this).attr("data-value");
		const cfg    = linkConfig[$input.attr("data-link")];
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
		const $cell    = $(this).closest(".ss-map-cell");
		const $input   = $cell.find(".ss-map-input");
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
		const field   = $(this).attr("data-field");
		const startX  = e.pageX;
		const startW  = $shell.find(`.ss-headcell[data-field="${field}"]`).outerWidth();
		const colIdx  = SS_COLUMNS.findIndex(c => c.field === field) + 1;
		$("body").css("user-select", "none");
		const onMove = (ev) => {
			const newW   = Math.max(48, startW + (ev.pageX - startX));
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
				const unit  = $(this).find(".ss-mto-unit").val();
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

	const $rows   = $wrap.find(".ss-mto-rows");
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
				const idx   = parseInt($(this).attr("data-idx"), 10);
				const label = $(this).find(".ss-dlg-label").val().trim();
				const url   = $(this).find(".ss-dlg-url").val().trim();
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
			display:flex; align-items:center; justify-content:space-between;
			padding:10px 12px; background:var(--bg-light-gray,#f7f9fa);
			border-bottom:0.5px solid var(--border-color,#e2e6ea);
			border-radius:12px 12px 0 0;
		}
		.ss-draw-tools { display:flex; align-items:center; gap:6px; }
		.ss-draw-sep   { width:1px; height:22px; background:var(--border-color,#e2e6ea); margin:0 4px; }

		.ss-draw-tool {
			display:inline-flex; align-items:center; justify-content:center;
			width:32px; height:32px; border-radius:8px;
			border:0.5px solid transparent; background:transparent;
			cursor:pointer; color:var(--text-muted,#8d96a0);
			transition:background .12s, border-color .12s, color .12s;
		}
		.ss-draw-tool:hover         { background:var(--card-bg,#fff); border-color:var(--border-color,#e2e6ea); color:var(--text-color,#1f272e); }
		.ss-draw-tool--active       { background:var(--card-bg,#fff); border-color:#378ADD; box-shadow:0 0 0 1px #378ADD; }
		.ss-draw-color-btn          { padding:4px; }
		.ss-draw-swatch             { display:block; width:16px; height:16px; border-radius:50%; }

		.ss-draw-clear-btn {
			display:inline-flex; align-items:center; gap:5px;
			padding:5px 12px; border-radius:8px;
			border:0.5px solid var(--border-color,#e2e6ea);
			background:var(--card-bg,#fff); cursor:pointer;
			font-size:12px; font-weight:400; color:var(--text-muted,#8d96a0);
			transition:background .12s, color .12s, border-color .12s;
		}
		.ss-draw-clear-btn:hover { color:var(--text-danger,#c0392b); border-color:var(--text-danger,#c0392b); background:#fff5f5; }

		.ss-draw-canvas-wrap {
			background:#ffffff;
			border-radius:0 0 12px 12px;
			overflow:hidden;
			line-height:0;
		}
		.ss-draw-canvas {
			display:block; width:100%; touch-action:none;
			border-radius:0 0 12px 12px;
		}

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
