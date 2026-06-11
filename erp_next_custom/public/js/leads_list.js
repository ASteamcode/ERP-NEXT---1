// leads_list.js
// Custom spreadsheet-style list view for the "Lead" doctype.
// Mirrors contacts_list.js architecture: CSS Grid, row numbers, inline editing,
// column resize, typeahead for link fields.

"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAD_DOCTYPE = "Lead";

const LEAD_STATUS_OPTIONS = [
	"", "Open", "Replied", "Opportunity", "Interest",
	"Do Not Contact", "Converted",
];

const LEAD_TYPE_OPTIONS = [
	"", "Client", "Channel Partner", "Consultant",
];

const LEAD_COLS = [
	{ field: "status",       label: "Status",    type: "select", width: 130, options: LEAD_STATUS_OPTIONS },
	{ field: "lead_name",    label: "Full Name", type: "text",   width: 160 },
	{ field: "company_name", label: "Company",   type: "text",   width: 160 },
	{ field: "email_id",     label: "Email",     type: "email",  width: 190 },
	{ field: "mobile_no",    label: "Mobile",    type: "tel",    width: 130 },
	{ field: "phone",        label: "Phone",     type: "tel",    width: 120 },
	{ field: "website",      label: "Website",   type: "url",    width: 170 },
	{ field: "type",         label: "Type",      type: "select", width: 130, options: LEAD_TYPE_OPTIONS },
	{ field: "lead_owner",   label: "Owner",     type: "link",   width: 150, link_doctype: "User" },
	{ field: "territory",    label: "Territory", type: "link",   width: 130, link_doctype: "Territory" },
];

const _LEAD_COL_WIDTHS = {};
let _LEAD_SAVING       = false;
let _LEAD_EDITING_ROW  = null;

// ─── Frappe List View Entry Point ─────────────────────────────────────────────
frappe.provide("frappe.listview_settings.Lead");

frappe.listview_settings.Lead = {
	add_fields: [
		"status", "lead_name", "company_name", "email_id",
		"mobile_no", "phone", "website", "type", "lead_owner", "territory",
	],

	onload(listview) {
		listview.__leads_init_done = false;
		_leads_bootstrap(listview);
		_leads_suppress_refresh(listview);
	},

	refresh(listview) {
		if (!listview.__leads_init_done) listview.__leads_init_done = true;
		_leads_render(listview);
	},
};

// ─── Suppress Native Refresh ──────────────────────────────────────────────────
function _leads_suppress_refresh(listview) {
	if (listview.auto_refresh) {
		try { clearInterval(listview.auto_refresh); } catch { /* noop */ }
		listview.auto_refresh = null;
	}
	if (typeof listview.setup_auto_refresh === "function") listview.setup_auto_refresh = () => {};
	try { frappe.realtime.off("list_update"); } catch { /* noop */ }
	if (listview.on_doctype_update) listview.on_doctype_update = () => {};
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
function _leads_bootstrap(listview) {
	if (!document.getElementById("leads-grid-style")) {
		const style = document.createElement("style");
		style.id    = "leads-grid-style";
		style.textContent = _leads_css();
		document.head.appendChild(style);
	}

	const $result = listview.$result || listview.$page.find(".list-result");
	if (!$result.length) return;

	$result.empty();
	const host = document.createElement("div");
	host.className = "leads-grid-host";
	$result.append(host);

	listview.__leads_host = host;
	listview.$page.find(".list-filters-area").hide();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _leads_hide_native(listview) {
	const $result = listview.$result;
	if ($result) $result.find(".result-list, .list-row-head, .list-row-container, .list-row, .no-result").hide();
	listview.$page.find(".list-row-head, .list-headers").hide();
}

function _leads_render(listview) {
	const host = listview.__leads_host;
	if (!host) return;
	_leads_hide_native(listview);
	_leads_paint(listview, host, listview.data || []);
}

// ─── Paint ────────────────────────────────────────────────────────────────────
function _leads_paint(listview, host, rows) {
	_LEAD_EDITING_ROW = null;
	const cols         = LEAD_COLS;
	const gridTemplate = ["42px", ...cols.map(c => `${_LEAD_COL_WIDTHS[c.field] || c.width}px`)].join(" ");

	// Toolbar
	const toolbar = document.createElement("div");
	toolbar.className = "lg-toolbar";
	toolbar.innerHTML =
		`<button class="btn btn-default btn-sm lg-add-row-btn">` +
		`<span class="lg-add-icon">+</span> ${__("Add Lead")}` +
		`</button>`;

	// Grid HTML
	const html = [];

	// Header — rownum + column headers
	html.push(`<div class="lg-cell lg-header-cell lg-rownum-cell">#</div>`);
	cols.forEach((col, ci) => {
		html.push(
			`<div class="lg-cell lg-header-cell" data-col="${ci}" data-field="${col.field}">` +
			`<span>${__(col.label)}</span>` +
			`<div class="lg-resize-handle" data-col="${ci}"></div>` +
			`</div>`
		);
	});

	if (!rows.length) {
		html.push(`<div class="lg-empty-row" style="grid-column:1/${cols.length + 2}">${__("No leads found")}</div>`);
	}

	rows.forEach((doc, ri) => {
		html.push(`<div class="lg-cell lg-rownum-cell" data-name="${doc.name}">${ri + 1}</div>`);
		cols.forEach((col, ci) => {
			const raw = doc[col.field];
			html.push(
				`<div class="lg-cell" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}">` +
				_lead_render_cell(col, doc, raw) +
				`</div>`
			);
		});
	});

	const grid = document.createElement("div");
	grid.className = "leads-grid";
	grid.style.gridTemplateColumns = gridTemplate;
	grid.innerHTML = html.join("");

	host.innerHTML = "";
	host.appendChild(toolbar);
	host.appendChild(grid);

	_lead_bind_events(listview, host, rows, cols);
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────
function _lead_render_cell(col, doc, raw) {
	switch (col.type) {
		case "select": return _lead_render_select(col, doc.name, raw);
		case "url":    return _lead_render_url(col, doc.name, raw);
		case "email":  return _lead_render_text(col, doc.name, raw, "email");
		case "tel":    return _lead_render_text(col, doc.name, raw, "tel");
		case "link":   return _lead_render_link(col, doc.name, raw);
		default:       return _lead_render_text(col, doc.name, raw, "text");
	}
}

function _lead_render_select(col, name, raw) {
	const opts = col.options.map(o =>
		`<option value="${frappe.utils.escape_html(o)}"${o === raw ? " selected" : ""}>${__(o) || "&nbsp;"}</option>`
	).join("");
	return `<select class="lg-cell-select" data-name="${name}" data-field="${col.field}">${opts}</select>`;
}

function _lead_render_text(col, name, raw, inputType) {
	const val     = frappe.utils.escape_html(raw || "");
	const display = raw ? val : `<span class="lg-cell-ph">${__(col.label)}</span>`;
	return (
		`<span class="lg-cell-display" data-name="${name}" data-field="${col.field}" ` +
		`data-type="${inputType}" tabindex="0" title="${val}">${display}</span>`
	);
}

function _lead_render_url(col, name, raw) {
	const val = frappe.utils.escape_html(raw || "");
	if (raw) {
		return `<span class="lg-cell-display lg-url-display" data-name="${name}" data-field="${col.field}" tabindex="0" title="${val}">${val}</span>`;
	}
	return `<span class="lg-cell-display" data-name="${name}" data-field="${col.field}" data-type="url" tabindex="0"><span class="lg-cell-ph">${__(col.label)}</span></span>`;
}

function _lead_render_link(col, name, raw) {
	const val     = frappe.utils.escape_html(raw || "");
	const display = raw ? val : `<span class="lg-cell-ph">${__(col.label)}</span>`;
	return (
		`<span class="lg-cell-display lg-link-display" ` +
		`data-name="${name}" data-field="${col.field}" data-type="link" ` +
		`data-link-doctype="${col.link_doctype || ""}" ` +
		`tabindex="0" title="${val}">${display}</span>`
	);
}

// ─── Event Binding ────────────────────────────────────────────────────────────
function _lead_bind_events(listview, host, rows, cols) {
	const $host = $(host);
	const $grid = $host.find(".leads-grid");

	_lead_bind_col_resize($grid, cols);
	_lead_bind_inline_edit($grid, listview, rows);
	_lead_bind_select_change($grid, listview, rows);
	_lead_bind_url_click($grid);
	_lead_bind_link_edit($grid, listview, rows);
	_lead_bind_add_row($host, listview);

	$(document).off("mousedown.lgrow").on("mousedown.lgrow", function (e) {
		if (!$(e.target).closest(".leads-grid").length) _lead_clear_editing_row($grid);
	});
}

// ── Row editing state ─────────────────────────────────────────────────────────
function _lead_set_editing_row($grid, name) {
	if (_LEAD_EDITING_ROW === name) return;
	_lead_clear_editing_row($grid);
	_LEAD_EDITING_ROW = name;
	if (name) {
		const $cells = $grid.find(`.lg-cell[data-name="${name}"]`);
		$cells.addClass("lg-cell--editing");
		$cells.first().addClass("lg-cell--editing-first");
	}
}

function _lead_clear_editing_row($grid) {
	$grid.find(".lg-cell--editing").removeClass("lg-cell--editing lg-cell--editing-first");
	_LEAD_EDITING_ROW = null;
}

// ── Column Resize ─────────────────────────────────────────────────────────────
function _lead_bind_col_resize($grid, cols) {
	$grid.on("mousedown.lgresize", ".lg-resize-handle", function (e) {
		e.preventDefault();
		const ci    = parseInt($(this).attr("data-col"), 10);
		const col   = cols[ci];
		const startX = e.clientX;
		const startW = _LEAD_COL_WIDTHS[col.field] || col.width;

		const onMove = (ev) => {
			const newW = Math.max(40, startW + (ev.clientX - startX));
			_LEAD_COL_WIDTHS[col.field] = newW;
			const tpl = ["42px", ...cols.map(c => `${_LEAD_COL_WIDTHS[c.field] || c.width}px`)].join(" ");
			$grid[0].style.gridTemplateColumns = tpl;
		};
		const onUp = () => $(document).off("mousemove.lgresize mouseup.lgresize");
		$(document).on("mousemove.lgresize", onMove).on("mouseup.lgresize", onUp);
	});
}

// ── Inline Text Edit ──────────────────────────────────────────────────────────
function _lead_bind_inline_edit($grid, listview, rows) {
	$grid.on("click.lg", ".lg-cell:not(.lg-header-cell):not(.lg-rownum-cell)", function () {
		const name = $(this).attr("data-name");
		if (name) _lead_set_editing_row($grid, name);
	});

	$grid.on("dblclick.lg", ".lg-cell:not(.lg-header-cell):not(.lg-rownum-cell)", function (e) {
		e.preventDefault();
		const name = $(this).attr("data-name");
		if (name) frappe.set_route("Form", LEAD_DOCTYPE, name);
	});

	$grid.on("click.lg", ".lg-cell-display:not(.lg-link-display):not(.lg-url-display)", function (e) {
		e.stopPropagation();
		if ($(this).find("input.lg-inline-input").length) return;

		const $span   = $(this);
		const name    = $span.attr("data-name");
		const field   = $span.attr("data-field");
		const type    = $span.attr("data-type") || "text";
		const doc     = rows.find(r => r.name === name);
		const current = doc ? (doc[field] || "") : "";

		_lead_set_editing_row($grid, name);

		const $input = $(`<input class="lg-inline-input" type="${type}" value="${frappe.utils.escape_html(current)}" data-prev="${frappe.utils.escape_html(current)}">`);
		$span.html($input);
		$input.focus().select();

		$input.on("keydown.lginline", (ev) => {
			if (ev.key === "Enter")  { ev.preventDefault(); $input.blur(); }
			if (ev.key === "Escape") {
				_lead_clear_editing_row($grid);
				$span.html(current || `<span class="lg-cell-ph"></span>`);
			}
		});

		$input.on("blur.lginline", function () {
			const newVal = $(this).val().trim();
			const prev   = $(this).attr("data-prev");
			if (newVal === prev) { $span.html(frappe.utils.escape_html(newVal) || `<span class="lg-cell-ph"></span>`); return; }
			_lead_fast_save(name, field, newVal, listview, rows, () => {
				$span.html(frappe.utils.escape_html(newVal) || `<span class="lg-cell-ph"></span>`);
				if (doc) doc[field] = newVal;
			});
		});
	});
}

// ── Select Change ─────────────────────────────────────────────────────────────
function _lead_bind_select_change($grid, listview, rows) {
	$grid.on("change.lg", ".lg-cell-select", function () {
		const $sel = $(this);
		const name  = $sel.attr("data-name");
		const field = $sel.attr("data-field");
		const val   = $sel.val();
		const doc   = rows.find(r => r.name === name);
		_lead_fast_save(name, field, val, listview, rows, () => { if (doc) doc[field] = val; });
	});
}

// ── URL Click ─────────────────────────────────────────────────────────────────
function _lead_bind_url_click($grid) {
	$grid.on("click.lg", ".lg-url-display", function (e) {
		if (e.ctrlKey || e.metaKey) return;
		if ($(this).find("input").length) return;
		const url = $(this).attr("title") || "";
		if (url) window.open(/^https?:\/\//i.test(url) ? url : `https://${url}`, "_blank", "noopener");
	});
}

// ── Add Row ───────────────────────────────────────────────────────────────────
function _lead_bind_add_row($host, listview) {
	$host.off("click.lgadd").on("click.lgadd", ".lg-add-row-btn", () => {
		frappe.call({
			method: "frappe.client.insert",
			args: { doc: { doctype: LEAD_DOCTYPE, lead_name: "New Lead", status: "Open" } },
			callback({ exc, message }) {
				if (exc || !message) return;
				frappe.show_alert({ message: __("Lead added"), indicator: "green" }, 1.2);
				if (!Array.isArray(listview.data)) listview.data = [];
				listview.data.unshift(message);
				_leads_render(listview);
			},
		});
	});
}

// ── Link Field Typeahead ──────────────────────────────────────────────────────
function _lead_bind_link_edit($grid, listview, rows) {
	$grid.on("click.lglink", ".lg-link-display", function (e) {
		if ($(this).find("input.lg-inline-input").length) return;

		const $span   = $(this);
		const name    = $span.attr("data-name");
		const field   = $span.attr("data-field");
		const linkDt  = $span.attr("data-link-doctype") || "";
		const doc     = rows.find(r => r.name === name);
		const current = doc ? (doc[field] || "") : "";

		const $wrap  = $(`<div class="lg-link-wrap"></div>`);
		const $input = $(`<input class="lg-inline-input lg-link-input" type="text" autocomplete="off" value="${frappe.utils.escape_html(current)}" data-prev="${frappe.utils.escape_html(current)}">`);
		const $dd    = $(`<div class="lg-link-dropdown"></div>`);
		$wrap.append($input).append($dd);
		$span.html($wrap);
		$input.focus().select();

		let _ddTimeout;

		$input.on("input.lglink", function () {
			clearTimeout(_ddTimeout);
			const q = $(this).val().trim();
			if (!q || !linkDt) { $dd.empty().hide(); return; }
			_ddTimeout = setTimeout(() => {
				frappe.call({
					method: "frappe.client.get_list",
					args: { doctype: linkDt, filters: [["name", "like", `%${q}%`]], fields: ["name"], limit_page_length: 8 },
					callback({ message }) {
						$dd.empty();
						if (!message?.length) { $dd.hide(); return; }
						message.forEach(r => {
							$dd.append(
								$(`<div class="lg-link-item" tabindex="-1">${frappe.utils.escape_html(r.name)}</div>`)
									.on("mousedown.lglink", function (ev) {
										ev.preventDefault();
										const chosen = r.name;
										$dd.hide(); $input.val(chosen).attr("data-prev", "");
										_lead_fast_save(name, field, chosen, listview, rows, () => {
											$span.html(frappe.utils.escape_html(chosen));
											if (doc) doc[field] = chosen;
										});
									})
							);
						});
						$dd.show();
					},
				});
			}, 220);
		});

		$input.on("keydown.lglink", (ev) => {
			if (ev.key === "Escape") { $dd.hide(); $span.html(frappe.utils.escape_html(current) || `<span class="lg-cell-ph"></span>`); }
			if (ev.key === "Enter") {
				const val = $input.val().trim(); $dd.hide();
				if (val === current) { $span.html(frappe.utils.escape_html(current) || `<span class="lg-cell-ph"></span>`); return; }
				_lead_fast_save(name, field, val, listview, rows, () => {
					$span.html(frappe.utils.escape_html(val) || `<span class="lg-cell-ph"></span>`);
					if (doc) doc[field] = val;
				});
			}
		});

		$input.on("blur.lglink", function () {
			setTimeout(() => {
				if ($dd.is(":visible")) return;
				const val = $input.val().trim(), prev = $input.attr("data-prev");
				$dd.hide();
				if (val === prev) { $span.html(frappe.utils.escape_html(val) || `<span class="lg-cell-ph"></span>`); return; }
				_lead_fast_save(name, field, val, listview, rows, () => {
					$span.html(frappe.utils.escape_html(val) || `<span class="lg-cell-ph"></span>`);
					if (doc) doc[field] = val;
				});
			}, 150);
		});
	});
}

// ─── Fast Save ────────────────────────────────────────────────────────────────
function _lead_fast_save(name, field, value, listview, rows, onSuccess) {
	if (_LEAD_SAVING) {
		setTimeout(() => _lead_fast_save(name, field, value, listview, rows, onSuccess), 300);
		return;
	}
	_LEAD_SAVING = true;
	frappe.client.set_value(LEAD_DOCTYPE, name, field, value)
		.then(() => {
			_LEAD_SAVING = false;
			if (onSuccess) onSuccess();
		})
		.catch(() => {
			_LEAD_SAVING = false;
			frappe.show_alert({ message: __("Save failed"), indicator: "red" }, 2);
		});
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _leads_css() {
	return `
/* ── Hide Frappe's native list rendering ─────────────────────────────────── */
[data-doctype="Lead"] .result-list,
[data-doctype="Lead"] .list-row-head,
[data-doctype="Lead"] .list-row-container,
[data-doctype="Lead"] .list-row,
[data-doctype="Lead"] .list-headers,
[data-doctype="Lead"] .frappe-list .list-row-head,
[data-doctype="Lead"] .no-result { display: none !important; }

[data-doctype="Lead"] .result,
[data-doctype="Lead"] .frappe-list .result {
	overflow: visible !important; height: auto !important; max-height: none !important;
}

/* ── Grid Host ────────────────────────────────────────────────────────────── */
.leads-grid-host {
	width: 100%;
	overflow-x: auto;
	overflow-y: visible;
	z-index: 0;
	position: relative;
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.leads-grid {
	display: grid;
	min-width: max-content;
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px;
	overflow: hidden;
	font-size: 12px;
	font-weight: 400;
}

/* ── Cells ────────────────────────────────────────────────────────────────── */
.lg-cell {
	border-right: 0.5px solid var(--border-color, #e2e8f0);
	border-bottom: 0.5px solid var(--border-color, #e2e8f0);
	padding: 5px 8px;
	display: flex;
	align-items: center;
	min-height: 34px;
	overflow: hidden;
	position: relative;
	background: var(--card-bg, #fff);
	transition: background 0.1s;
}

/* Hover — highlight all cells in the same row via data-name */
.leads-grid:has(.lg-cell[data-name]:hover) .lg-cell[data-name] { /* fallback, see JS */ }

/* Row editing accent */
.lg-cell--editing       { background: var(--bg-light-gray, #f7f8fa); }
.lg-cell--editing-first { border-left: 2px solid #378ADD; }

/* ── Row Number Gutter ────────────────────────────────────────────────────── */
.lg-rownum-cell {
	justify-content: center;
	color: var(--text-muted, #adb5bd);
	font-variant-numeric: tabular-nums;
	font-size: 11px;
	font-weight: 400;
	background: var(--card-bg, #fff);
	user-select: none;
	cursor: default;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.lg-header-cell {
	background: var(--card-bg, #fff) !important;
	font-size: 11px;
	font-weight: 500;
	color: var(--text-muted, #6c757d);
	user-select: none;
	cursor: default;
	padding: 6px 8px;
	justify-content: center;
}
.lg-resize-handle {
	position: absolute; right: 0; top: 0; bottom: 0;
	width: 6px; cursor: col-resize; background: transparent; z-index: 2;
}
.lg-resize-handle:hover { background: rgba(55,138,221,0.30); }

/* ── Text Cells ───────────────────────────────────────────────────────────── */
.lg-cell-display {
	display: block; width: 100%;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	cursor: text; line-height: 1.4;
	padding: 3px 4px;
	border: 0.5px solid transparent; border-radius: 8px;
	font-size: 12px; font-weight: 400;
}
.lg-cell-display:focus {
	outline: 1.5px solid #378ADD; outline-offset: -1px; border-color: #378ADD;
}
.lg-cell-ph      { color: var(--text-muted, #adb5bd); font-style: italic; }
.lg-url-display  { cursor: pointer; color: #378ADD; text-decoration: underline dotted; }

.lg-inline-input {
	width: 100%;
	border: 0.5px solid #378ADD; outline: 1.5px solid #378ADD;
	outline-offset: -1px; border-radius: 8px;
	padding: 2px 6px; font-size: 12px; font-weight: 400;
	background: var(--card-bg, #fff);
}

/* ── Select ───────────────────────────────────────────────────────────────── */
.lg-cell-select {
	width: 100%; border: none; background: transparent;
	font-size: 12px; font-weight: 400; cursor: pointer; outline: none;
}
.lg-cell-select:focus {
	outline: 1.5px solid #378ADD; outline-offset: -1px; border-radius: 8px;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.lg-toolbar {
	display: flex; align-items: center; padding: 9px 12px;
}
.lg-add-row-btn { display: inline-flex; align-items: center; gap: 6px; }
.lg-add-icon    { font-size: 14px; line-height: 1; font-weight: 500; }

/* ── Empty State ──────────────────────────────────────────────────────────── */
.lg-empty-row {
	padding: 32px; text-align: center;
	color: var(--text-muted, #adb5bd); font-size: 12px; font-weight: 400;
	border-bottom: 0.5px solid var(--border-color, #e2e8f0);
	border-right: 0.5px solid var(--border-color, #e2e8f0);
}

/* ── Link typeahead dropdown ──────────────────────────────────────────────── */
.lg-link-wrap     { position: relative; width: 100%; }
.lg-link-dropdown {
	position: absolute; top: 100%; left: 0; right: 0;
	background: var(--card-bg, #fff);
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.12);
	z-index: 9999; max-height: 200px; overflow-y: auto; display: none;
}
.lg-link-item {
	padding: 6px 10px; font-size: 12px; font-weight: 400;
	cursor: pointer; border-radius: 8px;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lg-link-item:hover { background: var(--bg-light-gray, #f7f8fa); color: #378ADD; }
`;
}
