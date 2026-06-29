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
		crm_set_default_country(frm);
	},

	refresh(frm) {
		crm_hide_raw_location(frm);
		crm_bind_enter_navigation(frm);
		crm_bind_company_autocomplete(frm);
		crm_bind_location_autocomplete(frm);
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
// CLIENT COMPANY AUTOCOMPLETE
// CRM Log company names should come from the client-company pool used by Sales
// REP CRM, not ERPNext's internal Company doctype.
// ─────────────────────────────────────────────────────────────────────────────

function crm_bind_company_autocomplete(frm) {
	const field = frm.get_field("company_name");
	const input = field?.$input?.get(0);
	if (!input || input.dataset.crmCompanyAutocomplete === "1") return;
	input.dataset.crmCompanyAutocomplete = "1";
	input.setAttribute("autocomplete", "off");

	let awesomplete = null;
	if (window.Awesomplete) {
		awesomplete = new Awesomplete(input, { minChars: 1, maxItems: 8, autoFirst: true });
	}

	let timer = null;
	input.addEventListener("input", () => {
		clearTimeout(timer);
		const txt = input.value.trim();
		if (!txt) {
			if (awesomplete) awesomplete.list = [];
			return;
		}

		timer = setTimeout(() => {
			frappe.call({
				method: "erp_next_custom.erp_next_custom.doctype.crm_log.crm_log.get_client_companies",
				args: { txt, limit: 8 },
				callback(r) {
					const companies = r.message || [];
					if (awesomplete) {
						awesomplete.list = companies;
						awesomplete.evaluate();
					}
				},
			});
		}, 180);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION AUTOCOMPLETE
// Mirrors the Sales REP CRM location picker for country / district / city / street.
// ─────────────────────────────────────────────────────────────────────────────

const CRM_LOC_FIELD_KIND = {
	loc_country: "country",
	loc_district: "district",
	loc_city: "city",
	loc_street: "street",
};

function crm_set_default_country(frm) {
	if (!frm.doc.loc_country) frm.set_value("loc_country", "Lebanon");
}

function crm_bind_location_autocomplete(frm) {
	Object.keys(CRM_LOC_FIELD_KIND).forEach((fieldname) => {
		const field = frm.get_field(fieldname);
		const input = field?.$input?.get(0);
		if (!input || input.dataset.crmLocAutocomplete === "1") return;
		input.dataset.crmLocAutocomplete = "1";
		input.setAttribute("autocomplete", "off");

		let awesomplete = null;
		if (window.Awesomplete) {
			awesomplete = new Awesomplete(input, { minChars: 2, maxItems: 8, autoFirst: true });
		}

		let timer = null;
		let hitsByLabel = new Map();

		input.addEventListener("input", () => {
			clearTimeout(timer);
			const txt = input.value.trim();
			if (!txt || txt.length < 2) {
				if (awesomplete) awesomplete.list = [];
				return;
			}

			timer = setTimeout(() => {
				const query = crm_build_location_query(frm, fieldname, txt);
				fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8`, {
					headers: { "Accept-Language": "en" },
				})
				.then(r => r.json())
				.then(data => {
					hitsByLabel = new Map();
					const labels = (data || []).map(hit => {
						const label = crm_location_label(hit, CRM_LOC_FIELD_KIND[fieldname]);
						if (label) hitsByLabel.set(label, hit);
						return label;
					}).filter(Boolean);
					if (awesomplete) {
						awesomplete.list = [...new Set(labels)];
						awesomplete.evaluate();
					}
				})
				.catch(() => { if (awesomplete) awesomplete.list = []; });
			}, 280);
		});

		input.addEventListener("awesomplete-selectcomplete", () => {
			const hit = hitsByLabel.get(input.value);
			if (hit) crm_apply_location_hit(frm, fieldname, hit);
		});
	});
}

function crm_build_location_query(frm, fieldname, txt) {
	if (fieldname === "loc_street") return `${txt}${frm.doc.loc_city ? ", " + frm.doc.loc_city : ""}`;
	if (fieldname === "loc_district") return `${txt}${frm.doc.loc_country ? ", " + frm.doc.loc_country : ""}`;
	return txt;
}

function crm_pick_location_part(address, kind) {
	if (kind === "country") return address.country;
	if (kind === "district") return address.state || address.state_district || address.county;
	if (kind === "city") return address.city || address.town || address.village || address.suburb || address.municipality;
	if (kind === "street") return address.road || address.pedestrian || address.footway;
	return null;
}

function crm_location_label(hit, kind) {
	const address = hit.address || {};
	const primary = crm_pick_location_part(address, kind) || (hit.display_name || "").split(",")[0];
	const district = address.state || address.state_district || address.county || "";
	const country = address.country || "";
	const parts = [primary, kind !== "district" ? district : "", kind !== "country" ? country : ""]
		.filter((p, i) => p && (i === 0 || p !== primary));
	return [...new Set(parts)].join(", ");
}

function crm_apply_location_hit(frm, changedField, hit) {
	const address = hit.address || {};
	const values = {
		loc_country: address.country,
		loc_district: address.state || address.state_district || address.county,
		loc_city: address.city || address.town || address.village || address.suburb || address.municipality,
		loc_street: CRM_LOC_FIELD_KIND[changedField] === "street" ? (address.road || address.pedestrian || address.footway) : undefined,
	};

	Object.entries(values).forEach(([fieldname, value]) => {
		if (!value) return;
		if (fieldname === changedField || !frm.doc[fieldname]) frm.set_value(fieldname, value);
	});
}

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
