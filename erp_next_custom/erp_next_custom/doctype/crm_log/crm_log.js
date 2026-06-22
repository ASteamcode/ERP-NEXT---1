(() => {
// erp_next_custom/erp_next_custom/public/js/crm_log.js
// ─────────────────────────────────────────────────────────────────────────────
// CRM Log — Form (Detail) Script
// Behaviour & layout tweaks for the "New / Edit CRM Log" form view.
// Wire up in hooks.py:
//   doctype_js = { "CRM Log": "public/js/crm_log.js" }
//
// REQUIRED schema (add these Data fields to the CRM Log doctype, then export
// fixtures). The script hides the raw `site_location` and builds it from these:
//   loc_country  (Country)   loc_district (District)
//   loc_city     (City)      loc_street   (Street)
// ─────────────────────────────────────────────────────────────────────────────

// Sub-fields that compose `site_location`, in display + concatenation order.
const CRM_LOCATION_PARTS = ["loc_country", "loc_district", "loc_city", "loc_street"];

// The tab order: Enter in any of these moves focus to the next one.
const CRM_TAB_ORDER = [
	"status", "category", "user", "assigned_to", "log_type", "prefix",
	"first_name", "last_name", "company_name", "mobile", "tel", "email",
	"description", "updates",
	"loc_country", "loc_district", "loc_city", "loc_street",
	"google_maps_url",
];

frappe.ui.form.on("CRM Log", {
	onload(frm) {
		crm_hide_raw_location(frm);
	},

	refresh(frm) {
		crm_hide_raw_location(frm);
		crm_bind_enter_navigation(frm);
		crm_update_linked_section(frm);
	},

	category(frm) {
		crm_update_linked_section(frm);
	},

	// Auto-set the creation datetime on every save (always overwrite).
	before_save(frm) {
		frm.set_value("date", frappe.datetime.now_datetime());
	},

	// Rebuild the combined `site_location` whenever any part changes.
	loc_country(frm)  { crm_rebuild_location(frm); },
	loc_district(frm) { crm_rebuild_location(frm); },
	loc_city(frm)     { crm_rebuild_location(frm); },
	loc_street(frm)   { crm_rebuild_location(frm); },
});

// ─────────────────────────────────────────────────────────────────────────────
// SITE LOCATION — split inputs, single stored value
// The four loc_* fields are real fields the user edits. `site_location` is
// hidden and holds the concatenated, comma-joined value for storage/search.
// ─────────────────────────────────────────────────────────────────────────────

function crm_hide_raw_location(frm) {
	frm.set_df_property("site_location", "hidden", 1);
	// Keep it read-only too, so nothing else writes to it directly.
	frm.set_df_property("site_location", "read_only", 1);
}

function crm_rebuild_location(frm) {
	const combined = CRM_LOCATION_PARTS
		.map(f => (frm.doc[f] || "").trim())
		.filter(Boolean)
		.join(", ");
	// Only write if changed, to avoid spurious dirty state / save loops.
	if ((frm.doc.site_location || "") !== combined) {
		frm.set_value("site_location", combined);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTER → NEXT FIELD
// Pressing Enter in a field focuses the next field in CRM_TAB_ORDER. Textareas
// (description / updates) are skipped so Enter still inserts newlines there.
// ─────────────────────────────────────────────────────────────────────────────

const CRM_MULTILINE_FIELDS = new Set(["description", "updates"]);

function crm_bind_enter_navigation(frm) {
	CRM_TAB_ORDER.forEach((fieldname) => {
		if (CRM_MULTILINE_FIELDS.has(fieldname)) return;

		const field = frm.get_field(fieldname);
		const $input = field?.$input;
		if (!$input || !$input.length) return;

		// Namespaced + unbound-first so refresh re-binding never stacks handlers.
		$input.off("keydown.crmnav").on("keydown.crmnav", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			crm_focus_next(frm, fieldname);
		});
	});
}

function crm_focus_next(frm, currentField) {
	const idx = CRM_TAB_ORDER.indexOf(currentField);
	if (idx === -1) return;

	// Walk forward to the next field that exists and is focusable.
	for (let i = idx + 1; i < CRM_TAB_ORDER.length; i++) {
		const next = frm.get_field(CRM_TAB_ORDER[i]);
		const $next = next?.$input;
		if ($next && $next.length && next.df.hidden !== 1) {
			$next.trigger("focus");
			return;
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW — show "Linked Records" section only when category = Lead
// ─────────────────────────────────────────────────────────────────────────────

function crm_update_linked_section(frm) {
	const show = frm.doc.category === "Lead";
	frm.set_df_property("workflow_section", "hidden", show ? 0 : 1);
	frm.refresh_field("workflow_section");
}
})();
