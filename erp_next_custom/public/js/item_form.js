frappe.ui.form.on('Item', {
	refresh(frm) {
		const highlight = (fields, bg, border) => {
			fields.forEach(field => {
				const f = frm.fields_dict[field];
				if (!f) return;
				f.$wrapper
					.css('background-color', bg)
					.css('border-left', `4px solid ${border}`)
					.css('border-radius', '4px')
					.css('padding', '6px');
			});
		};

		highlight(['item_code', 'item_name', 'item_group'], '#fff5f5', '#e74c3c');
		highlight(['standard_selling_rate', 'opening_stock'], '#fffde7', '#f1c40f');
		highlight(['is_fixed_asset', 'asset_category'], '#f0f8ff', '#3498db');
	}
});
