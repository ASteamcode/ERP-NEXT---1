// Site Survey — List View (built on GL)

const SS_COLUMNS = [
	{ field: "status",          label: "Status",        type: "select",  width: 130, options: ["Draft", "Scheduled", "In Progress", "Completed", "Cancelled"] },
	{ field: "survey_date",     label: "Date",          type: "date",    width: 110 },
	{ field: "assigned_to",     label: "Surveyor",      type: "avatar",  width: 60,  link_doctype: "Employee", link_namefield: "employee_name", variant: "grey" },
	{ field: "customer",        label: "Customer",      type: "link",    width: 150, link_doctype: "Customer" },
	{ field: "lead",            label: "Lead",          type: "link",    width: 150, link_doctype: "Lead" },
	{ field: "contact",         label: "Contact",       type: "link",    width: 150, link_doctype: "Contact" },
	{ field: "site_location",   label: "Site Location", type: "text",    width: 160 },
	{ field: "google_maps_url", label: "Maps",          type: "maps",    width: 120 },
	{ field: "site_type",       label: "Site Type",     type: "select",  width: 120, options: ["", "Residential", "Commercial", "Industrial"] },
	{ field: "roof_type",       label: "Roof Type",     type: "select",  width: 110, options: ["", "Flat", "Pitched", "Mixed", "N/A"] },
	{ field: "site_area",       label: "Area (m²)",     type: "number",  width: 100 },
	{ field: "notes",           label: "Notes",         type: "area",    width: 260 },
	{ field: "updates",         label: "Updates",       type: "area",    width: 260 },
	{ field: "attachments",     label: "Files",         type: "attach",  width: 52  },
	{ field: "drawing",         label: "Drawing",       type: "drawing", width: 52  },
	{ field: "measurements",    label: "MTO",           type: "measure", width: 52  },
];

const SS_LINK_CONFIG = {
	Employee: {
		doctype: "Employee", fields: ["name", "employee_name", "company"],
		searchfield: "employee_name", primary: "employee_name", sub: "company", id: "name",
	},
};

const SS_ADD_FIELDS = [
	...SS_COLUMNS.filter(c => !["drawing", "measurements"].includes(c.field)).map(c => c.field),
	"name", "has_drawing", "has_measurements",
];

frappe.listview_settings["Site Survey"] = {
	hide_name_column: true,
	add_fields: SS_ADD_FIELDS,

	onload(listview) {
		GL.suppressRefresh(listview);
	},

	refresh(listview) {
		GL.suppressRefresh(listview);
		GL.hideNative(listview);

		const lnc    = GL.makeLinkNameCache();
		const cw     = GL.makeColWidths("ss_col_widths");
		const attCnt = GL.makeCountCache();
		const mtoCnt = GL.makeCountCache();
		const host   = GL.bootstrap(listview, { doctype: "Site Survey" });
		if (!host) return;

		lnc.onResolve = () => ss_render(listview, host, lnc, cw, attCnt, mtoCnt);
		ss_render(listview, host, lnc, cw, attCnt, mtoCnt);
	},
};

// ── Render ────────────────────────────────────────────────────────────────────

function ss_render(listview, host, lnc, cw, attCnt, mtoCnt) {
	const rows   = listview.data || [];
	const getTpl = () => GL.gridTpl(SS_COLUMNS, cw.widths);
	const saveFn = (name, field, value) => GL.fastSave("Site Survey", name, field, value);

	const headerCells = SS_COLUMNS.map((c, i) =>
		`<div class="gl-cell gl-hdr" style="justify-content:${["avatar","attach","drawing","measure"].includes(c.type)?'center':'flex-start'}">` +
		`${__(c.label)}<div class="gl-rh" data-col="${i}"></div></div>`
	).join("");

	const bodyHtml = rows.length
		? rows.map((doc, ri) =>
			GL.rnCell(doc, ri) +
			SS_COLUMNS.map(c => `<div class="gl-cell" data-name="${doc.name}">${ss_cell(c, doc, lnc, attCnt, mtoCnt)}</div>`).join("")
		).join("")
		: `<div class="gl-empty" style="grid-column:1/-1">${__("No records")}</div>`;

	host.innerHTML =
		`<div class="gl-toolbar">` +
		`<button class="btn btn-sm btn-primary gl-add-btn"><span class="gl-add-icon">+</span> ${__("New Site Survey")}</button>` +
		`</div>` +
		`<div class="gl-grid gl-grid--scroll" style="grid-template-columns:${getTpl()}">` +
		GL.rnHeader() + headerCells + bodyHtml +
		`</div>`;

	const $host = $(host);
	const $grid = $host.find(".gl-grid");
	const esm   = GL.editState($grid);
	const rerender = () => ss_render(listview, host, lnc, cw, attCnt, mtoCnt);

	GL.bindHover($grid);
	GL.bindDelete($grid, "Site Survey", listview, rerender);
	GL.bindColResize($grid, SS_COLUMNS, cw.widths, getTpl, cw.save);
	GL.bindOutsideClick($grid, esm, "ss");
	GL.bindTextEdit($grid, rows, saveFn, esm);
	GL.bindDateEdit($grid, rows, saveFn, esm);
	GL.bindLinkEdit($grid, rows, saveFn, esm);
	GL.bindSelectChange($grid, rows, saveFn);
	GL.bindAreaAutogrow($grid);
	GL.bindAreaSave($grid, rows, saveFn);
	GL.bindMapsToggle($grid);
	GL.bindMapsEdit($grid, rows, saveFn);
	GL.bindNumberChange($grid, rows, saveFn);
	GL.bindAvatarAutocomplete($grid, SS_LINK_CONFIG, ss_avatar_save(listview, rerender), lnc);
	GL.bindDrawings($grid, { doctype: "Site Survey", drawingField: "drawing", hasDrawingField: "has_drawing" }, listview, rerender);
	GL.bindAttachments($grid, {
		doctype: "Site Survey", attachDoctype: "Site Survey Attachment",
		attachTableField: "attachments", attachCounts: attCnt, uploadable: true,
	}, listview, rerender);
	GL.bindMeasurements($grid, {
		doctype: "Site Survey", measureDoctype: "Site Survey Measurement",
		measureTableField: "measurements", measureCounts: mtoCnt,
	}, listview, rerender);

	GL.bindAddRow($host, () => ss_add_row(listview, host, lnc, cw, attCnt, mtoCnt));
}

// ── Cell renderer dispatch ────────────────────────────────────────────────────

function ss_cell(col, doc, lnc, attCnt, mtoCnt) {
	const raw = doc[col.field];
	switch (col.type) {
		case "select":  return GL.renderSelect(col, doc.name, raw);
		case "date":    return GL.renderDate(col, doc.name, raw);
		case "avatar":  return GL.renderAvatar(col, doc.name, raw, lnc);
		case "link":    return GL.renderLink(col, doc.name, raw);
		case "maps":    return GL.renderMaps(col, doc.name, raw);
		case "area":    return GL.renderArea(col, doc.name, raw);
		case "number":  return GL.renderNumber(col, doc.name, raw);
		case "attach":  return GL.renderAttachBtn(doc.name, attCnt.fromRaw(doc.name, raw));
		case "drawing": return GL.renderDrawingBtn(doc.name, doc.has_drawing);
		case "measure": return GL.renderMeasureBtn(doc.name, doc.has_measurements, mtoCnt.get(doc.name));
		default:        return GL.renderText(col, doc.name, raw, col.type);
	}
}

// ── Avatar save (upsert Employee) ─────────────────────────────────────────────

function ss_avatar_save(listview, rerender) {
	return function (docname, field, value) {
		if (field === "assigned_to") {
			GL.upsertEmployee(value, "", id => GL.saveLinkedField("Site Survey", docname, field, id, listview, rerender));
		} else {
			GL.fastSave("Site Survey", docname, field, value).then(rerender);
		}
		return Promise.resolve();
	};
}

// ── Add row ───────────────────────────────────────────────────────────────────

function ss_add_row(listview, host, lnc, cw, attCnt, mtoCnt) {
	frappe.call({
		method: "frappe.client.insert",
		args: { doc: { doctype: "Site Survey", status: "Draft", survey_date: frappe.datetime.get_today() } },
		callback: ({ exc, message: doc }) => {
			if (exc || !doc) return;
			(listview.data = listview.data || []).push(doc);
			ss_render(listview, host, lnc, cw, attCnt, mtoCnt);
			setTimeout(() => {
				const $grid = $(host).find(".gl-grid");
				const $last = $grid.find(`.gl-cell[data-name="${doc.name}"]`).last();
				$last[0]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}, 60);
		},
	});
}
