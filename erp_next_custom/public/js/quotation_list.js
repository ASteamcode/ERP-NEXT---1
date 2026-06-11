// quotation_list.js
// Spreadsheet-style list view for the "Quotation" doctype.
// Same architecture as contacts_list.js / leads_list.js.
"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────
const Q_DOCTYPE = "Quotation";

const Q_STATUS_META = {
	"Draft":     { color: "#6C757D", bg: "rgba(108,117,125,0.10)" },
	"Open":      { color: "#0A84FF", bg: "rgba(10,132,255,0.10)"  },
	"Replied":   { color: "#FF9F0A", bg: "rgba(255,159,10,0.10)"  },
	"Ordered":   { color: "#30D158", bg: "rgba(48,209,88,0.10)"   },
	"Cancelled": { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
	"Expired":   { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
	"Lost":      { color: "#FF453A", bg: "rgba(255,69,58,0.10)"   },
};

// width is a flex weight (fr), not px — columns share available space
const Q_COLS = [
	{ field: "name",                        label: "Quotation #",  type: "id",       fr: 1.4 },
	{ field: "status",                      label: "Status",       type: "status",   fr: 1.0 },
	{ field: "transaction_date",            label: "Date",         type: "date",     fr: 0.9 },
	{ field: "valid_till",                  label: "Valid Till",   type: "date",     fr: 0.9 },
	{ field: "customer_name",               label: "Client",       type: "text",     fr: 1.6 },
	{ field: "grand_total",                 label: "Total",        type: "currency", fr: 1.0 },
	{ field: "custom_crm_log",              label: "CRM Log",      type: "link",     fr: 1.1, link_doctype: "CRM Log"             },
	{ field: "custom_lead",                 label: "Lead",         type: "link",     fr: 1.1, link_doctype: "Lead"                },
	{ field: "custom_site_survey",          label: "Site Survey",  type: "link",     fr: 1.1, link_doctype: "Site Survey"         },
	{ field: "custom_measurement_take_off", label: "MTO",          type: "link",     fr: 1.1, link_doctype: "Measurement Take Off"},
];

const _Q_COL_WIDTHS = {};   // per-field override after resize (px)
let _Q_SAVING       = false;
let _Q_EDITING_ROW  = null;

// ─── Frappe entry point ───────────────────────────────────────────────────────
frappe.provide("frappe.listview_settings.Quotation");

frappe.listview_settings.Quotation = {
	add_fields: [
		"status", "transaction_date", "valid_till", "customer_name",
		"grand_total", "currency",
		"custom_crm_log", "custom_lead", "custom_site_survey", "custom_measurement_take_off",
	],

	onload(listview) {
		listview.__q_init_done = false;
		_q_bootstrap(listview);
		_q_suppress_refresh(listview);
	},

	refresh(listview) {
		if (!listview.__q_init_done) listview.__q_init_done = true;
		_q_render(listview);
	},
};

// ─── Suppress native refresh ──────────────────────────────────────────────────
function _q_suppress_refresh(lv) {
	if (lv.auto_refresh) { try { clearInterval(lv.auto_refresh); } catch { /* */ } lv.auto_refresh = null; }
	if (typeof lv.setup_auto_refresh === "function") lv.setup_auto_refresh = () => {};
	try { frappe.realtime.off("list_update"); } catch { /* */ }
	if (lv.on_doctype_update) lv.on_doctype_update = () => {};
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
function _q_bootstrap(listview) {
	if (!document.getElementById("q-grid-style")) {
		const s = document.createElement("style");
		s.id = "q-grid-style";
		s.textContent = _q_css();
		document.head.appendChild(s);
	}
	const $result = listview.$result || listview.$page.find(".list-result");
	if (!$result.length) return;
	$result.empty();
	const host = document.createElement("div");
	host.className = "q-host";
	$result.append(host);
	listview.__q_host = host;
	listview.$page.find(".list-filters-area").hide();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _q_hide_native(lv) {
	const $r = lv.$result;
	if ($r) $r.find(".result-list,.list-row-head,.list-row-container,.list-row,.no-result").hide();
	lv.$page.find(".list-row-head,.list-headers").hide();
}

function _q_render(listview) {
	const host = listview.__q_host;
	if (!host) return;
	_q_hide_native(listview);
	_q_paint(listview, host, listview.data || []);
}

// ─── Grid template ────────────────────────────────────────────────────────────
function _q_grid_tpl(cols) {
	// 42px rownum gutter, then each column is either overridden (px) or fr-based
	const tracks = cols.map(c =>
		_Q_COL_WIDTHS[c.field] ? `${_Q_COL_WIDTHS[c.field]}px` : `${c.fr}fr`
	);
	return ["42px", ...tracks].join(" ");
}

// ─── Paint ────────────────────────────────────────────────────────────────────
function _q_paint(listview, host, rows) {
	_Q_EDITING_ROW = null;
	const cols = Q_COLS;

	const toolbar = document.createElement("div");
	toolbar.className = "q-toolbar";
	toolbar.innerHTML =
		`<button class="btn btn-default btn-sm q-add-btn">` +
		`<span style="font-size:14px;line-height:1">+</span> ${__("New Quotation")}` +
		`</button>`;

	const html = [];
	// Header
	html.push(`<div class="q-cell q-hdr q-rownum">#</div>`);
	cols.forEach((col, ci) => {
		html.push(
			`<div class="q-cell q-hdr" data-col="${ci}" data-field="${col.field}">` +
			`<span>${__(col.label)}</span>` +
			`<div class="q-rh" data-col="${ci}"></div>` +
			`</div>`
		);
	});

	if (!rows.length) {
		html.push(`<div class="q-empty" style="grid-column:1/${cols.length + 2}">${__("No quotations found")}</div>`);
	}

	rows.forEach((doc, ri) => {
		html.push(`<div class="q-cell q-rownum" data-name="${doc.name}">${ri + 1}</div>`);
		cols.forEach((col, ci) => {
			html.push(
				`<div class="q-cell" data-row="${ri}" data-col="${ci}" ` +
				`data-field="${col.field}" data-name="${doc.name}">` +
				_q_cell(col, doc) +
				`</div>`
			);
		});
	});

	const grid = document.createElement("div");
	grid.className = "q-grid";
	grid.style.gridTemplateColumns = _q_grid_tpl(cols);
	grid.innerHTML = html.join("");

	host.innerHTML = "";
	host.appendChild(toolbar);
	host.appendChild(grid);

	_q_bind(listview, host, rows, cols);
}

// ─── Cell renderers ───────────────────────────────────────────────────────────
function _q_cell(col, doc) {
	const raw = doc[col.field];
	switch (col.type) {
		case "id":       return _q_cell_id(col, doc.name);
		case "status":   return _q_cell_status(col, doc.name, raw);
		case "date":     return _q_cell_date(col, doc.name, raw);
		case "currency": return _q_cell_currency(col, doc, raw);
		case "link":     return _q_cell_link(col, doc.name, raw);
		default:         return _q_cell_text(col, doc.name, raw);
	}
}

function _q_cell_id(col, name) {
	return (
		`<span class="q-id" data-name="${name}" data-field="${col.field}" tabindex="0">` +
		`${frappe.utils.escape_html(name)}</span>`
	);
}

function _q_cell_status(col, name, raw) {
	const m = Q_STATUS_META[raw] || Q_STATUS_META["Draft"];
	return (
		`<span class="q-status" style="color:${m.color};background:${m.bg}" ` +
		`data-name="${name}" data-field="${col.field}">` +
		`${frappe.utils.escape_html(raw || "—")}</span>`
	);
}

function _q_cell_date(col, name, raw) {
	const fmt = raw ? frappe.datetime.str_to_user(raw) : "";
	return (
		`<span class="q-disp q-date-disp" data-name="${name}" data-field="${col.field}" ` +
		`data-type="date" tabindex="0">` +
		(fmt ? frappe.utils.escape_html(fmt) : `<span class="q-ph">—</span>`) +
		`</span>`
	);
}

function _q_cell_currency(col, doc, raw) {
	let txt = "—";
	if (raw != null && raw !== "") {
		const sym = (frappe.utils.get_currency_symbol || (() => doc.currency || ""))(doc.currency);
		txt = `${sym} ${format_number(raw, null, 2)}`;
	}
	return `<span class="q-currency">${txt}</span>`;
}

function _q_cell_text(col, name, raw) {
	const v = frappe.utils.escape_html(raw || "");
	return (
		`<span class="q-disp" data-name="${name}" data-field="${col.field}" ` +
		`data-type="text" tabindex="0" title="${v}">` +
		(raw ? v : `<span class="q-ph">—</span>`) +
		`</span>`
	);
}

function _q_cell_link(col, name, raw) {
	const v = frappe.utils.escape_html(raw || "");
	return (
		`<span class="q-disp q-link-disp" data-name="${name}" data-field="${col.field}" ` +
		`data-type="link" data-link-doctype="${col.link_doctype || ""}" ` +
		`tabindex="0" title="${v}">` +
		(raw ? `<span class="q-link-val">${v}</span>` : `<span class="q-ph">—</span>`) +
		`</span>`
	);
}

// ─── Events ───────────────────────────────────────────────────────────────────
function _q_bind(listview, host, rows, cols) {
	const $host = $(host);
	const $grid = $host.find(".q-grid");

	_q_bind_resize($grid, cols);
	_q_bind_row_click($grid, rows);
	_q_bind_text_edit($grid, listview, rows);
	_q_bind_date_edit($grid, listview, rows);
	_q_bind_link_edit($grid, listview, rows);
	_q_bind_add($host);

	// Row hover
	$grid.on("mouseenter.q", ".q-cell[data-name]", function () {
		const n = $(this).attr("data-name");
		$grid.find(`.q-cell[data-name="${n}"]`).addClass("q-row--hover");
	}).on("mouseleave.q", ".q-cell[data-name]", function () {
		const n = $(this).attr("data-name");
		$grid.find(`.q-cell[data-name="${n}"]`).removeClass("q-row--hover");
	});

	$(document).off("mousedown.qrow").on("mousedown.qrow", e => {
		if (!$(e.target).closest(".q-grid,.q-dd").length) _q_clear_edit($grid);
	});
}

function _q_set_edit($grid, name) {
	if (_Q_EDITING_ROW === name) return;
	_q_clear_edit($grid);
	_Q_EDITING_ROW = name;
	const $c = $grid.find(`.q-cell[data-name="${name}"]`);
	$c.addClass("q-row--editing");
	$c.first().addClass("q-row--editing-first");
}

function _q_clear_edit($grid) {
	$grid.find(".q-row--editing,.q-row--editing-first").removeClass("q-row--editing q-row--editing-first");
	_Q_EDITING_ROW = null;
}

// ── Row click / open ──────────────────────────────────────────────────────────
function _q_bind_row_click($grid, rows) {
	$grid.on("click.q", ".q-id", function (e) {
		if (e.ctrlKey || e.metaKey) return;
		frappe.set_route("Form", Q_DOCTYPE, $(this).attr("data-name"));
	});
	$grid.on("click.q", ".q-cell:not(.q-hdr):not(.q-rownum)", function () {
		const n = $(this).attr("data-name");
		if (n) _q_set_edit($grid, n);
	});
	$grid.on("dblclick.q", ".q-cell:not(.q-hdr):not(.q-rownum)", function (e) {
		e.preventDefault();
		const n = $(this).attr("data-name");
		if (n) frappe.set_route("Form", Q_DOCTYPE, n);
	});
}

// ── Column resize ─────────────────────────────────────────────────────────────
function _q_bind_resize($grid, cols) {
	$grid.on("mousedown.qr", ".q-rh", function (e) {
		e.preventDefault();
		const ci    = parseInt($(this).attr("data-col"), 10);
		const col   = cols[ci];
		const startX = e.clientX;
		// snapshot current rendered width from the grid track
		const computed = getComputedStyle($grid[0]).gridTemplateColumns.split(" ");
		// computed[0] = rownum (42px), rest = columns
		const startW = parseFloat(computed[ci + 1]) || col.fr * 100;

		const onMove = ev => {
			const w = Math.max(40, startW + (ev.clientX - startX));
			_Q_COL_WIDTHS[col.field] = w;
			$grid[0].style.gridTemplateColumns = _q_grid_tpl(cols);
		};
		$(document).on("mousemove.qr", onMove).on("mouseup.qr", () => $(document).off("mousemove.qr mouseup.qr"));
	});
}

// ── Text edit ─────────────────────────────────────────────────────────────────
function _q_bind_text_edit($grid, listview, rows) {
	$grid.on("click.q", ".q-disp[data-type='text']", function (e) {
		e.stopPropagation();
		if ($(this).find("input").length) return;
		const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
		const doc = rows.find(r => r.name === name);
		const cur = doc?.[field] || "";
		_q_set_edit($grid, name);
		const $i = $(`<input class="q-inp" type="text" value="${frappe.utils.escape_html(cur)}">`);
		$s.html($i); $i.focus().select();
		$i.on("keydown", ev => { if (ev.key === "Enter") $i.blur(); if (ev.key === "Escape") $s.html(frappe.utils.escape_html(cur) || `<span class="q-ph">—</span>`); });
		$i.on("blur", function () {
			const v = $(this).val().trim();
			if (v === cur) { $s.html(frappe.utils.escape_html(v) || `<span class="q-ph">—</span>`); return; }
			_q_save(name, field, v, rows, () => { if (doc) doc[field] = v; $s.html(frappe.utils.escape_html(v) || `<span class="q-ph">—</span>`); });
		});
	});
}

// ── Date edit ─────────────────────────────────────────────────────────────────
function _q_bind_date_edit($grid, listview, rows) {
	$grid.on("click.q", ".q-date-disp", function (e) {
		e.stopPropagation();
		if ($(this).find("input").length) return;
		const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
		const doc = rows.find(r => r.name === name);
		const cur = doc?.[field] || "";
		_q_set_edit($grid, name);
		const $i = $(`<input class="q-inp" type="date" value="${cur}">`);
		$s.html($i); $i.focus();
		const commit = () => {
			const v = $i.val();
			if (v === cur) { $s.html(v ? frappe.utils.escape_html(frappe.datetime.str_to_user(v)) : `<span class="q-ph">—</span>`); return; }
			_q_save(name, field, v || null, rows, () => {
				if (doc) doc[field] = v;
				$s.html(v ? frappe.utils.escape_html(frappe.datetime.str_to_user(v)) : `<span class="q-ph">—</span>`);
			});
		};
		$i.on("change", commit).on("blur", commit);
	});
}

// ── Link edit ─────────────────────────────────────────────────────────────────
function _q_bind_link_edit($grid, listview, rows) {
	$grid.on("click.q", ".q-link-disp", function (e) {
		if ($(this).find("input").length) return;
		const $s = $(this), name = $s.attr("data-name"), field = $s.attr("data-field");
		const linkDt = $s.attr("data-link-doctype") || "";
		const doc = rows.find(r => r.name === name);
		const cur = doc?.[field] || "";
		_q_set_edit($grid, name);
		const $w  = $(`<div class="q-link-wrap"></div>`);
		const $i  = $(`<input class="q-inp" type="text" autocomplete="off" value="${frappe.utils.escape_html(cur)}" placeholder="${__("Search…")}">`);
		const $dd = $(`<div class="q-dd"></div>`);
		$w.append($i).append($dd); $s.html($w); $i.focus().select();

		let _t;
		$i.on("input", function () {
			clearTimeout(_t);
			const q = $(this).val().trim();
			if (!q || !linkDt) { $dd.empty().hide(); return; }
			_t = setTimeout(() => {
				frappe.call({
					method: "frappe.client.get_list",
					args: { doctype: linkDt, filters: [["name","like",`%${q}%`]], fields: ["name"], limit_page_length: 8 },
					callback({ message }) {
						$dd.empty();
						if (!message?.length) { $dd.hide(); return; }
						message.forEach(r => {
							$dd.append(
								$(`<div class="q-dd-item">${frappe.utils.escape_html(r.name)}</div>`)
									.on("mousedown", ev => {
										ev.preventDefault();
										const v = r.name; $dd.hide(); $i.val(v);
										_q_save(name, field, v, rows, () => {
											if (doc) doc[field] = v;
											$s.html(`<span class="q-link-val">${frappe.utils.escape_html(v)}</span>`);
										});
									})
							);
						});
						$dd.show();
					},
				});
			}, 220);
		});
		$i.on("keydown", ev => {
			if (ev.key === "Escape") { $dd.hide(); $s.html(cur ? `<span class="q-link-val">${frappe.utils.escape_html(cur)}</span>` : `<span class="q-ph">—</span>`); }
			if (ev.key === "Enter") {
				const v = $i.val().trim(); $dd.hide();
				_q_save(name, field, v || null, rows, () => {
					if (doc) doc[field] = v;
					$s.html(v ? `<span class="q-link-val">${frappe.utils.escape_html(v)}</span>` : `<span class="q-ph">—</span>`);
				});
			}
		});
		$i.on("blur", function () {
			setTimeout(() => { if ($dd.is(":visible")) return; $dd.hide(); const v = $i.val().trim(); $s.html(v ? `<span class="q-link-val">${frappe.utils.escape_html(v)}</span>` : `<span class="q-ph">—</span>`); }, 160);
		});
	});
}

// ── Add row ───────────────────────────────────────────────────────────────────
function _q_bind_add($host) {
	$host.off("click.qadd").on("click.qadd", ".q-add-btn", () => frappe.new_doc(Q_DOCTYPE));
}

// ─── Save ─────────────────────────────────────────────────────────────────────
function _q_save(name, field, value, rows, cb) {
	if (_Q_SAVING) { setTimeout(() => _q_save(name, field, value, rows, cb), 300); return; }
	_Q_SAVING = true;
	frappe.client.set_value(Q_DOCTYPE, name, field, value)
		.then(() => { _Q_SAVING = false; if (cb) cb(); })
		.catch(() => { _Q_SAVING = false; frappe.show_alert({ message: __("Save failed"), indicator: "red" }, 2); });
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _q_css() {
	return `
/* ── Hide Frappe native list ───────────────────────────────────────────────── */
[data-doctype="Quotation"] .result-list,
[data-doctype="Quotation"] .list-row-head,
[data-doctype="Quotation"] .list-row-container,
[data-doctype="Quotation"] .list-row,
[data-doctype="Quotation"] .list-headers,
[data-doctype="Quotation"] .frappe-list .list-row-head,
[data-doctype="Quotation"] .no-result { display: none !important; }

[data-doctype="Quotation"] .result,
[data-doctype="Quotation"] .frappe-list .result {
	overflow: visible !important; height: auto !important; max-height: none !important;
}

/* ── Host ─────────────────────────────────────────────────────────────────── */
.q-host { width: 100%; }

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.q-toolbar { padding: 9px 12px; display: flex; align-items: center; }

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.q-grid {
	display: grid;
	width: 100%;
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px;
	overflow: hidden;
	font-size: 12px;
	font-weight: 400;
}

/* ── Cells ────────────────────────────────────────────────────────────────── */
.q-cell {
	border-right: 0.5px solid var(--border-color, #e2e8f0);
	border-bottom: 0.5px solid var(--border-color, #e2e8f0);
	padding: 5px 8px;
	display: flex; align-items: center;
	min-height: 34px;
	overflow: hidden;
	position: relative;
	background: var(--card-bg, #fff);
	transition: background 0.1s;
	min-width: 0;
}

.q-row--hover:not(.q-hdr):not(.q-rownum) { background: var(--bg-light-gray, #f7f8fa); }
.q-row--editing:not(.q-hdr):not(.q-rownum) { background: var(--bg-light-gray, #f7f8fa); }
.q-row--editing-first { border-left: 2px solid #378ADD; }

/* ── Row number ───────────────────────────────────────────────────────────── */
.q-rownum {
	justify-content: center;
	color: var(--text-muted, #adb5bd);
	font-size: 11px; font-weight: 400;
	font-variant-numeric: tabular-nums;
	user-select: none; cursor: default;
	flex-shrink: 0;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.q-hdr {
	background: var(--card-bg, #fff) !important;
	font-size: 11px; font-weight: 500;
	color: var(--text-muted, #6c757d);
	user-select: none; cursor: default;
	padding: 6px 8px;
	justify-content: center;
}
.q-rh {
	position: absolute; right: 0; top: 0; bottom: 0; width: 6px;
	cursor: col-resize;
}
.q-rh:hover { background: rgba(55,138,221,0.30); }

/* ── Status pill ──────────────────────────────────────────────────────────── */
.q-status {
	display: inline-flex; align-items: center;
	padding: 2px 8px; border-radius: 20px;
	font-size: 11px; font-weight: 500;
	white-space: nowrap; cursor: default;
}

/* ── ID / link cells ──────────────────────────────────────────────────────── */
.q-id {
	font-size: 12px; font-weight: 500; color: #378ADD;
	cursor: pointer; white-space: nowrap;
	overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;
}
.q-id:hover { text-decoration: underline; }

.q-currency {
	font-size: 12px; font-weight: 500;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

/* ── Display spans ────────────────────────────────────────────────────────── */
.q-disp {
	display: block; width: 100%;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	cursor: text; line-height: 1.4;
	padding: 3px 4px; border-radius: 8px;
	border: 0.5px solid transparent; font-size: 12px;
}
.q-disp:focus { outline: 1.5px solid #378ADD; outline-offset: -1px; }
.q-date-disp { cursor: text; }
.q-link-disp { cursor: text; }
.q-link-val  { color: #378ADD; }
.q-ph        { color: var(--text-muted, #adb5bd); }

/* ── Inline input ─────────────────────────────────────────────────────────── */
.q-inp {
	width: 100%; border: 0.5px solid #378ADD;
	outline: 1.5px solid #378ADD; outline-offset: -1px;
	border-radius: 8px; padding: 2px 6px;
	font-size: 12px; font-weight: 400;
	background: var(--card-bg, #fff);
}

/* ── Link dropdown ────────────────────────────────────────────────────────── */
.q-link-wrap { position: relative; width: 100%; }
.q-dd {
	position: absolute; top: 100%; left: 0; right: 0;
	background: var(--card-bg, #fff);
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px;
	box-shadow: 0 4px 12px rgba(0,0,0,.12);
	z-index: 9999; max-height: 200px; overflow-y: auto;
	display: none; padding: 4px;
}
.q-dd-item {
	padding: 6px 10px; font-size: 12px; border-radius: 8px;
	cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.q-dd-item:hover { background: var(--bg-light-gray, #f7f8fa); color: #378ADD; }

/* ── Empty state ──────────────────────────────────────────────────────────── */
.q-empty {
	padding: 32px; text-align: center;
	color: var(--text-muted, #adb5bd); font-size: 12px;
	border-bottom: 0.5px solid var(--border-color, #e2e8f0);
	border-right: 0.5px solid var(--border-color, #e2e8f0);
}
`;
}
