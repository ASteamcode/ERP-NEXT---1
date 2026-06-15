// Site Survey — Form Script

const SS_TAB_ORDER = [
	"status", "survey_date", "assigned_to", "customer", "lead", "contact",
	"site_type", "roof_type", "site_area",
	"site_location", "google_maps_url",
	"notes", "updates",
];

const SS_MULTILINE_FIELDS = new Set(["notes", "updates"]);

frappe.ui.form.on("Site Survey", {
	refresh(frm) {
		ss_bind_enter_navigation(frm);
	},

	before_save(frm) {
		// Ensure has_drawing and has_measurements flags stay consistent.
		if (!frm.doc.drawing) frm.set_value("has_drawing", 0);
		const items = frm.doc.measurements;
		if (Array.isArray(items)) frm.set_value("has_measurements", items.length ? 1 : 0);
	},
});

function ss_bind_enter_navigation(frm) {
	SS_TAB_ORDER.forEach((fieldname) => {
		if (SS_MULTILINE_FIELDS.has(fieldname)) return;
		const field  = frm.get_field(fieldname);
		const $input = field?.$input;
		if (!$input || !$input.length) return;

		$input.off("keydown.ssnav").on("keydown.ssnav", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			ss_focus_next(frm, fieldname);
		});
	});
}

function ss_focus_next(frm, currentField) {
	const idx = SS_TAB_ORDER.indexOf(currentField);
	if (idx === -1) return;
	for (let i = idx + 1; i < SS_TAB_ORDER.length; i++) {
		const next   = frm.get_field(SS_TAB_ORDER[i]);
		const $next  = next?.$input;
		if ($next && $next.length && next.df.hidden !== 1) {
			$next.trigger("focus");
			return;
		}
	}
}
