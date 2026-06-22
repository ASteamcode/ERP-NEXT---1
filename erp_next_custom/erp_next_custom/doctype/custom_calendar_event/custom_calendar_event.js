(() => {
// Custom Calendar Event — Form Script

const CCE_TAB_ORDER = [
	"title", "status", "event_type", "color",
	"start_date", "end_date", "start_time", "end_time",
	"assigned_to", "contact_person", "crew_number",
	"customer", "lead", "contact",
	"location", "google_maps_url",
	"description", "notes",
];

const CCE_MULTILINE_FIELDS = new Set(["description", "notes"]);

frappe.ui.form.on("Custom Calendar Event", {
	refresh(frm) {
		cce_bind_enter_navigation(frm);
	},

	before_save(frm) {
		const attachments = frm.doc.attachments;
		frm.set_value("has_attachment", Array.isArray(attachments) && attachments.length ? 1 : 0);
	},
});

function cce_bind_enter_navigation(frm) {
	CCE_TAB_ORDER.forEach((fieldname) => {
		if (CCE_MULTILINE_FIELDS.has(fieldname)) return;
		const field  = frm.get_field(fieldname);
		const $input = field?.$input;
		if (!$input || !$input.length) return;
		$input.off("keydown.ccenav").on("keydown.ccenav", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			cce_focus_next(frm, fieldname);
		});
	});
}

function cce_focus_next(frm, currentField) {
	const idx = CCE_TAB_ORDER.indexOf(currentField);
	if (idx === -1) return;
	for (let i = idx + 1; i < CCE_TAB_ORDER.length; i++) {
		const next  = frm.get_field(CCE_TAB_ORDER[i]);
		const $next = next?.$input;
		if ($next && $next.length && next.df.hidden !== 1) { $next.trigger("focus"); return; }
	}
}

})();
