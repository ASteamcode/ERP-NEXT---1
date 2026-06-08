// CRM Log — Custom Spreadsheet Grid
// Fully replaces Frappe's native list-row renderer with a self-rendered grid.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/** Single source of truth for column layout. `type` drives cell rendering. */
const CRM_COLUMNS = [
	{ field: "status",          label: "Status",        type: "select",  width: 120, options: ["Open", "Scheduled", "Viewed", "Cancelled", "Done"] },
	{ field: "date",            label: "Created",       type: "date",    width: 130 },
	{ field: "user",            label: "User",          type: "avatar",  width: 60  },
	{ field: "assigned_to",     label: "To",            type: "avatar",  width: 60, variant: "grey" },
	{ field: "log_type",        label: "Type",          type: "select",  width: 130, options: ["Inbound call", "Quotation", "Field", "Job", "Transport", "Yard"] },
	{ field: "prefix",          label: "Pre",           type: "select",  width: 64,  options: ["Mr", "Ms", "Mrs", "Dr"] },
	{ field: "first_name",      label: "Name",          type: "text",    width: 120 },
	{ field: "last_name",       label: "Surname",       type: "text",    width: 120 },
	{ field: "company_name",    label: "Company",       type: "text",    width: 140 },
	{ field: "mobile",          label: "Mobile",        type: "tel",     width: 130 },
	{ field: "tel",             label: "Tel",           type: "tel",     width: 120 },
	{ field: "email",           label: "Email",         type: "email",   width: 180 },
	{ field: "description",     label: "Description",   type: "area",    width: 280 },
	{ field: "updates",         label: "Update(s)",     type: "area",    width: 280 },
	{ field: "site_location",   label: "Site Location", type: "text",    width: 120 },
	{ field: "google_maps_url", label: "Maps",          type: "maps",    width: 130 },
	{ field: "attachments",     label: "Files",         type: "attach",  width: 52  },
];

const CRM_ATTACH_DOCTYPE    = "CRM Log Attachment";
const CRM_ATTACH_TABLE_FIELD = "attachments";
const CRM_COL_WIDTH_KEY     = "crm_log_col_widths";
const CRM_STYLE_VERSION     = "v9"; // bump whenever styles change

/**
 * Fields to pass to `add_fields`. Excludes `attachments` (child table fetched
 * separately) and appends `name` which is always needed.
 */
const CRM_FIELDS = [
	...CRM_COLUMNS.filter(c => c.field !== "attachments").map(c => c.field),
	"name",
	"attachments",
];

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN-WIDTH PERSISTENCE
// User-set widths survive page reloads via localStorage. A column only gets an
// entry once the user drags its resize handle; no entry → auto-fit.
// ─────────────────────────────────────────────────────────────────────────────

const CRM_COL_WIDTHS = (() => {
	try {
		const parsed = JSON.parse(localStorage.getItem(CRM_COL_WIDTH_KEY) || "{}");
		return Object.fromEntries(
			Object.entries(parsed).filter(([, v]) => typeof v === "number")
		);
	} catch {
		return {};
	}
})();

const crm_stored_col_width = (field) =>
	typeof CRM_COL_WIDTHS[field] === "number" ? CRM_COL_WIDTHS[field] : null;

const crm_persist_col_widths = () => {
	try { localStorage.setItem(CRM_COL_WIDTH_KEY, JSON.stringify(CRM_COL_WIDTHS)); } catch { /* noop */ }
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAPPE LIST SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

frappe.listview_settings["CRM Log"] = {
	hide_name_column: true,
	add_fields: CRM_FIELDS,

	onload(listview) {
		crm_inject_styles();
		crm_suppress_native_refresh(listview);
	},

	refresh(listview) {
		crm_inject_styles();
		crm_render_grid(listview);
	},
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPPRESS NATIVE AUTO-REFRESH
// Stops two things that would re-render behind our back:
//   1) The periodic auto-refresh timer.
//   2) The realtime "list_update" subscription (fires on any CRM Log change).
// ─────────────────────────────────────────────────────────────────────────────

function crm_suppress_native_refresh(listview) {
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

// ─────────────────────────────────────────────────────────────────────────────
// GRID RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function crm_render_grid(listview) {
	const $result = listview.$result;
	if (!$result?.length) return;

	_hide_native_list(listview, $result);

	const $host = _get_or_create_host($result);
	$host.empty();

	const data = listview.data || [];
	const shell = _build_grid_shell(data);

	const toolbar = _build_toolbar();
	$host.append(toolbar).append(shell);

	crm_bind_events(listview, shell, $host);
}

function _hide_native_list(listview, $result) {
	$result.find(
		".result-list, .list-row-head, .list-row-container, .list-row, .no-result"
	).hide();
	listview.$page.find(".list-row-head, .list-headers").hide();
}

function _get_or_create_host($result) {
	let $host = $result.closest("[data-page-route]").find(".crm-grid-host");
	if (!$host.length) {
		$host = $(`<div class="crm-grid-host"></div>`);
		$result.before($host);
	}
	return $host;
}

function _build_grid_shell(data) {
	const shell = document.createElement("div");
	shell.className = "crm-grid-shell";

	// Fixed px tracks prevent the "stacked into one column" browser bug.
	// Track 0 = row-number gutter; tracks 1…N = data columns.
	const tracks = [
		"42px",
		...CRM_COLUMNS.map(col => `${crm_stored_col_width(col.field) || col.width || 120}px`),
	];
	shell.style.gridTemplateColumns = tracks.join(" ");

	shell.innerHTML = _build_header_html() + _build_body_html(data);
	return shell;
}

function _build_header_html() {
	const cells = CRM_COLUMNS.map(col =>
		`<div class="crm-grid-cell crm-grid-headcell" data-field="${col.field}">
			${__(col.label)}
			<span class="crm-col-resize" data-field="${col.field}"></span>
		</div>`
	).join("");
	return `<div class="crm-grid-cell crm-grid-rownum crm-grid-headcell">#</div>${cells}`;
}

function _build_body_html(data) {
	if (!data.length) {
		return `<div class="crm-grid-empty" style="grid-column:1 / -1">${__("No records yet — add your first row below.")}</div>`;
	}
	return data.map((doc, i) => _build_row_html(doc, i)).join("");
}

function _build_row_html(doc, index) {
	const cells = CRM_COLUMNS.map(col =>
		`<div class="crm-grid-cell crm-data-cell" data-row="${doc.name}" data-field="${col.field}">${crm_render_cell(col, doc)}</div>`
	).join("");

	return `
		<div class="crm-grid-cell crm-grid-rownum" data-row="${doc.name}">
			<span class="crm-rownum-text">${index + 1}</span>
			<button class="crm-row-del" data-name="${doc.name}" title="${__("Delete row")}">×</button>
		</div>
		${cells}`;
}

function _build_toolbar() {
	const toolbar = document.createElement("div");
	toolbar.className = "crm-grid-toolbar";
	toolbar.innerHTML = `
		<button class="btn btn-default btn-sm crm-add-row-btn">
			<span class="crm-add-icon">+</span> ${__("Add Row")}
		</button>`;
	return toolbar;
}

// ─────────────────────────────────────────────────────────────────────────────
// CELL RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function crm_render_cell(col, doc) {
	const raw  = doc[col.field];
	const name = doc.name;

	switch (col.type) {
		case "select":  return _render_select(col, name, raw);
		case "avatar":  return _render_avatar(col, name, raw);
		case "date":    return _render_date(raw);
		case "maps":    return _render_maps(col, name, raw);
		case "area":    return _render_area(col, name, raw);
		case "attach":  return _render_attach(name, raw);
		default:        return _render_text(col, name, raw);
	}
}

function _render_select(col, name, raw) {
	const opts = col.options.map(o =>
		`<option value="${o}"${o === raw ? " selected" : ""}>${__(o)}</option>`
	).join("");
	return `<select class="crm-cell-input crm-cell-select" data-name="${name}" data-field="${col.field}">${opts}</select>`;
}

function _render_avatar(col, name, raw) {
	const initial     = raw ? raw.charAt(0).toUpperCase() : "?";
	const hue         = raw ? [...raw].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 210;
	const isGrey      = col.variant === "grey";
	const avatarClass = isGrey ? "crm-avatar crm-avatar--grey" : "crm-avatar";
	const hueStyle    = isGrey ? "" : `style="--h:${hue}"`;
	const placeholder = isGrey ? "employee..." : "user...";

	return `
		<div class="crm-avatar-wrap">
			<div class="${avatarClass}" ${hueStyle} title="${frappe.utils.escape_html(raw || "")}">${initial}</div>
			<input type="text" class="crm-cell-input crm-avatar-input"
				data-name="${name}" data-field="${col.field}"
				value="${frappe.utils.escape_html(raw || "")}"
				placeholder="${placeholder}">
		</div>`;
}

function _render_date(raw) {
	return `<div class="crm-cell-date" title="${frappe.utils.escape_html(raw || "")}">${crm_fmt_date(raw)}</div>`;
}

const SVG = {
	map: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
	pen: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
	clip: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
	file: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

function _render_maps(col, name, raw) {
	const escaped = frappe.utils.escape_html(raw || "");
	const mapBtn  = raw
		? `<a href="${escaped}" target="_blank" class="crm-icon-btn crm-map-open" title="Open map">${SVG.map}</a>`
		: `<span class="crm-icon-btn crm-map-open crm-icon-btn--disabled" title="No URL set">${SVG.map}</span>`;

	return `
		<div class="crm-map-cell">
			<span class="crm-map-display" title="${escaped}">${raw ? "URL set" : "<span class='crm-muted-text'>No URL</span>"}</span>
			<input type="text" class="crm-cell-input crm-map-input"
				data-name="${name}" data-field="${col.field}"
				value="${escaped}" placeholder="Paste Google Maps URL..." style="display:none">
			<button class="crm-icon-btn crm-map-pen" data-name="${name}" title="Edit URL">${SVG.pen}</button>
			${mapBtn}
		</div>`;
}

function _render_area(col, name, raw) {
	return `<textarea class="crm-cell-input crm-cell-area"
		data-name="${name}" data-field="${col.field}"
		rows="1" placeholder="…">${frappe.utils.escape_html(raw || "")}</textarea>`;
}

function _render_attach(name, raw) {
	const count = Array.isArray(raw) ? raw.length : 0;
	const badge = count ? `<span class="crm-attach-badge">${count}</span>` : "";
	return `<button class="crm-attach-btn" data-name="${name}" title="${count} attachment(s)">${SVG.clip}${badge}</button>`;
}

function _render_text(col, name, raw) {
	// Display as a SPAN so the column auto-fits to real text width.
	// Clicking activates an inline <input>; blur commits.
	const inputType = col.type === "tel" ? "tel" : col.type === "email" ? "email" : "text";
	const val       = frappe.utils.escape_html(raw || "");
	const display   = raw ? val : `<span class="crm-cell-placeholder">${__(col.label)}</span>`;

	return `<span class="crm-cell-display"
		data-name="${name}" data-field="${col.field}" data-type="${inputType}"
		tabindex="0" title="${val}">${display}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT BINDING
// ─────────────────────────────────────────────────────────────────────────────

function crm_bind_events(listview, shell, $host) {
	const $shell = $(shell);

	_bind_row_hover($shell);
	_bind_textarea_autogrow($shell);
	_init_last_saved_vals($shell);

	const handle_update = _make_update_handler(listview);
	$shell.on("change.crm", ".crm-cell-select", handle_update);
	$shell.on("blur.crm",   ".crm-cell-input:not(.crm-cell-select)", handle_update);
	$shell.on("keydown.crm", "input.crm-cell-input", (e) => {
		if (e.key === "Enter") { e.preventDefault(); $(e.currentTarget).blur(); }
	});

	_bind_click_to_edit($shell, listview, handle_update);
	_bind_add_row($host, listview);
	_bind_attachments($shell, listview);
	_bind_maps_toggle($shell);
	_bind_delete_row($shell, listview);
	_bind_col_resize($shell, shell);
}

function _bind_row_hover($shell) {
	$shell.on("mouseenter.crm", ".crm-grid-cell[data-row]", function () {
		$shell.find(`.crm-grid-cell[data-row="${$(this).attr("data-row")}"]`).addClass("crm-row-hover");
	});
	$shell.on("mouseleave.crm", ".crm-grid-cell[data-row]", function () {
		$shell.find(`.crm-grid-cell[data-row="${$(this).attr("data-row")}"]`).removeClass("crm-row-hover");
	});
}

function _bind_textarea_autogrow($shell) {
	const autogrow = function () {
		this.style.height = "auto";
		this.style.height = `${this.scrollHeight}px`;
	};
	$shell.on("input.crm", ".crm-cell-area", autogrow);
	$shell.find(".crm-cell-area").each(autogrow);
}

function _init_last_saved_vals($shell) {
	// Seed last-saved-val so the first blur isn't a false dirty hit.
	$shell.find(".crm-cell-input[data-field]").each(function () {
		$(this).data("last-saved-val", ($(this).val() || "").trim());
	});
}

function _make_update_handler(listview) {
	return function () {
		const $el      = $(this);
		const docname  = $el.attr("data-name");
		const fieldname = $el.attr("data-field");
		const val      = ($el.val() || "").trim();

		if (!docname || !fieldname) return;
		if ($el.data("last-saved-val") === val) return;

		if (val !== "") {
			if (fieldname === "company_name") { crm_upsert_company_and_save(docname, val, listview, $el);  return; }
			if (fieldname === "user")         { crm_upsert_user_and_save(docname, val, listview, $el);     return; }
			if (fieldname === "assigned_to")  { crm_upsert_employee_and_save(docname, val, listview, $el); return; }
		}

		crm_fast_save(listview, docname, fieldname, val, $el);
	};
}

function _bind_click_to_edit($shell, listview, handle_update) {
	const activate = ($span, typedChar) => {
		if ($span.data("editing")) return;
		$span.data("editing", true);

		const docname   = $span.attr("data-name");
		const fieldname = $span.attr("data-field");
		const type      = $span.attr("data-type") || "text";
		const current   = $span.attr("title") || "";

		const $input = $(`<input type="${type}" class="crm-cell-input crm-cell-input--inline">`)
			.val(typedChar != null ? typedChar : current)
			.attr({ "data-name": docname, "data-field": fieldname })
			.data("last-saved-val", current.trim());

		$span.replaceWith($input);
		$input.trigger("focus");
		if (typedChar == null) $input[0].select();
		else $input[0].setSelectionRange($input.val().length, $input.val().length);

		$input.on("blur.crminline", function () {
			const unchanged = $input.data("last-saved-val") === ($input.val() || "").trim();
			handle_update.call(this);
			if (unchanged) crm_render_grid(listview);
		});
		$input.on("keydown.crminline", (e) => {
			if (e.key === "Enter")  { e.preventDefault(); $input.trigger("blur"); }
			if (e.key === "Escape") { e.preventDefault(); $input.off("blur.crminline"); crm_render_grid(listview); }
		});
	};

	$shell.on("click.crm",   ".crm-cell-display", function () { activate($(this), null); });
	$shell.on("keydown.crm", ".crm-cell-display", function (e) {
		if (e.key === "Enter") { e.preventDefault(); activate($(this), null); }
		else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault(); activate($(this), e.key);
		}
	});
}

function _bind_add_row($host, listview) {
	// Unbind first to guard against double-binding across re-renders.
	$host.off("click.crmadd").on("click.crmadd", ".crm-add-row-btn", () => {
		crm_add_blank_row_instantly(listview);
	});
}

function _bind_attachments($shell, listview) {
	$shell.on("click.crm", ".crm-attach-btn", function () {
		crm_open_attachments_dialog(listview, $(this).attr("data-name"));
	});
}

function _bind_maps_toggle($shell) {
	$shell.on("click.crm", ".crm-map-pen", function (e) {
		e.stopPropagation();
		const $cell    = $(this).closest(".crm-map-cell");
		const $input   = $cell.find(".crm-map-input");
		const $display = $cell.find(".crm-map-display");
		const editing  = $input.is(":visible");

		if (editing) {
			$input.hide(); $display.show(); $input.blur();
		} else {
			$display.hide(); $input.show().focus().select();
		}
	});
}

function _bind_delete_row($shell, listview) {
	$shell.on("click.crm", ".crm-row-del", function (e) {
		e.stopPropagation();
		crm_delete_row(listview, $(this).attr("data-name"));
	});
}

function _bind_col_resize($shell, shell) {
	$shell.on("mousedown.crm", ".crm-col-resize", function (e) {
		e.preventDefault(); e.stopPropagation();

		const field   = $(this).attr("data-field");
		const startX  = e.pageX;
		const startW  = $shell.find(`.crm-grid-headcell[data-field="${field}"]`).outerWidth();
		const colIndex = CRM_COLUMNS.findIndex(c => c.field === field) + 1;

		$("body").css("user-select", "none");
		$shell.addClass("crm-col-resizing");

		const onMove = (ev) => {
			const newW   = Math.max(48, startW + (ev.pageX - startX));
			const tracks = shell.style.gridTemplateColumns.split(" ");
			tracks[colIndex] = `${newW}px`;
			shell.style.gridTemplateColumns = tracks.join(" ");
			CRM_COL_WIDTHS[field] = newW;
		};
		const onUp = () => {
			$(document).off("mousemove.crmcol mouseup.crmcol");
			$("body").css("user-select", "");
			$shell.removeClass("crm-col-resizing");
			crm_persist_col_widths();
		};

		$(document).on("mousemove.crmcol", onMove).on("mouseup.crmcol", onUp);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

function crm_add_blank_row_instantly(listview) {
	frappe.call({
		method: "frappe.client.insert",
		args: {
			doc: { doctype: "CRM Log", status: "Open", date: frappe.datetime.now_datetime() },
		},
		callback: ({ exc, message }) => {
			if (exc || !message) return;
			frappe.show_alert({ message: __("New Row Added"), indicator: "green" }, 1.2);
			// Push straight into local data and re-render — avoids the async gap
			// that listview.refresh() opens, which collapses the grid briefly.
			if (!Array.isArray(listview.data)) listview.data = [];
			listview.data.push(message);
			crm_render_grid(listview);
		},
	});
}

function crm_delete_row(listview, docname) {
	frappe.confirm(__("Delete row {0}? This cannot be undone.", [docname]), () => {
		frappe.call({
			method: "frappe.client.delete",
			args: { doctype: "CRM Log", name: docname },
			callback: ({ exc }) => {
				if (exc) return;
				frappe.show_alert({ message: __("Row deleted"), indicator: "red" }, 1.2);
				listview.data = (listview.data || []).filter(d => d.name !== docname);
				crm_render_grid(listview);
			},
		});
	});
}

function crm_fast_save(listview, docname, fieldname, val, $el) {
	frappe.call({
		method: "frappe.client.set_value",
		args: { doctype: "CRM Log", name: docname, fieldname, value: val },
		callback: ({ exc }) => {
			if (exc) return;
			if ($el) $el.data("last-saved-val", val);
			frappe.show_alert({ message: __("Saved"), indicator: "green" }, 0.8);
			crm_apply_local_update(listview, docname, fieldname, val);
		},
	});
}

/**
 * Patches the local row and re-renders in place.
 * No page reload, no native list refresh — no flash, no scroll jump.
 */
function crm_apply_local_update(listview, docname, fieldname, value) {
	const row = (listview.data || []).find(d => d.name === docname);
	if (row) row[fieldname] = value;
	crm_render_grid(listview);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT HELPERS — link-or-create for Company / User / Employee
// ─────────────────────────────────────────────────────────────────────────────

function crm_upsert_company_and_save(crm_docname, company_value, listview, $el, done) {
	frappe.db.get_value("Company", { company_name: company_value }, "name", (r) => {
		if (r?.name) {
			crm_save_linked_field(listview, crm_docname, "company_name", r.name, company_value, $el, done);
			return;
		}

		frappe.show_alert({ message: __("Creating company '{0}'...", [company_value]), indicator: "orange" }, 1.0);
		const abbr = company_value.substring(0, 4).replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "NEW";

		frappe.call({
			method: "frappe.client.insert",
			args: { doc: {
				doctype: "Company",
				company_name: company_value,
				abbr,
				default_currency: frappe.defaults.get_default("currency") || "USD",
			}},
			callback: ({ exc, message }) => {
				if (!exc && message) {
					frappe.show_alert({ message: __("Company '{0}' Created", [company_value]), indicator: "green" }, 1.2);
					crm_save_linked_field(listview, crm_docname, "company_name", message.name, company_value, $el, done);
				} else {
					done?.();
				}
			},
			error: () => done?.(),
		});
	});
}

function crm_upsert_user_and_save(crm_docname, user_value, listview, $el) {
	const filter = user_value.includes("@") ? { name: user_value } : { full_name: user_value };

	frappe.db.get_value("User", filter, "name", (r) => {
		if (r?.name) {
			crm_save_linked_field(listview, crm_docname, "user", r.name, user_value, $el);
			return;
		}

		frappe.show_alert({ message: __("Creating user '{0}'...", [user_value]), indicator: "orange" }, 1.0);
		const is_email  = user_value.includes("@");
		const email     = is_email ? user_value : `${user_value.toLowerCase().replace(/\s+/g, "")}@example.com`;
		const full_name = is_email ? user_value.split("@")[0] : user_value;

		frappe.call({
			method: "frappe.client.insert",
			args: { doc: { doctype: "User", email, first_name: full_name, send_welcome_email: 0 } },
			callback: ({ exc, message }) => {
				if (!exc && message) {
					frappe.show_alert({ message: __("User '{0}' Created", [user_value]), indicator: "green" }, 1.2);
					crm_save_linked_field(listview, crm_docname, "user", message.name, user_value, $el);
				}
			},
		});
	});
}

function crm_upsert_employee_and_save(crm_docname, employee_value, listview, $el) {
	frappe.db.get_value("Employee", { first_name: employee_value }, "name", (r) => {
		if (r?.name) {
			crm_save_linked_field(listview, crm_docname, "assigned_to", r.name, employee_value, $el);
			return;
		}

		frappe.show_alert({ message: __("Creating employee '{0}'...", [employee_value]), indicator: "orange" }, 1.0);
		const row_company = listview.data.find(d => d.name === crm_docname)?.company_name || "";

		const insert_employee = (company) => {
			frappe.call({
				method: "frappe.client.insert",
				args: { doc: {
					doctype: "Employee",
					first_name: employee_value,
					company: company || frappe.defaults.get_default("company") || "",
				}},
				callback: ({ exc, message }) => {
					if (!exc && message) {
						frappe.show_alert({ message: __("Employee '{0}' Created", [employee_value]), indicator: "green" }, 1.2);
						crm_save_linked_field(listview, crm_docname, "assigned_to", message.name, employee_value, $el);
					}
				},
			});
		};

		if (row_company) {
			frappe.db.get_value("Company", { company_name: row_company }, "name",
				(comp) => insert_employee(comp?.name || "")
			);
		} else {
			insert_employee("");
		}
	});
}

function crm_save_linked_field(listview, docname, fieldname, actual_value, input_string, $el, done) {
	frappe.call({
		method: "frappe.client.set_value",
		args: { doctype: "CRM Log", name: docname, fieldname, value: actual_value },
		callback: ({ exc }) => {
			if (!exc) {
				if ($el) $el.data("last-saved-val", input_string);
				frappe.show_alert({ message: __("Linked"), indicator: "green" }, 0.8);
				crm_apply_local_update(listview, docname, fieldname, actual_value);
			}
			done?.();
		},
		error: () => done?.(),
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTACHMENTS DIALOG
// Fetches the full doc (child tables included) so the badge count is accurate —
// add_fields does NOT return child table data.
// ─────────────────────────────────────────────────────────────────────────────

function crm_open_attachments_dialog(listview, docname) {
	const dialog = new frappe.ui.Dialog({
		title: __("Attachments — {0}", [docname]),
		size: "large",
		fields: [{ fieldname: "attach_html", fieldtype: "HTML" }],
		primary_action_label: __("Save"),
		primary_action() {
			const collected = [];
			dialog.$wrapper.find(".crm-attach-dlg-row").each(function () {
				const label = $(this).find(".crm-attach-label").val().trim();
				const url   = $(this).find(".crm-attach-url").val().trim();
				if (label || url) collected.push({ label, url });
			});

			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "CRM Log",
					name: docname,
					fieldname: CRM_ATTACH_TABLE_FIELD,
					value: collected.map(r => ({ doctype: CRM_ATTACH_DOCTYPE, label: r.label, url: r.url })),
				},
				callback: ({ exc }) => {
					if (exc) return;
					frappe.show_alert({ message: __("Attachments saved"), indicator: "green" }, 1.0);
					const localDoc = (listview.data || []).find(d => d.name === docname);
					if (localDoc) localDoc[CRM_ATTACH_TABLE_FIELD] = collected;
					crm_render_grid(listview);
					dialog.hide();
				},
			});
		},
	});

	dialog.show();

	frappe.call({
		method: "frappe.client.get",
		args: { doctype: "CRM Log", name: docname },
		callback: ({ exc, message }) => {
			const $wrapper = dialog.fields_dict.attach_html.$wrapper;
			if (exc || !message) {
				$wrapper.html(`<p style="color:#c0392b">${__("Could not load attachments.")}</p>`);
				return;
			}
			const rows = Array.isArray(message[CRM_ATTACH_TABLE_FIELD])
				? message[CRM_ATTACH_TABLE_FIELD].map(row => ({ label: row.label || "", url: row.url || "" }))
				: [];
			_render_attach_dialog_body(dialog, rows);
		},
	});
}

function _render_attach_dialog_body(dialog, rows) {
	const $body = dialog.fields_dict.attach_html.$wrapper;

	const savedRows   = rows.filter(r => r.url);
	const previewHtml = savedRows.length
		? `<div class="crm-att-preview-section">
			<div class="crm-att-preview-label">${__("Preview")}</div>
			<div class="crm-att-preview-list">${savedRows.map(_attach_preview_item).join("")}</div>
		</div><hr class="crm-att-divider">`
		: "";

	$body.html(`
		<style>
			.crm-attach-dlg-head, .crm-attach-dlg-row { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
			.crm-attach-dlg-head { font-size:11px; text-transform:uppercase; color:#8d96a0; letter-spacing:.04em; margin-bottom:8px; }
			.crm-attach-col-label, .crm-attach-label { flex:0 0 160px; }
			.crm-attach-col-url,   .crm-attach-url   { flex:1 1 auto; }
			.crm-attach-col-act,   .crm-attach-del   { flex:0 0 32px; text-align:center; }
			.crm-attach-dlg input  { width:100%; }
			.crm-attach-del { cursor:pointer; color:#c0392b; background:none; border:none; font-size:16px; }
			.crm-attach-add { margin-top:4px; }
			.crm-att-preview-section { margin-bottom:12px; }
			.crm-att-preview-label  { font-size:11px; text-transform:uppercase; color:#8d96a0; letter-spacing:.04em; margin-bottom:8px; }
			.crm-att-preview-list   { display:flex; flex-wrap:wrap; gap:10px; }
			.crm-att-thumb-wrap     { display:flex; flex-direction:column; align-items:center; gap:4px; text-decoration:none; color:inherit; max-width:90px; }
			.crm-att-thumb          { width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid #e2e6ea; transition:opacity .12s; }
			.crm-att-thumb:hover    { opacity:.85; }
			.crm-att-thumb-label    { font-size:10.5px; color:#8d96a0; text-align:center; width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
			.crm-att-chip           { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:6px; border:1px solid #e2e6ea; background:#f7f9fa; text-decoration:none; color:#1f272e; font-size:12px; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; transition:background .12s, border-color .12s; }
			.crm-att-chip:hover     { background:#eef2f5; border-color:#c8d0d8; }
			.crm-att-chip svg       { flex-shrink:0; color:#8d96a0; }
			.crm-att-divider        { border:none; border-top:1px solid #e2e6ea; margin:12px 0; }
		</style>
		<div class="crm-attach-dlg">
			${previewHtml}
			<div class="crm-attach-dlg-head">
				<div class="crm-attach-col-label">${__("Label")}</div>
				<div class="crm-attach-col-url">${__("Link")}</div>
				<div class="crm-attach-col-act"></div>
			</div>
			<div class="crm-attach-dlg-rows"></div>
			<button class="btn btn-xs btn-default crm-attach-add">+ ${__("Add attachment")}</button>
		</div>`);

	const $rows   = $body.find(".crm-attach-dlg-rows");
	const add_row = (label = "", url = "") => {
		const $row = $(`
			<div class="crm-attach-dlg-row">
				<input type="text" class="form-control crm-attach-label" placeholder="${__("e.g. Building Drawing")}" value="${frappe.utils.escape_html(label)}">
				<input type="text" class="form-control crm-attach-url"   placeholder="https://..."                  value="${frappe.utils.escape_html(url)}">
				<button class="crm-attach-del" title="${__("Remove")}">×</button>
			</div>`);
		$row.find(".crm-attach-del").on("click", () => $row.remove());
		$rows.append($row);
	};

	rows.forEach(r => add_row(r.label, r.url));
	if (!rows.length) add_row();

	$body.find(".crm-attach-add").on("click", () => add_row());
}

function _attach_preview_item(r) {
	const escapedUrl   = frappe.utils.escape_html(r.url);
	const escapedLabel = frappe.utils.escape_html(r.label || r.url);
	const isImage      = /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(r.url) || /\/(thumbnail|files)\//i.test(r.url);

	if (isImage) {
		return `<a href="${escapedUrl}" target="_blank" class="crm-att-thumb-wrap" title="${escapedLabel}">
			<img src="${escapedUrl}" class="crm-att-thumb" alt="${escapedLabel}">
			<span class="crm-att-thumb-label">${escapedLabel}</span>
		</a>`;
	}
	return `<a href="${escapedUrl}" target="_blank" class="crm-att-chip" title="${escapedUrl}">
		${SVG.file}<span>${escapedLabel}</span>
	</a>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function crm_fmt_date(v) {
	if (!v) return "-";
	try {
		const [datePart, timePart = "00:00:00"] = String(v).split(" ");
		const [year, month, day] = datePart.split("-");
		const [hh, mm]           = timePart.split(":");
		return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year.substring(2)} ${hh}:${mm}`;
	} catch {
		return v;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

function crm_inject_styles() {
	const existing = document.getElementById("crm-grid-styles");
	if (existing?.dataset.version === CRM_STYLE_VERSION) return;
	existing?.remove();

	const style = Object.assign(document.createElement("style"), {
		id: "crm-grid-styles",
	});
	style.dataset.version = CRM_STYLE_VERSION;
	style.textContent = `
		/* ── Hide Frappe's native list rendering ── */
		[data-doctype="CRM Log"] .result-list,
		[data-doctype="CRM Log"] .list-row-head,
		[data-doctype="CRM Log"] .list-row-container,
		[data-doctype="CRM Log"] .list-row,
		[data-doctype="CRM Log"] .list-headers,
		[data-doctype="CRM Log"] .frappe-list .list-row-head,
		[data-doctype="CRM Log"] .no-result { display: none !important; }

		/* Prevent a second scrollbar beside our grid */
		[data-doctype="CRM Log"] .result,
		[data-doctype="CRM Log"] .frappe-list .result {
			overflow: visible !important; height: auto !important; max-height: none !important;
		}

		/* Dropdowns / menus must always paint over the grid */
		.dropdown-menu,
		.menu-btn-group .dropdown-menu,
		.page-actions .dropdown-menu { z-index: 1050 !important; }

		/* HOST = single scroll container for both axes.
		   SHELL = plain CSS Grid with no overflow of its own. */
		.crm-grid-host {
			display: block; padding: 8px 0 12px;
			overflow: auto; max-height: calc(100vh - 200px);
		}
		.crm-grid-shell {
			--crm-border:     var(--border-color,   #e2e6ea);
			--crm-head-bg:    var(--fg-color,        #fff);
			--crm-row-hover:  var(--bg-light-gray,   #f7f9fa);
			--crm-text:       var(--text-color,      #1f272e);
			--crm-muted:      var(--text-muted,      #8d96a0);
			display: grid; width: max-content; min-width: 100%;
			font-size: 11.5px; color: var(--crm-text);
			border: 1px solid var(--crm-border); border-radius: 10px;
			background: var(--card-bg, #fff);
		}

		.crm-grid-cell {
			display: flex; align-items: center;
			padding: 2px 5px;
			border-right: 1px solid var(--crm-border);
			border-bottom: 1px solid var(--crm-border);
			min-height: 30px; min-width: 0; overflow: hidden;
		}
		.crm-grid-headcell {
			position: sticky; top: 0; z-index: 10;
			justify-content: center; text-align: center;
			padding: 6px; background: var(--crm-head-bg);
			font-weight: 600; color: var(--crm-muted);
			text-transform: uppercase; letter-spacing: 0.03em;
			font-size: 9.5px; white-space: nowrap;
		}

		/* Column resize handle */
		.crm-col-resize {
			position: absolute; top: 0; right: -3px; width: 7px; height: 100%;
			cursor: col-resize; z-index: 12; user-select: none;
		}
		.crm-col-resize:hover          { background: rgba(36,144,239,0.35); }
		.crm-col-resizing              { cursor: col-resize; }
		.crm-col-resizing .crm-cell-input { pointer-events: none; }

		/* Row number gutter */
		.crm-grid-rownum {
			justify-content: center; color: var(--crm-muted);
			font-variant-numeric: tabular-nums;
			background: var(--crm-head-bg);
			position: sticky; left: 0; z-index: 5;
		}
		.crm-grid-headcell.crm-grid-rownum { z-index: 11; }

		/* Delete button — hidden until row hover */
		.crm-row-del {
			display: none; border: none; background: none; cursor: pointer;
			color: #c0392b; font-size: 16px; line-height: 1;
			padding: 0; width: 100%; text-align: center;
		}
		.crm-row-del:hover                       { color: #e74c3c; }
		.crm-grid-rownum:hover .crm-rownum-text  { display: none; }
		.crm-grid-rownum:hover .crm-row-del      { display: block; }

		/* Row hover */
		.crm-grid-cell.crm-row-hover,
		.crm-grid-rownum.crm-row-hover { background: var(--crm-row-hover); }

		/* Inputs */
		.crm-cell-input {
			width: 100%; min-width: 0;
			border: 1px solid transparent; background: transparent;
			padding: 3px 5px; font-size: 11px; border-radius: 5px;
			color: var(--crm-text);
			transition: border-color .12s ease, background .12s ease, box-shadow .12s ease;
			box-sizing: border-box; font-family: inherit;
			text-align: center; text-overflow: ellipsis;
		}
		.crm-cell-input:hover { border-color: var(--crm-border); }
		.crm-cell-input:focus {
			border-color: var(--primary, #2490ef);
			background: var(--fg-color, #fff);
			box-shadow: 0 0 0 3px rgba(36,144,239,0.12);
			outline: none;
		}

		/* Click-to-edit display span */
		.crm-cell-display {
			width: 100%; min-width: 0; text-align: center;
			white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
			padding: 4px 6px; border: 1px solid transparent; border-radius: 6px;
			cursor: text; color: var(--crm-text);
		}
		.crm-cell-display:hover  { border-color: var(--crm-border); }
		.crm-cell-display:focus  { outline: none; border-color: var(--primary, #2490ef); box-shadow: 0 0 0 3px rgba(36,144,239,0.12); }
		.crm-cell-placeholder    { color: var(--crm-muted); opacity: 0.55; }
		.crm-cell-input--inline  { text-align: center; }

		.crm-cell-select {
			width: auto; max-width: 100%; font-weight: 500;
			cursor: pointer; appearance: none;
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238d96a0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
			background-repeat: no-repeat; background-position: right 6px center; padding-right: 18px;
		}

		/* Textarea */
		.crm-cell-area { resize: none; overflow: hidden; line-height: 1.4; min-height: 28px; white-space: pre-wrap; }
		.crm-grid-cell:has(.crm-cell-area) { align-items: flex-start; overflow: visible; }

		/* Date */
		.crm-cell-date {
			padding: 5px 7px; color: var(--crm-muted);
			white-space: nowrap; font-variant-numeric: tabular-nums; align-self: center;
		}

		/* Avatar */
		.crm-avatar-wrap  { position: relative; display: flex; align-items: center; width: 100%; }
		.crm-avatar {
			width: 30px; height: 30px; border-radius: 50%;
			background: hsl(var(--h, 210), 58%, 52%);
			color: #fff; font-weight: 700; font-size: 13px;
			display: flex; align-items: center; justify-content: center;
			flex-shrink: 0; cursor: text; user-select: none; transition: opacity .12s ease;
		}
		.crm-avatar-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
		.crm-avatar--grey { background: var(--gray-500, #8d96a0); }
		.crm-avatar-input:focus { opacity: 1; box-shadow: 0 0 0 3px rgba(36,144,239,0.12); border-color: var(--primary, #2490ef); background: var(--fg-color,#fff); }
		.crm-avatar-wrap:focus-within .crm-avatar { opacity: 0; }

		/* Maps cell */
		.crm-map-cell    { display: flex; align-items: center; gap: 4px; width: 100%; overflow: hidden; }
		.crm-map-display { flex: 1; font-size: 12px; color: var(--crm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px; }
		.crm-muted-text  { color: var(--crm-muted); font-style: italic; }
		.crm-map-input   { flex: 1; min-width: 0; }

		/* Shared icon button */
		.crm-icon-btn {
			flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
			width: 26px; height: 26px; border: 1px solid transparent; border-radius: 6px;
			background: transparent; cursor: pointer; color: var(--crm-muted);
			transition: background .12s, border-color .12s, color .12s; text-decoration: none;
		}
		.crm-icon-btn:hover       { background: var(--control-bg, #f4f5f6); border-color: var(--crm-border); color: var(--crm-text); }
		.crm-icon-btn--disabled   { opacity: 0.3; cursor: default; pointer-events: none; }
		.crm-map-open:hover       { color: var(--primary, #2490ef); }

		/* Attachments button */
		.crm-attach-btn {
			position: relative; display: inline-flex; align-items: center; justify-content: center;
			width: 22px; height: 22px; border: 1px solid transparent; border-radius: 5px;
			background: transparent; cursor: pointer; color: var(--crm-muted);
			transition: background .12s, border-color .12s, color .12s;
		}
		.crm-attach-btn:hover { background: var(--control-bg, #f4f5f6); border-color: var(--crm-border); color: var(--crm-text); }
		.crm-attach-badge {
			position: absolute; top: -4px; right: -5px;
			min-width: 14px; height: 14px; padding: 0 3px;
			background: var(--primary, #2490ef); color: #fff;
			font-size: 9px; font-weight: 700; line-height: 14px;
			border-radius: 7px; box-sizing: border-box;
		}

		/* Add-row toolbar */
		.crm-grid-toolbar  { display: flex; align-items: center; margin-bottom: 8px; margin-left: 2px; }
		.crm-add-row-btn   { display: inline-flex; align-items: center; gap: 6px; }
		.crm-add-icon      { font-size: 14px; line-height: 1; font-weight: 600; }

		.crm-grid-empty {
			padding: 40px 20px; text-align: center; color: var(--crm-muted);
			position: sticky; left: 0; width: 100%;
		}

		/* ── Small screen compact mode (≤ 1280px, typical 13" MacBook) ── */
		@media (max-width: 1280px) {
			.crm-grid-shell    { font-size: 10.5px; }
			.crm-grid-cell     { padding: 1px 4px; min-height: 26px; }
			.crm-grid-headcell { padding: 5px 4px; font-size: 9px; letter-spacing: 0.02em; }
			.crm-cell-input,
			.crm-cell-display,
			.crm-cell-date     { font-size: 10.5px; padding: 2px 4px; }
			.crm-avatar        { width: 24px; height: 24px; font-size: 11px; }
			.crm-cell-select   { font-size: 10.5px; padding: 2px 14px 2px 4px; }
			.crm-grid-rownum   { font-size: 10px; }
			.crm-attach-btn    { width: 18px; height: 18px; }
			.crm-stack-main    { font-size: 11px; }
			.crm-stack-sub     { font-size: 9.5px; }
		}
	`;
	document.head.appendChild(style);
}