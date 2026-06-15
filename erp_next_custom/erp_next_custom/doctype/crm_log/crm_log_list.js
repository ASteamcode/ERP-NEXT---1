// CRM Log — List View (built on GL)

const CRM_COLUMNS = [
	{ field: "status",          label: "Status",        type: "select",   width: 120, options: ["Open", "Scheduled", "Viewed", "Cancelled", "Done"] },
	{ field: "category",        label: "Category",      type: "select",   width: 150, options: ["Lead", "Site Surveys", "Measurements Take Off", "Estimation", "Quotation"] },
	{ field: "date",            label: "Created",       type: "date",     width: 130 },
	{ field: "user",            label: "User",          type: "avatar",   width: 60,  link_doctype: "User",     link_namefield: "full_name" },
	{ field: "assigned_to",     label: "To",            type: "avatar",   width: 60,  link_doctype: "Employee", link_namefield: "employee_name", variant: "grey" },
	{ field: "log_type",        label: "Type",          type: "select",   width: 130, options: ["Inbound call", "Quotation", "Field", "Job", "Transport", "Yard"] },
	{ field: "prefix",          label: "Pre",           type: "select",   width: 64,  options: ["Mr", "Ms", "Mrs", "Dr", "Eng", "Arch"] },
	{ field: "first_name",      label: "Name",          type: "text",     width: 120 },
	{ field: "last_name",       label: "Surname",       type: "text",     width: 120 },
	{ field: "company_name",    label: "Company",       type: "text",     width: 140 },
	{ field: "mobile",          label: "Mobile",        type: "tel",      width: 130 },
	{ field: "tel",             label: "Tel",           type: "tel",      width: 120 },
	{ field: "email",           label: "Email",         type: "email",    width: 180 },
	{ field: "description",     label: "Description",   type: "area",     width: 280 },
	{ field: "updates",         label: "Update(s)",     type: "area",     width: 280 },
	{ field: "site_location",   label: "Site Location", type: "text",     width: 120 },
	{ field: "google_maps_url", label: "Maps",          type: "maps",     width: 130 },
	{ field: "attachments",     label: "Files",         type: "attach",   width: 52  },
	{ field: "drawing",         label: "Drawing",       type: "drawing",  width: 52  },
];

const CRM_LINK_CONFIG = {
	User: {
		doctype: "User", fields: ["name", "full_name", "email"],
		searchfield: "full_name", primary: "full_name", sub: "email", id: "name",
	},
	Employee: {
		doctype: "Employee", fields: ["name", "employee_name", "company"],
		searchfield: "employee_name", primary: "employee_name", sub: "company", id: "name",
	},
};

const CRM_ADD_FIELDS = [
	...CRM_COLUMNS.filter(c => c.field !== "drawing").map(c => c.field),
	"name", "has_drawing",
];

frappe.listview_settings["CRM Log"] = {
	hide_name_column: true,
	add_fields: CRM_ADD_FIELDS,

	onload(listview) {
		GL.suppressRefresh(listview);
	},

	refresh(listview) {
		GL.suppressRefresh(listview);
		GL.hideNative(listview);

		const lnc     = GL.makeLinkNameCache();
		const cw      = GL.makeColWidths("crm_log_col_widths");
		const attCnt  = GL.makeCountCache();
		const host    = GL.bootstrap(listview, { doctype: "CRM Log" });
		if (!host) return;

		// Pre-seed link-name cache from already-loaded data
		(listview.data || []).forEach(doc => {
			CRM_COLUMNS.filter(c => c.type === "avatar").forEach(c => {
				if (doc[c.field]) {
					const known = lnc.get(c.link_doctype, doc[c.field]);
					if (!known) lnc.resolve(c.link_doctype, doc[c.field], c.link_namefield);
				}
			});
		});
		lnc.onResolve = () => crm_render(listview, host, lnc, cw, attCnt);

		crm_render(listview, host, lnc, cw, attCnt);
	},
};

// ── Render ────────────────────────────────────────────────────────────────────

function crm_render(listview, host, lnc, cw, attCnt) {
	const rows  = listview.data || [];
	const getTpl = () => GL.gridTpl(CRM_COLUMNS, cw.widths);
	const saveFn = (name, field, value) => GL.fastSave("CRM Log", name, field, value);

	// Build grid HTML
	const headerCells = CRM_COLUMNS.map((c, i) =>
		`<div class="gl-cell gl-hdr" style="justify-content:${c.type==='avatar'||c.type==='attach'||c.type==='drawing'?'center':'flex-start'}">` +
		`${__(c.label)}<div class="gl-rh" data-col="${i}"></div></div>`
	).join("");

	const bodyHtml = rows.length
		? rows.map((doc, ri) =>
			GL.rnCell(doc, ri) +
			CRM_COLUMNS.map(c => `<div class="gl-cell" data-name="${doc.name}">${crm_cell(c, doc, lnc, attCnt)}</div>`).join("")
		).join("")
		: `<div class="gl-empty" style="grid-column:1/-1">${__("No records")}</div>`;

	host.innerHTML =
		`<div class="gl-toolbar">` +
		`<button class="btn btn-sm btn-primary gl-add-btn"><span class="gl-add-icon">+</span> ${__("New CRM Log")}</button>` +
		`</div>` +
		`<div class="gl-grid gl-grid--scroll" style="grid-template-columns:${getTpl()}">` +
		GL.rnHeader() + headerCells + bodyHtml +
		`</div>`;

	const $host = $(host);
	const $grid = $host.find(".gl-grid");
	const esm   = GL.editState($grid);

	GL.bindHover($grid);
	GL.bindDelete($grid, "CRM Log", listview, () => crm_render(listview, host, lnc, cw, attCnt));
	GL.bindColResize($grid, CRM_COLUMNS, cw.widths, getTpl, cw.save);
	GL.bindOutsideClick($grid, esm, "crm");
	GL.bindTextEdit($grid, rows, saveFn, esm);
	GL.bindDateEdit($grid, rows, saveFn, esm);
	GL.bindSelectChange($grid, rows, saveFn);
	GL.bindAreaAutogrow($grid);
	GL.bindAreaSave($grid, rows, saveFn);
	GL.bindMapsToggle($grid);
	GL.bindMapsEdit($grid, rows, saveFn);
	GL.bindAvatarAutocomplete($grid, CRM_LINK_CONFIG, crm_avatar_save(listview, host, lnc, cw, attCnt), lnc);
	GL.bindDrawings($grid, { doctype: "CRM Log", drawingField: "drawing", hasDrawingField: "has_drawing" }, listview,
		() => crm_render(listview, host, lnc, cw, attCnt));
	GL.bindAttachments($grid, {
		doctype: "CRM Log", attachDoctype: "CRM Log Attachment",
		attachTableField: "attachments", attachCounts: attCnt, uploadable: false,
	}, listview, () => crm_render(listview, host, lnc, cw, attCnt));

	GL.bindAddRow($host, () => crm_add_row(listview, host, lnc, cw, attCnt));
}

// ── Cell renderer dispatch ────────────────────────────────────────────────────

function crm_cell(col, doc, lnc, attCnt) {
	const raw = doc[col.field];
	switch (col.type) {
		case "select":  return GL.renderSelect(col, doc.name, raw);
		case "date":    return GL.renderDate(col, doc.name, raw);
		case "avatar":  return GL.renderAvatar(col, doc.name, raw, lnc);
		case "maps":    return GL.renderMaps(col, doc.name, raw);
		case "area":    return GL.renderArea(col, doc.name, raw);
		case "attach":  return GL.renderAttachBtn(doc.name, attCnt.fromRaw(doc.name, raw));
		case "drawing": return GL.renderDrawingBtn(doc.name, doc.has_drawing);
		default:        return GL.renderText(col, doc.name, raw, col.type);
	}
}

// ── Avatar save (upsert path) ─────────────────────────────────────────────────
// Returns a saveFn suitable for bindAvatarAutocomplete.
// CRM Log uses upsertUser for the "user" field and upsertEmployee for "assigned_to".

function crm_avatar_save(listview, host, lnc, cw, attCnt) {
	return function (docname, field, value) {
		const rerender = () => crm_render(listview, host, lnc, cw, attCnt);
		if (field === "user") {
			GL.upsertUser(value, id => GL.saveLinkedField("CRM Log", docname, field, id, listview, rerender));
		} else if (field === "assigned_to") {
			const doc = (listview.data || []).find(d => d.name === docname);
			GL.upsertEmployee(value, doc?.company_name || "", id => GL.saveLinkedField("CRM Log", docname, field, id, listview, rerender));
		} else {
			GL.fastSave("CRM Log", docname, field, value).then(rerender);
		}
		return Promise.resolve();
	};
}

// ── Add row ───────────────────────────────────────────────────────────────────

function crm_add_row(listview, host, lnc, cw, attCnt) {
	frappe.call({
		method: "frappe.client.insert",
		args: { doc: { doctype: "CRM Log", status: "Open", date: frappe.datetime.get_today() } },
		callback: ({ exc, message: doc }) => {
			if (exc || !doc) return;
			(listview.data = listview.data || []).push(doc);
			crm_render(listview, host, lnc, cw, attCnt);
			// Scroll to the new row and focus the first text cell
			setTimeout(() => {
				const $grid = $(host).find(".gl-grid");
				const $last = $grid.find(`.gl-cell[data-name="${doc.name}"]`).last();
				$last[0]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}, 60);
		},
	});
}
