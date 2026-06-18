frappe.ui.form.on('Item', {
	refresh(frm) {
		// Highlight the key identification fields for quick scanning
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

		highlight(['item_code', 'item_name', 'custom_arabic_name'], '#fff5f5', '#e74c3c');
	}
});
