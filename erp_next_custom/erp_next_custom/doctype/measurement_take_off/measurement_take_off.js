// Measurement Take Off — Form Script

const MTO_TAB_ORDER = [
	"status", "date", "assigned_to", "lead", "site_survey", "contact", "notes",
];

const MTO_MULTILINE_FIELDS = new Set(["notes"]);

frappe.ui.form.on("Measurement Take Off", {
	refresh(frm) {
		mto_bind_enter_navigation(frm);
	},

	before_save(frm) {
		frm.set_value("date", frappe.datetime.get_today());
	},
});

function mto_bind_enter_navigation(frm) {
	MTO_TAB_ORDER.forEach((fieldname) => {
		if (MTO_MULTILINE_FIELDS.has(fieldname)) return;
		const field  = frm.get_field(fieldname);
		const $input = field?.$input;
		if (!$input || !$input.length) return;

		$input.off("keydown.mtonav").on("keydown.mtonav", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			mto_focus_next(frm, fieldname);
		});
	});
}

function mto_focus_next(frm, currentField) {
	const idx = MTO_TAB_ORDER.indexOf(currentField);
	if (idx === -1) return;
	for (let i = idx + 1; i < MTO_TAB_ORDER.length; i++) {
		const next  = frm.get_field(MTO_TAB_ORDER[i]);
		const $next = next?.$input;
		if ($next && $next.length && next.df.hidden !== 1) {
			$next.trigger("focus");
			return;
		}
	}
}
