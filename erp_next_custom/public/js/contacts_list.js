// contacts_list.js
// Custom spreadsheet-style list view for the "Contact" doctype.
// Mirrors crm_log_list.js architecture: CSS Grid, inline editing, column resize,
// avatar/photo cell, résumé attachment modal, typeahead for link fields.

"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTACT_DOCTYPE         = "Contact";
const CONTACT_RESUME_TABLE    = "resumes";          // fieldname on Contact
const CONTACT_RESUME_DOCTYPE  = "Contact Resume";

const CONTACT_TYPE_OPTIONS = [
	"",
	"Supplier",
	"Employee",
	"Worker",
	"Client",
	"Lead",
	"Prospect",
];

// Column definitions — order = display order in grid
// type: "text" | "email" | "url" | "tel" | "select" | "link" | "photo" | "resume"
const CONTACT_COLS = [
	{ field: "image",        label: "Photo",      type: "photo",  width: 64,  fixed: true },
	{ field: "first_name",   label: "Name",       type: "text",   width: 120 },
	{ field: "last_name",    label: "Surname",    type: "text",   width: 120 },
	{ field: "contact_type", label: "Type",       type: "select", width: 110,
	  options: CONTACT_TYPE_OPTIONS },
	{ field: "profession",   label: "Profession", type: "text",   width: 140 },
	{ field: "company_name", label: "Company",    type: "link",   width: 150,
	  link_doctype: "Company" },
	{ field: "position",     label: "Position",   type: "text",   width: 140 },
	{ field: "email_id",     label: "Email",      type: "email",  width: 190 },
	{ field: "website",      label: "Website",    type: "url",    width: 170 },
	{ field: "instagram",    label: "Instagram",  type: "text",   width: 150 },
	{ field: "linkedin",     label: "LinkedIn",   type: "url",    width: 170 },
	{ field: "resume",       label: "Résumé",     type: "resume", width: 80,  fixed: true },
];

// Per-field column widths (persisted in memory, reset on reload)
const _COL_WIDTHS = {};

// In-flight save guard (prevents duplicate requests on blur cascade)
let _CONTACT_SAVING = false;

// Tracks which row is currently in inline-edit mode (reset on every re-paint)
let _CONTACT_EDITING_ROW = null;

function _contacts_set_editing_row($grid, name) {
	if (_CONTACT_EDITING_ROW === name) return;
	_contacts_clear_editing_row($grid);
	_CONTACT_EDITING_ROW = name;
	if (name) {
		// cg-row uses display:contents so it's invisible to CSS layout.
		// Mark all cells in this row via data-name; first gets the left accent.
		const $cells = $grid.find(`.cg-cell[data-name="${name}"]`);
		$cells.addClass("cg-cell--editing");
		$cells.first().addClass("cg-cell--editing-first");
	}
}

function _contacts_clear_editing_row($grid) {
	$grid.find(".cg-cell--editing").removeClass("cg-cell--editing cg-cell--editing-first");
	_CONTACT_EDITING_ROW = null;
}

// Résumé attachment count cache  { docname → count }
const _CONTACT_RESUME_COUNTS = {};

// ─── Frappe List View Entry Point ─────────────────────────────────────────────
frappe.provide("frappe.listview_settings.Contact");

frappe.listview_settings.Contact = {
	// Fields to fetch from server (add_fields)
	add_fields: [
		"first_name", "last_name",    "contact_type",
		"profession",  "company_name", "position",
		"email_id",    "website",
		"instagram",   "linkedin",
		"image",
	],

	onload(listview) {
		listview.__contacts_init_done = false;
		_contacts_bootstrap(listview);
		_suppress_native_refresh(listview);
	},

	refresh(listview) {
		if (!listview.__contacts_init_done) {
			listview.__contacts_init_done = true;
		}
		_contacts_render(listview);
	},
};

// ─── Suppress Native Refresh ──────────────────────────────────────────────────
function _suppress_native_refresh(listview) {
	if (listview.auto_refresh) {
		try { clearInterval(listview.auto_refresh); } catch { /* noop */ }
		listview.auto_refresh = null;
	}
	if (typeof listview.setup_auto_refresh === "function") {
		listview.setup_auto_refresh = () => {};
	}
	try { frappe.realtime.off("list_update"); } catch { /* noop */ }
	if (listview.on_doctype_update) {
		listview.on_doctype_update = () => {};
	}
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
function _contacts_bootstrap(listview) {
	if (!document.getElementById("contacts-grid-style")) {
		const style = document.createElement("style");
		style.id = "contacts-grid-style";
		style.textContent = _contacts_css();
		document.head.appendChild(style);
	}

	const $result = listview.$result || listview.$page.find(".list-result");
	if (!$result.length) return;

	$result.empty();
	const host = document.createElement("div");
	host.className = "contacts-grid-host";
	$result.append(host);

	listview.__contacts_host = host;

	listview.$page.find(".list-filters-area").hide();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _hide_native_list(listview) {
	const $result = listview.$result;
	if ($result) {
		$result.find(
			".result-list, .list-row-head, .list-row-container, .list-row, .no-result"
		).hide();
	}
	listview.$page.find(".list-row-head, .list-headers").hide();
}

function _contacts_render(listview) {
	const host = listview.__contacts_host;
	if (!host) return;

	_hide_native_list(listview);

	const rows = listview.data || [];

	const uncached = rows.filter(r => _CONTACT_RESUME_COUNTS[r.name] === undefined);
	if (uncached.length) {
		_fetch_resume_counts(uncached.map(r => r.name), () => {
			_contacts_paint(listview, host, rows);
		});
	} else {
		_contacts_paint(listview, host, rows);
	}
}

function _fetch_resume_counts(names, cb) {
	if (!names.length) { cb(); return; }

	// Fetch each parent doc to count child table rows
	// Batched via a single get_list on the parent with the child table field
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype:          CONTACT_DOCTYPE,
			filters:          [["name", "in", names]],
			fields:           ["name"],
			limit_page_length: names.length,
		},
		callback({ message: contacts }) {
			// For each contact, do a targeted child-table count
			// Use frappe.db.count equivalent via get_list on child
			const pending = names.slice();
			names.forEach(n => { _CONTACT_RESUME_COUNTS[n] = 0; });

			if (!contacts || !contacts.length) { cb(); return; }

			// Fetch child rows for all parents in one call
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype:          CONTACT_RESUME_DOCTYPE,
					filters:          [["parent", "in", names], ["parenttype", "=", CONTACT_DOCTYPE]],
					fields:           ["parent", "name"],
					limit_page_length: 999,
				},
				callback({ message: rows }) {
					(rows || []).forEach(r => {
						_CONTACT_RESUME_COUNTS[r.parent] = (_CONTACT_RESUME_COUNTS[r.parent] || 0) + 1;
					});
					cb();
				},
			});
		},
	});
}

function _contacts_paint(listview, host, rows) {
	_CONTACT_EDITING_ROW = null; // re-render always starts with no row in edit mode
	const cols = _active_cols();
	const gridTemplate = cols.map(c => `${_col_width(c)}px`).join(" ");

	// ── Toolbar ──
	const toolbar = document.createElement("div");
	toolbar.className = "cg-toolbar";
	toolbar.innerHTML =
		`<button class="btn btn-default btn-sm cg-add-row-btn">` +
		`<span class="cg-add-icon">+</span> ${__("Add Contact")}` +
		`</button>`;

	// ── Grid ──
	const gridHtml = [];

	gridHtml.push(`<div class="cg-row cg-header-row">`);
	cols.forEach((col, ci) => {
		gridHtml.push(
			`<div class="cg-cell cg-header-cell" data-col="${ci}" data-field="${col.field}">` +
			`<span>${__(col.label)}</span>` +
			`<div class="cg-resize-handle" data-col="${ci}"></div>` +
			`</div>`
		);
	});
	gridHtml.push(`</div>`);

	if (!rows.length) {
		gridHtml.push(
			`<div class="cg-empty-row" style="grid-column:1/${cols.length + 1}">` +
			`${__("No contacts found")}</div>`
		);
	}

	rows.forEach((doc, ri) => {
		gridHtml.push(`<div class="cg-row" data-row="${ri}">`);
		cols.forEach((col, ci) => {
			const raw = doc[col.field];
			gridHtml.push(
				`<div class="cg-cell" data-row="${ri}" data-col="${ci}" data-field="${col.field}" data-name="${doc.name}">` +
				_render_cell(col, doc, raw) +
				`</div>`
			);
		});
		gridHtml.push(`</div>`);
	});

	const grid = document.createElement("div");
	grid.className = "contacts-grid";
	grid.style.gridTemplateColumns = gridTemplate;
	grid.innerHTML = gridHtml.join("");

	host.innerHTML = "";
	host.appendChild(toolbar);
	host.appendChild(grid);

	_bind_events(listview, host, rows, cols);
}

// ─── Cell Renderer ────────────────────────────────────────────────────────────
function _render_cell(col, doc, raw) {
	switch (col.type) {
		case "photo":   return _render_photo(doc, raw);
		case "select":  return _render_select(col, doc.name, raw);
		case "resume":  return _render_resume_btn(doc.name);
		case "url":     return _render_url(col, doc.name, raw);
		case "email":   return _render_text(col, doc.name, raw, "email");
		case "link":    return _render_link(col, doc.name, raw);
		default:        return _render_text(col, doc.name, raw, "text");
	}
}

function _render_link(col, name, raw) {
	const val     = frappe.utils.escape_html(raw || "");
	const display = raw ? val : `<span class="cg-cell-ph">${__(col.label)}</span>`;
	return (
		`<span class="cg-cell-display cg-link-display" ` +
		`data-name="${name}" data-field="${col.field}" data-type="link" ` +
		`data-link-doctype="${col.link_doctype || ""}" ` +
		`tabindex="0" title="${val}">${display}</span>`
	);
}

function _render_photo(doc, raw) {
	const initials = _initials(doc);
	if (raw) {
		return (
			`<div class="cg-photo-wrap" data-name="${doc.name}" title="${__("Change photo")}">` +
			`<img class="cg-photo" src="${frappe.utils.escape_html(raw)}" alt="${initials}">` +
			`<div class="cg-photo-overlay">${SVG.camera}</div>` +
			`</div>`
		);
	}
	const color = frappe.get_palette(doc.first_name || doc.name);
	return (
		`<div class="cg-avatar" data-name="${doc.name}" title="${__("Upload photo")}" ` +
		`style="background:${color[0]};color:${color[1]}">` +
		`${initials}` +
		`<div class="cg-photo-overlay">${SVG.camera}</div>` +
		`</div>`
	);
}

function _render_select(col, name, raw) {
	const opts = col.options.map(o =>
		`<option value="${frappe.utils.escape_html(o)}" ${o === raw ? "selected" : ""}>${__(o) || "&nbsp;"}</option>`
	).join("");
	return `<select class="cg-cell-select" data-name="${name}" data-field="${col.field}">${opts}</select>`;
}

function _render_resume_btn(name) {
	const count = _CONTACT_RESUME_COUNTS[name] || 0;
	const badge = count ? `<span class="cg-resume-badge">${count}</span>` : "";
	return (
		`<button class="cg-resume-btn" data-name="${name}" title="${count} résumé(s)">` +
		`${SVG.paperclip}${badge}</button>`
	);
}

function _render_url(col, name, raw) {
	const val     = frappe.utils.escape_html(raw || "");
	const display = raw
		? `<span class="cg-cell-display cg-url-display" data-name="${name}" data-field="${col.field}" tabindex="0" title="${val}">${val}</span>`
		: `<span class="cg-cell-display" data-name="${name}" data-field="${col.field}" data-type="url" tabindex="0"><span class="cg-cell-ph">${__(col.label)}</span></span>`;
	return display;
}

function _render_text(col, name, raw, inputType) {
	const val     = frappe.utils.escape_html(raw || "");
	const display = raw ? val : `<span class="cg-cell-ph">${__(col.label)}</span>`;
	return (
		`<span class="cg-cell-display" data-name="${name}" data-field="${col.field}" ` +
		`data-type="${inputType}" tabindex="0" title="${val}">${display}</span>`
	);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _active_cols() { return CONTACT_COLS; }

function _col_width(col) {
	return _COL_WIDTHS[col.field] !== undefined ? _COL_WIDTHS[col.field] : col.width;
}

function _initials(doc) {
	const f = (doc.first_name || "").trim();
	const l = (doc.last_name  || "").trim();
	if (f && l) return (f[0] + l[0]).toUpperCase();
	if (f)      return f.slice(0, 2).toUpperCase();
	return (doc.name || "?").slice(0, 2).toUpperCase();
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const SVG = {
	paperclip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
	camera:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
	trash:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
	external:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
};

// ─── Event Binding ────────────────────────────────────────────────────────────
function _bind_events(listview, host, rows, cols) {
	const $host  = $(host);
	const $grid  = $host.find(".contacts-grid");

	_bind_col_resize($grid, cols);
	_bind_inline_edit($grid, listview, rows);
	_bind_select_change($grid, listview, rows);
	_bind_photo_click($grid, listview, rows);
	_bind_resume_modal($grid, listview, rows);
	_bind_add_row($host, listview);
	_bind_url_click($grid);
	_bind_link_edit($grid, listview, rows);

	// Deactivate row editing when user clicks outside the grid
	$(document).off("mousedown.cgrow").on("mousedown.cgrow", function (e) {
		if (!$(e.target).closest(".contacts-grid").length) {
			_contacts_clear_editing_row($grid);
		}
	});
}

// ── Column Resize ─────────────────────────────────────────────────────────────
function _bind_col_resize($grid, cols) {
	$grid.on("mousedown.cgresize", ".cg-resize-handle", function (e) {
		e.preventDefault();
		const ci    = parseInt($(this).attr("data-col"), 10);
		const col   = cols[ci];
		const startX = e.clientX;
		const startW = _col_width(col);

		const onMove = (ev) => {
			const newW = Math.max(40, startW + (ev.clientX - startX));
			_COL_WIDTHS[col.field] = newW;
			const tpl = cols.map(c => `${_col_width(c)}px`).join(" ");
			$grid[0].style.gridTemplateColumns = tpl;
		};
		const onUp = () => {
			$(document).off("mousemove.cgresize mouseup.cgresize");
		};
		$(document).on("mousemove.cgresize", onMove).on("mouseup.cgresize", onUp);
	});
}

// ── Inline Text Edit ──────────────────────────────────────────────────────────
function _bind_inline_edit($grid, listview, rows) {
	// Single click on any data cell → activate row editing for the whole row
	$grid.on("click.cg", ".cg-cell:not(.cg-header-cell)", function () {
		const name = $(this).attr("data-name");
		if (name) _contacts_set_editing_row($grid, name);
	});

	// Double click on any data cell → navigate to full form view
	$grid.on("dblclick.cg", ".cg-cell:not(.cg-header-cell)", function (e) {
		e.preventDefault();
		const name = $(this).attr("data-name");
		if (name) frappe.set_route("Form", CONTACT_DOCTYPE, name);
	});

	// Click on a display span → activate inline input for that cell
	$grid.on("click.cg", ".cg-cell-display", function (e) {
		e.stopPropagation(); // prevent double-handling with the cell click above
		if ($(this).find("input.cg-inline-input").length) return;

		const $span   = $(this);
		const name    = $span.attr("data-name");
		const field   = $span.attr("data-field");
		const type    = $span.attr("data-type") || "text";
		const doc     = rows.find(r => r.name === name);
		const current = doc ? (doc[field] || "") : "";

		_contacts_set_editing_row($grid, name);

		const $input = $(`<input class="cg-inline-input" type="${type}" value="${frappe.utils.escape_html(current)}" data-prev="${frappe.utils.escape_html(current)}" data-inline="1">`);
		$span.html($input);
		$input.focus().select();

		$input.on("keydown.cginline", (ev) => {
			if (ev.key === "Enter")  { ev.preventDefault(); $input.blur(); }
			if (ev.key === "Escape") {
				_contacts_clear_editing_row($grid);
				$span.html(current || `<span class="cg-cell-ph">${__(field)}</span>`);
			}
		});

		$input.on("blur.cginline", function () {
			const newVal = $(this).val().trim();
			const prev   = $(this).attr("data-prev");
			if (newVal === prev) {
				$span.html(newVal || `<span class="cg-cell-ph"></span>`);
				return;
			}
			_contact_fast_save(name, field, newVal, listview, rows, () => {
				$span.html(frappe.utils.escape_html(newVal) || `<span class="cg-cell-ph"></span>`);
				if (doc) doc[field] = newVal;
			});
		});
	});
}

// ── Select Change ─────────────────────────────────────────────────────────────
function _bind_select_change($grid, listview, rows) {
	$grid.on("change.cg", ".cg-cell-select", function () {
		const $sel = $(this);
		const name  = $sel.attr("data-name");
		const field = $sel.attr("data-field");
		const val   = $sel.val();
		const doc   = rows.find(r => r.name === name);
		_contact_fast_save(name, field, val, listview, rows, () => {
			if (doc) doc[field] = val;
		});
	});
}

// ── Photo Click → Upload Dialog ───────────────────────────────────────────────
function _bind_photo_click($grid, listview, rows) {
	// Bind on the full cell so the whole column area is clickable, not just the 22px avatar
	$grid.on("click.cg", ".cg-cell[data-field='image']:not(.cg-header-cell)", function () {
		const name = $(this).attr("data-name");
		const doc  = rows.find(r => r.name === name);
		_open_photo_dialog(name, doc, listview, rows);
	});
}

function _open_photo_dialog(name, doc, listview, rows) {
	const d = new frappe.ui.Dialog({
		title: __("Contact Photo"),
		fields: [
			{
				fieldtype: "Attach Image",
				fieldname: "image",
				label:     __("Photo"),
				default:   doc ? doc.image : "",
			},
		],
		primary_action_label: __("Save"),
		primary_action(values) {
			const newImage = values.image || "";
			// Must use get+save — set_value silently fails on the image field
			frappe.call({
				method: "frappe.client.get",
				args: { doctype: CONTACT_DOCTYPE, name },
				callback({ exc, message: fullDoc }) {
					if (exc || !fullDoc) {
						frappe.show_alert({ message: __("Could not load contact"), indicator: "red" }, 2);
						return;
					}
					fullDoc.image = newImage;
					frappe.call({
						method: "frappe.client.save",
						args: { doc: fullDoc },
						callback({ exc: saveExc }) {
							if (saveExc) return;
							// Update in-memory row so re-render picks it up
							if (doc) doc.image = newImage;
							frappe.show_alert({ message: __("Photo saved"), indicator: "green" }, 1.5);
							_contacts_render(listview);
						},
					});
				},
			});
			d.hide();
		},
	});
	d.show();
}

// ── URL Click → open/edit ─────────────────────────────────────────────────────
function _bind_url_click($grid) {
	$grid.on("click.cg", ".cg-url-display", function (e) {
		if (e.ctrlKey || e.metaKey) return;
		const url = $(this).attr("title") || "";
		if (url && !$(this).find("input").length) {
			const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
			window.open(full, "_blank", "noopener");
		}
	});

	$grid.on("dblclick.cg", ".cg-url-display", function (e) {
		e.stopPropagation(); // prevent row double-click from navigating to form
		$(this).trigger("click.cg");
	});
}

// ── Résumé / Attachment Modal ─────────────────────────────────────────────────
function _bind_resume_modal($grid, listview, rows) {
	// Bind on the full cell so the whole column area is clickable, not just the paperclip icon
	$grid.on("click.cg", ".cg-cell[data-field='resume']:not(.cg-header-cell)", function () {
		const name = $(this).attr("data-name");
		const doc  = rows.find(r => r.name === name);
		_open_resume_dialog(name, doc, listview);
	});
}

function _open_resume_dialog(docname, doc, listview) {
	frappe.call({
		method: "frappe.client.get",
		args: { doctype: CONTACT_DOCTYPE, name: docname },
		callback({ exc, message: fullDoc }) {
			if (exc || !fullDoc) return;
			const existing = (fullDoc[CONTACT_RESUME_TABLE] || []).map(r => ({
				label: r.label || "",
				url:   r.url   || "",
			}));
			_render_resume_dialog(docname, existing, listview);
		},
	});
}

function _render_resume_dialog(docname, initial, listview) {
	let items = JSON.parse(JSON.stringify(initial));

	const d = new frappe.ui.Dialog({
		title: __("Résumés & Files"),
		fields: [
			{ fieldtype: "HTML",   fieldname: "preview",   options: "" },
			{ fieldtype: "Section Break" },
			{ fieldtype: "Data",   fieldname: "add_label", label: __("Label"),      placeholder: __("e.g. CV 2025") },
			{ fieldtype: "Attach", fieldname: "add_url",   label: __("File / URL") },
			{ fieldtype: "Button", fieldname: "add_btn",   label: __("Add"),        btn_size: "xs" },
		],
		primary_action_label: __("Save"),
		primary_action() {
			// Auto-flush any file sitting in the Attach field that the user
			// uploaded but forgot to click "Add" before hitting Save.
			const pendingUrl   = (d.get_value("add_url")   || "").trim();
			const pendingLabel = (d.get_value("add_label") || "").trim();
			if (pendingUrl) items.push({ label: pendingLabel, url: pendingUrl });
			_save_resumes(docname, items, listview, d);
		},
	});

	function repaint() {
		const $preview = d.fields_dict.preview.$wrapper;
		$preview.html(_resume_preview_html(items));
		$preview.off("click.resume").on("click.resume", ".cg-del-resume", function () {
			const idx = parseInt($(this).attr("data-idx"), 10);
			items.splice(idx, 1);
			repaint();
		});
	}

	d.fields_dict.add_btn.$input.on("click", () => {
		const label = (d.get_value("add_label") || "").trim();
		const url   = (d.get_value("add_url")   || "").trim();
		if (!url) { frappe.show_alert({ message: __("Please provide a file or URL"), indicator: "orange" }, 2); return; }
		items.push({ label, url });
		d.set_value("add_label", "");
		d.set_value("add_url",   "");
		repaint();
	});

	d.show();
	repaint();

	// Hook into the Attach control after it's rendered so uploading a file
	// immediately adds it to the preview without requiring the Add button.
	const attachField = d.fields_dict.add_url;
	if (attachField && attachField.on_attach) {
		const orig = attachField.on_attach.bind(attachField);
		attachField.on_attach = function () {
			orig();
			const url = (d.get_value("add_url") || "").trim();
			if (!url) return;
			const label = (d.get_value("add_label") || "").trim();
			items.push({ label, url });
			d.set_value("add_label", "");
			d.set_value("add_url",   "");
			repaint();
		};
	}
}

function _resume_preview_html(items) {
	if (!items.length) return `<div class="cg-no-resume">${__("No files attached yet.")}</div>`;
	const rows = items.map((r, i) => {
		const isImage = /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(r.url) ||
			/\/(thumbnail|files)\//i.test(r.url);
		const isPDF   = /\.pdf(\?|$)/i.test(r.url);
		const preview = isImage
			? `<img class="cg-attach-thumb" src="${frappe.utils.escape_html(r.url)}" alt="${frappe.utils.escape_html(r.label)}">`
			: isPDF
				? `<span class="cg-attach-icon cg-pdf-icon">PDF</span>`
				: `<span class="cg-attach-icon">FILE</span>`;
		return (
			`<div class="cg-attach-row">` +
			`${preview}` +
			`<div class="cg-attach-info">` +
			`  <span class="cg-attach-label">${frappe.utils.escape_html(r.label || r.url)}</span>` +
			`  <a class="cg-attach-link" href="${frappe.utils.escape_html(r.url)}" target="_blank" rel="noopener">${SVG.external}</a>` +
			`</div>` +
			`<button class="cg-del-resume" data-idx="${i}" title="${__("Remove")}">${SVG.trash}</button>` +
			`</div>`
		);
	}).join("");
	return `<div class="cg-attach-list">${rows}</div>`;
}

function _save_resumes(docname, items, listview, dialog) {
	frappe.call({
		method: "frappe.client.get",
		args: { doctype: CONTACT_DOCTYPE, name: docname },
		callback({ exc, message: doc }) {
			if (exc || !doc) {
				frappe.show_alert({ message: __("Could not load contact."), indicator: "red" }, 2);
				return;
			}
			doc[CONTACT_RESUME_TABLE] = items.map(r => ({
				doctype: CONTACT_RESUME_DOCTYPE,
				label:   r.label,
				url:     r.url,
			}));
			frappe.call({
				method: "frappe.client.save",
				args: { doc },
				callback({ exc: saveExc }) {
					if (saveExc) return;
					frappe.show_alert({ message: __("Résumés saved"), indicator: "green" }, 1.5);
					_CONTACT_RESUME_COUNTS[docname] = items.length;
					const $btn = $(`.cg-resume-btn[data-name="${docname}"]`);
					const badge = items.length ? `<span class="cg-resume-badge">${items.length}</span>` : "";
					$btn.html(SVG.paperclip + badge);
					dialog.hide();
				},
			});
		},
	});
}

// ── Add Row ───────────────────────────────────────────────────────────────────
function _bind_add_row($host, listview) {
	$host.off("click.cgadd").on("click.cgadd", ".cg-add-row-btn", () => {
		frappe.call({
			method: "frappe.client.insert",
			args: { doc: { doctype: CONTACT_DOCTYPE, first_name: "New" } },
			callback({ exc, message }) {
				if (exc || !message) return;
				frappe.show_alert({ message: __("Contact added"), indicator: "green" }, 1.2);
				if (!Array.isArray(listview.data)) listview.data = [];
				listview.data.unshift(message);
				_contacts_render(listview);
			},
		});
	});
}

// ─── Fast Save ────────────────────────────────────────────────────────────────
function _contact_fast_save(name, field, value, listview, rows, onSuccess) {
	if (_CONTACT_SAVING) {
		setTimeout(() => _contact_fast_save(name, field, value, listview, rows, onSuccess), 300);
		return;
	}
	_CONTACT_SAVING = true;
	frappe.client.set_value(CONTACT_DOCTYPE, name, field, value)
		.then(() => {
			_CONTACT_SAVING = false;
			if (onSuccess) onSuccess();
		})
		.catch(() => {
			_CONTACT_SAVING = false;
			frappe.show_alert({ message: __("Save failed"), indicator: "red" }, 2);
		});
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function _contacts_css() {
	return `
/* ── Hide Frappe's native list rendering ─────────────────────────────────── */
[data-doctype="Contact"] .result-list,
[data-doctype="Contact"] .list-row-head,
[data-doctype="Contact"] .list-row-container,
[data-doctype="Contact"] .list-row,
[data-doctype="Contact"] .list-headers,
[data-doctype="Contact"] .frappe-list .list-row-head,
[data-doctype="Contact"] .no-result { display: none !important; }

[data-doctype="Contact"] .result,
[data-doctype="Contact"] .frappe-list .result {
	overflow: visible !important; height: auto !important; max-height: none !important;
}

/* ── Grid Host ────────────────────────────────────────────────────────────── */
.contacts-grid-host {
	width: 100%;
	overflow-x: auto;
	overflow-y: visible;
	z-index: 0;
	position: relative;
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.contacts-grid {
	display: grid;
	min-width: max-content;
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px;
	overflow: hidden;
	font-size: 12px;
	font-weight: 400;
}

/* ── Rows ─────────────────────────────────────────────────────────────────── */
.cg-row { display: contents; }

.cg-cell {
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

/* Hover — background-secondary, action icons fade in */
.cg-row:not(.cg-header-row):hover .cg-cell {
	background: var(--bg-light-gray, #f7f8fa);
}

/* Row editing — background-secondary on all cells, 2px left accent on first cell */
.cg-cell--editing            { background: var(--bg-light-gray, #f7f8fa); }
.cg-cell--editing-first      { border-left: 2px solid #378ADD; }

/* ── Header ───────────────────────────────────────────────────────────────── */
.cg-header-cell {
	background: var(--card-bg, #fff) !important;
	font-size: 11px;
	font-weight: 500;
	color: var(--text-muted, #6c757d);
	user-select: none;
	cursor: default;
	padding: 6px 8px;
}
.cg-resize-handle {
	position: absolute;
	right: 0; top: 0; bottom: 0;
	width: 6px;
	cursor: col-resize;
	background: transparent;
	z-index: 2;
}
.cg-resize-handle:hover { background: rgba(55,138,221,0.30); }

/* ── Text Cells ───────────────────────────────────────────────────────────── */
.cg-cell-display {
	display: block;
	width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: text;
	line-height: 1.4;
	padding: 3px 4px;
	border: 0.5px solid transparent;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 400;
}
.cg-cell-display:focus {
	outline: 1.5px solid #378ADD;
	outline-offset: -1px;
	border-color: #378ADD;
}
.cg-cell-ph  { color: var(--text-muted, #adb5bd); font-style: italic; }
.cg-url-display { cursor: pointer; color: #378ADD; text-decoration: underline dotted; }

.cg-inline-input {
	width: 100%;
	border: 0.5px solid #378ADD;
	outline: 1.5px solid #378ADD;
	outline-offset: -1px;
	border-radius: 8px;
	padding: 2px 6px;
	font-size: 12px;
	font-weight: 400;
	background: var(--card-bg, #fff);
}

/* ── Select ───────────────────────────────────────────────────────────────── */
.cg-cell-select {
	width: 100%;
	border: none;
	background: transparent;
	font-size: 12px;
	font-weight: 400;
	cursor: pointer;
	outline: none;
}
.cg-cell-select:focus {
	outline: 1.5px solid #378ADD;
	outline-offset: -1px;
	border-radius: 8px;
}

/* Photo & resume cells — full cell is the click target */
.cg-cell[data-field="image"]:not(.cg-header-cell),
.cg-cell[data-field="resume"]:not(.cg-header-cell) {
	cursor: pointer;
	justify-content: center;
}
.cg-cell[data-field="image"]:not(.cg-header-cell):hover,
.cg-cell[data-field="resume"]:not(.cg-header-cell):hover {
	background: var(--bg-light-gray, #f7f8fa);
}

/* ── Photo / Avatar — 22×22px circle ─────────────────────────────────────── */
.cg-photo-wrap, .cg-avatar {
	width: 22px; height: 22px;
	border-radius: 50%;
	overflow: hidden;
	cursor: pointer;
	position: relative;
	flex-shrink: 0;
	display: flex; align-items: center; justify-content: center;
	font-size: 10px; font-weight: 500;
}
.cg-photo { width: 22px; height: 22px; object-fit: cover; border-radius: 50%; pointer-events: none; }
.cg-photo-overlay {
	position: absolute; inset: 0;
	background: rgba(0,0,0,.35);
	display: flex; align-items: center; justify-content: center;
	color: #fff;
	opacity: 0;
	transition: opacity .15s;
	border-radius: 50%;
	pointer-events: none;
}
.cg-cell[data-field="image"]:hover .cg-photo-overlay { opacity: 1; }

/* ── Résumé Button ────────────────────────────────────────────────────────── */
.cg-resume-btn {
	position: relative;
	background: none;
	border: none;
	cursor: pointer;
	color: var(--text-muted, #6c757d);
	padding: 0;
	display: flex; align-items: center; gap: 3px;
	pointer-events: none; /* click is handled on the parent cell */
}
.cg-resume-badge {
	position: absolute; top: -1px; right: -3px;
	background: #378ADD; color: #fff;
	border-radius: 8px; font-size: 9px; font-weight: 500; padding: 0 4px; min-width: 14px;
	text-align: center; line-height: 14px;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.cg-toolbar {
	display: flex; align-items: center;
	padding: 9px 12px;
}
.cg-add-row-btn { display: inline-flex; align-items: center; gap: 6px; }
.cg-add-icon    { font-size: 14px; line-height: 1; font-weight: 500; }

/* ── Empty State ──────────────────────────────────────────────────────────── */
.cg-empty-row {
	padding: 32px;
	text-align: center;
	color: var(--text-muted, #adb5bd);
	font-size: 12px;
	font-weight: 400;
	border-bottom: 0.5px solid var(--border-color, #e2e8f0);
	border-right: 0.5px solid var(--border-color, #e2e8f0);
}

/* ── Attachment / Résumé dialog items ─────────────────────────────────────── */
.cg-attach-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.cg-attach-row {
	display: flex; align-items: center; gap: 10px;
	padding: 6px 8px; border-radius: 12px;
	border: 0.5px solid var(--border-color, #e2e8f0);
}
.cg-attach-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
.cg-attach-icon  {
	width: 48px; height: 48px; border-radius: 8px;
	background: var(--bg-light-gray, #f1f3f5);
	display: flex; align-items: center; justify-content: center;
	font-size: 10px; font-weight: 500; color: var(--text-muted, #6c757d);
}
.cg-pdf-icon { color: var(--text-danger, #e53935); }
.cg-attach-info  { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.cg-attach-label { flex: 1; font-size: 12px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-attach-link  { color: var(--text-muted, #adb5bd); flex-shrink: 0; }
.cg-attach-link:hover { color: #378ADD; }
.cg-del-resume {
	background: none; border: none; cursor: pointer;
	color: var(--text-muted, #adb5bd); padding: 3px;
	border-radius: 8px; flex-shrink: 0;
	transition: color 0.12s, background 0.12s;
}
.cg-del-resume:hover { color: var(--text-danger, #e53935); background: var(--bg-light-gray, #f7f8fa); }
.cg-no-resume { text-align: center; color: var(--text-muted, #adb5bd); padding: 16px 0; font-size: 12px; font-weight: 400; }

/* ── Link typeahead dropdown ──────────────────────────────────────────────── */
.cg-link-wrap { position: relative; width: 100%; }
.cg-link-dropdown {
	position: absolute; top: 100%; left: 0; right: 0;
	background: var(--card-bg, #fff);
	border: 0.5px solid var(--border-color, #e2e8f0);
	border-radius: 12px;
	box-shadow: 0 4px 12px rgba(0,0,0,.12);
	z-index: 9999;
	max-height: 200px; overflow-y: auto;
	display: none;
}
.cg-link-item {
	padding: 6px 10px;
	font-size: 12px;
	font-weight: 400;
	cursor: pointer;
	border-radius: 8px;
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cg-link-item:hover { background: var(--bg-light-gray, #f7f8fa); color: #378ADD; }
`;
}

// ── Link Field Typeahead ───────────────────────────────────────────────────────
function _bind_link_edit($grid, listview, rows) {
	$grid.on("click.cglink", ".cg-link-display", function (e) {
		if ($(this).find("input.cg-inline-input").length) return;

		const $span      = $(this);
		const name       = $span.attr("data-name");
		const field      = $span.attr("data-field");
		const linkDt     = $span.attr("data-link-doctype") || "";
		const doc        = rows.find(r => r.name === name);
		const current    = doc ? (doc[field] || "") : "";

		const $wrap = $(`<div class="cg-link-wrap"></div>`);
		const $input = $(`<input class="cg-inline-input cg-link-input" type="text" autocomplete="off" value="${frappe.utils.escape_html(current)}" data-prev="${frappe.utils.escape_html(current)}">`);
		const $dd    = $(`<div class="cg-link-dropdown"></div>`);
		$wrap.append($input).append($dd);
		$span.html($wrap);
		$input.focus().select();

		let _ddTimeout;

		$input.on("input.cglink", function () {
			clearTimeout(_ddTimeout);
			const q = $(this).val().trim();
			if (!q || !linkDt) { $dd.empty().hide(); return; }
			_ddTimeout = setTimeout(() => {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: linkDt,
						filters: [["name", "like", `%${q}%`]],
						fields:  ["name"],
						limit_page_length: 8,
					},
					callback({ message }) {
						$dd.empty();
						if (!message || !message.length) { $dd.hide(); return; }
						message.forEach(r => {
							$dd.append(
								$(`<div class="cg-link-item" tabindex="-1">${frappe.utils.escape_html(r.name)}</div>`)
									.on("mousedown.cglink", function (ev) {
										ev.preventDefault();
										const chosen = r.name;
										$dd.hide();
										$input.val(chosen).attr("data-prev", "");
										_contact_fast_save(name, field, chosen, listview, rows, () => {
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

		$input.on("keydown.cglink", (ev) => {
			if (ev.key === "Escape") {
				$dd.hide();
				$span.html(frappe.utils.escape_html(current) || `<span class="cg-cell-ph"></span>`);
			}
			if (ev.key === "Enter") {
				const val = $input.val().trim();
				$dd.hide();
				if (val === current) {
					$span.html(frappe.utils.escape_html(current) || `<span class="cg-cell-ph"></span>`);
					return;
				}
				_contact_fast_save(name, field, val, listview, rows, () => {
					$span.html(frappe.utils.escape_html(val) || `<span class="cg-cell-ph"></span>`);
					if (doc) doc[field] = val;
				});
			}
		});

		$input.on("blur.cglink", function () {
			setTimeout(() => {
				if ($dd.is(":visible")) return;
				const val  = $input.val().trim();
				const prev = $input.attr("data-prev");
				$dd.hide();
				if (val === prev) {
					$span.html(frappe.utils.escape_html(val) || `<span class="cg-cell-ph"></span>`);
					return;
				}
				_contact_fast_save(name, field, val, listview, rows, () => {
					$span.html(frappe.utils.escape_html(val) || `<span class="cg-cell-ph"></span>`);
					if (doc) doc[field] = val;
				});
			}, 150);
		});
	});
}
