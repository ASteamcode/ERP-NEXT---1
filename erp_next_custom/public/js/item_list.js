frappe.listview_settings['Item'] = {
	refresh(listview) {
		setTimeout(() => {
			const style_id = 'item-list-compact-columns';
			if (document.getElementById(style_id)) return;

			const style = document.createElement('style');
			style.id = style_id;
			style.innerHTML = `
				.list-row-col.list-subject {
					flex: 0 0 120px !important;
					max-width: 120px !important;
				}
				.list-row-col.ellipsis.hidden-xs {
					flex: 0 0 140px !important;
					max-width: 140px !important;
				}
			`;
			document.head.appendChild(style);
		}, 300);
	}
};
