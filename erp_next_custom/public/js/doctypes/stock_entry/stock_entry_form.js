frappe.ui.form.on("Stock Entry", {
	refresh(frm) {
		force_scaffolding_warehouse_fields(frm);
		setTimeout(() => force_scaffolding_warehouse_fields(frm), 500);
	},

	purpose(frm) {
		setTimeout(() => force_scaffolding_warehouse_fields(frm), 300);
	},

	stock_entry_type(frm) {
		setTimeout(() => force_scaffolding_warehouse_fields(frm), 300);
	},

	custom_movement_type(frm) {
		setTimeout(() => force_scaffolding_warehouse_fields(frm), 300);
	},
});

function force_scaffolding_warehouse_fields(frm) {
	["from_warehouse", "to_warehouse"].forEach((fieldname) => {
		frm.set_df_property(fieldname, "hidden", 0);
		frm.set_df_property(fieldname, "depends_on", "");
		frm.refresh_field(fieldname);
	});

	if (frm.fields_dict.items && frm.fields_dict.items.grid) {
		const grid = frm.fields_dict.items.grid;

		["s_warehouse", "t_warehouse"].forEach((fieldname) => {
			grid.update_docfield_property(fieldname, "hidden", 0);
			grid.update_docfield_property(fieldname, "in_list_view", 1);
		});

		grid.refresh();
	}
}
