// Measurement Take Off — List View (built on GL)
// Replaces the old hybrid that borrowed CRM Log's CSS prefix.

const MTO_COLUMNS = [
	{ field: "status",       label: "Status",       type: "select",  width: 130, options: ["Draft", "In Progress", "Completed", "Cancelled"] },
	{ field: "date",         label: "Date",         type: "date",    width: 110 },
	{ field: "assigned_to",  label: "Assigned To",  type: "avatar",  width: 60,  link_doctype: "Employee", link_namefield: "employee_name", variant: "grey" },
	{ field: "lead",         label: "Lead",         type: "link",    width: 160, link_doctype: "Lead" },
	{ field: "site_survey",  label: "Site Survey",  type: "link",    width: 160, link_doctype: "Site Survey" },
	{ field: "contact",      label: "Contact",      type: "link",    width: 160, link_doctype: "Contact" },
	{ field: "notes",        label: "Notes",        type: "area",    width: 320 },
];

const MTO_LINK_CONFIG = {
	Employee: {
		doctype: "Employee", fields: ["name", "employee_name", "company"],
		searchfield: "employee_name", primary: "employee_name", sub: "company", id: "name",
	},
};

const MTO_ADD_FIELDS = [
	...MTO_COLUMNS.map(c => c.field),
	"name",
];

frappe.listview_settings["Measurement Take Off"] = {
	hide_name_column: true,
	add_fields: MTO_ADD_FIELDS,

	onload(listview) {
		GL.suppressRefresh(listview);
	},

	refresh(listview) {
		GL.suppressRefresh(listview);
		GL.hideNative(listview);

		const lnc  = GL.makeLinkNameCache();
		const cw   = GL.makeColWidths("mto_col_widths");
		const host = GL.bootstrap(listview, { doctype: "Measurement Take Off" });
		if (!host) return;

		lnc.onResolve = () => mto_render(listview, host, lnc, cw);
		mto_render(listview, host, lnc, cw);
	},
};

// ── Render ────────────────────────────────────────────────────────────────────

function mto_render(listview, host, lnc, cw) {
	const rows     = listview.data || [];
	const getTpl   = () => GL.gridTpl(MTO_COLUMNS, cw.widths);
	const saveFn   = (name, field, value) => GL.fastSave("Measurement Take Off", name, field, value);
	const rerender = () => mto_render(listview, host, lnc, cw);

	const headerCells = MTO_COLUMNS.map((c, i) =>
		`<div class="gl-cell gl-hdr" style="justify-content:${c.type==='avatar'?'center':'flex-start'}">` +
		`${__(c.label)}<div class="gl-rh" data-col="${i}"></div></div>`
	).join("");

	const bodyHtml = rows.length
		? rows.map((doc, ri) =>
			GL.rnCell(doc, ri) +
			MTO_COLUMNS.map(c => `<div class="gl-cell" data-name="${doc.name}">${mto_cell(c, doc, lnc)}</div>`).join("")
		).join("")
		: `<div class="gl-empty" style="grid-column:1/-1">${__("No records")}</div>`;

	host.innerHTML =
		`<div class="gl-toolbar">` +
		`<button class="btn btn-sm btn-primary gl-add-btn"><span class="gl-add-icon">+</span> ${__("New MTO")}</button>` +
		`</div>` +
		`<div class="gl-grid gl-grid--scroll" style="grid-template-columns:${getTpl()}">` +
		GL.rnHeader() + headerCells + bodyHtml +
		`</div>`;

	const $host = $(host);
	const $grid = $host.find(".gl-grid");
	const esm   = GL.editState($grid);

	GL.bindHover($grid);
	GL.bindDelete($grid, "Measurement Take Off", listview, rerender);
	GL.bindColResize($grid, MTO_COLUMNS, cw.widths, getTpl, cw.save);
	GL.bindOutsideClick($grid, esm, "mto");
	GL.bindDateEdit($grid, rows, saveFn, esm);
	GL.bindLinkEdit($grid, rows, saveFn, esm);
	GL.bindSelectChange($grid, rows, saveFn);
	GL.bindAreaAutogrow($grid);
	GL.bindAreaSave($grid, rows, saveFn);
	GL.bindAvatarAutocomplete($grid, MTO_LINK_CONFIG, mto_avatar_save(listview, rerender), lnc);

	GL.bindAddRow($host, () => mto_add_row(listview, host, lnc, cw));
}

// ── Cell renderer dispatch ────────────────────────────────────────────────────

function mto_cell(col, doc, lnc) {
	const raw = doc[col.field];
	switch (col.type) {
		case "select": return GL.renderSelect(col, doc.name, raw);
		case "date":   return GL.renderDate(col, doc.name, raw);
		case "avatar": return GL.renderAvatar(col, doc.name, raw, lnc);
		case "link":   return GL.renderLink(col, doc.name, raw);
		case "area":   return GL.renderArea(col, doc.name, raw);
		default:       return GL.renderText(col, doc.name, raw, col.type);
	}
}

// ── Avatar save ───────────────────────────────────────────────────────────────

function mto_avatar_save(listview, rerender) {
	return function (docname, field, value) {
		if (field === "assigned_to") {
			GL.upsertEmployee(value, "", id => GL.saveLinkedField("Measurement Take Off", docname, field, id, listview, rerender));
		} else {
			GL.fastSave("Measurement Take Off", docname, field, value).then(rerender);
		}
		return Promise.resolve();
	};
}

// ── Add row ───────────────────────────────────────────────────────────────────

function mto_add_row(listview, host, lnc, cw) {
	frappe.call({
		method: "frappe.client.insert",
		args: { doc: { doctype: "Measurement Take Off", status: "Draft", date: frappe.datetime.get_today() } },
		callback: ({ exc, message: doc }) => {
			if (exc || !doc) return;
			(listview.data = listview.data || []).push(doc);
			mto_render(listview, host, lnc, cw);
			setTimeout(() => {
				const $grid = $(host).find(".gl-grid");
				const $last = $grid.find(`.gl-cell[data-name="${doc.name}"]`).last();
				$last[0]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}, 60);
		},
	});
}
